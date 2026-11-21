import { auth } from "@/auth";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";
import { isPointsEnabled } from "@/lib/points/config";
import { getPointsCard } from "@/lib/points/queries";
import { getStudentHomeExtras } from "@/lib/home/student-home";
import { getAvatar } from "@/lib/game/inventory";
import { buildNpcLines } from "@/lib/game/npc";
import { getLeaderboard } from "@/lib/game/leaderboard";
import { getLevel } from "@/lib/points/levels";
import { maskUsersForDemo } from "@/lib/demo-privacy";
import { prisma, prismaBase } from "@/lib/prisma";

/** Câu thoại NPC từ dữ liệu trang chủ (tách hàm để Date.now() không nằm trong thân component) */
function buildHomeNpc(c: Omit<Parameters<typeof buildNpcLines>[0], "overdue" | "dueSoon"> & { todo: { title: string; dueDate: Date | null }[] }) {
  const now = Date.now();
  const { todo, ...rest } = c;
  return buildNpcLines({
    ...rest,
    overdue: todo.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).map((t) => ({ title: t.title })),
    dueSoon: todo
      .filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= now && new Date(t.dueDate).getTime() - now < 2 * 86400000)
      .map((t) => ({ title: t.title, dueDate: t.dueDate! })),
  });
}

export default async function Home() {
  const session = await auth();
  const { courses, lastLesson, stats } = await getDashboardData();
  const isStudent = session?.user?.role === "STUDENT" && !!session.user.id;
  const uid = session?.user?.id ?? "";
  // Các truy vấn của học sinh chạy song song (xu, bài cần làm, nhân vật)
  const [points, extras, avatar, me] = await Promise.all([
    isStudent && isPointsEnabled() ? getPointsCard(uid).catch(() => null) : Promise.resolve(null),
    isStudent ? getStudentHomeExtras(uid, courses.map((c) => c.id)).catch(() => null) : Promise.resolve(null),
    isStudent && isPointsEnabled() ? getAvatar(uid).then((a) => a.config).catch(() => null) : Promise.resolve(null),
    isStudent ? prisma.user.findUnique({ where: { id: uid }, select: { isApproved: true, isDemo: true, studyClass: { select: { grade: true } } } }) : Promise.resolve(null),
  ]);
  // Top 3 Bảng Vàng khối mình (cache 60 giây, che tên demo ngoài cache) + câu thoại NPC (tính ở server, xác định)
  const grade = me?.studyClass?.grade ?? null;
  const top3 =
    isStudent && isPointsEnabled() && grade
      ? await getLeaderboard({ grade }, "all", 3)
          .then((r) => maskUsersForDemo(r.map((x) => ({ ...x, id: x.userId })), prismaBase))
          .then((r) => r.map(({ id: _id, ...x }) => x))
          .catch(() => [])
      : [];
  const npcLines =
    isStudent && points
      ? buildHomeNpc({
          name: session?.user?.name,
          canEarn: !!me?.isApproved && !me?.isDemo,
          todo: extras?.todo ?? [],
          todoCount: extras?.todoTotal,
          weekActivities: points.weekActivities,
          weekTarget: points.weekTarget,
          thisWeekCounted: points.thisWeekCounted,
          lifetimeEarned: points.lifetimeEarned,
          nextLevel: (() => { const lv = getLevel(points.lifetimeEarned); return lv.next ? { name: lv.next.name, toNext: lv.toNext } : null; })(),
          balance: points.balance,
          gems: points.gems,
          goal: points.goal ? { title: points.goal.title, price: points.goal.price } : null,
        })
      : null;

  return (
    <Dashboard
      user={session?.user || null}
      courses={courses}
      lastLesson={lastLesson}
      stats={stats}
      points={points}
      extras={extras}
      avatar={avatar}
      npcLines={npcLines}
      top3={top3}
      grade={grade}
    />
  );
}
