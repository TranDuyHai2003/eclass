"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  User,
  Home as HomeIcon,
  PlaySquare,
  ClipboardList,
  Facebook,
  Youtube,
  MessageCircle,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

export function LeftSidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER" || isAdmin;

  const menuItems = [
    { icon: HomeIcon, label: "Khám phá", href: "/" },
    { icon: BookOpen, label: "Khóa học của tôi", href: "/courses" },
    { icon: ClipboardList, label: "Phòng luyện đề", href: "/practice" },
    { icon: PlaySquare, label: "Lịch học Live", href: "/live" },
    { icon: User, label: "Trang cá nhân", href: "/profile" },
  ];

  return (
    <aside className="w-[260px] bg-white border-r border-blue-100 flex flex-col h-full shrink-0">
      {/* User Info Profile */}
      <div className="p-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 flex-shrink-0 overflow-hidden ring-4 ring-blue-50 shadow-lg shadow-blue-100 flex items-center justify-center">
           {user?.image ? (
             <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
           ) : (
             <div className="text-blue-600 font-black text-lg uppercase">
                {user?.name?.[0].toUpperCase() || "K"}
             </div>
           )}
        </div>
        <div className="min-w-0">
           <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">
             {user?.name || "Khách"}
           </h3>
           <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest mt-0.5">
             {user?.email || "Chưa đăng nhập"}
           </p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 space-y-1">
        <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Menu chính</div>
        {menuItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : (pathname?.startsWith(item.href) ?? false);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                isActive 
                  ? "bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-600"
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[13px] tracking-tight truncate">{item.label}</span>
            </Link>
          );
        })}

        {isTeacher && (
           <div className="pt-4 mt-4 border-t border-blue-50">
             <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quản trị viên</div>
             <Link
               href={isAdmin ? "/admin/analytics" : "/teacher/courses"}
               className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300"
             >
               <div className="p-2 rounded-xl text-slate-400">
                 <LayoutDashboard className="w-5 h-5" />
               </div>
               <span className="text-[13px] tracking-tight truncate">Quản lý hệ thống</span>
             </Link>
           </div>
        )}
      </nav>

      {/* Social Links Footer */}
      <div className="p-6 border-t border-blue-50">
         <div className="flex items-center justify-center gap-4">
            <SocialIcon icon={Facebook} href="#" color="hover:text-blue-600" />
            <SocialIcon icon={MessageCircle} href="#" color="hover:text-sky-500" />
            <SocialIcon icon={Youtube} href="#" color="hover:text-blue-600" />
         </div>
         <p className="text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest mt-4">© 2026 E-Class Ecosystem</p>
      </div>
    </aside>
  );
}

function SocialIcon({ icon: Icon, href, color }: { icon: any, href: string, color: string }) {
  return (
    <a href={href} className={cn("p-2.5 rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-white hover:shadow-md active:scale-95", color)}>
       <Icon className="w-4 h-4" />
    </a>
  );
}
