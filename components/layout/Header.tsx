import Link from "next/link";
import { auth } from "@/auth";
import { NavLinks } from "./NavLinks";
import { NotificationBell } from "@/components/notification/NotificationBell";
import { Search, Phone, Globe, User } from "lucide-react";
import { MobileMenu } from "./MobileMenu";

import { SearchBar } from "./SearchBar";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/80 backdrop-blur-xl transition-all">
      {/* Top Tier: Logo, Search, Hotline, Auth */}
      <div className="border-b border-border/40">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu & Logo Group */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 md:flex-none">
            <MobileMenu role={session?.user?.role} />
            
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-lg sm:rounded-xl shadow-lg shadow-red-200 flex items-center justify-center transform group-hover:rotate-6 transition-transform duration-500">
                <img
                  src="/logo.png"
                  alt="thatdehoctoan"
                  className="h-5 sm:h-7 w-auto brightness-0 invert"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-base font-black tracking-tighter text-slate-900 uppercase leading-none">
                  thatdehoctoan
                </span>
                <span className="hidden sm:block text-[8px] font-bold text-red-600 uppercase tracking-widest mt-0.5">Học toán thật dễ</span>
              </div>
            </Link>
          </div>

          {/* Center: Search Bar - Hidden on mobile, Center on desktop */}
          <div className="hidden md:flex flex-1 justify-center max-w-xl">
            <SearchBar />
          </div>

          {/* Right: Icons/Auth Bar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-1 md:flex-none justify-end">
            {/* Desktop Hotline Group */}
            <div className="hidden xl:flex items-center gap-4 mr-2 border-r border-slate-100 pr-4">
              <a href="tel:02489998668" className="flex items-center gap-2.5 text-slate-600 group hover:text-red-600 transition-colors">
                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                  <Phone className="w-3 h-3" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Hotline</span>
                   <span className="text-xs font-black tracking-tight mt-0.5">024 8999 8668</span>
                </div>
              </a>
            </div>

            {session ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationBell />
                <Link
                  href="/profile"
                  className="group relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white text-gray-900 flex items-center justify-center hover:bg-slate-50 transition-all border border-slate-100 shadow-sm overflow-hidden"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt="Avatar"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-black text-xs">
                      {session.user.name?.[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="h-9 sm:h-10 px-4 sm:px-6 inline-flex items-center rounded-xl bg-slate-900 text-[10px] sm:text-xs font-black text-white hover:bg-red-600 transition-all uppercase tracking-widest shadow-lg shadow-slate-200"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tier: Desktop Main Nav */}
      <div className="hidden md:block bg-white overflow-x-auto whitespace-nowrap border-b border-border/40">
        <div className="container mx-auto flex h-11 items-center justify-center px-4">
          <NavLinks role={session?.user?.role} />
        </div>
      </div>
    </header>
  );
}
