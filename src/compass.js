import { C, DIRECTIONS, QUALITIES, BAG_LIMITS } from './config.js';
import { bearing } from './math.js';

export function compassDirection(x, y, deadZone = C.input.deadZone) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) <= deadZone)
    return { direction: 0, angle: 0, magnitude: 0 };
  const angle = bearing(x, y);
  return {
    direction: (Math.round(angle / 45) % 8) + 1,
    angle,
    magnitude: Math.min(1, Math.hypot(x, y)),
  };
}

// A draft prevents cancellation or selection changes from issuing instructions.
export class CompassDraft {
  constructor(diver) {
    this.diverId = diver.id;
    this.direction = diver.direction;
    this.quality = diver.minQuality;
    this.searchLimit = diver.searchLimit ?? 70;
    this.maxBagSeconds = diver.maxBagSeconds ?? 0;
    this.angle = (diver.direction - 1) * 45;
    this.moved = false;
  }
  point(x, y) {
    const value = compassDirection(x, y);
    if (value.magnitude > 0) this.moved = true;
    if (this.moved) {
      this.direction = value.direction;
      this.angle = value.angle;
    }
  }
  clear() {
    this.moved = true;
    this.direction = 0;
    this.angle = 0;
  }
  changeSearchLimit() {
    const limits = [10, 15, 20, 30, 60, 70, 0];
    this.searchLimit = limits[(limits.indexOf(this.searchLimit) + 1) % limits.length];
  }
  changeQuality(delta) {
    this.quality =
      QUALITIES[(QUALITIES.indexOf(this.quality) + delta + QUALITIES.length) % QUALITIES.length];
  }
  changeBagLimit() {
    this.maxBagSeconds =
      BAG_LIMITS[(BAG_LIMITS.indexOf(this.maxBagSeconds) + 1) % BAG_LIMITS.length];
  }
}

export function compassMarkup(draft) {
  const labels = DIRECTIONS.slice(1)
    .map((name, index) => {
      const a = (index * Math.PI) / 4,
        x = 150 + 112 * Math.sin(a),
        y = 150 - 112 * Math.cos(a);
      return `<text x="${x}" y="${y}" class="${draft.direction === index + 1 ? 'chosen' : ''}" dominant-baseline="middle" text-anchor="middle">${name}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 300 300" role="img" aria-label="Search direction: ${DIRECTIONS[draft.direction]}">
    <circle cx="150" cy="150" r="92" class="compass-rim"/>
    <path d="M150 58V242M58 150H242M85 85L215 215M85 215L215 85" class="compass-grid"/>
    ${draft.direction ? `<g transform="rotate(${draft.angle} 150 150)"><path d="M150 63L174 141L150 132L126 141Z" class="compass-needle"/><path d="M150 132V220" class="compass-tail"/></g>` : ''}
    <circle cx="150" cy="150" r="13" class="${draft.direction ? 'compass-centre' : 'compass-neutral'}"/>${labels}
  </svg><strong class="compass-value">${DIRECTIONS[draft.direction]}</strong>`;
}
