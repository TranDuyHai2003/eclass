/**
 * Voxel world data for the Wonder Expanse: procedural terrain (lib/world/terrain) + sparse player edits.
 * Edits are the unit that will later be synced in multiplayer; for now persisted locally.
 */
import { CHUNK, WATER_LEVEL, blockTop, topKind } from "./terrain";

export const BLOCKS = ["air", "grass", "dirt", "stone", "sand", "snow", "crystal", "gold", "wood", "leaf"] as const;
export type BlockId = number; // chỉ số trong BLOCKS
export const B = Object.fromEntries(BLOCKS.map((b, i) => [b, i])) as Record<(typeof BLOCKS)[number], number>;

/** Màu sRGB: [mặt trên, mặt bên] */
export const BLOCK_RGB: Record<number, [[number, number, number], [number, number, number]]> = {
  [B.grass]: [[0.42, 0.72, 0.36], [0.58, 0.42, 0.3]],
  [B.dirt]: [[0.58, 0.42, 0.3], [0.52, 0.38, 0.27]],
  [B.stone]: [[0.62, 0.62, 0.68], [0.55, 0.55, 0.62]],
  [B.sand]: [[0.9, 0.84, 0.62], [0.86, 0.79, 0.57]],
  [B.snow]: [[0.9, 0.92, 0.96], [0.82, 0.85, 0.91]],
  [B.crystal]: [[0.55, 0.88, 1], [0.45, 0.78, 0.95]],
  [B.gold]: [[1, 0.84, 0.42], [0.92, 0.72, 0.3]],
  [B.wood]: [[0.72, 0.55, 0.36], [0.55, 0.4, 0.26]],
  [B.leaf]: [[0.38, 0.66, 0.38], [0.32, 0.58, 0.34]],
};
/** Khối phát sáng (bloom) */
export const EMISSIVE = new Set([B.crystal, B.gold]);
/** Khối người chơi đặt được (hotbar) */
export const PLACEABLE = [B.grass, B.stone, B.wood, B.leaf, B.crystal, B.gold];

// Khoá số (không tạo chuỗi mỗi lần tra — blockAt được gọi hàng chục nghìn lần mỗi chunk):
// x, z ∈ [−2²⁰, 2²⁰), y ∈ [−64, 192) → ((x+2²⁰)·2²¹ + (z+2²⁰))·256 + (y+64) < 2⁵³
const OFF = 1048576;
const edits = new Map<number, BlockId>();
const key = (x: number, y: number, z: number) => ((x + OFF) * 2097152 + (z + OFF)) * 256 + (y + 64);
const unkey = (k: number): [number, number, number] => {
  const y = (k % 256) - 64;
  const xz = Math.floor(k / 256);
  return [Math.floor(xz / 2097152) - OFF, y, (xz % 2097152) - OFF];
};
/** Chỉ mục theo cột: khoảng y có khối đã sửa (columnRange khỏi phải dò 30 khoá) */
const colKey = (x: number, z: number) => (x + OFF) * 2097152 + (z + OFF);
const colEdits = new Map<number, [number, number]>();
function indexEdit(x: number, y: number, z: number) {
  const c = colKey(x, z);
  const r = colEdits.get(c);
  if (!r) colEdits.set(c, [y, y]);
  else {
    if (y < r[0]) r[0] = y;
    if (y > r[1]) r[1] = y;
  }
}
const STORAGE = "world.edits.v1";
const MAX_EDITS = 20000;

const listeners = new Set<(cx: number, cz: number) => void>();
export function onChunkDirty(fn: (cx: number, cz: number) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function loadEdits() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    // Định dạng lưu giữ nguyên ("x,y,z" → id) để không mất công trình cũ
    for (const [k, v] of JSON.parse(raw) as [string, number][]) {
      const [x, y, z] = k.split(",").map(Number);
      edits.set(key(x, y, z), v);
      indexEdit(x, y, z);
    }
  } catch {}
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Lưu trễ 1 s (gom nhiều lần sửa) thay vì stringify toàn bộ ở MỖI khối */
function saveEdits() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const out: [string, number][] = [];
      for (const [k, v] of edits) {
        const [x, y, z] = unkey(k);
        out.push([`${x},${y},${z}`, v]);
      }
      localStorage.setItem(STORAGE, JSON.stringify(out.slice(-MAX_EDITS)));
    } catch {}
  }, 1000);
}

/** Khối tự nhiên: mặt trên của cột nằm ở y = top, nên khối chiếm y ∈ [top − 1, top) */
export function naturalAt(x: number, y: number, z: number): BlockId {
  const top = blockTop(x, z);
  if (y >= top) return B.air;
  if (y === top - 1) {
    const k = topKind(x, z, top);
    return k === "grass" ? B.grass : k === "sand" ? B.sand : k === "snow" ? B.snow : B.stone;
  }
  return y > top - 4 && top > WATER_LEVEL + 0.5 ? B.dirt : B.stone;
}

export function blockAt(x: number, y: number, z: number): BlockId {
  if (edits.size) {
    const e = edits.get(key(x, y, z));
    if (e !== undefined) return e;
  }
  return naturalAt(x, y, z);
}

const localEdit = new Set<(x: number, y: number, z: number, id: BlockId) => void>();
/** Lớp mạng đăng ký để gửi khối do chính người chơi sửa */
export function onLocalEdit(fn: (x: number, y: number, z: number, id: BlockId) => void) {
  localEdit.add(fn);
  return () => void localEdit.delete(fn);
}

export function setBlock(x: number, y: number, z: number, id: BlockId, remote = false) {
  if (y < -40 || y > 80) return;
  if (!remote) localEdit.forEach((fn) => fn(x, y, z, id));
  edits.set(key(x, y, z), id);
  indexEdit(x, y, z);
  saveEdits();
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const dirty = new Set([`${cx},${cz}`]);
  // Khối ở mép chunk: chunk bên cạnh cũng phải dựng lại mặt
  const lx = x - cx * CHUNK;
  const lz = z - cz * CHUNK;
  if (lx === 0) dirty.add(`${cx - 1},${cz}`);
  if (lx === CHUNK - 1) dirty.add(`${cx + 1},${cz}`);
  if (lz === 0) dirty.add(`${cx},${cz - 1}`);
  if (lz === CHUNK - 1) dirty.add(`${cx},${cz + 1}`);
  for (const d of dirty) {
    const [a, b] = d.split(",").map(Number);
    listeners.forEach((fn) => fn(a, b));
  }
}

/** Khoảng y cần quét cho một cột (gồm cả khối đã sửa) */
export function columnRange(x: number, z: number): [number, number] {
  const top = blockTop(x, z);
  let lo = Math.min(top, blockTop(x + 1, z), blockTop(x - 1, z), blockTop(x, z + 1), blockTop(x, z - 1)) - 2;
  let hi = top;
  const r = colEdits.get(colKey(x, z));
  if (r) {
    lo = Math.min(lo, r[0] - 1);
    hi = Math.max(hi, r[1] + 1);
  }
  return [lo, hi];
}

/** Mặt đất dưới chân: khối đặc cao nhất ≤ y + 1 (leo được bậc 1 khối) */
export function surfaceAt(x: number, z: number, y: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  for (let by = Math.floor(y + 1.05); by > Math.floor(y) - 12; by--) {
    if (blockAt(ix, by - 1, iz) !== B.air && blockAt(ix, by, iz) === B.air && blockAt(ix, by + 1, iz) === B.air) return by;
  }
  return blockTop(ix, iz);
}

/** Dò tia qua lưới voxel (Amanatides–Woo). Trả về khối trúng và pháp tuyến mặt bị trúng. */
export function raycastVoxel(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = 8) {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sz = Math.sign(dz);
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx !== 0 ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
  let tmy = dy !== 0 ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
  let tmz = dz !== 0 ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
  let n: [number, number, number] = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    if (blockAt(x, y, z) !== B.air) return { x, y, z, n };
    if (tmx < tmy && tmx < tmz) {
      x += sx;
      t = tmx;
      tmx += tdx;
      n = [-sx, 0, 0];
    } else if (tmy < tmz) {
      y += sy;
      t = tmy;
      tmy += tdy;
      n = [0, -sy, 0];
    } else {
      z += sz;
      t = tmz;
      tmz += tdz;
      n = [0, 0, -sz];
    }
  }
  return null;
}
