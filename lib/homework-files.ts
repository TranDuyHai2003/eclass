import { B2_BUCKET_NAME, CDN_DOMAIN } from "./cdn-url";

/**
 * Tệp bài tập về nhà học sinh tải lên (qua /api/upload/proxy, tên bắt đầu "homework_"):
 * khoá B2 dạng  images|documents/<nanoid 21>-homework[-_]…   (26/11/2026: 100% tệp BTVN trên prod khớp mẫu này).
 *
 * Vì sao cần: trước đây submitHomework / deleteDraftFile nhận mọi URL → học sinh có thể
 *  - nộp bài rỗng / URL bất kỳ để lấy +100 xu nộp đúng hạn;
 *  - xoá tệp bất kỳ trong bucket (ảnh, tài liệu bài giảng của thầy, bài của bạn khác) bằng cách gửi URL của nó.
 */
export const HOMEWORK_KEY_RE = /^(images|documents)\/[A-Za-z0-9_-]{21}-homework[-_][^/]{1,240}$/;
export const MAX_HOMEWORK_FILES = 30;

const cdnHost = (() => {
  try {
    return new URL(CDN_DOMAIN.replace(/\/file\/.*$/, "")).hostname;
  } catch {
    return "cdn.teacherduc.me";
  }
})();

/** URL → khoá B2 nếu là tệp BTVN hợp lệ trên CDN / B2 của mình; ngược lại null */
export function homeworkKeyOf(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 600) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.search || u.hash) return null;
  const host = u.hostname;
  if (host !== cdnHost && host !== "cdn.teacherduc.me" && !/^[a-z0-9.-]+\.backblazeb2\.com$/.test(host)) return null;
  let path = decodeURIComponent(u.pathname).replace(/^\/+/, "");
  const prefix = `file/${B2_BUCKET_NAME}/`;
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  if (path.includes("..")) return null;
  return HOMEWORK_KEY_RE.test(path) ? path : null;
}

export type HomeworkAttachment = { name: string; url: string; size?: number };

/**
 * Kiểm tra danh sách tệp nộp: 1–30 tệp, mỗi tệp là tệp BTVN hợp lệ (hoặc tệp đã có sẵn trong bài nộp cũ của chính học sinh),
 * không trùng; trả về danh sách đã làm sạch hoặc thông báo lỗi.
 */
export function cleanHomeworkAttachments(input: unknown, alreadyMine: string[] = []): { ok: HomeworkAttachment[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: "Vui lòng tải lên ít nhất một tệp." };
  if (input.length > MAX_HOMEWORK_FILES) return { error: `Tối đa ${MAX_HOMEWORK_FILES} tệp mỗi lần nộp.` };
  const seen = new Set<string>();
  const out: HomeworkAttachment[] = [];
  for (const f of input) {
    if (!f || typeof f !== "object") return { error: "Tệp không hợp lệ." };
    const { name, url, size } = f as Record<string, unknown>;
    if (typeof url !== "string" || (!homeworkKeyOf(url) && !alreadyMine.includes(url))) return { error: "Tệp không hợp lệ — em tải lại tệp nhé." };
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: typeof name === "string" && name.trim() ? name.slice(0, 200) : "tệp",
      url,
      ...(typeof size === "number" && Number.isFinite(size) && size >= 0 ? { size: Math.floor(size) } : {}),
    });
  }
  return { ok: out };
}
