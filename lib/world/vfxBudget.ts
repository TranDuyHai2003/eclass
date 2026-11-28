/**
 * Ngân sách hiệu ứng theo mức đồ hoạ (V1) + khung máy quay khi đứng sát boss (B1) — logic thuần, test ở
 * tests/world/vfxBudget.test.ts.
 */

/** Mức hiệu ứng trong cài đặt đồ hoạ (gfx.vfx): 0 thấp · 1 vừa · 2 cao */
export type VfxLevel = 0 | 1 | 2;

/** Số hạt sống tối đa trong batch Sparks (bộ đệm vật lý là 480) */
export const PARTICLE_CAP: Record<VfxLevel, number> = { 0: 140, 1: 300, 2: 480 };
/** Hệ số số hạt mỗi lần phát (chùm nổ, tia trúng đòn) */
export const PARTICLE_MUL: Record<VfxLevel, number> = { 0: 0.4, 1: 0.7, 2: 1 };
/** Dải vệt (mũi tên / quả lắc / đĩa) và bóng mờ khi lướt */
export const RIBBON_CAP: Record<VfxLevel, number> = { 0: 4, 1: 10, 2: 16 };
export const GHOST_CAP: Record<VfxLevel, number> = { 0: 0, 1: 2, 2: 4 };

export function particleCap(v: VfxLevel): number {
  return PARTICLE_CAP[v] ?? PARTICLE_CAP[1];
}

/** Số hạt thực phát cho yêu cầu n (ít nhất 1 nếu n ≥ 1 để mọi đòn vẫn có phản hồi) */
export function scaleCount(n: number, v: VfxLevel): number {
  if (n <= 0) return 0;
  return Math.max(1, Math.round(n * (PARTICLE_MUL[v] ?? 1)));
}

/** Còn chỗ cho thêm một hạt không */
export function canEmit(live: number, v: VfxLevel): boolean {
  return live < particleCap(v);
}

// ───────────── Máy quay quanh boss ─────────────

/** Gần tới mức nào (0 = xa ≥ far, 1 = sát ≤ near), nội suy smoothstep */
export function closeness(d: number, near: number, far: number): number {
  if (d <= near) return 1;
  if (d >= far) return 0;
  const t = (far - d) / (far - near);
  return t * t * (3 - 2 * t);
}

/**
 * Khung hình khi đứng sát boss to: lùi xa (dist × (1 + PULL·k)), hạ góc (pitch kéo về LOW) và nâng điểm nhìn,
 * để thấy cả thân boss lẫn nhân vật. k = closeness(…). Góc người chơi tự chỉnh (pitch) không bị ghi đè.
 */
export const FRAME_PULL = 0.6;
export const FRAME_LOW = 0.02;
export const FRAME_LIFT = 0.7;
export function bossFrame(dist: number, pitch: number, k: number): { dist: number; pitch: number; lift: number } {
  const p = pitch > FRAME_LOW ? pitch + (FRAME_LOW - pitch) * 0.75 * k : pitch;
  return { dist: dist * (1 + FRAME_PULL * k), pitch: p, lift: FRAME_LIFT * k };
}
