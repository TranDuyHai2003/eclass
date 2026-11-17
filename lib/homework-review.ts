import type { Prisma } from "@prisma/client";

/** Số bài "Đã đạt" tải mỗi lần ở màn Duyệt bài tự luận (tab này có thể lên tới hàng trăm bài). */
export const APPROVED_PAGE_SIZE = 20;

export const reviewSubmissionSelect = {
  id: true,
  status: true,
  feedback: true,
  attachments: true,
  createdAt: true,
  updatedAt: true,
  lessonId: true,
  userId: true,
  user: { select: { id: true, name: true, email: true, image: true, studentType: true } },
  lesson: { select: { title: true, chapter: { select: { course: { select: { title: true } } } } } },
} satisfies Prisma.HomeworkSubmissionSelect;

export type ReviewSubmission = Prisma.HomeworkSubmissionGetPayload<{ select: typeof reviewSubmissionSelect }>;

export const reviewOrderBy = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.HomeworkSubmissionOrderByWithRelationInput[];

/** Điều kiện lọc theo tên khoá học (rỗng = tất cả). */
export function courseTitleFilter(courseTitles: string[]): Prisma.HomeworkSubmissionWhereInput {
  return courseTitles.length > 0 ? { lesson: { chapter: { course: { title: { in: courseTitles } } } } } : {};
}
