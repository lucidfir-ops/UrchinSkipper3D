// Generated material only. Navigation geometry, depths and markings never read it.
export const CHART_ATLAS = './assets/charts/nautical-material-atlas.png';
let material = null;
export function installChartMaterial(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  material = {
    pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    size: Math.floor(canvas.width / 3),
    height: canvas.height,
  };
}
export function chartPixel(base, depth, x, y, useMaterial = true) {
  if (!material || !useMaterial) return base;
  const { pixels, width, size, height } = material,
    panel = depth <= -1 ? 2 : depth <= 0 ? 0 : 1,
    sx = (Math.floor(x * 1.3) % size) + panel * size,
    sy = Math.floor(y * 1.3) % height,
    offset = (sy * width + sx) * 4,
    strength = panel === 2 ? 0.68 : panel === 0 ? 0.38 : 0.25;
  return base.map((v, i) => Math.round(v * (1 - strength) + pixels[offset + i] * strength));
}
