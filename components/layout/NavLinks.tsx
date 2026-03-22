"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface NavLinksProps {
  role?: "ADMIN" | "STUDENT" | string
}

export function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Trang chủ" },
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
    <nav className="flex flex-wrap md:flex-nowrap items-center gap-1 px-1 py-1">
      {links.map(link => {
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full text-[11px] sm:text-[13px] font-black uppercase tracking-tight transition-all",
              "hover:bg-white/10 hover:text-white",
              isActive
                ? "text-white bg-white/15 shadow-sm"
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
