if (typeof URL !== "undefined" && typeof URL.parse !== "function") {
  URL.parse = function (url, base) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
importScripts("/pdf.worker.min.mjs");
