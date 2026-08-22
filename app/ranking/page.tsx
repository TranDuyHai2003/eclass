import { auth } from "@/auth";
import { getRankingData } from "@/actions/ranking";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { RankingViewManager } from "@/components/ranking/RankingViewManager";
import { ShieldAlert } from "lucide-react";
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
    <div className="page-shell min-h-screen bg-[#F8FBFF] text-slate-800">
      {/* Outer flex container: 100% full width, sidebar anchored directly to far left margin */}
      <div className="flex w-full min-h-[calc(100vh-5rem)]">
        {/* Left Sidebar - Standard HomeSidebar completely unchanged */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>

        {/* Right Main Content Area - 100% Full-Bleed Dark Hunter System Theme Container */}
        <main className="flex-1 min-w-0 bg-[#060911] text-slate-100 relative overflow-hidden min-h-[calc(100vh-5rem)] border-l border-slate-800/80 shadow-2xl pb-16">
          {/* Grand Overall AI Artwork Background filling 100% of main column */}
          <div
            className="absolute inset-0 bg-cover bg-top opacity-85 transition-opacity duration-700 pointer-events-none"
            style={{ backgroundImage: "url('/ranking-overall-bg.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060911]/30 via-[#060911]/65 to-[#060911]/90 pointer-events-none" />

          {/* Ambient Glowing Rune Auras */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Ranking Content inside 100% full-bleed theme */}
          <div className="relative z-10 px-0 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
            <RankingViewManager data={rankingData} currentUserId={session.user.id || ""} />
          </div>
        </main>
      </div>
    </div>
  );
}




