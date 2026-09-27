export function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function encodeSnapshot(data) {
  const payload = JSON.stringify(data);
  return JSON.stringify({ version: 1, checksum: checksum(payload), payload });
}
