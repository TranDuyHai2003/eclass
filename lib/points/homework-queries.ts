import { prisma } from "@/lib/prisma";

/**
 * Dữ liệu trang "Duyệt chữa bài" của giáo viên (/teacher/homework/check):
 * lớp → các bài có bài tập về nhà thuộc khoá học của lớp → cả lớp (kể cả chưa nộp online) + bài nộp + mức duyệt.
 */

export async function getCheckClasses() {
  const classes = await prisma.studyClass.findMany({
    orderBy: [{ grade: "desc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, _count: { select: { users: { where: { role: "STUDENT" } } } } },
  });
  return classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade, students: c._count.users }));
}

/** Bài có BTVN trong khoá học của lớp (khoá gắn lớp, hoặc khoá không gắn lớp nào = mọi lớp), mới nhất lên đầu */
export async function getClassHomeworkLessons(classId: string) {
  const lessons = await prisma.lesson.findMany({
    where: {
      hasHomework: true,
      chapter: { course: { OR: [{ classes: { some: { id: classId } } }, { classes: { none: {} } }] } },
    },
    orderBy: [{ chapter: { course: { title: "asc" } } }, { chapter: { position: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      chapter: { select: { title: true, course: { select: { title: true } } } },
      homeworkDeadlines: { where: { classId }, select: { dueDate: true } },
    },
  });
  return lessons.map((l) => ({
    id: l.id,
    title: l.title,
    chapter: l.chapter.title,
    course: l.chapter.course.title,
    dueDate: l.homeworkDeadlines[0]?.dueDate.toISOString() ?? null,
  }));
}

export async function getHomeworkCheckList(lessonId: string, classId: string) {
  const [students, deadline] = await Promise.all([
    prisma.user.findMany({
      where: { classId, role: "STUDENT" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isApproved: true,
        homeworkSubmissions: { where: { lessonId }, select: { createdAt: true, status: true } },
        homeworkReviews: { where: { lessonId }, select: { level: true, updatedAt: true } },
      },
    }),
    prisma.homeworkDeadline.findUnique({ where: { lessonId_classId: { lessonId, classId } }, select: { dueDate: true } }),
  ]);
  const due = deadline?.dueDate ?? null;
  return {
    dueDate: due?.toISOString() ?? null,
    students: students.map((s) => {
      const sub = s.homeworkSubmissions[0];
      return {
        id: s.id,
        name: s.name || s.email || "Học sinh",
        email: s.email,
        approved: s.isApproved,
        submittedAt: sub?.createdAt.toISOString() ?? null,
        late: !!(sub && due && sub.createdAt > due),
        level: s.homeworkReviews[0]?.level ?? null,
      };
    }),
  };
}

export type CheckClass = Awaited<ReturnType<typeof getCheckClasses>>[number];
export type CheckLesson = Awaited<ReturnType<typeof getClassHomeworkLessons>>[number];
export type CheckList = Awaited<ReturnType<typeof getHomeworkCheckList>>;
