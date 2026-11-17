import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getAttemptStatistics } from "@/actions/analytics";
import { ResultScreen } from "./_components/ResultScreen";

export const dynamic = "force-dynamic";

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId, attemptId } = await params;

  // Lấy lượt làm bài kèm đầy đủ câu hỏi/đáp án (một truy vấn)
  const { attempt } = await getAttemptStatistics(attemptId);
  if (!attempt) return notFound();

  // Chỉ học sinh làm bài hoặc giáo viên/admin được xem
  const isOwner = attempt.userId === session.user.id;
  const isTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (!isOwner && !isTeacher) return redirect("/");

  const lesson = attempt.test.title
    ? null
    : await prisma.lesson.findUnique({ where: { id: lessonId }, select: { title: true } });

  return (
    <ResultScreen
      attempt={attempt}
      backHref={`/watch/${lessonId}`}
      fallbackTitle={lesson?.title}
      isTeacher={isTeacher}
    />
  );
}
