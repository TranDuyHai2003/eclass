/**
 * Thư viện Babel — hình học + điều hướng của MỘT đơn vị lặp (thuần, kiểm thử được). Khớp script Blender `babel_build.py`.
 * Toạ độ game: gốc = tâm phòng lục giác trên sàn; x = đông (cửa hai phía ±x dẫn ra hành lang hẹp), z = nam.
 * Phòng lục giác đều (bán kính ngoại tiếp RH), 4 bức tường có giá sách, 2 bức tường trống có cửa; giếng thông gió lục giác
 * ở giữa có lan can rất thấp. Hành lang phía đông (dài HALL_L) dẫn sang phòng kế tiếp; trong hành lang: gương, 2 buồng nhỏ,
 * giếng cầu thang xoắn (phía bắc, −z). Đơn vị lặp vô hạn theo x (chu kỳ PERIOD) và theo tầng (FH).
 */
const C30 = Math.cos(Math.PI / 6);
export const BR = {
  RH: 5,
  AP: 5 * C30,
  CEIL: 3,
  FH: 3.4,
  SHAFT: 1.7,
  DOOR_W: 1.4,
  HALL_L: 3,
  HALL_W: 1.7,
  CASE_D: 0.36,
  SHELF_Z: [0.12, 0.62, 1.12, 1.62, 2.12, 2.62],
  PERIOD: 2 * 5 * C30 + 3,
  STAIR: { x: 5 * C30 + 1.5, z: -(1.7 / 2 + 1.25), r: 1.25 },
  LAMPS: [
    [0, 3 - 0.55, -(1.7 + 1.35)],
    [0, 3 - 0.55, 1.7 + 1.35],
  ] as [number, number, number][],
} as const;
const R = 0.3; // bán kính người chơi

/** Các cạnh của lục giác: pháp tuyến ngoài hướng θ = 60°·i + 60° (i = 0..5); cạnh i = 2 và 5 là hai tường có cửa (±x) */
const SIDES = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 + 60 * i) * Math.PI) / 180;
  return { i, nx: Math.cos(a), nz: -Math.sin(a), door: i === 2 || i === 5 };
});
/** Bốn bức tường sách theo thứ tự w = 0..3 */
export const SHELF_WALLS = SIDES.filter((s) => !s.door);

/** Đưa x về trong một đơn vị: [−AP, AP + HALL_L) và cho biết đã lệch bao nhiêu chu kỳ */
export function wrapX(x: number): { lx: number; k: number } {
  const k = Math.floor((x + BR.AP) / BR.PERIOD);
  return { lx: x - k * BR.PERIOD, k };
}

/** Còn đi được ở (x, z)? — phòng lục giác (trừ giá sách + lan can giếng), cửa, hành lang */
export function babelFree(x: number, z: number): boolean {
  const { lx } = wrapX(x);
  // Hành lang hẹp
  if (lx > BR.AP - 0.6 && Math.abs(z) < BR.HALL_W / 2 - R) return true;
  // Trong phòng: thử từng cạnh
  for (const s of SIDES) {
    const d = lx * s.nx + z * s.nz;
    const lim = s.door ? BR.AP - 0.12 - R : BR.AP - BR.CASE_D - 0.04 - R;
    if (d > lim) {
      // cửa ở hai tường trống
      if (s.door && Math.abs(z) < BR.DOOR_W / 2 - R) continue;
      return false;
    }
  }
  // Lan can giếng: lục giác trung đoạn (SHAFT + 0.12)·cos30
  const ap = (BR.SHAFT + 0.12) * C30 + R;
  let inShaft = true;
  for (const s of SIDES) if (lx * s.nx + z * s.nz > ap) inShaft = false;
  return !inShaft;
}

export type BabelSpot = { kind: "shelf"; wall: number } | { kind: "stair" } | { kind: "mirror" } | null;
/** Điểm tương tác gần (x, z): bức tường sách nào, cầu thang, gương */
export function babelSpot(x: number, z: number): BabelSpot {
  const { lx } = wrapX(x);
  if (Math.hypot(lx - BR.STAIR.x, z - (-BR.HALL_W / 2)) < 1.0) return { kind: "stair" };
  if (lx > BR.AP && lx < BR.AP + BR.HALL_L && z > 0.1 && Math.abs(lx - (BR.AP + BR.HALL_L / 2)) < 0.6) return { kind: "mirror" };
  let best: BabelSpot = null;
  let bd = 1.25;
  SHELF_WALLS.forEach((s, w) => {
    const d = BR.AP - BR.CASE_D - (lx * s.nx + z * s.nz);
    // độ lệch dọc tường
    const lat = Math.abs(-lx * s.nz + z * s.nx);
    if (d > -0.1 && d < bd && lat < BR.RH / 2 - 0.3) {
      bd = d;
      best = { kind: "shelf", wall: w };
    }
  });
  return best;
}

/** Vị trí + hướng của một cuốn sách (trong đơn vị ở gốc) — dùng cho instancing */
export function bookTransform(wall: number, shelf: number, vol: number) {
  const s = SHELF_WALLS[wall];
  const W = BR.RH - 0.5;
  // trung điểm tường, pháp tuyến hướng vào trong, hướng dọc tường
  const mx = s.nx * BR.AP;
  const mz = s.nz * BR.AP;
  const inx = -s.nx;
  const inz = -s.nz;
  const sdx = -s.nz;
  const sdz = s.nx;
  const off = -W / 2 + ((vol + 0.5) * W) / 32;
  const depth = BR.CASE_D / 2 + 0.02;
  return {
    x: mx + inx * depth + sdx * off,
    z: mz + inz * depth + sdz * off,
    y: BR.SHELF_Z[shelf] + 0.025,
    yaw: Math.atan2(sdx, sdz), // trục dày của sách dọc theo tường
    width: (W / 32) * 0.86,
  };
}

/** Khoảng không máy quay được ở: trong phòng (dưới trần), trong hành lang, hoặc trong lòng giếng thông gió (mọi độ cao) */
export function babelAir(x: number, y: number, z: number): boolean {
  const { lx } = wrapX(x);
  // giếng: lục giác trung đoạn SHAFT·cos30 — thông suốt mọi tầng
  let inShaft = true;
  for (const s of SIDES) if (lx * s.nx + z * s.nz > BR.SHAFT * C30 - 0.1) inShaft = false;
  if (inShaft) return true;
  const fy = y - Math.floor(y / BR.FH) * BR.FH;
  if (fy < 0.15 || fy > BR.CEIL - 0.15) return false;
  if (lx > BR.AP - 0.3 && Math.abs(z) < BR.HALL_W / 2 - 0.12 && fy < 2.55) return true;
  for (const s of SIDES) {
    const d = lx * s.nx + z * s.nz;
    const lim = s.door ? BR.AP - 0.15 : BR.AP - BR.CASE_D - 0.1;
    if (d > lim && !(s.door && Math.abs(z) < BR.DOOR_W / 2 - 0.12 && fy < 2.3)) return false;
  }
  return true;
}
/** Kéo máy quay về điểm xa nhất còn trong khoảng không trên đoạn nhân vật → máy quay */
export function clampBabelCam(cam: { x: number; y: number; z: number }, t: { x: number; y: number; z: number }) {
  if (babelAir(cam.x, cam.y, cam.z)) return false;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    if (babelAir(t.x + (cam.x - t.x) * m, t.y + (cam.y - t.y) * m, t.z + (cam.z - t.z) * m)) lo = m;
    else hi = m;
  }
  const k = Math.max(0, lo - 0.03);
  cam.x = t.x + (cam.x - t.x) * k;
  cam.y = t.y + (cam.y - t.y) * k;
  cam.z = t.z + (cam.z - t.z) * k;
  return true;
}
