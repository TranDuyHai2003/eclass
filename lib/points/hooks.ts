import { POINTS } from "./config";
import { awardOnce, isEligibleStudent, lockWallet, revokeKey, runPointsSafely, updateWeekStreak } from "./engine";
import type { Tx } from "./engine";

/**
 * Các điểm gắn vào luồng nộp/chấm bài. Đều chạy SAU khi dữ liệu chính đã lưu, trong giao dịch riêng
 * (runPointsSafely) → lỗi tính điểm không ảnh hưởng việc nộp bài.
 */


const testKey = (testId: string) => `TEST:${testId}`;
const scoreKey = (testId: string) => `TESTSCORE:${testId}`;
const breakKey = (testId: string) => `BREAK:${testId}`;

export function scoreTierPoints(score: number) {
  return POINTS.scoreTiers.find((t) => score >= t.min)?.points ?? 0;
}

/** Thưởng điểm cao + bứt phá (gọi khi điểm bài đã là điểm cuối: nộp bài không có tự luận, hoặc chấm xong tự luận) */
async function awardScoreBonus(
  tx: Tx,
  p: { userId: string; testId: string; attemptId: string; score: number; isFinal: boolean },
) {
  const tier = scoreTierPoints(p.score) * (p.isFinal ? POINTS.finalScoreMultiplier : 1);
  if (tier > 0) {
    await awardOnce(tx, {
      userId: p.userId,
      amount: tier,
      source: "TEST_SCORE",
      key: scoreKey(p.testId),
      refId: p.attemptId,
      reason: `Đạt ${String(p.score).replace(".", ",")} điểm`,
      capped: !p.isFinal,
    });
  }

  // Bứt phá: so với trung bình các bài gần nhất (trước bài này)
  const previous = await tx.studentAttempt.findMany({
    where: { userId: p.userId, completedAt: { not: null }, score: { not: null }, id: { not: p.attemptId } },
    orderBy: { completedAt: "desc" },
    take: POINTS.breakthrough.window,
    select: { score: true },
  });
  if (previous.length >= POINTS.breakthrough.minPrevious) {
    const avg = previous.reduce((s: number, a: { score: number | null }) => s + (a.score ?? 0), 0) / previous.length;
    if (p.score >= avg + POINTS.breakthrough.margin) {
      await awardOnce(tx, {
        userId: p.userId,
        amount: POINTS.breakthrough.points,
        source: "BREAKTHROUGH",
        key: breakKey(p.testId),
        refId: p.attemptId,
        reason: `Cao hơn trung bình ${previous.length} bài gần nhất (${avg.toFixed(1).replace(".", ",")})`,
        capped: true,
      });
    }
  }
}

/** Học sinh nộp bài kiểm tra / bài tập trắc nghiệm / đề thi cuối khoá */
export function onTestSubmitted(p: {
  userId: string;
  attemptId: string;
  test: { id: string; dueDate: Date | null; courseId: string | null };
  score: number;
  answeredCount: number;
  questionCount: number;
  hasPendingEssay: boolean;
}) {
  return runPointsSafely("onTestSubmitted", async (tx) => {
    if (!(await isEligibleStudent(tx, p.userId))) return;
    // Nộp trắng / làm quá ít câu → không có điểm thưởng
    if (p.questionCount > 0 && p.answeredCount / p.questionCount < POINTS.minAnsweredRatio) return;

    const wallet = await lockWallet(tx, p.userId);
    const now = new Date();
    const isFinal = !!p.test.courseId;
    const late = !!p.test.dueDate && now > p.test.dueDate;

    await awardOnce(tx, {
      userId: p.userId,
      amount: isFinal ? POINTS.finalTestSubmit : late ? POINTS.testSubmitLate : POINTS.testSubmit,
      source: isFinal ? "FINAL_TEST" : "TEST_SUBMIT",
      key: testKey(p.test.id),
      refId: p.attemptId,
      reason: isFinal ? "Nộp đề thi cuối khoá" : late ? "Nộp bài (sau hạn)" : "Nộp bài",
      capped: !isFinal,
      now,
    });

    if (!p.hasPendingEssay) {
      await awardScoreBonus(tx, { userId: p.userId, testId: p.test.id, attemptId: p.attemptId, score: p.score, isFinal });
    }

    await updateWeekStreak(tx, wallet, now);
  });
}

/** Giáo viên chấm một câu tự luận → nếu đã chấm hết thì thưởng điểm cao theo điểm cuối */
export function onEssayGraded(attemptId: string) {
  return runPointsSafely("onEssayGraded", async (tx) => {
    const attempt = await tx.studentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, userId: true, score: true, completedAt: true, testId: true, test: { select: { courseId: true } } },
    });
    if (!attempt?.completedAt || attempt.score === null) return;
    if (!(await isEligibleStudent(tx, attempt.userId))) return;
    // Còn câu tự luận có làm mà chưa chấm → chờ (câu bỏ trống không cần chấm)
    const ungraded = await tx.studentAnswer.count({
      where: { attemptId, isCorrect: null, answerProvided: { not: null }, NOT: { answerProvided: "" } },
    });
    if (ungraded > 0) return;

    await lockWallet(tx, attempt.userId);
    await awardScoreBonus(tx, {
      userId: attempt.userId,
      testId: attempt.testId,
      attemptId,
      score: attempt.score,
      isFinal: !!attempt.test.courseId,
    });
  });
}

/** Giáo viên xoá lượt làm → thu hồi điểm của bài đó (học sinh làm lại sẽ được tính lại) */
export function onAttemptDeleted(p: { userId: string; testId: string; teacherId: string }) {
  return runPointsSafely("onAttemptDeleted", async (tx) => {
    await lockWallet(tx, p.userId);
    const reason = "Giáo viên xoá lượt làm bài";
    for (const key of [testKey(p.testId), scoreKey(p.testId), breakKey(p.testId)]) {
      await revokeKey(tx, p.userId, key, reason, p.teacherId);
    }
  });
}

/** Học sinh nộp bài tập về nhà (ảnh) — chỉ tính lần nộp đầu của mỗi bài */
export function onHomeworkSubmitted(p: { userId: string; lessonId: string; submissionId: string }) {
  return runPointsSafely("onHomeworkSubmitted", async (tx) => {
    if (!(await isEligibleStudent(tx, p.userId))) return;
    const wallet = await lockWallet(tx, p.userId);
    const now = new Date();
    await awardOnce(tx, {
      userId: p.userId,
      amount: POINTS.homeworkSubmit,
      source: "HOMEWORK_SUBMIT",
      key: `HW:${p.lessonId}`,
      refId: p.submissionId,
      reason: "Nộp bài tập về nhà",
      capped: true,
      now,
    });
    await updateWeekStreak(tx, wallet, now);
  });
}

/** Giáo viên chấm bài tập về nhà: Đạt → cộng; đổi sang Chưa đạt → thu hồi */
export function onHomeworkGraded(p: {
  userId: string;
  lessonId: string;
  submissionId: string;
  status: "SATISFACTORY" | "UNSATISFACTORY";
  teacherId: string;
}) {
  return runPointsSafely("onHomeworkGraded", async (tx) => {
    if (!(await isEligibleStudent(tx, p.userId))) return;
    await lockWallet(tx, p.userId);
    const key = `HWOK:${p.lessonId}`;
    if (p.status === "SATISFACTORY") {
      await awardOnce(tx, {
        userId: p.userId,
        amount: POINTS.homeworkPass,
        source: "HOMEWORK_PASS",
        key,
        refId: p.submissionId,
        reason: "Bài tập về nhà được chấm Đạt",
        capped: true,
      });
    } else {
      await revokeKey(tx, p.userId, key, "Bài tập về nhà chuyển sang Chưa đạt", p.teacherId);
    }
  });
}
