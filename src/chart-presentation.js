export const CHART_MODES = ['raster', 'vector'];
export const CHART_ZOOMS = [1, 2, 4];

export function chartMode(ui) {
  return ui.chartMode === 'vector' ? 'vector' : 'raster';
}

export function chartModeMarkup(ui) {
  const active = chartMode(ui);
  return `<div class="chart-mode-toggle" role="group" aria-label="Chart rendition"><span>CHART RENDITION</span>${CHART_MODES.map(
    (mode) =>
      `<button type="button" data-chart-mode="${mode}" aria-pressed="${mode === active}">${mode.toUpperCase()}</button>`,
  ).join('')}</div>`;
}

export function bindChartModeToggle(root, ui) {
  root.querySelectorAll('[data-chart-mode]').forEach((button, index) => {
    button.dataset.choiceIndex = String(-3 - index);
    button.onclick = () => {
      ui.chartMode = button.dataset.chartMode;
      ui.signature = null;
    };
  });
}

export function stepChartZoom(zoom, direction) {
  const current = CHART_ZOOMS.includes(zoom) ? zoom : CHART_ZOOMS[0];
  const index = CHART_ZOOMS.indexOf(current);
  return CHART_ZOOMS[Math.max(0, Math.min(CHART_ZOOMS.length - 1, index + direction))];
}

export function minimapViewport(size, focusX, focusY, zoom) {
  const safeZoom = CHART_ZOOMS.includes(zoom) ? zoom : CHART_ZOOMS[0];
  const extent = size / safeZoom;
  return {
    x: Math.max(0, Math.min(size - extent, focusX - extent / 2)),
    y: Math.max(0, Math.min(size - extent, focusY - extent / 2)),
    size: extent,
    zoom: safeZoom,
  };
}
