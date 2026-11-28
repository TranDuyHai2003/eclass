/**
 * Hoạ tiết khối (G2): danh sách lớp trong DataArrayTexture + khối → lớp theo mặt (trên / cạnh / dưới).
 * Hai chế độ (ảnh đã chuẩn hoá sẵn khi đóng gói — `scripts/voxel-tiles.py`):
 *  - "màu": ảnh giữ màu thật, trung bình mỗi kênh = màu gốc BLOCK_RGB của khối; màu đỉnh = tỉ lệ nhuộm × 0,5 (≈ 0,5) × AO × bóng;
 *  - "chi tiết": ảnh xám = (độ sáng / độ sáng trung bình) × 0,5, màu đỉnh đầy đủ (cỏ đổi màu theo biome: giấy kẻ ô, Voronoi…).
 * Shader: màu = màu đỉnh × ảnh × 2 (cả hai chế độ).
 */
import { B } from "../blocks";
import { BLOCK_RGB } from "../voxels";

/** thứ tự lớp = thứ tự ảnh trong public/world/voxel/tiles.png (dải dọc, mỗi ô TILE_PX × TILE_PX) */
export const TILE_NAMES = [
  "grass_top", "grass_side", "dirt", "stone", "sand", "snow", "crystal", "gold", "bark", "wood_top", "leaf", "glass",
  "blossom", "pine", "plank", "brick", "mossbrick", "rope", "ore_integer", "ore_copper", "torch", "bench_top", "bench_side",
] as const;
export const TILE_PX = 64;
export const NO_TILE = 255;
const L = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i])) as Record<(typeof TILE_NAMES)[number], number>;

/** khối vẽ bằng sprite riêng (không sinh mặt trong lưới chunk; ánh sáng đi qua) — xem components/world/voxel/TorchSprites.tsx */
export const isSpriteBlock = (id: number) => id === B.torch || id === B.water;
/** nguồn nước: dòng chảy + lưới nước riêng (lib/world/voxel/chunkMesh.ts computeFlow / fluidMesh) */
export const isFluidBlock = (id: number) => id === B.water;

/** lớp "chi tiết" (ảnh xám nhân màu đỉnh đầy đủ) */
export const DETAIL_TILES = new Set<number>([L.grass_top]);

/** khối → [trên, cạnh, dưới] */
const TILE_OF: Record<number, [number, number, number]> = {
  [B.grass]: [L.grass_top, L.grass_side, L.dirt],
  [B.dirt]: [L.dirt, L.dirt, L.dirt],
  [B.stone]: [L.stone, L.stone, L.stone],
  [B.sand]: [L.sand, L.sand, L.sand],
  [B.snow]: [L.snow, L.snow, L.snow],
  [B.crystal]: [L.crystal, L.crystal, L.crystal],
  [B.gold]: [L.gold, L.gold, L.gold],
  [B.wood]: [L.wood_top, L.bark, L.wood_top],
  [B.leaf]: [L.leaf, L.leaf, L.leaf],
  [B.glass]: [L.glass, L.glass, L.glass],
  [B.blossom]: [L.blossom, L.blossom, L.blossom],
  [B.pine]: [L.pine, L.pine, L.pine],
  [B.plank]: [L.plank, L.plank, L.plank],
  [B.ruin]: [L.brick, L.brick, L.brick],
  [B.moss]: [L.mossbrick, L.mossbrick, L.mossbrick],
  [B.rope]: [L.rope, L.rope, L.rope],
  [B.intcrystal]: [L.ore_integer, L.ore_integer, L.ore_integer],
  [B.copper]: [L.ore_copper, L.ore_copper, L.ore_copper],
  [B.torch]: [L.torch, L.torch, L.torch],
  [B.bench]: [L.bench_top, L.bench_side, L.plank],
};

/** lớp hoạ tiết của mặt (ny = 1 trên, −1 dưới, 0 cạnh); NO_TILE = không hoạ tiết */
export function tileOf(id: number, ny: number): number {
  const t = TILE_OF[id];
  if (!t) return NO_TILE;
  return ny > 0 ? t[0] : ny < 0 ? t[2] : t[1];
}

/** màu gốc của lớp (để chuẩn hoá ảnh "màu"): mặt đầu tiên dùng lớp này */
export function tileBase(layer: number): [number, number, number] | null {
  for (const [id, t] of Object.entries(TILE_OF)) {
    const k = t.indexOf(layer);
    if (k < 0) continue;
    const rgb = BLOCK_RGB[Number(id)];
    if (!rgb) return null;
    return k === 0 ? rgb[0] : rgb[1];
  }
  return null;
}

/**
 * Màu đỉnh khi có hoạ tiết: lớp "màu" → tỉ lệ nhuộm (màu mặt / màu gốc của khối, kẹp 0,5…1,6 — cỏ đổi theo biome vẫn
 * nhuộm nhẹ); lớp "chi tiết" / không hoạ tiết → màu đầy đủ.
 */
export function tintFor(rgb: [number, number, number], id: number, ny: number): [number, number, number] {
  const layer = tileOf(id, ny);
  if (layer === NO_TILE || DETAIL_TILES.has(layer)) return rgb;
  const base = BLOCK_RGB[id]?.[ny > 0 ? 0 : 1];
  if (!base) return rgb;
  const r = (c: number, b: number) => Math.min(1.6, Math.max(0.5, c / Math.max(0.05, b)));
  // ≤ 1 lưu được trong Uint8 chuẩn hoá: chia 2 ở đây, shader nhân lại (cùng hệ số với ảnh)
  return [r(rgb[0], base[0]) * 0.5, r(rgb[1], base[1]) * 0.5, r(rgb[2], base[2]) * 0.5];
}
