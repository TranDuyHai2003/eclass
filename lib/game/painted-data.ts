/** Sinh bởi scripts/studio/gen-face-assets.py — không sửa tay. Mốc ghép đầu/thân của tranh nhân vật (đơn vị px của ô 332×272). */
export const BODY_H = 312;
/** Ô trong characters.webp có đầu rời (char-heads.webp) → [tâm x, đường cằm y] */
export const HEAD_ANCHOR: Record<number, [number, number]> = { 0: [162, 173], 1: [163, 176], 4: [163, 157], 6: [160, 153], 7: [155, 144], 8: [155, 152] };
/** Số ô của char-heads / char-hair / char-eyes / char-facemask (8 ô tranh + ô 8 = tóc bob không hoa) */
export const HEAD_CELLS_N = 9;
/** Mắt của từng ô (dán khuôn mặt đã chọn): [giữa hai mắt x, y, khoảng cách hai mắt] */
export const EYE_GEO: Record<number, [number, number, number]> = { 0: [162.3, 122.4, 64.4], 1: [162.7, 132.3, 60.4], 2: [159.1, 118.7, 58.2], 3: [157.7, 122.4, 59.7], 4: [163.1, 107.0, 63.2], 6: [159.8, 103.8, 65.6], 7: [155.1, 99.2, 58.4], 8: [155.1, 107.2, 58.4] };
/** Thân theo trang phục: thứ tự ô trong char-bodies.webp, [tâm x, đường cằm y] của tranh gốc */
export const BODIES: { outfit: string; anchor: [number, number] }[] = [
  { outfit: "outfit-uniform", anchor: [162, 173] },
  { outfit: "outfit-wizard", anchor: [163, 176] },
  { outfit: "outfit-scientist", anchor: [163, 157] },
  { outfit: "outfit-gamer", anchor: [160, 153] },
  { outfit: "outfit-kimono", anchor: [155, 144] },
  { outfit: "outfit-tee", anchor: [160, 153] },
  { outfit: "outfit-hoodie", anchor: [160, 153] },
  { outfit: "outfit-ninja", anchor: [160, 153] },
  { outfit: "outfit-dress", anchor: [155, 144] },
  { outfit: "outfit-sport", anchor: [162, 173] },
  { outfit: "outfit-royal", anchor: [163, 176] },
];
