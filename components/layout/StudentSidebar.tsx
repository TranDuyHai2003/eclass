"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  User, 
  ChevronRight,
  LayoutDashboard,
  Home as HomeIcon
} from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, isActive }: SidebarItemProps) => (
  <Link
    href={href}
    className={cn(
      "flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group",
      isActive 
        ? "bg-red-50 text-red-600 shadow-sm shadow-red-100/50" 
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        "p-1.5 rounded-xl transition-colors shadow-sm border",
        isActive 
          ? "bg-white border-red-100 text-red-600" 
          : "bg-white border-slate-100 text-slate-400 group-hover:text-slate-900 group-hover:border-slate-200"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className={cn(
        "text-[13px] font-black uppercase tracking-tight transition-colors",
        isActive ? "text-red-600" : "text-slate-700 group-hover:text-slate-900"
      )}>
        {label}
      </span>
    </div>
    <ChevronRight className={cn(
      "w-3.5 h-3.5 transition-all",
      isActive ? "text-red-600 translate-x-0" : "text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5"
    )} />
  </Link>
);

export function StudentSidebar({ user }: { user: any }) {
  const pathname = usePathname();
  
  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER" || isAdmin;
  const dashboardHref = isAdmin ? "/admin/analytics" : "/teacher/courses";

  const menuItems = [
    { href: "/", icon: HomeIcon, label: "Trang chủ" },
    ...(isTeacher ? [{ href: dashboardHref, icon: LayoutDashboard, label: "Dashboard" }] : []),
    { href: "/courses", icon: BookOpen, label: "Khóa học" },
    { href: "/profile", icon: User, label: "Trang cá nhân" },
  ];

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-5 shrink-0">
      {/* Profile Card */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 ring-4 ring-white shadow-xl flex items-center justify-center mb-4 relative overflow-hidden group">
          {user?.image ? (
            <img src={user.image} alt={user.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-2xl font-black">
              {user?.name?.[0] || "U"}
            </div>
          )}
        </div>
        <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{user?.name || "Người dùng"}</h3>
        <p className="text-[10px] font-bold text-slate-400 mt-1 truncate w-full uppercase tracking-widest">{user?.email}</p>
        
        <div className="mt-4 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border border-red-100">
           {user?.role === 'ADMIN' ? 'Quản trị viên' : user?.role === 'TEACHER' ? 'Giáo viên' : 'Học viên'}
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-2">
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
             const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
             return (
              <SidebarItem
                key={item.href}
                {...item}
                isActive={isActive}
              />
             )
          })}
        </nav>
      </div>
    </aside>
  );
}
