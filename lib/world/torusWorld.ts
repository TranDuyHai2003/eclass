/**
 * Quần đảo Xuyến — bố cục + luật câu đố (thuần, có test). Toạ độ game (x, z), y lên, bắc = −z; ô gốc [−24, 24)².
 *
 *  Đảo Neo (tâm ô)            : nơi xuất hiện, Bia Xuyến (ảnh nổi ô vuông → ống → xuyến), cổng về Quảng trường,
 *                               và Hộp Chuông ở mũi đá phía đông — chỉ mở về phía đông, phía đông là biển mây.
 *  Đảo Mép Đông–Tây (x = ±24) : nằm vắt qua mép dọc — nửa này ở mép phải, nửa kia ở mép trái của ô.
 *  Đảo Mép Bắc–Nam (z = ±24)  : vắt qua mép ngang.
 *  Đảo Bốn Góc (±24, ±24)     : bốn góc ô vuông là MỘT điểm; Mắt Canh Xuyến đứng giữa, chỉ tới được bằng cầu sáng
 *                               hiện ra khi rung Chuông (cổng tri thức).
 *
 * Câu đố cốt lõi (WORLD_DESIGN "bắn ra trước, trúng sau lưng"):
 *  1. Hộp Chuông: ba mặt kín, miệng hướng đông ra biển mây → không có chỗ đứng trước miệng. Đứng phía TÂY hộp, quay lưng,
 *     bắn về phía tây: mũi tên bay qua mép trái, hiện ra ở mép phải và chui vào miệng hộp từ phía đông.
 *  2. Mắt Canh Xuyến: khiên luôn quay về phía người chơi theo vectơ NGẮN NHẤT (ảnh gần nhất) → bắn thẳng bị chặn;
 *     quay lưng bắn đi → mũi tên đi đường dài quanh xuyến và trúng lưng nó. Quả cầu nó bắn trượt bạn cũng vòng về trúng lưng nó.
 */
import { delta, local, segAabb, segHitsCapsule, segSphere, torusDelta, wrap, TORUS_L, type Box3 } from "./torus";

export const L = TORUS_L;
/** mặt "biển mây" — rơi xuống dưới mức này coi như rơi khỏi đảo */
export const VOID_Y = -60;
export const FALL_Y = -9;

// ───────────── Đảo ─────────────

export interface Island {
  id: "anchor" | "eastwest" | "northsouth" | "corner";
  /** tâm (toạ độ liên tục — có thể nằm đúng trên mép) */
  x: number;
  z: number;
  /** bán kính trung bình */
  R: number;
  /** độ cao mép mặt đảo */
  top: number;
  /** vồng giữa đảo (m) */
  dome: number;
  /** chiều sâu thân đá dưới mặt đảo */
  depth: number;
  /** hoạ âm của đường bờ: [k, biên độ tương đối, pha] */
  harm: [number, number, number][];
  /** mũi đá (vd. chỗ đặt Hộp Chuông): góc, độ rộng (rad), độ nhô (m) */
  bump?: { a: number; w: number; amp: number };
}

export const BELL_BOX = {
  /** tâm z của lòng hộp, mặt trong vách sau, mặt miệng (x) */
  z: -5,
  back: 7.6,
  open: 10.7,
  /** nửa bề rộng lòng hộp (theo z) — hẹp + sâu 3,1 m: chỉ mũi tên bay lệch hướng tây < 22° mới tới được chuông */
  half: 0.55,
  wall: 0.35,
  /** chiều cao lòng hộp */
  h: 2.7,
  /** pha lê chuông ở đáy lòng hộp: dày (theo x), nửa rộng (theo z), từ y0 tới y1 so với đáy */
  bell: { depth: 0.6, half: 0.45, y0: 0.3, y1: 2.3 },
};

export const ISLANDS: Island[] = [
  {
    id: "anchor",
    x: 0,
    z: 0,
    R: 9.8,
    top: 0,
    dome: 0.55,
    depth: 11,
    harm: [
      [2, 0.045, 0.7],
      [3, 0.04, 2.1],
      [5, 0.022, 0.3],
    ],
    bump: { a: Math.atan2(BELL_BOX.z, 10.4), w: 0.2, amp: 1.7 },
  },
  {
    id: "eastwest",
    x: 24,
    z: 7,
    R: 5.2,
    top: 0.4,
    dome: 0.4,
    depth: 7,
    harm: [
      [2, 0.06, 1.3],
      [3, 0.05, 0.2],
    ],
  },
  {
    id: "northsouth",
    x: -4,
    z: 24,
    R: 6,
    top: 0.2,
    dome: 0.45,
    depth: 7.5,
    harm: [
      [2, 0.05, 2.6],
      [3, 0.05, 1.0],
    ],
  },
  {
    id: "corner",
    x: 24,
    z: 24,
    R: 4.8,
    top: 1.2,
    dome: 0.25,
    depth: 8,
    harm: [
      [4, 0.04, 0.5],
      [3, 0.03, 1.7],
    ],
  },
];
export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map((i) => [i.id, i])) as Record<Island["id"], Island>;

function angDiff(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
/** bán kính bờ đảo theo góc θ (atan2(z, x) quanh tâm đảo) */
export function islandRadius(is: Island, th: number): number {
  let r = 1;
  for (const [k, a, p] of is.harm) r += a * Math.sin(k * th + p);
  r *= is.R;
  if (is.bump) r += is.bump.amp * Math.exp(-((angDiff(th, is.bump.a) / is.bump.w) ** 2));
  return r;
}
/** độ cao mặt đảo tại điểm cục bộ (lx, lz) quanh tâm, null nếu ngoài bờ */
export function islandHeight(is: Island, lx: number, lz: number): number | null {
  const d = Math.hypot(lx, lz);
  const rr = islandRadius(is, Math.atan2(lz, lx));
  if (d > rr) return null;
  const q = d / rr;
  return is.top + is.dome * (1 - q * q);
}

// ───────────── Cầu ─────────────

export interface Bridge {
  id: "ce" | "ec" | "cn" | "nc" | "light";
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** bề rộng mặt cầu */
  w: number;
  ya: number;
  yb: number;
  /** cầu sáng — chỉ có khi đã rung Chuông */
  light?: boolean;
}
export const BRIDGES: Bridge[] = [
  // Đảo Neo ⇄ Đảo Mép Đông–Tây: đi mãi về phía đông là vòng về Đảo Neo từ phía tây
  { id: "ce", ax: 9.0, az: 3.0, bx: 19.6, bz: 6.6, w: 2.3, ya: 0.06, yb: 0.45 },
  { id: "ec", ax: -19.6, az: 6.6, bx: -9.0, bz: 3.0, w: 2.3, ya: 0.45, yb: 0.06 },
  // Đảo Neo ⇄ Đảo Mép Bắc–Nam: đi mãi về phía bắc là vòng về từ phía nam
  { id: "cn", ax: -3.2, az: -9.0, bx: -3.9, bz: -19.0, w: 2.3, ya: 0.06, yb: 0.3 },
  { id: "nc", ax: -3.9, az: 19.0, bx: -3.2, bz: 9.0, w: 2.3, ya: 0.3, yb: 0.06 },
  // cầu sáng (cổng tri thức): Đảo Mép Đông–Tây → Đảo Bốn Góc, chạy dọc ĐÚNG mép x = ±24
  { id: "light", ax: 24, az: 11.6, bx: 24, bz: 19.8, w: 2.4, ya: 0.45, yb: 1.25, light: true },
];

/** độ cao mặt cầu tại (x, z) (đã quấn), null nếu không trên cầu */
export function bridgeHeight(b: Bridge, x: number, z: number): number | null {
  const mx = (b.ax + b.bx) / 2;
  const mz = (b.az + b.bz) / 2;
  const p = local(x, z, mx, mz);
  const ux = b.bx - b.ax;
  const uz = b.bz - b.az;
  const len = Math.hypot(ux, uz);
  const along = (p.x * ux + p.z * uz) / len;
  const side = (p.x * -uz + p.z * ux) / len;
  if (Math.abs(along) > len / 2 || Math.abs(side) > b.w / 2) return null;
  const t = along / len + 0.5;
  return b.ya + (b.yb - b.ya) * t;
}

// ───────────── Vật trên đảo ─────────────

export const SPAWN = { x: 0, z: 3.2 };
/** Bia Xuyến (ảnh nổi ô vuông → xuyến) */
export const STONE = { x: 0.2, z: -1.6, r: 0.75 };
/** cổng về Quảng trường */
export const PORTAL = { x: -6.4, z: 3.4, r: 1.6 };
/** Bia Bốn Góc + rương (Đảo Bốn Góc, sau lưng Mắt Canh) */
export const CORNER_STONE = { x: 24 + 2.4, z: 24 + 1.2, r: 0.6 };

export const SENTINEL = {
  x: 24,
  z: 24,
  /** tâm lõi (trên mặt đảo); thân trúng đòn = trụ đứng từ y0 tới y1, bán kính r (cả khiên lẫn lưng) */
  cy: 1.75,
  r: 1.0,
  body: { y0: 0.25, y1: 3.1 },
  hp: 3,
  /** bán kính bệ (chặn bước) */
  pad: 1.0,
  /** chỉ để ý người chơi trong bán kính này (khoảng cách trên xuyến) */
  aggro: 19,
  /** chu kỳ bắn cầu (s), tốc độ (m/s), tuổi thọ (s) — đủ bay hơn một vòng L. Cầu bay NGANG ở độ cao ngực người chơi
   * lúc bắn (kẹp trong thân Mắt Canh) → đứng yên là trúng; né được thì nó vòng hết xuyến và đâm vào lưng chủ. */
  fireEvery: 2.8,
  orbSpeed: 8,
  orbLife: 6.8,
  orbDmg: 10,
  /** khiên che nón trước mặt: chặn nếu mũi tên bay ngược hướng nhìn trong 60° (cos = 0,5) */
  shieldCos: 0.5,
  /** tốc độ xoay khiên (rad/s) */
  turn: 3.2,
};

/** cây (toạ độ liên tục; quấn khi dùng) — tránh Hàng Chuông (|z + 5| < 2,3 trên Đảo Neo) và mặt cầu */
export const TREES: { x: number; z: number; s: number }[] = [
  { x: -6.2, z: -1.4, s: 1.05 },
  { x: 5.6, z: 6.6, s: 1.15 },
  { x: -5.2, z: 7.4, s: 0.95 },
  { x: 6.4, z: -0.6, s: 0.9 },
  { x: 4.3, z: 7.5, s: 0.85 },
  { x: -7.8, z: 1.2, s: 0.8 },
  { x: 25.6, z: 4.4, s: 1.0 },
  { x: 21.8, z: 9.6, s: 0.9 },
  { x: 27.0, z: 9.0, s: 0.85 },
  { x: -6.8, z: 22.4, s: 1.0 },
  { x: -1.2, z: 25.8, s: 0.9 },
  { x: -7.2, z: 27.0, s: 0.8 },
];
const TREE_R = 0.42;

/** cột mốc mép (cặp mép x: san hô · cặp mép z: ngọc lam) trên các cầu / đảo vắt qua mép */
export const SEAM_X_COLOR = "#ff8a6a";
export const SEAM_Z_COLOR = "#5fe0d0";

// ───────────── Mặt đất / va chạm ─────────────

export function torusGround(x: number, z: number, lit: boolean): number {
  const wx = wrap(x);
  const wz = wrap(z);
  let best = VOID_Y;
  for (const is of ISLANDS) {
    const p = local(wx, wz, is.x, is.z);
    const h = islandHeight(is, p.x, p.z);
    if (h !== null && h > best) best = h;
  }
  for (const b of BRIDGES) {
    if (b.light && !lit) continue;
    const h = bridgeHeight(b, wx, wz);
    if (h !== null && h > best) best = h;
  }
  return best;
}

/** đất liền (có chỗ đứng) tại (x, z) */
export function onLand(x: number, z: number, lit: boolean): boolean {
  return torusGround(x, z, lit) > VOID_Y + 1;
}

/** tường + mái + lòng Hộp Chuông, toạ độ CỤC BỘ: x như thế giới (không quấn vì hộp ở giữa ô), y tính từ đáy hộp */
export function bellBoxParts(y0: number): { walls: Box3[]; inside: Box3; bell: Box3 } {
  const B = BELL_BOX;
  const zc = B.z;
  const x0 = B.back - B.wall;
  const zo = B.half + B.wall;
  const top = y0 + B.h;
  return {
    walls: [
      { min: [x0, y0 - 0.6, zc - zo], max: [B.back, top + B.wall, zc + zo] }, // vách sau (tây)
      { min: [x0, y0 - 0.6, zc + B.half], max: [B.open, top + B.wall, zc + zo] }, // vách nam
      { min: [x0, y0 - 0.6, zc - zo], max: [B.open, top + B.wall, zc - B.half] }, // vách bắc
      { min: [x0, top, zc - zo], max: [B.open, top + B.wall, zc + zo] }, // mái
      { min: [x0, y0 - 0.6, zc - zo], max: [B.open, y0, zc + zo] }, // sàn
    ],
    inside: { min: [B.back, y0, zc - B.half], max: [B.open, top, zc + B.half] },
    bell: { min: [B.back, y0 + B.bell.y0, zc - B.bell.half], max: [B.back + B.bell.depth, y0 + B.bell.y1, zc + B.bell.half] },
  };
}
/** đáy Hộp Chuông (mặt đảo dưới tâm lòng hộp) */
export const BELL_Y0 = (() => {
  const is = ISLANDS[0];
  return islandHeight(is, BELL_BOX.back + 0.4, BELL_BOX.z) ?? 0;
})();
export const BELL_PARTS = bellBoxParts(BELL_Y0);

export function torusBlocked(x: number, z: number, lit: boolean, pad = 0.3): boolean {
  const wx = wrap(x);
  const wz = wrap(z);
  const B = BELL_BOX;
  if (wx > B.back - B.wall - pad && wx < B.open + pad && Math.abs(wz - B.z) < B.half + B.wall + pad) return true;
  const hit = (cx: number, cz: number, r: number) => {
    const p = local(wx, wz, cx, cz);
    return p.x * p.x + p.z * p.z < (r + pad) ** 2;
  };
  for (const t of TREES) if (hit(t.x, t.z, TREE_R * t.s)) return true;
  if (hit(STONE.x, STONE.z, STONE.r)) return true;
  if (hit(SENTINEL.x, SENTINEL.z, SENTINEL.pad)) return true;
  if (hit(CORNER_STONE.x, CORNER_STONE.z, CORNER_STONE.r)) return true;
  void lit;
  return false;
}

// ───────────── Luật câu đố ─────────────

/**
 * Đoạn bay a→b (toạ độ ô gốc) gặp Hộp Chuông: "bell" nếu chạm pha lê chuông ở đáy lòng hộp trước khi chạm vách,
 * "wall" nếu chạm vách / mái / sàn trước. Lòng hộp hẹp + sâu nên chỉ mũi tên bay gần đúng hướng tây mới tới được chuông.
 */
export function arrowVsBellBox(ax: number, ay: number, az: number, bx: number, by: number, bz: number): "bell" | "wall" | null {
  // hộp ở giữa ô (x ≈ 8…11) → đưa đoạn về ảnh gần hộp nhất
  const cx = (BELL_BOX.back + BELL_BOX.open) / 2;
  const sx = delta(cx, (ax + bx) / 2) - ((ax + bx) / 2 - cx);
  const sz = delta(BELL_BOX.z, (az + bz) / 2) - ((az + bz) / 2 - BELL_BOX.z);
  const tIn = segAabb(ax + sx, ay, az + sz, bx + sx, by, bz + sz, BELL_PARTS.bell);
  let tWall: number | null = null;
  for (const w of BELL_PARTS.walls) {
    const t = segAabb(ax + sx, ay, az + sz, bx + sx, by, bz + sz, w);
    if (t !== null && (tWall === null || t < tWall)) tWall = t;
  }
  if (tIn === null && tWall === null) return null;
  if (tWall === null) return "bell";
  if (tIn === null) return "wall";
  return tIn <= tWall ? "bell" : "wall";
}

/** hướng Mắt Canh nhìn: vectơ đơn vị NGẮN NHẤT (ảnh gần nhất) từ nó tới người chơi */
export function sentinelFacing(px: number, pz: number): { x: number; z: number } {
  const d = torusDelta(SENTINEL.x, SENTINEL.z, px, pz);
  const l = Math.hypot(d.dx, d.dz) || 1;
  return { x: d.dx / l, z: d.dz / l };
}

/** khiên chặn khi vật bay NGƯỢC hướng nhìn (lao thẳng vào mặt) trong nón 60° */
export function shieldBlocks(fx: number, fz: number, vx: number, vz: number): boolean {
  const l = Math.hypot(vx, vz);
  if (l < 1e-6) return true;
  return (vx * fx + vz * fz) / l < -SENTINEL.shieldCos;
}

/** đoạn bay chạm thân Mắt Canh (mặt đảo y0) — trả về t hoặc null */
export function arrowVsSentinel(ax: number, ay: number, az: number, bx: number, by: number, bz: number, y0: number): number | null {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const cx = mx + delta(mx, SENTINEL.x);
  const cz = mz + delta(mz, SENTINEL.z);
  if (!segHitsCapsule(ax, ay, az, bx, by, bz, cx, cz, y0 + SENTINEL.body.y0, y0 + SENTINEL.body.y1, SENTINEL.r)) return null;
  return segSphere(ax, ay, az, bx, by, bz, cx, y0 + SENTINEL.cy, cz, SENTINEL.r * 3) ?? 0;
}

/** xoay hướng nhìn hiện tại (yaw, rad: atan2(x, z)) về hướng đích, giới hạn tốc độ */
export function turnToward(yaw: number, tx: number, tz: number, dt: number, rate = SENTINEL.turn): number {
  const want = Math.atan2(tx, tz);
  const d = angDiff(want, yaw);
  const step = Math.max(-rate * dt, Math.min(rate * dt, d));
  return yaw + step;
}

// ───────────── Tiến trình ─────────────

export interface TorusProgress {
  /** đã đi qua một mép */
  crossed: boolean;
  /** đã tự bắn trúng lưng mình */
  selfHit: boolean;
  /** đã rung Chuông (cầu sáng hiện) */
  bell: boolean;
  /** đã hạ Mắt Canh Xuyến */
  warden: boolean;
}
export const NO_PROGRESS: TorusProgress = { crossed: false, selfHit: false, bell: false, warden: false };
export function parseProgress(raw: string | null): TorusProgress {
  if (!raw) return { ...NO_PROGRESS };
  try {
    const o = JSON.parse(raw) as Partial<TorusProgress>;
    return { crossed: o.crossed === true, selfHit: o.selfHit === true, bell: o.bell === true, warden: o.warden === true };
  } catch {
    return { ...NO_PROGRESS };
  }
}
