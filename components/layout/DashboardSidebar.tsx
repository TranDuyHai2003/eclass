
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
  PlaySquare
} from "lucide-react"
import { cn } from "@/lib/utils"

const adminLinks = [
  { href: "/teacher/courses", label: "Quản lý Khóa học", icon: BookOpen },
  { href: "/teacher/videos", label: "Thư viện Video", icon: PlaySquare },
  { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
  { href: "/admin/analytics", label: "Thống kê hệ thống", icon: BarChart3 },
  { href: "/admin/live", label: "Phòng Live Admin", icon: Video },
  { href: "/admin/finance", label: "Quản lý Ghi danh", icon: CreditCard },
  { href: "/admin/settings", label: "Cài đặt hệ thống", icon: Settings },
]

interface DashboardSidebarProps {
  isMobile?: boolean;
}

export function DashboardSidebar({ isMobile }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn(
      "shrink-0 space-y-4",
      isMobile ? "w-full p-4" : "w-64"
    )}>
      <div className={cn(
        "rounded-3xl p-6",
        isMobile ? "bg-transparent" : "card-surface"
      )}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white font-black">
            A
          </div>
          <div>
            <h3 className="font-black text-gray-900 leading-none">Admin Panel</h3>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Management</span>
          </div>
        </div>

        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between p-3 rounded-2xl transition-all group",
                  isActive 
                    ? "bg-black text-white shadow-lg shadow-black/10" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-black"
                )}
              >
                <div className="flex items-center gap-3">
                  <link.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 group-hover:text-black")} />
                  <span className="text-sm font-black tracking-tight">{link.label}</span>
                </div>
                <ChevronRight className={cn("w-4 h-4 transition-transform", isActive ? "text-white/50" : "text-gray-300 group-hover:translate-x-1")} />
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="card-surface rounded-3xl p-6 bg-gradient-to-br from-red-600 to-orange-500 text-white">
        <h4 className="font-black text-sm uppercase tracking-wider mb-2">Hỗ trợ kỹ thuật</h4>
        <p className="text-xs text-white/80 leading-relaxed mb-4">Bạn gặp vấn đề trong quá trình quản lý? Liên hệ ngay đội ngũ kỹ thuật.</p>
        <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl font-bold py-5 h-auto">
          Gửi yêu cầu
        </Button>
      </div>
    </div>
  )
}

import { Button } from "@/components/ui/button"
