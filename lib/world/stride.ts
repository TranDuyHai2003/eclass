/**
 * Khớp hoạt ảnh đi / chạy với di chuyển thật (chống "trượt chân"):
 *  tốc độ mặt đất của một clip tại chỗ = vận tốc bàn chân ĐANG CHẠM ĐẤT lùi về sau so với hông.
 *  Lấy mẫu clip N lần trong một chu kỳ → mỗi khoảng, chân thấp hơn là chân trụ → độ lớn vận tốc dọc trục trước–sau;
 *  lấy trung vị các giá trị dương (bỏ đoạn chuyển chân).
 * Khi chơi: tốc độ phát = vận tốc thật / tốc độ mặt đất của clip.
 */
export type FootSample = { t: number; lz: number; ly: number; rz: number; ry: number };

export function groundSpeedFromFeet(s: FootSample[]): number {
  const v: number[] = [];
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i];
    const b = s[i + 1];
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    // chân trụ = chân thấp hơn ở cả hai mẫu (bỏ khoảng đang đổi chân)
    const leftDown = a.ly < a.ry && b.ly < b.ry;
    const rightDown = a.ry < a.ly && b.ry < b.ly;
    if (!leftDown && !rightDown) continue;
    // độ lớn (không phụ thuộc chiều trục: mô hình VRM0 bị xoay 180° → "phía trước" trong hệ cục bộ có thể là −z)
    const back = Math.abs(leftDown ? a.lz - b.lz : a.rz - b.rz) / dt;
    if (back > 1e-4) v.push(back);
  }
  if (!v.length) return 0;
  v.sort((x, y) => x - y);
  return v[Math.floor(v.length / 2)];
}

/** tốc độ phát clip để chân không trượt; giới hạn để không quá đơ / quá nhanh khi gần đứng yên */
export function strideTimeScale(actualSpeed: number, clipSpeed: number, min = 0.45, max = 2.4): number {
  if (!(clipSpeed > 0.05)) return 1;
  return Math.min(max, Math.max(min, actualSpeed / clipSpeed));
}

export type Loco = "walk" | "run" | "sprint";
/**
 * Chọn clip di chuyển theo VẬN TỐC THẬT (không theo phím): đi < 2,2 m/s ≤ chạy < 5,2 m/s ≤ chạy nước rút;
 * trễ ±0,3 m/s quanh ngưỡng để không giật qua lại khi tốc độ dao động sát ngưỡng.
 */
export function locoClip(v: number, cur: Loco | null): Loco {
  const H = 0.3;
  const up1 = cur === "walk" ? 2.2 + H : 2.2 - H;
  const up2 = cur === "sprint" ? 5.2 - H : 5.2 + H;
  if (v >= up2) return "sprint";
  if (v >= up1) return "run";
  return "walk";
}
