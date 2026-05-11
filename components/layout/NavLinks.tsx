"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import { Home, User, BookOpen, LayoutDashboard, ChevronRight } from "lucide-react";

interface NavLinksProps {
  role?: "ADMIN" | "STUDENT" | string
  vertical?: boolean
  onClick?: () => void
}

export function NavLinks({ role, vertical, onClick }: NavLinksProps) {
  const pathname = usePathname()

  const isLoggedIn = !!role;

  const links = [
    ...(isLoggedIn 
      ? [
          { href: "/", label: "Trang chủ", icon: Home },
          { href: "/profile", label: "Trang cá nhân", icon: User },
        ]
      : [
          { href: "/", label: "Trang chủ", icon: Home },
        ]),
    { href: "/courses", label: "Khóa học", icon: BookOpen },
    ...(role === "ADMIN" ? [
      { href: "/teacher/courses", label: "Dashboard", icon: LayoutDashboard }
    ] : [])
  ]

  return (
    <nav className={cn(
      "flex items-center gap-1 px-1 py-1",
      vertical ? "flex-col items-stretch w-full gap-3 p-6" : "flex-wrap md:flex-nowrap"
    )}>
      {links.map(link => {
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(link.href)

        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClick}
            className={cn(
              "relative px-4 py-2.5 text-[11px] font-black uppercase tracking-tight transition-all text-center flex items-center justify-center gap-3 group",
              vertical 
                ? "w-full py-4 text-sm rounded-2xl border transition-all shadow-sm justify-start px-6" 
                : "hover:bg-white/10 hover:text-white rounded-xl",
              isActive 
                ? vertical 
                  ? "bg-red-50 border-red-200 text-red-600 shadow-red-100" 
                  : "bg-white/20 text-white" 
                : vertical
                  ? "text-gray-600 bg-white border-transparent hover:border-red-200 hover:text-red-600" 
                  : "text-white/80"
            )}
          >
            {vertical && (
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                isActive ? "bg-red-600 text-white" : "bg-gray-50 text-gray-400 group-hover:bg-red-100 group-hover:text-red-600"
              )}>
                <Icon className="w-4 h-4" />
              </div>
            )}
            <span className="flex-1 text-left">{link.label}</span>
            {vertical && <ChevronRight className={cn("w-4 h-4 opacity-0 -translate-x-2 transition-all", isActive ? "opacity-100 translate-x-0" : "group-hover:opacity-40 group-hover:translate-x-0")} />}
          </Link>
        )
      })}
    </nav>
  )
}

