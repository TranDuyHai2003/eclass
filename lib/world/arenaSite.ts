/**
 * Chọn chỗ đặt đấu trường boss (Vùng Kỳ quan): tâm PHẲNG NHẤT trong bán kính quanh điểm dự kiến — đồi / vách cao hơn sàn
 * làm khuất báo trước đòn đánh. Không phá địa hình (khác Terraria tự xây đấu trường): chỉ dời tâm.
 * Điểm = chênh cao (max − min) trong khung đấu trường + phạt dời xa + phạt nằm dưới mực nước (sàn ngập).
 */
export type GroundFn = (x: number, z: number) => number;

export type ArenaSiteOpts = {
  /** nửa cạnh khung đấu trường (m) */
  half: number;
  /** bán kính tìm (m) */
  radius?: number;
  /** bước lưới ứng viên (m) */
  step?: number;
  /** bước lấy mẫu độ cao trong khung (m) */
  sample?: number;
  /** mực nước (sàn thấp hơn bị phạt) */
  water?: number;
};

export function flattestSite(cx: number, cz: number, ground: GroundFn, o: ArenaSiteOpts): { cx: number; cz: number; range: number } {
  const radius = o.radius ?? 16;
  const step = o.step ?? 4;
  const sample = o.sample ?? 3;
  const water = o.water ?? -Infinity;
  let best = { cx, cz, range: Infinity };
  let bestScore = Infinity;
  for (let dz = -radius; dz <= radius; dz += step)
    for (let dx = -radius; dx <= radius; dx += step) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const x0 = cx + dx;
      const z0 = cz + dz;
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = -o.half; v <= o.half; v += sample)
        for (let u = -o.half; u <= o.half; u += sample) {
          const h = ground(x0 + u, z0 + v);
          if (h < lo) lo = h;
          if (h > hi) hi = h;
        }
      const range = hi - lo;
      const score = range + Math.hypot(dx, dz) * 0.05 + (lo < water ? 6 : 0);
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = { cx: x0, cz: z0, range };
      }
    }
  return best;
}
