#!/usr/bin/env node
/**
 * OFFLINE: đường viền (silhouette) nhìn chính diện của boss Fourier Siren → hệ số Fourier phức (epicycle).
 *   node scripts/siren-epicycles.mjs  → ghi lib/world/sirenOutline.ts
 * Cách làm (không phụ thuộc thư viện):
 *  1. Đọc GLB (public/world/boss/siren.glb): mọi tam giác của mọi primitive (đỉnh float32, chỉ số u16/u32).
 *  2. Chiếu lên mặt phẳng XY (boss nhìn về +Z), tô vào lưới chiếm chỗ 256 × 256 (raster tam giác).
 *  3. Lấp lỗ nhỏ (đóng hình thái học 1 ô), dò đường viền ngoài (Moore-neighbour tracing).
 *  4. Lấy mẫu lại 512 điểm đều theo độ dài cung, DFT: c_k = (1/N) Σ z_n e^{−2πi k n / N}, k ∈ [−N/2, N/2).
 *  5. Giữ 64 hệ số biên độ lớn nhất (bỏ k = 0 → tâm), sắp giảm dần theo biên độ (chuỗi epicycle vẽ "to trước nhỏ sau").
 * Đơn vị: mét trong không gian mô hình (chưa nhân scale 1.6 của BossModel).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GLB = path.join(ROOT, "public/world/boss/siren.glb");
const OUT = path.join(ROOT, "lib/world/sirenOutline.ts");
const GRID = 256;
const SAMPLES = 512;
const KEEP = 64;

const buf = fs.readFileSync(GLB);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart);

function accessor(i) {
  const a = gltf.accessors[i];
  const bv = gltf.bufferViews[a.bufferView];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const n = a.count * comps;
  const ab = bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * (a.componentType === 5126 || a.componentType === 5125 ? 4 : 2));
  if (bv.byteStride && bv.byteStride !== comps * 4) throw new Error("interleaved accessor not supported");
  if (a.componentType === 5126) return new Float32Array(ab);
  if (a.componentType === 5123) return new Uint16Array(ab);
  if (a.componentType === 5125) return new Uint32Array(ab);
  throw new Error("componentType " + a.componentType);
}

// 1–2. raster mọi tam giác lên XY
const tris = [];
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const mesh of gltf.meshes) for (const prim of mesh.primitives) {
  const pos = accessor(prim.attributes.POSITION);
  const idx = prim.indices !== undefined ? accessor(prim.indices) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  for (let i = 0; i < idx.length; i += 3) {
    const t = [idx[i], idx[i + 1], idx[i + 2]].map((v) => [pos[v * 3], pos[v * 3 + 1]]);
    tris.push(t);
    for (const [x, y] of t) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
}
const span = Math.max(maxX - minX, maxY - minY) * 1.06;
const cx0 = (minX + maxX) / 2 - span / 2;
const cy0 = (minY + maxY) / 2 - span / 2;
const cell = span / GRID;
const occ = new Uint8Array(GRID * GRID);
const toG = (x, y) => [(x - cx0) / cell, (y - cy0) / cell];
for (const t of tris) {
  const g = t.map(([x, y]) => toG(x, y));
  const x0 = Math.max(0, Math.floor(Math.min(g[0][0], g[1][0], g[2][0])));
  const x1 = Math.min(GRID - 1, Math.ceil(Math.max(g[0][0], g[1][0], g[2][0])));
  const y0 = Math.max(0, Math.floor(Math.min(g[0][1], g[1][1], g[2][1])));
  const y1 = Math.min(GRID - 1, Math.ceil(Math.max(g[0][1], g[1][1], g[2][1])));
  const e = (a, b, px, py) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const area = e(g[0], g[1], g[2][0], g[2][1]);
  if (Math.abs(area) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = e(g[1], g[2], px, py), w1 = e(g[2], g[0], px, py), w2 = e(g[0], g[1], px, py);
    if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) occ[y * GRID + x] = 1;
  }
}
// 3. đóng hình thái học (giãn rồi co 1 ô) — lấp khe giữa các mảnh
const morph = (src, dil) => {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    let v = dil ? 0 : 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      const s = xx >= 0 && yy >= 0 && xx < GRID && yy < GRID ? src[yy * GRID + xx] : 0;
      if (dil) v |= s; else v &= s;
    }
    out[y * GRID + x] = v;
  }
  return out;
};
const solid = morph(morph(occ, true), false);
const at = (x, y) => (x >= 0 && y >= 0 && x < GRID && y < GRID ? solid[y * GRID + x] : 0);

// Moore-neighbour tracing từ ô đặc đầu tiên (quét từ dưới lên, trái sang phải)
let start = null;
for (let y = 0; y < GRID && !start; y++) for (let x = 0; x < GRID; x++) if (at(x, y)) { start = [x, y]; break; }
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const contour = [start];
let cur = start, back = 4; // vào từ bên trái
for (let guard = 0; guard < GRID * GRID; guard++) {
  let found = null;
  for (let k = 0; k < 8; k++) {
    const d = (back + 1 + k) % 8;
    const nx = cur[0] + DIRS[d][0], ny = cur[1] + DIRS[d][1];
    if (at(nx, ny)) { found = [nx, ny, d]; break; }
  }
  if (!found) break;
  cur = [found[0], found[1]];
  back = (found[2] + 4) % 8;
  if (cur[0] === start[0] && cur[1] === start[1]) break;
  contour.push(cur);
}
// 4. lấy mẫu đều theo độ dài cung (toạ độ mô hình, tâm X = 0, gốc Y = đáy)
const P = contour.map(([x, y]) => [cx0 + (x + 0.5) * cell, cy0 + (y + 0.5) * cell]);
const L = [0];
for (let i = 1; i <= P.length; i++) {
  const a = P[i - 1], b = P[i % P.length];
  L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
const total = L[L.length - 1];
const Z = [];
let seg = 0;
for (let n = 0; n < SAMPLES; n++) {
  const s = (n / SAMPLES) * total;
  while (L[seg + 1] < s) seg++;
  const a = P[seg], b = P[(seg + 1) % P.length];
  const u = (s - L[seg]) / Math.max(1e-9, L[seg + 1] - L[seg]);
  Z.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
}
// 5. DFT
const coefs = [];
let c0 = [0, 0];
for (let k = -SAMPLES / 2; k < SAMPLES / 2; k++) {
  let re = 0, im = 0;
  for (let n = 0; n < SAMPLES; n++) {
    const ang = (-2 * Math.PI * k * n) / SAMPLES;
    const c = Math.cos(ang), s = Math.sin(ang);
    re += Z[n][0] * c - Z[n][1] * s;
    im += Z[n][0] * s + Z[n][1] * c;
  }
  re /= SAMPLES; im /= SAMPLES;
  if (k === 0) c0 = [re, im];
  else coefs.push({ k, amp: Math.hypot(re, im), ph: Math.atan2(im, re) });
}
coefs.sort((a, b) => b.amp - a.amp);
const kept = coefs.slice(0, KEEP);
// sai số tái dựng (RMS) với số hạng đã giữ
let err = 0;
for (let n = 0; n < SAMPLES; n++) {
  let x = c0[0], y = c0[1];
  for (const c of kept) {
    const a = c.ph + (2 * Math.PI * c.k * n) / SAMPLES;
    x += c.amp * Math.cos(a); y += c.amp * Math.sin(a);
  }
  err += (x - Z[n][0]) ** 2 + (y - Z[n][1]) ** 2;
}
err = Math.sqrt(err / SAMPLES);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const flat = kept.flatMap((c) => [c.k, r4(c.amp), r4(c.ph)]);
const src = `// TỰ SINH bởi scripts/siren-epicycles.mjs từ public/world/boss/siren.glb — KHÔNG sửa tay.
// Đường viền chính diện (mặt phẳng XY mô hình, đơn vị m, chưa nhân scale) → ${KEEP} hệ số Fourier phức, biên độ giảm dần.
// RMS tái dựng: ${r4(err)} m trên chu vi ${r4(total)} m.
/** tâm (hệ số k = 0) */
export const SIREN_OUTLINE_C0: [number, number] = [${r4(c0[0])}, ${r4(c0[1])}];
/** bộ ba [tần số k, biên độ, pha] × ${KEEP} */
export const SIREN_OUTLINE: readonly number[] = [${flat.join(", ")}];
`;
fs.writeFileSync(OUT, src);
console.log(`contour ${contour.length} px, perimeter ${total.toFixed(2)} m, kept ${KEEP}, RMS ${err.toFixed(4)} m → ${path.relative(ROOT, OUT)}`);
