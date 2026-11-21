/**
 * Lưu hạn theo lớp (lib/test-deadlines.ts) — DB local: chỉ lớp gắn với khoá của đề, xoá bằng null, chuỗi giờ VN.
 */
import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { applyTestDeadlines } from "@/lib/test-deadlines";
import { effectiveDueDate } from "@/lib/deadline";
import { createFixture, disconnect } from "./helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

let testId = "", clsA = "", clsB = "", clsX = "";
before(async () => {
  const teacher = await fx.user({ role: "TEACHER" });
  clsA = (await fx.cls()).id;
  clsB = (await fx.cls()).id;
  clsX = (await fx.cls()).id; // không gắn khoá
  const course = await prisma.course.create({ data: { title: `${fx.tag} khoá`, userId: teacher.id, classes: { connect: [{ id: clsA }, { id: clsB }] } } });
  const chapter = await prisma.chapter.create({ data: { title: "C1", position: 0, courseId: course.id } });
  const lesson = await prisma.lesson.create({ data: { title: "B1", position: 0, chapterId: chapter.id, type: "QUIZ" } });
  testId = (await prisma.test.create({ data: { title: fx.tag, pdfUrl: "x.pdf", duration: 10, lessonId: lesson.id } })).id;
});

describe("applyTestDeadlines", () => {
  test("lưu hạn cho lớp gắn khoá; lớp lạ bị bỏ qua; chuỗi datetime-local hiểu là giờ VN", async () => {
    const r = await applyTestDeadlines(testId, [
      { classId: clsA, dueDate: "2026-12-01T20:00" },
      { classId: clsX, dueDate: "2026-12-01T20:00" },
      { classId: "khong-ton-tai", dueDate: "2026-12-01T20:00" },
    ]);
    assert.ok(r.ok && r.saved === 1 && r.ignored === 2, JSON.stringify(r));
    const rows = await prisma.testDeadline.findMany({ where: { testId } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].dueDate.toISOString(), "2026-12-01T13:00:00.000Z");
    assert.equal(effectiveDueDate({ dueDate: null, deadlines: rows }, clsA)?.toISOString(), "2026-12-01T13:00:00.000Z");
    assert.equal(effectiveDueDate({ dueDate: null, deadlines: rows }, clsB), null);
  });

  test("ghi đè hạn cũ; null xoá dòng; chỉ lớp lạ → lỗi; ngày hỏng → lỗi", async () => {
    await applyTestDeadlines(testId, [{ classId: clsA, dueDate: "2026-12-05T08:00:00.000Z" }, { classId: clsB, dueDate: "2026-12-06T08:00:00.000Z" }]);
    assert.equal(await prisma.testDeadline.count({ where: { testId } }), 2);
    const r = await applyTestDeadlines(testId, [{ classId: clsA, dueDate: null }]);
    assert.ok(r.ok && r.removed === 1);
    assert.deepEqual((await prisma.testDeadline.findMany({ where: { testId } })).map((d) => d.classId), [clsB]);
    assert.equal((await applyTestDeadlines(testId, [{ classId: clsX, dueDate: null }])).ok, false);
    assert.equal((await applyTestDeadlines(testId, [{ classId: clsB, dueDate: "rác" }])).ok, false);
    // Một dòng hỏng → không ghi dòng nào (review Gemini)
    const before = await prisma.testDeadline.findMany({ where: { testId } });
    assert.equal((await applyTestDeadlines(testId, [{ classId: clsA, dueDate: "2026-12-09T10:00" }, { classId: clsB, dueDate: "rác" }])).ok, false);
    assert.deepEqual(await prisma.testDeadline.findMany({ where: { testId } }), before, "không được ghi dở dang");
    assert.equal((await applyTestDeadlines("khong-co", [])).ok, false);
  });
});
