import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { LeaderboardView } from "@/components/game/Leaderboard";
import { getGrades, getLeaderboard, getMyRank, type Period, type Scope } from "@/lib/game/leaderboard";
import { isPointsEnabled } from "@/lib/points/config";
import { notFound } from "next/navigation";
import { canUseShop } from "@/lib/points/shop-access";
import { maskUsersForDemo } from "@/lib/demo-privacy";
import { prisma, prismaBase } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bảng Vàng" };

/** Bảng Vàng tích luỹ theo khối ("server" 10/11/12) và lớp mình; kỳ: tích luỹ / tháng này */
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  if (!isPointsEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Bảng Vàng chỉ nằm trong Tiệm quà (thầy yêu cầu 28/11): ai vào được tiệm (học sinh offline, thầy, admin) → hộp Bảng Vàng trong tiệm.
  // Trang đầy đủ này chỉ còn cho học sinh chưa được vào tiệm (online).
  if (canUseShop(session.user)) redirect("/rewards#bang-vang");
  const sp = await searchParams;
  const period: Period = sp.period === "month" ? "month" : "all";

  const [grades, me] = await Promise.all([
    getGrades(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { classId: true, studyClass: { select: { name: true, grade: true } } } }),
  ]);
  const myClassId = me?.classId ?? null;
  const defaultTab = me?.studyClass?.grade ? `g${me.studyClass.grade}` : myClassId ? "class" : grades[0] ? `g${grades[0]}` : "class";
  const tab = sp.tab && (sp.tab === "class" || grades.includes(Number(sp.tab.slice(1)))) ? sp.tab : defaultTab;

  let scope: Scope | null = null;
  if (tab === "class" && myClassId) scope = { classId: myClassId };
  else if (tab.startsWith("g")) scope = { grade: Number(tab.slice(1)) };

  const rawRows = scope ? await getLeaderboard(scope, period, 30) : [];
  // Dữ liệu trong cache dùng chung → che tên demo NGOÀI cache (review Gemini)
  // maskUsersForDemo nhận dạng theo trường `id` (giữ nguyên chính chủ demo) → map userId → id (review Gemini)
  const rows = (await maskUsersForDemo(rawRows.map((r) => ({ ...r, id: r.userId })), prismaBase)).map(({ id: _id, ...r }) => r);
  const mine = scope && session.user.role === "STUDENT" ? await getMyRank(session.user.id, scope, period) : null;

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1600px]">
          <LeaderboardView
            rows={rows}
            grades={grades}
            tab={tab}
            period={period}
            myClassName={me?.studyClass?.name ?? null}
            hasClass={!!myClassId}
            currentUserId={session.user.id}
            mine={mine}
          />
        </main>
      </div>
    </div>
  );
}
