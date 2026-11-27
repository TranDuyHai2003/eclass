/**
 * Quảng trường Khởi nguyên (làm lại, kiểu HSR): bố cục thuần — dùng chung cho cảnh, va chạm, mặt đất, cỏ instanced và test.
 * PHẢI khớp script Blender dựng `props/hub_plaza.glb` (toạ độ game x, z; y lên; bắc = −z).
 *
 *  tâm: hồ gương r 7,4 (thành hồ ngồi được tới r 8,2) + tượng đài Thiên Nghi
 *  vòng sân đá r 8,2–12 · 8 lối đá toả tia (rộng 6 m) xen bồn cỏ r 12–29,2 · vòng dạo r 29,2–35 · lan can r 35,2
 *  bắc: cổng Sảnh Bất Khả · TB: Thung lũng Hàm số · ĐB: Vùng Kỳ quan · nam: Mê cung Hoạ âm
 *  tây: bảo tàng tròn · đông: đình Gương Hoá Thân · TN: vườn sinh vật · ĐN: bãi tập
 */

export const HUB_R = 36;
/** bán kính đi được (trong lan can) */
export const HUB_WALK_R = 34.4;
export const POOL = { r: 7.4, rim: 8.2, rimH: 0.45, water: 0.32, floor: -0.4, monument: 2.5 };
export const RING_IN = 12;
export const RING_OUT = 29.2;
export const PATH_HALF = 3;
/** điểm vào quảng trường (nhìn về bắc: tượng đài + cổng Sảnh Bất Khả) */
export const SPAWN = { x: 0, z: 20.5 };

const D = Math.SQRT1_2;
/** 8 hướng lối đi toả tia: B, ĐB, Đ, ĐN, N, TN, T, TB (bắc = −z) */
export const AXES: [number, number][] = [
  [0, -1],
  [D, -D],
  [1, 0],
  [D, D],
  [0, 1],
  [-D, D],
  [-1, 0],
  [-D, -D],
];

export type GateId = "impossible" | "valley" | "expanse" | "siren";
export interface Gate {
  id: GateId;
  /** tâm bệ (điểm đứng bấm F) */
  x: number;
  z: number;
  /** bán kính bệ 3 bậc */
  r: number;
  /** vị trí khung cổng (phía sau bệ, quay về tâm sân) */
  gx: number;
  gz: number;
  /** góc quay của khung cổng (mặt hướng về tâm) */
  yaw: number;
}
function gate(id: GateId, ax: [number, number], dist: number, r: number): Gate {
  const x = ax[0] * dist;
  const z = ax[1] * dist;
  return { id, x, z, r, gx: x + ax[0] * 1.9, gz: z + ax[1] * 1.9, yaw: Math.atan2(-ax[0], -ax[1]) };
}
export const GATES: Gate[] = [gate("impossible", AXES[0], 27.5, 5.2), gate("expanse", AXES[1], 27, 4.6), gate("siren", AXES[4], 29.6, 4.4), gate("valley", AXES[7], 27, 4.6)];
export const GATE_BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g])) as Record<GateId, Gate>;
export const PLATFORM_H = 0.45;

/** bảo tàng tròn (tây) và đình Gương (đông): bệ đá thấp, cột tròn quanh */
export const MUSEUM = { x: -28, z: 0, r: 5.6, cols: 12, colR: 4.8, h: 0.3 };
export const PAVILION = { x: 28, z: 0, r: 4.2, cols: 6, colR: 3.3, h: 0.3 };
/** vườn sinh vật (TN) và bãi tập (ĐN) */
export const GARDEN = { x: -19.8, z: 19.8, r: 6 };
export const YARD = { x: 19.8, z: 19.8, r: 6.2 };
/** cột gió (tàu lượn) sát mép đông */
export const UPDRAFT = { x: 31.5, z: -9, r: 1.4, top: 14 };

export const NPC = {
  guide: { x: -3.4, z: 17.6 },
  curator: { x: -22.2, z: 3.4 },
};
/** nhà của sinh vật hoang dã thứ i (vòng trong vườn) */
export function creatureSpot(i: number): [number, number] {
  const a = (i / 5) * Math.PI * 2 + 0.4;
  return [GARDEN.x + Math.cos(a) * 3.6, GARDEN.z + Math.sin(a) * 3.6];
}
/** điểm xuất hiện quái tập */
export const DUMMIES: [number, number][] = [
  [YARD.x - 2.5, YARD.z - 1.5],
  [YARD.x + 2.8, YARD.z - 0.8],
  [YARD.x + 0.2, YARD.z + 3],
];

// ── Bố trí cây, đèn, ghế (tất định) ──
export interface Prop {
  kind: "tree" | "blossom" | "lamp" | "bench";
  x: number;
  z: number;
  /** góc quay (ghế quay ra mép đảo) */
  yaw: number;
  s: number;
}
function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
/** lối đi toả tia: khoảng cách ngang tới trục gần nhất (âm nếu ngược hướng) */
export function pathDistance(x: number, z: number): number {
  let best = Infinity;
  for (const [ax, az] of AXES) {
    const along = x * ax + z * az;
    if (along < 0) continue;
    const d = Math.abs(x * az - z * ax);
    if (d < best) best = d;
  }
  return best;
}
/** vùng đặc biệt có sàn riêng (bệ cổng, bảo tàng, đình, vườn, bãi tập) */
export function inFeature(x: number, z: number, pad = 0): boolean {
  for (const g of GATES) if (Math.hypot(x - g.x, z - g.z) < g.r + pad) return true;
  if (Math.hypot(x - MUSEUM.x, z - MUSEUM.z) < MUSEUM.r + pad) return true;
  if (Math.hypot(x - PAVILION.x, z - PAVILION.z) < PAVILION.r + pad) return true;
  if (Math.hypot(x - GARDEN.x, z - GARDEN.z) < GARDEN.r + pad) return true;
  if (Math.hypot(x - YARD.x, z - YARD.z) < YARD.r + pad) return true;
  return false;
}
/** bồn cỏ (giữa các lối đá) */
export function isBed(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < RING_IN || r > RING_OUT) return false;
  if (pathDistance(x, z) < PATH_HALF) return false;
  return !inFeature(x, z, 0.6);
}
export const PROPS: Prop[] = (() => {
  const out: Prop[] = [];
  const R = rand(31);
  // cây: 2 cây mỗi bồn (giữa hai lối), xen cây hoa hồng nhạt
  for (let k = 0; k < 8; k++) {
    const a = Math.atan2(AXES[k][1], AXES[k][0]) + Math.PI / 8;
    for (const [rr, da] of [
      [17.5, -0.06],
      [24.5, 0.07],
    ] as const) {
      const x = Math.cos(a + da) * rr;
      const z = Math.sin(a + da) * rr;
      if (!isBed(x, z) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4) continue;
      out.push({ kind: (k + (rr > 20 ? 1 : 0)) % 2 ? "blossom" : "tree", x, z, yaw: R() * 6.28, s: 0.85 + R() * 0.35 });
    }
  }
  // đèn dọc vòng dạo + hai bên lối toả tia
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
    const x = Math.cos(a) * 30;
    const z = Math.sin(a) * 30;
    if (!inFeature(x, z, 0.8)) out.push({ kind: "lamp", x, z, yaw: 0, s: 1 });
  }
  for (const [ax, az] of AXES)
    for (const sd of [-1, 1]) {
      const x = ax * 13 + -az * sd * (PATH_HALF + 0.4);
      const z = az * 13 + ax * sd * (PATH_HALF + 0.4);
      out.push({ kind: "lamp", x, z, yaw: 0, s: 1 });
    }
  // ghế trên vòng dạo, quay ra biển mây
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8 + 0.12;
    const x = Math.cos(a) * 33;
    const z = Math.sin(a) * 33;
    if (!inFeature(x, z, 1)) out.push({ kind: "bench", x, z, yaw: Math.atan2(Math.cos(a), Math.sin(a)), s: 1 });
  }
  return out;
})();

/**
 * Cửa phòng "Học cùng nhau" (Study with me): cửa gỗ đứng ở mép vòng dạo phía tây – tây bắc (giữa lối T và TB,
 * giữa hai ghế đá / hai đèn), quay vào tâm sân. (x, z) = chỗ đứng bấm F; (dx, dz) = khung cửa sát lan can.
 * Khung cửa nằm ngoài bán kính đi được nên không cần thêm vật cản.
 */
const STUDY_A = (9 * Math.PI) / 8;
export const STUDY_DOOR = {
  x: Math.cos(STUDY_A) * 32.4,
  z: Math.sin(STUDY_A) * 32.4,
  r: 2,
  dx: Math.cos(STUDY_A) * 34.6,
  dz: Math.sin(STUDY_A) * 34.6,
  yaw: Math.atan2(-Math.cos(STUDY_A), -Math.sin(STUDY_A)),
};

/** lửa trại trên vòng dạo phía đông nam (giữa đèn và ghế, xa lối toả tia / đình) */
export const CAMPFIRE = { x: Math.cos(0.35) * 32, z: Math.sin(0.35) * 32 };

/** 4 đài phun nhiều tầng giữa bồn hoa (giữa hai cây, xen kẽ bồn) */
export const FOUNTAINS: { x: number; z: number; r: number }[] = [0, 2, 4, 6].map((k) => {
  const a = Math.atan2(AXES[k][1], AXES[k][0]) + Math.PI / 8;
  return { x: Math.cos(a) * 21, z: Math.sin(a) * 21, r: 1.7 };
});

// ── Va chạm (vòng tròn) ──
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export const COLLIDERS: Circle[] = (() => {
  const c: Circle[] = [{ x: CAMPFIRE.x, z: CAMPFIRE.z, r: 0.8 }];
  for (const p of PROPS) c.push({ x: p.x, z: p.z, r: p.kind === "lamp" ? 0.25 : p.kind === "bench" ? 0.7 : 0.55 * p.s });
  // trụ cổng (hai bên khung, cách tâm khung 2,9 m theo phương ngang)
  for (const g of GATES) {
    const sx = Math.cos(g.yaw);
    const sz = -Math.sin(g.yaw);
    for (const s of [-1, 1]) c.push({ x: g.gx + sx * s * 2.9, z: g.gz + sz * s * 2.9, r: 0.55 });
  }
  for (let i = 0; i < MUSEUM.cols; i++) {
    const a = (i / MUSEUM.cols) * Math.PI * 2;
    // chừa lối vào phía đông (hướng về tâm sân)
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue;
    c.push({ x: MUSEUM.x + Math.cos(a) * MUSEUM.colR, z: MUSEUM.z + Math.sin(a) * MUSEUM.colR, r: 0.42 });
  }
  c.push({ x: MUSEUM.x, z: MUSEUM.z, r: 1.1 });
  for (let i = 0; i < PAVILION.cols; i++) {
    const a = (i / PAVILION.cols) * Math.PI * 2 + Math.PI / 6;
    c.push({ x: PAVILION.x + Math.cos(a) * PAVILION.colR, z: PAVILION.z + Math.sin(a) * PAVILION.colR, r: 0.32 });
  }
  c.push({ x: PAVILION.x + 0.6, z: PAVILION.z, r: 0.75 });
  for (const n of Object.values(NPC)) c.push({ x: n.x, z: n.z, r: 0.45 });
  for (const f of FOUNTAINS) c.push({ x: f.x, z: f.z, r: f.r });
  return c;
})();

export function hubGround(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // hồ lội được: đáy −0,4 (nước ngập tới gối), đế tượng đài ở giữa
  if (r < POOL.monument) return 0.35;
  if (r < POOL.r) return POOL.floor;
  if (r < POOL.rim) return POOL.rimH;
  for (const g of GATES) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < g.r) return d < g.r - 1 ? PLATFORM_H : d < g.r - 0.5 ? 0.3 : 0.15;
  }
  if (Math.hypot(x - MUSEUM.x, z - MUSEUM.z) < MUSEUM.r) return MUSEUM.h;
  if (Math.hypot(x - PAVILION.x, z - PAVILION.z) < PAVILION.r) return PAVILION.h;
  return 0;
}
export function hubBlocked(x: number, z: number, pad = 0.3): boolean {
  const r = Math.hypot(x, z);
  if (r > HUB_WALK_R) return true;
  if (r < POOL.monument) return true;
  for (const c of COLLIDERS) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return true;
  return false;
}

/** Điểm tương tác (bấm F) */
export const INTERACT = {
  impossible: GATE_BY_ID.impossible,
  valley: GATE_BY_ID.valley,
  expanse: GATE_BY_ID.expanse,
  siren: GATE_BY_ID.siren,
  museum: { x: MUSEUM.x + 1.6, z: MUSEUM.z },
  mirror: { x: PAVILION.x - 1.6, z: PAVILION.z },
  study: { x: STUDY_DOOR.x, z: STUDY_DOOR.z },
};
