/**
 * Khe Young lượng tử (bốt Siêu khối, TESSERACT_BOOTH.md §13 I3) — logic thuần.
 * Từng hạt một bay qua hai khe và chấm lên màn; đủ nhiều hạt thì vân giao thoa hiện ra:
 *   I(u) ∝ cos²(β_d·u) · sinc²(β_a·u)   (u = toạ độ ngang trên màn, −1…1; β_d ∝ khoảng cách khe d, β_a ∝ bề rộng khe a)
 * Bật "máy dò đường đi" (biết hạt qua khe nào) → mất cos², chỉ còn đường bao nhiễu xạ một khe sinc².
 * Khoảng vân Δu = π / β_d (tương ứng Δy = λL/d).
 */
export const DS = {
  bearing: 60,
  rGun: 10.7,
  rBarrier: 11.95,
  rScreen: 13.3,
  beamY: 1.6,
  screenY: 2.55, // cao hơn tấm chắn để đứng sau súng vẫn thấy màn
  W: 2.6,
  H: 1.8,
  /** các mức khoảng cách khe (tương đối) */
  gaps: [0.5, 0.8, 1.2],
  betaA: 3.7,
  betaD: 14,
  /** bệ điều khiển trong khung thí nghiệm (x ngang, z dọc chùm tính từ tâm phòng) */
  stations: { detector: { x: -1.25, z: 10.2 }, gap: { x: 1.25, z: 10.2 } },
} as const;

const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x);
export const betaD = (d: number) => DS.betaD * d;
export function intensity(u: number, d: number, detector: boolean): number {
  const env = sinc(DS.betaA * u) ** 2;
  return detector ? env : Math.cos(betaD(d) * u) ** 2 * env;
}
/** khoảng vân trên màn (đơn vị u) */
export const fringeSpacing = (d: number) => Math.PI / betaD(d);

/** lấy mẫu vị trí hạt (u ngang, v dọc) bằng loại bỏ — trả [u, v] trong [−1, 1]² */
export function sampleHit(rand: () => number, d: number, detector: boolean): [number, number] {
  for (let i = 0; i < 1000; i++) {
    const u = rand() * 2 - 1;
    if (rand() < intensity(u, d, detector)) {
      // dọc: phân bố tam giác mềm quanh giữa (khe cao hữu hạn)
      const v = (rand() + rand() - 1) * 0.85;
      return [u, v];
    }
  }
  return [0, 0];
}

/** khung thí nghiệm → toạ độ cục bộ phòng (khung xoay π − bearing quanh y; +z khung = hướng ra tường) */
export function slitToRoom(x: number, z: number): [number, number] {
  const th = Math.PI - (DS.bearing * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}
export function nearSlit(x: number, z: number, y: number): "detector" | "gap" | null {
  if (y > 1.2) return null;
  for (const id of ["detector", "gap"] as const) {
    const s = DS.stations[id];
    const [sx, sz] = slitToRoom(s.x, s.z);
    if (Math.hypot(x - sx, z - sz) < 1.0) return id;
  }
  return null;
}
