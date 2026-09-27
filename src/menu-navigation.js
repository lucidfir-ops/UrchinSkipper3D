// Directional focus follows the rendered button geometry, including scrolled lists.
export function neighbour(items, current, direction) {
  const from = items.find((b) => b.id === current) || items[0];
  if (!from) return current;
  const horizontal = direction === 'left' || direction === 'right',
    sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const axis = horizontal ? 'x' : 'y',
    cross = horizontal ? 'y' : 'x',
    extent = horizontal ? 'height' : 'width';
  const candidates = items
    .filter((b) => b !== from && (b[axis] - from[axis]) * sign > 2)
    .map((b) => {
      const across = Math.abs(b[cross] - from[cross]),
        aligned = across < (b[extent] + from[extent]) / 2 - 2;
      return { b, score: (aligned ? 0 : 10000) + (b[axis] - from[axis]) * sign + across * 2 };
    });
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length) return candidates[0].b.id;
  if (!horizontal) {
    const opposite = items
      .filter((b) => b !== from)
      .sort((a, b) => (a.y - b.y) * sign || Math.abs(a.x - from.x) - Math.abs(b.x - from.x));
    return opposite[0]?.id ?? current;
  }
  return current;
}
export function menuGeometry(panel) {
  return [...panel.querySelectorAll('[data-choice-index]')]
    .filter((b) => !b.hidden && !b.disabled)
    .map((b) => {
      const r = b.getBoundingClientRect();
      // Use layout positions within scrolled content. Otherwise a list scrolled
      // below the fixed Back button changes its focus graph after every press.
      let scrollX = 0,
        scrollY = 0;
      for (
        let parent = b.parentElement;
        parent && parent !== panel;
        parent = parent.parentElement
      ) {
        scrollX += parent.scrollLeft || 0;
        scrollY += parent.scrollTop || 0;
      }
      return {
        id: Number(b.dataset.choiceIndex),
        x: r.x + r.width / 2 + scrollX,
        y: r.y + r.height / 2 + scrollY,
        width: r.width,
        height: r.height,
      };
    });
}

export const menuDirections = (screen, career) =>
  screen === 'bindings' || (screen === 'departure' && !career)
    ? ['down', 'up']
    : ['down', 'up', 'right', 'left'];
