// "Unlock" restores the browser/host default, which can itself be landscape.
// Ask for all orientations explicitly, without fixing portrait or landscape.
// Cache success so an ordinary resize never replaces a working "any" policy.
export function rotationPolicy(orientation, report = () => {}) {
  let revision = 0,
    confirmed = false,
    pending = null;
  const fallback = () => {
    try {
      orientation?.unlock?.();
    } catch (error) {
      report({ operation: 'unlock', result: error.name });
    }
  };
  return {
    invalidate() {
      revision++;
      confirmed = false;
    },
    apply() {
      if (confirmed) return Promise.resolve(true);
      if (pending) return pending;
      const start = revision;
      pending = (async () => {
        try {
          if (!orientation?.lock) {
            fallback();
            return false;
          }
          await orientation.lock('any');
          if (start !== revision) return false;
          confirmed = true;
          report({ operation: 'any', result: 'allowed' });
          return true;
        } catch (error) {
          // An old rejected request must not unlock a newer fullscreen context.
          if (start === revision) {
            report({ operation: 'any', result: error.name });
            fallback();
          }
          return false;
        }
      })();
      const request = pending;
      void request.finally(() => {
        if (pending === request) pending = null;
      });
      return request;
    },
  };
}
