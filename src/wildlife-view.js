const CETACEANS = new Set(['dolphin', 'orca', 'humpback']);

function transform(encounter, member, x, y, p) {
  const s = Math.sin(encounter.heading),
    c = Math.cos(encounter.heading),
    ox = encounter.x + member.offsetX,
    oy = encounter.y + member.offsetY;
  return { x: (ox + x * c - y * s) * p, y: (oy + x * s + y * c) * p };
}
function polygon(g, encounter, member, p, color, points, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(
    points.map(([x, y]) => transform(encounter, member, x, y, p)),
    true,
  );
}
function wake(g, encounter, member, p, length, alpha = 0.35) {
  const a = transform(encounter, member, -1.2, length / 2, p),
    b = transform(encounter, member, -2.6, length, p),
    c = transform(encounter, member, 1.2, length / 2, p),
    d = transform(encounter, member, 2.6, length, p);
  g.lineStyle(1.2, 0xd7f3ef, alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineBetween(c.x, c.y, d.x, d.y);
}
function drawBird(g, encounter, member, p, detailed) {
  const eagle = encounter.species === 'eagle',
    flying = encounter.state !== 'perched';
  if (!flying) {
    const q = transform(encounter, member, 0, 0, p);
    g.fillStyle(0x513b2b, 0.95);
    g.fillEllipse(q.x, q.y, 0.9 * p, 1.45 * p);
    g.fillStyle(0xe9e3d0, 0.95);
    g.fillCircle(q.x, q.y - 0.7 * p, 0.28 * p);
    return;
  }
  const flap = detailed ? Math.sin(encounter.born + member.phase + encounter.x * 0.13) * 0.8 : 0;
  polygon(
    g,
    encounter,
    member,
    p,
    eagle ? 0x49372a : encounter.species === 'goose' ? 0x9c9581 : 0xe7ece8,
    [
      [0, -0.8],
      [-1.2, 0],
      [-2.8, -0.35 - flap],
      [-1.1, 0.75],
      [0, 0.35],
      [1.1, 0.75],
      [2.8, -0.35 - flap],
      [1.2, 0],
    ],
  );
  if (eagle && detailed)
    polygon(g, encounter, member, p, 0xe9e3d0, [
      [-0.25, -0.85],
      [0.25, -0.85],
      [0, -1.35],
    ]);
}
function drawPinniped(g, encounter, member, p, detailed) {
  const seaLion = encounter.species === 'seaLion',
    q = transform(encounter, member, 0, 0, p);
  if (encounter.state === 'diving' && !member.surfaced) {
    g.lineStyle(1.2, 0xcbe8e2, 0.22);
    g.strokeCircle(q.x, q.y, 1.5 * p);
    return;
  }
  polygon(
    g,
    encounter,
    member,
    p,
    seaLion ? 0x745541 : 0x526363,
    [
      [0, -1.35],
      [-0.65, -0.45],
      [-0.7, 0.9],
      [0, 1.45],
      [0.7, 0.9],
      [0.65, -0.45],
    ],
    0.95,
  );
  g.fillStyle(seaLion ? 0x85634b : 0x657777, 0.95);
  const head = transform(encounter, member, 0, -1.25, p);
  g.fillCircle(head.x, head.y, 0.5 * p);
  if (detailed) {
    const left = transform(encounter, member, -0.8, 0.3, p),
      right = transform(encounter, member, 0.8, 0.3, p);
    g.lineStyle(1.4, 0x334548, 0.75);
    g.lineBetween(left.x, left.y, right.x, right.y);
  }
  if (encounter.state === 'diving') wake(g, encounter, member, p, 3.5, 0.28);
}
function drawCetacean(g, encounter, member, p, detailed) {
  if (!member.surfaced) return;
  const species = encounter.species,
    length = species === 'humpback' ? 10 : species === 'orca' ? 6.5 : 3.2,
    width = species === 'humpback' ? 3.1 : species === 'orca' ? 2.2 : 1.15,
    color = species === 'orca' ? 0x17252b : species === 'humpback' ? 0x40565b : 0x4f777c;
  polygon(
    g,
    encounter,
    member,
    p,
    color,
    [
      [0, -length * 0.5],
      [-width * 0.23, -length * 0.46],
      [-width * 0.42, -length * 0.34],
      [-width / 2, -length * 0.2],
      [-width * 0.46, length * 0.07],
      [-width * 0.29, length * 0.25],
      [-width * 0.1, length * 0.46],
      [0, length * 0.51],
      [width * 0.1, length * 0.46],
      [width * 0.29, length * 0.25],
      [width * 0.46, length * 0.07],
      [width / 2, -length * 0.2],
      [width * 0.42, -length * 0.34],
      [width * 0.23, -length * 0.46],
    ],
    0.96,
  );
  polygon(g, encounter, member, p, color, [
    [0, length * 0.4],
    [-width * 0.42, length * 0.46],
    [-width * 0.83, length * 0.56],
    [-width * 0.43, length * 0.56],
    [-width * 0.1, length * 0.53],
    [0, length * 0.49],
    [width * 0.1, length * 0.53],
    [width * 0.43, length * 0.56],
    [width * 0.83, length * 0.56],
    [width * 0.42, length * 0.46],
  ]);
  if (detailed) {
    if (species === 'orca') {
      polygon(g, encounter, member, p, 0xe6eeee, [
        [-0.7, -1.65],
        [-0.18, -2.05],
        [-0.1, -1.1],
      ]);
      polygon(g, encounter, member, p, 0x0d171b, [
        [0, -0.2],
        [0, -2.1],
        [0.8, -0.15],
      ]);
    } else {
      polygon(g, encounter, member, p, color, [
        [0, -0.2],
        [0, -1.4],
        [width * 0.5, -0.1],
      ]);
    }
  }
  if (detailed) {
    // Rounded back, long pectoral fins, flukes, blowholes and a faint breath plume.
    polygon(
      g,
      encounter,
      member,
      p,
      species === 'orca' ? 0x253b42 : 0x65777a,
      Array.from({ length: 24 }, (_, i) => [
        Math.cos((i * Math.PI) / 12) * width * 0.24,
        -length * 0.08 + Math.sin((i * Math.PI) / 12) * length * 0.31,
      ]),
      0.6,
    );
    for (const side of [-1, 1])
      polygon(
        g,
        encounter,
        member,
        p,
        species === 'humpback' ? 0x9eafae : color,
        [
          [side * width * 0.35, -length * 0.12],
          [side * width * 0.9, length * 0.11],
          [side * width * 1.12, length * 0.19],
          [side * width * 0.9, length * 0.18],
          [side * width * 0.48, length * 0.04],
        ],
        0.9,
      );
    const nose = transform(encounter, member, 0, -length * 0.33, p);
    g.fillStyle(0x142b32, 0.95);
    g.fillEllipse(nose.x, nose.y, 0.28 * p, 0.5 * p);
    if (member.phase % 3 < 1) {
      for (let i = 0; i < 9; i++) {
        const lift = (0.08 + (i % 4) * 0.04) * length * p,
          spread = Math.sin(i * 4.7) * width * p * 0.2;
        g.lineStyle(Math.max(0.7, p * 0.04), 0xe4efdf, 0.15 - (i % 3) * 0.025);
        g.lineBetween(nose.x, nose.y, nose.x + spread, nose.y - lift);
        g.fillStyle(0xe4efdf, 0.1);
        g.fillCircle(nose.x + spread, nose.y - lift, p * 0.05);
      }
    }
    if (species === 'humpback')
      for (let i = 0; i < 9; i++) {
        const q = transform(
          encounter,
          member,
          Math.sin(i * 7) * width * 0.32,
          -length * 0.38 + i * length * 0.035,
          p,
        );
        g.fillStyle(0xa4bab3, 0.55);
        g.fillCircle(q.x, q.y, 0.09 * p);
      }
  }
  wake(g, encounter, member, p, length * 0.75, species === 'humpback' ? 0.42 : 0.3);
}
export function drawWildlife(g, w, { p, zoom, rangeX, rangeY, maxDistance = Infinity }) {
  const before = w.wildlife?.encounters || [],
    detailed = zoom >= 0.55;
  for (const encounter of before) {
    if (
      Math.abs(encounter.x - w.boat.x) > rangeX + 35 ||
      Math.abs(encounter.y - w.boat.y) > rangeY + 35 ||
      Math.hypot(encounter.x - w.boat.x, encounter.y - w.boat.y) > maxDistance
    )
      continue;
    for (const member of encounter.members) {
      if (['seagull', 'eagle', 'goose'].includes(encounter.species))
        drawBird(g, encounter, member, p, detailed);
      else if (CETACEANS.has(encounter.species)) drawCetacean(g, encounter, member, p, detailed);
      else drawPinniped(g, encounter, member, p, detailed);
    }
  }
}
