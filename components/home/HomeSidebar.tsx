"use client";

import Link from "next/link";
import { 
  BookOpen, 
  Video, 
  Target, 
  Library, 
  Newspaper, 
  Users,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: BookOpen, label: "Khóa Học", href: "/courses", color: "text-red-600" },
  { icon: Video, label: "Phòng Live", href: "/live", color: "text-red-600" },
  { icon: Target, label: "Thi thực chiến", href: "/practice", color: "text-red-600" },
  { icon: Library, label: "Gian hàng sách", href: "/books", color: "text-orange-500" },
  { icon: Newspaper, label: "Tin tức", href: "/news", color: "text-red-600" },
  { icon: Users, label: "Cộng đồng", href: "/community", color: "text-red-600" },
];

export function HomeSidebar() {
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <nav className="flex flex-col">
        {menuItems.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center justify-between p-4 transition-colors hover:bg-red-50 group",
              index !== menuItems.length - 1 && "border-b border-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-1", item.color)}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-700 group-hover:text-red-600">
                {item.label}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
