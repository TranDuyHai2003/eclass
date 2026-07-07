import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.studentAttempt.findMany({
    where: {
      score: {
        gte: 4.4,
        lte: 4.6
      }
    },
    include: {
      answers: {
        include: {
          question: true,
          subAnswers: true
        }
      }
    }
  });

  console.log(`Found ${attempts.length} attempts with score ~4.5`);
  for (const attempt of attempts) {
    const mcgAnswers = attempt.answers.filter(a => a.question.type === 'MULTIPLE_CHOICE_GROUP');
    for (const ans of mcgAnswers) {
      if (ans.subAnswers.length === 0) {
        console.log(`\nAttempt ID: ${attempt.id}`);
        console.log(`  Question ID: ${ans.questionId}`);
        console.log(`  Answer Provided: ${ans.answerProvided}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
