import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { loadAttemptForResult } from "@/lib/attempt-result";
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

  const attempt = await loadAttemptForResult(attemptId);

  // Lượt làm bài phải thuộc bài kiểm tra cuối khoá của đúng khoá học này
  if (!attempt || attempt.test.courseId !== courseId) {
    return notFound();
  }

  // Chỉ học sinh làm bài hoặc giáo viên/admin được xem
  const isTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (attempt.userId !== session.user.id && !isTeacher) {
    redirect("/");
  }

  // Học sinh chưa nộp bài thì quay lại trang làm bài
  if (!attempt.completedAt && !isTeacher) {
    redirect(`/courses/${courseId}/final-test`);
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
