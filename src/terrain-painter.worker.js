import { CoastalRaster } from './coastal-art.js';
let raster;
self.onmessage = ({ data }) => {
  if (data.terrain) raster = new CoastalRaster(data.terrain);
  const normal = new Uint8ClampedArray(data.normal),
    hidden = new Uint8ClampedArray(data.hidden);
  raster.paint({ data: normal }, { data: hidden }, data.tide);
  self.postMessage({ id: data.id, tide: data.tide, normal: normal.buffer, hidden: hidden.buffer }, [
    normal.buffer,
    hidden.buffer,
  ]);
};
