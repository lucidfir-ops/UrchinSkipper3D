import { money } from './career-data.js';
import { GROUNDS } from './day.js';

const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );

// A vector image keeps the yellow carbon-copy form sharp and its actual entries
// legible at any size. This function is also its reproducible export recipe.
export function catchSheetSvg(c) {
  const history = c.history.slice(0, 12),
    rows = [];
  const text = (x, y, content, size = 15, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${xml(content)}</text>`;
  for (let i = 0; i < 12; i++) {
    const y = 205 + i * 34,
      r = history[i];
    rows.push(`<path d="M46 ${y + 10}H844" stroke="#817947" stroke-width=".7"/>`);
    if (!r) continue;
    const name = GROUNDS.find((g) => g.id === r.ground)?.name || r.ground || 'Harbour';
    rows.push(
      text(58, y, r.day),
      text(127, y, name),
      text(474, y, Math.round(r.gross).toLocaleString(), 15, 'text-anchor="end"'),
      text(641, y, money(r.net), 15, 'text-anchor="end"'),
      text(674, y, r.sunk ? 'Vessel lost' : r.onTime ? 'On time' : 'Late shipping'),
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 740" role="img" aria-label="Yellow catch log, latest twelve landings">
<rect x="20" y="20" width="870" height="710" rx="3" fill="#bdad69"/>
<rect x="13" y="13" width="870" height="710" rx="3" fill="#e1cf85"/>
<rect x="6" y="6" width="870" height="710" rx="3" fill="#f3e5a0"/>
<g fill="#343b32" font-family="monospace"><path d="M32 28V690" stroke="#b5a463" stroke-dasharray="3 7"/>
${text(48, 52, 'URCHIN SKIPPER / CATCH RECORD', 24)}${text(48, 78, 'SKIPPER COPY · YELLOW / CARBONLESS TRIPLICATE', 13)}
${text(48, 119, `Career day ${c.day}   •   ${c.records.days} landings recorded`, 16)}
${text(48, 143, 'Latest twelve entries · game record / fictional fishery', 13)}
<rect x="46" y="160" width="798" height="460" fill="none" stroke="#595e3e"/>
<path d="M46 184H844M114 160V620M371 160V620M492 160V620M658 160V620" fill="none" stroke="#817947"/>
${text(56, 177, 'DAY', 13)}${text(127, 177, 'WORKING AREA', 13)}${text(382, 177, 'GROSS / LB', 13)}${text(509, 177, 'NET RETURN / CAD', 13)}${text(674, 177, 'OFFLOAD', 13)}
${rows.join('')}
${text(48, 655, `TOTAL CATCH: ${Math.round(c.records.totalCatch).toLocaleString()} lb`, 17)}
${text(48, 681, 'Catch is recorded at harbour. Partial bags count toward the landing.', 13)}
</g></svg>`;
}
export function downloadCatchSheet(c) {
  const url = URL.createObjectURL(new Blob([catchSheetSvg(c)], { type: 'image/svg+xml' })),
    link = document.createElement('a');
  link.href = url;
  link.download = `urchin-yellow-catch-log-day-${c.day}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: true, reason: 'Yellow catch sheet exported as an SVG image.' };
}
