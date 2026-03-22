import Link from "next/link";
import { auth } from "@/auth";
import { NavLinks } from "./NavLinks";
import { NotificationBell } from "@/components/notification/NotificationBell";
import { Search, Phone, Menu, Globe, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/80 backdrop-blur-xl">
      {/* Top Tier: Logo, Search, Hotline, Auth */}
      <div className="border-b border-border/50">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 -ml-2 text-gray-600 hover:text-red-700 transition-colors">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 border-none bg-white w-[200px]"
              >
                <SheetHeader className="p-6 border-b bg-gray-50/50">
                  <SheetTitle className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                    <span className="text-sm font-black text-red-600 uppercase tracking-tighter">
                      E-Class
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4 h-[calc(100vh-80px)] overflow-y-auto">
                  <NavLinks role={session?.user?.role} vertical />

                  {/* Mobile Hotline info in Menu */}
                  <div className="mt-8 px-6 space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Hỗ trợ 24/7
                    </p>
                    <div className="flex items-center gap-3 text-red-600">
                      <div className="p-2 bg-red-50 rounded-lg">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black">024 89998668</span>
                    </div>
                    <div className="flex items-center gap-3 text-red-600">
                      <div className="p-2 bg-red-50 rounded-lg">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black">0968668799</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo - Centered on mobile, Left on desktop */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 absolute left-1/2 -translate-x-1/2 md:relative md:left-0 md:translate-x-0"
          >
            <img
              src="/logo.png"
              alt="Toán Thầy Đức"
              className="h-8 sm:h-9 md:h-10 w-auto"
            />
            <span className="hidden lg:block text-lg font-black tracking-tighter text-gray-900">
              Toán Thầy Đức
            </span>
          </Link>

          {/* Search Bar - Hidden on mobile, Center on desktop */}
          <div className="hidden md:flex flex-1 max-w-xl lg:max-w-2xl relative mx-8">
            <input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              className="w-full h-11 pl-5 pr-12 rounded-2xl bg-white/70 border border-border/70 focus:border-red-500 focus:bg-white focus:outline-none transition-all text-sm font-medium shadow-sm"
            />
            <button className="absolute right-1.5 top-1.5 w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-white hover:bg-red-700 transition-colors shadow-md shadow-black/10">
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Icons/Auth Bar - Right */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Mobile Search Icon */}
            <button className="md:hidden p-2 text-gray-600 hover:text-red-700">
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop Hotline - Hidden on mobile/tablet */}
            <div className="hidden lg:flex items-center gap-6 mr-4">
              <div className="flex items-center gap-2 text-red-600 group cursor-pointer">
                <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Phone className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-sm font-black tracking-tight">
                  024 89998668
                </span>
              </div>
              <div className="flex items-center gap-2 text-red-600 group cursor-pointer">
                <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Phone className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-sm font-black tracking-tight">
                  0968668799
                </span>
              </div>
            </div>

            {session ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <NotificationBell />
                <Link
                  href="/profile"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/70 text-gray-900 flex items-center justify-center hover:bg-white transition-colors border border-border/70 shadow-sm overflow-hidden"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-black text-xs sm:text-sm">
                      {session.user.name?.[0].toUpperCase()}
                    </span>
                  )}
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="h-9 sm:h-10 px-4 sm:px-6 inline-flex items-center rounded-2xl border border-red-100 bg-red-50 text-[11px] sm:text-xs font-black text-red-700 hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest shadow-sm"
              >
                <User className="w-3.5 h-3.5 mr-2 hidden sm:block" />
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tier: Desktop Main Nav - Hidden on mobile */}
      <div className="hidden md:block bg-gradient-to-r from-red-700 to-red-600 text-white overflow-x-auto whitespace-nowrap">
        <div className="container mx-auto flex h-11 items-center justify-center px-4">
          <NavLinks role={session?.user?.role} />
        </div>
      </div>
    </header>
  );
}
