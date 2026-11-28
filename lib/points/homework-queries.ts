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

/** Bài "gần đây" = có hoạt động (giao bài, hạn nộp, học sinh lớp nộp / làm online) trong 30 ngày (thầy yêu cầu 28/11) */
export const RECENT_DAYS = 30;

/**
 * Bài tập về nhà của lớp: bài có nộp ảnh (hasHomework) hoặc có đề BTVN làm online (Test loại HOMEWORK),
 * thuộc khoá học của lớp. Xếp theo hoạt động gần nhất lên đầu; `recent` = hoạt động trong 30 ngày.
 * (28/11: trước xếp theo thứ tự chương → toàn bài từ lâu ở đầu, bài mới không thấy.)
 */
export async function getClassHomeworkLessons(classId: string, now: Date = new Date()) {
  const lessons = await prisma.lesson.findMany({
    where: {
      OR: [{ hasHomework: true }, { test: { type: "HOMEWORK" } }],
      chapter: { course: { OR: [{ classes: { some: { id: classId } } }, { classes: { none: {} } }] } },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      chapter: { select: { title: true, course: { select: { title: true } } } },
      homeworkDeadlines: { where: { classId }, select: { dueDate: true } },
      homeworkSubmissions: { where: { user: { classId } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      test: {
        select: {
          id: true,
          type: true,
          createdAt: true,
          dueDate: true,
          deadlines: { where: { classId }, select: { dueDate: true } },
          attempts: { where: { completedAt: { not: null }, user: { classId } }, orderBy: { completedAt: "desc" }, take: 1, select: { completedAt: true } },
        },
      },
    },
  });
  const since = now.getTime() - RECENT_DAYS * 86_400_000;
  return lessons
    .map((l) => {
      const due = l.homeworkDeadlines[0]?.dueDate ?? l.test?.deadlines[0]?.dueDate ?? l.test?.dueDate ?? null;
      const times = [l.createdAt, l.test?.createdAt, due, l.homeworkSubmissions[0]?.createdAt, l.test?.attempts[0]?.completedAt]
        .filter((d): d is Date => !!d)
        .map((d) => d.getTime());
      const activity = Math.max(...times);
      return {
        id: l.id,
        title: l.title,
        chapter: l.chapter.title,
        course: l.chapter.course.title,
        dueDate: due?.toISOString() ?? null,
        online: l.test?.type === "HOMEWORK",
        activityAt: new Date(activity).toISOString(),
        recent: activity >= since,
      };
    })
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt));
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
        attempts: { where: { completedAt: { not: null }, test: { lessonId } }, orderBy: { completedAt: "asc" }, take: 1, select: { completedAt: true, score: true } },
      },
    }),
    prisma.homeworkDeadline.findUnique({ where: { lessonId_classId: { lessonId, classId } }, select: { dueDate: true } }),
  ]);
  // Hạn: hạn đặt ở trang này (bài nộp ảnh) → hạn riêng của lớp cho đề online → hạn chung của đề
  const test = await prisma.test.findUnique({ where: { lessonId }, select: { dueDate: true, deadlines: { where: { classId }, select: { dueDate: true } } } });
  const due = deadline?.dueDate ?? test?.deadlines[0]?.dueDate ?? test?.dueDate ?? null;
  return {
    dueDate: due?.toISOString() ?? null,
    online: !!test,
    students: students.map((s) => {
      const sub = s.homeworkSubmissions[0];
      const at = s.attempts[0];
      return {
        id: s.id,
        name: s.name || s.email || "Học sinh",
        email: s.email,
        approved: s.isApproved,
        submittedAt: sub?.createdAt.toISOString() ?? null,
        late: !!(sub && due && sub.createdAt > due),
        /** Lần làm đề online đầu tiên (BTVN làm trên web) */
        doneAt: at?.completedAt?.toISOString() ?? null,
        doneLate: !!(at?.completedAt && due && at.completedAt > due),
        score: at?.score ?? null,
        level: s.homeworkReviews[0]?.level ?? null,
      };
    }),
  };
}

export type CheckClass = Awaited<ReturnType<typeof getCheckClasses>>[number];
export type CheckLesson = Awaited<ReturnType<typeof getClassHomeworkLessons>>[number];
export type CheckList = Awaited<ReturnType<typeof getHomeworkCheckList>>;
