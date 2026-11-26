import type { HomeworkReviewLevel } from "@prisma/client";
import { POINTS } from "./config";
import { awardOnce, isEligibleStudent, lockWallet, revokeKey, type Tx } from "./engine";

/**
 * Bài tập về nhà theo cơ chế xu mới (26/11/2026, docs/ai-reviews/xu-3-actions/PLAN.md):
 * - hạn nộp riêng từng lớp (HomeworkDeadline) → nộp trước hạn mới được +100 xu;
 * - giáo viên duyệt chữa bài trên lớp: Chưa chữa 0 / Có chữa +280 / Chữa đủ, tốt +400 (đổi mức → thu hồi mức cũ, cộng mức mới).
 */

export const REVIEW_LEVELS: HomeworkReviewLevel[] = ["NONE", "PARTIAL", "FULL"];
export const reviewKey = (lessonId: string) => `HWREVIEW:${lessonId}`;
export const reviewAmount = (level: HomeworkReviewLevel) =>
  level === "FULL" ? POINTS.homeworkReview.full : level === "PARTIAL" ? POINTS.homeworkReview.partial : 0;
export const REVIEW_LABEL: Record<HomeworkReviewLevel, string> = { NONE: "Chưa chữa", PARTIAL: "Có chữa", FULL: "Chữa đủ, tốt" };

/** Hạn nộp BTVN của học sinh (theo lớp); null = chưa đặt hạn */
export async function homeworkDueFor(tx: Tx, lessonId: string, userId: string): Promise<Date | null> {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { classId: true } });
  if (!u?.classId) return null;
  const d = await tx.homeworkDeadline.findUnique({ where: { lessonId_classId: { lessonId, classId: u.classId } }, select: { dueDate: true } });
  return d?.dueDate ?? null;
}

/**
 * Lưu mức duyệt chữa bài và điều chỉnh xu trong CÙNG giao dịch (khoá ví → bấm liên tục không cộng trùng).
 * Trả về số xu thay đổi (âm khi hạ mức). Học sinh chưa duyệt / demo: vẫn lưu mức, không cộng xu.
 */
export async function setHomeworkReviewInTx(
  tx: Tx,
  p: { lessonId: string; userId: string; level: HomeworkReviewLevel; teacherId: string },
): Promise<{ delta: number; amount: number }> {
  await tx.homeworkReview.upsert({
    where: { lessonId_userId: { lessonId: p.lessonId, userId: p.userId } },
    create: { lessonId: p.lessonId, userId: p.userId, level: p.level, reviewedById: p.teacherId },
    update: { level: p.level, reviewedById: p.teacherId },
  });
  if (!(await isEligibleStudent(tx, p.userId))) return { delta: 0, amount: 0 };
  await lockWallet(tx, p.userId);
  const key = reviewKey(p.lessonId);
  const want = reviewAmount(p.level);
  const had = await tx.pointLedger.aggregate({ where: { userId: p.userId, key, currency: "XU" }, _sum: { amount: true } });
  const current = had._sum.amount ?? 0;
  if (current === want) return { delta: 0, amount: want };
  if (current > 0) await revokeKey(tx, p.userId, key, `Thầy đổi mức duyệt chữa bài → ${REVIEW_LABEL[p.level]}`, p.teacherId);
  let added = 0;
  if (want > 0) {
    added = await awardOnce(tx, {
      userId: p.userId,
      amount: want,
      source: "HOMEWORK_REVIEW",
      key,
      refId: p.lessonId,
      reason: `Thầy duyệt chữa bài: ${REVIEW_LABEL[p.level]}`,
      createdById: p.teacherId,
    });
  }
  return { delta: added - current, amount: added };
}
