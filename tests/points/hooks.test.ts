/**
 * Luồng thật: nộp bài kiểm tra / tự luận / thi cuối khoá / bài tập về nhà / xoá lượt làm (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { onAttemptDeleted, onEssayGraded, onHomeworkGraded, onHomeworkSubmitted, onTestSubmitted } from "@/lib/points/hooks";
import { createFixture, disconnect, withPoints } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

type T = { id: string; dueDate: Date | null; courseId: string | null };
const submit = (userId: string, t: T, attemptId: string, score: number, extra: Partial<Parameters<typeof onTestSubmitted>[0]> = {}) =>
  onTestSubmitted({ userId, attemptId, test: { id: t.id, dueDate: t.dueDate, courseId: t.courseId }, score, answeredCount: 10, questionCount: 10, hasPendingEssay: false, ...extra });

/** Học sinh + 1 bài đã nộp, trả về số điểm nhận được */
async function scenario(score: number, opts: { dueDate?: Date | null; previous?: number[]; extra?: any; courseId?: string } = {}) {
  const s = await fx.user();
  for (const p of opts.previous ?? []) {
    const pt = await fx.test();
    await fx.attempt(pt.id, s.id, p, new Date(Date.now() - 3600_000));
  }
  const t = await fx.test({ dueDate: opts.dueDate ?? null, courseId: opts.courseId ?? null });
  const a = await fx.attempt(t.id, s.id, score);
  await submit(s.id, t, a.id, score, opts.extra);
  return { s, t, a, got: await fx.balance(s.id) };
}

describe("Nộp bài kiểm tra / bài tập trắc nghiệm", () => {
  test("đúng hạn: +2 nộp bài, cộng thêm theo điểm", async () => {
    for (const [score, want] of [[5, 2], [7, 3], [8.5, 4], [10, 5]] as const) {
      assert.equal((await scenario(score)).got, want, `điểm ${score}`);
    }
  });

  test("sau hạn: chỉ +1 nộp bài (vẫn có thưởng điểm cao)", async () => {
    assert.equal((await scenario(5, { dueDate: new Date(Date.now() - 86400000) })).got, POINTS.testSubmitLate);
    assert.equal((await scenario(9, { dueDate: new Date(Date.now() - 86400000) })).got, POINTS.testSubmitLate + 2);
  });

  test("hạn trong tương lai → đúng hạn", async () => {
    assert.equal((await scenario(5, { dueDate: new Date(Date.now() + 86400000) })).got, POINTS.testSubmit);
  });

  test("làm dưới một nửa số câu → không điểm nào; đúng một nửa → có điểm", async () => {
    assert.equal((await scenario(9, { extra: { answeredCount: 4 } })).got, 0);
    assert.equal((await scenario(5, { extra: { answeredCount: 5 } })).got, POINTS.testSubmit);
  });

  test("đề 0 câu (lỗi cấu trúc) không chia cho 0", async () => {
    assert.equal((await scenario(5, { extra: { answeredCount: 0, questionCount: 0 } })).got, POINTS.testSubmit);
  });

  test("nộp lại cùng bài (mở lại bài) không cộng lần nữa", async () => {
    const { s, t, a, got } = await scenario(9);
    await submit(s.id, t, a.id, 10);
    assert.equal(await fx.balance(s.id), got);
  });

  test("học sinh chưa duyệt / demo / giáo viên không nhận điểm", async () => {
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      const t = await fx.test();
      const a = await fx.attempt(t.id, u.id, 10);
      await submit(u.id, t, a.id, 10);
      assert.equal(await fx.balance(u.id), 0, JSON.stringify(opts));
    }
  });
});

describe("Bứt phá", () => {
  test("cần ít nhất 3 bài trước", async () => {
    assert.equal((await scenario(9, { previous: [5, 5] })).got, 4, "2 bài trước → không bứt phá");
    assert.equal((await scenario(9, { previous: [5, 5, 5] })).got, 5, "3 bài trước TB 5 → +1");
  });

  test("ngưỡng: cao hơn trung bình ít nhất 1,5", async () => {
    assert.equal((await scenario(7.4, { previous: [6, 6, 6] })).got, 3, "7,4 < 7,5 → không");
    assert.equal((await scenario(7.5, { previous: [6, 6, 6] })).got, 4, "7,5 → có");
  });

  test("chỉ so với 5 bài gần nhất", async () => {
    // 5 bài gần nhất toàn 9 (bài cũ hơn điểm 0 không tính) → 10 không phải bứt phá
    const s = await fx.user();
    const old = await fx.test();
    await fx.attempt(old.id, s.id, 0, new Date(Date.now() - 10 * 86400000));
    for (let i = 0; i < 5; i++) await fx.attempt((await fx.test()).id, s.id, 9, new Date(Date.now() - (i + 1) * 3600_000));
    const t = await fx.test();
    const a = await fx.attempt(t.id, s.id, 10);
    await submit(s.id, t, a.id, 10);
    assert.equal(await fx.balance(s.id), 5);
  });
});

describe("Bài có câu tự luận", () => {
  async function essaySetup(answers: (string | null)[]) {
    const s = await fx.user();
    const t = await fx.test();
    const section = await prisma.testSection.create({
      data: { testId: t.id, name: "TL", questions: { create: answers.map((_, i) => ({ type: "ESSAY" as const, points: 1, position: i })) } },
      include: { questions: true },
    });
    const a = await fx.attempt(t.id, s.id, 8.5);
    const rows = [];
    for (let i = 0; i < answers.length; i++) {
      rows.push(await prisma.studentAnswer.create({ data: { attemptId: a.id, questionId: section.questions[i].id, answerProvided: answers[i], isCorrect: null } }));
    }
    return { s, t, a, rows };
  }

  test("chờ chấm: chỉ +2; chấm xong hết mới thưởng điểm cao (một lần)", async () => {
    const { s, t, a, rows } = await essaySetup(["bài 1", "bài 2"]);
    await submit(s.id, t, a.id, 8.5, { hasPendingEssay: true });
    assert.equal(await fx.balance(s.id), 2);
    await prisma.studentAnswer.update({ where: { id: rows[0].id }, data: { isCorrect: true } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), 2, "còn 1 câu chưa chấm");
    await prisma.studentAnswer.update({ where: { id: rows[1].id }, data: { isCorrect: false } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), 4, "8,5 điểm → +2");
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), 4, "chấm lại không cộng thêm");
  });

  test("câu tự luận bỏ trống không chặn thưởng điểm cao", async () => {
    const { s, t, a, rows } = await essaySetup(["bài làm", "", null]);
    await submit(s.id, t, a.id, 8.5, { hasPendingEssay: true });
    await prisma.studentAnswer.update({ where: { id: rows[0].id }, data: { isCorrect: true } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), 4, "2 câu trống không cần chấm");
  });

  test("lượt làm chưa nộp (bị mở lại) → chưa thưởng", async () => {
    const { s, a, rows } = await essaySetup(["x"]);
    await prisma.studentAnswer.update({ where: { id: rows[0].id }, data: { isCorrect: true } });
    await prisma.studentAttempt.update({ where: { id: a.id }, data: { completedAt: null } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), 0);
  });
});

describe("Đề thi cuối khoá", () => {
  test("+5 nộp bài, thưởng điểm cao ×2, không tính vào giới hạn ngày", async (t) => {
    const course = await prisma.course.findFirst({ where: { finalTest: null }, select: { id: true } });
    if (!course) return t.skip("DB local không có khoá học chưa có đề cuối khoá");
    await withPoints({ dailyAutoCap: 0 }, async () => {
      const r = await scenario(10, { courseId: course.id });
      assert.equal(r.got, POINTS.finalTestSubmit + 3 * POINTS.finalScoreMultiplier);
    });
  });
});

describe("Xoá lượt làm bài", () => {
  test("thu hồi đủ (nộp + điểm cao + bứt phá); xoá lần 2 không trừ thêm; làm lại được cộng lại", async () => {
    const { s, t, a, got } = await scenario(10, { previous: [5, 5, 5] });
    assert.equal(got, 6);
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
    await submit(s.id, t, a.id, 10);
    assert.ok((await fx.balance(s.id)) >= 5);
    assert.equal(await fx.balance(s.id), await fx.ledgerSum(s.id));
  });

  test("học sinh chưa từng có điểm → không lỗi, không âm", async () => {
    const s = await fx.user();
    const t = await fx.test();
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
  });
});

describe("Bài tập về nhà", () => {
  test("nộp +1 (nộp lại không cộng), Đạt +1, Chưa đạt thu hồi, Đạt lại +1", async () => {
    const s = await fx.user();
    const lessonId = fx.tag + "-lesson";
    await onHomeworkSubmitted({ userId: s.id, lessonId, submissionId: "x" });
    await onHomeworkSubmitted({ userId: s.id, lessonId, submissionId: "x" });
    assert.equal(await fx.balance(s.id), 1);
    const grade = (status: "SATISFACTORY" | "UNSATISFACTORY") => onHomeworkGraded({ userId: s.id, lessonId, submissionId: "x", status, teacherId: s.id });
    await grade("SATISFACTORY");
    await grade("SATISFACTORY");
    assert.equal(await fx.balance(s.id), 2, "chấm Đạt 2 lần chỉ +1");
    await grade("UNSATISFACTORY");
    assert.equal(await fx.balance(s.id), 1);
    await grade("UNSATISFACTORY");
    assert.equal(await fx.balance(s.id), 1, "chấm Chưa đạt 2 lần không trừ thêm");
    await grade("SATISFACTORY");
    assert.equal(await fx.balance(s.id), 2);
  });

  test("chấm Chưa đạt khi chưa từng Đạt → không trừ", async () => {
    const s = await fx.user();
    await onHomeworkGraded({ userId: s.id, lessonId: "L", submissionId: "x", status: "UNSATISFACTORY", teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
  });
});
