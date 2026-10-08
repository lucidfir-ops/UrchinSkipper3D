URCHIN SKIPPER 3D — TEMP LOCAL / WI-FI EDITION

This is the separate Three.js edition. The original 2D game is unchanged.
For itch.io browser play upload UrchinSkipper3D-TEMP-ITCHIO.zip into a separate
Urchin Skipper 3D project. Players need a WebGL 2 browser with hardware acceleration.

LOCAL PLAY
Extract this entire folder. Install Node.js 22+ and a current browser.
Windows: double-click Play Windows.cmd.
Mac: run Play Mac.command, or use the manual command below.
Linux/Steam Deck: bash "Launch Game.sh" opens a dedicated Firefox session.
Manual alternative on any computer: node scripts/start-portable.js
Open the printed address. The default port is 5198; URCHIN_PORT can override it.
Do not open dist/index.html directly. No npm install/build or network assets are needed.
Close the tab and Ctrl+C in the terminal when finished. The Linux launcher also
handles Exit Game. It has its own .player-data/firefox-profile.

PHONE / TABLET ON THE SAME WI-FI
On the host computer: node scripts/start-portable.js --lan
Windows also has Host for Phone or Tablet.cmd.
Open the printed network address on the device and enable Touchscreen Options.
Keep the host running. Allow local network access if your firewall prompts.
Portrait and landscape are supported. No files or Node.js are needed on the phone.

FIRST VOYAGE
Continue and start with Frank's tutorial. W/S throttle, A/D rudder, Space neutral,
Enter centre rudder, 1 deploy/board, 2 bag exchange, 3 nearby recall, Tab diver,
O orders, M chart, +/- zoom, Escape menu. Throttle and rudder stay set when released.
USB Xbox mappings and touch controls are retained from the original game.
Recover both divers and cross the harbour boundary before the chart's Leave by time.
Settings -> 3D graphics cycles Auto, High, Balanced and Battery without changing gameplay. Auto starts at High and eases down on a slow device.

SAVES AND SHARING
No careers, recordings or profiles are shipped. Saves belong to the browser/origin.
The 3D career storage is separate from 2D. Use Skipper logbook export/import to move
careers deliberately. Back up your own saves before changing browser or address.
When sharing a played folder, exclude .player-data and .runtime (private saves/logs).
MANIFEST.sha256 identifies all shipped files. licenses/ retains component notices.

VERIFICATION LIMITS
Chromium hardware rendering, automated keyboard/touch/controller paths and a full
working voyage were checked. Synthetic input is not physical controller testing.
Physical USB Xbox/Deck, mobile performance, Safari and long careers need playtesting
in this edition. The measured 60 FPS result applies to one 1280x800 AMD GPU scene.
