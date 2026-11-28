import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChunkMesh, buildVolume, computeLight, greedyMesh, type Access, type BlockTraits, type Packed } from "@/lib/world/voxel/chunkMesh";
import { meshChunk } from "@/lib/world/mesher";
import { genChunk } from "@/lib/world/worldgen";
import { BLOCK_RGB, EMISSIVE, blockAt, columnRange } from "@/lib/world/voxels";
import { CHUNK } from "@/lib/world/terrain";

const T: BlockTraits = { transparent: (id) => id === 9, emit: (id) => (id === 7 ? 14 : 0), glow: (id) => id === 7 };
function world(blocks: [number, number, number, number?][], range: [number, number] = [0, 6]): Access {
  const m = new Map(blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id ?? 1]));
  return { blockAt: (x, y, z) => m.get(`${x},${y},${z}`) ?? 0, columnRange: () => range, color: () => [1, 1, 1] };
}
const quads = (p: Packed) => p.idx.length / 6;

/** mọi tam giác quay mặt ra theo đúng pháp tuyến đỉnh (cuộn ngược chiều kim đồng hồ nhìn từ ngoài) */
function windingOk(p: Packed): boolean {
  for (let t = 0; t < p.idx.length; t += 3) {
    const [a, b, c] = [p.idx[t], p.idx[t + 1], p.idx[t + 2]];
    const P = (i: number) => [p.p[i * 3], p.p[i * 3 + 1], p.p[i * 3 + 2]];
    const A = P(a);
    const Bv = P(b);
    const C = P(c);
    const u = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const dot = n[0] * p.n[a * 3] + n[1] * p.n[a * 3 + 1] + n[2] * p.n[a * 3 + 2];
    if (dot <= 0) return false;
  }
  return true;
}

test("lõi voxel: một khối lẻ = 6 tứ giác, 24 đỉnh, cuộn đúng", () => {
  const r = buildChunkMesh(0, 0, 8, world([[3, 2, 3]]), T, 2);
  assert.equal(quads(r.solid), 6);
  assert.equal(r.solid.p.length / 3, 24);
  assert.ok(windingOk(r.solid));
});

test("lõi voxel: phiến 4×4 dày 1 giữa không khí → 48 mặt đơn vị gộp còn 6 tứ giác", () => {
  const b: [number, number, number][] = [];
  for (let x = 2; x < 6; x++) for (let z = 2; z < 6; z++) b.push([x, 2, z]);
  const r = buildChunkMesh(0, 0, 8, world(b), T, 2);
  assert.equal(r.faces, 16 + 16 + 16);
  // mặt trên (trời đều 15, AO đều) gộp thành 1; 4 vách gộp thành 4; mặt dưới có ánh trời loang vào từ mép → giữ ô đơn
  let up = 0;
  let side = 0;
  for (let v = 0; v < r.solid.n.length / 3; v += 4) {
    if (r.solid.n[v * 3 + 1] > 0) up++;
    else if (r.solid.n[v * 3 + 1] === 0) side++;
  }
  assert.equal(up, 1);
  assert.equal(side, 4);
  assert.ok(windingOk(r.solid));
});

test("lõi voxel: AO khác nhau giữa các góc → không gộp (mặt trên cạnh bức tường)", () => {
  const b: [number, number, number][] = [];
  for (let x = 2; x < 6; x++) b.push([x, 2, 3]);
  b.push([4, 3, 3]); // khối nhô trên giữa hàng → làm tối góc các mặt trên kề nó
  const r = buildChunkMesh(0, 0, 8, world(b), T, 2);
  // mặt trên của hàng: 3 ô lộ (một ô bị khối nhô che); ô kề khối nhô có AO lệch → không thể là 1 tứ giác
  let tops = 0;
  for (let v = 0; v < r.solid.n.length / 3; v += 4) if (r.solid.n[v * 3 + 1] > 0 && r.solid.p[v * 3 + 1] === 3) tops++;
  assert.ok(tops >= 2, `mặt trên y = 3 phải tách: ${tops}`);
});

test("lõi voxel: phòng kín không có ánh trời; khối phát sáng thắp phòng, giảm dần theo khoảng cách", () => {
  const b: [number, number, number, number?][] = [];
  for (let x = 1; x <= 7; x++)
    for (let y = 0; y <= 6; y++)
      for (let z = 1; z <= 7; z++) {
        const wall = x === 1 || x === 7 || y === 0 || y === 6 || z === 1 || z === 7;
        if (wall) b.push([x, y, z]);
      }
  b.push([4, 1, 4, 7]); // đèn giữa sàn
  const v = buildVolume(0, 0, 8, world(b, [0, 7]), 2);
  computeLight(v, T);
  const at = (L: Uint8Array, x: number, y: number, z: number) => L[((y - v.lo) * v.W + (z - v.z0)) * v.W + (x - v.x0)];
  assert.equal(at(v.sky!, 4, 3, 4), 0);
  assert.equal(at(v.sky!, 4, 9, 4), 15);
  assert.equal(at(v.blk!, 4, 2, 4), 13);
  assert.equal(at(v.blk!, 4, 3, 4), 12);
  assert.ok(at(v.blk!, 2, 2, 2) < at(v.blk!, 4, 2, 3));
  const r = greedyMesh(v, world(b, [0, 7]), T);
  assert.equal(quads(r.glow), 5); // đèn nằm trên sàn: đáy bị che
});

test("lõi voxel: địa hình thật — cùng tập mặt đơn vị với mesher cũ, ít tứ giác hơn nhiều", () => {
  const A: Access = { blockAt, columnRange, color: (_x, _y, _z, id, ny) => BLOCK_RGB[id]?.[ny === 1 ? 0 : 1] ?? [1, 0, 1] };
  const TT: BlockTraits = { transparent: () => false, emit: () => 0, glow: (id) => EMISSIVE.has(id) };
  let oldQ = 0;
  let newFaces = 0;
  let newQ = 0;
  for (const [cx, cz] of [[0, 0], [3, -2], [-5, 4]] as [number, number][]) {
    genChunk(cx, cz);
    const o = meshChunk(cx, cz, CHUNK, { blockAt, columnRange, isGlow: (id) => EMISSIVE.has(id), color: () => [1, 1, 1] });
    oldQ += (o.solid.idx.length + o.glow.idx.length) / 6;
    const r = buildChunkMesh(cx, cz, CHUNK, A, TT, 2);
    newFaces += r.faces;
    newQ += quads(r.solid) + quads(r.glow);
    assert.ok(windingOk(r.solid));
  }
  assert.equal(newFaces, oldQ);
  // đồi gập ghềnh: AO / ánh sáng đổi liên tục nên gộp vừa phải (nghiên cứu: ~1,3–2× trên địa hình nhiễu)
  assert.ok(newQ < oldQ * 0.8, `gộp quá ít: ${newQ} / ${oldQ}`);
});

/** BFS ánh trời đầy đủ (mọi ô lộ trời vào hàng đợi) — tham chiếu cho bản tối ưu "lớp vỏ" */
function skyReference(ids: Uint8Array, W: number, H: number, trans: (id: number) => boolean, extra: (id: number) => number) {
  const layer = W * W;
  const sky = new Uint8Array(ids.length);
  const q: number[] = [];
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      let lvl = 15;
      for (let k = H - 1; k >= 0; k--) {
        const c = k * layer + j * W + i;
        if (!trans(ids[c])) break;
        lvl -= extra(ids[c]);
        if (lvl <= 0) break;
        sky[c] = lvl;
        q.push(c);
      }
    }
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const i = c % W;
    const j = Math.floor(c / W) % W;
    const k = Math.floor(c / layer);
    const nb = [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, j > 0 ? c - W : -1, j < W - 1 ? c + W : -1, k > 0 ? c - layer : -1, k < H - 1 ? c + layer : -1];
    for (const n of nb) {
      if (n < 0 || !trans(ids[n])) continue;
      const nl = sky[c] - 1 - extra(ids[n]);
      if (nl > sky[n]) {
        sky[n] = nl;
        q.push(n);
      }
    }
  }
  return sky;
}

test("lõi voxel: ánh trời tối ưu (chỉ xếp hàng lớp vỏ) trùng BFS đầy đủ — mái nhô, hang, lá cản thêm", () => {
  // mái nhô 5×5 ở y = 4 trên nền y = 0, khối lá (id 9 — trong suốt, cản thêm 1) che một phần
  const blocks: [number, number, number, number?][] = [];
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) blocks.push([x, 0, z]);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) blocks.push([x, 4, z]);
  for (let x = -4; x < -1; x++) for (let z = -3; z < 0; z++) blocks.push([x, 3, z, 9]);
  const Tl: BlockTraits = { ...T, extraOpacity: (id) => (id === 9 ? 1 : 0) };
  const v = buildVolume(0, 0, 4, world(blocks, [0, 6]), 3);
  computeLight(v, Tl);
  const ref = skyReference(v.ids, v.W, v.H, (id) => id === 0 || id === 9, (id) => (id === 9 ? 1 : 0));
  assert.deepEqual(Array.from(v.sky!), Array.from(ref));
  // địa hình thật
  genChunk(0, 0);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) genChunk(a, b);
  const vr = buildVolume(0, 0, CHUNK, { blockAt, columnRange, color: () => [1, 1, 1] }, 8);
  computeLight(vr, T);
  const refR = skyReference(vr.ids, vr.W, vr.H, (id) => id === 0 || id === 9, () => 0);
  let diff = 0;
  for (let c = 0; c < refR.length; c++) if (refR[c] !== vr.sky![c]) diff++;
  assert.equal(diff, 0);
});
