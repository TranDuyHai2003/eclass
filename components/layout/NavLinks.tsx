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
    ...(role === "ADMIN" ? [
      { href: "/teacher/courses", label: "Quản lý Khóa học" },
      { href: "/admin/analytics", label: "Thống kê" },
      { href: "/admin/users", label: "Quản lý Người dùng" }
    ] : [])
  ]

  return (
    <div className="flex items-center gap-6">
      {links.map(link => {
        // Active state logic: exact match for root, startsWith for others to handle sub-routes
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-medium transition-colors",
              isActive 
                ? "text-purple-600" 
                : "text-gray-600 hover:text-purple-600"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
