/**
 * Nhóm khối của khoá học cho bộ lọc "Lớp 10 / 11 / 12 / Luyện thi" (trang Khóa học, trang chủ khách).
 * Hàm thuần, không truy vấn DB.
 */

export type CourseGroup = "10" | "11" | "12" | "thi";

export const COURSE_GROUPS: { id: CourseGroup; label: string }[] = [
  { id: "10", label: "Lớp 10" },
  { id: "11", label: "Lớp 11" },
  { id: "12", label: "Lớp 12" },
  { id: "thi", label: "Luyện thi" },
];

const EXAM_RE = /luyện\s*thi|ôn\s*thi|thptqg|thi\s*thpt|thi\s*đại\s*học/i;
/** 10/11/12 đứng riêng: không dính chữ/số trước sau (loại "2026", "2K11") */
const GRADE_RE = /(?:^|[^\p{L}\d])(10|11|12)(?![\p{L}\d])/u;

/**
 * Thứ tự ưu tiên:
 * 1. Tiêu đề có "luyện thi / ôn thi / THPTQG…" → "thi" (khoá luyện thi thường gắn lớp 12 nhưng là nhóm riêng).
 * 2. Mọi lớp gắn khoá cùng một khối → khối đó.
 * 3. Tiêu đề có số 10/11/12 đứng riêng (không phải một phần của "2026") → khối đó.
 * 4. Không xác định → null (chỉ hiện ở "Tất cả").
 */
export function getCourseGroup(course: { title: string; classes?: { grade: number | null }[] | null }): CourseGroup | null {
  const title = course.title.normalize("NFC");
  if (EXAM_RE.test(title)) return "thi";

  const grades = [...new Set((course.classes ?? []).map((c) => c.grade).filter((g): g is number => g === 10 || g === 11 || g === 12))];
  if (grades.length === 1) return String(grades[0]) as CourseGroup;

  const m = title.match(GRADE_RE);
  return m ? (m[1] as CourseGroup) : null;
}

/** Thứ tự hiển thị: 10 → 11 → 12 → luyện thi → chưa rõ */
export function groupOrder(g: CourseGroup | null): number {
  return g === null ? 4 : COURSE_GROUPS.findIndex((x) => x.id === g);
}

/** Bìa thẻ khoá học theo nhóm: nền, màu chữ số lớn, chữ số lớn */
export function groupCover(g: CourseGroup | null, advanced = false): { bg: string; fg: string; big: string } {
  switch (g) {
    case "10":
      return { bg: "#E0F2FE", fg: "#0369A1", big: "10" };
    case "11":
      return { bg: "#DCFCE7", fg: "#15803D", big: "11" };
    case "12":
      return advanced ? { bg: "#FCE7F3", fg: "#9D174D", big: "12+" } : { bg: "#EDE9FE", fg: "#5B21B6", big: "12" };
    case "thi":
      return { bg: "#FEF3C7", fg: "#92400E", big: "ƒ(x)" };
    default:
      return { bg: "#F1EEF8", fg: "#4B4566", big: "∑" };
  }
}

export function groupLabel(g: CourseGroup | null): string | null {
  return COURSE_GROUPS.find((x) => x.id === g)?.label ?? null;
}
