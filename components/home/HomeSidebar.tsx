"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  ChevronRight,
  LayoutDashboard,
  User,
  Home as HomeIcon,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  PlaySquare,
  ClipboardList,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

export function HomeSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const isAdmin = role === "ADMIN";
  const isTeacher = role === "TEACHER" || isAdmin;

  const generalLinks = [
    { icon: HomeIcon, label: "Trang chủ", href: "/", exact: true },
    { icon: BookOpen, label: "Khóa Học", href: "/courses" },
    { icon: User, label: "Trang cá nhân", href: "/profile" },
  ];

  const teacherLinks = [
    { href: "/teacher/courses", label: "Quản lý Khóa học", icon: BookOpen },
    { href: "/teacher/tests", label: "Quản lý Bài kiểm tra", icon: ClipboardList },
    { href: "/teacher/videos", label: "Thư viện Video", icon: PlaySquare },
  ];

  const adminLinks = [
    { href: "/admin/analytics", label: "Thống kê hệ thống", icon: BarChart3 },
    { href: "/admin/global-analytics", label: "Thống kê điểm số", icon: TrendingUp },
    { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
    { href: "/admin/finance", label: "Quản lý Ghi danh", icon: CreditCard },
    { href: "/admin/settings", label: "Cấu hình hệ thống", icon: Settings },
  ];

  const renderLinks = (links: any[]) => {
    return links.map((item) => {
      const isActive = item.exact 
        ? pathname === item.href 
        : (item.href !== "/" && pathname.startsWith(item.href));

      return (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "flex items-center justify-between p-3.5 transition-all rounded-2xl group",
            isActive 
              ? "bg-red-50 text-red-600 shadow-sm shadow-red-100/50" 
              : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-xl transition-colors shadow-sm border",
              isActive 
                ? "bg-white border-red-100 text-red-600" 
                : "bg-white border-slate-100 text-slate-400 group-hover:text-slate-900 group-hover:border-slate-200"
            )}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className={cn(
              "text-[13px] font-black uppercase tracking-tight transition-colors",
              isActive ? "text-red-600" : "text-slate-700 group-hover:text-slate-900"
            )}>
              {item.label}
            </span>
          </div>
          <ChevronRight className={cn(
            "w-3.5 h-3.5 transition-all",
            isActive ? "text-red-600 translate-x-0" : "text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5"
          )} />
        </Link>
      );
    });
  };

  return (
    <div className="w-full bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-2 space-y-4">
      <nav className="flex flex-col gap-1">
        {renderLinks(generalLinks)}
      </nav>

      {isTeacher && (
        <div className="pt-2 border-t border-slate-50">
          <h4 className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Giảng viên
          </h4>
          <nav className="flex flex-col gap-1">
            {renderLinks(teacherLinks)}
          </nav>
        </div>
      )}

      {isAdmin && (
        <div className="pt-2 border-t border-slate-50">
          <h4 className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Hệ thống
          </h4>
          <nav className="flex flex-col gap-1">
            {renderLinks(adminLinks)}
          </nav>
        </div>
      )}
    </div>
  );
}
