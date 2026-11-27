/**
 * Thế giới Bất Khả mở rộng ra vũ trụ: sân 40 × 40 m thành một đảo nổi, quanh đó là quần đảo kỳ quan toán học
 * chỉ tới được bằng cách BAY LƯỢN. Hàm thuần (không three.js) — dùng chung cho cảnh, va chạm và test.
 * Bố cục PHẢI khớp script Blender dựng `props/imp_cosmos.glb` (toạ độ game x, z; y là độ cao).
 */

/** Nửa cạnh mặt sân (sàn 40 × 40) */
export const COURT_HALF = 20;
/** Hành lang khách sạn Hilbert vươn ra ngoài cạnh bắc sân, lơ lửng giữa vũ trụ */
export const CORRIDOR = { x0: 5.1, x1: 8.9, z0: -52, z1: -2 };
/** Lan can cao ~1,2 m: bay cao hơn mức này thì vượt qua được */
export const RAIL_CLEAR = 1.6;

export interface CosmosIsle {
  id: string;
  x: number;
  z: number;
  /** độ cao mặt đảo */
  h: number;
  /** bán kính mặt đảo */
  r: number;
  /** bán kính lõi kỳ quan đứng trên đảo (không đi xuyên); 0 = kỳ quan lơ lửng phía trên */
  core: number;
  /** chiều cao lõi tính từ mặt đảo (bay cao hơn thì qua được) */
  coreH: number;
  /** khối bao kỳ quan: tâm cao hơn mặt đảo lmY, bán kính lmR */
  lmY: number;
  lmR: number;
}

export const ISLES: CosmosIsle[] = [
  { id: "knot", x: -64, z: 26, h: 10, r: 9, core: 1.4, coreH: 4, lmY: 11, lmR: 7 },
  { id: "sierp", x: 58, z: 44, h: 3, r: 10, core: 6, coreH: 10, lmY: 5, lmR: 9 },
  { id: "lorenz", x: 80, z: -26, h: 20, r: 8, core: 1.2, coreH: 3, lmY: 10, lmR: 9 },
  { id: "fib", x: -44, z: -60, h: -8, r: 11, core: 0.8, coreH: 10, lmY: 6, lmR: 8 },
  { id: "hopf", x: 6, z: 96, h: 26, r: 8, core: 1.4, coreH: 4, lmY: 10, lmR: 8 },
  { id: "s1", x: -30, z: 58, h: 14, r: 4.5, core: 0, coreH: 0, lmY: 0, lmR: 0 },
  { id: "s2", x: 40, z: -64, h: 6, r: 4.5, core: 0, coreH: 0, lmY: 0, lmR: 0 },
  { id: "s3", x: 100, z: 30, h: 12, r: 4, core: 0, coreH: 0, lmY: 0, lmR: 0 },
  { id: "s4", x: -90, z: -20, h: 2, r: 4.5, core: 0, coreH: 0, lmY: 0, lmR: 0 },
];
export const ISLE_BY_ID: Record<string, CosmosIsle> = Object.fromEntries(ISLES.map((i) => [i.id, i]));

/** Trong mặt sân (hoặc trong lòng hành lang Hilbert vươn ra ngoài) */
export function onCourt(x: number, z: number): boolean {
  if (Math.abs(x) <= COURT_HALF && Math.abs(z) <= COURT_HALF) return true;
  return x > CORRIDOR.x0 && x < CORRIDOR.x1 && z > CORRIDOR.z0 && z < CORRIDOR.z1;
}

/**
 * Mặt đất ngoài sân: mặt đảo cao nhất có mặt ≤ maxY + 0,6 (đang ở trên đảo / vừa rơi xuống), null = vực.
 * (Trong sân do cảnh tự tính: bậc kiosk, sân khấu…)
 */
export function isleGround(x: number, z: number, maxY = Infinity): number | null {
  let best: number | null = null;
  for (const i of ISLES) {
    if ((x - i.x) ** 2 + (z - i.z) ** 2 > i.r * i.r) continue;
    if (i.h > maxY + 0.6) continue;
    if (best === null || i.h > best) best = i.h;
  }
  return best;
}

/** Va chạm lõi kỳ quan trên đảo (khi đi bộ / bay thấp) */
export function isleBlocked(x: number, z: number, y: number): boolean {
  for (const i of ISLES) {
    if (i.core <= 0) continue;
    if (y < i.h - 0.5 || y > i.h + i.coreH) continue;
    if ((x - i.x) ** 2 + (z - i.z) ** 2 < i.core * i.core) return true;
  }
  return false;
}

// ── Vòng bay: đường Catmull-Rom khép kín đi quanh các đảo; vòng đặt cách đều ~22 m ──
type V3 = [number, number, number];
export const FLIGHT_WAYPOINTS: V3[] = [
  [0, 12, 30],
  [10, 24, 62],
  [-18, 30, 106],
  [-30, 26, 66],
  [-44, 24, 44],
  [-56, 20, 6],
  [-86, 14, -8],
  [-72, 8, -42],
  [-30, 6, -84],
  [7, 9, -62],
  [40, 15, -66],
  [68, 24, -56],
  [96, 26, -44],
  [106, 24, -14],
  [102, 22, 6],
  [94, 18, 32],
  [70, 14, 64],
  [34, 12, 40],
];

function catmull(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
}

/** Lấy mẫu dày đường bay khép kín */
export function flightPath(samplesPerSeg = 24): V3[] {
  const W = FLIGHT_WAYPOINTS;
  const n = W.length;
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = W[(i - 1 + n) % n];
    const p1 = W[i];
    const p2 = W[(i + 1) % n];
    const p3 = W[(i + 2) % n];
    for (let s = 0; s < samplesPerSeg; s++) out.push(catmull(p0, p1, p2, p3, s / samplesPerSeg));
  }
  return out;
}

export interface FlightRing {
  /** tâm vòng */
  p: V3;
  /** pháp tuyến (hướng bay qua) */
  n: V3;
}
export const RING_R = 3.2;

/** Vòng đặt cách đều nhau theo độ dài cung trên đường khép kín (số vòng = làm tròn chu vi / spacing) */
export function flightRings(spacing = 22): FlightRing[] {
  const P = flightPath();
  const seg = P.map((a, i) => {
    const b = P[(i + 1) % P.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  });
  const total = seg.reduce((x, y) => x + y, 0);
  const n = Math.max(3, Math.round(total / spacing));
  const step = total / n;
  const rings: FlightRing[] = [];
  let i = 0;
  let base = 0; // độ dài cung tới đầu đoạn i
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (base + seg[i] < target) base += seg[i++];
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const t = seg[i] ? (target - base) / seg[i] : 0;
    const L = seg[i] || 1;
    rings.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], n: [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L] });
  }
  return rings;
}

/** Đoạn di chuyển a → b có xuyên qua mặt vòng (trong bán kính R) không */
export function crossesRing(a: V3, b: V3, ring: FlightRing, R = RING_R): boolean {
  const [nx, ny, nz] = ring.n;
  const da = (a[0] - ring.p[0]) * nx + (a[1] - ring.p[1]) * ny + (a[2] - ring.p[2]) * nz;
  const db = (b[0] - ring.p[0]) * nx + (b[1] - ring.p[1]) * ny + (b[2] - ring.p[2]) * nz;
  if (da === db || (da > 0 && db > 0) || (da < 0 && db < 0)) return false;
  const t = da / (da - db);
  const x = a[0] + (b[0] - a[0]) * t - ring.p[0];
  const y = a[1] + (b[1] - a[1]) * t - ring.p[1];
  const z = a[2] + (b[2] - a[2]) * t - ring.p[2];
  return x * x + y * y + z * z <= R * R;
}

// ── Vật lý bay lượn (thuần, để test) ──
export const FLY = {
  /** tốc độ ngang khi lượn / khi tăng tốc */
  cruise: 10,
  boost: 17,
  /** rơi chậm khi không điều khiển */
  sink: 0.8,
  /** tốc độ leo tối đa / lao tối đa */
  climb: 7,
  dive: 16,
  /** trần bay */
  ceiling: 130,
  /** góc nhìn "bay ngang" (camPitch) */
  level: 0.22,
};

/**
 * Vận tốc thẳng đứng mục tiêu khi bay: nhìn xuống (camPitch lớn) → lao, nhìn lên → leo; không bấm hướng → rơi chậm.
 * Trả về [vy, hệ số tốc độ ngang] (lao xuống nhanh dần, leo lên chậm lại).
 */
export function soarVertical(camPitch: number, moving: boolean): [number, number] {
  if (!moving) return [-FLY.sink, 1];
  const k = Math.sin(camPitch - FLY.level); // > 0 nhìn xuống
  if (k > 0) return [-Math.min(FLY.dive, k * FLY.dive * 1.25), 1 + k * 0.6];
  return [Math.min(FLY.climb, -k * FLY.climb * 1.6), 1 + k * 0.35];
}

// ── Trạm thí nghiệm ở mỗi kỳ quan ──
export type LabId = "knot" | "sierp" | "lorenz" | "fib" | "hopf";
export const LAB_IDS: LabId[] = ["knot", "sierp", "lorenz", "fib", "hopf"];
/**
 * Vị trí trạm: điểm đứng để bấm F (x, z, bán kính kích hoạt r) và chỗ đặt bảng hologram (holo, cao y).
 * Hologram quay về phía sân (người chơi bay tới từ sân).
 */
export function labSpot(id: LabId) {
  const i = ISLE_BY_ID[id];
  const L = Math.hypot(i.x, i.z);
  const ux = -i.x / L;
  const uz = -i.z / L;
  const at = (d: number, y: number): [number, number, number] => [i.x + ux * d, i.h + y, i.z + uz * d];
  const face = Math.atan2(ux, uz);
  if (id === "fib") return { x: i.x + ux * 8.3, z: i.z + uz * 8.3, r: 3.2, holo: at(6.9, 2.9), face, h: i.h };
  // tháp hologram đặt lệch sang bên điểm đứng (không chồng lên người chơi), ngồi trên mặt đảo
  if (id === "sierp") return { x: i.x + ux * 8.6, z: i.z + uz * 8.6, r: 3.0, holo: [i.x + ux * 7.4 - uz * 4, i.h + 0.55, i.z + uz * 7.4 + ux * 4] as [number, number, number], face, h: i.h };
  // kỳ quan lơ lửng trên bệ ở tâm: đứng quanh bệ; quả cầu S² (Hopf) đặt cạnh bệ
  return { x: i.x, z: i.z, r: 4.6, holo: at(3.4, 3.3), face, h: i.h };
}
