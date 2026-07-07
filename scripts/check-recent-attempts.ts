import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.studentAttempt.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      answers: {
        include: {
          question: true,
          subAnswers: true
        }
      }
    }
  });

  for (const attempt of attempts) {
    console.log(`\nAttempt ID: ${attempt.id}`);
    const mcgAnswers = attempt.answers.filter(a => a.question.type === 'MULTIPLE_CHOICE_GROUP');
    for (const ans of mcgAnswers) {
      console.log(`  Question ID: ${ans.questionId}`);
      console.log(`  Answer Provided: ${ans.answerProvided}`);
      console.log(`  SubAnswers count: ${ans.subAnswers.length}`);
      if (ans.subAnswers.length > 0) {
        console.log(`  SubAnswers:`, ans.subAnswers.map(sa => ({ subQId: sa.subQuestionId, ans: sa.answerProvided })));
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
