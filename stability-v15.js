// MY KEIBA LAB v15 - Android Chrome background/resume stability guard
(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__MYKEIBA_STABILITY_V15__) return;
  window.__MYKEIBA_STABILITY_V15__ = true;

  const observers = new Set();
  const THROTTLE_MS = 140;

  function StableMutationObserver(callback) {
    let timer = null;
    let disposed = false;
    const watches = [];

    const native = new NativeMutationObserver((records) => {
      if (disposed || document.hidden) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!disposed && !document.hidden) callback(records, native);
      }, THROTTLE_MS);
    });

    const nativeObserve = native.observe.bind(native);
    const nativeDisconnect = native.disconnect.bind(native);
    const nativeTakeRecords = native.takeRecords.bind(native);

    native.observe = (target, options) => {
      if (disposed) return;
      watches.push([target, options]);
      if (!document.hidden) nativeObserve(target, options);
    };

    native.disconnect = () => {
      disposed = true;
      watches.length = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      nativeDisconnect();
      observers.delete(native);
    };

    native.takeRecords = () => nativeTakeRecords();
    native.__myKeibaPause = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      nativeDisconnect();
    };
    native.__myKeibaResume = () => {
      if (disposed || document.hidden) return;
      for (const [target, options] of watches) {
        if (target?.isConnected || target === document || target === document.body) {
          try { nativeObserve(target, options); } catch {}
        }
      }
    };

    observers.add(native);
    return native;
  }

  StableMutationObserver.prototype = NativeMutationObserver.prototype;
  window.MutationObserver = StableMutationObserver;

  function saveQuietly() {
    try {
      if (typeof state !== 'undefined' && typeof STORAGE_KEY !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {}
  }

  function pauseBackgroundWork() {
    saveQuietly();
    for (const observer of observers) observer.__myKeibaPause?.();
  }

  function resumeForegroundWork() {
    for (const observer of observers) observer.__myKeibaResume?.();
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('mykeiba:resume'));
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseBackgroundWork();
    else resumeForegroundWork();
  }, { passive: true });

  window.addEventListener('pagehide', pauseBackgroundWork, { passive: true });
  window.addEventListener('pageshow', resumeForegroundWork, { passive: true });

  // Android Chrome may freeze a background tab before pagehide fires.
  window.addEventListener('freeze', pauseBackgroundWork, { passive: true });
  window.addEventListener('resume', resumeForegroundWork, { passive: true });
})();