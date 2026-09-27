import { applyUiScale } from './ui-scale.js';
export function applyScreenFit() {
  // The retired Tiny UI preference is left in storage for older exports only.
  document.body.classList.remove('fit-screen', 'tiny-mode');
  document.body.classList.toggle('small-device', Math.min(innerWidth, innerHeight) < 500);
  applyUiScale();
}
