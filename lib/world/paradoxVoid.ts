/**
 * Hư Không Nghịch Lý — bố cục quần đảo nổi (khớp `props/paradox_void.glb`, dựng bằng Blender):
 *  đảo tâm r 8,5 · đảo cổng ra phía nam · 10 đảo trạm trên hai vòng (18 m / 27 m, cao thấp lệch nhau)
 *  · cầu phiến đá nối đảo tâm ↔ 5 đảo vòng trong, mỗi đảo vòng ngoài ↔ hai đảo vòng trong kề bên (vòng zíc-zắc).
 * Toạ độ game: x đông, z nam, y lên. Hàm thuần → kiểm thử được (`tests/world/paradoxVoid.test.ts`).
 */
export type Isle = { x: number; z: number; h: number; r: number };

export const HUB: Isle = { x: 0, z: 0, h: 0, r: 8.5 };
export const EXIT: Isle = { x: 0, z: 12, h: -0.3, r: 2.4 };
const H = [0.6, 2.0, -0.5, 1.4, 0.9, -1.2, 0.3, 1.8, -0.6, 1.1];
export const ISLES: Isle[] = H.map((h, k) => {
  const a = ((36 * (k + 0.5)) * Math.PI) / 180;
  const R = k % 2 === 0 ? 18 : 27;
  return { x: Math.sin(a) * R, z: Math.cos(a) * R, h, r: 4.4 };
});
/** Ba đảo vòng ngoài (mở rộng cosmic): Đài Chân Trời Sự Kiện (về phía hố đen), Quảng trường Dữ liệu (tây), Đài Thiên Văn (đông nam) */
export const OUTER = {
  o1: { x: 27, z: -37, h: 2.4, r: 6.5 },
  o2: { x: -47, z: 3, h: 0.4, r: 7.5 },
  o3: { x: 41, z: 27, h: 2.8, r: 6.0 },
} satisfies Record<string, Isle>;
/**
 * Năm vùng xa (mở rộng khám phá, cách đảo tâm 50–100 m), mỗi vùng một chủ đề:
 *  z1 Rạn San Hô Fractal (tây bắc) · z2 Thác Nước Chảy Ngược (tây nam; z2b là đảo trời — cưỡi thác/luồng gió lên)
 *  z3 Thành Phố Neon Ngược (đông) · z4 Rừng Sứa Tinh Vân (nam, thấp) · z5 Đỉnh Vô Cực (trên cao — cưỡi luồng gió từ đảo trạm 7)
 */
export const FAR = {
  z1a: { x: -78, z: -58, h: 5, r: 9 },
  z1b: { x: -93, z: -42, h: 9, r: 5 },
  z1c: { x: -62, z: -79, h: 2, r: 5.5 },
  z2a: { x: -55, z: 52, h: 2, r: 8 },
  z2b: { x: -66, z: 68, h: 22, r: 6 },
  z3a: { x: 80, z: -12, h: 6, r: 10 },
  z3b: { x: 96, z: 4, h: 10, r: 5 },
  z4a: { x: 8, z: 70, h: -4, r: 9 },
  z4b: { x: -7, z: 86, h: -6, r: 6 },
  z4c: { x: 25, z: 87, h: -5, r: 5 },
  z5: { x: -22, z: -24, h: 32, r: 6 },
} satisfies Record<string, Isle>;
export type OuterId = keyof typeof OUTER | keyof typeof FAR;
export type NodeId = "hub" | "exit" | OuterId | number;
const NAMED: Record<string, Isle> = { ...OUTER, ...FAR };
export const node = (id: NodeId): Isle => (id === "hub" ? HUB : id === "exit" ? EXIT : typeof id === "string" ? NAMED[id] : ISLES[id]);
/** Luồng gió nâng (đứng vào + mở tàu lượn → bay lên tới `top`) */
export const UPDRAFTS = [
  { x: -58.1, z: 56.5, r: 2.2, top: 27 }, // thác chảy ngược → đảo trời z2b
  { x: -16.0, z: -13.0, r: 1.8, top: 37 }, // đảo trạm 7 → Đỉnh Vô Cực z5
];
export const BRIDGES: [NodeId, NodeId][] = [
  ["hub", "exit"],
  ...[0, 2, 4, 6, 8].map((k) => ["hub", k] as [NodeId, NodeId]),
  ...[1, 3, 5, 7, 9].flatMap((k) => [[k, (k + 9) % 10] as [NodeId, NodeId], [k, (k + 1) % 10] as [NodeId, NodeId]]),
  [3, "o1"],
  [7, "o2"],
  [1, "o3"],
  ["o2", "z1a"],
  ["z1a", "z1b"],
  ["z1a", "z1c"],
  [9, "z2a"],
  ["o3", "z3a"],
  ["z3a", "z3b"],
  ["exit", "z4a"],
  ["z4a", "z4b"],
  ["z4a", "z4c"],
];
/** Mọi đảo (để vẽ / kiểm thử) */
export const ALL_ISLES: Isle[] = [HUB, EXIT, ...ISLES, ...Object.values(OUTER), ...Object.values(FAR)];
/** bề rộng đi được của cầu (phiến 2,1 m, chừa mép sáng) */
const BRIDGE_HALF = 0.85;
/** biên đi được trong đảo (viền vàng) */
const EDGE = 0.45;

/** Độ cao mặt đất tại (x, z), hoặc null nếu là vực hư không. `maxY`: chỉ tính mặt đất không cao hơn chân quá 0,6 m
 * (đang lượn bên dưới một đảo trời thì không bị "hút" lên mặt đảo đó) */
export function voidGround(x: number, z: number, maxY = Infinity): number | null {
  let best: number | null = null;
  const take = (h: number) => {
    if (h > maxY + 0.6) return;
    best = best === null ? h : Math.max(best, h);
  };
  for (const n of ALL_ISLES) if (Math.hypot(x - n.x, z - n.z) < n.r - EDGE) take(n.h);
  for (const [a, b] of BRIDGES) {
    const A = node(a);
    const B = node(b);
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const L = Math.hypot(dx, dz);
    const ux = dx / L;
    const uz = dz / L;
    const s = (x - A.x) * ux + (z - A.z) * uz;
    const lat = Math.abs(-(x - A.x) * uz + (z - A.z) * ux);
    if (lat > BRIDGE_HALF) continue;
    // đoạn cầu: từ mép đảo A (r − 0,45) tới mép đảo B — độ cao nội suy tuyến tính như phiến trong Blender
    const s0 = A.r - 0.45;
    const s1 = L - (B.r - 0.45);
    if (s < s0 - 0.6 || s > s1 + 0.6) continue;
    const u = Math.min(1, Math.max(0, (s - s0) / (s1 - s0)));
    take(A.h + (B.h - A.h) * u);
  }
  return best;
}

/** Vị trí trạm k (tâm đảo, mặt đảo) */
export const stationPos = (k: number) => ({ x: ISLES[k].x, y: ISLES[k].h, z: ISLES[k].z });

/** n điểm cách đều tham số trên lemniscate Bernoulli (∞), bề ngang [−1, 1]: x = cos t/(1+sin²t), y = sin t·cos t/(1+sin²t) */
export function lemniscate(n: number): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n + Math.PI / n;
    const d = 1 + Math.sin(t) ** 2;
    return [Math.cos(t) / d, (Math.sin(t) * Math.cos(t)) / d];
  });
}
