/**
 * Cơ chế xu 26/11/2026 (docs/ai-reviews/xu-3-actions/PLAN.md): nộp BTVN đúng hạn lớp +100; thầy duyệt chữa bài
 * 0 / +280 / +400 (đổi mức tự điều chỉnh); bài kiểm tra không còn cộng xu; mã quà tự đặt, dùng 1 lần (DB local).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { onHomeworkSubmitted, onTestSubmitted } from "@/lib/points/hooks";
import { reviewKey, setHomeworkReviewInTx } from "@/lib/points/homework";
import { GiftCodeTaken, createBatch, redeemGiftCodeInTx, validateBatchInput } from "@/lib/game/giftcode";
import { getClassHomeworkLessons, getHomeworkCheckList } from "@/lib/points/homework-queries";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await prisma.giftCode.deleteMany({ where: { note: { startsWith: "hwreview-test" } } });
  await fx.cleanup();
  await disconnect();
});
const H = 3600_000;

async function student() {
  const cls = await fx.cls();
  const s = await fx.user({ classId: cls.id });
  const lesson = await fx.homeworkLesson({ classIds: [cls.id] });
  return { cls, s, lesson };
}
const submitHw = async (userId: string, lessonId: string) => {
  const sub = await prisma.homeworkSubmission.create({ data: { userId, lessonId, attachments: [] } });
  await onHomeworkSubmitted({ userId, lessonId, submissionId: sub.id });
};

describe("Nộp bài tập về nhà đúng hạn lớp: +100", () => {
  test("chưa đặt hạn → +100, nộp lại không cộng thêm", async () => {
    const { s, lesson } = await student();
    await submitHw(s.id, lesson.id);
    assert.equal(await fx.balance(s.id), 100);
    await onHomeworkSubmitted({ userId: s.id, lessonId: lesson.id, submissionId: "x" });
    assert.equal(await fx.balance(s.id), 100);
  });
  test("hạn lớp còn → +100; hạn lớp đã qua → 0", async () => {
    const a = await student();
    await prisma.homeworkDeadline.create({ data: { lessonId: a.lesson.id, classId: a.cls.id, dueDate: new Date(Date.now() + H) } });
    await submitHw(a.s.id, a.lesson.id);
    assert.equal(await fx.balance(a.s.id), 100);
    const b = await student();
    await prisma.homeworkDeadline.create({ data: { lessonId: b.lesson.id, classId: b.cls.id, dueDate: new Date(Date.now() - H) } });
    await submitHw(b.s.id, b.lesson.id);
    assert.equal(await fx.balance(b.s.id), 0, "nộp sau hạn không được xu");
  });
  test("bài kiểm tra không còn cộng xu (nguồn cũ tắt)", async () => {
    const s = await fx.user();
    const t = await fx.test({ dueDate: new Date(Date.now() + H) });
    const at = await fx.attempt(t.id, s.id, 10);
    await onTestSubmitted({ userId: s.id, attemptId: at.id, test: { id: t.id, dueDate: t.dueDate, courseId: null }, score: 10, answeredCount: 10, questionCount: 10, hasPendingEssay: false });
    assert.equal(await fx.balance(s.id), 0);
  });
});

describe("Thầy duyệt chữa bài: 0 / +280 / +400", () => {
  test("đổi mức tự điều chỉnh: sổ, ví và xu tích luỹ luôn khớp mức hiện tại", async () => {
    const { s, lesson } = await student();
    const teacher = await fx.user({ role: "TEACHER" });
    const set = (level: "NONE" | "PARTIAL" | "FULL") => prisma.$transaction((tx) => setHomeworkReviewInTx(tx, { lessonId: lesson.id, userId: s.id, level, teacherId: teacher.id }));
    assert.deepEqual(await set("PARTIAL"), { delta: 280, amount: 280 });
    assert.equal(await fx.balance(s.id), 280);
    assert.deepEqual(await set("FULL"), { delta: 120, amount: 400 });
    assert.equal(await fx.balance(s.id), 400);
    assert.equal((await set("FULL")).delta, 0, "bấm lại cùng mức không cộng");
    assert.equal((await set("NONE")).delta, -400);
    assert.equal(await fx.balance(s.id), 0);
    await set("FULL");
    const w = await fx.wallet(s.id);
    assert.equal(w?.balance, 400);
    assert.equal(w?.lifetimeEarned, 400, "tính vào xu tích luỹ (danh hiệu)");
    const sum = await prisma.pointLedger.aggregate({ where: { userId: s.id, key: reviewKey(lesson.id) }, _sum: { amount: true } });
    assert.equal(sum._sum.amount, 400);
    assert.equal((await prisma.homeworkReview.findUnique({ where: { lessonId_userId: { lessonId: lesson.id, userId: s.id } } }))?.level, "FULL");
  });
  test("học sinh chưa được duyệt tài khoản: lưu mức, không cộng xu", async () => {
    const cls = await fx.cls();
    const s = await fx.user({ classId: cls.id, isApproved: false });
    const lesson = await fx.homeworkLesson({ classIds: [cls.id] });
    const teacher = await fx.user({ role: "TEACHER" });
    const r = await prisma.$transaction((tx) => setHomeworkReviewInTx(tx, { lessonId: lesson.id, userId: s.id, level: "FULL", teacherId: teacher.id }));
    assert.equal(r.delta, 0);
    assert.equal(await fx.balance(s.id), 0);
  });
  test("danh sách duyệt: cả lớp (kể cả chưa nộp), bài nộp trễ / đúng hạn, mức đã duyệt", async () => {
    const { cls, s, lesson } = await student();
    const s2 = await fx.user({ classId: cls.id });
    await prisma.homeworkDeadline.create({ data: { lessonId: lesson.id, classId: cls.id, dueDate: new Date(Date.now() - H) } });
    await prisma.homeworkSubmission.create({ data: { userId: s.id, lessonId: lesson.id, attachments: [] } });
    const teacher = await fx.user({ role: "TEACHER" });
    await prisma.$transaction((tx) => setHomeworkReviewInTx(tx, { lessonId: lesson.id, userId: s2.id, level: "PARTIAL", teacherId: teacher.id }));
    const lessons = await getClassHomeworkLessons(cls.id);
    assert.ok(lessons.some((l) => l.id === lesson.id && l.dueDate));
    const list = await getHomeworkCheckList(lesson.id, cls.id);
    assert.equal(list.students.length, 2);
    const a = list.students.find((x) => x.id === s.id)!;
    assert.ok(a.submittedAt && a.late && a.level === null);
    assert.equal(list.students.find((x) => x.id === s2.id)?.level, "PARTIAL");
  });
});

describe("Mã quà tặng tự đặt, dùng 1 lần", () => {
  test("thầy tự đặt mã (chuẩn hoá chữ hoa); trùng → báo; 1 bạn dùng là hết", async () => {
    const teacher = await fx.user({ role: "TEACHER" });
    const code = `HW${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const base = { count: 1, currency: "XU" as const, amount: 300, maxUses: 1, note: "hwreview-test" };
    const r = await createBatch({ ...base, customCode: code.toLowerCase() }, teacher.id);
    assert.deepEqual(r.codes, [code]);
    await assert.rejects(createBatch({ ...base, customCode: code }, teacher.id), GiftCodeTaken);
    assert.ok(validateBatchInput({ ...base, count: 2, customCode: "ABCDE" }), "mã tự đặt chỉ 1 mã");
    assert.ok(validateBatchInput({ ...base, customCode: "AB" }), "quá ngắn");
    const [a, b] = [await fx.user(), await fx.user()];
    const ra = await prisma.$transaction((tx) => redeemGiftCodeInTx(tx, a.id, code));
    assert.ok(ra.success, JSON.stringify(ra));
    assert.equal(await fx.balance(a.id), 300);
    const rb = await prisma.$transaction((tx) => redeemGiftCodeInTx(tx, b.id, code));
    assert.ok(!rb.success, "mã 1 lượt: bạn thứ hai không dùng được");
  });
});
