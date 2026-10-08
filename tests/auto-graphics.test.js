import test from 'node:test';
import assert from 'node:assert/strict';

test('Auto graphics steps down one level on sustained slow working frames, never on fast ones', async () => {
  globalThis.document ??= { visibilityState: 'visible' };
  const { MarineRenderer, AUTO_QUALITY } = await import('../src/three/renderer.js');
  const view = {
    qualityChoice: 'Auto',
    quality: 'High',
    applied: 0,
    applyQuality() {
      this.applied++;
    },
  };
  const observe = (ms, active = true) =>
    MarineRenderer.prototype.observeFrame.call(view, ms, active);
  for (let i = 0; i < AUTO_QUALITY.frames * 3; i++) assert.equal(observe(16.7), null);
  assert.equal(view.quality, 'High');
  for (let i = 0; i < AUTO_QUALITY.frames * 3; i++) observe(45, false);
  assert.equal(view.quality, 'High', 'menus and harbour time never count');
  let changed = null;
  for (let i = 0; i < AUTO_QUALITY.frames; i++) changed = observe(45) || changed;
  assert.equal(changed, 'Balanced');
  for (let i = 0; i < AUTO_QUALITY.frames; i++) observe(45);
  assert.equal(view.quality, 'Battery');
  view.qualityChoice = 'High';
  view.quality = 'High';
  for (let i = 0; i < AUTO_QUALITY.frames * 2; i++) observe(80);
  assert.equal(view.quality, 'High', 'an explicit choice is never changed');
});
