/**
 * Matrix Forge — transform a block build by a 3×3 matrix (pure, testable).
 * v' = M·(v − pivot) + pivot. With det ≠ 0 we map INVERSELY (each target cell asks "where did I come from?")
 * so scaling fills solid shapes without holes; det = 0 collapses forward onto a plane/line.
 * |det| = how much volume (block count) is multiplied; det < 0 = mirrored; AB ≠ BA in general.
 */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Cell = { x: number; y: number; z: number; id: number };
type L = { en: string; vi: string };

export const CARDS: { id: string; name: L; m: Mat3; idea: L }[] = [
  { id: "rot", name: { en: "Rotate 90°", vi: "Quay 90°" }, m: [0, 0, 1, 0, 1, 0, -1, 0, 0], idea: { en: "det = 1: shape and size kept, only turned. The vertical axis is an eigenvector — it doesn't move.", vi: "det = 1: giữ nguyên hình và kích thước, chỉ xoay. Trục đứng là vectơ riêng — nó không đổi hướng." } },
  { id: "mirror", name: { en: "Mirror", vi: "Đối xứng gương" }, m: [-1, 0, 0, 0, 1, 0, 0, 0, 1], idea: { en: "det = −1: same volume, but left and right swap — no rotation can do this.", vi: "det = −1: thể tích như cũ nhưng trái phải đổi chỗ — không phép quay nào làm được." } },
  { id: "shear", name: { en: "Shear", vi: "Trượt" }, m: [1, 1, 0, 0, 1, 0, 0, 0, 1], idea: { en: "x' = x + y: each layer slides by its height. det = 1, so the block count is unchanged even though the shape leans.", vi: "x' = x + y: mỗi tầng trượt theo độ cao. det = 1 nên số khối không đổi dù hình nghiêng hẳn đi." } },
  { id: "stretch", name: { en: "Stretch ×2 (up)", vi: "Kéo dãn ×2 (lên)" }, m: [1, 0, 0, 0, 2, 0, 0, 0, 1], idea: { en: "det = 2: one direction doubled, so the volume doubles.", vi: "det = 2: kéo gấp đôi một chiều nên thể tích gấp đôi." } },
  { id: "scale", name: { en: "Scale ×2", vi: "Phóng ×2" }, m: [2, 0, 0, 0, 2, 0, 0, 0, 2], idea: { en: "det = 2³ = 8: doubling every length multiplies volume by eight.", vi: "det = 2³ = 8: gấp đôi mọi độ dài thì thể tích gấp tám." } },
  { id: "flatten", name: { en: "Project (flatten)", vi: "Chiếu (ép dẹt)" }, m: [1, 0, 0, 0, 0, 0, 0, 0, 1], idea: { en: "det = 0: the vertical direction is crushed to nothing. You can't undo it — a matrix with det 0 has no inverse.", vi: "det = 0: chiều đứng bị ép mất hẳn. Không thể hoàn tác — ma trận có det 0 không có nghịch đảo." } },
];

export function det3(m: Mat3): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}
export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
export function inv3(m: Mat3): Mat3 | null {
  const d = det3(m);
  if (Math.abs(d) < 1e-9) return null;
  const [a, b, c, d1, e, f, g, h, i] = m;
  return [(e * i - f * h) / d, (c * h - b * i) / d, (b * f - c * e) / d, (f * g - d1 * i) / d, (a * i - c * g) / d, (c * d1 - a * f) / d, (d1 * h - e * g) / d, (b * g - a * h) / d, (a * e - b * d1) / d] as Mat3;
}
const apply = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];

/** Biến đổi tập khối quanh tâm pivot (pivot là toạ độ thực, thường là tâm đế rèn) */
export function transformCells(cells: Cell[], m: Mat3, pivot: { x: number; y: number; z: number }, maxOut = 3000): Cell[] {
  if (!cells.length) return [];
  const src = new Map<string, number>();
  for (const c of cells) src.set(`${c.x},${c.y},${c.z}`, c.id);
  const inv = inv3(m);
  const out: Cell[] = [];
  if (!inv) {
    // det = 0: ánh xạ xuôi, gộp các khối trùng
    const seen = new Set<string>();
    for (const c of cells) {
      const [x, y, z] = apply(m, c.x + 0.5 - pivot.x, c.y + 0.5 - pivot.y, c.z + 0.5 - pivot.z);
      const t = { x: Math.floor(x + pivot.x), y: Math.floor(y + pivot.y), z: Math.floor(z + pivot.z), id: c.id };
      const k = `${t.x},${t.y},${t.z}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(t);
      }
    }
    return out;
  }
  // Hộp bao của ảnh
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const c of cells)
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
      const p = apply(m, c.x + dx - pivot.x, c.y + dy - pivot.y, c.z + dz - pivot.z);
      lo = lo.map((v, i) => Math.min(v, p[i] + [pivot.x, pivot.y, pivot.z][i]));
      hi = hi.map((v, i) => Math.max(v, p[i] + [pivot.x, pivot.y, pivot.z][i]));
    }
  // Tra ô nguồn bằng lưới dày đặc trên hộp bao nguồn (không tạo chuỗi khoá mỗi ô — server khai triển thông điệp "forge" nữa)
  let sx0 = Infinity, sy0 = Infinity, sz0 = Infinity, sx1 = -Infinity, sy1 = -Infinity, sz1 = -Infinity;
  for (const c of cells) {
    sx0 = Math.min(sx0, c.x); sy0 = Math.min(sy0, c.y); sz0 = Math.min(sz0, c.z);
    sx1 = Math.max(sx1, c.x); sy1 = Math.max(sy1, c.y); sz1 = Math.max(sz1, c.z);
  }
  const NX = sx1 - sx0 + 1, NY = sy1 - sy0 + 1, NZ = sz1 - sz0 + 1;
  const grid = NX * NY * NZ <= 1 << 22 ? new Int32Array(NX * NY * NZ).fill(-1) : null;
  if (grid) for (const c of cells) grid[((c.x - sx0) * NY + (c.y - sy0)) * NZ + (c.z - sz0)] = c.id;
  const lookup = (x: number, y: number, z: number): number | undefined => {
    if (!grid) return src.get(`${x},${y},${z}`);
    if (x < sx0 || x > sx1 || y < sy0 || y > sy1 || z < sz0 || z > sz1) return undefined;
    const id = grid[((x - sx0) * NY + (y - sy0)) * NZ + (z - sz0)];
    return id < 0 ? undefined : id;
  };
  for (let x = Math.floor(lo[0]); x < Math.ceil(hi[0]); x++)
    for (let y = Math.floor(lo[1]); y < Math.ceil(hi[1]); y++)
      for (let z = Math.floor(lo[2]); z < Math.ceil(hi[2]); z++) {
        const [sx, sy, sz] = apply(inv, x + 0.5 - pivot.x, y + 0.5 - pivot.y, z + 0.5 - pivot.z);
        const id = lookup(Math.floor(sx + pivot.x), Math.floor(sy + pivot.y), Math.floor(sz + pivot.z));
        if (id !== undefined) {
          out.push({ x, y, z, id });
          if (out.length >= maxOut) return out;
        }
      }
  return out;
}

// ───────────── Một thông điệp mạng cho cả phép biến đổi (macro op) ─────────────
// Client gửi { t: "forge", m, y, c } MỘT lần; server kiểm, LƯU các khối đã khai triển (người vào sau thấy ngay) và phát cho phòng;
// máy nhận khai triển y hệt (chỉ + − × / floor — IEEE như nhau trên mọi máy JS). Khối nguồn do người rèn GỬI KÈM (≤ 441 ô của đế)
// vì server không chạy được bộ sinh địa hình — nó không biết khối tự nhiên trên đế. File này được scripts/gen-realtime.mjs chép
// sang realtime/forge.mjs: KHÔNG import gì.

/** Góc thấp nhất (x, z) của đế rèn 7×7 trong Vùng Kỳ quan; quét FORGE_H tầng từ mặt đế */
export const FORGE_AT = { x: -10, z: 9 };
export const FORGE_SIZE = 7;
export const FORGE_H = 9;
/** Số ô nguồn tối đa (cả hộp quét) và số khối kết quả tối đa */
export const FORGE_MAX_SRC = FORGE_SIZE * FORGE_SIZE * FORGE_H;
export const FORGE_MAX_OUT = 3000;
/** Phần tử ma trận được phép (như bảng thẻ: −2 … 2) */
export const FORGE_MAX_ENTRY = 2;
/** Thông điệp: m = ma trận, y = mặt đế, c = [chỉ số ô, id, chỉ số ô, id, …] tăng dần; chỉ số = (dx·SIZE + dz)·H + dy */
export interface ForgeOp {
  m: Mat3;
  y: number;
  c: number[];
}

export function forgePivot(y0: number) {
  return { x: FORGE_AT.x + FORGE_SIZE / 2, y: y0, z: FORGE_AT.z + FORGE_SIZE / 2 };
}

/** Ô trên đế → thông điệp (ô ngoài hộp quét hoặc khối rỗng bị bỏ; thứ tự chuẩn để hai bên khai triển như nhau) */
export function encodeForge(cells: Cell[], m: Mat3, y0: number): ForgeOp {
  const idx: [number, number][] = [];
  for (const c of cells) {
    const dx = c.x - FORGE_AT.x;
    const dz = c.z - FORGE_AT.z;
    const dy = c.y - y0;
    if (c.id <= 0 || dx < 0 || dx >= FORGE_SIZE || dz < 0 || dz >= FORGE_SIZE || dy < 0 || dy >= FORGE_H) continue;
    idx.push([(dx * FORGE_SIZE + dz) * FORGE_H + dy, c.id]);
  }
  idx.sort((a, b) => a[0] - b[0]);
  const c: number[] = [];
  for (let i = 0; i < idx.length; i++) if (i === 0 || idx[i][0] !== idx[i - 1][0]) c.push(idx[i][0], idx[i][1]);
  return { m: [...m] as Mat3, y: y0, c };
}

/** Kiểm thông điệp (từ mạng — không tin gì): trả bản sạch hoặc null. maxId = id khối lớn nhất được phép */
export function validForge(raw: unknown, maxId: number): ForgeOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { m?: unknown; y?: unknown; c?: unknown };
  const m = o.m;
  if (!Array.isArray(m) || m.length !== 9 || !m.every((v) => Number.isInteger(v) && Math.abs(v) <= FORGE_MAX_ENTRY)) return null;
  const y = o.y;
  if (typeof y !== "number" || !Number.isInteger(y) || y < -40 || y > 80 - FORGE_H) return null;
  const c = o.c;
  if (!Array.isArray(c) || c.length < 2 || c.length % 2 || c.length > FORGE_MAX_SRC * 2) return null;
  let prev = -1;
  for (let i = 0; i < c.length; i += 2) {
    const k = c[i];
    const id = c[i + 1];
    if (!Number.isInteger(k) || k <= prev || k >= FORGE_MAX_SRC) return null;
    if (!Number.isInteger(id) || id < 1 || id > maxId) return null;
    prev = k;
  }
  return { m: [...m] as Mat3, y, c: [...c] };
}

/** Thông điệp → danh sách sửa [x, y, z, id] theo thứ tự áp dụng: xoá mọi ô nguồn rồi đặt các khối kết quả */
export function expandForge(op: ForgeOp): [number, number, number, number][] {
  const cells: Cell[] = [];
  for (let i = 0; i < op.c.length; i += 2) {
    const k = op.c[i];
    const dy = k % FORGE_H;
    const xz = (k - dy) / FORGE_H;
    const dz = xz % FORGE_SIZE;
    const dx = (xz - dz) / FORGE_SIZE;
    cells.push({ x: FORGE_AT.x + dx, y: op.y + dy, z: FORGE_AT.z + dz, id: op.c[i + 1] });
  }
  const out = transformCells(cells, op.m, forgePivot(op.y), FORGE_MAX_OUT);
  const edits: [number, number, number, number][] = cells.map((c) => [c.x, c.y, c.z, 0]);
  for (const c of out) if (c.y >= op.y - 2 && c.y < op.y + 40 && c.y >= -40 && c.y <= 80) edits.push([c.x, c.y, c.z, c.id]);
  return edits;
}
