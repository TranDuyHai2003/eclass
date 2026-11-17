import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ResultScreen } from "@/app/watch/[lessonId]/results/[attemptId]/_components/ResultScreen";

export const dynamic = "force-dynamic";

export default async function CourseFinalTestResultPage({
  params,
}: {
  params: Promise<{ courseId: string; attemptId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { courseId, attemptId } = await params;

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
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
      answers: { include: { subAnswers: true } },
    },
  });

  // Lượt làm bài phải thuộc bài kiểm tra cuối khoá của đúng khoá học này
  if (!attempt || attempt.test.courseId !== courseId) {
    return notFound();
  }

  // Chỉ học sinh làm bài hoặc giáo viên/admin được xem
  const isTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (attempt.userId !== session.user.id && !isTeacher) {
    redirect("/");
  }

  return (
    <ResultScreen
      attempt={attempt}
      backHref={`/courses/${courseId}/final-test`}
      fallbackTitle={attempt.test.course?.title ? `Kiểm tra cuối khoá — ${attempt.test.course.title}` : null}
      isTeacher={isTeacher}
    />
  );
}
