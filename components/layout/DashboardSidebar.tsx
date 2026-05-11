"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  BarChart3, 
  Settings, 
  Video,
  CreditCard,
  ChevronRight,
  PlaySquare,
  ClipboardList,
  Home as HomeIcon,
  User
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"

const teacherLinks = [
  { href: "/teacher/courses", label: "Quản lý Khóa học", icon: BookOpen },
  { href: "/teacher/tests", label: "Quản lý Bài kiểm tra", icon: ClipboardList },
  { href: "/teacher/videos", label: "Thư viện Video", icon: PlaySquare },
]

const adminLinks = [
  { href: "/admin/analytics", label: "Thống kê hệ thống", icon: BarChart3 },
  { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
  { href: "/admin/finance", label: "Quản lý Ghi danh", icon: CreditCard },
  { href: "/admin/settings", label: "Cấu hình hệ thống", icon: Settings },
]

interface DashboardSidebarProps {
  isMobile?: boolean;
}

export function DashboardSidebar({ isMobile }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role

  const isAdmin = role === "ADMIN"
  const isTeacher = role === "TEACHER" || isAdmin

  const dashboardHref = isAdmin ? "/admin/analytics" : "/teacher/courses"

  const generalLinks = [
    { href: "/", label: "Trang chủ", icon: HomeIcon, exact: true },
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    { href: "/profile", label: "Trang cá nhân", icon: User },
  ]

  return (
    <div className={cn(
      "shrink-0 space-y-6",
      isMobile ? "w-full p-4" : "w-64 sticky top-24 h-fit"
    )}>
      <div className={cn(
        "rounded-3xl p-6 shadow-sm",
        isMobile ? "bg-transparent" : "card-surface bg-white"
      )}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black shadow-lg",
            isAdmin ? "bg-black shadow-black/20" : "bg-red-600 shadow-red-200"
          )}>
            {isAdmin ? "A" : "T"}
          </div>
          <div>
            <h3 className="font-black text-slate-900 leading-none uppercase tracking-tighter">
              {isAdmin ? "Admin Panel" : "Teacher Panel"}
            </h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">Management</span>
          </div>
        </div>

        <div className="space-y-7">
          {/* General Section */}
          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Điều hướng</h4>
            {generalLinks.map((link) => {
              const isActive = link.exact 
                ? pathname === link.href 
                : (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-2xl transition-all group",
                    isActive 
                      ? "bg-red-50 text-red-600 shadow-sm shadow-red-100" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className={cn("w-4 h-4", isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-900")} />
                    <span className="text-[13px] font-black tracking-tight">{link.label}</span>
                  </div>
                  <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isActive ? "text-red-600/50" : "text-slate-300 group-hover:translate-x-1")} />
                </Link>
              )
            })}
          </div>

          {/* Teacher Section */}
          {isTeacher && (
            <div className="space-y-1">
              <h4 className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Quản trị nội dung</h4>
              {teacherLinks.map((link) => {
                const isActive = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl transition-all group",
                      isActive 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
                      <span className="text-[13px] font-black tracking-tight">{link.label}</span>
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isActive ? "text-white/50" : "text-slate-300 group-hover:translate-x-1")} />
                  </Link>
                )
              })}
            </div>
          )}

          {/* Admin Section */}
          {isAdmin && (
            <div className="space-y-1">
              <h4 className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Hệ thống</h4>
              {adminLinks.map((link) => {
                const isActive = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl transition-all group",
                      isActive 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
                      <span className="text-[13px] font-black tracking-tight">{link.label}</span>
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isActive ? "text-white/50" : "text-slate-300 group-hover:translate-x-1")} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card-surface rounded-3xl p-6 bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg shadow-red-200">
        <h4 className="font-black text-sm uppercase tracking-wider mb-2">Hỗ trợ kỹ thuật</h4>
        <p className="text-xs text-white/80 leading-relaxed mb-4 font-medium">Bạn gặp vấn đề trong quá trình quản lý? Liên hệ ngay đội ngũ kỹ thuật.</p>
        <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl font-bold py-5 h-auto transition-all">
          Gửi yêu cầu
        </Button>
      </div>
    </div>
  )
}
