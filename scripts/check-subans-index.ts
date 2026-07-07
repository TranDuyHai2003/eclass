import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const subAnswers = await prisma.studentSubAnswer.findMany({
    where: {
      subQuestionId: { in: ['0', '1', '2', '3', '4', '5'] }
    },
    include: {
      studentAnswer: true
    }
  });

  console.log(`Found ${subAnswers.length} subAnswers with index keys.`);
  if (subAnswers.length > 0) {
    console.log(subAnswers.slice(0, 5));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
