import Link from "next/link";
import { auth } from "@/auth";
import { NavLinks } from "./NavLinks";
import { NotificationBell } from "@/components/notification/NotificationBell";
import {
  Search,
  Phone,
  Globe,
  User,
  Home,
  FileText,
  Beaker,
  ClipboardList,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";
import { getAvatarThumbUrl } from "@/lib/game-rank";
import { isPointsEnabled } from "@/lib/points/config";
import { getHeaderPoints } from "@/lib/points/queries";
import { getLevel } from "@/lib/points/levels";
import { SoundToggle } from "@/components/game/SoundToggle";

export default async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isTeacher = session?.user?.role === "TEACHER" || isAdmin;
  // Chip điểm thưởng: chỉ học sinh (1 truy vấn theo khoá chính)
  const showPoints = isPointsEnabled() && session?.user?.role === "STUDENT" && !!session.user.id;
  const headerPoints = showPoints ? await getHeaderPoints(session!.user!.id!).catch(() => null) : null;
  const pointsLevel = headerPoints ? getLevel(headerPoints.lifetimeEarned) : null;

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-3 sm:gap-4">
          {/* Left: Mobile Menu & Logo Group */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-6 flex-1 md:flex-none">
            <MobileMenu user={session?.user} />

            <Link
              href="/"
              className="flex min-w-0 items-center gap-3 shrink-0 group relative"
            >
              <div className="relative flex items-center justify-center  rounded-2xl">
                <img
                  src="/logo-96.webp" width={85} height={96}
                  alt="thatdehoctoan"
                  className="h-8 sm:h-9 w-auto object-contain transform group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              {/* Điện thoại (< 640px): chỉ giữ biểu tượng logo để chừa chỗ cho chip xu (chữ thương hiệu rộng ~200px) */}
              <div className="flex flex-col max-sm:hidden">
                <span className="text-sm sm:text-xl font-black tracking-tighter text-blue-500 uppercase leading-none group-hover:text-blue-600 transition-colors">
                  thatdehoctoan
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Search Bar - Hidden on mobile, Center on desktop */}
          <div className="hidden lg:flex flex-1 justify-center max-w-2xl px-8">
            <div className="w-full relative group">
              <SearchBar />
            </div>
          </div>

          {/* Right: Icons/Auth Bar */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-1 md:flex-none justify-end">
            {/* Desktop Quick Nav */}
            <nav className="hidden lg:flex items-center gap-1.5 mr-2">
              <Link
                href="/courses"
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl hover:bg-blue-50 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>Khóa học</span>
              </Link>

              {isTeacher && (
                <Link
                  href="/teacher/courses"
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-orange-600 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl hover:bg-orange-50 transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Quản lý</span>
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              {session ? (
                <>
                  {showPoints && headerPoints && (
                    <>
                    <Link
                      href="/rewards"
                      data-wallet-chip
                      title={`${pointsLevel?.icon} ${pointsLevel?.name} · ${headerPoints.balance.toLocaleString("vi-VN")} xu · ${headerPoints.gems} ngọc · tiệm quà`}
                      className="h-10 sm:h-11 px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-2xl border-2 border-amber-200 bg-amber-50 text-amber-700 shadow-[0_3px_0_0_#fde68a] hover:bg-amber-100 active:translate-y-[2px] active:shadow-[0_1px_0_0_#fde68a] transition-all"
                    >
                      {/* Biểu tượng danh hiệu chỉ hiện từ 400px để header điện thoại nhỏ không chật */}
                      <span aria-hidden className="hidden min-[400px]:inline text-base leading-none">{pointsLevel?.icon}</span>
                      <span aria-hidden className="text-base leading-none">🪙</span>
                      <span className="text-sm font-black tabular-nums" data-testid="header-xu">{headerPoints.balance.toLocaleString("vi-VN")}</span>
                      <span className="sr-only">xu</span>
                      {headerPoints.gems > 0 && (
                        <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-pink-100 px-1.5 text-xs font-black text-pink-700" data-testid="header-gems">
                          <span aria-hidden>💎</span>
                          {headerPoints.gems}
                          <span className="sr-only">ngọc</span>
                        </span>
                      )}
                    </Link>
                    <SoundToggle className="hidden sm:inline-flex" />
                    </>
                  )}
                  <div className="hidden sm:block">
                    <NotificationBell />
                  </div>

                  <Link
                    href="/profile"
                    className="group relative h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white flex items-center justify-center transition-all border border-slate-200 shadow-sm overflow-hidden hover:border-blue-200 hover:shadow-blue-500/10 active:scale-95"
                  >
                    {session.user.image ? (
                      <img
                        src={getAvatarThumbUrl(session.user.name, session.user.image)}
                        alt="Avatar"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                        {session.user.name?.[0].toUpperCase() || "U"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="h-10 sm:h-12 px-6 sm:px-8 inline-flex items-center rounded-2xl bg-slate-900 text-[11px] font-black text-white hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
