import { returnAvailable } from './departure-transition.js';
import { bindingName } from './input.js';
import { WINDOWS } from './hud-windows.js';

// October 5: beyond the harbour line with both divers aboard, a compact action
// sits beside the boat. It never pauses play and never covers the working
// water or controls; steering back inside withdraws it.
const OUTWARD = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OFFSET = 64;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let chip;
function element(input) {
  if (chip) return chip;
  chip = document.createElement('button');
  chip.id = 'returnHarbourChip';
  chip.type = 'button';
  chip.hidden = true;
  chip.innerHTML =
    '<span class="return-chip-arrow">⚓</span><b>Return to harbour</b><small></small>';
  chip.addEventListener('click', (event) => {
    event.preventDefault();
    input.queued.add('returnHarbour');
  });
  // Pointer presses on the chip must not also steer from the touch boat/sticks.
  chip.addEventListener('pointerdown', (event) => event.stopPropagation());
  document.body.append(chip);
  return chip;
}

function hint(input) {
  if (input.touchEnabled && input.lastDevice !== 'keyboard' && input.lastDevice !== 'gamepad')
    return '';
  if (input.lastDevice === 'gamepad') return 'Menu → Return to harbour';
  const key = input.map?.returnHarbour?.find((code) => !/^(b|a)\d/.test(code));
  return key ? `Press ${bindingName(key)}` : '';
}

export function renderReturnChip(scene, world, input) {
  const el = element(input),
    ui = scene.playtest,
    show = !!ui?.started && !ui.screen && !ui.ended && returnAvailable(world);
  el.hidden = !show;
  if (!show) return;
  const small = el.querySelector('small'),
    text = hint(input);
  if (small.textContent !== text) small.textContent = text;
  small.hidden = !text;
  const [dx, dy] = OUTWARD[world.day.returnExit?.edge] || [0, 1],
    centre = scene.view?.project?.(world.boat.x, world.boat.y, 0) || {
      x: innerWidth / 2,
      y: innerHeight / 2,
    },
    halfW = el.offsetWidth / 2 || 90,
    halfH = el.offsetHeight / 2 || 24;
  // Prefer beside the boat (clear of the bow and the working water), then the
  // off-sector side, then inward; the first spot covering no control wins.
  const blockers = obstacles(),
    candidates = [
      [-dy, dx],
      [dy, -dx],
      [dx, dy],
      [-dx, -dy],
    ].map(([cx, cy]) => ({
      x: clamp(centre.x + cx * (OFFSET + halfW * Math.abs(cx)), halfW + 8, innerWidth - halfW - 8),
      y: clamp(centre.y + cy * (OFFSET + halfH), halfH + 8, innerHeight - halfH - 8),
    })),
    clear = (p) =>
      !blockers.some(
        (r) =>
          r.left < p.x + halfW + 4 &&
          r.right > p.x - halfW - 4 &&
          r.top < p.y + halfH + 4 &&
          r.bottom > p.y - halfH - 4,
      ),
    spot = candidates.find(clear) || candidates[0];
  el.style.left = spot.x + 'px';
  el.style.top = spot.y + 'px';
}

function obstacles() {
  const selectors = [
    '#touchControls button:not(#touchBoat)',
    '#touchControls .touch-stick',
    '#touchHudToggle',
    '#keyboardHelm',
    ...Object.keys(WINDOWS).map((id) => '#' + id),
  ];
  return [...document.querySelectorAll(selectors.join(','))]
    .filter((node) => node.offsetParent && !node.hidden)
    .map((node) => node.getBoundingClientRect())
    .filter((r) => r.width && r.height);
}
