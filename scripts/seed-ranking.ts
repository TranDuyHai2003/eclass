import { PrismaClient, Role, StudentType, Level, TestType } from "@prisma/client";

const prisma = new PrismaClient();

function getWeekCode(date: Date, offsetWeeks: number = 0): string {
  const d = new Date(date);
  d.setDate(d.getDate() + offsetWeeks * 7);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱 Starting seed ranking data into local database...");

  // 1. Create or Find StudyClass
  const studyClass = await prisma.studyClass.upsert({
    where: { name: "Lớp 12 Toán Chuyên / NC" },
    update: {},
    create: {
      name: "Lớp 12 Toán Chuyên / NC",
    },
  });

  console.log(`✅ StudyClass: ${studyClass.name} (${studyClass.id})`);

  // Update all existing users without class to this class
  await prisma.user.updateMany({
    where: { classId: null },
    data: { classId: studyClass.id },
  });

  // 2. Student Data Definition (25 realistic Vietnamese students)
  const studentNames = [
    { name: "Nguyễn Đỗ Như Quỳnh (NC)", avatarBg: "E91E63" },
    { name: "Trần Đức Minh (NC)", avatarBg: "2196F3" },
    { name: "Hoàng Kim Yến (nc)", avatarBg: "9C27B0" },
    { name: "Lê Bảo Trâm (NC)", avatarBg: "FF9800" },
    { name: "Nguyễn Ngọc Linh", avatarBg: "00BCD4" },
    { name: "Hồ Khả Diệu (NC)", avatarBg: "4CAF50" },
    { name: "Đỗ Hải Bình (nc)", avatarBg: "3F51B5" },
    { name: "Phạm Hoàng Anh (NC)", avatarBg: "FF5722" },
    { name: "Nguyễn Linh San (NC)", avatarBg: "673AB7" },
    { name: "Nguyễn Gia Hiếu", avatarBg: "009688" },
    { name: "Nguyễn Ngọc Minh Châu (nc)", avatarBg: "E91E63" },
    { name: "Bùi Khánh Linh", avatarBg: "795548" },
    { name: "Đặng Tiến Dũng", avatarBg: "607D8B" },
    { name: "Võ Thị Mai Anh", avatarBg: "FFC107" },
    { name: "Vũ Hoàng Long", avatarBg: "1E88E5" },
    { name: "Trịnh Hải Nam", avatarBg: "D81B60" },
    { name: "Phan Bảo Ngọc", avatarBg: "8E24AA" },
    { name: "Cao Văn Thành", avatarBg: "43A047" },
    { name: "Ngô Phương Thảo", avatarBg: "F4511E" },
    { name: "Đinh Quốc Huy", avatarBg: "3949AB" },
    { name: "Lý Thị Kim Ngân", avatarBg: "00ACC1" },
    { name: "Dương Tuấn Kiệt", avatarBg: "7CB342" },
    { name: "Lương Hoài Nam", avatarBg: "FB8C00" },
    { name: "Huỳnh Thanh Hà", avatarBg: "C2185B" },
    { name: "Tạ Minh Đức", avatarBg: "512DA8" },
  ];

  const createdUsers: any[] = [];
  for (let i = 0; i < studentNames.length; i++) {
    const s = studentNames[i];
    const email = `student_${i + 1}_demo@eclass.edu.vn`;
    const image = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=${s.avatarBg}&color=fff&size=128`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: s.name,
        classId: studyClass.id,
        image,
      },
      create: {
        name: s.name,
        email,
        image,
        role: Role.STUDENT,
        isApproved: true,
        studentType: StudentType.ONLINE,
        level: Level.ADVANCED,
        classId: studyClass.id,
      },
    });
    createdUsers.push(user);
  }

  // Add existing non-demo users to list
  const existingUsers = await prisma.user.findMany({
    where: { classId: studyClass.id },
  });

  const allClassUsers = Array.from(
    new Map([...existingUsers, ...createdUsers].map((u) => [u.id, u])).values()
  );

  console.log(`✅ Total students in class: ${allClassUsers.length}`);

  // 3. Create Course, Chapter & 8 Tests
  const adminUser = (await prisma.user.findFirst({ where: { role: Role.ADMIN } })) || allClassUsers[0];

  const course = await prisma.course.upsert({
    where: { id: "seed-course-ranking-1" },
    update: {},
    create: {
      id: "seed-course-ranking-1",
      userId: adminUser.id,
      title: "Chuyên Đề Luyện Thi THPTQG Toán NC 2026",
      description: "Bộ đề trắc nghiệm chuyên sâu luyện thi đại học môn Toán",
      isPublished: true,
      level: Level.ADVANCED,
      classes: {
        connect: [{ id: studyClass.id }],
      },
    },
  });

  const chapter = await prisma.chapter.upsert({
    where: { id: "seed-chapter-ranking-1" },
    update: {},
    create: {
      id: "seed-chapter-ranking-1",
      courseId: course.id,
      title: "Chương I: Ứng dụng Đạo hàm & Hình học Không gian",
      position: 1,
      isPublished: true,
    },
  });

  const testTitles = [
    "Bài 1 - Mệnh đề & Tập hợp",
    "Bài 2 - Hàm số bậc hai & Đồ thị",
    "Bài 3 - Góc lượng giác từ 0 đến 180 độ",
    "Bài 4 - Skill Tâm tỉ cự & Vector",
    "Bài 5 - Ôn tập tổng hợp Theo chủ đề 01",
    "Bài 6 - Đạo hàm & Tiệm cận đồ thị hàm số",
    "Bài 7 - GTLN & GTNN của hàm số NC",
    "Bài 8 - Đề kiểm tra định kỳ Tháng 8 (NC)",
  ];

  const createdTests: any[] = [];
  for (let i = 0; i < testTitles.length; i++) {
    const title = testTitles[i];
    const lessonId = `seed-lesson-ranking-${i + 1}`;
    const testId = `seed-test-ranking-${i + 1}`;

    const lesson = await prisma.lesson.upsert({
      where: { id: lessonId },
      update: { title },
      create: {
        id: lessonId,
        chapterId: chapter.id,
        title,
        position: i + 1,
        isPublished: true,
        type: "QUIZ",
      },
    });

    const dueDate = new Date(Date.now() - (8 - i) * 3 * 24 * 60 * 60 * 1000); // Past due dates

    const test = await prisma.test.upsert({
      where: { id: testId },
      update: { title, lessonId: lesson.id },
      create: {
        id: testId,
        title,
        subject: "Toán",
        description: `Kiểm tra trắc nghiệm ${title}`,
        pdfUrl: "https://example.com/test.pdf",
        duration: 45,
        type: TestType.HOMEWORK,
        lessonId: lesson.id,
        userId: adminUser.id,
        dueDate,
      },
    });
    createdTests.push(test);
  }

  console.log(`✅ Tests & Lessons created: ${createdTests.length}`);

  // 4. Create Student Attempts across the 8 tests
  console.log("📝 Generating realistic student attempts...");

  // Delete old seed attempts to avoid duplicates
  await prisma.studentAttempt.deleteMany({
    where: {
      testId: { in: createdTests.map((t) => t.id) },
    },
  });

  const now = new Date();

  // Tiered performance profiles for students
  for (let i = 0; i < allClassUsers.length; i++) {
    const student = allClassUsers[i];

    // Determine target performance tier based on index
    let numTestsToComplete = 8;
    let baseScore = 8.5;
    let scoreVariance = 1.0;

    if (i < 3) {
      // Top 3 MONARCHS
      numTestsToComplete = 8;
      baseScore = 9.2;
      scoreVariance = 0.6;
    } else if (i < 8) {
      // Top 4 - 8 HIGH PERFORMERS
      numTestsToComplete = 8;
      baseScore = 8.0;
      scoreVariance = 0.8;
    } else if (i < 15) {
      // Top 9 - 15 AVERAGE PERFORMERS
      numTestsToComplete = Math.floor(Math.random() * 3) + 6; // 6-8 tests
      baseScore = 6.8;
      scoreVariance = 1.2;
    } else if (i < 20) {
      // Top 16 - 20 SLOW PERFORMERS
      numTestsToComplete = Math.floor(Math.random() * 3) + 3; // 3-5 tests
      baseScore = 5.2;
      scoreVariance = 1.5;
    } else {
      // ALARM ZONE (21 - 25)
      numTestsToComplete = Math.floor(Math.random() * 3) + 1; // 1-3 tests
      baseScore = 3.5;
      scoreVariance = 2.0;
    }

    for (let tIdx = 0; tIdx < numTestsToComplete; tIdx++) {
      const test = createdTests[tIdx];

      // Calculate realistic test score between 0.5 and 10.0
      const rawScore = baseScore + (Math.random() * 2 - 1) * scoreVariance;
      const score = parseFloat(Math.min(10, Math.max(0.5, rawScore)).toFixed(1));

      const completedAt = new Date(now.getTime() - (8 - tIdx) * 2 * 24 * 60 * 60 * 1000 + (i * 1000 * 60));

      await prisma.studentAttempt.create({
        data: {
          userId: student.id,
          testId: test.id,
          score,
          startedAt: new Date(completedAt.getTime() - 45 * 60 * 1000),
          completedAt,
        },
      });
    }
  }

  console.log("✅ Student attempts created!");

  // 5. Create Previous Week Snapshots for Rank Movement (UP, DOWN, SAME, NEW)
  console.log("📸 Generating Previous Week Leaderboard Snapshots...");

  const previousWeekCode = getWeekCode(now, -1);

  // Clean old snapshots for previous week
  await prisma.leaderboardSnapshot.deleteMany({
    where: {
      studyClassId: studyClass.id,
      periodCode: previousWeekCode,
    },
  });

  // Calculate previous scores with slight variations to produce realistic UP/DOWN rank shifts
  for (let i = 0; i < allClassUsers.length; i++) {
    const student = allClassUsers[i];

    // Give most students a previous rank with ± 1 to 3 rank changes
    let prevRank = i + 1;
    if (i === 0) prevRank = 2; // Top 1 moved UP from #2
    else if (i === 1) prevRank = 1; // Top 2 moved DOWN from #1
    else if (i === 3) prevRank = 5; // Top 4 moved UP from #5
    else if (i === 4) prevRank = 3; // Top 5 moved DOWN from #3
    else if (i === 7) prevRank = 10; // Top 8 moved UP from #10
    else if (i === 9) prevRank = 7; // Top 10 moved DOWN from #7
    else if (i >= 22) continue; // Bottom 3 students have no snapshot -> NEW tag!

    const prevScore = parseFloat((8.5 - (prevRank * 0.2) + (Math.random() * 0.4)).toFixed(1));

    await prisma.leaderboardSnapshot.create({
      data: {
        userId: student.id,
        studyClassId: studyClass.id,
        periodCode: previousWeekCode,
        snapshotType: "WEEKLY",
        score: Math.max(1, prevScore),
        rankingScore: Math.max(10, prevScore * 10),
        completedTests: Math.max(1, 8 - (prevRank % 3)),
        rank: prevRank,
      },
    });
  }

  console.log("🎉 SUCCESS! Seed ranking data completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
