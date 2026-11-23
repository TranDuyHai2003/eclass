/** Sinh bởi scripts/studio/gen-face-assets.py — không sửa tay. Mốc ghép đầu/thân của tranh nhân vật (đơn vị px của ô 332×272). */
export const BODY_H = 312;
/** Ô trong characters.webp có đầu rời (char-heads.webp) → [tâm x, đường cằm y] */
export const HEAD_ANCHOR: Record<number, [number, number]> = { 0: [162, 173], 1: [163, 176], 4: [163, 157], 6: [160, 153], 7: [155, 144] };
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
