"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  User, 
  Video, 
  Bell, 
  HelpCircle,
  ChevronRight
} from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, isActive }: SidebarItemProps) => (
  <Link
    href={href}
    className={cn(
      "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
      isActive 
        ? "bg-white shadow-sm text-red-600 ring-1 ring-black/5" 
        : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon className={cn("w-5 h-5", isActive ? "text-red-600" : "text-gray-400 group-hover:text-gray-600")} />
      <span className="font-medium text-sm">{label}</span>
    </div>
    {isActive && <ChevronRight className="w-4 h-4" />}
  </Link>
);

export function StudentSidebar({ user }: { user: any }) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/student/courses", icon: BookOpen, label: "Khóa học của tôi" },
    { href: "/student/profile", icon: User, label: "Thông tin cá nhân" },
    { href: "/student/live", icon: Video, label: "Các Phòng Live" },
    { href: "/student/notifications", icon: Bell, label: "Thông báo" },
    { href: "/student/support", icon: HelpCircle, label: "Hỗ trợ" },
  ];

  return (
    <aside className="w-72 flex flex-col gap-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4 relative overflow-hidden">
          {user?.image ? (
            <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.[0] || "U"}
            </div>
          )}
        </div>
        <h3 className="font-bold text-gray-900 text-lg">{user?.name || "Người dùng"}</h3>
        <p className="text-xs text-gray-400 mt-1 truncate w-full">{user?.email}</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.href}
            {...item}
            isActive={pathname === item.href}
          />
        ))}
      </nav>
    </aside>
  );
}
