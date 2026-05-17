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

export default async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isTeacher = session?.user?.role === "TEACHER" || isAdmin;

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-300">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu & Logo Group */}
          <div className="flex items-center gap-4 sm:gap-6 flex-1 md:flex-none">
            <MobileMenu user={session?.user} />

            <Link
              href="/"
              className="flex items-center gap-3 shrink-0 group relative"
            >
              <div className="relative flex items-center justify-center  rounded-2xl">
                <img
                  src="/logo.png?v=1"
                  alt="thatdehoctoan"
                  className="h-8 sm:h-10 w-auto object-contain transform group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="flex flex-col">
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
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-blue-600 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-blue-50 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>Khóa học</span>
              </Link>

              {isTeacher && (
                <Link
                  href="/teacher/courses"
                  className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-orange-600 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-orange-50 transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Quản lý</span>
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-3">
              {session ? (
                <>
                  <div className="hidden sm:block">
                    <NotificationBell />
                  </div>

                  <Link
                    href="/profile"
                    className="group relative h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white flex items-center justify-center transition-all border border-slate-200 shadow-sm overflow-hidden hover:border-blue-200 hover:shadow-blue-500/10 active:scale-95"
                  >
                    {session.user.image ? (
                      <img
                        src={session.user.image}
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
