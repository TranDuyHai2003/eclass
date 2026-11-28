/**
 * G4 — Định dạng lưu Vùng Kỳ quan trong IndexedDB (thuần — phần I/O ở components/world/craft/worldSave.ts).
 *
 *   store "chunks": { k: "expanse:cx:cz", w, cx, cz, gen, rev, d: Int32Array [lx, y, lz, id]* }  — mọi khối đã sửa của
 *                   chunk 32 × 32 (kể cả "khối không khí" = đã đào), ghi đè nguyên bản ghi mỗi lần lưu;
 *   store "meta":   { k: "migrated", at, n } (đã chuyển localStorage cũ) · { k: "inv", rev, slots, mode } (túi đồ).
 *
 * Khối và túi đồ ghi trong CÙNG một giao dịch → tải lại không thể có "khối đã đào nhưng túi chưa có đồ" (hay ngược lại).
 */
import { CHUNK } from "./terrain";
import { sanitizeInv, type Slot } from "./inventory";

export const WORLD_ID = "expanse";
/** phiên bản bộ sinh khi ghi (để sau này biết bản ghi được sửa trên địa hình nào) */
export const GEN_VERSION = 1;
export const LEGACY_KEY = "world.edits.v1";

export type GameMode = "survival" | "creative";

export interface ChunkRecord {
  k: string;
  w: string;
  cx: number;
  cz: number;
  gen: number;
  rev: number;
  d: Int32Array;
}
export interface InvRecord {
  k: "inv";
  rev: number;
  slots: Slot[];
  mode: GameMode;
}

export const chunkRecordKey = (cx: number, cz: number) => `${WORLD_ID}:${cx}:${cz}`;
/** khoá số của chunk (Map trong bộ nhớ) */
export const chunkNum = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
export const chunkOfNum = (k: number): [number, number] => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];
/** khoá số của ô trong chunk: lx, lz ∈ [0, 32), y ∈ [−64, 192) */
export const cellNum = (lx: number, y: number, lz: number) => ((y + 64) * CHUNK + lz) * CHUNK + lx;
export const cellOfNum = (c: number): [number, number, number] => [c % CHUNK, Math.floor(c / (CHUNK * CHUNK)) - 64, Math.floor(c / CHUNK) % CHUNK];

/** Đóng gói khối đã sửa của một chunk (Map ô → id) thành bản ghi */
export function packChunk(cx: number, cz: number, cells: Map<number, number>, rev: number): ChunkRecord {
  const d = new Int32Array(cells.size * 4);
  let i = 0;
  for (const [c, id] of cells) {
    const [lx, y, lz] = cellOfNum(c);
    d[i++] = lx;
    d[i++] = y;
    d[i++] = lz;
    d[i++] = id;
  }
  return { k: chunkRecordKey(cx, cz), w: WORLD_ID, cx, cz, gen: GEN_VERSION, rev, d };
}

/**
 * Bản ghi → toạ độ thế giới phẳng [x, y, z, id]* (cho voxels.applySavedEdits). Bản ghi hỏng / sai thế giới → mảng rỗng.
 * maxId: id khối lớn nhất hợp lệ (khối lạ bị bỏ).
 */
export function unpackChunk(rec: unknown, maxId: number): number[] {
  const r = rec as Partial<ChunkRecord> | null;
  if (!r || r.w !== WORLD_ID || !Number.isInteger(r.cx) || !Number.isInteger(r.cz) || !r.d || typeof (r.d as ArrayLike<number>).length !== "number") return [];
  const d = r.d as ArrayLike<number>;
  const x0 = (r.cx as number) * CHUNK;
  const z0 = (r.cz as number) * CHUNK;
  const out: number[] = [];
  for (let i = 0; i + 3 < d.length; i += 4) {
    const lx = d[i];
    const y = d[i + 1];
    const lz = d[i + 2];
    const id = d[i + 3];
    if (!(lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && y >= -40 && y <= 80 && id >= 0 && id <= maxId)) continue;
    if (!Number.isInteger(lx) || !Number.isInteger(y) || !Number.isInteger(lz) || !Number.isInteger(id)) continue;
    out.push(x0 + lx, y, z0 + lz, id);
  }
  return out;
}

/** Thêm một khối đã sửa vào bảng theo chunk; trả khoá số của chunk */
export function indexCell(byChunk: Map<number, Map<number, number>>, x: number, y: number, z: number, id: number): number {
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const k = chunkNum(cx, cz);
  let m = byChunk.get(k);
  if (!m) byChunk.set(k, (m = new Map()));
  m.set(cellNum(x - cx * CHUNK, y, z - cz * CHUNK), id);
  return k;
}

/** Chuỗi localStorage cũ (`[["x,y,z", id], …]`) → bảng theo chunk. Hỏng → bảng rỗng (không ném lỗi). */
export function parseLegacy(raw: string | null, maxId: number): Map<number, Map<number, number>> {
  const byChunk = new Map<number, Map<number, number>>();
  if (!raw) return byChunk;
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return byChunk;
  }
  if (!Array.isArray(list)) return byChunk;
  for (const e of list) {
    if (!Array.isArray(e) || typeof e[0] !== "string") continue;
    const p = e[0].split(",").map(Number);
    const id = Number(e[1]);
    if (p.length !== 3 || !p.every(Number.isInteger) || !Number.isInteger(id) || id < 0 || id > maxId || p[1] < -40 || p[1] > 80) continue;
    indexCell(byChunk, p[0], p[1], p[2], id);
  }
  return byChunk;
}

/**
 * Gộp dữ liệu cũ vào bản ghi đang có (chuyển đổi LUỸ ĐẲNG): ô đã có trong IndexedDB giữ nguyên (mới hơn), chỉ thêm ô
 * còn thiếu. Trả về bản ghi cần ghi (null nếu không có gì mới).
 */
export function mergeLegacy(cx: number, cz: number, existing: unknown, legacy: Map<number, number>, maxId: number): ChunkRecord | null {
  const cells = new Map<number, number>();
  const ex = existing as Partial<ChunkRecord> | null;
  const flat = unpackChunk(existing, maxId);
  for (let i = 0; i < flat.length; i += 4) cells.set(cellNum(flat[i] - cx * CHUNK, flat[i + 1], flat[i + 2] - cz * CHUNK), flat[i + 3]);
  let added = 0;
  for (const [c, id] of legacy)
    if (!cells.has(c)) {
      cells.set(c, id);
      added++;
    }
  if (!added) return null;
  return packChunk(cx, cz, cells, (ex?.rev ?? 0) + 1);
}

export function invRecord(slots: Slot[], mode: GameMode, rev: number): InvRecord {
  return { k: "inv", rev, slots: slots.map((s) => (s ? { id: s.id, n: s.n } : null)), mode };
}
export function parseInvRecord(raw: unknown): { slots: Slot[]; mode: GameMode; rev: number } | null {
  const r = raw as Partial<InvRecord> | null;
  if (!r || r.k !== "inv") return null;
  return { slots: sanitizeInv(r.slots), mode: r.mode === "creative" ? "creative" : "survival", rev: Number.isInteger(r.rev) ? (r.rev as number) : 0 };
}

/**
 * Theo dõi "bẩn" có phiên bản: mark tăng rev của khoá; sau khi giao dịch ghi xong, chỉ xoá bẩn nếu rev đã ghi vẫn là
 * rev hiện tại (có sửa mới trong lúc ghi → vẫn bẩn, lần sau ghi tiếp).
 */
export class DirtyRevs<K> {
  private rev = new Map<K, number>();
  private dirty = new Set<K>();
  mark(k: K): number {
    const r = (this.rev.get(k) ?? 0) + 1;
    this.rev.set(k, r);
    this.dirty.add(k);
    return r;
  }
  /** chụp danh sách bẩn kèm rev tại lúc bắt đầu ghi */
  snapshot(): [K, number][] {
    return [...this.dirty].map((k) => [k, this.rev.get(k) ?? 0]);
  }
  committed(snap: [K, number][]) {
    for (const [k, r] of snap) if (this.rev.get(k) === r) this.dirty.delete(k);
  }
  get size() {
    return this.dirty.size;
  }
  revOf(k: K) {
    return this.rev.get(k) ?? 0;
  }
  setRev(k: K, r: number) {
    if (r > (this.rev.get(k) ?? 0)) this.rev.set(k, r);
  }
}
