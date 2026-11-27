/**
 * Tên hiển thị học sinh tự đặt trong game (hiện trên đầu nhân vật).
 * Thuần, không DOM — server realtime (realtime/server.mjs) dùng đúng quy tắc này (chép lại vì là .mjs).
 * Giữ chữ mọi ngôn ngữ (có dấu tiếng Việt), số, khoảng trắng và . _ ' -; bỏ ký tự điều khiển / vô hình / đảo chiều;
 * gộp khoảng trắng, tối đa NAME_MAX ký tự (đếm theo điểm mã, không cắt đôi emoji/dấu).
 */
export const NAME_MAX = 24;

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N} ._'-]/gu, "")
    .replace(/ +/g, " ")
    .trim();
  return Array.from(s).slice(0, NAME_MAX).join("").trim();
}
