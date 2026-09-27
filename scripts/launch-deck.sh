#!/bin/bash
# Add this script to Steam; keep it alive until the dedicated Firefox exits.
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
mkdir -p .runtime
exec >> .runtime/launcher.log 2>&1
printf '\nUrchin Skipper 3D launch %s\n' "$(date)"
# Steam does not inherit the interactive terminal's fnm PATH.
if ! command -v node >/dev/null 2>&1; then
  for candidate in "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node; do
    if [[ -x "$candidate" ]]; then export PATH="$(dirname "$candidate"):$PATH"; fi
  done
fi
fail() {
  echo "$1"
  if command -v kdialog >/dev/null 2>&1; then kdialog --error "$1"; fi
  exit 1
}
command -v node >/dev/null 2>&1 || fail 'Node.js was not found. See DEVELOPMENT_NOTES.md.'
[[ -f dist/index.html ]] || fail 'Playable build missing. Run npm run build in the project folder first.'
# A separate project profile prevents an existing desktop Firefox taking the URL
# and ending Steam's tracked process immediately.
PROFILE="$PROJECT_DIR/.runtime/firefox-profile"
mkdir -p "$PROFILE"
node scripts/prepare-browser.js "$PROFILE"
if command -v firefox >/dev/null 2>&1; then
  BROWSER=(firefox --no-remote --profile "$PROFILE")
elif command -v flatpak >/dev/null 2>&1 && flatpak info org.mozilla.firefox >/dev/null 2>&1; then
  # Firefox's startup scan requires ID_INPUT_JOYSTICK from the udev database.
  # Hotplug carries that property in the event, explaining the reconnect fix.
  # Scope read-only metadata access to this launch; no persistent/global override.
  BROWSER=(flatpak run --filesystem="$PROJECT_DIR" --filesystem=/run/udev:ro org.mozilla.firefox --no-remote --profile "$PROFILE")
else
  fail 'Firefox was not found. Install Firefox using Discover in Desktop Mode, then launch again.'
fi
SERVER_PID=''
BROWSER_PID=''
SESSION_PID=''
SESSION_FILE="$PROJECT_DIR/.runtime/session-$$.url"
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$BROWSER_PID" ]]; then kill "$BROWSER_PID" 2>/dev/null || true; wait "$BROWSER_PID" 2>/dev/null || true; fi
  if [[ -n "$SESSION_PID" ]]; then kill "$SESSION_PID" 2>/dev/null || true; wait "$SESSION_PID" 2>/dev/null || true; fi
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
URL=http://127.0.0.1:5184/
# Reuse only a server identifying itself as this project; never kill a reused one.
if node scripts/check-server.js "$URL" --production; then
  echo 'Reusing existing Urchin Skipper 3D server.'
else
  node scripts/serve-build.js > .runtime/game-server.log 2>&1 &
  SERVER_PID=$!
  ready=false
  for ((attempt=0;attempt<60;attempt++)); do
    kill -0 "$SERVER_PID" 2>/dev/null || fail 'Game server could not start. Close any development server on port 5184, then relaunch. See .runtime/game-server.log.'
    if node scripts/check-server.js "$URL" --production; then ready=true; break; fi
    sleep 0.25
  done
  [[ "$ready" == true ]] || fail 'Local server did not become ready. See .runtime/game-server.log.'
fi
# A private companion lets Exit Game end this tracked launcher session even
# when browser security refuses window.close(). No desktop browser is targeted.
node scripts/session-server.js "$SESSION_FILE" "$URL" &
SESSION_PID=$!
for ((attempt=0;attempt<60;attempt++)); do
  kill -0 "$SESSION_PID" 2>/dev/null || fail 'Session exit service could not start.'
  [[ -s "$SESSION_FILE" ]] && break
  sleep 0.1
done
[[ -s "$SESSION_FILE" ]] || fail 'Session exit service did not become ready.'
read -r LAUNCH_URL < "$SESSION_FILE"
"${BROWSER[@]}" --kiosk "$LAUNCH_URL" &
BROWSER_PID=$!
# Either closing Firefox or the authenticated Exit Game request ends the session.
wait -n "$BROWSER_PID" "$SESSION_PID"
