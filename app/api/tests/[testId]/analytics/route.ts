import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { testId } = await params;

  // 1. Fetch attempts for this test
  const attempts = await prisma.studentAttempt.findMany({
    where: {
      testId,
      completedAt: { not: null },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      answers: true,
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  // 2. Fetch test questions to calculate per-question stats
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: {
        include: {
          questions: true,
        },
      },
    },
  });

  if (!test) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const questions = test.sections.flatMap(s => s.questions);
  const totalAttempts = attempts.length;

  const questionStats = questions.map((q, index) => {
    const correctAnswers = attempts.filter(a => 
      a.answers.find(ans => ans.questionId === q.id && ans.isCorrect === true)
    ).length;

    return {
      id: q.id,
      label: `Câu ${index + 1}`,
      correctRate: totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0,
    };
  });

  return NextResponse.json({
    attempts: attempts.map(a => ({
      id: a.id,
      user: a.user,
      score: a.score,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })),
    questionStats,
  });
}
