"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface NavLinksProps {
  role?: "ADMIN" | "STUDENT" | string
  vertical?: boolean
}

export function NavLinks({ role, vertical }: NavLinksProps) {
  const pathname = usePathname()

  const isLoggedIn = !!role;

  const links = [
    ...(isLoggedIn 
      ? [
          { href: "/", label: "Trang cá nhân" },
          { href: "/home", label: "Trang chủ" },
        ]
      : [
          { href: "/", label: "Trang chủ" },
        ]),
    { href: "/courses", label: "Khóa học" },
    { href: "/live", label: "Phòng Live" },
    { href: "/practice", label: "Thi thực chiến" },
    { href: "/library", label: "Thư viện" },
    { href: "/books", label: "Gian hàng sách" },
    { href: "/news", label: "Tin tức" },
    ...(role === "ADMIN" ? [
      { href: "/teacher/courses", label: "Dashboard" }
    ] : [])
  ]

  return (
    <nav className={cn(
      "flex items-center gap-1 px-1 py-1",
      vertical ? "flex-col items-stretch w-full gap-2 p-4" : "flex-wrap md:flex-nowrap"
    )}>
      {links.map(link => {
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full text-[11px] sm:text-[13px] font-black uppercase tracking-tight transition-all text-center",
              vertical 
                ? "w-full py-4 text-sm rounded-2xl border transition-colors shadow-sm" 
                : "hover:bg-white/10 hover:text-white",
              isActive
                ? vertical 
                  ? "text-red-700 bg-red-50 border-red-200 active-nav-v" 
                  : "text-white bg-white/15 shadow-sm"
                : vertical 
                  ? "text-gray-600 bg-white border-transparent hover:border-red-200 hover:text-red-600" 
                  : "text-white/80"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
