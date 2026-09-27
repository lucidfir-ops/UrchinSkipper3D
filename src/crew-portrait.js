// Identity only: no condition, depth, air, catch or underwater state encoded.
// The generated paintings are deliberately optional: patrol/legacy people retain the
// compact vector fallback, while the named hireable divers get stable portraits.
export function portrait(p) {
  if (Number.isInteger(p.portraitTile)) {
    const col = p.portraitTile % 4,
      row = Math.floor(p.portraitTile / 4);
    // The generated atlas has unequal row heights; frame actual gutters instead
    // of assuming equal CSS tiles, which leaked the next person's face.
    const xs = [2, 233, 479, 726],
      widths = [221, 236, 237, 219],
      ys = [2, 220, 432, 644, 862, 1089, 1327],
      heights = [208, 201, 201, 210, 215, 226, 330];
    const height = Math.min(widths[col], heights[row]);
    return `<svg class="crew-portrait-image" viewBox="${xs[col]} ${ys[row]} ${widths[col]} ${height}" preserveAspectRatio="xMidYMin slice" role="img" aria-label="Portrait of ${p.name}"><image href="./assets/crew/remaining-atlas.png" width="947" height="1660"/></svg>`;
  }
  if (p.portraitSrc)
    return `<img class="crew-portrait-image" src="${p.portraitSrc}" alt="Portrait of ${p.name}"/>`;
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Portrait of ${p.name}"><rect width="100" height="100" rx="12" fill="#143943"/><path d="M12 100V80Q50 51 88 80V100" fill="${p.colour || '#648c9c'}"/><ellipse cx="50" cy="43" rx="22" ry="28" fill="#cda47d"/><path d="M27 36V24Q50 2 73 24V36Z" fill="${p.colour || '#648c9c'}"/>${p.officer ? '<path d="M25 34H75V40H25Z" fill="#162b38"/><path d="M46 24H54V31L50 34L46 31Z" fill="#efce81"/><text x="50" y="85" text-anchor="middle" font-size="10" fill="#efce81">DFO</text>' : ''}<path d="M40 45h3m14 0h3M44 60q6 4 12 0" stroke="#3c3431" stroke-width="3" fill="none"/></svg>`;
}
