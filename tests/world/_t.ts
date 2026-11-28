import { buildChunkMesh } from "@/lib/world/voxel/chunkMesh";
import { BLOCK_TRAITS, blockColor } from "@/lib/world/voxel/palette";
import { blockAt, columnRange, setBlock } from "@/lib/world/voxels";
import { genChunk } from "@/lib/world/worldgen";
import { blockTop } from "@/lib/world/terrain";
import { B } from "@/lib/world/blocks";
import { isSpriteBlock, tileOf } from "@/lib/world/voxel/tiles";
for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) genChunk(a, b);
const x = 2, z = 0, y = blockTop(2, 0);
console.log("top", y, "below", blockAt(x, y - 1, z), "at", blockAt(x, y, z), "range", columnRange(x, z));
setBlock(x, y, z, B.torch, true);
console.log("after", blockAt(x, y, z), "range", columnRange(x, z));
const r = buildChunkMesh(0, 0, 32, { blockAt, columnRange, color: blockColor }, { ...BLOCK_TRAITS, tile: tileOf, sprite: isSpriteBlock }, 8);
const P = r.solid;
let best = 0;
for (let i = 0; i < P.p.length / 3; i++) {
  const vx = P.p[i * 3], vy = P.p[i * 3 + 1], vz = P.p[i * 3 + 2];
  if (Math.abs(vx - x) <= 2 && Math.abs(vz - z) <= 2 && Math.abs(vy - y) <= 1) best = Math.max(best, P.l[i * 2 + 1]);
}
console.log("max block light near torch (0..255):", best);
