import { snapshot, commitCareer } from './career-save.js';
import { encodeSnapshot } from './save-codec.js';
import { validateSnapshot } from './save-validation.js';

// Only serialization/checksum run off-thread. Storage commits remain ordered,
// and a manual save or session replacement always supersedes a pending job.
export class BackgroundSave {
  constructor() {
    this.serial = 0;
    try {
      this.worker = new Worker(new URL('./save.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => this.finish(data.id, data.encoded);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.worker.terminate();
        this.worker = null;
        if (this.pending) this.fallback(this.pending);
      };
    } catch {
      this.worker = null;
    }
  }
  cancel() {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.resolve({ ok: false, superseded: true });
      this.pending = null;
    }
  }
  save(w, storage) {
    if (this.pending || !w.career || w.career.sandbox)
      return Promise.resolve({ ok: true, skipped: true });
    return new Promise((resolve) => {
      try {
        const data = snapshot(w, false),
          id = ++this.serial;
        // Only validated data may become the next trusted backup. Validation
        // of the object avoids parsing a large previous envelope every interval.
        validateSnapshot(data);
        const job = {
          id,
          storage,
          resolve,
          metadata: {
            career: {
              sandbox: false,
              seed: w.career.seed,
              day: w.career.day,
              starterPending: w.career.starterPending,
            },
            day: { phase: w.day.phase },
          },
        };
        this.pending = job;
        // postMessage performs the only deep copy on the normal worker path.
        // The fallback takes its own private snapshot before yielding.
        if (this.worker) {
          this.worker.postMessage({ id, snapshot: data });
          job.timeout = setTimeout(() => {
            if (this.pending !== job) return;
            this.worker?.terminate();
            this.worker = null;
            this.cancel(); // Next interval/manual save can retry safely.
          }, 15000);
        } else {
          job.snapshot = structuredClone(data);
          this.fallback(job);
        }
      } catch (error) {
        this.pending = null;
        resolve({ ok: false, reason: 'Save unavailable: ' + error.message });
      }
    });
  }
  fallback(job) {
    // Worker startup failure: release this job and let the next interval retry
    // with a fresh, consistent snapshot. Never serialize changed live objects.
    if (!job.snapshot) {
      this.cancel();
      return;
    }
    const run = () => {
      if (this.pending !== job) return;
      try {
        this.finish(job.id, encodeSnapshot(job.snapshot));
      } catch (error) {
        this.pending = null;
        job.resolve({ ok: false, reason: 'Save unavailable: ' + error.message });
      }
    };
    if (globalThis.requestIdleCallback) requestIdleCallback(run, { timeout: 1000 });
    else setTimeout(run, 0);
  }
  finish(id, encoded) {
    const job = this.pending;
    if (job?.id !== id) return;
    clearTimeout(job.timeout);
    this.pending = null;
    job.resolve(commitCareer(job.metadata, job.storage, encoded));
  }
}
