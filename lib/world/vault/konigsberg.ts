/**
 * Hầm Bổ đề · Phòng I — Cầu Königsberg (Euler 1736). Logic thuần (client chơi một mình + server tổ đội).
 *
 * Ý toán: đồ thị liên thông có 2k đỉnh bậc lẻ được phủ bởi đúng k đường đi rời cạnh, không ít hơn (k ≥ 1).
 * → Số đảo lẻ cho biết CẦN BAO NHIÊU người đi và MỖI NGƯỜI PHẢI BẮT ĐẦU Ở ĐÂU.
 *
 * Luật chơi:
 *  - Mọi người xuất phát trên Đài quan sát (cao 9 m), lượn xuống một đảo: đảo đầu tiên đặt chân = điểm đầu sợi chỉ.
 *  - Đi trọn một cây cầu từ đầu sợi chỉ sang đảo bên kia → cầu sáng màu của bạn (đã đi, không đi lại được).
 *    Quay đầu giữa cầu = không tính.
 *  - Hết cầu chưa đi ở đảo đang đứng = "thắt nút" (kẹt) → tua lại: cầu của bạn tắt, bạn về Đài quan sát.
 *  - Xong màn khi MỌI cây cầu đều sáng.
 * Ba màn theo N người: S1 mỗi người một "thị trấn nhỏ" (2 đảo lẻ) · S2 Königsberg 1736 (4 đảo lẻ → 2 sợi chỉ) ·
 * S3 "Đại đồ thị" bánh xe 2N nan → 2N đảo lẻ → đúng N sợi chỉ.
 */
import { clamp, polyDist } from "./geom";

export interface Island {
  x: number;
  z: number;
  r: number;
  /** tên hiển thị (khoá i18n ngắn) */
  name?: string;
}
export interface Bridge {
  a: number;
  b: number;
  /** độ cong ngang (m) ở giữa cầu: ±, cầu song song giữa cùng hai đảo cong về hai phía */
  bend: number;
}
export interface Graph {
  id: string;
  islands: Island[];
  bridges: Bridge[];
  /** tâm Đài quan sát */
  look: { x: number; z: number };
}

export const LOOK_Y = 9;
export const LOOK_R = 3.2;
export const BRIDGE_HALF = 0.85;
export const ARCH = 0.7;
export const FOG_Y = -30;
/** cao hơn mức này (so với mặt đảo) = đang bay / trên đài, không tính là đang ở đảo / trên cầu */
const AIR = 2.6;

// ───────────── Đồ thị theo màn + số người ─────────────

function rot(x: number, z: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - z * s, x * s + z * c];
}

/** Thị trấn nhỏ: hình vuông + 1 đường chéo → bậc 3, 2, 3, 2 (2 đảo lẻ = 1 sợi chỉ, phải bắt đầu ở đảo lẻ) */
function littleTown(g: Graph, cx: number, cz: number, a: number) {
  const base = g.islands.length;
  const H = 5;
  for (const [x, z] of [
    [-H, -H],
    [H, -H],
    [H, H],
    [-H, H],
  ]) {
    const [rx, rz] = rot(x, z, a);
    g.islands.push({ x: cx + rx, z: cz + rz, r: 2.4 });
  }
  for (const [p, q] of [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [0, 2],
  ])
    g.bridges.push({ a: base + p, b: base + q, bend: 0 });
}

/**
 * Königsberg 1736: Kneiphof (A) nối Bờ Bắc (B) 2 cầu, Bờ Nam (C) 2 cầu, Lomse (D) 1 cầu; B–D, C–D mỗi cặp 1 cầu.
 * Bậc A 5 · B 3 · C 3 · D 3 → 4 đảo lẻ. "today" = Kaliningrad ngày nay (5 cầu, bậc 3·2·2·3 → 2 đảo lẻ).
 * side = +1: D ở phía đông của A; −1: phía tây.
 */
function konigsberg(g: Graph, ax: number, side: 1 | -1, today = false) {
  const base = g.islands.length;
  g.islands.push({ x: ax, z: 0, r: 3.4, name: "kneiphof" }, { x: ax, z: -12, r: 4.2, name: "north" }, { x: ax, z: 12, r: 4.2, name: "south" }, { x: ax + side * 12, z: 0, r: 4.2, name: "lomse" });
  const A = base;
  const B = base + 1;
  const C = base + 2;
  const D = base + 3;
  const list: [number, number, number][] = today
    ? [
        [A, B, 0],
        [A, C, 0],
        [A, D, 0],
        [B, D, 0],
        [C, D, 0],
      ]
    : [
        [A, B, 2.4],
        [A, B, -2.4],
        [A, C, 2.4],
        [A, C, -2.4],
        [A, D, 0],
        [B, D, 0],
        [C, D, 0],
      ];
  for (const [a, b, bend] of list) g.bridges.push({ a, b, bend });
}

/** Bánh xe: đảo trung tâm (bậc 2m, chẵn) + vòng m đảo (bậc 3, lẻ) → m đảo lẻ */
function wheel(g: Graph, m: number) {
  const R = m >= 8 ? 14.5 : m >= 6 ? 12.5 : 11;
  g.islands.push({ x: 0, z: 0, r: m >= 6 ? 4.5 : 3.6, name: "hub" });
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 - Math.PI / 2;
    g.islands.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, r: 2.8 });
  }
  for (let i = 0; i < m; i++) {
    const p = 1 + i;
    const q = 1 + ((i + 1) % m);
    // vành: cong ra ngoài (chọn dấu theo hướng tâm → trung điểm)
    const A = g.islands[p];
    const B = g.islands[q];
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const out = -dz * (A.x + B.x) + dx * (A.z + B.z) > 0 ? 1 : -1;
    g.bridges.push({ a: p, b: q, bend: 1.6 * out });
  }
  for (let i = 0; i < m; i++) g.bridges.push({ a: 0, b: 1 + i, bend: 0 });
}

const CACHE = new Map<string, Graph>();

/** id = "k<stage>n<N>" — client dựng lại đồ thị từ id gửi qua mạng */
export function graphById(id: string): Graph {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const m = /^k(\d)n(\d)$/.exec(id);
  const stage = m ? Number(m[1]) : 0;
  const n = m ? clamp(Number(m[2]), 2, 4) : 2;
  const g: Graph = { id, islands: [], bridges: [], look: { x: 0, z: 0 } };
  if (stage === 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (n === 2 ? 0 : Math.PI / 4);
      littleTown(g, Math.cos(a) * 17, Math.sin(a) * 17, a);
    }
  } else if (stage === 1) {
    if (n === 2) konigsberg(g, 9, 1);
    else {
      konigsberg(g, -9, -1, n === 3);
      konigsberg(g, 9, 1);
    }
  } else wheel(g, 2 * n);
  CACHE.set(id, g);
  return g;
}
export const graphFor = (stage: number, n: number) => graphById(`k${stage}n${clamp(n, 2, 4)}`);
export const K_STAGES = 3;

export function degrees(g: Graph): number[] {
  const d = g.islands.map(() => 0);
  for (const b of g.bridges) {
    d[b.a]++;
    d[b.b]++;
  }
  return d;
}
export function oddVertices(g: Graph): number[] {
  return degrees(g)
    .map((d, i) => (d % 2 ? i : -1))
    .filter((i) => i >= 0);
}
/** Thành phần liên thông (chỉ tính đảo có cầu) */
export function components(g: Graph): number[][] {
  const seen = new Set<number>();
  const adj = g.islands.map(() => [] as number[]);
  for (const b of g.bridges) {
    adj[b.a].push(b.b);
    adj[b.b].push(b.a);
  }
  const out: number[][] = [];
  for (let s = 0; s < g.islands.length; s++) {
    if (seen.has(s) || !adj[s].length) continue;
    const comp: number[] = [];
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const v = stack.pop()!;
      comp.push(v);
      for (const w of adj[v])
        if (!seen.has(w)) {
          seen.add(w);
          stack.push(w);
        }
    }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}
/** Số sợi chỉ (đường đi rời cạnh) tối thiểu phủ hết cầu = Σ theo thành phần max(1, số đảo lẻ / 2) */
export function minTrails(g: Graph): number {
  const deg = degrees(g);
  return components(g).reduce((s, c) => s + Math.max(1, c.filter((v) => deg[v] % 2).length / 2), 0);
}

// ───────────── Hình học cầu (dùng chung cho vẽ, mặt đất, va chạm, phát hiện đi qua cầu) ─────────────

export interface BridgeGeo {
  /** đường cong Bézier bậc 2 lấy mẫu 17 điểm (x, z) từ tâm đảo a tới tâm đảo b */
  pts: number[];
  /** tham số t nơi cầu rời đảo a / chạm đảo b (mặt cầu cao 0 ở đó) */
  t0: number;
  t1: number;
  len: number;
}
const GEO = new Map<string, BridgeGeo[]>();
export const SAMPLES = 16;
export function bridgeGeos(g: Graph): BridgeGeo[] {
  const hit = GEO.get(g.id);
  if (hit) return hit;
  const out = g.bridges.map((b) => {
    const A = g.islands[b.a];
    const B = g.islands[b.b];
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const L = Math.hypot(dx, dz) || 1;
    const cx = (A.x + B.x) / 2 + (-dz / L) * b.bend * 2;
    const cz = (A.z + B.z) / 2 + (dx / L) * b.bend * 2;
    const pts: number[] = [];
    let len = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const u = 1 - t;
      const x = u * u * A.x + 2 * u * t * cx + t * t * B.x;
      const z = u * u * A.z + 2 * u * t * cz + t * t * B.z;
      if (i) len += Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]);
      pts.push(x, z);
    }
    // t0/t1: điểm mẫu đầu tiên ra khỏi đảo (nội suy tuyến tính trong đoạn)
    const exitT = (I: Island, fromEnd: boolean) => {
      for (let k = 0; k < SAMPLES; k++) {
        const i0 = fromEnd ? SAMPLES - k : k;
        const i1 = fromEnd ? i0 - 1 : i0 + 1;
        const d0 = Math.hypot(pts[i0 * 2] - I.x, pts[i0 * 2 + 1] - I.z);
        const d1 = Math.hypot(pts[i1 * 2] - I.x, pts[i1 * 2 + 1] - I.z);
        if (d1 >= I.r) {
          const f = d1 > d0 ? clamp((I.r - d0) / (d1 - d0), 0, 1) : 0;
          return (i0 + (i1 - i0) * f) / SAMPLES;
        }
      }
      return fromEnd ? 0.6 : 0.4;
    };
    return { pts, t0: exitT(A, false), t1: exitT(B, true), len };
  });
  GEO.set(g.id, out);
  return out;
}
/** Độ cao mặt cầu tại tham số t (vòm sin, 0 ở hai mép đảo) */
export function deckY(geo: BridgeGeo, t: number): number {
  const u = clamp((t - geo.t0) / Math.max(1e-3, geo.t1 - geo.t0), 0, 1);
  return ARCH * Math.sin(Math.PI * u);
}

export type Loc = { k: "island"; i: number } | { k: "bridge"; e: number; t: number } | { k: "look" } | { k: "air" } | { k: "fog" };

/** Người / bạn đồng hành đang ở đâu (đảo, cầu, đài, trên không, rơi xuống sương) */
export function locate(g: Graph, x: number, y: number, z: number): Loc {
  if (y > LOOK_Y - 1.5 && Math.hypot(x - g.look.x, z - g.look.z) < LOOK_R + 0.4) return { k: "look" };
  if (y > AIR) return { k: "air" };
  for (let i = 0; i < g.islands.length; i++) {
    const I = g.islands[i];
    if (Math.hypot(x - I.x, z - I.z) < I.r) return { k: "island", i };
  }
  const geos = bridgeGeos(g);
  for (let e = 0; e < geos.length; e++) {
    const r = polyDist(x, z, geos[e].pts);
    if (r.d < BRIDGE_HALF + 0.15) return { k: "bridge", e, t: r.t };
  }
  return { k: "fog" };
}

/** Mặt đất cao nhất dưới chân (y hiện tại để biết có đang ở trên đài không) */
export function kGround(g: Graph, x: number, z: number, y = 0): number {
  if (y >= LOOK_Y - 1.6 && Math.hypot(x - g.look.x, z - g.look.z) < LOOK_R) return LOOK_Y;
  for (const I of g.islands) if (Math.hypot(x - I.x, z - I.z) < I.r) return 0;
  const geos = bridgeGeos(g);
  for (const geo of geos) {
    const r = polyDist(x, z, geo.pts);
    if (r.d < BRIDGE_HALF) return deckY(geo, r.t);
  }
  return FOG_Y;
}

/** Va chạm: ở tầm đảo thì không được bước ra sương, không bước lên cầu đã sáng; trên cao (đài, đang lượn) thì tự do */
export function kBlocked(g: Graph, lit: number[], x: number, z: number, y: number): boolean {
  if (y > AIR + 0.4) return Math.hypot(x - g.look.x, z - g.look.z) > 70;
  for (const I of g.islands) if (Math.hypot(x - I.x, z - I.z) < I.r - 0.15) return false;
  const geos = bridgeGeos(g);
  for (let e = 0; e < geos.length; e++) {
    const r = polyDist(x, z, geos[e].pts);
    if (r.d < BRIDGE_HALF - 0.1) return lit[e] >= 0;
  }
  return true;
}

// ───────────── Trạng thái màn (server quyết) ─────────────

/** Sợi chỉ của một ghế: s đầu sợi, a đảo cuối sợi, l đảo vừa đứng, o cầu đang đứng trên (−1 không), e các cầu đã đi */
export interface Trail {
  s: number;
  a: number;
  l: number;
  o: number;
  e: number[];
}
export interface KState {
  g: string;
  lit: number[];
  tr: Trail[];
  /** số lần tua lại (đếm "thử") */
  rew: number;
}
const emptyTrail = (): Trail => ({ s: -1, a: -1, l: -1, o: -1, e: [] });

export function kInit(stage: number, n: number): KState {
  const g = graphFor(stage, n);
  return { g: g.id, lit: g.bridges.map(() => -1), tr: Array.from({ length: n }, emptyTrail), rew: 0 };
}

/**
 * Cập nhật một ghế từ vị trí mới (10 Hz). Trả về chỉ số cầu vừa sáng (−1 nếu không).
 * Đi qua cầu = hai lần đứng đảo liên tiếp khác nhau (l → i) và ở giữa đứng trên cầu nối hai đảo đó.
 */
export function kStep(st: KState, seat: number, x: number, y: number, z: number): number {
  const g = graphById(st.g);
  const t = st.tr[seat];
  if (!t) return -1;
  const loc = locate(g, x, y, z);
  if (loc.k === "bridge") {
    t.o = loc.e;
    return -1;
  }
  if (loc.k !== "island") return -1;
  const i = loc.i;
  let lit = -1;
  if (t.a < 0) {
    // lần đầu đặt chân xuống đảo = đầu sợi chỉ
    t.s = t.a = i;
  } else if (i !== t.l && t.l >= 0) {
    const b = t.o >= 0 ? g.bridges[t.o] : null;
    const crossed = !!b && ((b.a === t.l && b.b === i) || (b.b === t.l && b.a === i));
    if (crossed && t.l === t.a && st.lit[t.o] < 0) {
      st.lit[t.o] = seat;
      t.e.push(t.o);
      t.a = i;
      lit = t.o;
    } else if (!t.e.length) {
      // chưa đi cầu nào → đổi điểm đầu (vd. lượn sang đảo khác)
      t.s = t.a = i;
    }
  } else if (t.l < 0 && !t.e.length) t.s = t.a = i;
  t.l = i;
  t.o = -1;
  return lit;
}

/** Tua lại: cầu của ghế này tắt, sợi chỉ xoá (người chơi về Đài quan sát) */
export function kRewind(st: KState, seat: number) {
  const t = st.tr[seat];
  if (!t) return;
  for (const e of t.e) if (st.lit[e] === seat) st.lit[e] = -1;
  st.tr[seat] = emptyTrail();
  st.rew++;
}

/** Thắt nút: đã có sợi chỉ, đứng đúng ở cuối sợi chỉ mà không còn cầu chưa đi nào chạm đảo này */
export function kStuck(st: KState, seat: number): boolean {
  const t = st.tr[seat];
  if (!t || t.a < 0 || !t.e.length || kClear(st)) return false;
  const g = graphById(st.g);
  if (g.bridges.some((b, e) => st.lit[e] < 0 && (b.a === t.a || b.b === t.a))) return false;
  // hết cầu ở đây nhưng cả thành phần (thị trấn / thành phố) đã sáng hết = sợi chỉ HOÀN THÀNH, không phải nút thắt
  const comp = components(g).find((c) => c.includes(t.a)) ?? [];
  return g.bridges.some((b, e) => st.lit[e] < 0 && comp.includes(b.a));
}
export const kClear = (st: KState) => st.lit.every((s) => s >= 0);
export const kProgress = (st: KState) => st.lit.filter((s) => s >= 0).length / Math.max(1, st.lit.length);
