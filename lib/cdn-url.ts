// Hằng số & helper URL CDN thuần (không phụ thuộc AWS SDK) để dùng được ở client.
// lib/b2.ts re-export lại để code phía server không phải đổi import.

export const B2_BUCKET_NAME =
  process.env.B2_BUCKET_NAME && !process.env.B2_BUCKET_NAME.includes("dummy")
    ? process.env.B2_BUCKET_NAME
    : "teacherduc-video-storage";
export const CDN_DOMAIN =
  process.env.NEXT_PUBLIC_VIDEO_DOMAIN || "https://cdn.teacherduc.me";

export function normalizeCdnUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return url || null;

  // Don't treat simple answer strings like "A", "B", "T", "F", etc. as relative URL paths
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    return url;
  }

  const baseDomain = CDN_DOMAIN.replace(/\/file\/.*$/, "").replace(/\/$/, "");

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsedUrl = new URL(url);
      const cdnHost = new URL(baseDomain).hostname;

      // Check if host belongs to CDN / B2 bucket / local storage
      const isCdnHost =
        parsedUrl.hostname === cdnHost ||
        parsedUrl.hostname.includes("backblazeb2.com");

      // If it's an external domain (e.g. youtube.com, youtu.be, vimeo.com, google.com, etc.),
      // return original URL unchanged.
      if (!isCdnHost) {
        return url;
      }
    } catch {
      // If parsing fails, fall back
    }
  }

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // If not a valid full URL, treat as path
  }

  // Remove /temp/ from documents/ path if present
  if (pathname.includes("/documents/")) {
    pathname = pathname.replace("/temp/", "/");
  }
  
  // Replace dummy_bucket with real bucket name if present
  pathname = pathname.replace("dummy_bucket", B2_BUCKET_NAME);

  // Collapse all /file/<bucket> prefix occurrences
  pathname = pathname.replace(/(\/file\/[^\/]+)+/g, "");

  if (!pathname.startsWith("/")) pathname = "/" + pathname;

  return `${baseDomain}/file/${B2_BUCKET_NAME}${pathname}`;
}
