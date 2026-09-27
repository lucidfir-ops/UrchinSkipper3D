// Broad phase only; callers retain their original exact distance/depth tests.
export class SpatialBins {
  constructor(size) {
    this.size = size;
    this.bins = new Map();
  }
  add(point) {
    const key = `${Math.floor(point.x / this.size)},${Math.floor(point.y / this.size)}`;
    let bin = this.bins.get(key);
    if (!bin) this.bins.set(key, (bin = []));
    bin.push(point);
  }
  some(x, y, range, predicate) {
    for (
      let by = Math.floor((y - range) / this.size);
      by <= Math.floor((y + range) / this.size);
      by++
    )
      for (
        let bx = Math.floor((x - range) / this.size);
        bx <= Math.floor((x + range) / this.size);
        bx++
      )
        for (const point of this.bins.get(`${bx},${by}`) || []) if (predicate(point)) return true;
    return false;
  }
}
