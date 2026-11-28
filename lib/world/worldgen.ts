/**
 * Ghép KHỐI TỰ NHIÊN của một chunk (W5 + W6): bản đồ độ cao → mật độ 3D (hang, phần nhô) → miệng hang → cây L-system
 * → công trình vùng (đảo nổi, Rừng Đồ thị, tàn tích WFC).
 *
 * Phần lớn cột vẫn là "bản đồ độ cao thuần" (không lưu gì: khối suy ra từ blockTop). Cột nào bị đổi thì lưu một ĐOẠN đè
 * `{ lo, ids }` cho y ∈ [lo, lo + ids.length); ngoài đoạn đó cột vẫn theo bản đồ độ cao. Nhờ vậy:
 *   • naturalAt = một phép tra mảng (chunk vừa dùng được nhớ lại, không tra Map mỗi lần);
 *   • columnRange chỉ mở rộng ở cột thật sự có hang / cây / đảo → mesher không quét khoảng trống của chunk phẳng.
 * Thuần + tất định (không three, không Math.sin) → chạy được trong worker / test / server.
 */
import { B } from "./blocks";
import { shapeChunk, hash3 } from "./density";
import { FORCE, chunkTreeBlocks, grottoBlocksOf, structureBlocks, structuresIn } from "./structures";
import { caveOre, surfaceOreCells } from "./ores";
import { CHUNK, WATER_LEVEL, blockTop, topKind } from "./terrain";

export type Col = { lo: number; ids: Uint8Array };
export type Gen = { cx: number; cz: number; cols: (Col | undefined)[]; ms: number };

/** Khối theo bản đồ độ cao thuần: mặt trên của cột ở y = top (khối chiếm y ∈ [top − 1, top)) */
export function hmBlock(top: number, y: number): number {
  if (y >= top) return B.air;
  if (y === top - 1) {
    const k = topKind(0, 0, top);
    return k === "grass" ? B.grass : k === "sand" ? B.sand : k === "snow" ? B.snow : B.stone;
  }
  return y > top - 4 && top > WATER_LEVEL + 0.5 ? B.dirt : B.stone;
}

const CACHE = new Map<number, Gen>();
const CACHE_MAX = 320;
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
export const genStats = { chunks: 0, ms: 0 };

/** Dữ liệu sinh của chunk (cache FIFO) */
export function genChunk(cx: number, cz: number): Gen {
  const k = ckey(cx, cz);
  let g = CACHE.get(k);
  if (!g) {
    g = buildChunk(cx, cz);
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
    CACHE.set(k, g);
  }
  return g;
}

/** Nhận chunk đã sinh từ Web Worker (cùng hàm sinh, cùng seed) → luồng chính khỏi sinh lại khi tra khối / va chạm */
export function injectGen(g: Gen) {
  const k = ckey(g.cx, g.cz);
  if (CACHE.has(k)) return;
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(k, g);
}
export function hasGen(cx: number, cz: number) {
  return CACHE.has(ckey(cx, cz));
}

let lastKey = NaN;
let lastGen: Gen | null = null;
/** Đoạn đè của cột (x, z) nguyên, hoặc undefined nếu cột theo bản đồ độ cao thuần */
export function genColumn(x: number, z: number): Col | undefined {
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const k = ckey(cx, cz);
  let g = lastGen;
  if (k !== lastKey || !g) {
    g = genChunk(cx, cz);
    lastKey = k;
    lastGen = g;
  }
  return g.cols[(z - cz * CHUNK) * CHUNK + (x - cx * CHUNK)];
}

function buildChunk(cx: number, cz: number): Gen {
  const t0 = performance.now();
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const cols: (Col | undefined)[] = new Array(CHUNK * CHUNK);
  const tops = new Int16Array(CHUNK * CHUNK);
  for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) tops[lz * CHUNK + lx] = blockTop(x0 + lx, z0 + lz);

  // ── 1) mật độ 3D: dựng cột từ hình đặc/rỗng + gán vật liệu (cỏ trên cùng, đất 3 lớp, đá; pha lê trên sàn hang)
  const shapes = shapeChunk(cx, cz);
  if (shapes)
    for (let i = 0; i < CHUNK * CHUNK; i++) {
      const sh = shapes[i];
      if (!sh) continue;
      const top = tops[i];
      const x = x0 + (i % CHUNK);
      const z = z0 + Math.floor(i / CHUNK);
      const shHi = sh.lo + sh.solid.length - 1;
      const lo = Math.min(sh.lo, top) - 4;
      const hi = Math.max(shHi, top) + 1;
      const ids = new Uint8Array(hi - lo + 1);
      let depth = 0;
      for (let y = hi; y >= lo; y--) {
        const solid = y >= sh.lo && y <= shHi ? sh.solid[y - sh.lo] === 1 : y < top;
        if (!solid) {
          depth = 0;
          continue;
        }
        let id: number;
        if (depth === 0) {
          if (y >= top - 4) id = hmBlock(Math.max(top, y + 1), y); // mặt (kể cả gờ nhô cao hơn mặt cũ)
          else id = hash3(x, y, z, 77) < 0.035 ? B.crystal : caveOre(x, y, z, top); // sàn hang
        } else if (depth <= 3 && y > top - 8 && top > WATER_LEVEL + 0.5) id = B.dirt;
        else id = caveOre(x, y, z, top); // đá — có mạch quặng (G4)
        ids[y - lo] = id;
        depth++;
      }
      cols[i] = { lo, ids };
    }

  // ── 2) ghi khối của các đặc trưng (cắt theo chunk)
  const write = (arr: Int32Array) => {
    for (let q = 0; q < arr.length; q += 4) {
      const lx = arr[q] - x0;
      const lz = arr[q + 2] - z0;
      if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK) continue;
      const y = arr[q + 1];
      const code = arr[q + 3];
      const force = code >= FORCE;
      const id = force ? code - FORCE : code;
      const i = lz * CHUNK + lx;
      const top = tops[i];
      let col = cols[i];
      if (!col) {
        if (!force && y >= top) {
          // cột thường, ghi vào ô trống phía trên mặt đất
        } else if (!force) continue; // ô dưới mặt đất (đặc) → không ghi
        col = { lo: y, ids: new Uint8Array([hmBlock(top, y)]) };
        cols[i] = col;
      }
      if (y < col.lo || y >= col.lo + col.ids.length) {
        const nlo = Math.min(col.lo, y - 2);
        const nhi = Math.max(col.lo + col.ids.length - 1, y + 2);
        const ids = new Uint8Array(nhi - nlo + 1);
        for (let yy = nlo; yy <= nhi; yy++) ids[yy - nlo] = yy >= col.lo && yy < col.lo + col.ids.length ? col.ids[yy - col.lo] : hmBlock(top, yy);
        col.lo = nlo;
        col.ids = ids;
      }
      const k = y - col.lo;
      if (!force && col.ids[k] !== B.air) continue;
      col.ids[k] = id;
    }
  };
  // mỏ lộ thiên (G4): chỉ thay ô đang ĐẶC (không lấp hang / miệng hang)
  const ore = surfaceOreCells(cx, cz);
  if (ore.length) {
    const acc: number[] = [];
    for (let q = 0; q < ore.length; q += 4) {
      const i = (ore[q + 2] - z0) * CHUNK + (ore[q] - x0);
      const y = ore[q + 1];
      const col = cols[i];
      const cur = col && y >= col.lo && y < col.lo + col.ids.length ? col.ids[y - col.lo] : hmBlock(tops[i], y);
      if (cur !== B.air) acc.push(ore[q], y, ore[q + 2], FORCE + ore[q + 3]);
    }
    if (acc.length) write(Int32Array.from(acc));
  }
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) {
      const g = grottoBlocksOf(cx + a, cz + b);
      if (g) write(g);
    }
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) write(chunkTreeBlocks(cx + a, cz + b));
  for (const s of structuresIn(x0, z0, x0 + CHUNK - 1, z0 + CHUNK - 1)) write(structureBlocks(s));

  // ── 3) cắt bớt phần đầu/cuối trùng bản đồ độ cao
  for (let i = 0; i < CHUNK * CHUNK; i++) {
    const col = cols[i];
    if (!col) continue;
    const top = tops[i];
    let a = 0;
    let b = col.ids.length - 1;
    while (a <= b && col.ids[a] === hmBlock(top, col.lo + a)) a++;
    while (b >= a && col.ids[b] === hmBlock(top, col.lo + b)) b--;
    if (a > b) cols[i] = undefined;
    else if (a > 0 || b < col.ids.length - 1) cols[i] = { lo: col.lo + a, ids: col.ids.slice(a, b + 1) };
  }
  const ms = performance.now() - t0;
  genStats.chunks++;
  genStats.ms += ms;
  return { cx, cz, cols, ms };
}
