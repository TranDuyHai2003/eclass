import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { StudentRewards } from "@/components/points/StudentRewards";
import { isPointsEnabled } from "@/lib/points/config";
import { getStudentPointsPage } from "@/lib/points/queries";
import { expireStaleRedemptions } from "@/lib/points/redemption";

export const dynamic = "force-dynamic";
export const metadata = { title: "Điểm thưởng & Đổi quà" };

export default async function RewardsPage() {
  if (!isPointsEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "TEACHER") redirect("/teacher/rewards");

  await expireStaleRedemptions().catch(() => {});
  const data = await getStudentPointsPage(session.user.id);

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1200px]">
          <StudentRewards data={data} user={{ name: session.user.name, image: session.user.image }} />
        </main>
      </div>
    </div>
  );
}
