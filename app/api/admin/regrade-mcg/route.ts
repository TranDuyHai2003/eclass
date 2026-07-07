import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function checkSubQuestionCorrect(
  studentAns: string | undefined | null, 
  correctAns: string, 
  type: string
): boolean {
  if (!studentAns) return false;
  return studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    // Check auth (assuming admin)
    // For now, allow a secret key to bypass for easy recovery
    const { secret } = await req.json();
    if (secret !== "RECOVER_MCG_123") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Find all StudentAnswer for MULTIPLE_CHOICE_GROUP where subAnswers is empty
    const answers = await prisma.studentAnswer.findMany({
      where: {
        question: { type: "MULTIPLE_CHOICE_GROUP" },
        subAnswers: { none: {} } // only answers without subAnswers
      },
      include: {
        question: {
          include: { subQuestions: true }
        },
        attempt: true
      }
    });

    let recoveredCount = 0;

    for (const ans of answers) {
      if (!ans.answerProvided) continue;

      try {
        let valObj: Record<string, string> = {};
        
        // Try parsing JSON if it was saved as JSON string
        if (ans.answerProvided.startsWith("{")) {
          valObj = JSON.parse(ans.answerProvided);
        } else {
          continue; // Cannot recover if not JSON
        }

        const subQuestions = ans.question.subQuestions || [];
        const subAnswersData = [];
        let wrongCount = 0;

        for (const subQ of subQuestions) {
          const studentValue = valObj[subQ.id] || null;
          let isCorrectSub = null;
          
          if (studentValue) {
            isCorrectSub = (studentValue === subQ.correctAnswer);
          }

          if (isCorrectSub === false) wrongCount++;

          subAnswersData.push({
            subQuestionId: subQ.id,
            answerProvided: studentValue,
            isCorrect: isCorrectSub
          });
        }

        const isCorrect = wrongCount === 0;
        const pointsAwarded = isCorrect ? ans.question.points : 0;

        // Update in DB
        await prisma.studentAnswer.update({
          where: { id: ans.id },
          data: {
            answerProvided: "", // clear it
            isCorrect,
            pointsAwarded,
            subAnswers: {
              create: subAnswersData
            }
          }
        });

        // Also update attempt score
        if (ans.attempt) {
          const allAnswers = await prisma.studentAnswer.findMany({
            where: { attemptId: ans.attemptId }
          });
          const totalPoints = allAnswers.reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);
          const test = await prisma.test.findUnique({
            where: { id: ans.attempt.testId },
            include: { sections: { include: { questions: true } } }
          });
          
          let maxPoints = 0;
          test?.sections.forEach(s => {
            s.questions.forEach(q => {
              maxPoints += q.points;
            });
          });

          const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 10 * 100) / 100 : 0;
          await prisma.studentAttempt.update({
            where: { id: ans.attemptId },
            data: { score }
          });
        }

        recoveredCount++;
      } catch (e) {
        console.error("Error recovering ans", ans.id, e);
      }
    }

    return NextResponse.json({ success: true, recoveredCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
