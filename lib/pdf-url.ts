import { normalizeCdnUrl } from "@/lib/cdn-url";

export function isGoogleDriveFolder(url: string) {
  return /drive\.google\.com\/.*\/folders\//.test(url);
}

/** URL hiển thị/tải về của file PDF (đã chuẩn hoá CDN). */
export function normalizePdfUrl(rawUrl: string) {
  const normalized = normalizeCdnUrl(rawUrl) || rawUrl || "";
  // Backblaze B2 trả lỗi 400 nếu URL có dấu phẩy chưa encode
  return normalized.replace(/,/g, "%2C");
}

function needsProxy(url: string) {
  if (typeof window === "undefined") return false;
  if (url.startsWith("/") || url.startsWith(window.location.origin)) return false;
  try {
    const parsed = new URL(url);
    // CDN của mình đã có CORS → tải trực tiếp (tránh proxy với file lớn)
    if (parsed.hostname === "cdn.teacherduc.me") return false;
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** URL để pdf.js tải file (đi qua proxy nếu khác origin và không có CORS). */
export function resolvePdfFileUrl(rawUrl: string) {
  const url = normalizePdfUrl(rawUrl);
  return needsProxy(url) ? `/api/proxy/pdf?url=${encodeURIComponent(url)}` : url;
}
