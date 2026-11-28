/**
 * Sét trong Expanse — logic thuần (không three):
 *  • MÔ HÌNH QUẢ CẦU LĂN (rolling sphere, IEC 62305): tia tiên đạo đi xuống, quả cầu bán kính R có tâm ở đầu tia chạm vật
 *    ĐẦU TIÊN → điểm bị đánh là điểm làm tâm cầu dừng cao nhất: max (đỉnh + √(R² − d²)) với d = khoảng cách ngang tới tia.
 *    Hệ quả: một cột thu lôi cao che chở vùng quanh chân nó (cầu tựa vào đỉnh cột trước khi chạm người đứng cạnh).
 *  • Vật dẫn (vàng) được cộng điểm (tia ưu tiên đường dẫn điện).
 *  • FULGURITE: sét đánh xuống cát → nung chảy thành ống thuỷ tinh xuyên xuống (tối đa maxDepth khối cát liền nhau).
 */
export type StrikeCand = { x: number; z: number; top: number; conductor?: boolean; player?: boolean };

export const ROLL_R = 7;
export const CONDUCTOR_BONUS = 1.2;

/** điểm chạm của quả cầu bán kính R hạ xuống quanh tia tiên đạo (lx, lz); null nếu không có ứng viên nào trong tầm */
export function rollingSphereTarget(cands: StrikeCand[], lx: number, lz: number, R = ROLL_R): number {
  let best = -1;
  let bestH = -Infinity;
  cands.forEach((c, i) => {
    const d = Math.hypot(c.x - lx, c.z - lz);
    if (d >= R) return;
    const h = c.top + Math.sqrt(R * R - d * d) + (c.conductor ? CONDUCTOR_BONUS : 0);
    if (h > bestH) {
      bestH = h;
      best = i;
    }
  });
  return best;
}

/** các tầng y (từ trên xuống) biến thành thuỷ tinh khi sét đánh vào khối cát có mặt trên ở y = top − 1 */
export function fulgurite(top: number, isSand: (y: number) => boolean, maxDepth = 4): number[] {
  const out: number[] = [];
  for (let y = top - 1; y >= top - maxDepth && isSand(y); y--) out.push(y);
  return out;
}
