// Only the dedicated project Firefox profile is changed; preserve unrelated prefs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function prepareBrowser(profile) {
  mkdirSync(profile, { recursive: true });
  const path = join(profile, 'user.js');
  let previous = '';
  try {
    previous = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const marker = '// Urchin Skipper browser preferences';
  const kept = previous.replace(
    /\n?\/\/ Urchin Skipper browser preferences[\s\S]*?\/\/ End Urchin Skipper browser preferences\n?/g,
    '\n',
  );
  const prefs = `${marker}\nuser_pref("dom.gamepad.enabled", true);\nuser_pref("dom.gamepad.extensions.enabled", true);\nuser_pref("media.autoplay.default", 0);\n// End Urchin Skipper browser preferences\n`;
  const next = kept.trimEnd() + '\n' + prefs;
  if (next !== previous) writeFileSync(path, next, { mode: 0o600 });
}
if (process.argv[1]?.endsWith('/prepare-browser.js')) prepareBrowser(process.argv[2]);
