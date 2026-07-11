import { PrismaClient } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Ho_Chi_Minh';

async function main() {
  const startDateStr = '2026-07-01';
  const endDateStr = '2026-07-31';

  const startDate = fromZonedTime(new Date(`${startDateStr}T00:00:00.000`), TIMEZONE);
  const endDate = fromZonedTime(new Date(`${endDateStr}T23:59:59.999`), TIMEZONE);

  const testsInPeriod = await prisma.test.findMany({
    where: {
      OR: [
        { dueDate: { gte: startDate, lte: endDate } },
        { dueDate: null, createdAt: { gte: startDate, lte: endDate } }
      ]
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdAt: true,
      type: true,
      course: { select: { level: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${testsInPeriod.length} tests in period`);
  for (const t of testsInPeriod) {
    console.log(`Test: ${t.title} | ID: ${t.id} | Due: ${t.dueDate} | Created: ${t.createdAt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
