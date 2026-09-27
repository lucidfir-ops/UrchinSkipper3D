// The water/detail commands already update at 15 Hz. Bake once per update so
// Canvas can submit one image during the intervening render frames. WebGL keeps
// native geometry: recurrent texture uploads were slower in the measured path.
export class SurfaceCache {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  }
  begin(left, top, width, height, zoom) {
    const density = Math.min(zoom, 2048 / Math.max(width, height)),
      pixelsX = Math.ceil(width * density),
      pixelsY = Math.ceil(height * density);
    if (!this.texture) {
      this.texture = this.scene.textures.createCanvas('water-detail-cache', pixelsX, pixelsY);
      this.image = this.scene.add.image(0, 0, 'water-detail-cache').setOrigin(0).setDepth(-1);
    } else if (this.texture.width !== pixelsX || this.texture.height !== pixelsY)
      this.texture.setSize(pixelsX, pixelsY);
    this.texture.context.clearRect(0, 0, pixelsX, pixelsY);
    this.image.setPosition(left, top).setDisplaySize(pixelsX / density, pixelsY / density);
    this.graphics.clear().save().scaleCanvas(density, density).translateCanvas(-left, -top);
    return this.graphics;
  }
  finish() {
    this.graphics.restore();
    this.graphics.generateTexture(this.texture.canvas, this.texture.width, this.texture.height);
    // Canvas draws this canvas directly. refresh() would unnecessarily read its
    // full pixel buffer back; there is no GPU upload to perform on this path.
    this.graphics.clear();
  }
}
