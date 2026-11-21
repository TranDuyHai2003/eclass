import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { AvatarEditor } from "@/components/avatar/AvatarEditor";
import { isPointsEnabled } from "@/lib/points/config";
import { getHeaderPoints } from "@/lib/points/queries";
import { getAvatar } from "@/lib/game/inventory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tuỳ chỉnh nhân vật" };

export default async function AvatarEditorPage() {
  if (!isPointsEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/profile");

  const [{ config, owned }, wallet, me] = await Promise.all([
    getAvatar(session.user.id),
    getHeaderPoints(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isApproved: true, isDemo: true } }),
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
          <AvatarEditor
            initial={config}
            owned={owned}
            wallet={{ balance: wallet.balance, gems: wallet.gems }}
            canEarn={!!me?.isApproved && !me?.isDemo}
            userId={session.user.id}
          />
        </main>
      </div>
    </div>
  );
}
