import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Gift } from "lucide-react";
import { TeacherRewards } from "@/components/points/TeacherRewards";
import { isPointsEnabled, POINTS } from "@/lib/points/config";
import { getTeacherRewardsPage } from "@/lib/points/queries";
import { expireStaleRedemptions } from "@/lib/points/redemption";
import { getGiftCodeBatches } from "@/lib/game/giftcode-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quà & Xu" };

// Quyền giáo viên/admin đã kiểm tra ở app/teacher/layout.tsx
export default async function TeacherRewardsPage() {
  if (!isPointsEnabled()) notFound();
  await expireStaleRedemptions().catch(() => {});
  const [data, giftBatches, session] = await Promise.all([getTeacherRewardsPage(), getGiftCodeBatches(), auth()]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
          <Gift className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">Quà & Xu</h1>
          <p className="text-xs sm:text-sm text-slate-500">Học sinh tích xu khi học, đổi quà; thẻ cào ngọc thầy phát trên lớp; thầy trao quà ở buổi học offline.</p>
        </div>
        {session?.user?.role === "ADMIN" && (
          <Link href="/rewards" data-testid="open-shop" className="ml-auto shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-sm font-black text-white hover:bg-amber-600">
            Xem Tiệm quà →
          </Link>
        )}
      </div>
      <TeacherRewards data={data} giftBatches={giftBatches} manualMax={POINTS.manual.maxPerGrant} manualDailyCap={POINTS.manual.dailyCapPerStudent} />
    </div>
  );
}
