import { prisma } from "@/lib/prisma";
import { effectiveDueDate } from "@/lib/deadline";

export interface HomeTodoItem {
  lessonId: string;
  title: string;
  chapterTitle: string;
  courseTitle: string;
  duration: number;
  dueDate: Date | null;
}

export interface HomeRecentResult {
  attemptId: string;
  lessonId: string;
  title: string;
  score: number | null;
  completedAt: Date;
}

/**
 * Hai khối trên trang chủ học sinh:
 * - "Bài cần làm": bài kiểm tra / bài tập (gắn với bài học) trong các khoá học sinh xem được mà chưa nộp lần nào,
 *   còn hạn (gần hạn nhất) → không có hạn (theo lộ trình) → đã quá hạn (mới quá hạn trước).
 *   Hạn là hạn HIỆU LỰC với học sinh (hạn riêng của lớp → hạn chung), xem lib/deadline.ts.
 * - "Kết quả gần đây": các lượt đã nộp mới nhất (điểm thang 10), mở thẳng màn chữa bài.
 */
export async function getStudentHomeExtras(userId: string, courseIds: string[], limit = 4) {
  if (courseIds.length === 0) return { todo: [] as HomeTodoItem[], todoTotal: 0, recent: [] as HomeRecentResult[] };

  const [lessons, attempts, me] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        chapter: { courseId: { in: courseIds }, isHidden: false },
        test: { isNot: null },
      },
      select: {
        id: true,
        title: true,
        position: true,
        chapter: { select: { title: true, position: true, course: { select: { id: true, title: true, createdAt: true } } } },
        test: { select: { id: true, title: true, duration: true, dueDate: true, deadlines: { select: { classId: true, dueDate: true } } } },
      },
    }),
    prisma.studentAttempt.findMany({
      where: { userId, completedAt: { not: null }, test: { lesson: { isNot: null } } },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        testId: true,
        score: true,
        completedAt: true,
        test: { select: { title: true, lesson: { select: { id: true, title: true } } } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { classId: true } }),
  ]);
  const classId = me?.classId ?? null;
  const dueOf = (l: (typeof lessons)[number]) => (l.test ? effectiveDueDate(l.test, classId) : null);

  const doneTests = new Set(attempts.map((a) => a.testId));
  const order = courseIds;
  const now = Date.now();
  // Nhóm: 0 = còn hạn (gần hạn nhất trước), 1 = không có hạn (theo lộ trình), 2 = đã quá hạn (mới quá hạn trước)
  // → đề quá hạn từ lâu không chiếm mãi đầu danh sách
  const group = (d: Date | null | undefined) => (!d ? 1 : d.getTime() >= now ? 0 : 2);
  const pending = lessons
    .filter((l) => l.test && !doneTests.has(l.test.id))
    .sort((a, b) => {
      const da = dueOf(a);
      const db = dueOf(b);
      const ga = group(da);
      const gb = group(db);
      if (ga !== gb) return ga - gb;
      const ta = da?.getTime() ?? 0;
      const tb = db?.getTime() ?? 0;
      if (ga === 0 && ta !== tb) return ta - tb;
      if (ga === 2 && ta !== tb) return tb - ta;
      const ca = order.indexOf(a.chapter.course.id);
      const cb = order.indexOf(b.chapter.course.id);
      if (ca !== cb) return ca - cb;
      if (a.chapter.position !== b.chapter.position) return a.chapter.position - b.chapter.position;
      return a.position - b.position;
    });

  const todo: HomeTodoItem[] = pending.slice(0, limit).map((l) => ({
    lessonId: l.id,
    title: l.test?.title || l.title,
    chapterTitle: l.chapter.title,
    courseTitle: l.chapter.course.title,
    duration: l.test?.duration ?? 0,
    dueDate: dueOf(l),
  }));

  // Mỗi đề chỉ lấy lượt nộp mới nhất
  const seen = new Set<string>();
  const recent: HomeRecentResult[] = [];
  for (const a of attempts) {
    if (seen.has(a.testId) || !a.test.lesson || !a.completedAt) continue;
    seen.add(a.testId);
    recent.push({
      attemptId: a.id,
      lessonId: a.test.lesson.id,
      title: a.test.title || a.test.lesson.title,
      score: a.score,
      completedAt: a.completedAt,
    });
    if (recent.length >= limit) break;
  }

  return { todo, todoTotal: pending.length, recent };
}

/** Các khoá học sinh được thấy (cùng quy tắc với trang chủ: lớp được gán, hoặc khoá không gán lớp đúng trình độ) */
export async function getVisibleCourseIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, classId: true, level: true } });
  const where =
    !user || user.role !== "STUDENT" || !user.classId
      ? {}
      : { OR: [{ classes: { some: { id: user.classId } } }, { classes: { none: {} }, level: user.level }] };
  const rows = await prisma.course.findMany({ where: { ...where, isPublished: true }, select: { id: true } });
  return rows.map((r) => r.id);
}
