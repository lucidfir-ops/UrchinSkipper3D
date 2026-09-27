// Native canvas compositing provides a reusable orthographic cutout. This mask
// belongs only to the artwork: the simulation hull never reads these points.
// The original generated source is kept unchanged, including its faulty backdrop.
const OUTLINE = [
  [510, 12],
  [528, 19],
  [554, 54],
  [585, 104],
  [620, 172],
  [654, 244],
  [685, 335],
  [709, 428],
  [732, 535],
  [742, 611],
  [762, 629],
  [765, 691],
  [743, 713],
  [742, 1018],
  [763, 1035],
  [765, 1113],
  [742, 1129],
  [736, 1395],
  [718, 1427],
  [687, 1449],
  [660, 1462],
  [363, 1462],
  [327, 1450],
  [297, 1423],
  [282, 1392],
  [280, 1128],
  [255, 1111],
  [256, 1035],
  [276, 1017],
  [278, 714],
  [256, 693],
  [256, 639],
  [271, 620],
  [282, 611],
  [291, 535],
  [310, 428],
  [338, 335],
  [370, 246],
  [403, 175],
  [445, 101],
  [477, 58],
  [499, 28],
];
export function prepareBoatArt(scene) {
  if (!scene.textures.exists('workboat-source')) return null;
  if (scene.textures.exists('workboat-cutout')) return scene.textures.get('workboat-cutout');
  const texture = scene.textures.createCanvas('workboat-cutout', 256, 640),
    ctx = texture.context;
  ctx.save();
  ctx.scale(256 / 526, 640 / 1470);
  ctx.translate(-249, -4);
  ctx.beginPath();
  OUTLINE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(scene.textures.get('workboat-source').getSourceImage(), 0, 0);
  ctx.restore();
  texture.refresh();
  return texture;
}
