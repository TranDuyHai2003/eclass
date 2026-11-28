// TỰ SINH bởi scripts/studio/cut-item-art.py — không sửa tay.
/** Tranh vẽ tay đã tách nền (public/studio/cut/<id>.webp). Khung: tỉ lệ ảnh / ô khung (>1 = trang trí thò ra ngoài) */
export const CUT_FRAME_SCALE: Record<string, number> = {"frame-royal": 1.0, "frame-laurel": 1.0, "frame-sakura": 1.0, "frame-neon": 1.051, "frame-ice": 1.0265, "frame-catear": 1.0, "frame-fire": 1.0582, "frame-moon": 1.0};
/** Chỗ đặt mặt trong từng khung: [bán kính, lệch ngang, lệch dọc] theo cạnh ô khung (mặt không bị trang trí che) */
export const CUT_FRAME_FACE: Record<string, [number, number, number]> = {"frame-royal": [0.288, 0.014, 0.014], "frame-laurel": [0.293, 0.0, 0.007], "frame-sakura": [0.215, 0.007, 0.0], "frame-neon": [0.296, 0.004, 0.004], "frame-ice": [0.275, -0.007, 0.022], "frame-catear": [0.259, -0.007, -0.033], "frame-fire": [0.25, 0.007, -0.022], "frame-moon": [0.244, 0.065, -0.058]};
export const CUT_PETS = new Set<string>(["pet-bi", "pet-bunny", "pet-dragon", "pet-moka", "pet-owl", "pet-phoenix", "pet-robot", "pet-shiba", "pet-slime"]);
