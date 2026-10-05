#!/usr/bin/env python3
"""Build an additive, profile-free portable ZIP from the verified local dist."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, tarfile, zipfile
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, help='New output folder; existing output is never replaced')
parser.add_argument('--label', default='September 26 Three.js edition', help='Human-readable build identity')
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=False)
package = out / 'Urchin Skipper 3D TEMP'
package.mkdir()
shutil.copytree(ROOT / 'dist', package / 'dist')
(package/'scripts').mkdir()
for name in ['serve-build.js', 'prepare-browser.js', 'session-server.js', 'check-server.js']:
    shutil.copy2(ROOT/'scripts'/name, package/'scripts'/name)
server=package/'scripts/serve-build.js'
s=server.read_text().replace('URCHIN_PORT || 5184', 'URCHIN_PORT || 5198')
s=s.replace("'X-Urchin-Build': 'production',", "'X-Urchin-Build': 'production',\n      'X-Urchin-Instance': process.env.URCHIN_INSTANCE || '',")
server.write_text(s)
check=package/'scripts/check-server.js'
s=check.read_text().replace('response.ok &&', "response.ok &&\n    (!process.env.URCHIN_INSTANCE || response.headers.get('x-urchin-instance') === process.env.URCHIN_INSTANCE) &&")
check.write_text(s)
launcher=(ROOT/'scripts/launch-deck.sh').read_text()
launcher=launcher.replace('.runtime/firefox-profile', '.player-data/firefox-profile').replace('See DEVELOPMENT_NOTES.md.', 'Install Node.js 22+; see README.txt.').replace('Run npm run build in the project folder first.', 'Extract the complete TEMP archive again.')
a=launcher.index('URL=http://127.0.0.1:5184/')
b=launcher.index('# A private companion',a)
launcher=launcher[:a]+'''export URCHIN_PORT="${URCHIN_PORT:-5198}"
export URCHIN_INSTANCE="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
URL="http://127.0.0.1:$URCHIN_PORT/"
node scripts/serve-build.js > .runtime/game-server.log 2>&1 &
SERVER_PID=$!
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  kill -0 "$SERVER_PID" 2>/dev/null || fail 'TEMP server could not start. Check that its port is free; see .runtime/game-server.log.'
  if node scripts/check-server.js "$URL" --production; then ready=true; break; fi
  sleep 0.25
done
[[ "$ready" == true ]] || fail 'TEMP server did not become ready.'
'''+launcher[b:]
(package/'scripts/launch-deck.sh').write_text(launcher)
(package/'scripts/launch-deck.sh').chmod(0o755)
(package/'Launch Game.sh').write_text('''#!/bin/bash
set -euo pipefail
GAME_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec /bin/bash "$GAME_DIR/scripts/launch-deck.sh"
''')
(package/'Launch Game.sh').chmod(0o755)
shutil.copy2(ROOT/'scripts/portable/start-portable.js',package/'scripts/start-portable.js')
shutil.copy2(ROOT/'scripts/portable/README.txt',package/'README.txt')
(package/'Play Windows.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nnode scripts/start-portable.js\r\npause\r\n')
(package/'Host for Phone or Tablet.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nnode scripts/start-portable.js --lan\r\npause\r\n')
(package/'Play Mac.command').write_text('''#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
node scripts/start-portable.js
''')
(package/'Play Mac.command').chmod(0o755)
(package/'package.json').write_text(json.dumps({'name':'urchin-skipper-3d-temp','private':True,'type':'module','scripts':{'start':'node scripts/start-portable.js'}},indent=2)+'\n')
(package/'licenses').mkdir()
for src,name in [('node_modules/three/LICENSE','Three.txt'),('node_modules/phaser/LICENSE.md','Phaser.txt'),('node_modules/eventemitter3/LICENSE','EventEmitter3.txt'),('node_modules/phaser/src/physics/matter-js/lib/license.js','Matter.txt'),('node_modules/fflate/LICENSE','fflate.txt'),('node_modules/@fontsource/barlow/LICENSE','Font-Barlow-OFL.txt'),('node_modules/@fontsource/barlow-condensed/LICENSE','Font-Barlow-Condensed-OFL.txt'),('node_modules/@fontsource/ibm-plex-mono/LICENSE','Font-IBM-Plex-Mono-OFL.txt')]:
    shutil.copy2(ROOT/src,package/'licenses'/name)
# Preserve all bundled component banners as well as the top-level MIT notices.
source=(ROOT/'node_modules/phaser/dist/phaser.js').read_text()
notices=re.findall(r'/\*[\s\S]*?\*/',source)
(package/'licenses/Phaser-component-notices.txt').write_text('\n\n'.join(dict.fromkeys(n for n in notices if re.search(r'copyright|permission is hereby|@license',n,re.I)))+'\n')
files=sorted(p for p in package.rglob('*') if p.is_file())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(package/'MANIFEST.sha256').write_text(''.join(f'{digest(p)}  {p.relative_to(package).as_posix()}\n' for p in files))
archive=out/'Urchin Skipper 3D TEMP.zip'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(package.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(out))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p in files:assert hashlib.sha256(z.read(str(p.relative_to(out)))).hexdigest()==digest(p)
(out/'Urchin Skipper 3D TEMP.zip.sha256').write_text(f'{digest(archive)}  {archive.name}\n')
print(json.dumps({'folder':str(package),'zip':str(archive),'bytes':archive.stat().st_size,'files':len(files)+1,'verified':True},indent=2))

# Recommended web upload: entry point and relative assets directly at ZIP root.
itch = out / 'UrchinSkipper3D-TEMP-ITCHIO.zip'
web_files = sorted(p for p in (package/'dist').rglob('*') if p.is_file())
license_files = sorted(p for p in (package/'licenses').rglob('*') if p.is_file())
assert (package/'dist/index.html').is_file()
assert len(web_files) + len(license_files) + 1 <= 1000
assert sum(p.stat().st_size for p in web_files + license_files) < 500 * 1024 * 1024
assert all(p.stat().st_size < 200 * 1024 * 1024 for p in web_files + license_files)
identity = 'Urchin Skipper 3D TEMP — ' + args.label + '\nindex.html SHA-256: ' + digest(package/'dist/index.html') + '\n'
with zipfile.ZipFile(itch, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in web_files:
        z.write(p, p.relative_to(package/'dist').as_posix())
    for p in license_files:
        z.write(p, p.relative_to(package).as_posix())
    z.writestr('BUILD.txt', identity)
with zipfile.ZipFile(itch) as z:
    assert z.testzip() is None
    assert 'index.html' in z.namelist()
    assert all(len(name) <= 240 for name in z.namelist())
    for p in web_files: assert hashlib.sha256(z.read(p.relative_to(package/'dist').as_posix())).hexdigest() == digest(p)
(out/'UrchinSkipper3D-TEMP-ITCHIO.zip.sha256').write_text(f'{digest(itch)}  {itch.name}\n')
upload_notes = f"""URCHIN SKIPPER 3D — LATEST TEMP — {args.label.upper()}

RECOMMENDED FILE TO UPLOAD:
UrchinSkipper3D-TEMP-ITCHIO.zip

1. Create or select the separate Urchin Skipper 3D itch.io project (never the original 2D project) and select Kind of project: HTML.
2. Upload UrchinSkipper3D-TEMP-ITCHIO.zip and mark it as played in the browser.
3. Use Click to launch in fullscreen and enable Mobile friendly.
   Allow any orientation; do not lock the itch embed to landscape.
   For an inline embed use 1280 x 800 and enable itch.io's Fullscreen button.
4. Save and test the draft page, then publish the update as usual.
5. Check the title reads URCHIN SKIPPER 3D.

The game's Fullscreen & Rotate screen option is on Title, Settings and Pause
for every input mode. Browser restrictions can still require a tap/click or
itch.io's own fullscreen launch. Portrait and landscape are both supported.
Touchscreen Options is on the title, in Settings and in Pause. Set controls
scale (50–150%) and opacity (0–100%); Tiny Touch Controls selects 70%.
Adjust UI defaults OFF. UI Scale remains separate. The desktop layout remains.

The ZIP has root index.html, relative assets and licence notices, with no player
data. No Node.js installation or external assets are needed on players' devices.
Saves are per browser/origin. Export a career from the logbook before changing
browsers or clearing storage. New day-start saves cannot recover earlier days
from old releases retroactively. Exported careers include a bounded local
troubleshooting snapshot. Optional detailed input logging is in Settings.

OPTIONAL LOCAL / WI-FI COPY:
Urchin Skipper 3D TEMP.zip contains identical game bytes and desktop/LAN helpers.
Extract and read README.txt. The host computer needs Node.js 22+.

This is an additive dated version; all older exports are retained.
BUILD.txt and the SHA-256 files identify the build.
Actual itch.io publication and physical device/controller play remain human
follow-up checks; nested-host browser tests do not establish those results.

Official upload guidance: https://itch.io/docs/creators/html5
"""
(out/'START-HERE-ITCH-IO.txt').write_text(upload_notes)
print(json.dumps({'itch_zip':str(itch),'bytes':itch.stat().st_size,'verified':True},indent=2))
