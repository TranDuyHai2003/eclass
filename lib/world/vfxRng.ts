/**
 * VFX-AAA — số ngẫu nhiên CÓ HẠT GIỐNG cho quỹ đạo hiệu ứng (tia, mảnh, khói) thay Math.random():
 * cùng hạt giống → cùng chuỗi → ảnh chụp từng pha / so sánh trước-sau lặp lại được (window.__vfxSeed(n) ở bản dev).
 * Logic thuần, không cấp phát khi gọi — test ở tests/world/vfxRng.test.ts.
 */

/** Mulberry32: trạng thái 32 bit, chu kỳ 2^32, phân bố đều đủ tốt cho hiệu ứng */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Băm số nguyên → số nguyên 32 bit (xáo hạt giống, chỉ số ô lưới) */
export function hash32(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Dòng ngẫu nhiên dùng chung của mọi hiệu ứng (một trạng thái toàn cục, đặt lại bằng vfxSeed) */
const STREAM = { state: 0x2f6b1d3 >>> 0 };

/** Đặt lại hạt giống của dòng chung (dev: chụp ảnh lặp lại, test) */
export function vfxSeed(seed: number): void {
  STREAM.state = hash32(seed);
}

/** Số trong [0, 1) từ dòng chung — thay Math.random() trong mọi quỹ đạo hiệu ứng */
export function vfxRand(): number {
  STREAM.state = (STREAM.state + 0x6d2b79f5) >>> 0;
  let t = STREAM.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Số trong [lo, hi) */
export function vfxRange(lo: number, hi: number): number {
  return lo + (hi - lo) * vfxRand();
}

/** Số trong [-1, 1) (lệch đối xứng) */
export function vfxSigned(): number {
  return vfxRand() * 2 - 1;
}
