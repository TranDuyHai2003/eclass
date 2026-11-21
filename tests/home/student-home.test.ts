/**
 * Trang chủ học sinh: "Bài cần làm" và "Kết quả gần đây" (lib/home/student-home.ts) — DB local.
 */
import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getStudentHomeExtras } from "@/lib/home/student-home";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup(); // xoá thầy → xoá khoá, chương, bài, đề, bài làm
  await disconnect();
});

const day = 24 * 3600 * 1000;
let courseId = "";
const L: Record<string, { lessonId: string; testId: string }> = {};

before(async () => {
  const teacher = await fx.user({ role: "TEACHER" });
  const course = await prisma.course.create({ data: { title: `${fx.tag} khoá`, userId: teacher.id, isPublished: true } });
  courseId = course.id;
  // Chương 1: B1 (không hạn), B2 (hạn sau 5 ngày) · Chương 2: B3 (hạn ngày mai) · Chương ẩn: B4 · Bài không có đề: B5
  const spec: { ch: number; hidden?: boolean; lessons: { key: string; due?: number | null; noTest?: boolean }[] }[] = [
    { ch: 0, lessons: [{ key: "B1" }, { key: "B2", due: 5 }] },
    { ch: 1, lessons: [{ key: "B3", due: 1 }, { key: "B5", noTest: true }] },
    { ch: 2, hidden: true, lessons: [{ key: "B4" }] },
    { ch: 3, lessons: [{ key: "B6", due: -30 }, { key: "B7", due: -2 }] },
  ];
  for (const c of spec) {
    const chapter = await prisma.chapter.create({ data: { title: `Chương ${c.ch + 1}`, position: c.ch, courseId, isHidden: !!c.hidden } });
    for (const [i, l] of c.lessons.entries()) {
      const lesson = await prisma.lesson.create({ data: { title: `${l.key} bài`, position: i, chapterId: chapter.id, type: "QUIZ" } });
      if (l.noTest) continue;
      const t = await prisma.test.create({
        data: { title: fx.tag, pdfUrl: "x.pdf", duration: 15, lessonId: lesson.id, dueDate: l.due ? new Date(Date.now() + l.due * day) : null },
      });
      L[l.key] = { lessonId: lesson.id, testId: t.id };
    }
  }
});

describe("Bài cần làm", () => {
  test("chỉ bài có đề, chưa nộp, chương không ẩn; còn hạn (gần nhất) → không hạn → quá hạn (mới quá hạn trước)", async () => {
    const s = await fx.user();
    const r = await getStudentHomeExtras(s.id, [courseId], 10);
    assert.deepEqual(r.todo.map((t) => t.lessonId), [L.B3.lessonId, L.B2.lessonId, L.B1.lessonId, L.B7.lessonId, L.B6.lessonId]);
    assert.equal(r.todoTotal, 5);
    assert.equal(r.todo[0].duration, 15);
    assert.ok(r.todo[0].dueDate);
  });

  test("đã nộp (kể cả 0 điểm) thì không còn trong danh sách; lượt đang làm dở vẫn tính là chưa làm", async () => {
    const s = await fx.user();
    await fx.attempt(L.B3.testId, s.id, 0);
    await fx.attempt(L.B1.testId, s.id, null, null); // chưa nộp
    const r = await getStudentHomeExtras(s.id, [courseId], 10);
    assert.deepEqual(r.todo.map((t) => t.lessonId), [L.B2.lessonId, L.B1.lessonId, L.B7.lessonId, L.B6.lessonId]);
  });

  test("giới hạn số dòng nhưng todoTotal vẫn đếm đủ; không có khoá → rỗng", async () => {
    const s = await fx.user();
    const r = await getStudentHomeExtras(s.id, [courseId], 1);
    assert.equal(r.todo.length, 1);
    assert.equal(r.todoTotal, 5);
    assert.deepEqual(await getStudentHomeExtras(s.id, []), { todo: [], todoTotal: 0, recent: [] });
  });
});

describe("Kết quả gần đây", () => {
  test("mỗi đề lấy lượt nộp mới nhất, mới nhất lên trước; bỏ lượt chưa nộp và bài của bạn khác", async () => {
    const s = await fx.user();
    const other = await fx.user();
    await fx.attempt(L.B1.testId, s.id, 4, new Date(Date.now() - 3 * day));
    const latestB1 = await fx.attempt(L.B1.testId, s.id, 7.5, new Date(Date.now() - 1 * day));
    const b2 = await fx.attempt(L.B2.testId, s.id, 9, new Date(Date.now() - 2 * day));
    await fx.attempt(L.B3.testId, s.id, null, null);
    await fx.attempt(L.B3.testId, other.id, 10);
    const r = await getStudentHomeExtras(s.id, [courseId]);
    assert.deepEqual(r.recent.map((x) => [x.attemptId, x.score]), [[latestB1.id, 7.5], [b2.id, 9]]);
    assert.equal(r.recent[0].lessonId, L.B1.lessonId);
  });
});
