/**
 * Mặt trời / mặt trăng theo GIỜ THẬT (thuần, không three) — công thức NOAA rút gọn (sai số < 1° — đủ cho game):
 *   độ xích vĩ δ, phương trình thời gian EoT, góc giờ H → cao độ h và phương vị A tại vĩ độ φ (mặc định Hà Nội 21°B, 105,8°Đ, UTC+7).
 * Toạ độ game: y lên, bắc = −z, đông = +x (khớp lib/world/hubLayout.ts).
 * Trăng: xấp xỉ "đối diện mặt trời" lệch theo pha trăng (đủ để ban đêm luôn có nguồn sáng lạnh chiếu xiên).
 */
export const HANOI = { lat: 21.03, lon: 105.85, tz: 7 };

const RAD = Math.PI / 180;

export type SkyPos = { elevation: number; azimuth: number; dir: [number, number, number] };

/** thứ tự ngày trong năm (1…366) theo giờ địa phương của vị trí */
function dayOfYear(d: Date, tz: number) {
  const local = new Date(d.getTime() + tz * 3600e3);
  const start = Date.UTC(local.getUTCFullYear(), 0, 1);
  return Math.floor((local.getTime() - start) / 86400e3) + 1;
}

/** cao độ (độ, 0 = chân trời), phương vị (độ, từ bắc theo chiều kim đồng hồ), vector hướng tới mặt trời trong toạ độ game */
export function sunPosition(d: Date, loc = HANOI): SkyPos {
  const n = dayOfYear(d, loc.tz);
  const hourLocal = ((d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + loc.tz) % 24 + 24) % 24;
  const g = ((2 * Math.PI) / 365) * (n - 1 + (hourLocal - 12) / 24);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // giờ mặt trời thật (phút): giờ địa phương + EoT + 4 phút / độ kinh tuyến lệch so với kinh tuyến múi giờ
  const tst = hourLocal * 60 + eot + 4 * loc.lon - 60 * loc.tz;
  const ha = (tst / 4 - 180) * RAD;
  const lat = loc.lat * RAD;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  const el = 90 - zen / RAD;
  // phương vị từ bắc, chiều kim đồng hồ
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180;
  az = ((az % 360) + 360) % 360;
  return { elevation: el, azimuth: az, dir: toDir(el, az) };
}

/** (cao độ, phương vị) → vector đơn vị trong toạ độ game (bắc = −z, đông = +x) */
export function toDir(elDeg: number, azDeg: number): [number, number, number] {
  const e = elDeg * RAD;
  const a = azDeg * RAD;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)];
}

/** trăng: đối diện mặt trời, nâng tối thiểu 25° khi đêm để luôn có ánh trăng xiên */
export function moonPosition(d: Date, loc = HANOI): SkyPos {
  const s = sunPosition(d, loc);
  const el = Math.max(25, -s.elevation * 0.9);
  const az = (s.azimuth + 180) % 360;
  return { elevation: el, azimuth: az, dir: toDir(el, az) };
}

/**
 * Độ "ngày" 0…1 theo cao độ mặt trời: 1 khi mặt trời > 10°, 0 khi < −6° (hết hoàng hôn dân sự),
 * mượt (smoothstep) ở giữa — dùng để trộn bảng màu ngày / hoàng hôn / đêm.
 */
export function dayFactor(elevation: number): number {
  const t = Math.min(1, Math.max(0, (elevation + 6) / 16));
  return t * t * (3 - 2 * t);
}
