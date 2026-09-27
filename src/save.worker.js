import { encodeSnapshot } from './save-codec.js';
self.onmessage = ({ data }) => {
  self.postMessage({ id: data.id, encoded: encodeSnapshot(data.snapshot) });
};
