import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = session.user.id!;

  // 1. Fetch user attempts in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attempts = await prisma.studentAttempt.findMany({
    where: {
      userId,
      completedAt: {
        gte: thirtyDaysAgo,
      },
    },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
    take: 10, // Analyze up to 10 recent tests
  });

  const totalTestsCompleted = attempts.length;

  // 2. Aggregate statistics by category
  const statsMap: Record<string, { wrong: number; total: number }> = {};

  attempts.forEach((attempt) => {
    attempt.answers.forEach((ans) => {
      // @ts-ignore - 'category' doesn't exist on Question yet, using title/placeholder
      const category = (ans.question as any).category || "Chưa phân loại";
      // Normalize category name
      const normalized = category.trim().toLowerCase();
      
      if (!statsMap[normalized]) {
        statsMap[normalized] = { wrong: 0, total: 0 };
      }

      statsMap[normalized].total += 1;
      if (ans.isCorrect === false) {
        statsMap[normalized].wrong += 1;
      }
    });
  });

  // 3. Filter and sort
  const results = Object.entries(statsMap)
    .map(([category, stat]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      wrong_count: stat.wrong,
      total_attempted: stat.total,
      error_rate: (stat.wrong / stat.total) * 100,
    }))
    .filter((r) => r.total_attempted >= 3); // Minimum 3 questions to be statistically significant

  const weaknesses = [...results]
    .filter((r) => r.error_rate > 30) // Only count as weakness if > 30% error
    .sort((a, b) => b.error_rate - a.error_rate)
    .slice(0, 3);

  const strengths = [...results]
    .filter((r) => r.error_rate <= 20) // Strengths are <= 20% error
    .sort((a, b) => a.error_rate - b.error_rate)
    .slice(0, 3);

  // Check eligibility
  const totalQuestionsDone = Object.values(statsMap).reduce((acc, curr) => acc + curr.total, 0);
  const is_eligible = totalTestsCompleted >= 2 || totalQuestionsDone >= 20;

  return NextResponse.json({
    status: "success",
    data: {
      is_eligible,
      total_tests_completed: totalTestsCompleted,
      total_questions_done: totalQuestionsDone,
      weaknesses,
      strengths,
    },
  });
}
