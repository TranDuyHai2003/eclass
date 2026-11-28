/**
 * Màu + đặc tính khối cho lõi voxel (thuần — dùng chung luồng chính / Web Worker).
 * Màu mặt theo biome (cỏ đổi theo vùng, biome toán học tô theo công thức); KHÔNG còn sắc độ ngẫu nhiên từng khối ở đây
 * (đã chuyển vào fragment shader theo ô nguyên để lưới tham lam gộp được) và KHÔNG còn mẹo tô tối hang (đã có ánh trời).
 */
import { B } from "../blocks";
import { BLOCK_RGB, EMISSIVE } from "../voxels";
import { biome, blockTop, groundColor } from "../terrain";
import type { BlockTraits } from "./chunkMesh";

export function blockColor(x: number, y: number, z: number, id: number, ny: number): [number, number, number] {
  let rgb = BLOCK_RGB[id]?.[ny === 1 ? 0 : 1] ?? [1, 0, 1];
  if (id === B.grass && ny === 1) {
    const top = blockTop(x, z);
    if (y < top + 9) {
      // gờ nhô sát mặt đất theo màu biome; đảo nổi cao hơn giữ màu cỏ gốc
      const bi = biome(x, z);
      if (bi === "crystal") rgb = [0.36, 0.66, 0.68];
      else if (bi === "dusk") rgb = [0.72, 0.5, 0.66];
      else if (bi !== "meadow") rgb = groundColor(x, z, y + 1, bi) as [number, number, number];
    }
  }
  return rgb;
}

/** mức phát sáng (0..15) theo khối */
const EMIT: Record<number, number> = { [B.crystal]: 11, [B.gold]: 7, [B.glass]: 5, [B.torch]: 14, [B.intcrystal]: 4 };

export const BLOCK_TRAITS: BlockTraits = {
  transparent: (id) => id === B.glass,
  emit: (id) => EMIT[id] ?? 0,
  glow: (id) => EMISSIVE.has(id),
  extraOpacity: () => 0,
};
