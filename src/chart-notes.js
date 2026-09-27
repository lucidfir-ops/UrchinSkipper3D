import { assist } from './assists.js';

export function paintChartNotes(canvas, terrain, w, id, ui, compact = false) {
  const ctx = canvas.getContext('2d'),
    scale = canvas.width / terrain.size,
    k = w.career?.knowledge[id];
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cce1cb';
  ctx.strokeStyle = '#ef6a5c';
  ctx.lineWidth = 1.25;
  for (const track of k?.tracks || []) {
    ctx.beginPath();
    track.points.forEach((point, index) =>
      index
        ? ctx.lineTo(point.x * scale, point.y * scale)
        : ctx.moveTo(point.x * scale, point.y * scale),
    );
    ctx.stroke();
  }
  for (const p of assist(w, 'chartGrounds', ui.realistic, ui.debug)
    ? Object.values(k?.grounds || {}).filter(
        (p) =>
          ui.revealUrchins ||
          ui.debug ||
          terrain.patches.find((q) => q.id === p.id)?.charted !== false,
      )
    : []) {
    ctx.strokeStyle = '#f3d18c';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    if (p.outline?.length) {
      p.outline.forEach((q, i) =>
        i ? ctx.lineTo(q.x * scale, q.y * scale) : ctx.moveTo(q.x * scale, q.y * scale),
      );
      ctx.closePath();
    } else ctx.arc(p.x * scale, p.y * scale, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const mark of (w.career?.marks || []).filter((m) => m.sector === id)) {
    const x = mark.x * scale,
      y = mark.y * scale;
    ctx.strokeStyle = '#edbe88';
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
    ctx.fillStyle = '#ffe5ab';
    if (!compact) ctx.fillText(mark.label, x, y - 7);
  }
}
