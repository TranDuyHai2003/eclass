import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, B } from "@/lib/world/blocks";
import { BLOCK_RGB } from "@/lib/world/voxels";
import { DETAIL_TILES, NO_TILE, TILE_NAMES, isFluidBlock, tileBase, tileOf, tintFor } from "@/lib/world/voxel/tiles";
import { buildVolume, greedyMesh, type Access, type BlockTraits } from "@/lib/world/voxel/chunkMesh";

test("hoạ tiết khối: mọi khối có màu đều có lớp hợp lệ cho cả 3 mặt; mỗi lớp có màu gốc", () => {
  for (let id = 1; id < BLOCKS.length; id++) {
    if (!BLOCK_RGB[id] || isFluidBlock(id)) continue; // nước vẽ bằng lưới nước riêng, không dùng hoạ tiết
    for (const ny of [1, 0, -1]) {
      const t = tileOf(id, ny);
      assert.ok(t !== NO_TILE && t < TILE_NAMES.length, `${BLOCKS[id]} ny ${ny}`);
    }
  }
  for (let l = 0; l < TILE_NAMES.length; l++) if (!DETAIL_TILES.has(l)) assert.ok(tileBase(l), TILE_NAMES[l]);
  assert.equal(tileOf(0, 1), NO_TILE);
});

test("hoạ tiết khối: màu đỉnh = tỉ lệ nhuộm × 0,5 cho lớp màu; giữ nguyên cho lớp chi tiết (cỏ trên)", () => {
  const base = BLOCK_RGB[B.stone][0];
  assert.deepEqual(tintFor(base, B.stone, 1), [0.5, 0.5, 0.5]);
  const t = tintFor([base[0] * 0.8, base[1], base[2] * 10], B.stone, 1);
  assert.ok(Math.abs(t[0] - 0.4) < 1e-9);
  assert.equal(t[2], 0.8); // kẹp 1,6 × 0,5
  const g: [number, number, number] = [0.88, 0.9, 0.98];
  assert.deepEqual(tintFor(g, B.grass, 1), g);
  assert.notDeepEqual(tintFor(g, B.grass, 0), g);
});

test("hoạ tiết khối: lưới ghi lớp theo mặt (trên / cạnh / dưới) cho từng đỉnh", () => {
  const A: Access = { blockAt: (x, y, z) => (x === 0 && y === 1 && z === 0 ? B.grass : 0), columnRange: () => [0, 3], color: () => [1, 1, 1] };
  const T: BlockTraits = { transparent: () => false, emit: () => 0, glow: () => false, tile: tileOf };
  const v = buildVolume(0, 0, 4, A, 2);
  const r = greedyMesh(v, A, T);
  assert.equal(r.solid.t.length, r.solid.p.length / 3);
  const seen = new Map<number, number>();
  for (let i = 0; i < r.solid.t.length; i++) {
    const ny = r.solid.n[i * 3 + 1];
    const want = tileOf(B.grass, ny > 0 ? 1 : ny < 0 ? -1 : 0);
    assert.equal(r.solid.t[i], want);
    seen.set(want, (seen.get(want) ?? 0) + 1);
  }
  assert.equal(seen.size, 3);
});
