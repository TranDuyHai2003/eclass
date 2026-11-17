import { prisma } from "@/lib/prisma";

/**
 * Tải lượt làm bài kèm đề (phần → câu → ý) và câu trả lời cho màn kết quả.
 * Module server thường (không "use server") nên không thể gọi từ trình duyệt;
 * nơi gọi tự kiểm tra quyền xem và lọc dữ liệu (xem ResultScreen).
 */
export function loadAttemptForResult(attemptId: string) {
  return prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: { include: { subAnswers: true } },
      test: {
        include: {
          course: { select: { title: true } },
          sections: {
            orderBy: { position: "asc" },
            include: {
              questions: {
                orderBy: { position: "asc" },
                include: { subQuestions: { orderBy: { position: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
}
