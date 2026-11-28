/**
 * Asset có bản nén texture KTX2 (Basis Universal) — sinh bằng `node scripts/ktx2-convert.mjs <thư mục>`, ghi vào thư mục con
 * `ktx2/` cạnh bản gốc (bản gốc giữ nguyên). Chỉ asset trong danh sách này mới đổi đường dẫn; tải hỏng (máy không giải mã được,
 * kho asset chưa có file) → game tải lại bản gốc (components/world/fx/ktx2.ts).
 * Chỉ VRM nhân vật có texture nhúng; GLB đạo cụ / animation dùng màu đỉnh (không có ảnh) nên không cần.
 */
export const KTX2_READY = new Set(
  [
    "adventurer", "boy02", "cute-cat", "cute-girl", "elf", "fumiriya", "hoodie", "jitome", "ki", "kimono", "kokia",
    "mono", "rougan", "sample-a", "sample-b", "sample-c", "savi", "school-girl", "spacesuit", "tvhead", "virdira",
  ].map((id) => `avatars/${id}.vrm`),
);

/** URL bản KTX2 của một asset (null nếu chưa có): ".../avatars/ki.vrm" → ".../avatars/ktx2/ki.vrm" (giữ nguyên gốc / query) */
export function ktx2Url(url: string): string | null {
  const m = /^(.*\/)?([\w-]+)\/([\w.-]+\.(?:vrm|glb))(\?.*)?$/.exec(url);
  if (!m) return null;
  const [, head = "", dir, file, query = ""] = m;
  if (!KTX2_READY.has(`${dir}/${file}`)) return null;
  return `${head}${dir}/ktx2/${file}${query}`;
}
