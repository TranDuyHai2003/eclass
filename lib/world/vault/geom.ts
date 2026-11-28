/**
 * Hầm Bổ đề — hình học thuần dùng chung (client + server realtime). KHÔNG import gì ngoài thư mục vault
 * (file này được chép sang realtime/vault.mjs bằng scripts/gen-realtime.mjs).
 */
export type V3 = [number, number, number];

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Khoảng cách từ (px, pz) tới đoạn AB trên mặt phẳng xz; t ∈ [0, 1] là vị trí chiếu trên đoạn */
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  const x = ax + dx * t - px;
  const z = az + dz * t - pz;
  return { d: Math.sqrt(x * x + z * z), t };
}

/** Khoảng cách tới đường gấp khúc pts = [x0, z0, x1, z1, …]; t ∈ [0, 1] theo chỉ số điểm (đều theo tham số) */
export function polyDist(px: number, pz: number, pts: number[]): { d: number; t: number } {
  const n = pts.length / 2 - 1;
  let best = Infinity;
  let bt = 0;
  for (let i = 0; i < n; i++) {
    const r = segDist(px, pz, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]);
    if (r.d < best) {
      best = r.d;
      bt = (i + r.t) / n;
    }
  }
  return { d: best, t: bt };
}

/** Số ngẫu nhiên tất định (mulberry32) — cùng hạt giống ra cùng dãy trên client và server */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dist2(a: V3, x: number, z: number): number {
  return Math.hypot(a[0] - x, a[2] - z);
}
