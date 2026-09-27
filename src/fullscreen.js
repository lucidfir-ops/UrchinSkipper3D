import { applyScreenFit } from './screen-fit.js';
import { logEvent } from './troubleshooting-log.js';
import { rotationPolicy } from './rotation-policy.js';

const activeFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement;

export const fullscreenLabel = () =>
  globalThis.document?.fullscreenElement || globalThis.document?.webkitFullscreenElement
    ? 'Exit fullscreen'
    : 'Fullscreen & Rotate screen';
export function toggleFullscreen() {
  document.querySelector('#touchFullscreen')?.click();
}
async function enterFullscreen() {
  const root = document.documentElement,
    request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) throw new Error('unsupported');
  try {
    await request.call(root, { keyboardLock: 'browser' });
  } catch (error) {
    if (error.name !== 'NotSupportedError') throw error;
    await request.call(root);
  }
}
export function installRotationRecovery(input) {
  const policy = rotationPolicy(screen.orientation, (detail) => logEvent('orientation', detail)),
    display = matchMedia('(display-mode: fullscreen)');
  let settle,
    adopting = false,
    attempted = false,
    owned = !!activeFullscreen();
  const refresh = (event) => {
    if (document.hidden) return;
    void policy.apply();
    applyScreenFit();
    clearTimeout(settle);
    settle = setTimeout(() => {
      void policy.apply();
      applyScreenFit();
      logEvent('viewport', {
        event: event?.type || 'install',
        width: innerWidth,
        height: innerHeight,
        screen: screen.orientation?.type,
        fullscreen: !!activeFullscreen(),
        displayFullscreen: display.matches,
        embedded: window !== window.top,
      });
    }, 250);
  };
  const contextChanged = (event) => {
    const nowOwned = !!activeFullscreen();
    // Do not re-enter after the player deliberately leaves fullscreen.
    if (owned && !nowOwned) attempted = true;
    if (!display.matches && !nowOwned) attempted = false;
    owned = nowOwned;
    policy.invalidate();
    refresh(event);
  };
  for (const name of ['resize', 'orientationchange']) window.addEventListener(name, refresh);
  for (const name of ['pageshow', 'focus']) window.addEventListener(name, contextChanged);
  for (const name of ['visibilitychange', 'fullscreenchange', 'webkitfullscreenchange'])
    document.addEventListener(name, contextChanged);
  display.addEventListener('change', contextChanged);
  screen.orientation?.addEventListener?.('change', refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  // An itch/other host can own fullscreen and its orientation lock. On the
  // first real touch, make the already-fullscreen game the fullscreen owner,
  // exactly as the manual workaround does. Inline and desktop views stay put.
  window.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerType !== 'touch' || !event.isTrusted) return;
      const button = event.target.closest?.('button');
      if (button && /fullscreen/i.test(button.textContent)) return;
      if (
        window === window.top ||
        !display.matches ||
        activeFullscreen() ||
        adopting ||
        attempted ||
        navigator.userActivation?.isActive === false
      ) {
        void policy.apply();
        return;
      }
      adopting = attempted = true;
      input.suppress();
      void enterFullscreen()
        .then(() => {
          policy.invalidate();
          return policy.apply();
        })
        .catch((error) =>
          logEvent('orientation', { operation: 'host-fullscreen', result: error.name }),
        )
        .finally(() => {
          adopting = false;
          refresh();
        });
    },
    { capture: true, passive: true },
  );
  refresh();
  return { refresh: contextChanged };
}
export function installFullscreen(input) {
  const rotation = installRotationRecovery(input);
  const button = document.createElement('button'),
    notice = document.createElement('div');
  button.id = 'touchFullscreen';
  button.hidden = true;
  button.textContent = fullscreenLabel();
  notice.id = 'fullscreenNotice';
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  document.body.append(button, notice);
  const active = activeFullscreen;
  const label = () => {
    button.textContent = fullscreenLabel();
    document.querySelectorAll('[data-fullscreen]').forEach((el) => {
      el.textContent = `⛶ ${fullscreenLabel()}`;
    });
  };
  document.addEventListener('fullscreenchange', label);
  document.addEventListener('webkitfullscreenchange', label);
  button.onclick = async () => {
    input.suppress();
    try {
      if (active()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit.call(document);
      } else {
        await enterFullscreen();
        // Chromium's separate API accepts only Escape here. Modified browser
        // and desktop shortcuts continue through the ordinary event handler.
        try {
          await navigator.keyboard?.lock?.(['Escape']);
        } catch {
          /* Fullscreen still works if keyboard capture is unavailable. */
        }
      }
      notice.hidden = true;
    } catch {
      notice.textContent =
        'Fullscreen is unavailable in this browser view. On itch.io use Launch game / fullscreen; on iPhone or iPad use Share → Add to Home Screen.';
      notice.hidden = false;
      notice.onclick = () => {
        notice.hidden = true;
      };
    }
    rotation.refresh();
    label();
  };
}
