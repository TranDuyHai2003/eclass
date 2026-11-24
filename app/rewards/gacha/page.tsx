import { notFound, redirect } from "next/navigation";
import { canUseShop } from "@/lib/points/shop-access";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { GachaPage } from "@/components/game/GachaPage";
import { isPointsEnabled } from "@/lib/points/config";
import { getHeaderPoints } from "@/lib/points/queries";
import { isGachaEnabled, pullsToday, recentPulls } from "@/lib/game/gacha";
import { getAvatar } from "@/lib/game/inventory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rương bí ẩn" };

export default async function GachaRoute({ searchParams }: { searchParams: Promise<{ chest?: string }> }) {
  const sp = await searchParams;
  if (!isPointsEnabled() || !isGachaEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["STUDENT", "ADMIN", "TEACHER"].includes(session.user.role)) redirect("/teacher/rewards");
  if (!canUseShop(session.user)) redirect("/rewards");
  const uid = session.user.id;

  const [wallet, today, history, me, { config, owned }, pityRow] = await Promise.all([
    getHeaderPoints(uid),
    pullsToday(uid),
    recentPulls(uid),
    prisma.user.findUnique({ where: { id: uid }, select: { isApproved: true, isDemo: true } }),
    getAvatar(uid),
    prisma.pointWallet.findUnique({ where: { userId: uid }, select: { gachaPity: true } }),
  ]);

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1600px]">
          <GachaPage
            wallet={{ balance: wallet.balance, gems: wallet.gems }}
            pity={pityRow?.gachaPity ?? 0}
            pullsToday={today}
            history={history}
            canEarn={!!me?.isApproved && !me?.isDemo}
            avatar={config}
            owned={owned}
            initialChest={sp.chest === "gem" ? "gem" : "xu"}
          />
        </main>
      </div>
    </div>
  );
}
