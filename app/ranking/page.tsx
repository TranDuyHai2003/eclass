import { auth } from "@/auth";
import { getRankingData } from "@/actions/ranking";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { RankingViewManager } from "@/components/ranking/RankingViewManager";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 60; // Cache page for 60 seconds (revalidates in background)

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
    <div className="page-shell min-h-screen bg-[#EBF3FF] text-slate-800">
      {/* Outer flex container: 100% full width, sidebar anchored directly to far left margin */}
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Standard HomeSidebar completely unchanged */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>

        {/* Nội dung chính: nền sáng đồng bộ các trang học sinh (Gemini góp ý: bỏ nền tối "RPG") */}
        <main className="flex-1 min-w-0 pb-16">
          <div className="px-0 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 max-w-[1600px]">
            <RankingViewManager data={rankingData} currentUserId={session.user.id || ""} />
          </div>
        </main>
      </div>
    </div>
  );
}




