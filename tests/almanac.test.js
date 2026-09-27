import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { chooseGround } from '../src/day.js';
import { forecast, forecastSeries, estimatedCurrents } from '../src/almanac.js';
import { updateEnvironment, sampleCurve, currentAt } from '../src/environment.js';
import { bedDepthAt } from '../src/terrain.js';
test('forecast preview agrees with authoritative tide/current at that future time without mutating the world', () => {
  const w = createWorld();
  chooseGround(w, 'middle');
  const before = JSON.stringify(w),
    f = forecast(w, 'middle', 180);
  assert.equal(JSON.stringify(w), before);
  w.day.minute += 180;
  updateEnvironment(w);
  assert.equal(f.height, w.environment.seaLevel);
  assert.deepEqual(f.vector, currentAt(w, f.station.x, f.station.y));
  assert(f.extrema.some((t) => t.kind === 'High') && f.extrema.some((t) => t.kind === 'Low'));
});
test('height and current planning curves remain independent and span a useful working window', () => {
  const w = createWorld();
  chooseGround(w, 'near');
  const s = forecastSeries(w, 'near');
  assert.equal(s.end - s.start, 720);
  assert(s.samples.length > 60);
  const high = s.samples.reduce((a, b) => (a.height > b.height ? a : b)),
    flow = s.samples.reduce((a, b) => (a.flow > b.flow ? a : b));
  assert(Math.abs(high.minute - flow.minute) > 40);
});
test('planning arrows show local directional variation and changing flow without exposing exact velocities', () => {
  const w = createWorld();
  chooseGround(w, 'middle');
  const before = JSON.stringify(w),
    now = estimatedCurrents(forecast(w, 'middle')),
    later = estimatedCurrents(forecast(w, 'middle', 360));
  assert(now.length > 8 && now.length <= 36);
  assert(new Set(now.map((a) => a.angle)).size > 2);
  assert.notDeepEqual(now, later);
  assert.equal(JSON.stringify(w), before);
  for (const a of now) {
    assert([1, 2, 3].includes(a.strength));
    assert(!('speed' in a));
    assert(Math.abs(a.angle / (Math.PI / 8) - Math.round(a.angle / (Math.PI / 8))) < 0.001);
  }
});
test('all working sectors have a nearby drying apron with materially different high/low exposure', () => {
  for (const id of ['near', 'middle', 'far']) {
    const w = createWorld();
    chooseGround(w, id);
    const site = w.terrain.tidalSites[0],
      p = w.patches.find((p) => p.id === 'good');
    assert(Math.hypot(site.x - p.drop.x, site.y - p.drop.y) < 60);
    const high = sampleCurve(w.environment.tideCurve, 660),
      low = sampleCurve(w.environment.tideCurve, 1050);
    let changed = 0;
    for (let y = site.y - 12; y < site.y + 12; y++)
      for (let x = site.x - 18; x < site.x + 18; x++) {
        const bed = bedDepthAt(w.terrain, x, y);
        if (bed + high > 0 && bed + low <= 0) changed++;
      }
    assert(changed > 60, id + ' exposes a visible intertidal surface');
  }
});
