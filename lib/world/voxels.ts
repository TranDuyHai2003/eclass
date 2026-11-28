/**
 * Voxel world data for the Wonder Expanse: procedural terrain (lib/world/terrain) + sparse player edits.
 * Edits are the unit that will later be synced in multiplayer; for now persisted locally.
 */
import { CHUNK, blockTop } from "./terrain";
import { B, isSolidBlock, isTargetBlock, type BlockId } from "./blocks";
import { genColumn, hasGen, hmBlock } from "./worldgen";

// Bảng khối ở lib/world/blocks.ts (khối mới thêm ở CUỐI để không đổi chỉ số — server lưu theo chỉ số)
export { B, BLOCKS, isSolidBlock, isTargetBlock, type BlockId } from "./blocks";

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
  [B.glass]: [[0.72, 0.93, 0.96], [0.56, 0.82, 0.88]],
  [B.blossom]: [[0.98, 0.72, 0.84], [0.92, 0.62, 0.76]],
  [B.pine]: [[0.24, 0.5, 0.46], [0.2, 0.43, 0.4]],
  [B.plank]: [[0.86, 0.68, 0.44], [0.74, 0.56, 0.36]],
  [B.ruin]: [[0.78, 0.74, 0.66], [0.66, 0.62, 0.56]],
  [B.moss]: [[0.5, 0.66, 0.42], [0.56, 0.6, 0.5]],
  [B.rope]: [[0.9, 0.42, 0.36], [0.78, 0.34, 0.3]], // cầu dây đỏ = cạnh NGOÀI cây khung (tạo chu trình)
  [B.intcrystal]: [[0.7, 0.58, 1], [0.6, 0.48, 0.92]], // Tinh thể Số nguyên (tím)
  [B.copper]: [[0.9, 0.56, 0.34], [0.78, 0.46, 0.28]], // Đồng Tỉ lệ (cam đồng)
  [B.torch]: [[1, 0.86, 0.5], [0.98, 0.7, 0.34]], // đuốc
  [B.bench]: [[0.86, 0.7, 0.46], [0.56, 0.4, 0.26]], // Bàn Dã chiến
  [B.water]: [[0.37, 0.72, 0.9], [0.3, 0.6, 0.86]], // nguồn nước (vẽ bằng lưới nước riêng)
};
/** Khối phát sáng (bloom) */
export const EMISSIVE = new Set([B.crystal, B.gold, B.glass]);
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
/** Cờ (localStorage): khối đã chuyển sang IndexedDB (components/world/craft/worldSave) → không nạp / ghi bản localStorage nữa */
export const IDB_FLAG = "world.edits.idb";
let externalSave = false;
/** IndexedDB lưu thay (gọi sau khi mở + chuyển dữ liệu thành công) — tắt ghi localStorage */
export function setExternalPersistence(on: boolean) {
  externalSave = on;
}

const listeners = new Set<(cx: number, cz: number) => void>();
export function onChunkDirty(fn: (cx: number, cz: number) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function loadEdits(force = false) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!force && localStorage.getItem(IDB_FLAG) === "1") return; // đã ở IndexedDB — nạp không đồng bộ ở worldSave
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
  if (saveTimer || externalSave) return;
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

/**
 * Khối tự nhiên: bản đồ độ cao (mặt trên của cột ở y = top, khối chiếm y ∈ [top − 1, top)), trừ khi cột có ĐOẠN ĐÈ
 * do bộ sinh (lib/world/worldgen: hang, phần nhô, cây L-system, đảo nổi, công trình) — khi đó tra mảng của đoạn.
 */
export function naturalAt(x: number, y: number, z: number): BlockId {
  x = Math.floor(x);
  z = Math.floor(z);
  const col = genColumn(x, z);
  if (col) {
    const k = y - col.lo;
    if (k >= 0 && k < col.ids.length) return col.ids[k];
  }
  return hmBlock(blockTop(x, z), y);
}

/**
 * Dữ liệu sinh của chunk chứa cột (x, z) đã có trong bộ nhớ (worker đã gửi / đã sinh) — tra khối ở đây KHÔNG phải sinh chunk
 * đồng bộ trên luồng chính (~6–14 ms / chunk khi máy đã "nóng", ~50 ms lúc lạnh). Đường không bắt buộc (tia nhắm khối) hỏi
 * trước để khỏi khựng; va chạm của người chơi vẫn tra thẳng (đúng hơn nhanh: không bao giờ rơi xuyên đất ở mép chưa tải).
 */
export function columnReady(x: number, z: number): boolean {
  return hasGen(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
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

const anyEdit = new Set<(x: number, y: number, z: number, id: BlockId) => void>();
/** Mọi lần sửa khối (của mình lẫn từ mạng) — Web Worker dựng chunk cần bản sao các khối đã sửa */
export function onAnyEdit(fn: (x: number, y: number, z: number, id: BlockId) => void) {
  anyEdit.add(fn);
  return () => void anyEdit.delete(fn);
}
/** Duyệt mọi khối đã sửa (gửi một lần cho worker lúc khởi động) */
export function forEachEdit(fn: (x: number, y: number, z: number, id: BlockId) => void) {
  for (const [k, v] of edits) {
    const [x, y, z] = unkey(k);
    fn(x, y, z, v);
  }
}

/**
 * Nạp khối đã lưu (IndexedDB) dạng phẳng [x, y, z, id]*: không gửi mạng, không lưu lại; báo worker (onAnyEdit) + chunk bẩn.
 * Ô đã có đúng id thì bỏ qua (nạp lại nhiều lần vô hại).
 */
export function applySavedEdits(d: ArrayLike<number>) {
  const chunks = new Set<number>();
  for (let i = 0; i + 3 < d.length; i += 4) {
    const x = d[i];
    const y = d[i + 1];
    const z = d[i + 2];
    const id = d[i + 3];
    if (y < -40 || y > 80) continue;
    const k = key(x, y, z);
    if (edits.get(k) === id) continue;
    anyEdit.forEach((fn) => fn(x, y, z, id));
    edits.set(k, id);
    indexEdit(x, y, z);
    chunks.add((Math.floor(x / CHUNK) + 32768) * 65536 + Math.floor(z / CHUNK) + 32768);
  }
  for (const c of chunks) listeners.forEach((fn) => fn(Math.floor(c / 65536) - 32768, (c % 65536) - 32768));
}

export function setBlock(x: number, y: number, z: number, id: BlockId, remote = false) {
  if (y < -40 || y > 80) return;
  // không đổi gì (vd. nhận lại toàn bộ danh sách sửa khi kết nối lại) → khỏi báo bẩn / dựng lại lưới / gửi mạng
  if (blockAt(x, y, z) === id) return;
  if (!remote) localEdit.forEach((fn) => fn(x, y, z, id));
  anyEdit.forEach((fn) => fn(x, y, z, id));
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

/**
 * Khoảng y của một cột: mọi ô y < lo đều ĐẶC, mọi ô y > hi đều RỖNG (gồm cả đoạn đè của bộ sinh và khối đã sửa).
 * Chỉ xét chính cột này — mesher tự lấy min của 3×3 cột lân cận để lộ đủ vách hang / hố của cột bên cạnh.
 * Cột thường chỉ tốn 1 lần tra; chỉ cột có hang / cây / đảo mới mở rộng.
 */
export function columnRange(x: number, z: number): [number, number] {
  const top = blockTop(x, z);
  let lo = top - 1;
  let hi = top;
  const g = genColumn(Math.floor(x), Math.floor(z));
  if (g) {
    if (g.lo - 1 < lo) lo = g.lo - 1;
    if (g.lo + g.ids.length > hi) hi = g.lo + g.ids.length;
  }
  const r = colEdits.get(colKey(x, z));
  if (r) {
    lo = Math.min(lo, r[0] - 1);
    hi = Math.max(hi, r[1] + 1);
  }
  return [lo, hi];
}

/** Mặt đất dưới chân: khối đặc cao nhất ≤ y + 1 (leo được bậc 1 khối) */
/** Đỉnh cột (y của mặt trên khối cao nhất), TÍNH CẢ khối người chơi đặt — cột thu lôi tự xây cũng được */
export function columnTop(x: number, z: number): number {
  const [lo, hi] = columnRange(x, z);
  for (let y = hi; y >= lo; y--) if (isSolidBlock(blockAt(x, y, z))) return y + 1;
  return blockTop(x, z);
}

/**
 * Mặt đất dưới chân (khối đặc có 2 ô trống phía trên), dò xuống tới đáy cột — rơi khỏi đảo nổi / xuống hố sâu trong hang
 * vẫn tìm đúng sàn. Không thấy (đang kẹt trong khối đặc) → mặt cột theo bản đồ độ cao (cứu ra ngoài).
 */
export function surfaceAt(x: number, z: number, y: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const end = Math.min(Math.floor(y) - 12, columnRange(ix, iz)[0]);
  for (let by = Math.floor(y + 1.05); by > end; by--) {
    if (isSolidBlock(blockAt(ix, by - 1, iz)) && !isSolidBlock(blockAt(ix, by, iz)) && !isSolidBlock(blockAt(ix, by + 1, iz))) return by;
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
    if (isTargetBlock(blockAt(x, y, z))) return { x, y, z, n };
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
