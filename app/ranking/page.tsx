import { auth } from "@/auth";
import { getRankingData } from "@/actions/ranking";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { RankingViewManager } from "@/components/ranking/RankingViewManager";
import { ShieldAlert, BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0; // Dynamic server rendering

export default async function RankingPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  let rankingData;
  try {
    rankingData = await getRankingData();
  } catch (error) {
    console.error("[RankingPage Error]", error);
  }

  if (!rankingData) {
    return (
      <div className="page-shell min-h-screen bg-[#F8FBFF] flex items-center justify-center p-4">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900">
            Không thể kết nối Bảng Tiến Bộ
          </h2>
          <p className="text-xs text-slate-500 mt-2">
            Vui lòng kiểm tra lại kết nối mạng hoặc tài khoản của bạn.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block bg-blue-600 text-white font-extrabold text-xs px-6 py-3 rounded-2xl shadow-md hover:bg-blue-700 transition"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen bg-gradient-to-b from-[#F8FBFF] via-[#F1F5F9] to-[#FFFFFF] text-slate-800 pb-28 pt-4">
      <main className="container mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar - PC Only */}
          <aside className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-24 h-fit">
              <HomeSidebar user={session.user} />
            </div>
          </aside>

          {/* Right Main Content Area */}
          <div className="flex-1 space-y-6 w-full max-w-5xl mx-auto">
            <RankingViewManager data={rankingData} currentUserId={session.user.id || ""} />
          </div>
        </div>
      </main>
    </div>
  );
}
