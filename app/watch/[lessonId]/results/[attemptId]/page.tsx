import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { loadAttemptForResult } from "@/lib/attempt-result";
import { ResultScreen } from "./_components/ResultScreen";
import { isPointsEnabled } from "@/lib/points/config";
import { getPointsForAttempt } from "@/lib/points/queries";

export const dynamic = "force-dynamic";

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/login");

  const { lessonId, attemptId } = await params;

  const attempt = await loadAttemptForResult(attemptId);
  if (!attempt) return notFound();

  // Chỉ học sinh làm bài hoặc giáo viên/admin được xem
  const isOwner = attempt.userId === session.user.id;
  const isTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
  if (!isOwner && !isTeacher) return redirect("/");

  // Học sinh chưa nộp bài thì quay lại bài học (không xem kết quả/đáp án khi đang làm)
  if (!attempt.completedAt && !isTeacher) return redirect(`/watch/${lessonId}`);

  const lesson = attempt.test.title
    ? null
    : await prisma.lesson.findUnique({ where: { id: lessonId }, select: { title: true } });

  const pointsEarned =
    isPointsEnabled() && isOwner && !isTeacher
      ? await getPointsForAttempt(session.user.id!, attempt.id).catch(() => [])
      : [];

  return (
    <ResultScreen
      attempt={attempt}
      pointsEarned={pointsEarned}
      backHref={`/watch/${lessonId}`}
      fallbackTitle={lesson?.title}
      isTeacher={isTeacher}
    />
  );
}
