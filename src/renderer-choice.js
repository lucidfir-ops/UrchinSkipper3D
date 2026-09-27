// Retain hardware WebGL; avoid emulating it in software for this 2D scene.
// The explicit query is diagnostic, not a persisted hardware preference.
export function chooseRenderer(requested, makeCanvas = () => document.createElement('canvas')) {
  if (requested === 'canvas' || requested === 'webgl') return requested;
  let gl;
  try {
    gl = makeCanvas().getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return 'canvas';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|softpipe|software/i.test(name) ? 'canvas' : 'webgl';
  } catch {
    return 'canvas';
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
