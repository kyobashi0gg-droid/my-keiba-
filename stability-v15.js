// MY KEIBA LAB v15 - Android Chrome background/resume stability guard
// v45 tuning: MutationObserver監視先を重複保持しない・休止/復帰時の再監視を軽量化
(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__MYKEIBA_STABILITY_V15__) return;
  window.__MYKEIBA_STABILITY_V15__ = true;

  const observers = new Set();
  const THROTTLE_MS = 160;

  function StableMutationObserver(callback) {
    let timer = null;
    let disposed = false;
    // native observe() は同じ target への再指定を更新扱いにするため、配列ではなくMapで1件に保つ。
    const watches = new Map();

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
      if (disposed || !target) return;
      watches.set(target, options);
      if (!document.hidden) nativeObserve(target, options);
    };

    native.disconnect = () => {
      disposed = true;
      watches.clear();
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
      for (const [target, options] of watches.entries()) {
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
  window.addEventListener('freeze', pauseBackgroundWork, { passive: true });
  window.addEventListener('resume', resumeForegroundWork, { passive: true });
})();
