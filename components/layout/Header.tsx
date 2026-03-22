import Link from "next/link";
import { auth } from "@/auth";
import { NavLinks } from "./NavLinks";
import { NotificationBell } from "@/components/notification/NotificationBell";
import { Search, Phone } from "lucide-react";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/80 backdrop-blur-xl">
      {/* Top Tier: Logo, Search, Hotline, Auth */}
      <div className="border-b border-border/50">
        <div className="container mx-auto flex h-16 items-center gap-6 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group shrink-0"
          >
            <div className="w-11 h-11 bg-gradient-to-br from-red-600 to-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-black/10 transform group-hover:rotate-3 transition-transform">
              E
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight uppercase">
                E-Class
              </span>
              <span className="text-[10px] font-bold text-red-600/90 tracking-[0.22em] uppercase">
                Academy
              </span>
            </div>
          </Link>

          {/* Search Bar - Center */}
          <div className="hidden md:flex flex-1 max-w-2xl relative">
            <input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              className="w-full h-11 pl-5 pr-12 rounded-2xl bg-white/70 border border-border/70 focus:border-red-500 focus:bg-white focus:outline-none transition-all text-sm font-medium shadow-sm"
            />
            <button className="absolute right-1.5 top-1.5 w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-white hover:bg-red-700 transition-colors shadow-md shadow-black/10">
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Contact & Auth - Right */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="hidden lg:flex items-center gap-6">
                <div className="flex items-center gap-2 text-red-600">
                    <Phone className="w-4 h-4 fill-current" />
                    <span className="text-sm font-black tracking-tight">024 89998668</span>
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-2 text-red-600">
                    <Phone className="w-4 h-4 fill-current" />
                    <span className="text-sm font-black tracking-tight">0968668799</span>
                </div>
            </div>

            {session ? (
              <div className="flex items-center gap-4">
                <NotificationBell />
                <Link
                  href="/profile"
                  className="w-10 h-10 rounded-2xl bg-white/70 text-gray-900 flex items-center justify-center hover:bg-white transition-colors border border-border/70 shadow-sm"
                >
                  <span className="font-black text-sm">
                    {session.user.name?.[0].toUpperCase()}
                  </span>
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="h-10 px-5 inline-flex items-center rounded-2xl border border-border/70 bg-white/70 text-sm font-black text-gray-800 hover:bg-white hover:border-red-300 hover:text-red-600 transition-all uppercase tracking-tight shadow-sm"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tier: Main Nav */}
      <div className="bg-gradient-to-r from-red-700 to-red-600 text-white overflow-x-auto whitespace-nowrap">
        <div className="container mx-auto flex h-11 items-center justify-start md:justify-center px-2 sm:px-4">
           <NavLinks role={session?.user?.role} />
        </div>
      </div>
    </header>
  );
}
