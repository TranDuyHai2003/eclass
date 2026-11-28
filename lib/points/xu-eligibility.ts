import type { Tx } from "./engine";

/**
 * Điều kiện được xu khi nộp bài tập về nhà (28/11/2026, thầy báo):
 *  - "có đứa bug xu bằng cách làm bài của khoá lớp dưới" → chỉ bài thuộc KHOÁ CỦA LỚP MÌNH mới có xu
 *    (khoá gắn lớp: phải đúng lớp; khoá không gắn lớp nào: đúng trình độ). Học sinh chưa xếp lớp thấy mọi khoá
 *    → chỉ có xu ở khoá không gắn lớp. Không chặn việc nộp / làm bài, chỉ không cộng xu.
 *  - "không cộng xu khi nộp lại bài tập cũ" → bài chưa đặt hạn chỉ có xu khi bài còn MỚI (giao trong 30 ngày);
 *    bài cũ hơn muốn có xu thì thầy đặt hạn nộp.
 */
export const FRESH_WORK_DAYS = 30;

export const isFreshWork = (createdAt: Date, now: Date = new Date()) => now.getTime() - createdAt.getTime() <= FRESH_WORK_DAYS * 86_400_000;

/** Khoá học có tính xu cho học sinh này không (theo lớp / trình độ) */
export async function courseCountsForXu(tx: Tx, userId: string, courseId: string): Promise<boolean> {
  const [user, course] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { classId: true, level: true } }),
    tx.course.findUnique({ where: { id: courseId }, select: { level: true, classes: { select: { id: true } } } }),
  ]);
  if (!user || !course) return false;
  if (course.classes.length > 0) return !!user.classId && course.classes.some((c: { id: string }) => c.id === user.classId);
  return course.level === user.level;
}

/** Hạn đúng / chưa có hạn mà bài còn mới → được xu "nộp đúng hạn" */
export function homeworkOnTimeForXu(status: "none" | "on-time" | "late", createdAt: Date, now: Date = new Date()) {
  return status === "on-time" || (status === "none" && isFreshWork(createdAt, now));
}
