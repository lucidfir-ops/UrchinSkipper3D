// Own vessel is a navigation symbol, not a scale drawing of the hull. Keep a
// readable screen-space footprint on every coast and at every chart zoom.
export const chartHeading = (heading) =>
  String(Math.round(((((heading * 180) / Math.PI) % 360) + 360) % 360) % 360).padStart(3, '0');

export function paintOwnship(
  ctx,
  x,
  y,
  heading,
  { compact = false, width = 520, height = width } = {},
) {
  const radius = compact ? 10 : 15;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#102d36d9';
  ctx.fill();
  ctx.strokeStyle = '#fff7dd';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -radius - 5);
  ctx.lineTo(0, -radius - (compact ? 15 : 26));
  ctx.strokeStyle = '#102d36';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#ffe2a2';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.67, radius * 0.68);
  ctx.lineTo(0, radius * 0.3);
  ctx.lineTo(-radius * 0.67, radius * 0.68);
  ctx.closePath();
  ctx.fillStyle = '#ffe2a2';
  ctx.fill();
  ctx.restore();
  if (!compact) {
    const labelWidth = 91,
      labelHeight = 24,
      lx = Math.max(4, Math.min(width - labelWidth - 4, x + radius + 9)),
      ly = Math.max(4, Math.min(height - labelHeight - 4, y + radius + 6));
    ctx.save();
    ctx.fillStyle = '#102d36';
    ctx.beginPath();
    ctx.roundRect(lx, ly, labelWidth, labelHeight, 5);
    ctx.fill();
    ctx.strokeStyle = '#f2dbaa';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff3d4';
    ctx.fillText(`YOU · ${chartHeading(heading)}°`, lx + labelWidth / 2, ly + labelHeight / 2);
    ctx.restore();
  }
}

export function ownshipSvg(boat, size, compact = false) {
  const scale = size / (compact ? 240 : 520),
    radius = compact ? 10 : 15,
    heading = (boat.heading * 180) / Math.PI,
    lx = Math.max(4, Math.min(520 - 95, boat.x / scale + 24)) - boat.x / scale,
    ly = Math.max(4, Math.min(520 - 28, boat.y / scale + 21)) - boat.y / scale;
  return `<g data-chart-boat="" transform="translate(${boat.x} ${boat.y}) rotate(${heading})"><g data-ownship-symbol="" transform="scale(${scale})"><circle r="${radius + 3}" fill="#102d36" fill-opacity=".86" stroke="#fff7dd" stroke-width="1.5"/><path d="M0 -${radius + 5}V-${radius + (compact ? 15 : 26)}" stroke="#102d36" stroke-width="4"/><path d="M0 -${radius + 5}V-${radius + (compact ? 15 : 26)}" stroke="#ffe2a2" stroke-width="2"/><path d="M0 -${radius}L${radius * 0.67} ${radius * 0.68}L0 ${radius * 0.3}L-${radius * 0.67} ${radius * 0.68}Z" fill="#ffe2a2"/>${compact ? '' : `<g transform="rotate(${-heading})"><rect x="${lx}" y="${ly}" width="91" height="24" rx="5" fill="#102d36" stroke="#f2dbaa"/><text x="${lx + 45.5}" y="${ly + 16}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff3d4">YOU · ${chartHeading(boat.heading)}°</text></g>`}</g></g>`;
}
