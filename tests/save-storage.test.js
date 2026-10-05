import './matter-helper.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  careerWorld,
  snapshot,
  readSnapshot,
  saveCareer,
  archiveCareer,
  careerArchives,
  compactSaves,
  deleteRestorePoint,
  loadCareer,
  SAVE_KEY,
} from '../src/career-save.js';
import { checksum, encodeSnapshot, openEnvelope } from '../src/save-codec.js';
import { createCareer } from '../src/career-state.js';
import { enterSector } from '../src/sectors.js';
import { PHYSICAL_AREAS } from '../src/coasts.js';

// localStorage stand-in with a browser-like quota counted in UTF-16 code units.
class QuotaStorage {
  constructor(limitChars = 5 * 1024 * 1024) {
    this.map = new Map();
    this.limit = limitChars;
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  used(except) {
    let n = 0;
    for (const [k, v] of this.map) if (k !== except) n += k.length + v.length;
    return n;
  }
  setItem(key, value) {
    value = String(value);
    if (this.used(key) + key.length + value.length > this.limit) {
      const error = new Error('The quota has been exceeded.');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map.set(key, value);
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

// A career that has visited every coast carries a large stock ledger.
function travelledCareer(seed = 4242) {
  const w = careerWorld(createCareer(seed));
  for (const area of PHYSICAL_AREAS) enterSector(w, area.id);
  return w;
}
const legacyEncode = (data) => {
  const payload = JSON.stringify(data);
  return JSON.stringify({ version: 1, checksum: checksum(payload), payload });
};

test('compressed saves round-trip exactly and are far smaller than legacy saves', () => {
  const w = travelledCareer(),
    data = snapshot(w),
    compact = encodeSnapshot(data),
    legacy = legacyEncode(data);
  assert.deepEqual(readSnapshot(compact), readSnapshot(legacy));
  assert(compact.length * 5 < legacy.length, `${compact.length} vs ${legacy.length}`);
  assert.equal(openEnvelope(compact).version, 2);
  assert.throws(() => readSnapshot(compact.replace(/"z":"(.)/, '"z":"A')));
});

test('legacy saves near the quota are compacted losslessly at startup', () => {
  const storage = new QuotaStorage(),
    w = travelledCareer(),
    legacy = legacyEncode(snapshot(w));
  storage.setItem(SAVE_KEY, legacy);
  for (let day = 1; storage.used() + legacy.length < storage.limit; day++)
    storage.setItem(`${SAVE_KEY}-day-${w.career.seed}-${day}`, legacy);
  const keys = [...storage.map.keys()];
  // Reproduces the October 4 report's storage: legacy restore points fill the
  // quota. The live save must still succeed by replacing only its own copy.
  w.career.cash += 1;
  const before = saveCareer(w, storage);
  assert(before.ok, before.reason);
  assert.equal(readSnapshot(storage.getItem(SAVE_KEY)).career.cash, w.career.cash);
  const freed = compactSaves(storage);
  assert(freed > 0);
  assert.deepEqual([...storage.map.keys()], keys, 'every restore point is kept');
  for (const key of keys) assert.equal(JSON.parse(storage.getItem(key)).version, 2);
  assert.deepEqual(readSnapshot(storage.getItem(keys[1])), readSnapshot(legacy));
  assert(storage.used() < storage.limit / 4);
  assert(saveCareer(w, storage).ok);
  assert.equal(loadCareer(storage).world.career.cash, w.career.cash);
});

test('the live save drops only its rolling backup when the quota is tight', () => {
  const w = careerWorld(createCareer(77)),
    first = encodeSnapshot(snapshot(w)),
    storage = new QuotaStorage(first.length * 2 + 400);
  assert(saveCareer(w, storage).ok);
  w.career.cash += 500;
  assert(saveCareer(w, storage).ok);
  w.career.cash += 500;
  const result = saveCareer(w, storage);
  assert(result.ok, result.reason);
  assert.equal(readSnapshot(storage.getItem(SAVE_KEY)).career.cash, w.career.cash);
});

test('loading a career does not store duplicate archive copies', () => {
  const storage = new QuotaStorage(),
    w = careerWorld(createCareer(9));
  assert(saveCareer(w, storage).ok);
  const first = archiveCareer(storage),
    again = archiveCareer(storage);
  assert.equal(first, again);
  // An identical start-of-day restore point already covers this state.
  assert.equal(careerArchives(storage, true).length, 1);
  w.career.cash += 1;
  assert(saveCareer(w, storage).ok);
  assert.notEqual(archiveCareer(storage), first);
  assert.equal(careerArchives(storage, true).length, 2);
});

test('players can delete restore points but never the live save through that path', () => {
  const storage = new QuotaStorage(),
    w = careerWorld(createCareer(12));
  assert(saveCareer(w, storage).ok);
  const key = archiveCareer(storage),
    [listed] = careerArchives(storage, true);
  assert.equal(listed.key, key);
  w.career.cash += 5;
  assert(saveCareer(w, storage).ok);
  const archived = careerArchives(storage).find((a) => a.cash === w.career.cash);
  assert(archived === undefined);
  const manual = archiveCareer(storage);
  assert(Number.isFinite(careerArchives(storage).find((a) => a.key === manual).savedAt));
  assert(deleteRestorePoint(storage, manual));
  assert.equal(deleteRestorePoint(storage, SAVE_KEY), false);
  assert.equal(deleteRestorePoint(storage, SAVE_KEY + '-backup'), false);
  assert(storage.getItem(SAVE_KEY));
  assert(deleteRestorePoint(storage, key));
  assert.equal(careerArchives(storage, true).length, 0);
});

test('a completely full browser store reports a clear storage-full failure', () => {
  const w = careerWorld(createCareer(31)),
    storage = new QuotaStorage(200000);
  storage.setItem('another-itch-game', 'x'.repeat(199000));
  const result = saveCareer(w, storage);
  assert.equal(result.ok, false);
  assert(result.storageFull);
  assert.match(result.reason, /Delete old saves in Load Game/);
});
