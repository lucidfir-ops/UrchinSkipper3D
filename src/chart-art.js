import { chartContours, paintContours } from './chart-contours.js';
import { bedDepthAt } from './terrain.js';
import { terrainColor } from './presentation.js';
import { patchStyle, patchOutline } from './patch-style.js';
import { chartPixel, CHART_ATLAS } from './chart-material.js';
import { fixedFeatures } from './shore-hazards.js';
import { COASTS } from './coasts.js';

export const rockChartLabel = (rock) => {
  const depth = Math.round(rock.topDepth * 10) / 10;
  return depth < 0 ? `dries ${(-depth).toFixed(1)}` : `${depth.toFixed(1)} m`;
};

const svgEscape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const pointsPath = (points, close = false) =>
  points.length
    ? `${points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}${close ? 'Z' : ''}`
    : '';
const rgb = (color) => `rgb(${color.join(' ')})`;

// SVG charts intentionally sample the authoritative depth function into vector
// cells. Contours and every operational overlay remain in world metres, so
// scaling the chart cannot move a rock, patch, mark or harbour boundary.
function vectorTerrain(terrain, tide, coastOnly, draft) {
  const step = terrain.spacing;
  const fills = new Map();
  for (let y = 0; y < terrain.size; y += step)
    for (let x = 0; x < terrain.size; x += step) {
      const depth = bedDepthAt(terrain, x + step / 2, y + step / 2) + tide,
        color =
          coastOnly && depth > 0
            ? [22, 76, 96]
            : draft && depth > 0 && depth < draft
              ? [154, 133, 78]
              : terrainColor(depth);
      const fill = rgb(color),
        edge = step + 0.08;
      fills.set(fill, (fills.get(fill) || '') + `M${x} ${y}h${edge}v${edge}h-${edge}Z`);
    }
  return `<g data-chart-terrain="">${[...fills].map(([fill, path]) => `<path fill="${fill}" d="${path}"/>`).join('')}</g>`;
}

export function vectorNotes({ tracks = [], reports = [], marks = [], compact = false } = {}) {
  const known = reports
    .map((report) => {
      const outline = report.outline?.length
        ? pointsPath(report.outline, true)
        : `M${report.x - 6} ${report.y}a6 6 0 1 0 12 0a6 6 0 1 0-12 0`;
      return `<path d="${outline}" fill="none" stroke="#f3d18c" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    })
    .join('');
  return `<g class="chart-notes"><g fill="none" stroke="#ef6a5c" stroke-width="1.25">${tracks.map((track) => `<path d="${pointsPath(track.points || [])}"/>`).join('')}</g>${known}<g stroke="#edbe88" fill="#ffe5ab" stroke-width="1.1">${marks.map((mark) => `<path d="M${mark.x - 4} ${mark.y}h8M${mark.x} ${mark.y - 4}v8"/>${compact ? '' : `<text x="${mark.x}" y="${mark.y - 7}" text-anchor="middle" stroke="none">${svgEscape(mark.label)}</text>`}`).join('')}</g></g>`;
}

export function sectorChartSvg(
  terrain,
  {
    tide = 0,
    exact = true,
    boat = null,
    divers = [],
    selectedPatch = null,
    exit = null,
    labels = true,
    noText = false,
    compact = false,
    showPatches = true,
    coastOnly = false,
    draft = null,
    tidalSites = false,
    currents = [],
    revealUrchins = false,
    rocks = fixedFeatures(terrain),
    tracks = [],
    reports = [],
    marks = [],
    viewBox = null,
    ariaLabel = 'Working vector chart',
  } = {},
) {
  const size = terrain.size,
    contourPaths = coastOnly
      ? ''
      : chartContours(terrain)
          .map(
            ({ depth, segments }) =>
              `<path fill="none" stroke="#aed0bf" stroke-opacity=".44" stroke-width=".65" d="${segments.map(([a, b]) => `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`).join('')}"/>${segments[Math.floor(segments.length * 0.57)] ? `<text x="${segments[Math.floor(segments.length * 0.57)][0].x + 3}" y="${segments[Math.floor(segments.length * 0.57)][0].y - 3}" fill="#d3dfc9" font-size="9">${depth} m</text>` : ''}`,
          )
          .join(''),
    patchPaths = (
      showPatches ? terrain.patches.filter((p) => revealUrchins || p.charted !== false) : []
    )
      .map((p) => {
        const style = patchStyle(p),
          path = pointsPath(patchOutline(p), true),
          label =
            exact && labels
              ? `<text x="${p.x}" y="${p.y - p.radius - 3}" fill="#f4ecd3" font-size="11" text-anchor="middle">${p.rate ? `${Math.round(p.quality * 100)} · ${300 / p.rate}s` : 'EMPTY'}</text>`
              : '',
          empty =
            p.remaining <= 0.001
              ? `<path d="M${p.x - 5} ${p.y - 5}L${p.x + 5} ${p.y + 5}" stroke="#99aaa4" fill="none"/>`
              : '';
        return `<path d="${path}" fill="${style.css}" fill-opacity=".33" stroke="${style.css}" stroke-width="${p.id === selectedPatch ? 3 : 1.5}" ${style.tier ? `stroke-dasharray="${Math.max(1, 4 - style.tier)} ${style.tier + 1}"` : ''}/>${label}${empty}`;
      })
      .join(''),
    rockPaths = rocks
      .filter((rock) => rock.charted)
      .map((rock) => {
        const radius = compact ? 2.5 : 3.5,
          label = compact
            ? ''
            : `<text x="${rock.x + 7}" y="${rock.y - 6}" fill="#f9d8d6" stroke="#173641" stroke-width="2.5" paint-order="stroke" font-size="10">${rockChartLabel(rock)}</text>`;
        return `<path d="M${rock.x - radius} ${rock.y - radius}L${rock.x + radius} ${rock.y + radius}M${rock.x + radius} ${rock.y - radius}L${rock.x - radius} ${rock.y + radius}" fill="none" stroke="#172e39" stroke-width="4"/><path d="M${rock.x - radius} ${rock.y - radius}L${rock.x + radius} ${rock.y + radius}M${rock.x + radius} ${rock.y - radius}L${rock.x - radius} ${rock.y + radius}" fill="none" stroke="#f2b8bd" stroke-width="1.5"/>${label}`;
      })
      .join(''),
    currentPaths = currents
      .map((arrow) => {
        const length = 9 + arrow.strength * 4,
          dx = Math.cos(arrow.angle),
          dy = Math.sin(arrow.angle),
          x = arrow.x,
          y = arrow.y;
        return `<path d="M${x - (dx * length) / 2} ${y - (dy * length) / 2}L${x + (dx * length) / 2} ${y + (dy * length) / 2}" stroke="#081f2d" stroke-width="3.5"/><path d="M${x - (dx * length) / 2} ${y - (dy * length) / 2}L${x + (dx * length) / 2} ${y + (dy * length) / 2}" stroke="#c6ece2" stroke-width="${1.1 + arrow.strength * 0.25}"/>`;
      })
      .join(''),
    exitPath = !exit
      ? ''
      : ['south', 'north'].includes(exit)
        ? `<path d="M30 ${exit === 'south' ? size - 3 : 3}H${size - 30}" stroke="#f3d28c" stroke-width="5"/>`
        : `<path d="M${exit === 'east' ? size - 3 : 3} 30V${size - 30}" stroke="#f3d28c" stroke-width="5"/>`,
    boatPath = boat
      ? `<g data-chart-boat="" transform="translate(${boat.x} ${boat.y}) rotate(${(boat.heading * 180) / Math.PI})"><path d="M0 -6L4 5H-4Z" fill="#fff3cf" stroke="#102c3c" stroke-width="1.3"/></g>`
      : '',
    diverPaths = divers
      .filter((d) => d.state !== 'ready')
      .map(
        (d) =>
          `<circle cx="${d.x}" cy="${d.y}" r="3" fill="#ffad58"/>${exact ? `<text x="${d.x + 7}" y="${d.y - 3}" fill="#fff" font-size="10">${d.id + 1}</text>` : ''}`,
      )
      .join(''),
    sites = tidalSites
      ? (terrain.tidalSites || [])
          .map(
            (site) =>
              `<rect x="${site.x - 5}" y="${site.y - 5}" width="10" height="10" fill="none" stroke="#efd4a0"/><text x="${site.x}" y="${site.y - 10}" text-anchor="middle" fill="#f6e4bb" font-size="10">${svgEscape(site.name)}</text>`,
          )
          .join('')
      : '';
  return `<svg class="sector-chart-vector" viewBox="${viewBox || `0 0 ${size} ${size}`}" role="img" aria-label="${svgEscape(ariaLabel)}" preserveAspectRatio="xMidYMid meet"><g shape-rendering="geometricPrecision">${vectorTerrain(terrain, tide, coastOnly, draft)}${contourPaths}${patchPaths}${rockPaths}${currentPaths}${sites}${vectorNotes({ tracks, reports, marks, compact })}${exitPath}${boatPath}${diverPaths}<text x="10" y="18" fill="#f3ead1" font-size="12" font-weight="700">N ↑</text>${compact ? '' : `<text x="10" y="${size - 10}" fill="#f3ead1" font-size="10">${size} m · game chart</text>`}</g></svg>`.replace(
    noText ? /<text\b[^>]*>[\s\S]*?<\/text>/g : /$^/,
    '',
  );
}

export function paintChartRocks(
  ctx,
  terrain,
  scale,
  compact = false,
  features = fixedFeatures(terrain),
) {
  ctx.save();
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'left';
  const rocks = features.filter((r) => r.charted),
    occupied = rocks.map((r) => ({
      x: r.x * scale - 5,
      y: r.y * scale - 5,
      width: 10,
      height: 10,
    })),
    size = terrain.size * scale;
  for (const rock of rocks) {
    const x = rock.x * scale,
      y = rock.y * scale,
      r = compact ? 2.5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#172e39';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f2b8bd';
    ctx.stroke();
    if (compact) continue;
    const label = rockChartLabel(rock),
      width = ctx.measureText(label).width + 4,
      choices = [-16, 5, -29, 18].flatMap((dy) =>
        [x + 7, x - width - 7].map((lx) => ({ x: lx, y: y + dy, width, height: 13 })),
      ),
      overlaps = (a, b) =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y,
      score = (a) =>
        occupied.filter((b) => overlaps(a, b)).length +
        (a.x < 5 || a.y < 20 || a.x + width > size - 5 || a.y + 13 > size - 20 ? 100 : 0),
      box = choices.sort((a, b) => score(a) - score(b))[0],
      lx = box.x,
      ly = box.y + 10;
    occupied.push(box);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#173641';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#f9d8d6';
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}

export function paintSectorMap(
  canvas,
  terrain,
  {
    tide = 0,
    exact = true,
    boat = null,
    divers = [],
    selectedPatch = null,
    exit = null,
    labels = true,
    noText = false,
    compact = false,
    showPatches = true,
    coastOnly = false,
    draft = null,
    tidalSites = false,
    currents = [],
    revealUrchins = false,
    rocks = fixedFeatures(terrain),
    rendition = 'raster',
  } = {},
) {
  const ctx = canvas.getContext('2d'),
    width = canvas.width,
    height = canvas.height,
    scale = width / terrain.size;
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const d = bedDepthAt(terrain, (x / width) * terrain.size, (y / height) * terrain.size) + tide,
        color =
          coastOnly && d > 0
            ? [22, 76, 96]
            : draft && d > 0 && d < draft
              ? [154, 133, 78]
              : terrainColor(d);
      image.data.set(
        [...chartPixel(color, d, x / scale, y / scale, rendition === 'raster'), 255],
        (y * width + x) * 4,
      );
    }
  ctx.putImageData(image, 0, 0);
  if (!coastOnly) paintContours(ctx, terrain, scale, !noText);
  ctx.font = `${width > 300 ? 11 : 9}px system-ui`;
  ctx.textAlign = 'center';
  for (const p of showPatches
    ? terrain.patches.filter((p) => revealUrchins || p.charted !== false)
    : []) {
    const style = patchStyle(p),
      points = patchOutline(p);
    ctx.beginPath();
    points.forEach((a, i) =>
      i ? ctx.lineTo(a.x * scale, a.y * scale) : ctx.moveTo(a.x * scale, a.y * scale),
    );
    ctx.closePath();
    ctx.globalAlpha = 0.33;
    ctx.fillStyle = style.css;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = style.css;
    ctx.lineWidth = p.id === selectedPatch ? 3 : 1.5;
    ctx.setLineDash(style.tier ? [Math.max(1, 4 - style.tier), style.tier + 1] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (exact && labels) {
      ctx.fillStyle = '#f4ecd3';
      ctx.fillText(
        p.rate ? `${Math.round(p.quality * 100)} · ${300 / p.rate}s` : 'EMPTY',
        p.x * scale,
        p.y * scale - p.radius * scale - 3,
      );
    }
    if (p.remaining <= 0.001) {
      ctx.strokeStyle = '#99aaa4';
      ctx.beginPath();
      ctx.moveTo((p.x - 5) * scale, (p.y - 5) * scale);
      ctx.lineTo((p.x + 5) * scale, (p.y + 5) * scale);
      ctx.stroke();
    }
  }
  paintChartRocks(ctx, terrain, scale, compact, rocks);
  for (const arrow of currents) {
    const length = 9 + arrow.strength * 4,
      dx = Math.cos(arrow.angle),
      dy = Math.sin(arrow.angle),
      x = arrow.x * scale,
      y = arrow.y * scale;
    ctx.strokeStyle = '#081f2d';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x - (dx * length) / 2, y - (dy * length) / 2);
    ctx.lineTo(x + (dx * length) / 2, y + (dy * length) / 2);
    ctx.stroke();
    ctx.strokeStyle = '#c6ece2';
    ctx.lineWidth = 1.1 + arrow.strength * 0.25;
    ctx.stroke();
    ctx.fillStyle = '#dcecdf';
    ctx.beginPath();
    ctx.moveTo(x + (dx * length) / 2, y + (dy * length) / 2);
    ctx.lineTo(x + dx * (length / 2 - 5) - dy * 3, y + dy * (length / 2 - 5) + dx * 3);
    ctx.lineTo(x + dx * (length / 2 - 5) + dy * 3, y + dy * (length / 2 - 5) - dx * 3);
    ctx.closePath();
    ctx.fill();
  }
  if (tidalSites)
    for (const site of terrain.tidalSites || []) {
      ctx.strokeStyle = '#efd4a0';
      ctx.lineWidth = 1;
      ctx.strokeRect(site.x * scale - 5, site.y * scale - 5, 10, 10);
      ctx.fillStyle = '#f6e4bb';
      ctx.font = '10px system-ui';
      ctx.fillText(
        site.name,
        Math.max(55, Math.min(width - 55, site.x * scale)),
        site.y * scale - 10,
      );
    }
  if (exit) {
    ctx.strokeStyle = '#f3d28c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (exit === 'south' || exit === 'north') {
      const y = exit === 'south' ? height - 3 : 3;
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
    } else {
      const x = exit === 'east' ? width - 3 : 3;
      ctx.moveTo(x, 30);
      ctx.lineTo(x, height - 30);
    }
    ctx.stroke();
  }
  if (boat) {
    ctx.save();
    ctx.translate(boat.x * scale, boat.y * scale);
    ctx.rotate(boat.heading);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const d of divers)
    if (d.state !== 'ready') {
      ctx.fillStyle = '#ffad58';
      ctx.beginPath();
      ctx.arc(d.x * scale, d.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
      if (exact) {
        ctx.fillStyle = '#fff';
        ctx.fillText(String(d.id + 1), d.x * scale + 7, d.y * scale - 3);
      }
    }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3ead1';
  ctx.font = 'bold 12px system-ui';
  if (!noText) ctx.fillText('N ↑', 10, 18);
  if (!compact && !noText) {
    ctx.font = '10px system-ui';
    ctx.fillText(`${terrain.size} m · game chart`, 10, height - 10);
  }
}

export function regionalChart(grounds, selected, rendition = 'raster') {
  if (grounds.length >= 9) return coastOverview(grounds, selected, rendition);
  const harbour = { x: 115, y: 415 },
    raster = rendition !== 'vector',
    forest = raster
      ? `<pattern id="chartForest" width="550" height="480" patternUnits="userSpaceOnUse"><rect width="550" height="480" fill="#526e5b"/><image href="${CHART_ATLAS}" x="-1100" width="1650" height="480" preserveAspectRatio="none" opacity=".7"/></pattern>`
      : '<pattern id="chartForest" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#526e5b"/><path d="M-3 15L15-3M4 22L22 4" stroke="#6f8972" stroke-width="1" opacity=".55"/></pattern>',
    material = raster
      ? `<svg width="550" height="480" viewBox="550 0 550 480" preserveAspectRatio="none" opacity=".25"><image href="${CHART_ATLAS}" width="1650" height="480" preserveAspectRatio="none"/></svg>`
      : '';
  return `<svg viewBox="0 0 550 480" role="img" aria-label="Synthetic ${raster ? 'raster-textured' : 'vector'} coastal chart with harbour and three working sectors">
    <defs><pattern id="chartGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#8ab7b3" stroke-opacity=".12"/></pattern><linearGradient id="chartWater" x2=".7" y2="1"><stop stop-color="#164b5b"/><stop offset="1" stop-color="#092a3b"/></linearGradient>${forest}</defs>
    <rect width="550" height="480" rx="12" fill="url(#chartWater)"/><rect width="550" height="480" fill="url(#chartGrid)"/>
    ${material}
    <g fill="url(#chartForest)" stroke="#98ae88" stroke-width="2"><path d="M0 0H139L120 34 145 58 101 93 122 121 96 149 134 173 90 203 101 225 68 252 97 289 80 312 121 337 91 363 126 395 108 431 144 480H0Z"/><path d="M550 0H478L470 27 501 49 492 73 520 116 486 143 509 187 496 226 521 248 498 302 526 331 515 371 550 410Z"/>
    <path d="M248 305L268 288 279 257 261 232 241 238 227 266Z"/><path d="M355 195L374 162 364 140 339 154 326 182Z"/><path d="M325 392L346 355 335 330 311 335 301 370Z"/><path d="M199 126L214 98 202 80 181 87 174 108Z"/></g>
    ${grounds.map((g, i) => `<g class="chart-route ${i === selected ? 'active' : ''}" data-ground="${g.id}"><path d="M${harbour.x} ${harbour.y} Q${(harbour.x + g.chart.x) / 2 + 55} ${harbour.y - 30} ${g.chart.x} ${g.chart.y}" fill="none" stroke="${i === selected ? '#f7d18e' : '#7fa7a4'}" stroke-width="${i === selected ? 3 : 1.5}" stroke-dasharray="6 6"/><circle cx="${g.chart.x}" cy="${g.chart.y}" r="${i === selected ? 14 : 10}" fill="#193b45" stroke="${i === selected ? '#f7d18e' : '#9cc5b8'}" stroke-width="2"/><text x="${g.chart.x}" y="${g.chart.y + 4}" text-anchor="middle" fill="#ffe1a7" font-size="12">${i + 1}</text><text x="${g.chart.x}" y="${g.chart.y - 24}" text-anchor="middle" fill="#e4eddb" font-size="15">${g.name}</text><text x="${g.chart.x}" y="${g.chart.y + 33}" text-anchor="middle" fill="#aecbc2" font-size="12">${Math.round(g.travelMinutes)} min from harbour</text></g>`).join('')}
    <g transform="translate(${harbour.x} ${harbour.y})"><path d="M-15 8H15M-9 0H9M0-17V9" stroke="#f4d797" stroke-width="4"/><circle cy="-20" r="4" fill="none" stroke="#f4d797" stroke-width="2"/></g>
    <text x="146" y="438" fill="#f6dfb0" font-size="16">HOME HARBOUR</text><text x="28" y="35" fill="#f1dfb6" font-size="17">N ↑</text><text x="295" y="467" fill="#8baea6" font-size="11">SYNTHETIC COAST · NOT TO SCALE</text></svg>`;
}
function coastOverview(grounds, selected, rendition) {
  return `<svg viewBox="0 0 660 790" role="img" aria-label="Five coasts with three distinct playable subareas each"><rect width="660" height="790" rx="12" fill="#123e50"/>${rendition === 'raster' ? `<svg width="660" height="790" viewBox="550 0 550 480" preserveAspectRatio="none" opacity=".12"><image href="${CHART_ATLAS}" width="1650" height="480" preserveAspectRatio="none"/></svg>` : ''}<text x="24" y="30" fill="#f4dfac" font-size="16">N ↑ · FIVE COASTS / FIFTEEN SUBAREAS</text>${COASTS.map(
    (coast, row) => {
      const y = 60 + row * 140;
      return `<g><path d="M16 ${y + 25}L36 ${y + 5} 48 ${y + 40} 31 ${y + 70} 52 ${y + 106}H16Z" fill="#577963" stroke="#a2bc94"/><text x="65" y="${y}" fill="#ead4a6" font-size="16">${row + 1}. ${coast.name} · ${coast.difficulty}</text>${coast.sectors
        .map((id, col) => {
          const index = grounds.findIndex((g) => g.id === id),
            g = grounds[index],
            x = 145 + col * 200;
          return `<g data-ground="${id}" class="chart-route ${index === selected ? 'active' : ''}"><path d="M65 ${y + 70}H${x}" stroke="#83b0ae" stroke-dasharray="5 5"/><circle cx="${x}" cy="${y + 45}" r="${index === selected ? 16 : 12}" fill="#15313a" stroke="${index === selected ? '#ffd383' : '#92b9b4'}" stroke-width="3"/><text x="${x}" y="${y + 49}" text-anchor="middle" fill="#ffdf9c" font-size="12">${row + 1}.${col + 1}</text><text x="${x}" y="${y + 87}" text-anchor="middle" fill="#f1eed7" font-size="14">${g.name}</text><text x="${x}" y="${y + 107}" text-anchor="middle" fill="#aed0cb" font-size="12">Day ${[1, 3, 5][col]} · ${Math.round(g.travelMinutes)} min home</text></g>`;
        })
        .join('')}</g>`;
    },
  ).join(
    '',
  )}<text x="24" y="778" fill="#a6c5c1" font-size="12">HOME HARBOUR · Synthetic overview, not to scale · Permits apply to whole coasts</text></svg>`;
}
export function harbourArt() {
  return `<svg viewBox="0 0 500 260" role="img" aria-label="Dive boat alongside the harbour dock at sunset"><defs><linearGradient id="dockSky" x2="0" y2="1"><stop stop-color="#294e60"/><stop offset="1" stop-color="#ceae77"/></linearGradient></defs><rect width="500" height="260" fill="url(#dockSky)"/><circle cx="370" cy="81" r="28" fill="#f4d591"/><path d="M0 110L30 78 58 95 95 50 150 105 189 81 244 116 286 63 326 111 393 97 433 120 500 92V170H0" fill="#304f50"/><rect y="142" width="500" height="118" fill="#164553"/><g stroke="#c7c8a0" opacity=".25"><path d="M13 167H86M204 157H260M328 166H448M80 208H151M248 223H401M23 242H79"/></g><path d="M0 159H178V170H0" fill="#927652"/><g stroke="#594f3b" stroke-width="7"><path d="M25 159V225M143 159V206"/></g><g transform="translate(174 141)"><path d="M-13 40H193L165 65H12Z" fill="#ded9b7"/><path d="M105 2H148V40H95Z" fill="#b2d1ca"/><path d="M113 8H142V26H108Z" fill="#214653"/><path d="M125 1V-46M125-40L151-32 125-23" fill="#e4e8d7" stroke="#d5dac0" stroke-width="3"/><path d="M0 36H88" stroke="#765338" stroke-width="6"/><g fill="#d99648" stroke="#f2c47e"><ellipse cx="18" cy="29" rx="12" ry="8"/><ellipse cx="44" cy="29" rx="12" ry="8"/><ellipse cx="70" cy="29" rx="12" ry="8"/></g></g><path d="M0 259H500" stroke="#e0d6ae"/></svg>`;
}
