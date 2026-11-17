"use server";

import { demoGuard } from "@/lib/demo";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeSolutionAnchors } from "@/lib/pdf-question-anchors";

/** Lưu vị trí lời giải từng câu cho một đề (giáo viên/admin). */
export async function saveSolutionAnchors(testId: string, raw: unknown) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        explanation: true,
        sections: { select: { questions: { select: { id: true } } } },
      },
    });
    if (!test) return { success: false, error: "Không tìm thấy đề" };
    if (!test.explanation?.trim()) {
      return { success: false, error: "Đề chưa có file PDF lời giải" };
    }

    const questionIds = new Set(test.sections.flatMap((s) => s.questions.map((q) => q.id)));
    const data = sanitizeSolutionAnchors(raw, questionIds);
    if (!data) return { success: false, error: "Dữ liệu không hợp lệ" };

    await prisma.test.update({
      where: { id: testId },
      data: { solutionAnchors: { ...data, pdfUrl: test.explanation } },
    });

    return { success: true, count: Object.keys(data.items).length };
  } catch (error) {
    console.error("[saveSolutionAnchors]", error);
    return { success: false, error: "Không thể lưu vị trí lời giải" };
  }
}
