import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import TestResultClient from "@/app/watch/[lessonId]/results/[attemptId]/_components/TestResultClient";

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
          lesson: true,
          course: true,
          sections: {
            include: { questions: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
        },
      },
      answers: true,
    },
  });

  // Guard: attempt must exist and belong to this course's test
  if (!attempt || attempt.test.courseId !== courseId) {
    return notFound();
  }

  // Only the student or admin/teacher can view
  if (attempt.userId !== session.user.id && session.user.role === "STUDENT") {
    redirect("/");
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-gray-50">
      <TestResultClient attempt={attempt} />
    </div>
  );
}
