import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { TeacherRewards } from "@/components/points/TeacherRewards";
import { isPointsEnabled, POINTS } from "@/lib/points/config";
import { getTeacherRewardsPage } from "@/lib/points/queries";
import { expireStaleRedemptions } from "@/lib/points/redemption";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quà & Điểm thưởng" };

// Quyền giáo viên/admin đã kiểm tra ở app/teacher/layout.tsx
export default async function TeacherRewardsPage() {
  if (!isPointsEnabled()) notFound();
  await expireStaleRedemptions().catch(() => {});
  const data = await getTeacherRewardsPage();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
          <Gift className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">Quà & Điểm thưởng</h1>
          <p className="text-xs sm:text-sm text-slate-500">Học sinh tích điểm khi học, đổi quà; thầy trao quà ở buổi học offline.</p>
        </div>
      </div>
      <TeacherRewards data={data} manualMax={POINTS.manual.maxPerGrant} manualDailyCap={POINTS.manual.dailyCapPerStudent} />
    </div>
  );
}
