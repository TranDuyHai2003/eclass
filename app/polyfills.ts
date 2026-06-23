"use client";

// Polyfills cho các thiết bị cũ như iPhone 8 (Safari cũ)
import 'core-js/features/array/at';
import 'core-js/features/array/flat';
import 'core-js/features/array/flat-map';
import 'core-js/features/array/find-last';
import 'core-js/features/array/find-last-index';
import 'core-js/features/string/replace-all';
import 'core-js/features/string/match-all';
import 'core-js/features/promise/all-settled';
import 'core-js/features/promise/finally';
import 'core-js/features/object/from-entries';
import 'core-js/features/global-this';

if (typeof window !== 'undefined') {
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (cb: any) {
      const start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          }
        });
      }, 1) as any;
    };
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id: any) {
      clearTimeout(id);
    };
  }

  if (!window.queueMicrotask) {
    window.queueMicrotask = function (callback) {
      Promise.resolve().then(callback);
    };
  }
}
