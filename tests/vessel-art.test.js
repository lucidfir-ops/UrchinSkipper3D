import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  VESSEL_ART,
  VESSEL_VECTOR_ART,
  VESSEL_FAMILIES,
  boatFamily,
} from '../src/vessel-catalog.js';
import { vesselArtSource, vesselFrame } from '../src/vessel-art.js';
import { FLEET } from '../src/career-data.js';
import { boatDefinition, boatSpec } from '../src/boats.js';
import { careerWorld, encode, decode } from '../src/career-save.js';
import { buyVessel, buyEquipment } from '../src/career-state.js';
import { frankAdvice } from '../src/frank-advice.js';

const artwork = JSON.parse(readFileSync('assets/asset-integrity.json', 'utf8')).assets;
const artworkByPath = new Map(artwork.map((entry) => [entry.path, entry]));

test('canonical artwork retains the verified original bytes after duplicate cleanup', () => {
  assert.equal(artworkByPath.size, artwork.length);
  for (const entry of artwork) {
    const bytes = readFileSync(entry.path);
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
  }
});

test('all designer-selected boat originals are shipped unchanged under their stable catalogue IDs', () => {
  assert.equal(Object.keys(VESSEL_ART).length, 37);
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  for (const path of Object.values(VESSEL_ART)) {
    const canonical = 'public/' + decodeURIComponent(path).replace(/^\.\//, '');
    const original = artworkByPath.get(canonical);
    assert.ok(original, `Missing original artwork fingerprint: ${canonical}`);
    assert.equal(hash(readFileSync(canonical)), original.sha256, canonical);
  }
});
test('the boat-art preference uses repaired SVGs where available and preserves raster originals', () => {
  for (const [id, vector] of Object.entries(VESSEL_VECTOR_ART)) {
    assert(vector.endsWith('-top.svg'));
    assert(readFileSync('public/' + decodeURIComponent(vector)).length > 100, id);
    assert.equal(vesselArtSource(id, 'vector'), vector);
    assert.equal(vesselArtSource(id, 'raster'), VESSEL_ART[id]);
  }
  assert.equal(vesselArtSource('nine-07-r3-c1', 'vector'), VESSEL_ART['nine-07-r3-c1']);
});
test('six sister vessels have independent saveable hulls with matching drives and distinct balanced specifications', () => {
  assert.equal(Object.keys(FLEET).length, 12);
  for (const [base] of VESSEL_FAMILIES) {
    const id = base + '-sister',
      w = careerWorld();
    w.career.cash = 1e6;
    w.career.xp = 10000;
    assert(buyVessel(w, id).ok);
    assert.equal(w.boat.configuration, id);
    assert.equal(boatFamily(id), base);
    const advice = frankAdvice(w, (action) => `<${action}>`);
    assert(!advice.includes('undefined'));
    assert(advice.includes('<recoverDiver> deploys'));
    assert(advice.includes('<assists> opens'));
    assert(advice.includes('All Off'));
    assert.equal(boatDefinition(id).drive, boatDefinition(base).drive);
    assert.notEqual(FLEET[id].maxSpeed, FLEET[base].maxSpeed);
    assert(FLEET[id].capacity !== FLEET[base].capacity);
    const copy = decode(encode(w));
    assert.equal(copy.boat.configuration, id);
    assert.equal(boatSpec(copy).capacity, FLEET[id].capacity);
    if (base === 'basic') {
      assert(buyEquipment(copy, 'bowthruster').ok);
      assert(boatSpec(copy).bowThrusterStrength > 0);
    }
  }
});
test('render framing excludes a separate sheet fragment without touching pixels or physics', () => {
  const width = 40,
    height = 100,
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 30; x++) data[(y * width + x) * 4 + 3] = 255;
  for (let y = 20; y < 95; y++) for (let x = 10; x < 30; x++) data[(y * width + x) * 4 + 3] = 255;
  const before = data.slice();
  assert.deepEqual(vesselFrame(data, width, height), { x: 10, y: 20, width: 20, height: 75 });
  assert.deepEqual(data, before);
});
