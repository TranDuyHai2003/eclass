/**
 * Đồ thị khu của Mê cung Hoạ âm (giai đoạn 2 — docs/ai-reviews/siren-witch/PHASE2_PLAN.md). Thuần, không three.js.
 *
 * Mỗi khu là một không gian Euclid CỤC BỘ có gốc riêng (origin, cách nhau ≥ 2000 m > camera.far) → mọi hệ cũ dựa trên vị trí
 * (boss, quái, câu đố, trọng lực kỳ dị, cổng của hub) tự tách khỏi khu khác. Phi Euclid nằm ở CỬA:
 *  - cửa = khung đứng (tâm đáy cục bộ, yaw: pháp tuyến n = (sin yaw, 0, cos yaw) hướng ra phía tiếp cận), lỗ chữ nhật / tròn;
 *  - đi qua mặt cửa từ trước ra sau trong lỗ → ra ở cửa đối ngẫu: (lr, lu, ln) → (−lr, lu, −ln), vận tốc ngang xoay
 *    Δ = yaw_đích − yaw_nguồn + π (mọi cặp hiện có thiết kế Δ ≡ 0 → máy quay chỉ tịnh tiến, liền mạch tuyệt đối).
 * Kèm: chỉ mục va chạm lưới băm theo khu, quyết định streaming, lọc người chơi theo khu.
 */
import { inFootprint } from "./sirenMaze";
import type { L } from "./i18n";
import type { ZCyl, ZSurf, ZWall, ZoneColliders } from "./zones/types";
import { WAIT_COLLIDERS } from "./zones/waitHall";
import { KEYS_COLLIDERS } from "./zones/keySea";
import { DESERT_COLLIDERS } from "./zones/bronzeDesert";

export type V3 = [number, number, number];
import { normZone, type ZoneId } from "./zoneId";
export { normZone, sameZone, ZONE_WIRE, type ZoneId } from "./zoneId";
export const ZONE_IDS: ZoneId[] = ["hub", "keys", "wait", "desert"];
export type Layer = "disc" | "back" | "draft";

export interface ZoneDef {
  id: ZoneId;
  layer: Layer;
  origin: V3;
  name: L;
  /** khung cục bộ (để vẽ bản đồ / chặn) */
  half: [number, number];
  /** điểm hồi sinh cục bộ (chân) */
  spawn: V3;
  /** rơi dưới mức này → kéo về chỗ đứng an toàn */
  killY: number;
  /** mốc nhìn từ xa (cục bộ) — la bàn */
  landmark: { at: V3; name: L };
}

export const LAYER_NAME: Record<Layer, L> = {
  disc: { vi: "Mặt đĩa", en: "Record face" },
  back: { vi: "Mặt sau", en: "B-side" },
  draft: { vi: "Bản nháp", en: "Rough draft" },
};

export const ZONE_DEFS: Record<ZoneId, ZoneDef> = {
  hub: { id: "hub", layer: "disc", origin: [0, 0, 0], name: { vi: "Mê cung Hoạ âm", en: "Labyrinth of Harmonics" }, half: [80, 80], spawn: [0, 0, 10], killY: -1e9, landmark: { at: [0, 6, 0], name: { vi: "Đấu trường", en: "Arena" } } },
  keys: { id: "keys", layer: "disc", origin: [0, 0, 2000], name: { vi: "Biển Phím Không Bờ", en: "The Shoreless Key Sea" }, half: [55, 35], spawn: [-44, 0, 0], killY: -1.1, landmark: { at: [44, 6, 0], name: { vi: "Đê sứ", en: "Porcelain dike" } } },
  wait: { id: "wait", layer: "draft", origin: [2000, 0, 0], name: { vi: "Phòng Chờ Đến Hôm Qua", en: "The Waiting Room for Yesterday" }, half: [32.5, 25], spawn: [-18, 0, 10], killY: -20, landmark: { at: [0, 8, -19], name: { vi: "Bảng số", en: "Number board" } } },
  desert: { id: "desert", layer: "back", origin: [0, 0, -2000], name: { vi: "Sa Mạc Tấm Đồng", en: "The Bronze-Plate Desert" }, half: [52, 42], spawn: [-44, 0, 8], killY: -6, landmark: { at: [-42, 9, -13], name: { vi: "Đài quan sát", en: "Lookout tower" } } },
};

// ───────────── Cửa ─────────────
export type DoorStyle = "curtain" | "ticket" | "door" | "bronze";
export interface Door {
  id: string;
  zone: ZoneId;
  /** id cửa đối ngẫu */
  to: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  shape: "rect" | "circle";
  /** rect: rộng × cao (đáy ở y) · circle: bán kính r, tâm cao cy */
  w: number;
  h: number;
  r?: number;
  cy?: number;
  style: DoorStyle;
  /** khoá theo cờ ZONE_FLAGS (chỉ khi đi VÀO cửa này) */
  lock?: string;
  name: L;
}
const PI = Math.PI;
export const DOORS: Door[] = [
  // hub ↔ Biển Phím: nếp rèm ở mép Tây Nam sân Vườn Sóng sin (đi về phía Đông)
  { id: "H_keys", zone: "hub", to: "K_hub", x: 8.2, y: 0, z: 47.5, yaw: -PI / 2, shape: "rect", w: 2.6, h: 3.4, style: "curtain", name: { vi: "Biển Phím Không Bờ", en: "Shoreless Key Sea" } },
  { id: "K_hub", zone: "keys", to: "H_keys", x: -48, y: 0, z: 0, yaw: PI / 2, shape: "rect", w: 2.6, h: 3.4, style: "curtain", name: { vi: "Về Mê cung", en: "Back to the Labyrinth" } },
  // Biển Phím ↔ Phòng Chờ: cửa phòng chờ đứng giữa biển, sau đê sứ (khoá: quãng tám)
  { id: "K_wait", zone: "keys", to: "W_keys", x: 48, y: 0, z: 0, yaw: -PI / 2, shape: "rect", w: 2.4, h: 10.5, style: "door", lock: "dike", name: { vi: "Phòng Chờ Đến Hôm Qua", en: "Waiting Room for Yesterday" } },
  { id: "W_keys", zone: "wait", to: "K_wait", x: -22, y: 0, z: 10, yaw: PI / 2, shape: "rect", w: 2.4, h: 10.5, style: "door", name: { vi: "Biển Phím", en: "Key Sea" } },
  // Phòng Chờ ↔ Sa Mạc: lỗ bấm trên tấm vé khổng lồ = miệng cửa ở bờ Tây sa mạc (khoá: BCNN)
  { id: "W_desert", zone: "wait", to: "D_wait", x: 22, y: 0, z: 10, yaw: -PI / 2, shape: "circle", w: 3.4, h: 3.5, r: 1.7, cy: 1.75, style: "ticket", lock: "ticket", name: { vi: "Sa Mạc Tấm Đồng", en: "Bronze-Plate Desert" } },
  { id: "D_wait", zone: "desert", to: "W_desert", x: -47, y: 0, z: 8, yaw: PI / 2, shape: "circle", w: 3.4, h: 3.5, r: 1.7, cy: 1.75, style: "ticket", name: { vi: "Phòng Chờ", en: "Waiting Room" } },
  // Sa Mạc ↔ hub: cửa đồng ở bờ Đông → ra ở tầng Đáy của mê cung (đệm sen Tây Nam, y −16, đi về phía Bắc né miệng lỗ sâu):
  // sa mạc nằm ngay dưới quảng trường
  { id: "D_hub", zone: "desert", to: "H_desert", x: 47, y: 0, z: 12, yaw: 0, shape: "rect", w: 2.4, h: 10.5, style: "bronze", name: { vi: "Đáy Mê cung", en: "Labyrinth floor" } },
  { id: "H_desert", zone: "hub", to: "D_hub", x: -21.5, y: -16, z: 26, yaw: PI, shape: "rect", w: 2.4, h: 10.5, style: "bronze", name: { vi: "Sa Mạc Tấm Đồng", en: "Bronze-Plate Desert" } },
];
export const DOOR_BY_ID: Record<string, Door> = Object.fromEntries(DOORS.map((d) => [d.id, d]));
export const doorsOf = (z: ZoneId) => DOORS.filter((d) => d.zone === z);
export const ZONE_DOORS: Record<ZoneId, Door[]> = { hub: doorsOf("hub"), keys: doorsOf("keys"), wait: doorsOf("wait"), desert: doorsOf("desert") };

/** Cờ mở khoá dùng chung (đê, tấm vé…) — cảnh đặt; va chạm (tường có flag) + cửa có lock đọc */
export const ZONE_FLAGS: Record<string, boolean> = {};
/** Độ lún mặt động theo chỉ số dyn (phím sứ, tấm đồng) — cảnh đặt mỗi khung */
export const ZONE_DYN = new Float32Array(64);

/** Hệ trục cửa: right = up × n = (cos yaw, 0, −sin yaw); n = (sin yaw, 0, cos yaw) */
export function doorLocal(d: Door, x: number, y: number, z: number, out: V3): V3 {
  const s = Math.sin(d.yaw);
  const c = Math.cos(d.yaw);
  const dx = x - d.x;
  const dz = z - d.z;
  out[0] = dx * c - dz * s;
  out[1] = y - d.y;
  out[2] = dx * s + dz * c;
  return out;
}
export function doorWorldLocal(d: Door, lr: number, lu: number, ln: number, out: V3): V3 {
  const s = Math.sin(d.yaw);
  const c = Math.cos(d.yaw);
  out[0] = d.x + lr * c + ln * s;
  out[1] = d.y + lu;
  out[2] = d.z - lr * s + ln * c;
  return out;
}
/** (lr, lu) — lu tính từ đáy cửa — có nằm trong lỗ không (scale < 1 thu hẹp) */
export function inDoor(d: Door, lr: number, lu: number, scale = 1): boolean {
  if (d.shape === "circle") return lr * lr + (lu - (d.cy ?? 0)) ** 2 <= ((d.r ?? 0) * scale) ** 2;
  return Math.abs(lr) <= (d.w / 2) * scale && lu >= -0.6 && lu <= d.h * scale;
}

const LA: V3 = [0, 0, 0];
const LB: V3 = [0, 0, 0];
/** Đoạn a → b (tâm thân, cục bộ khu) có xuyên mặt cửa từ trước ra sau trong lỗ không */
export function doorCrossing(d: Door, a: V3, b: V3): { t: number; lr: number; lu: number } | null {
  const la = doorLocal(d, a[0], a[1], a[2], LA);
  const lb = doorLocal(d, b[0], b[1], b[2], LB);
  if (!(la[2] >= 0 && lb[2] < 0)) return null;
  const t = la[2] / (la[2] - lb[2]);
  const lr = la[0] + (lb[0] - la[0]) * t;
  const lu = la[1] + (lb[1] - la[1]) * t;
  if (!inDoor(d, lr, lu)) return null;
  return { t, lr, lu };
}

/** Góc xoay ngang khi đi src → dst (0 với mọi cặp đã thiết kế) */
export function doorYawDelta(src: Door, dst: Door): number {
  const a = dst.yaw - src.yaw + PI;
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Qua cửa: điểm cục bộ p (đã ở sau mặt src) + vận tốc v → điểm cục bộ ở khu đích (đối xứng gương qua mặt cửa: liên tục),
 * vận tốc xoay Δ quanh y (giữ độ lớn, giữ thành phần đứng), Δ cho máy quay / nhân vật.
 */
export function doorTraverse(src: Door, dst: Door, p: V3, v: V3): { pos: V3; vel: V3; dYaw: number } {
  const l = doorLocal(src, p[0], p[1], p[2], [0, 0, 0]);
  const pos = doorWorldLocal(dst, -l[0], l[1], -l[2], [0, 0, 0]);
  const dYaw = doorYawDelta(src, dst);
  const c = Math.cos(dYaw);
  const s = Math.sin(dYaw);
  // xoay quanh y theo quy ước yaw (hướng (sin, cos)): v' = R(Δ) v
  const vel: V3 = [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  return { pos, vel, dYaw };
}

/** Điểm đặt chân sau khi ra cửa (cục bộ khu đích, chân): cách mặt cửa `ahead` mét theo +n */
export function doorLanding(d: Door, ahead = 1.2): V3 {
  return doorWorldLocal(d, 0, 0, ahead, [0, 0, 0]);
}

// ───────────── Khu ↔ thế giới ─────────────
export const toWorld = (z: ZoneId, l: V3): V3 => {
  const o = ZONE_DEFS[z].origin;
  return [l[0] + o[0], l[1] + o[1], l[2] + o[2]];
};
/** Khu chứa điểm thế giới (x, z): trong 1000 m quanh gốc hub = hub, còn lại = gốc gần nhất */
export function zoneAtWorld(x: number, z: number): ZoneId {
  if (x * x + z * z < 1e6) return "hub";
  let best: ZoneId = "hub";
  let bd = Infinity;
  for (const id of ZONE_IDS) {
    const o = ZONE_DEFS[id].origin;
    const d = (x - o[0]) ** 2 + (z - o[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

// ───────────── Chỉ mục va chạm theo khu (lưới băm) ─────────────
export const ZVOID = -1e4;
export const Z_STEP_UP = 0.8;
export const Z_HEAD = 1.6;
interface Cell {
  s: number[];
  w: number[];
  c: number[];
}
export interface ZoneIndex {
  col: ZoneColliders;
  cell: number;
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cells: Cell[];
}
const EMPTY: Cell = { s: [], w: [], c: [] };

function aabb(o: { kind?: string; x: number; z: number; hx?: number; hz?: number; r?: number; yaw?: number }): [number, number, number, number] {
  if (o.kind === "disc" || (o.r !== undefined && o.hx === undefined)) {
    const r = o.r ?? 0;
    return [o.x - r, o.z - r, o.x + r, o.z + r];
  }
  const c = Math.abs(Math.cos(o.yaw ?? 0));
  const s = Math.abs(Math.sin(o.yaw ?? 0));
  const ex = (o.hx ?? 0) * c + (o.hz ?? 0) * s;
  const ez = (o.hx ?? 0) * s + (o.hz ?? 0) * c;
  return [o.x - ex, o.z - ez, o.x + ex, o.z + ez];
}

/** Dựng lưới băm ô `cell` mét: mỗi ô giữ chỉ số mặt / tường / trụ có hình bao (nới 0,6 m) chạm ô */
export function buildIndex(col: ZoneColliders, cell = 8): ZoneIndex {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const all = [...col.surfs, ...col.walls, ...col.cyls];
  for (const o of all) {
    const b = aabb(o as ZSurf);
    x0 = Math.min(x0, b[0]);
    z0 = Math.min(z0, b[1]);
    x1 = Math.max(x1, b[2]);
    z1 = Math.max(z1, b[3]);
  }
  x0 -= 1;
  z0 -= 1;
  const nx = Math.max(1, Math.ceil((x1 + 1 - x0) / cell));
  const nz = Math.max(1, Math.ceil((z1 + 1 - z0) / cell));
  const cells: Cell[] = Array.from({ length: nx * nz }, () => ({ s: [], w: [], c: [] }));
  const put = (b: [number, number, number, number], key: "s" | "w" | "c", i: number) => {
    const ax = Math.max(0, Math.floor((b[0] - 0.6 - x0) / cell));
    const az = Math.max(0, Math.floor((b[1] - 0.6 - z0) / cell));
    const bx = Math.min(nx - 1, Math.floor((b[2] + 0.6 - x0) / cell));
    const bz = Math.min(nz - 1, Math.floor((b[3] + 0.6 - z0) / cell));
    for (let zz = az; zz <= bz; zz++) for (let xx = ax; xx <= bx; xx++) cells[zz * nx + xx][key].push(i);
  };
  col.surfs.forEach((s, i) => put(aabb(s), "s", i));
  col.walls.forEach((w, i) => put(aabb(w), "w", i));
  col.cyls.forEach((c, i) => put(aabb(c), "c", i));
  return { col, cell, x0, z0, nx, nz, cells };
}
function cellAt(ix: ZoneIndex, x: number, z: number): Cell {
  const cx = Math.floor((x - ix.x0) / ix.cell);
  const cz = Math.floor((z - ix.z0) / ix.cell);
  if (cx < 0 || cz < 0 || cx >= ix.nx || cz >= ix.nz) return EMPTY;
  return ix.cells[cz * ix.nx + cx];
}
const surfTopZ = (s: ZSurf) => (s.dyn !== undefined ? s.y - ZONE_DYN[s.dyn] : s.y);

/** Mặt đất dưới chân (cục bộ): mặt cao nhất có mặt trên ≤ y + Z_STEP_UP; y không truyền → mặt cao nhất (máy quay) */
export function zoneGround(ix: ZoneIndex, x: number, z: number, y?: number): number {
  const cl = cellAt(ix, x, z);
  let best = ZVOID;
  const lim = y === undefined ? Infinity : y + Z_STEP_UP;
  for (let k = 0; k < cl.s.length; k++) {
    const s = ix.col.surfs[cl.s[k]];
    const top = surfTopZ(s);
    if (top > lim || top <= best) continue;
    if (!inFootprint(s, x, z)) continue;
    best = top;
  }
  return best;
}
/** Mặt đang đứng (mặt trên khớp y) — để luật khu biết người chơi đứng trên phím / ô nào */
export function zoneSurfAt(ix: ZoneIndex, x: number, z: number, y: number): ZSurf | null {
  const cl = cellAt(ix, x, z);
  let best: ZSurf | null = null;
  for (let k = 0; k < cl.s.length; k++) {
    const s = ix.col.surfs[cl.s[k]];
    const top = surfTopZ(s);
    if (Math.abs(top - y) > 0.25 || !inFootprint(s, x, z)) continue;
    if (!best || top > surfTopZ(best)) best = s;
  }
  return best;
}
/** Va chạm ngang (cục bộ): tường (trừ tường đã mở cờ), trụ, cạnh dày của mặt cao hơn bậc bước */
export function zoneBlocked(ix: ZoneIndex, x: number, z: number, y: number): boolean {
  const cl = cellAt(ix, x, z);
  for (let k = 0; k < cl.w.length; k++) {
    const w: ZWall = ix.col.walls[cl.w[k]];
    if (w.flag && ZONE_FLAGS[w.flag]) continue;
    if (y + Z_HEAD <= w.y0 || y >= w.y1) continue;
    if (inFootprint({ kind: "box", x: w.x, z: w.z, hx: w.hx, hz: w.hz, yaw: w.yaw }, x, z, 0.35)) return true;
  }
  for (let k = 0; k < cl.c.length; k++) {
    const c: ZCyl = ix.col.cyls[cl.c[k]];
    if (y + Z_HEAD <= c.y0 || y >= c.y1) continue;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.35) ** 2) return true;
  }
  for (let k = 0; k < cl.s.length; k++) {
    const s = ix.col.surfs[cl.s[k]];
    const top = surfTopZ(s);
    if (y >= top - 0.95 || y + Z_HEAD <= top - s.thick) continue;
    if (inFootprint(s, x, z) && !inFootprint(s, x, z, -0.6)) return true;
  }
  return false;
}
/** Bản quét tuyến tính (đối chứng trong test) */
export function zoneGroundLinear(col: ZoneColliders, x: number, z: number, y: number): number {
  let best = ZVOID;
  for (const s of col.surfs) {
    const top = surfTopZ(s);
    if (top > y + Z_STEP_UP || top <= best || !inFootprint(s, x, z)) continue;
    best = top;
  }
  return best;
}

export const ZONE_COLLIDERS: Record<Exclude<ZoneId, "hub">, ZoneColliders> = { keys: KEYS_COLLIDERS, wait: WAIT_COLLIDERS, desert: DESERT_COLLIDERS };
let INDEX: Partial<Record<ZoneId, ZoneIndex>> = {};
/** chỉ mục (dựng lười, giữ mãi — dữ liệu tĩnh) */
export function zoneIndex(z: Exclude<ZoneId, "hub">): ZoneIndex {
  return (INDEX[z] ??= buildIndex(ZONE_COLLIDERS[z]));
}
export function resetZoneIndex() {
  INDEX = {};
}

// ───────────── Streaming ─────────────
/** Cửa có "trong tầm nhìn" không: gần hơn maxDist và trong nón nhìn (cos nửa góc) của máy quay */
export function doorInView(cam: V3, fwd: V3, door: V3, maxDist = 70, cosHalf = 0.5): { dist: number; inView: boolean } {
  const dx = door[0] - cam[0];
  const dy = door[1] - cam[1];
  const dz = door[2] - cam[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist > maxDist) return { dist, inView: false };
  if (dist < 6) return { dist, inView: true };
  const dot = (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / dist;
  return { dist, inView: dot >= cosHalf };
}

/**
 * Quyết định gắn khu (hub luôn gắn sẵn — không nằm trong kết quả):
 *  - khu hiện tại luôn gắn + chạy;
 *  - khu đích của cửa đang trong tầm nhìn → tải trước (gắn ẩn, không chạy);
 *  - giữ tối đa `keep` khu vừa rời trong bộ nhớ (LRU) để chạy qua lại không gắn lại.
 * cache: các khu đang gắn sẵn, mới dùng nhất trước. Trả về danh sách gắn + cache mới.
 */
export function streamPlan(zone: ZoneId, seen: { to: ZoneId; inView: boolean }[], cache: ZoneId[], keep = 2): { mount: ZoneId[]; prefetch: ZoneId[]; cache: ZoneId[] } {
  const prefetch: ZoneId[] = [];
  for (const d of seen) if (d.inView && d.to !== "hub" && d.to !== zone && !prefetch.includes(d.to)) prefetch.push(d.to);
  const nextCache: ZoneId[] = [];
  const push = (z: ZoneId) => {
    if (z !== "hub" && !nextCache.includes(z)) nextCache.push(z);
  };
  push(zone);
  prefetch.forEach(push);
  for (const z of cache) if (nextCache.length < 1 + prefetch.length + keep) push(z);
  return { mount: nextCache.slice(), prefetch, cache: nextCache };
}

// ───────────── Nhiều người chơi ─────────────
/** Số người ở khu bên kia mỗi cửa của khu mình (đặt dấu ở cửa) */
export function doorPeerCounts(mine: ZoneId, peerZones: (string | null | undefined)[], out: Record<string, number> = {}): Record<string, number> {
  for (const d of ZONE_DOORS[mine]) out[d.id] = 0;
  for (const pz of peerZones) {
    const z = normZone(pz);
    if (z === mine) continue;
    for (const d of ZONE_DOORS[mine]) if (DOOR_BY_ID[d.to].zone === z) out[d.id]++;
  }
  return out;
}
/** Đồ thị (cạnh vô hướng giữa các khu) — bản đồ + test liên thông */
export function zoneEdges(): [ZoneId, ZoneId, string][] {
  const out: [ZoneId, ZoneId, string][] = [];
  for (const d of DOORS) {
    const o = DOOR_BY_ID[d.to];
    if (d.id < o.id) out.push([d.zone, o.zone, d.id]);
  }
  return out;
}
