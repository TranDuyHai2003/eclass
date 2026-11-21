import { prisma } from "@/lib/prisma";
import { parseVnDateTime } from "@/lib/game/giftcode-shared";

export interface DeadlineInput {
  classId: string;
  /** null = xoá hạn riêng của lớp */
  dueDate: string | Date | null;
}

/**
 * Lưu hạn nộp theo lớp cho một đề. Review Gemini: chỉ nhận lớp gắn với khoá học của đề (đề của bài học → khoá chứa bài;
 * đề cuối khoá → khoá đó). Lớp lạ bị bỏ qua; không còn dòng hợp lệ → trả lỗi.
 */
export async function applyTestDeadlines(testId: string, input: DeadlineInput[]) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      lesson: { select: { chapter: { select: { course: { select: { classes: { select: { id: true } } } } } } } },
      course: { select: { classes: { select: { id: true } } } },
    },
  });
  if (!test) return { ok: false as const, error: "Không tìm thấy đề." };
  const allowed = new Set((test.lesson?.chapter.course.classes ?? test.course?.classes ?? []).map((c) => c.id));
  const valid = (Array.isArray(input) ? input : []).filter((d) => d && typeof d.classId === "string" && allowed.has(d.classId));
  if (valid.length === 0) return { ok: false as const, error: "Không có lớp hợp lệ (lớp phải được gán cho khoá học của đề)." };

  // Kiểm tra toàn bộ trước, ghi trong một giao dịch → không có ghi dở dang khi một dòng hỏng (review Gemini)
  const parsed: { classId: string; due: Date | null }[] = [];
  for (const d of valid) {
    if (d.dueDate === null || d.dueDate === "") {
      parsed.push({ classId: d.classId, due: null });
      continue;
    }
    const due = parseVnDateTime(d.dueDate);
    if (!due) return { ok: false as const, error: "Ngày giờ không hợp lệ." };
    parsed.push({ classId: d.classId, due });
  }
  const { saved, removed } = await prisma.$transaction(async (tx) => {
    let saved = 0;
    let removed = 0;
    for (const p of parsed) {
      if (!p.due) {
        removed += (await tx.testDeadline.deleteMany({ where: { testId, classId: p.classId } })).count;
      } else {
        await tx.testDeadline.upsert({
          where: { testId_classId: { testId, classId: p.classId } },
          create: { testId, classId: p.classId, dueDate: p.due },
          update: { dueDate: p.due },
        });
        saved++;
      }
    }
    return { saved, removed };
  });
  return { ok: true as const, saved, removed, ignored: input.length - valid.length };
}
