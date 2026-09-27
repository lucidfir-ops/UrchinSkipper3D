// CPU phases plus the actual inter-frame interval. postrender measures renderer
// submission, not completion on the GPU; frameMs includes scheduling/presentation.
export class FrameMetrics {
  constructor(clock = () => performance.now()) {
    this.clock = clock;
    this.samples = [];
  }
  begin(frameMs) {
    this.start = this.last = this.clock();
    this.current = { frameMs };
  }
  mark(name) {
    const now = this.clock();
    this.current[name] = now - this.last;
    this.last = now;
  }
  finish() {
    if (!this.current) return;
    this.mark('rendererMs');
    this.current.totalCpuMs = this.clock() - this.start;
    this.samples.push(this.current);
    if (this.samples.length > 600) this.samples.shift();
    this.current = null;
  }
  reset() {
    this.samples = [];
  }
}
export function summarizeFrames(samples) {
  const summary = { frames: samples.length };
  for (const key of [
    'frameMs',
    'inputMs',
    'simulationMs',
    'effectsMs',
    'saveMs',
    'drawMs',
    'hudMs',
    'rendererMs',
    'totalCpuMs',
  ]) {
    const values = samples.map((s) => s[key] || 0).sort((a, b) => a - b);
    summary[key] = {
      mean: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length),
      p95: values[Math.floor(values.length * 0.95)] || 0,
      max: values.at(-1) || 0,
    };
  }
  return summary;
}
