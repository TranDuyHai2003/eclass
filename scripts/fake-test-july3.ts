import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Creating fake test on 2026-07-03...");
  
  // Create a date corresponding to 2026-07-03 in Vietnam Time (UTC+7)
  const targetDate = new Date('2026-07-03T02:00:00Z');
  
  // 1. Get all offline students
  const students = await prisma.user.findMany({
    where: { studentType: 'OFFLINE' }
  });
  
  console.log(`Found ${students.length} OFFLINE students.`);

  // 2. Create a test
  const test = await prisma.test.create({
    data: {
      title: "Bài kiểm tra cuối tuần 3/7",
      pdfUrl: "https://example.com/fake.pdf",
      duration: 60,
      createdAt: targetDate,
      type: "EXAM",
    }
  });
  
  console.log(`Created test with ID: ${test.id}`);
  
  // 3. Create full attempts
  let count = 0;
  for (const student of students) {
    // Random score between 4 and 10
    let score = Math.floor(Math.random() * 6) + 4; 
    if (score === 9 && Math.random() > 0.5) score = 10;
    
    await prisma.studentAttempt.create({
      data: {
        userId: student.id,
        testId: test.id,
        score: score,
        startedAt: targetDate,
        completedAt: new Date(targetDate.getTime() + 60 * 60 * 1000) // +1 hour
      }
    });
    count++;
  }
  
  console.log(`Created ${count} attempts for the test.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
