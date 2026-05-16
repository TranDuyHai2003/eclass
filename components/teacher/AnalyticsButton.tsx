"use client"

import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AnalyticsButton({ href }: { href: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
      onClick={(e) => e.stopPropagation()}
    >
      <Link href={href}>
        <BarChart3 className="w-3.5 h-3.5 mr-1" />
        Thống kê
      </Link>
    </Button>
  )
}
