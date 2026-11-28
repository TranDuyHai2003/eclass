/**
 * W5 + W6 — KHUNG CẤU TRÚC tất định của Vùng Kỳ quan (VOXEL_WORLD §1.5, kiểu `structure_starts` của Minecraft).
 *
 * Hai tầng đặt:
 *  • theo VÙNG 192 m: mỗi vùng tối đa MỘT công trình lớn (tâm lệch ngẫu nhiên có hạt, nằm gọn trong vùng):
 *      – Đảo Phyllotaxis (đảo nổi, góc vàng 137,5°, r = c·√n),
 *      – Rừng Đồ thị (cây nhị phân L-system nối bằng cầu theo CÂY KHUNG NHỎ NHẤT — Kruskal),
 *      – Tàn tích WFC (mê cung 9×9 ô sinh bằng Wave Function Collapse);
 *  • theo CHUNK 32 m: cây L-system theo biome + miệng hang (bậc thang đi bộ xuống một khoang).
 * Mỗi chunk chỉ hỏi "công trình nào ở 3×3 vùng / 3×3 chunk quanh tôi chạm hộp bao của tôi?" rồi ghi phần bị cắt của nó → O(1),
 * xuyên biên chunk mà vẫn tất định. Khối của mỗi công trình được cache (LRU đơn giản).
 * Khối trả về dạng phẳng [x, y, z, mã, …]; mã = id + FORCE (256) nếu được ĐÈ lên địa hình, không thì chỉ ghi vào ô trống.
 */
import { B } from "./blocks";
import { CAVE_FLOOR, caveMask, hash3 } from "./density";
import { SPECIES, growTree } from "./lsystem";
import { CHUNK, WATER_LEVEL, biome, blockTop, chunkTrees, chunkWonder, hash2, mathBiome } from "./terrain";
import { DE, DN, DS, DW, mulberry32, wfcMaze } from "./wfc";

export const FORCE = 256;
export const REGION = 192;
export type StructKind = "isles" | "forest" | "maze";
export type Structure = {
  kind: StructKind;
  ri: number;
  rj: number;
  /** tâm (ô nguyên) */
  x: number;
  z: number;
  /** hộp bao (bao gồm) */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** chỗ đặt biển báo */
  sign: [number, number, number];
};

/** Tên + công thức cho biển báo (giống BiomeSigns) */
export const STRUCT_INFO: Record<StructKind | "grotto", { vi: string; en: string; formula: string }> = {
  isles: { vi: "Đảo Phyllotaxis", en: "Phyllotaxis Isles", formula: "θₙ = n·137,5°, rₙ = c·√n · đảo số Fibonacci thẳng hàng" },
  forest: { vi: "Rừng Đồ thị", en: "Graph Forest", formula: "n cây, n − 1 cầu = cây khung nhỏ nhất (Kruskal) · cầu dây tạo chu trình" },
  maze: { vi: "Tàn tích WFC", en: "WFC Ruins", formula: "chọn ô ít khả năng nhất → sụp → lan ràng buộc" },
  grotto: { vi: "Hang động", en: "Grotto", formula: "rỗng khi nhiễu 3D < ngưỡng" },
};

// ───────────── tiện ích chung ─────────────
const RADIUS: Record<StructKind, number> = { isles: 50, forest: 42, maze: 16 };
/** Điểm cố định gần điểm xuất phát (bảo đảm tìm thấy) — tâm đã kiểm tra hợp lệ bằng test */
const FIXED: Record<string, { kind: StructKind; x: number; z: number }> = {
  "0,0": { kind: "forest", x: 120, z: 50 },
  "-1,0": { kind: "maze", x: -92, z: 92 },
  "-1,-1": { kind: "isles", x: -98, z: -98 },
};

/** Vùng giữ trống quanh điểm xuất phát (cổng, Lò Ma trận, Totem, song sinh, Ouroboros…) */
const KEEP_CLEAR: { x: number; z: number; r: number }[] = [
  { x: 0, z: 0, r: 14 },
  { x: -6.5, z: 12.5, r: 9 }, // Lò rèn Ma trận (−10, 9) 7×7
  { x: 16.5, z: 4.5, r: 15 }, // Totem Đối xứng r = 12
  { x: 10, z: -12, r: 3.5 },
  { x: 14, z: -12, r: 3.5 },
  { x: 6, z: -10, r: 4 },
];
export function inKeepClear(x: number, z: number, pad = 0): boolean {
  for (const k of KEEP_CLEAR) {
    const dx = x - k.x;
    const dz = z - k.z;
    if (dx * dx + dz * dz < (k.r + pad) * (k.r + pad)) return true;
  }
  return false;
}

function wonderIn(x0: number, z0: number, x1: number, z1: number): boolean {
  for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++)
    for (let cz = Math.floor(z0 / CHUNK); cz <= Math.floor(z1 / CHUNK); cz++) {
      const w = chunkWonder(cx, cz);
      if (w && w.x >= x0 && w.x <= x1 && w.z >= z0 && w.z <= z1) return true;
    }
  return false;
}

/** "Góc kim cương" ∈ [0, 4): đơn điệu theo góc thật, chỉ dùng + − × ÷ (thay atan2) */
export function diamondAngle(dx: number, dz: number): number {
  if (dz >= 0) return dx >= 0 ? dz / (dx + dz || 1) : 1 - dx / (-dx + dz);
  return dx < 0 ? 2 - dz / (-dx - dz) : 3 + dx / (dx - dz);
}
/** 8 cung (mỗi cung 0,5 "góc kim cương") */
export const sectorOf = (dx: number, dz: number) => Math.min(7, Math.floor(diamondAngle(dx, dz) * 2));

class Out {
  a: number[] = [];
  add(x: number, y: number, z: number, id: number, force = false) {
    this.a.push(x, y, z, id + (force ? FORCE : 0));
  }
  done() {
    return new Int32Array(this.a);
  }
}

/**
 * Cầu thang xoắn quanh một trụ tại (cx, cz): bậc k ở cao độ yBase + k, nằm trong cung (sLast − (K−1−k)) mod 8, bán kính 1…3.
 * Bậc cuối có mặt trên = yTop và nằm ở cung `sLast`. Hai cung ngay trước đó cần trống ở tầng yTop − 1 (khoảng đầu) → `holes`.
 * Bậc nào cũng kề MẶT với bậc sau và cao hơn đúng 1 khối → người chơi bước lên được (leo 1 khối).
 */
export function helixStair(o: Out, cx: number, cz: number, yBase: number, yTop: number, sLast: number, pillar: number, step: number) {
  const K = yTop - yBase;
  for (let y = yBase; y < yTop; y++) o.add(cx, y, cz, pillar, true);
  for (let k = 0; k < K; k++) {
    const sec = (((sLast - (K - 1 - k)) % 8) + 8) % 8;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const r2 = dx * dx + dz * dz;
        if (r2 < 1 || r2 > 10 || sectorOf(dx, dz) !== sec) continue;
        o.add(cx + dx, yBase + k, cz + dz, step, true);
        // khoảng đầu 3 khối phía trên bậc (xoá đất / lá cản)
        for (let h = 1; h <= 3 && yBase + k + h < yTop; h++) o.add(cx + dx, yBase + k + h, cz + dz, B.air, true);
      }
  }
  return [((sLast - 1) % 8 + 8) % 8, ((sLast - 2) % 8 + 8) % 8];
}

// ───────────── vùng 192 m: chọn công trình ─────────────
const REGION_CACHE = new Map<number, Structure | null>();
const rkey = (ri: number, rj: number) => (ri + 32768) * 65536 + (rj + 32768);

export function regionStructure(ri: number, rj: number): Structure | null {
  const k = rkey(ri, rj);
  const hit = REGION_CACHE.get(k);
  if (hit !== undefined) return hit;
  const s = pickRegion(ri, rj);
  REGION_CACHE.set(k, s);
  return s;
}

function pickRegion(ri: number, rj: number): Structure | null {
  const fixed = FIXED[`${ri},${rj}`];
  let kind: StructKind | null;
  let x: number;
  let z: number;
  if (fixed) ({ kind, x, z } = fixed);
  else {
    const h = hash2(ri, rj, 8101);
    kind = h < 0.16 ? "isles" : h < 0.46 ? "forest" : h < 0.76 ? "maze" : null;
    if (!kind) return null;
    const R = RADIUS[kind];
    const span = REGION - 2 * R - 8;
    x = Math.floor((ri + 0.5) * REGION + (hash2(ri, rj, 8111) - 0.5) * span);
    z = Math.floor((rj + 0.5) * REGION + (hash2(ri, rj, 8117) - 0.5) * span);
    if (x * x + z * z < (110 + R) * (110 + R)) return null;
  }
  return makeStructure(kind, ri, rj, x, z);
}

/** Kiểm tra chỗ đặt + dựng mô tả công trình; null nếu không hợp lệ (biome toán, nước, dốc, đè kỳ quan…) */
export function makeStructure(kind: StructKind, ri: number, rj: number, x: number, z: number): Structure | null {
  const R = RADIUS[kind];
  // hộp bao phải chứa MỌI khối của công trình (mê cung: thêm dốc 8 ô phía nam lối vào)
  const base = { kind, ri, rj, x, z, x0: x - R, z0: z - R, x1: x + R, z1: z + R + (kind === "maze" ? 8 : 0) };
  if (kind === "maze") {
    if (wonderIn(x - R - 8, z - R - 8, x + R + 8, z + R + 16)) return null;
    for (const [a, b] of [[0, 0], [-R, -R], [R, -R], [-R, R], [R, R]]) if (mathBiome(x + a, z + b)) return null;
    let lo = 1e9;
    let hi = -1e9;
    for (let dz = -R; dz <= R; dz += 4)
      for (let dx = -R; dx <= R; dx += 4) {
        const t = blockTop(x + dx, z + dz);
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
    if (hi - lo > 5 || lo < WATER_LEVEL + 1.5) return null;
    return { ...base, sign: [x, hi + 6, z + 15] };
  }
  if (kind === "forest") {
    if (mathBiome(x, z)) return null;
    const f = forestLayout(base as Structure);
    if (!f) return null;
    return { ...base, sign: [x, f.deckY + 13, z] };
  }
  const il = islesLayout(base as Structure);
  return { ...base, sign: [x, il.y0 + 7, z] };
}

/** Các công trình vùng có hộp bao chạm hình chữ nhật [x0, x1] × [z0, z1] */
export function structuresIn(x0: number, z0: number, x1: number, z1: number): Structure[] {
  const out: Structure[] = [];
  for (let ri = Math.floor((x0 - 60) / REGION); ri <= Math.floor((x1 + 60) / REGION); ri++)
    for (let rj = Math.floor((z0 - 60) / REGION); rj <= Math.floor((z1 + 60) / REGION); rj++) {
      const s = regionStructure(ri, rj);
      if (s && s.x1 >= x0 && s.x0 <= x1 && s.z1 >= z0 && s.z0 <= z1) out.push(s);
    }
  return out;
}

// ───────────── Đảo Phyllotaxis ─────────────
/** cos / sin của góc vàng 137,50776…° — quay bằng phép nhân (khỏi gọi lượng giác) */
const GA_C = -0.7373688780783197;
const GA_S = 0.6754902942615238;
export const ISLE_C = 5;
export const ISLE_N = 55;
const FIB = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55]);
export type Isle = { n: number; x: number; z: number; r: number; top: number };

export function islesLayout(s: Structure): { y0: number; isles: Isle[]; stair: { x: number; z: number; base: number; top: number; sLast: number } } {
  let hi = -1e9;
  for (let dz = -48; dz <= 48; dz += 6)
    for (let dx = -48; dx <= 48; dx += 6) if (dx * dx + dz * dz <= 48 * 48) hi = Math.max(hi, blockTop(s.x + dx, s.z + dz));
  const y0 = Math.max(22, hi + 16);
  const isles: Isle[] = [];
  let u = 1;
  let v = 0;
  for (let n = 0; n <= ISLE_N; n++) {
    const rr = ISLE_C * Math.sqrt(n);
    isles.push({ n, x: s.x + 0.5 + rr * u, z: s.z + 0.5 + rr * v, r: n === 0 ? 3.6 : 3.3 + 0.4 * hash2(n, s.ri * 31 + s.rj, 61), top: y0 - Math.floor(0.8 * Math.sqrt(n)) });
    const nu = GA_C * u - GA_S * v;
    v = GA_S * u + GA_C * v;
    u = nu;
  }
  // cầu thang ở mép ngoài, ngay cạnh đảo cuối (thấp nhất) → nhảy dần vào tâm (cao dần)
  const last = isles[ISLE_N];
  const dx = last.x - (s.x + 0.5);
  const dz = last.z - (s.z + 0.5);
  const len = Math.sqrt(dx * dx + dz * dz);
  const sx = Math.floor(last.x + (dx / len) * (last.r + 3.6));
  const sz = Math.floor(last.z + (dz / len) * (last.r + 3.6));
  let base = -1e9;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) base = Math.max(base, blockTop(sx + a, sz + b));
  return { y0, isles, stair: { x: sx, z: sz, base, top: last.top, sLast: sectorOf(-dx, -dz) } };
}

function islesBlocks(s: Structure): Int32Array {
  const L = islesLayout(s);
  const o = new Out();
  for (const is of L.isles) {
    const R = Math.ceil(is.r);
    const ix = Math.floor(is.x);
    const iz = Math.floor(is.z);
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const x = ix + dx;
        const z = iz + dz;
        const ex = x + 0.5 - is.x;
        const ez = z + 0.5 - is.z;
        const d2 = ex * ex + ez * ez;
        if (d2 > is.r * is.r) continue;
        // mặt đảo tô theo HỌ XOẮN n mod 8 (xen hồng / xanh) → nhìn từ trên thấy 8 cánh xoắn của hoa hướng dương
        o.add(x, is.top - 1, z, is.n > 0 && (is.n % 8) % 2 === 1 ? B.blossom : B.grass);
        const depth = 1 + Math.floor((is.r - Math.sqrt(d2)) * 1.3 + hash2(x, z, 63) * 1.5);
        for (let k = 1; k <= depth; k++) o.add(x, is.top - 1 - k, z, k <= 2 ? B.dirt : B.stone);
      }
  }
  // ngọn hải đăng pha lê trên đảo tâm; đảo số Fibonacci có cột vàng (các số Fibonacci lớn gần một tia — vì Fₖ·137,5° ≈ bội 360°)
  const c = L.isles[0];
  for (let k = 0; k < 3; k++) o.add(Math.floor(c.x), c.top + k, Math.floor(c.z), B.crystal);
  for (const is of L.isles) if (FIB.has(is.n)) for (let k = 0; k < 2; k++) o.add(Math.floor(is.x), is.top + k, Math.floor(is.z), B.gold);
  const st = L.stair;
  if (st.top > st.base) helixStair(o, st.x, st.z, st.base, st.top, st.sLast, B.wood, B.plank);
  return o.done();
}

// ───────────── Rừng Đồ thị ─────────────
export type ForestLayout = { deckY: number; nodes: { x: number; z: number; top: number }[]; edges: { a: number; b: number; mst: boolean }[]; stairNode: number; sLast: number };
const FOREST_CACHE = new Map<string, ForestLayout | null>();
/** khoá cache theo TÂM công trình (một vùng có thể được thử nhiều tâm khi tìm chỗ đặt cố định) */
const skey = (s: Structure) => `${s.kind}${s.x},${s.z}`;

export function forestLayout(s: Structure): ForestLayout | null {
  const k = skey(s);
  const hit = FOREST_CACHE.get(k);
  if (hit !== undefined) return hit;
  const rand = mulberry32((Math.imul(s.ri, 73856093) ^ Math.imul(s.rj, 19349663)) >>> 0);
  // kỳ quan trong vùng: không đặt cây sát, không bắc cầu xuyên qua
  const wonders: { x: number; z: number }[] = [];
  for (let cx = Math.floor((s.x - 50) / CHUNK); cx <= Math.floor((s.x + 50) / CHUNK); cx++)
    for (let cz = Math.floor((s.z - 50) / CHUNK); cz <= Math.floor((s.z + 50) / CHUNK); cz++) {
      const w = chunkWonder(cx, cz);
      if (w) wonders.push(w);
    }
  // Poisson đĩa (ném phi tiêu): khoảng cách tối thiểu 9,5 m, trong bán kính 30 m
  const nodes: { x: number; z: number; top: number }[] = [];
  for (let t = 0; t < 400 && nodes.length < 11; t++) {
    const x = Math.floor(s.x + (rand() - 0.5) * 60);
    const z = Math.floor(s.z + (rand() - 0.5) * 60);
    if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) > 30 * 30) continue;
    if (nodes.some((p) => (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < 9.5 * 9.5)) continue;
    const top = blockTop(x, z);
    if (top < WATER_LEVEL + 1.5 || mathBiome(x, z)) continue;
    if (wonders.some((w) => (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z) < 14 * 14)) continue;
    nodes.push({ x, z, top });
  }
  if (nodes.length < 6) {
    FOREST_CACHE.set(k, null);
    return null;
  }
  const deckY = Math.max(...nodes.map((p) => p.top)) + 6;
  // Kruskal: mọi cặp, xếp theo độ dài² (hoà → theo chỉ số) + hợp-tìm
  const all: { a: number; b: number; d: number }[] = [];
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      const dx = nodes[a].x - nodes[b].x;
      const dz = nodes[a].z - nodes[b].z;
      const L2 = dx * dx + dz * dz;
      // cầu không xuyên qua kỳ quan (khoảng cách từ tâm kỳ quan tới đoạn thẳng ≥ 8 m)
      const hitsWonder = wonders.some((w) => {
        const px = w.x - nodes[b].x;
        const pz = w.z - nodes[b].z;
        const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / L2));
        const qx = px - t * dx;
        const qz = pz - t * dz;
        return qx * qx + qz * qz < 64;
      });
      if (!hitsWonder) all.push({ a, b, d: L2 });
    }
  all.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const edges: { a: number; b: number; mst: boolean }[] = [];
  let maxMst = 0;
  const rest: typeof all = [];
  for (const e of all) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) {
      parent[ra] = rb;
      edges.push({ a: e.a, b: e.b, mst: true });
      maxMst = Math.max(maxMst, e.d);
    } else rest.push(e);
  }
  if (edges.length < nodes.length - 1) {
    FOREST_CACHE.set(k, null); // không liên thông được (kỳ quan chắn) → bỏ
    return null;
  }
  // vài cạnh ngoài cây khung (ngắn) → chu trình, làm bằng dây
  for (const e of rest) {
    if (edges.length >= nodes.length + 1) break;
    if (e.d <= maxMst * 2.2) edges.push({ a: e.a, b: e.b, mst: false });
  }
  // cầu thang ở nút bậc thấp nhất (hoà → thấp nhất), hướng bậc cuối tránh các cầu
  const deg = nodes.map((_, i) => edges.filter((e) => e.a === i || e.b === i).length);
  let stairNode = 0;
  for (let i = 1; i < nodes.length; i++) if (deg[i] < deg[stairNode] || (deg[i] === deg[stairNode] && nodes[i].top < nodes[stairNode].top)) stairNode = i;
  const used = new Set<number>();
  for (const e of edges) {
    if (e.a !== stairNode && e.b !== stairNode) continue;
    const o = nodes[e.a === stairNode ? e.b : e.a];
    used.add(sectorOf(o.x - nodes[stairNode].x, o.z - nodes[stairNode].z));
  }
  const near = (sec: number) => used.has(sec) || used.has((sec + 1) % 8) || used.has((sec + 7) % 8);
  let sLast = 0;
  for (let s2 = 0; s2 < 8; s2++)
    if (!near((s2 + 7) % 8) && !near((s2 + 6) % 8)) {
      sLast = s2;
      break;
    }
  const out = { deckY, nodes, edges, stairNode, sLast };
  FOREST_CACHE.set(k, out);
  return out;
}

function forestBlocks(s: Structure): Int32Array {
  const F = forestLayout(s)!;
  const o = new Out();
  const { deckY, nodes } = F;
  const st = nodes[F.stairNode];
  let stBase = -1e9;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) stBase = Math.max(stBase, blockTop(st.x + a, st.z + b));
  const holes = helixStair(o, st.x, st.z, stBase, deckY, F.sLast, B.wood, B.plank);
  const isHole = (x: number, z: number) => {
    const dx = x - st.x;
    const dz = z - st.z;
    const r2 = dx * dx + dz * dz;
    return r2 >= 1 && r2 <= 12 && holes.includes(sectorOf(dx, dz));
  };
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    // thân thẳng tới sàn rồi tán cây NHỊ PHÂN độ sâu 5
    for (let y = p.top; y <= deckY + 1; y++) o.add(p.x, y, p.z, B.wood, i === F.stairNode);
    const crown = growTree(SPECIES.binary, p.x, deckY + 2, p.z, (i * 3) & 7, 0.9);
    for (let q = 0; q < crown.length; q += 4) o.add(crown[q], crown[q + 1], crown[q + 2], crown[q + 3]);
    // sàn tròn quanh thân
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const r2 = dx * dx + dz * dz;
        if (r2 === 0 || r2 > 7) continue;
        if (i === F.stairNode && isHole(p.x + dx, p.z + dz)) continue;
        o.add(p.x + dx, deckY - 1, p.z + dz, B.plank);
      }
  }
  // cầu: ô cách đoạn thẳng nối hai thân ≤ 1 m; cọc dây mỗi 3 m hai bên
  for (const e of F.edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const ax = a.x + 0.5;
    const az = a.z + 0.5;
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const L2 = vx * vx + vz * vz;
    const len = Math.sqrt(L2);
    for (let z = Math.min(a.z, b.z) - 2; z <= Math.max(a.z, b.z) + 2; z++)
      for (let x = Math.min(a.x, b.x) - 2; x <= Math.max(a.x, b.x) + 2; x++) {
        const px = x + 0.5 - ax;
        const pz = z + 0.5 - az;
        const t = (px * vx + pz * vz) / L2;
        if (t < 0 || t > 1) continue;
        const qx = px - t * vx;
        const qz = pz - t * vz;
        const d2 = qx * qx + qz * qz;
        if (isHole(x, z)) continue;
        if (d2 <= 1.0) o.add(x, deckY - 1, z, e.mst ? B.plank : B.rope);
        else if (d2 <= 2.4 && Math.floor(t * len) % 3 === 0 && t * len > 3 && (1 - t) * len > 3) o.add(x, deckY, z, e.mst ? B.wood : B.rope);
      }
  }
  return o.done();
}

// ───────────── Tàn tích WFC ─────────────
export const MAZE_TILES = 9;
export const MAZE_CELL = 3;
const MAZE_CACHE = new Map<string, ReturnType<typeof wfcMaze>>();
export function mazeOf(s: Structure) {
  const k = skey(s);
  let m = MAZE_CACHE.get(k);
  if (!m) {
    m = wfcMaze(MAZE_TILES, MAZE_TILES, (Math.imul(s.ri, 2654435761) ^ Math.imul(s.rj, 40503) ^ 0x5eed) >>> 0);
    MAZE_CACHE.set(k, m);
  }
  return m;
}

function mazeBlocks(s: Structure): Int32Array {
  const M = mazeOf(s);
  const size = MAZE_TILES * MAZE_CELL;
  const x0 = s.x - Math.floor(size / 2);
  const z0 = s.z - Math.floor(size / 2);
  let sum = 0;
  let cnt = 0;
  for (let z = z0 - 2; z < z0 + size + 2; z++)
    for (let x = x0 - 2; x < x0 + size + 2; x++) {
      sum += blockTop(x, z);
      cnt++;
    }
  const yf = Math.floor(sum / cnt + 0.5);
  const o = new Out();
  /** ô (x, z) trong mê cung có phải tường? */
  const wall = (lx: number, lz: number): boolean => {
    const ti = Math.floor(lx / MAZE_CELL);
    const tj = Math.floor(lz / MAZE_CELL);
    const a = lx - ti * MAZE_CELL;
    const b = lz - tj * MAZE_CELL;
    const m = M.tiles[tj * MAZE_TILES + ti];
    if (a === 1 && b === 1) return m === 0;
    if (a === 1 && b === 0) return !(m & DN);
    if (a === 2 && b === 1) return !(m & DE);
    if (a === 1 && b === 2) return !(m & DS);
    if (a === 0 && b === 1) return !(m & DW);
    return true;
  };
  for (let z = z0 - 2; z < z0 + size + 2; z++)
    for (let x = x0 - 2; x < x0 + size + 2; x++) {
      const t = blockTop(x, z);
      for (let y = t; y < yf - 1; y++) o.add(x, y, z, B.stone, true); // móng
      o.add(x, yf - 1, z, hash2(x, z, 71) < 0.25 ? B.moss : B.stone, true); // sàn đá xám (tường gạch sáng → nhìn từ trên đọc được lối đi)
      const lx = x - x0;
      const lz = z - z0;
      const inside = lx >= 0 && lz >= 0 && lx < size && lz < size;
      const isWall = inside && wall(lx, lz);
      const clearTo = Math.max(t, yf + 3);
      for (let y = yf; y <= clearTo; y++) {
        const h = y - yf;
        if (isWall && h <= 2 && !(h === 2 && hash2(x, z, 73) < 0.22)) o.add(x, y, z, hash3(x, y, z, 75) < 0.14 ? B.moss : B.ruin, true);
        else o.add(x, y, z, B.air, true);
      }
    }
  // dốc ra khỏi lối vào (nam), chênh tối đa 1 khối mỗi ô
  const ex = x0 + Math.floor(MAZE_TILES / 2) * MAZE_CELL + 1;
  let f = yf - 1;
  for (let s2 = 1; s2 <= 7; s2++) {
    const z = z0 + size + 1 + s2;
    const t = blockTop(ex, z);
    f = Math.max(f - 1, Math.min(f + 1, t - 1));
    for (let x = ex - 1; x <= ex + 1; x++) {
      for (let y = Math.min(t, f); y < f; y++) o.add(x, y, z, B.stone, true);
      o.add(x, f, z, B.ruin, true);
      for (let y = f + 1; y <= Math.max(t, f + 3); y++) o.add(x, y, z, B.air, true);
    }
  }
  // kho báu ở ô xa lối vào nhất (khoảng cách BFS lớn nhất)
  const gi = M.goal % MAZE_TILES;
  const gj = (M.goal - gi) / MAZE_TILES;
  o.add(x0 + gi * MAZE_CELL + 1, yf, z0 + gj * MAZE_CELL + 1, B.gold, true);
  // cột pha lê đánh dấu hai bên lối vào
  for (const dx of [-2, 2]) for (let y = yf; y < yf + 4; y++) o.add(ex + dx, y, z0 + size + 1, B.crystal, true);
  return o.done();
}

const BLOCK_CACHE = new Map<string, Int32Array>();
/** Khối của một công trình vùng (cache) */
export function structureBlocks(s: Structure): Int32Array {
  const k = skey(s);
  let b = BLOCK_CACHE.get(k);
  if (!b) {
    b = s.kind === "isles" ? islesBlocks(s) : s.kind === "forest" ? forestBlocks(s) : mazeBlocks(s);
    if (BLOCK_CACHE.size > 48) BLOCK_CACHE.delete(BLOCK_CACHE.keys().next().value!);
    BLOCK_CACHE.set(k, b);
  }
  return b;
}

// ───────────── theo chunk: miệng hang ─────────────
export type Grotto = { x: number; z: number; top: number; dx: number; dz: number; steps: number; floor: number; cx: number; cz: number };
const GROTTO_CACHE = new Map<number, Grotto | null>();
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export function chunkGrotto(cx: number, cz: number): Grotto | null {
  const k = ckey(cx, cz);
  const hit = GROTTO_CACHE.get(k);
  if (hit !== undefined) return hit;
  let g: Grotto | null = null;
  if (hash2(cx, cz, 6100) < 0.6) {
    const x = cx * CHUNK + 10 + Math.floor(hash2(cx, cz, 6101) * 12);
    const z = cz * CHUNK + 10 + Math.floor(hash2(cx, cz, 6102) * 12);
    const top = blockTop(x, z);
    if (caveMask(x, z) > 0.35 && top >= 9 && structuresIn(x - 30, z - 30, x + 30, z + 30).length === 0 && !wonderIn(x - 26, z - 26, x + 26, z + 26)) {
      const d = Math.floor(hash2(cx, cz, 6103) * 4);
      const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][d];
      const steps = 2 * Math.min(8, top - 2 - CAVE_FLOOR);
      const floor = top - 1 - Math.floor((steps - 1) / 2);
      g = { x, z, top, dx, dz, steps, floor, cx: x + dx * (steps + 4), cz: z + dz * (steps + 4) };
    }
  }
  GROTTO_CACHE.set(k, g);
  return g;
}

function grottoBlocks(g: Grotto): Int32Array {
  const o = new Out();
  const px = -g.dz; // vuông góc
  const pz = g.dx;
  // bậc đỗ 3 ô trước miệng hang ở đúng mặt đất cũ + xoá gờ đá nhô phía trên lối xuống (dải phần nhô cao tới top + 7)
  for (let i = -3; i < g.steps; i++) {
    // mặt sàn hạ 1 khối mỗi 2 ô (dốc thoải, leo lại được)
    const f = i < 0 ? g.top : g.top - 1 - Math.floor(i / 2);
    for (let w = -1; w <= 1; w++) {
      const x = g.x + g.dx * i + px * w;
      const z = g.z + g.dz * i + pz * w;
      o.add(x, f - 1, z, i < 0 ? B.grass : B.stone, true);
      for (let y = f; y <= Math.max(f + 3, g.top + 7); y++) if (y <= f + 3 || y >= g.top) o.add(x, y, z, B.air, true);
    }
  }
  // khoang hang hình ê-líp ở cuối dốc, sàn phẳng; pha lê mọc ở chân tường
  for (let dz = -6; dz <= 6; dz++)
    for (let dx = -6; dx <= 6; dx++) {
      const r2 = dx * dx + dz * dz;
      if (r2 > 31) continue;
      const x = g.cx + dx;
      const z = g.cz + dz;
      o.add(x, g.floor - 1, z, B.stone, true);
      for (let dy = 0; dy <= 4; dy++) if (r2 / 31 + (dy * dy) / 20 <= 1) o.add(x, g.floor + dy, z, B.air, true);
      // pha lê ở chân tường phía XA lối vào (không chắn bậc cuối của dốc)
      if (r2 >= 18 && r2 <= 26 && dx * g.dx + dz * g.dz >= 0 && hash2(x, z, 6110) < 0.22) o.add(x, g.floor, z, B.crystal, true);
    }
  return o.done();
}

// ───────────── theo chunk: cây L-system ─────────────
const TREE_CACHE = new Map<number, Int32Array>();
const SPECIES_BY_BIOME = { meadow: SPECIES.oak, crystal: SPECIES.pine, dusk: SPECIES.blossom } as const;

/** Cây của một chunk nguồn (thân/lá có thể tràn sang chunk bên cạnh) */
export function chunkTreeBlocks(cx: number, cz: number): Int32Array {
  const k = ckey(cx, cz);
  const hit = TREE_CACHE.get(k);
  if (hit) return hit;
  const parts: Int32Array[] = [];
  const w = chunkWonder(cx, cz);
  const nearStruct = structuresIn(cx * CHUNK - 8, cz * CHUNK - 8, cx * CHUNK + CHUNK + 8, cz * CHUNK + CHUNK + 8);
  const grottos: Grotto[] = [];
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) {
      const g = chunkGrotto(cx + a, cz + b);
      if (g) grottos.push(g);
    }
  for (const t of chunkTrees(cx, cz, 10)) {
    const x = Math.floor(t.x);
    const z = Math.floor(t.z);
    const bi = biome(x, z);
    if (bi !== "meadow" && bi !== "crystal" && bi !== "dusk") continue; // biome toán học: giữ mặt đất "đọc được"
    if (inKeepClear(x, z, 3)) continue;
    if (w && (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z) < 81) continue;
    if (nearStruct.some((s) => x >= s.x0 - 4 && x <= s.x1 + 4 && z >= s.z0 - 4 && z <= s.z1 + 4)) continue;
    if (grottos.some((g) => Math.abs(g.x - x) + Math.abs(g.z - z) < 12 || Math.abs(g.cx - x) + Math.abs(g.cz - z) < 12)) continue;
    if (caveMask(x, z) > 0.2) continue; // phần nhô có thể khoét gốc
    const top = blockTop(x, z);
    const sp = SPECIES_BY_BIOME[bi];
    parts.push(growTree(sp, x, top, z, Math.floor(hash2(x, z, 19) * 8), Math.min(1.35, Math.max(0.85, t.s))));
  }
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Int32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  if (TREE_CACHE.size > 600) TREE_CACHE.delete(TREE_CACHE.keys().next().value!);
  TREE_CACHE.set(k, out);
  return out;
}

const GROTTO_BLOCKS = new Map<number, Int32Array>();
export function grottoBlocksOf(cx: number, cz: number): Int32Array | null {
  const g = chunkGrotto(cx, cz);
  if (!g) return null;
  const k = ckey(cx, cz);
  let b = GROTTO_BLOCKS.get(k);
  if (!b) {
    b = grottoBlocks(g);
    if (GROTTO_BLOCKS.size > 300) GROTTO_BLOCKS.delete(GROTTO_BLOCKS.keys().next().value!);
    GROTTO_BLOCKS.set(k, b);
  }
  return b;
}

/** Biển báo công trình quanh (x, z): công trình vùng trong R, miệng hang trong 80 m */
export function structureSigns(x: number, z: number, R: number): { kind: StructKind | "grotto"; x: number; y: number; z: number }[] {
  const out: { kind: StructKind | "grotto"; x: number; y: number; z: number }[] = [];
  for (const s of structuresIn(x - R, z - R, x + R, z + R)) {
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz <= R * R) out.push({ kind: s.kind, x: s.sign[0], y: s.sign[1], z: s.sign[2] });
  }
  const r = Math.min(R, 80);
  for (let cx = Math.floor((x - r) / CHUNK); cx <= Math.floor((x + r) / CHUNK); cx++)
    for (let cz = Math.floor((z - r) / CHUNK); cz <= Math.floor((z + r) / CHUNK); cz++) {
      const g = chunkGrotto(cx, cz);
      if (g && (g.x - x) * (g.x - x) + (g.z - z) * (g.z - z) <= r * r) out.push({ kind: "grotto", x: g.x + 0.5 - g.dx * 2, y: g.top + 3.5, z: g.z + 0.5 - g.dz * 2 });
    }
  return out;
}
