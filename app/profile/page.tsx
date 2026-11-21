import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import ProfileClient from "@/components/profile/ProfileClient";
import ChangePasswordCard from "@/components/profile/ChangePasswordCard";
import { prisma } from "@/lib/prisma";
import { isPointsEnabled } from "@/lib/points/config";
import { getHeaderPoints } from "@/lib/points/queries";
import { getLevel } from "@/lib/points/levels";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  const account = user.id
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    : null;

  // Số liệu học tập cho thẻ tóm tắt (chỉ học sinh)
  let stats: { completedLessons: number; points: number | null; level: { icon: string; level: number; name: string } | null } | undefined;
  if (user.id && user.role === "STUDENT") {
    const [completedLessons, wallet] = await Promise.all([
      prisma.progress.count({ where: { userId: user.id, isCompleted: true } }),
      isPointsEnabled() ? getHeaderPoints(user.id).catch(() => null) : Promise.resolve(null),
    ]);
    const lv = wallet ? getLevel(wallet.lifetimeEarned) : null;
    stats = {
      completedLessons,
      points: wallet ? wallet.balance : null,
      level: lv ? { icon: lv.icon, level: lv.level, name: lv.name } : null,
    };
  }

  return (
    <div className="page-shell bg-[#EBF3FF] min-h-screen">
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Fixed 250px Width, Anchored Flush Left */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={user} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px]">
          <ProfileClient
            user={{
              id: user.id || "",
              name: user.name || null,
              email: user.email || null,
              image: user.image || null,
            }}
            stats={stats}
          >
            <ChangePasswordCard hasPassword={!!account?.password} />
          </ProfileClient>
        </main>
      </div>
    </div>
  );
}
