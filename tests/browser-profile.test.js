import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBrowser } from '../scripts/prepare-browser.js';
test('dedicated Firefox preferences preserve existing settings and remain idempotent', () => {
  const profile = mkdtempSync(join(tmpdir(), 'urchin-profile-'));
  try {
    const file = join(profile, 'user.js');
    writeFileSync(file, 'user_pref("custom.setting", true);\n');
    prepareBrowser(profile);
    const first = readFileSync(file, 'utf8');
    prepareBrowser(profile);
    assert.equal(readFileSync(file, 'utf8'), first);
    assert(first.includes('user_pref("custom.setting", true)'));
    assert(first.includes('user_pref("dom.gamepad.enabled", true)'));
    assert(first.includes('user_pref("media.autoplay.default", 0)'));
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
});
