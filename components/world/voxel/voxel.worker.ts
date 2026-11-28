/// <reference lib="webworker" />
/**
 * Web Worker dựng chunk voxel: sinh khối (lib/world/worldgen) + ánh sáng + lưới tham lam (lib/world/voxel/chunkMesh),
 * trả buffer bằng chuyển nhượng (không sao chép). Giữ bản sao các khối đã sửa (luồng chính gửi "edits").
 * Kèm các cột đã sinh của chunk (khi được hỏi) để luồng chính khỏi sinh lại khi va chạm / dò tia.
 */
import { CHUNK, WATER_LEVEL, blockTop } from "@/lib/world/terrain";
import { genChunk, hmBlock } from "@/lib/world/worldgen";
import { blockAt, columnRange, setBlock } from "@/lib/world/voxels";
import { buildChunkMesh, type Packed } from "@/lib/world/voxel/chunkMesh";
import { BLOCK_TRAITS, blockColor } from "@/lib/world/voxel/palette";
import { WATER_DEPTH_MAX as DEPTH_MAX, buildFarTile } from "@/lib/world/voxel/farTile";
import { isFluidBlock, isSpriteBlock, tileOf, tintFor } from "@/lib/world/voxel/tiles";

const FAR = {
  top: (x: number, z: number) => blockTop(x, z),
  color: (x: number, z: number, t: number) => blockColor(x, t - 1, z, hmBlock(t, t - 1), 1),
  water: WATER_LEVEL,
  waterColor: [0.37, 0.72, 0.9] as [number, number, number],
};

// có hoạ tiết: màu đỉnh = tỉ lệ nhuộm so với màu gốc khối (ảnh mang màu thật), trừ lớp "chi tiết" (xem tiles.ts)
const A = { blockAt, columnRange, color: (x: number, y: number, z: number, id: number, ny: number) => tintFor(blockColor(x, y, z, id, ny), id, ny) };
const TRAITS = { ...BLOCK_TRAITS, tile: tileOf, sprite: isSpriteBlock, fluid: isFluidBlock };
const ctx = self as unknown as DedicatedWorkerGlobalScope;

type MeshJob = { t: "mesh"; key: number; rev: number; cx: number; cz: number; wantGen: boolean; margin: number };
type EditsMsg = { t: "edits"; d: Int32Array };
type FarJob = { t: "far"; key: string; x0: number; z0: number; size: number; step: number };
/** bản đồ độ sâu nước n × n (bước step m) — mặt nước anime: màu nông / sâu, bọt ven bờ */
type DepthJob = { t: "depth"; x0: number; z0: number; n: number; step: number };

function pack(p: Packed, transfer: Transferable[]) {
  const verts = p.p.length / 3;
  const idx = verts < 65536 ? Uint16Array.from(p.idx) : p.idx;
  transfer.push(p.p.buffer, p.n.buffer, p.c.buffer, p.l.buffer, p.t.buffer, idx.buffer);
  return { p: p.p, n: p.n, c: p.c, l: p.l, t: p.t, idx, quads: p.quads };
}

ctx.onmessage = (e: MessageEvent<MeshJob | EditsMsg | FarJob | DepthJob>) => {
  const m = e.data;
  if (m.t === "depth") {
    const d = new Uint8Array(m.n * m.n);
    for (let j = 0; j < m.n; j++)
      for (let i = 0; i < m.n; i++) {
        const h = WATER_LEVEL - blockTop(m.x0 + (i + 0.5) * m.step, m.z0 + (j + 0.5) * m.step);
        d[j * m.n + i] = Math.round((Math.min(DEPTH_MAX, Math.max(0, h)) / DEPTH_MAX) * 255);
      }
    ctx.postMessage({ t: "depth", x0: m.x0, z0: m.z0, n: m.n, step: m.step, d }, [d.buffer]);
    return;
  }
  if (m.t === "far") {
    const r = buildFarTile(m.x0, m.z0, m.size, m.step, FAR);
    ctx.postMessage({ t: "far", key: m.key, x0: m.x0, z0: m.z0, ...r }, [r.p.buffer, r.n.buffer, r.c.buffer, r.idx.buffer]);
    return;
  }
  if (m.t === "edits") {
    const d = m.d;
    for (let i = 0; i < d.length; i += 4) setBlock(d[i], d[i + 1], d[i + 2], d[i + 3], true);
    return;
  }
  if (m.t === "mesh") {
    const t0 = performance.now();
    const gen = genChunk(m.cx, m.cz);
    const tg = performance.now() - t0;
    const r = buildChunkMesh(m.cx, m.cz, CHUNK, A, TRAITS, m.margin);
    const ms = performance.now() - t0;
    const transfer: Transferable[] = [];
    const solid = pack(r.solid, transfer);
    const glow = pack(r.glow, transfer);
    const w = r.water;
    const widx = w.p.length / 3 < 65536 ? Uint16Array.from(w.idx) : w.idx;
    transfer.push(w.p.buffer, w.n.buffer, w.l.buffer, widx.buffer);
    const water = { p: w.p, n: w.n, l: w.l, idx: widx, quads: w.quads };
    ctx.postMessage(
      { t: "mesh", key: m.key, rev: m.rev, cx: m.cx, cz: m.cz, solid, glow, water, faces: r.faces, ms, genMs: tg, gen: m.wantGen ? { cx: gen.cx, cz: gen.cz, cols: gen.cols, ms: gen.ms } : null },
      transfer,
    );
  }
};
