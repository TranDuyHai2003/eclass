"use client";

/**
 * Tạm dừng hoạt ảnh CSS của phần tử khi nó nằm ngoài màn hình: đặt thuộc tính `data-off` (CSS: `[data-off] *` →
 * animation-play-state: paused). Một IntersectionObserver dùng chung cho cả trang (lưới 30+ thẻ trên điện thoại).
 * Dùng thuộc tính data-* để React vẽ lại không xoá mất (khác className).
 */
let io: IntersectionObserver | null = null;

export function pauseOffscreen(el: Element | null | undefined): () => void {
  if (!el || typeof IntersectionObserver === "undefined") return () => {};
  io ??= new IntersectionObserver((entries) => entries.forEach((e) => e.target.toggleAttribute("data-off", !e.isIntersecting)), { rootMargin: "80px" });
  el.setAttribute("data-off", "");
  io.observe(el);
  return () => io?.unobserve(el);
}
