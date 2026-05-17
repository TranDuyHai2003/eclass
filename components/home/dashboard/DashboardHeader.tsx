"use client";

import Link from "next/link";
import { 
  Search, 
  Home, 
  Book, 
  StickyNote, 
  Newspaper, 
  Phone 
} from "lucide-react";
import { NotificationBell } from "@/components/notification/NotificationBell";

export function DashboardHeader({ user }: { user: any }) {
  return (
    <header className="h-16 bg-white border-b border-blue-100 sticky top-0 z-[100] flex items-center px-6 gap-8">
      {/* Left: Logo & Search */}
      <div className="flex items-center gap-6 min-w-[260px]">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center transition-transform group-hover:scale-105">
            <img src="/logo.png" alt="thatdehoctoan" className="h-8 sm:h-10 w-auto object-contain" />
          </div>
          <span className="text-lg font-black text-slate-800 tracking-tighter uppercase leading-none">
            E-Class
          </span>
        </Link>

        <div className="hidden lg:flex items-center bg-slate-100 rounded-2xl px-4 py-2 w-64 group focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600" />
          <input 
            type="text" 
            placeholder="Tìm bài học, tài liệu..." 
            className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-600 placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      {/* Middle: Fast Navigation */}
      <div className="flex-1 flex justify-center">
        <nav className="flex items-center bg-slate-50/50 p-1.5 rounded-[1.5rem] border border-slate-100/50">
           <HeaderNavIcon icon={Home} href="/" active />
           <HeaderNavIcon icon={Book} href="/courses" />
           <HeaderNavIcon icon={StickyNote} href="/profile" />
           <HeaderNavIcon icon={Newspaper} href="/news" />
        </nav>
      </div>

      {/* Right: Actions & User */}
      <div className="flex items-center gap-4 justify-end min-w-[260px]">
        <a href="tel:02489998668" className="hidden xl:flex items-center gap-2 group px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
            <Phone className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col text-right">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Hỗ trợ 24/7</span>
             <span className="text-[11px] font-black text-slate-700 tracking-tight mt-0.5">024 8999 8668</span>
          </div>
        </a>

        <div className="flex items-center gap-2 border-l border-slate-100 pl-4 ml-2">
           {user ? (
             <>
               <NotificationBell />
               <Link
                 href="/profile"
                 className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 overflow-hidden group hover:ring-2 hover:ring-blue-200 transition-all"
               >
                 {user.image ? (
                   <img src={user.image} alt="User" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-blue-600 font-black text-sm">
                     {user.name?.[0].toUpperCase()}
                   </div>
                 )}
               </Link>
             </>
           ) : (
             <Link
               href="/login"
               className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95"
             >
               Đăng nhập
             </Link>
           )}
        </div>
      </div>
    </header>
  );
}

function HeaderNavIcon({ icon: Icon, href, active = false }: { icon: any, href: string, active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`p-2.5 rounded-xl transition-all duration-300 ${active ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-slate-400 hover:text-blue-600 hover:bg-white/50'}`}
    >
      <Icon className="w-5 h-5" />
    </Link>
  );
}
