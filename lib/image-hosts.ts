/** Các tên miền ảnh được bộ tối ưu next/image xử lý (dùng chung cho next.config và component). */
export const OPTIMIZED_IMAGE_HOSTS = [
  "eclass.b-cdn.net",
  "vz-7449c6de-22c.b-cdn.net",
  "cdn.teacherduc.me",
  "images.unsplash.com",
];

/** true nếu ảnh có thể đi qua next/image; ảnh từ tên miền lạ dùng `unoptimized` để không làm lỗi trang. */
export function canOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZED_IMAGE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}
