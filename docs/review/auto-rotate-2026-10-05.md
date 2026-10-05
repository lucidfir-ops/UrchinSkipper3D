# Phone auto-rotate — October 5, 2026

Source: designer question, October 5 ("are you able to make it auto rotate on phone? astra couldn't, that's why we have the full screen and rotate button"), and their answer that on the S22 Firefox does not rotate the page at all outside fullscreen, even with Android auto-rotate on. Bible §19 (fullscreen and rotation) updated in place.

## Findings

- An ordinary web page cannot rotate itself. Outside fullscreen, Firefox for Android follows the system's rotation, and no web API overrides it. `screen.orientation.lock()` works only in fullscreen.
- Inside fullscreen the game already requests every orientation (`rotation-policy.js`, `lock('any')`), which is why the Fullscreen & Rotate screen button works.
- When the game is embedded on itch.io, fullscreen also needs itch's iframe permission. The existing button already works there, so that permission is present.

## Change

- On touch screens, Continue, Load Game, New career and Training Mode enter fullscreen from the same tap. Rotation then follows the device with no extra step. This is `autoFullscreen` in `src/fullscreen.js`, called from `PlaytestUI.titleAction`.
- A player who leaves fullscreen (Back, swipe or the button) is not pushed back in during that visit. Leaving because the tab was hidden does not count as a deliberate exit.
- Settings → Controls → **Auto fullscreen & rotate on touch** (default ON, saved per device) turns it off. Keyboard, mouse and controller play are unaffected.
- Under browser automation (`navigator.webdriver`) the unset default is OFF, because twenty existing fixtures resize windows, which a fullscreen window refuses. An explicit setting always wins, and the dedicated fixture sets it.

## Evidence

`scripts/auto-fullscreen-review.js` (suite `auto-fullscreen`, Chromium on the Deck GPU, touch at 390×844) passes:
- touch New career enters fullscreen and requests every orientation;
- after a deliberate exit, Continue does not re-enter;
- with the setting off, nothing happens;
- keyboard/mouse never enters fullscreen.

The `input` and `firefox` input suites pass. Unit tests pass.

## Limits

Real rotation was not observed. Headless Chromium cannot rotate a physical device, and nothing here ran on the S22, the Doogee tablet or itch.io. If Android auto-rotate is switched off, behaviour inside fullscreen depends on how Firefox maps the "any" lock on that device; the designer's experience with the existing button is the best guide.
