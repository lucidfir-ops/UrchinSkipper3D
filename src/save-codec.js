import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

const CHUNK = 0x8000;
function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += CHUNK)
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(text);
}
function fromBase64(text) {
  const raw = atob(text),
    bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Version 2 deflates the JSON payload (roughly 10x smaller), so a whole set of
// restore points fits comfortably inside the ~5 MB browser storage quota that
// itch.io games share. The checksum still covers the uncompressed payload.
export function encodeSnapshot(data) {
  const payload = JSON.stringify(data);
  return JSON.stringify({
    version: 2,
    checksum: checksum(payload),
    z: toBase64(deflateSync(strToU8(payload), { level: 6 })),
  });
}

// Returns the verified payload text and envelope metadata for v1 and v2 saves.
export function openEnvelope(text) {
  const envelope = JSON.parse(text);
  let payload;
  if (envelope.version === 1) payload = envelope.payload;
  else if (envelope.version === 2 && typeof envelope.z === 'string')
    payload = strFromU8(inflateSync(fromBase64(envelope.z)));
  if (typeof payload !== 'string' || checksum(payload) !== envelope.checksum)
    throw new Error('Save checksum mismatch');
  return {
    payload,
    version: envelope.version,
    checksum: envelope.checksum,
  };
}
