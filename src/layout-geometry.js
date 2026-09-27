// Layout coordinates are screen pixels, shared by the preview and live windows.
export function fitWindow(rect, width, height) {
  const floor = Math.max(72, height - 4),
    w = Math.max(Math.min(64, width - 8), Math.min(width - 8, rect.width)),
    h = Math.max(Math.min(36, floor - 4), Math.min(floor - 4, rect.height));
  return {
    left: Math.max(4, Math.min(width - w - 4, rect.left)),
    top: Math.max(4, Math.min(floor - h, rect.top)),
    width: w,
    height: h,
  };
}
