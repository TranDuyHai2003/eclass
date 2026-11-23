/** Sinh bởi scripts/studio/gen-face-assets.py — không sửa tay. Mốc ghép đầu/thân của tranh nhân vật (đơn vị px của ô 332×272). */
export const BODY_H = 312;
/** Ô trong characters.webp có đầu rời (char-heads.webp) → [tâm x, đường cằm y] */
export const HEAD_ANCHOR: Record<number, [number, number]> = { 0: [162, 173], 1: [163, 176], 4: [163, 157], 6: [160, 153], 7: [155, 144], 8: [155, 152], 9: [155, 152], 10: [155, 152], 11: [155, 152], 12: [155, 152], 13: [162, 173], 14: [162, 173] };
/** Số ô của char-heads / char-hair / char-eyes / char-facemask / char-hairback (8 ô tranh + ô 8 = tóc bob không hoa + kiểu tóc vẽ thêm) */
export const HEAD_CELLS_N = 15;
/** Đầu vẽ thêm kiểu tóc: ô → [kiểu tóc, mẫu gốc (màu tóc/mắt/mặt gốc)] */
export const HAIR_HEADS: Record<number, [string, number]> = { 9: ["hair-ponytail", 7], 10: ["hair-twin", 7], 11: ["hair-long", 7], 12: ["hair-bun", 7], 13: ["hair-spiky", 0], 14: ["hair-mohawk", 0] };
/** Ô có tóc sau lưng trong char-hairback.webp (ô cao 272 + HAIR_BACK_TOP, vẽ trước thân) */
export const HAIR_BACK_TOP = 40;
export const HAIR_BACK: number[] = [8, 9, 10, 11, 12, 13, 14];
/** Mắt của từng ô (dán khuôn mặt đã chọn): [giữa hai mắt x, y, khoảng cách hai mắt] */
export const EYE_GEO: Record<number, [number, number, number]> = { 0: [162.3, 122.4, 64.4], 1: [162.7, 132.3, 60.4], 2: [159.1, 118.7, 58.2], 3: [157.7, 122.4, 59.7], 4: [163.1, 107.0, 63.2], 6: [159.8, 103.8, 65.6], 7: [155.1, 99.2, 58.4], 8: [155.1, 107.2, 58.4], 9: [155.1, 107.2, 58.4], 10: [155.1, 107.2, 58.4], 11: [155.1, 107.2, 58.4], 12: [155.1, 107.2, 58.4], 13: [162.3, 122.4, 64.4], 14: [162.3, 122.4, 64.4] };
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
