import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const attempt = await prisma.studentAttempt.findFirst();
  const question = await prisma.question.findFirst({ where: { type: "MULTIPLE_CHOICE_GROUP" } });
  
  if (!attempt || !question) return console.log("Missing attempt or question");

  try {
    await prisma.studentAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        answerProvided: { "test": "test" } as any, // force passing an object
        pointsAwarded: 0,
      }
    });
    console.log("Prisma accepted object for String field!");
  } catch (e: any) {
    console.log("Prisma threw error:", e.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
