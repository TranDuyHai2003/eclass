"use server";

import { revalidatePath } from "next/cache";
import type { HomeworkReviewLevel } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { demoGuard } from "@/lib/demo";
import { isPointsEnabled } from "@/lib/points/config";
import { loadGameConfig } from "@/lib/game/game-config";
import { REVIEW_LEVELS, setHomeworkReviewInTx } from "@/lib/points/homework";
import { parseVnDateTime } from "@/lib/game/giftcode-shared";

/**
 * Trang "Duyệt chữa bài" (giáo viên + admin): đặt hạn nộp BTVN cho lớp, duyệt chữa bài từng học sinh (0 / +280 / +400).
 * PLAN: docs/ai-reviews/xu-3-actions/PLAN.md
 */
type Result<T = object> = ({ success: true; message: string } & T) | { success: false; error: string };

async function requireStaff() {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || (u.role !== "ADMIN" && u.role !== "TEACHER")) return null;
  return u.id;
}

export async function setHomeworkReview(input: { lessonId: string; userId: string; level: HomeworkReviewLevel }): Promise<Result<{ delta: number; amount: number }>> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  const teacherId = await requireStaff();
  if (!teacherId) return { success: false, error: "Chỉ giáo viên được duyệt bài." };
  if (!REVIEW_LEVELS.includes(input.level)) return { success: false, error: "Mức duyệt không hợp lệ." };
  const [lesson, student] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: String(input.lessonId) }, select: { hasHomework: true } }),
    prisma.user.findUnique({ where: { id: String(input.userId) }, select: { role: true } }),
  ]);
  if (!lesson?.hasHomework) return { success: false, error: "Bài này không có bài tập về nhà." };
  if (student?.role !== "STUDENT") return { success: false, error: "Không tìm thấy học sinh." };
  if (isPointsEnabled()) await loadGameConfig(); // mức xu admin sửa
  const r = await prisma.$transaction(
    (tx) => setHomeworkReviewInTx(tx, { lessonId: input.lessonId, userId: input.userId, level: input.level, teacherId }),
    { timeout: 15000 },
  );
  revalidatePath("/rewards");
  return { success: true, message: "Đã lưu", ...r };
}

export async function setHomeworkDeadline(input: { lessonId: string; classId: string; dueDate: string | null }): Promise<Result<{ dueDate: string | null }>> {
  const blocked = await demoGuard();
  if (blocked) return blocked;
  if (!(await requireStaff())) return { success: false, error: "Chỉ giáo viên được đặt hạn." };
  const [lesson, cls] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: String(input.lessonId) }, select: { hasHomework: true } }),
    prisma.studyClass.findUnique({ where: { id: String(input.classId) }, select: { id: true } }),
  ]);
  if (!lesson?.hasHomework || !cls) return { success: false, error: "Bài hoặc lớp không tồn tại." };
  const where = { lessonId_classId: { lessonId: input.lessonId, classId: input.classId } };
  if (!input.dueDate) {
    await prisma.homeworkDeadline.deleteMany({ where: { lessonId: input.lessonId, classId: input.classId } });
    revalidatePath("/teacher/homework/check");
    return { success: true, message: "Đã bỏ hạn nộp — nộp lúc nào cũng được +xu.", dueDate: null };
  }
  const due = parseVnDateTime(input.dueDate);
  if (!due) return { success: false, error: "Hạn nộp không hợp lệ." };
  await prisma.homeworkDeadline.upsert({ where, create: { lessonId: input.lessonId, classId: input.classId, dueDate: due }, update: { dueDate: due } });
  revalidatePath("/teacher/homework/check");
  return { success: true, message: "Đã lưu hạn nộp.", dueDate: due.toISOString() };
}
