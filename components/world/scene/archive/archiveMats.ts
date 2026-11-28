/**
 * Vật liệu PBR của Thư khố — SINH TỰ ĐỘNG từ archive.blend (script xuất trong PLAN, docs/ai-reviews/archive-real/PLAN.md).
 * Texture 1K WebP ở public/world/archive/tex/ (Poly Haven CC0); phép trộn màu Mix của Blender đã nướng sẵn vào ảnh khuếch tán.
 */
export interface ArchiveMat {
  color?: [number, number, number];
  rough?: number;
  metal?: number;
  map?: string;
  normalMap?: string;
  normalScale?: number;
  roughnessMap?: string;
  metalnessMap?: string;
  emissive?: [number, number, number];
  emissiveIntensity?: number;
  transmission?: number;
}

export const ARCHIVE_MATS: Record<string, ArchiveMat> = {
  bk_carpet: { color: [1,1,1], rough: 1, metal: 0, map: "bk_carpet_d.webp", roughnessMap: "dirty_carpet_rough_r.webp", normalMap: "dirty_carpet_nor_gl_n.webp", normalScale: 1 },
  bk_ceiling: { color: [1,1,1], rough: 1, metal: 0, map: "bk_ceiling_d.webp", roughnessMap: "painted_plaster_wall_rough_r.webp", normalMap: "painted_plaster_wall_nor_gl_n.webp", normalScale: 0.4 },
  emit_fluoro: { color: [0.95,0.97,1], rough: 0.3, metal: 0, emissive: [0.92,0.97,1], emissiveIntensity: 14 },
  bk_trim: { color: [1,1,1], rough: 1, metal: 0, map: "bk_trim_d.webp", roughnessMap: "dark_wood_rough_r.webp", normalMap: "dark_wood_nor_gl_n.webp", normalScale: 1 },
  bk_fluoro_off: { color: [0.55,0.57,0.58], rough: 0.3, metal: 0 },
  bk_wallpaper: { color: [1,1,1], rough: 1, metal: 0, map: "bk_wallpaper_d.webp", roughnessMap: "decrepit_wallpaper_rough_r.webp", normalMap: "decrepit_wallpaper_nor_gl_n.webp", normalScale: 1 },
  bk_concrete: { color: [1,1,1], rough: 1, metal: 0, map: "bk_concrete_d.webp", roughnessMap: "cracked_concrete_wall_rough_r.webp", normalMap: "cracked_concrete_wall_nor_gl_n.webp", normalScale: 1 },
  bk_door: { color: [1,1,1], rough: 1, metal: 1, map: "bk_door_d.webp", roughnessMap: "rusty_painted_metal_rough_r.webp", normalMap: "rusty_painted_metal_nor_gl_n.webp", normalScale: 1 },
  bk_hazard_y: { color: [0.85,0.62,0.05], rough: 0.55, metal: 0 },
  bk_hazard_k: { color: [0.04,0.04,0.04], rough: 0.6, metal: 0 },
  emit_red: { color: [0.9,0.1,0.05], rough: 0.3, metal: 0, emissive: [1,0.08,0.03], emissiveIntensity: 18 },
  bk_steel: { color: [1,1,1], rough: 1, metal: 1, map: "bk_steel_d.webp", roughnessMap: "painted_metal_shutter_rough_r.webp", normalMap: "painted_metal_shutter_nor_gl_n.webp", normalScale: 1 },
  steel_frame_shelves_01: { color: [1,1,1], rough: 1, metal: 1, map: "steel_frame_shelves_01_d.webp", roughnessMap: "steel_frame_shelves_01_arm_arm.webp", normalMap: "steel_frame_shelves_01_nor_gl_n.webp", normalScale: 1, metalnessMap: "steel_frame_shelves_01_arm_arm.webp" },
  bk_books: { color: [1,1,1], rough: 0.7, metal: 0, map: "bk_books_d.webp", normalMap: "books_nor_n.webp", normalScale: 1 },
  pbr_floor: { color: [1,1,1], rough: 1, metal: 0, map: "pbr_floor_d.webp", roughnessMap: "weathered_brown_planks_rough_r.webp", normalMap: "weathered_brown_planks_nor_gl_n.webp", normalScale: 1 },
  pbr_plaster: { color: [1,1,1], rough: 1, metal: 0, map: "pbr_plaster_d.webp", roughnessMap: "painted_plaster_wall_rough_r.webp", normalMap: "painted_plaster_wall_nor_gl_n.webp", normalScale: 1 },
  pbr_wainscot: { color: [0.18,0.11,0.07], rough: 0.45, metal: 0 },
  pbr_beam: { color: [0.16,0.1,0.06], rough: 0.6, metal: 0 },
  pbr_concrete: { color: [0.45,0.43,0.4], rough: 0.9, metal: 0 },
  pbr_metal: { color: [0.25,0.22,0.2], rough: 0.5, metal: 1 },
  glass: { color: [0.8,0.85,0.9], rough: 0.08, metal: 0, transmission: 1 },
  emit_moonsky: { emissive: [0.45,0.58,0.85], emissiveIntensity: 6 },
};

/** thang lightmap (giá trị thật = texel sRGB→tuyến tính × thang) — public/world/archive/_scales.json */
export const LM_SCALE: Record<string, number> = { mod_cell: 8.5869, mod_cell_dark: 1.0335, mod_wall: 2.3382, mod_pillar: 31.1007, mod_door: 2.18, mod_shelf: 3.874, arch_hall: 4.7788 };
