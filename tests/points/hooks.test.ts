/**
 * Luồng thật: nộp bài kiểm tra / tự luận / thi cuối khoá / bài tập về nhà / xoá lượt làm (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";
import { onAttemptDeleted, onEssayGraded, onHomeworkGraded, onHomeworkSubmitted, onTestSubmitted, scoreTierPoints } from "@/lib/points/hooks";
import { createFixture, disconnect, withPoints } from "../helpers/fixtures";
import { applyLegacyEarning } from "../helpers/legacy-earning";

// Cơ chế xu bài kiểm tra / điểm cao… mặc định tắt từ 26/11 — kiểm logic với mức cũ (admin bật lại được)
applyLegacyEarning();

const fx = createFixture();
const P = POINTS;
const tier = scoreTierPoints;
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
  test("không có hạn: +nộp bài, cộng thêm theo điểm, KHÔNG có xu đúng hạn", async () => {
    for (const score of [5, 7, 8.5, 10] as const) {
      assert.equal((await scenario(score)).got, P.testSubmit + tier(score), `điểm ${score}`);
    }
  });

  test("sau hạn: nộp bài giảm, không có đúng hạn (vẫn có thưởng điểm cao)", async () => {
    assert.equal((await scenario(5, { dueDate: new Date(Date.now() - 86400000) })).got, P.testSubmitLate);
    assert.equal((await scenario(9, { dueDate: new Date(Date.now() - 86400000) })).got, P.testSubmitLate + tier(9));
  });

  test("hạn trong tương lai → đúng hạn: +nộp bài +đúng hạn (một lần cho mỗi đề)", async () => {
    const r = await scenario(5, { dueDate: new Date(Date.now() + 86400000) });
    assert.equal(r.got, P.testSubmit + P.onTimeBonus);
    const rows = await prisma.pointLedger.findMany({ where: { userId: r.s.id }, select: { source: true, amount: true } });
    assert.deepEqual(rows.map((x) => [x.source, x.amount]).sort(), [["ON_TIME", P.onTimeBonus], ["TEST_SUBMIT", P.testSubmit]]);
    await submit(r.s.id, r.t, r.a.id, 5);
    assert.equal(await fx.balance(r.s.id), P.testSubmit + P.onTimeBonus, "nộp lại không cộng đúng hạn lần 2");
  });

  test("hạn riêng theo lớp được tra trong giao dịch điểm: lớp có hạn tương lai → đúng hạn dù hạn chung đã qua; lớp khác dùng hạn chung", async () => {
    const cls = await fx.cls();
    const inClass = await fx.user({ classId: cls.id });
    const other = await fx.user();
    const t = await fx.test({ dueDate: new Date(Date.now() - 86400000) });
    await prisma.testDeadline.create({ data: { testId: t.id, classId: cls.id, dueDate: new Date(Date.now() + 86400000) } });
    const a1 = await fx.attempt(t.id, inClass.id, 5);
    await submit(inClass.id, t, a1.id, 5);
    assert.equal(await fx.balance(inClass.id), P.testSubmit + P.onTimeBonus, "lớp có hạn riêng còn hạn → đúng hạn");
    const a2 = await fx.attempt(t.id, other.id, 5);
    await submit(other.id, t, a2.id, 5);
    assert.equal(await fx.balance(other.id), P.testSubmitLate, "không thuộc lớp → hạn chung đã qua → sau hạn");
  });

  test("xu đúng hạn tính vào giới hạn ngày", async () => {
    await withPoints({ dailyAutoCap: P.testSubmit + 10 }, async () => {
      const r = await scenario(5, { dueDate: new Date(Date.now() + 86400000) });
      assert.equal(r.got, P.testSubmit + 10);
    });
  });

  test("làm dưới một nửa số câu → không xu nào; đúng một nửa → có xu", async () => {
    assert.equal((await scenario(9, { extra: { answeredCount: 4 } })).got, 0);
    assert.equal((await scenario(5, { extra: { answeredCount: 5 } })).got, P.testSubmit);
  });

  test("đề 0 câu (lỗi cấu trúc) không chia cho 0", async () => {
    assert.equal((await scenario(5, { extra: { answeredCount: 0, questionCount: 0 } })).got, P.testSubmit);
  });

  test("nộp lại cùng bài (mở lại bài) không cộng lần nữa", async () => {
    const { s, t, a, got } = await scenario(9);
    await submit(s.id, t, a.id, 10);
    assert.equal(await fx.balance(s.id), got);
  });

  test("học sinh chưa duyệt / demo / giáo viên không nhận xu", async () => {
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
  const base9 = P.testSubmit + tier(9);
  test("cần ít nhất 3 bài trước", async () => {
    assert.equal((await scenario(9, { previous: [5, 5] })).got, base9, "2 bài trước → không bứt phá");
    assert.equal((await scenario(9, { previous: [5, 5, 5] })).got, base9 + P.breakthrough.points, "3 bài trước TB 5 → bứt phá");
  });

  test("ngưỡng: cao hơn trung bình ít nhất 1,5", async () => {
    assert.equal((await scenario(7.4, { previous: [6, 6, 6] })).got, P.testSubmit + tier(7.4), "7,4 < 7,5 → không");
    assert.equal((await scenario(7.5, { previous: [6, 6, 6] })).got, P.testSubmit + tier(7.5) + P.breakthrough.points, "7,5 → có");
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
    assert.equal(await fx.balance(s.id), P.testSubmit + tier(10));
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

  test("chờ chấm: chỉ xu nộp bài; chấm xong hết mới thưởng điểm cao (một lần)", async () => {
    const { s, t, a, rows } = await essaySetup(["bài 1", "bài 2"]);
    await submit(s.id, t, a.id, 8.5, { hasPendingEssay: true });
    assert.equal(await fx.balance(s.id), P.testSubmit);
    await prisma.studentAnswer.update({ where: { id: rows[0].id }, data: { isCorrect: true } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), P.testSubmit, "còn 1 câu chưa chấm");
    await prisma.studentAnswer.update({ where: { id: rows[1].id }, data: { isCorrect: false } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), P.testSubmit + tier(8.5), "8,5 điểm → thưởng");
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), P.testSubmit + tier(8.5), "chấm lại không cộng thêm");
  });

  test("câu tự luận bỏ trống không chặn thưởng điểm cao", async () => {
    const { s, t, a, rows } = await essaySetup(["bài làm", "", null]);
    await submit(s.id, t, a.id, 8.5, { hasPendingEssay: true });
    await prisma.studentAnswer.update({ where: { id: rows[0].id }, data: { isCorrect: true } });
    await onEssayGraded(a.id);
    assert.equal(await fx.balance(s.id), P.testSubmit + tier(8.5), "2 câu trống không cần chấm");
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
  test("nộp bài riêng, thưởng điểm cao ×2, không tính vào giới hạn ngày, không có đúng hạn", async (t) => {
    const course = await prisma.course.findFirst({ where: { finalTest: null }, select: { id: true } });
    if (!course) return t.skip("DB local không có khoá học chưa có đề cuối khoá");
    await withPoints({ dailyAutoCap: 0 }, async () => {
      const r = await scenario(10, { courseId: course.id, dueDate: new Date(Date.now() + 86400000) });
      assert.equal(r.got, P.finalTestSubmit + tier(10) * P.finalScoreMultiplier);
    });
  });
});

describe("Xoá lượt làm bài", () => {
  test("thu hồi đủ (nộp + đúng hạn + điểm cao + bứt phá); xoá lần 2 không trừ thêm; làm lại được cộng lại", async () => {
    const { s, t, a, got } = await scenario(10, { previous: [5, 5, 5], dueDate: new Date(Date.now() + 86400000) });
    assert.equal(got, P.testSubmit + P.onTimeBonus + tier(10) + P.breakthrough.points);
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0, "thu hồi cả xu đúng hạn (review Gemini)");
    assert.equal((await fx.wallet(s.id))!.lifetimeEarned, 0, "tổng đã kiếm cũng về 0");
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
    await submit(s.id, t, a.id, 10);
    assert.ok((await fx.balance(s.id)) >= P.testSubmit + P.onTimeBonus + tier(10));
    assert.equal(await fx.balance(s.id), await fx.ledgerSum(s.id));
  });

  test("học sinh chưa từng có xu → không lỗi, không âm", async () => {
    const s = await fx.user();
    const t = await fx.test();
    await onAttemptDeleted({ userId: s.id, testId: t.id, teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
  });
});

describe("Bài tập về nhà", () => {
  test("nộp (nộp lại không cộng), Đạt cộng, Chưa đạt thu hồi, Đạt lại cộng", async () => {
    const s = await fx.user();
    const lessonId = fx.tag + "-lesson";
    await onHomeworkSubmitted({ userId: s.id, lessonId, submissionId: "x" });
    await onHomeworkSubmitted({ userId: s.id, lessonId, submissionId: "x" });
    assert.equal(await fx.balance(s.id), P.homeworkSubmit);
    const grade = (status: "SATISFACTORY" | "UNSATISFACTORY") => onHomeworkGraded({ userId: s.id, lessonId, submissionId: "x", status, teacherId: s.id });
    await grade("SATISFACTORY");
    await grade("SATISFACTORY");
    assert.equal(await fx.balance(s.id), P.homeworkSubmit + P.homeworkPass, "chấm Đạt 2 lần chỉ cộng 1");
    await grade("UNSATISFACTORY");
    assert.equal(await fx.balance(s.id), P.homeworkSubmit);
    await grade("UNSATISFACTORY");
    assert.equal(await fx.balance(s.id), P.homeworkSubmit, "chấm Chưa đạt 2 lần không trừ thêm");
    await grade("SATISFACTORY");
    assert.equal(await fx.balance(s.id), P.homeworkSubmit + P.homeworkPass);
  });

  test("chấm Chưa đạt khi chưa từng Đạt → không trừ", async () => {
    const s = await fx.user();
    await onHomeworkGraded({ userId: s.id, lessonId: "L", submissionId: "x", status: "UNSATISFACTORY", teacherId: s.id });
    assert.equal(await fx.balance(s.id), 0);
  });
});
