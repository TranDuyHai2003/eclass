import { redirect, notFound } from "next/navigation";
import { Baloo_2 } from "next/font/google";
import { auth } from "@/auth";
import { ShopPage } from "@/components/shop/ShopPage";
import { isPointsEnabled } from "@/lib/points/config";
import { getStudentPointsPage } from "@/lib/points/queries";
import { expireStaleRedemptions } from "@/lib/points/redemption";
import { getStudentHomeExtras, getVisibleCourseIds } from "@/lib/home/student-home";
import { getGrades, getLeaderboard, getMyRank } from "@/lib/game/leaderboard";
import { isGachaEnabled, pullsToday } from "@/lib/game/gacha";
import { weeklyChallenge } from "@/lib/game/weekly-challenge";
import { maskUsersForDemo } from "@/lib/demo-privacy";
import { prisma, prismaBase } from "@/lib/prisma";
import type { BoardData } from "@/components/shop/LeaderboardModal";

const baloo = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"], variable: "--font-baloo" });

export const dynamic = "force-dynamic";
export const metadata = { title: "Tiệm Quà Học Đường — Xu & Kim Cương" };

export default async function RewardsPage() {
  if (!isPointsEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "TEACHER") redirect("/teacher/rewards");
  const uid = session.user.id;

  await expireStaleRedemptions().catch(() => {});
  const gachaOn = isGachaEnabled();
  const [data, me, grades, today] = await Promise.all([
    getStudentPointsPage(uid),
    prisma.user.findUnique({ where: { id: uid }, select: { name: true, studyClass: { select: { name: true, grade: true } } } }),
    getGrades(),
    gachaOn ? pullsToday(uid).catch(() => 0) : Promise.resolve(0),
  ]);
  const myGrade = me?.studyClass?.grade ?? null;
  const [extras, myRank, ...boardRows] = await Promise.all([
    getVisibleCourseIds(uid).then((ids) => getStudentHomeExtras(uid, ids, 6)).catch(() => ({ todo: [], todoTotal: 0, recent: [] })),
    myGrade ? getMyRank(uid, { grade: myGrade }, "all").catch(() => null) : Promise.resolve(null),
    ...grades.map((g) => getLeaderboard({ grade: g }, "all", 5).catch(() => [])),
  ]);
  // Che tên demo ngoài cache (dữ liệu Bảng Vàng dùng chung)
  const boards: BoardData[] = await Promise.all(
    grades.map(async (g, i) => {
      const masked = await maskUsersForDemo(boardRows[i].map((r) => ({ ...r, id: r.userId })), prismaBase);
      return {
        grade: g,
        rows: masked.map((r) => ({ userId: r.userId, name: r.name, levelName: r.level.name, xu: r.xu, rank: r.rank })),
        mine: g === myGrade ? myRank : null,
      };
    }),
  );

  return (
    // Tiệm Quà tràn toàn màn hình (không có sidebar chung): lối về trang chủ nằm ở thanh gỗ + Menu Tiệm Quà + logo header
    <div className={`page-shell min-h-screen bg-[#EBF3FF] ${baloo.variable}`}>
      <main className="min-w-0">
        <ShopPage
          data={data}
          user={{ id: uid, name: session.user.name ?? me?.name ?? null, className: me?.studyClass?.name ?? null, grade: myGrade }}
          todo={extras.todo}
          todoTotal={extras.todoTotal}
          recent={extras.recent.map((r) => ({ attemptId: r.attemptId, lessonId: r.lessonId, title: r.title, score: r.score }))}
          boards={boards}
          event={weeklyChallenge(data.wallet)}
          gacha={gachaOn ? { pullsToday: today } : null}
        />
      </main>
    </div>
  );
}
