/**
 * Tesseract Booth console room — pure navigation logic (testable, no three.js).
 * Local frame: origin at the Hypercore on the main floor; x = east, z = south (+z = toward the entry door).
 * Bearing b (degrees): 0° = north = −z (great window), 90° = east (+x), 180° = south (+z, entry).
 * Mirrors the Blender generator (docs/ai-reviews/game-3d/TESSERACT_BOOTH.md §4).
 */
export const TR = {
  R: 14,
  HW: 12.5,
  DOME: 7.5,
  ZM: 5,
  MZ_R0: 11.4,
  WIN: { y: 6.8, r: 5.5 },
  VEST: { w: 1.8, h: 2.6, r1: 17 },
  CORR: { w: 3, h: 3.6, L: 8 },
  ST_R0: 11.6,
  ST_R1: 13.4,
  RISERS: 28,
  CONSOLE_R: 1.7,
  CORE_TOP: 4.6,
} as const;
export const DAIS: [number, number][] = [
  [4.4, 0.15],
  [4.05, 0.3],
  [3.7, 0.45],
];
/** [chân, đỉnh] theo phương vị */
export const STAIRS: [number, number][] = [
  [160, 122],
  [200, 238],
];
export const MEZ_ARCS: [number, number][] = [
  [25, 122],
  [238, 335],
];
export const COLUMNS = [40, 72, 104, 256, 288, 320];
export const CORRIDORS = [90, 270];
const RAD = Math.PI / 180;

export const bearing = (x: number, z: number) => ((Math.atan2(x, -z) / RAD) % 360 + 360) % 360;
/** a − b quy về (−180, 180] */
export const bdiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
/** Hướng ngang của phương vị (x, z) */
export const dirOf = (b: number): [number, number] => [Math.sin(b * RAD), -Math.cos(b * RAD)];

/** Độ cao bậc thang tại (x, z) (bỏ qua độ cao người chơi), null nếu không ở trên cầu thang */
export function stairHeight(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r < TR.ST_R0 || r > TR.ST_R1) return null;
  const b = bearing(x, z);
  for (const [b0, b1] of STAIRS) {
    const t = bdiff(b, b0) / (b1 - b0);
    if (t >= 0 && t <= 1) return (TR.ZM * Math.min(TR.RISERS, Math.floor(t * TR.RISERS) + 1)) / TR.RISERS;
  }
  return null;
}
export function onMezzanine(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < TR.MZ_R0 || r > TR.R - 0.1) return false;
  const b = bearing(x, z);
  return MEZ_ARCS.some(([b0, b1]) => b >= b0 && b <= b1);
}
/** Cầu kính mũi tàu trước cửa sổ (võng về phía cửa sổ) */
export function onBridge(x: number, z: number): boolean {
  const d = bdiff(bearing(x, z), 0);
  if (Math.abs(d) > 27) return false;
  const t = (d + 27) / 54;
  const rc = TR.MZ_R0 + 0.9 + 1.1 * Math.sin(Math.PI * t);
  return Math.abs(Math.hypot(x, z) - rc) < 0.9;
}
const onUpper = (x: number, z: number) => onMezzanine(x, z) || onBridge(x, z);

/** Mặt đất cao nhất mà người chơi ở độ cao y có thể đứng (bệ 3 bậc, cầu thang, tầng lửng, cầu kính) */
export function roomGround(x: number, z: number, y: number): number {
  const r = Math.hypot(x, z);
  let g = 0;
  if (r < DAIS[0][0]) g = r < DAIS[2][0] ? DAIS[2][1] : r < DAIS[1][0] ? DAIS[1][1] : DAIS[0][1];
  const sh = stairHeight(x, z);
  if (sh !== null && sh <= y + 0.55) g = Math.max(g, sh);
  if (onUpper(x, z) && y > TR.ZM - 0.6) g = TR.ZM;
  return g;
}

/** Trạng thái do cảnh cập nhật mỗi khung: người chơi đang ở trên cao (cầu thang / tầng lửng) → lan can chặn */
export const roomNav = { elevated: false };
export function updateRoomNav(x: number, z: number, y: number) {
  const g = roomGround(x, z, y);
  roomNav.elevated = g > 0.5 && (stairHeight(x, z) !== null || onUpper(x, z));
}

/** Vị trí trong tiền sảnh / hành lang (các lối ra khỏi vòng tường) */
function inPassage(x: number, z: number, margin: number): boolean {
  const r = Math.hypot(x, z);
  // Tiền sảnh: dọc trục +z, hẹp
  if (z > 0 && Math.abs(x) < TR.VEST.w / 2 - margin && r < TR.VEST.r1 + 1.5) return true;
  for (const cb of CORRIDORS) {
    const [dx, dz] = dirOf(cb);
    const along = x * dx + z * dz;
    const lat = Math.abs(-x * dz + z * dx);
    if (along > 0 && lat < TR.CORR.w / 2 - margin && along < TR.R + TR.CORR.L - 0.4) return true;
  }
  return false;
}

/** Va chạm trong phòng (toạ độ cục bộ) */
export function roomBlocked(x: number, z: number, y: number): boolean {
  const r = Math.hypot(x, z);
  if (roomNav.elevated) {
    // Trên cao: chỉ đi trên bậc / tầng lửng / cầu kính; lan can và tường chặn
    if (r > TR.R - 0.4) return true;
    return !(stairHeight(x, z) !== null || onUpper(x, z));
  }
  if (r < TR.CONSOLE_R + 0.35) return true;
  for (const c of COLUMNS) {
    const [dx, dz] = dirOf(c);
    if (Math.hypot(x - dx * (TR.MZ_R0 + 0.25), z - dz * (TR.MZ_R0 + 0.25)) < 0.5) return true;
  }
  // Gầm cầu thang: chỗ quá thấp để đi qua
  const sh = stairHeight(x, z);
  if (sh !== null && sh > y + 0.55 && sh < y + 2.1) return true;
  // Ghế bệ cửa sổ
  if (r > 12.4 && Math.abs(bdiff(bearing(x, z), 0)) * RAD * TR.R < 2.6) return true;
  if (r > TR.R - 0.45) return !inPassage(x, z, 0.3);
  return false;
}

/** Thể tích máy quay được phép (để không nhìn xuyên tường) */
export function insideRoomVolume(x: number, y: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < TR.R - 0.7 && y > 0.25 && y < TR.HW + TR.DOME - 1) return true;
  if (y > 0.2 && y < TR.VEST.h - 0.25 && inPassage(x, z, 0.25)) return true;
  if (y > 0.2 && y < TR.CORR.h && r > TR.R - 1 && inPassage(x, z, 0.3) && Math.abs(z) < TR.CORR.w) return true;
  return false;
}

/** Kéo máy quay về điểm xa nhất còn trong phòng trên đoạn nhân vật → máy quay */
export function clampCamera(cam: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) {
  if (insideRoomVolume(cam.x, cam.y, cam.z)) return false;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    if (insideRoomVolume(target.x + (cam.x - target.x) * m, target.y + (cam.y - target.y) * m, target.z + (cam.z - target.z) * m)) lo = m;
    else hi = m;
  }
  const k = Math.max(0, lo - 0.02);
  cam.x = target.x + (cam.x - target.x) * k;
  cam.y = target.y + (cam.y - target.y) * k;
  cam.z = target.z + (cam.z - target.z) * k;
  return true;
}

/** Bàn điều khiển trong tầm tay (đứng trên bệ, không ở tầng trên) */
export const nearConsole = (x: number, z: number, y: number) => Math.hypot(x, z) < 3.6 && y < 1.2;

// ───────── Lỗ sáng phyllotaxis (góc vàng 137,508°) ─────────
export const GOLDEN_ANGLE = 137.50776405;
export type Aperture = { x: number; y: number; z: number; nx: number; ny: number; nz: number; k: number; dome: boolean };
const domePt = (u: number) => {
  const a = u * (Math.PI / 2) * 0.97;
  return { r: 2.2 + (TR.R - 2.2) * Math.cos(a), y: TR.HW + TR.DOME * Math.sin(a), a };
};
/** Tường: xoắn ốc góc vàng y 5,6 → 12,2; mái: hoa hướng dương Vogel N = 377 (số Fibonacci) */
export function apertures(): Aperture[] {
  const out: Aperture[] = [];
  const N = 260;
  const ribs = Array.from({ length: 10 }, (_, k) => 18 + 36 * k);
  for (let n = 0; n < N; n++) {
    const b = (n * GOLDEN_ANGLE) % 360;
    const y = 5.9 + (6.1 * n) / N;
    if (Math.hypot(bdiff(b, 0) * RAD * TR.R, y - TR.WIN.y) < TR.WIN.r + 1.1) continue;
    if (ribs.some((rb) => Math.abs(bdiff(b, rb)) < 2.2)) continue;
    if ([90, 270].some((cb) => Math.abs(bdiff(b, cb)) * RAD * TR.R < 1.9 && y < TR.ZM + 3.6)) continue;
    const [dx, dz] = dirOf(b);
    const r = TR.R - 0.04;
    out.push({ x: dx * r, y, z: dz * r, nx: -dx, ny: 0, nz: -dz, k: n / N, dome: false });
  }
  const ND = 377;
  const rMax = TR.R - 0.3;
  for (let n = 1; n < ND; n++) {
    const rho = rMax * Math.sqrt(n / ND);
    if (rho < 2.9) continue;
    const b = (n * GOLDEN_ANGLE) % 360;
    // tìm u sao cho bán kính mái = rho
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2;
      if (domePt(m).r > rho) lo = m;
      else hi = m;
    }
    const p = domePt(lo);
    const [dx, dz] = dirOf(b);
    // pháp tuyến hướng vào trong của elip: (−cos a / R', −sin a / D') chuẩn hoá
    const nr = -Math.cos(p.a) / (TR.R - 2.2);
    const ny = -Math.sin(p.a) / TR.DOME;
    const L = Math.hypot(nr, ny);
    out.push({ x: dx * (p.r - 0.03), y: p.y - 0.03, z: dz * (p.r - 0.03), nx: (dx * nr) / L, ny: ny / L, nz: (dz * nr) / L, k: n / ND, dome: true });
  }
  return out;
}
