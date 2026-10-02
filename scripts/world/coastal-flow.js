import { bedDepthAt, clamp } from '../../src/terrain.js';
import { Buffer } from 'node:buffer';

// Offline, depth-weighted potential flow followed by separated coastal wakes.
// All obstacles come from the SAME sampled seabed used by hulls and divers.
// Recipe channel forcing retains the character/danger of each established race;
// no authored shelter circles or eddy coordinates are used here.
const face = (a, b) => (a && b ? (2 * a * b) / (a + b) : 0);
const smooth = (x) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};

function potential(terrain, flow, level, spacing) {
  const n = Math.round(terrain.size / spacing) + 1,
    count = n * n;
  const permeability = new Float64Array(count),
    phi = new Float64Array(count);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i,
        d = bedDepthAt(terrain, i * spacing, j * spacing) + level;
      // Shallow shelves resist flow; deep slots carry the displaced water.
      permeability[k] = d > 0.35 ? Math.pow(clamp(d / 28, 0.025, 1), 0.3) : 0;
      phi[k] = (i * flow.x + j * flow.y) * spacing;
    }
  // A drying rim can disconnect a tidal pool completely. It cannot acquire
  // wake energy through the rock that surrounds it.
  const connected = new Uint8Array(count),
    queue = new Int32Array(count);
  let head = 0,
    tail = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if ((i === 0 || j === 0 || i === n - 1 || j === n - 1) && permeability[k]) {
        connected[k] = 1;
        queue[tail++] = k;
      }
    }
  while (head < tail) {
    const k = queue[head++],
      i = k % n;
    for (const next of [i ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n])
      if (next >= 0 && next < count && permeability[next] && !connected[next]) {
        connected[next] = 1;
        queue[tail++] = next;
      }
  }
  for (let k = 0; k < count; k++) if (!connected[k]) permeability[k] = 0;
  const weights = new Float64Array(count * 4);
  for (let j = 1; j < n - 1; j++)
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i,
        c = permeability[k];
      weights[k * 4] = face(c, permeability[k - 1]);
      weights[k * 4 + 1] = face(c, permeability[k + 1]);
      weights[k * 4 + 2] = face(c, permeability[k - n]);
      weights[k * 4 + 3] = face(c, permeability[k + n]);
    }
  // Red/black SOR. This runs only when authoring data, never in the frame loop.
  for (let pass = 0; pass < 1400; pass++) {
    let error = 0;
    for (let parity = 0; parity < 2; parity++)
      for (let j = 1; j < n - 1; j++)
        for (let i = 1 + ((j + parity) & 1); i < n - 1; i += 2) {
          const k = j * n + i,
            a = k * 4;
          const l = weights[a],
            r = weights[a + 1],
            u = weights[a + 2],
            d = weights[a + 3];
          const sum = l + r + u + d;
          if (!sum) continue;
          const delta =
            (l * phi[k - 1] + r * phi[k + 1] + u * phi[k - n] + d * phi[k + n]) / sum - phi[k];
          phi[k] += delta * 1.78;
          error = Math.max(error, Math.abs(delta));
        }
    if (error < 0.0005) break;
  }
  const vectors = new Float64Array(count * 2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i,
        c = permeability[k];
      if (!c) continue;
      const l = i ? face(c, permeability[k - 1]) * (phi[k] - phi[k - 1]) : c * flow.x * spacing;
      const r =
        i < n - 1 ? face(c, permeability[k + 1]) * (phi[k + 1] - phi[k]) : c * flow.x * spacing;
      const u = j ? face(c, permeability[k - n]) * (phi[k] - phi[k - n]) : c * flow.y * spacing;
      const d =
        j < n - 1 ? face(c, permeability[k + n]) * (phi[k + n] - phi[k]) : c * flow.y * spacing;
      vectors[k * 2] = (l + r) / (2 * spacing);
      vectors[k * 2 + 1] = (u + d) / (2 * spacing);
    }
  return { n, permeability, vectors };
}

// Scan in FLOW coordinates, retaining the downstream silhouette of each actual
// connected obstruction. A sharp step in that silhouette separates a headland
// wing from its stem (the T island), instead of treating it as a round island.
function coastalWakes(terrain, flow, level, spacing) {
  const size = terrain.size,
    extent = Math.ceil((size * Math.SQRT2) / spacing),
    n = extent * 2 + 1;
  const cells = new Uint8Array(n * n),
    labels = new Int32Array(n * n);
  const speed = Math.hypot(flow.x, flow.y),
    ux = flow.x / speed,
    uy = flow.y / speed;
  const cx = size / 2,
    cy = size / 2;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const s = (i - extent) * spacing,
        t = (j - extent) * spacing;
      const x = cx + s * ux - t * uy,
        y = cy + s * uy + t * ux;
      if (x >= 0 && y >= 0 && x <= size && y <= size && bedDepthAt(terrain, x, y) + level <= 0.35)
        cells[j * n + i] = 1;
    }
  const components = [],
    queue = new Int32Array(n * n);
  for (let k = 0; k < cells.length; k++) {
    if (!cells[k] || labels[k]) continue;
    const id = components.length + 1,
      profile = new Map();
    let head = 0,
      tail = 1;
    queue[0] = k;
    labels[k] = id;
    while (head < tail) {
      const at = queue[head++],
        j = Math.floor(at / n),
        i = at % n;
      profile.set(j, Math.max(profile.get(j) ?? -Infinity, i));
      for (const next of [at - 1, at + 1, at - n, at + n])
        if (next >= 0 && next < cells.length && cells[next] && !labels[next]) {
          labels[next] = id;
          queue[tail++] = next;
        }
    }
    components.push(profile);
  }
  const wakes = [];
  for (const profile of components) {
    const rows = [...profile].sort((a, b) => a[0] - b[0]);
    let part = [];
    const finish = () => {
      if (part.length < 4) return;
      const width = (part.at(-1)[0] - part[0][0] + 1) * spacing;
      const t = ((part[0][0] + part.at(-1)[0]) / 2 - extent) * spacing;
      // The lee face, not the island centre, anchors the recirculation.
      const s = (part.reduce((sum, row) => sum + row[1], 0) / part.length - extent) * spacing;
      wakes.push({
        s,
        t,
        width,
        profile: part.map(([j, i]) => [(j - extent) * spacing, (i - extent) * spacing]),
      });
    };
    for (const row of rows) {
      if (
        part.length &&
        (row[0] !== part.at(-1)[0] + 1 || Math.abs(row[1] - part.at(-1)[1]) * spacing > 30)
      ) {
        finish();
        part = [];
      }
      part.push(row);
    }
    finish();
  }
  return { wakes, ux, uy, cx, cy };
}

function raceGain(recipe, x, y) {
  let gain = 1;
  const speed = Math.hypot(recipe.flow.x, recipe.flow.y);
  for (const channel of recipe.channels || []) {
    const dx = channel.b.x - channel.a.x,
      dy = channel.b.y - channel.a.y,
      l2 = dx * dx + dy * dy;
    const t = clamp(((x - channel.a.x) * dx + (y - channel.a.y) * dy) / l2, 0, 1);
    const distance = Math.hypot(x - channel.a.x - dx * t, y - channel.a.y - dy * t);
    gain +=
      (channel.gain / speed) *
      Math.exp(-((distance / channel.width) ** 2)) *
      Math.sin(Math.PI * (0.12 + 0.76 * t));
  }
  return gain;
}

export function solveCoastalFlow(recipe, terrain, level = 1.15, spacing = 6, sign = 1) {
  const flow = { x: recipe.flow.x * sign, y: recipe.flow.y * sign };
  if (!Math.hypot(flow.x, flow.y))
    return {
      size: terrain.size,
      spacing,
      values: Array((terrain.size / spacing + 1) ** 2 * 2).fill(0),
      wakes: [],
    };
  const field = potential(terrain, flow, level, spacing);
  const { wakes, ux, uy, cx, cy } = coastalWakes(terrain, flow, level, spacing);
  const speed = Math.hypot(flow.x, flow.y),
    values = [];
  for (let j = 0; j < field.n; j++)
    for (let i = 0; i < field.n; i++) {
      const k = j * field.n + i,
        x = i * spacing,
        y = j * spacing;
      if (!field.permeability[k]) {
        values.push(0, 0);
        continue;
      }
      const gain = raceGain(recipe, x, y);
      let vx = field.vectors[k * 2] * gain,
        vy = field.vectors[k * 2 + 1] * gain;
      const s = (x - cx) * ux + (y - cy) * uy,
        t = -(x - cx) * uy + (y - cy) * ux;
      let strongest = 0,
        recircS = 0,
        recircT = 0;
      for (const wake of wakes) {
        const across = t - wake.t,
          half = wake.width / 2;
        if (Math.abs(across) > half * 1.7) continue;
        const row = clamp(
          Math.round((t - wake.profile[0][0]) / spacing),
          0,
          wake.profile.length - 1,
        );
        const downstream = s - wake.profile[row][1];
        if (downstream <= 0 || downstream > wake.width * 2.8) continue;
        const width = half * (0.92 + (downstream / wake.width) * 0.18);
        const cross = Math.exp(-((across / width) ** 4) * 0.8);
        const shelter = cross * Math.exp(-((downstream / (wake.width * 1.15)) ** 2));
        if (shelter <= strongest) continue;
        strongest = shelter;
        // A counter-rotating pair is the derivative of a smooth streamfunction.
        // Gentle backflow near the face, outward return around the two shoulders,
        // and inward reattachment downstream; zero at the obstacle itself.
        const ds = s - wake.s,
          a = Math.max(spacing * 2, wake.width * 0.12),
          length = wake.width * 0.9;
        const positive = Math.max(0, ds),
          enter = 1 - Math.exp(-positive / a);
        const decay = Math.exp(-((positive / length) ** 2)),
          lateral = Math.exp(-((across / (half * 0.72)) ** 2));
        const f = enter * enter * decay;
        const derivative =
          decay *
          ((2 * enter * Math.exp(-positive / a)) / a -
            (enter * enter * 2 * positive) / (length * length));
        const available = Math.hypot(field.vectors[k * 2], field.vectors[k * 2 + 1]) * gain;
        const strength = Math.min(speed * gain, available * 2) * 0.33;
        recircS = -strength * f * lateral * (1 - 2 * (across / (half * 0.72)) ** 2);
        recircT = strength * across * derivative * lateral;
      }
      vx = vx * (1 - strongest * 0.98) + ux * recircS - uy * recircT;
      vy = vy * (1 - strongest * 0.98) + uy * recircS + ux * recircT;
      // At the shore, smoothly remove flow NORMAL to a drying bed. This also
      // prevents wake interpolation leaking through a concave shoreline.
      const depth = bedDepthAt(terrain, x, y) + level;
      if (depth < 4) {
        const gx = bedDepthAt(terrain, x + spacing, y) - bedDepthAt(terrain, x - spacing, y);
        const gy = bedDepthAt(terrain, x, y + spacing) - bedDepthAt(terrain, x, y - spacing);
        const g2 = gx * gx + gy * gy;
        if (g2 > 0.001) {
          const normal = ((vx * gx + vy * gy) / g2) * (1 - smooth((depth - 0.35) / 3.65));
          vx -= gx * normal;
          vy -= gy * normal;
        }
      }
      // Calibrated offshore pressure head offsets bed friction while retaining
      // the established dangerous races. Shelter is entirely local geometry.
      values.push(vx * 1.15, vy * 1.15);
    }
  return {
    size: terrain.size,
    spacing,
    values,
    wakes: wakes.map(({ profile: _profile, ...w }) => w),
  };
}

export function generateCoastalField(recipe, terrain) {
  const levels = terrain.tidalBasin ? [-0.5, 0.35, 1.15, 2.2, 3.2] : [-0.5, 1.15, 3.2],
    spacing = 6;
  return {
    version: 1,
    size: terrain.size,
    spacing,
    levels,
    encoding: 'delta-varint-1000',
    channels: ['floodX', 'floodY', 'ebbX', 'ebbY'],
    layers: levels.map((level) => {
      const flood = solveCoastalFlow(recipe, terrain, level, spacing, 1);
      const ebb = solveCoastalFlow(recipe, terrain, level, spacing, -1);
      const values = [];
      for (let k = 0; k < flood.values.length; k += 2)
        values.push(
          ...[flood.values[k], flood.values[k + 1], ebb.values[k], ebb.values[k + 1]].map(
            (v) => Math.round(v * 1000) / 1000,
          ),
        );
      const bytes = [],
        previous = [0, 0, 0, 0];
      values.forEach((v, i) => {
        const integer = Math.round(v * 1000);
        if (Math.abs(integer) > 32767) throw new Error('Coastal flow exceeds fixed-point range');
        const channel = i % 4,
          delta = integer - previous[channel];
        previous[channel] = integer;
        let encoded = (delta << 1) ^ (delta >> 31);
        do {
          bytes.push((encoded & 127) | (encoded >= 128 ? 128 : 0));
          encoded >>>= 7;
        } while (encoded);
      });
      return Buffer.from(bytes).toString('base64');
    }),
  };
}
