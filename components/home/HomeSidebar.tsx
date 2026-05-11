"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  ChevronRight,
  LayoutDashboard,
  User,
  Home as HomeIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

export function HomeSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const isAdmin = role === "ADMIN";
  const isTeacher = role === "TEACHER" || isAdmin;

  const dashboardHref = isAdmin ? "/admin/analytics" : "/teacher/courses";

  const menuItems = [
    { icon: HomeIcon, label: "Trang chủ", href: "/", exact: true },
    ...(isTeacher ? [{ icon: LayoutDashboard, label: "Dashboard", href: dashboardHref }] : []),
    { icon: BookOpen, label: "Khóa Học", href: "/courses" },
    { icon: User, label: "Trang cá nhân", href: "/profile" },
  ];

  return (
    <div className="w-full bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-2">
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
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
        })}
      </nav>
    </div>
  );
}
