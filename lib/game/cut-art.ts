// TỰ SINH bởi scripts/studio/cut-item-art.py — không sửa tay.
/** Tranh vẽ tay đã tách nền (public/studio/cut/<id>.webp). Khung: tỉ lệ ảnh / ô khung (>1 = trang trí thò ra ngoài) */
export const CUT_FRAME_SCALE: Record<string, number> = {"frame-royal": 1.0, "frame-laurel": 1.0, "frame-sakura": 1.0, "frame-neon": 1.051, "frame-ice": 1.0265, "frame-catear": 1.0, "frame-fire": 1.0582, "frame-moon": 1.0};
/** Chỗ đặt mặt trong từng khung: [bán kính, lệch ngang, lệch dọc] theo cạnh ô khung (mặt không bị trang trí che) */
export const CUT_FRAME_FACE: Record<string, [number, number, number]> = {"frame-royal": [0.29, 0.0, 0.0], "frame-laurel": [0.29, 0.0, 0.0], "frame-sakura": [0.26, 0.0, 0.0], "frame-neon": [0.29, 0.0, 0.0], "frame-ice": [0.272, 0.0, 0.0], "frame-catear": [0.246, 0.0, 0.0], "frame-fire": [0.247, 0.0, 0.0], "frame-moon": [0.241, 0.059, -0.057]};
export const CUT_PETS = new Set<string>(["pet-bi", "pet-bunny", "pet-dragon", "pet-moka", "pet-owl", "pet-phoenix", "pet-robot", "pet-shiba", "pet-slime"]);
