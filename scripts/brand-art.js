import { mkdirSync, writeFileSync } from 'node:fs';
// Original vector source. Rendered PNGs are reproducible exports, not unique art.
export const BRAND_SIZES = {
  capsule: [600, 900],
  header: [920, 430],
  hero: [3840, 1240],
  title: [1920, 1080],
  logo: [1280, 420],
};
export function brandSvg(kind) {
  const [width, height] = BRAND_SIZES[kind],
    portrait = kind === 'capsule',
    logo = kind === 'logo',
    hero = kind === 'hero',
    w = 1000,
    h = (height / width) * w;
  const boatX = portrait ? 510 : hero ? 500 : 650,
    boatY = portrait ? 990 : hero ? h * 0.525 : h * 0.63,
    scale = portrait ? 1.8 : hero ? 0.6 : 0.85;
  const scenery = logo
    ? ''
    : `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#0d2c3b"/><stop offset="1" stop-color="#b59969"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#36636a"/><stop offset="1" stop-color="#092937"/></linearGradient></defs><rect width="1000" height="${h}" fill="url(#sky)"/><circle cx="740" cy="${h * 0.36}" r="${portrait ? 95 : 42}" fill="#e7ce8e" opacity=".85"/><path d="M0 ${h * 0.48}L110 ${h * 0.29} 184 ${h * 0.38} 263 ${h * 0.27} 415 ${h * 0.46} 533 ${h * 0.32} 678 ${h * 0.44} 810 ${h * 0.25} 1000 ${h * 0.42}V${h}H0Z" fill="#24494b"/><path d="M0 ${h * 0.5}L80 ${h * 0.4} 180 ${h * 0.49} 255 ${h * 0.44} 366 ${h * 0.53} 455 ${h * 0.42} 620 ${h * 0.51} 830 ${h * 0.4} 1000 ${h * 0.5}V${h}H0Z" fill="#173d40"/><rect y="${h * 0.56}" width="1000" height="${h * 0.44}" fill="url(#sea)"/>${Array.from(
        { length: 45 },
        (_, i) => {
          const x = (i * 179) % 1020,
            y = h * 0.59 + ((i * 31) % (h * 0.4));
          return `<path d="M${x} ${y}h${15 + ((i * 23) % 67)}" stroke="#bad0b6" stroke-width="1.4" opacity="${0.09 + (i % 3) * 0.045}"/>`;
        },
      ).join(
        '',
      )}<g transform="translate(${boatX} ${boatY}) scale(${scale})"><path d="M-140 32H150L115 67H-100Z" fill="#dddac1" stroke="#0c2732" stroke-width="3"/><path d="M-139 34H145" stroke="#cd994d" stroke-width="5"/><path d="M25-26H90V31H8Z" fill="#c4d5c6"/><path d="M32-19H83V7H23Z" fill="#183f4b"/><path d="M58-27V-91M58-83L84-76 58-64" fill="#d6dfc9" stroke="#d6dfc9" stroke-width="3"/><g fill="#d08b42" stroke="#edc985"><ellipse cx="-94" cy="24" rx="17" ry="11"/><ellipse cx="-55" cy="24" rx="17" ry="11"/><ellipse cx="-15" cy="24" rx="17" ry="11"/></g><path d="M-150 74q120 11 287 0" fill="none" stroke="#b9d6c8" stroke-width="2" opacity=".5"/></g>`;
  const title =
    hero || kind === 'title'
      ? ''
      : `<g font-family="Georgia,serif" font-weight="bold" text-anchor="middle" fill="#f3e2b7" stroke="#082430" stroke-width="${logo ? 0 : 1}" paint-order="stroke"><text x="${portrait ? 500 : logo ? 500 : 295}" y="${portrait ? 205 : logo ? 125 : h * 0.34}" font-size="${portrait ? 103 : logo ? 102 : 71}" letter-spacing="5">URCHIN</text><text x="${portrait ? 500 : logo ? 500 : 295}" y="${portrait ? 330 : logo ? 245 : h * 0.34 + 83}" font-size="${portrait ? 103 : logo ? 102 : 71}" letter-spacing="5">SKIPPER</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}">${scenery}${title}</svg>`;
}
export async function renderBrandArt(browser) {
  mkdirSync('public/assets/brand', { recursive: true });
  for (const [kind, [width, height]] of Object.entries(BRAND_SIZES)) {
    const svg = brandSvg(kind);
    writeFileSync(`public/assets/brand/${kind}.svg`, svg);
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
    );
    await page.screenshot({ path: `public/assets/brand/${kind}.png`, omitBackground: true });
    await page.close();
  }
  console.log('Rendered original title / library artwork.');
}
