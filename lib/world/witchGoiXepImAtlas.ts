// SINH TỰ ĐỘNG bởi scripts/siren-witch-goixepim.py — đừng sửa tay.
// Khung uv (u0, v0, u1, v1; gốc dưới-trái như WebGL) của phần hình thật trong từng ô atlas 4 × 4
// public/world/siren/witches/goixepim.webp (tranh Codex: blender-src/siren-src/witches/goixepim/BRIEF.md).
export const GX_ATLAS = "siren/witches/goixepim.webp";
export const GX_CELL = { pillowfront: 0, gusset: 1, eyeopen: 2, eyeclosed: 3, eyeunravel: 4, endclamp: 5, pleatpanel: 6, seamstrip: 7, thread0: 8, thread1: 9, thread2: 10, spoolbody: 11, spoolthread: 12, clamplingjaw: 13, pouch: 14, shadow: 15 } as const;
export const GX_RECTS: readonly (readonly [number, number, number, number])[] = [
  [0.00391, 0.79932, 0.24609, 0.95068],
  [0.32959, 0.75391, 0.41992, 0.99609],
  [0.50391, 0.78955, 0.74609, 0.96094],
  [0.75391, 0.78955, 0.99609, 0.96094],
  [0.00391, 0.53955, 0.24609, 0.71045],
  [0.32422, 0.50391, 0.42578, 0.74609],
  [0.56982, 0.50391, 0.68018, 0.74609],
  [0.85596, 0.50391, 0.89355, 0.74609],
  [0.05273, 0.25391, 0.19727, 0.49609],
  [0.28613, 0.25391, 0.46338, 0.49609],
  [0.53369, 0.25391, 0.71631, 0.49609],
  [0.76709, 0.25391, 0.98242, 0.49609],
  [0.11426, 0.00391, 0.13525, 0.24609],
  [0.25391, 0.06885, 0.49609, 0.18115],
  [0.50391, 0.01465, 0.74609, 0.23584],
  [0.75391, 0.07500, 0.99609, 0.17500],
];
