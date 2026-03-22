"use client";

import { useNotifications } from "@/hooks/use-notifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (
    notificationId: string,
    link: string | null,
  ) => {
    // 1. Mark as read
    await markRead(notificationId);

    // 2. Navigate
    if (link) {
      setOpen(false); // Close popover
      router.push(link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative cursor-pointer mt-1 mr-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between bg-gray-50/50">
          <h4 className="font-semibold text-sm">Thông báo</h4>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Đã đọc tất cả
            </button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-red-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Không có thông báo mới
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() =>
                    handleNotificationClick(notification.id, notification.link)
                  }
                  className={cn(
                    "p-3 cursor-pointer hover:bg-gray-50 transition-colors text-sm",
                    !notification.isRead && "bg-red-50/50",
                  )}
                >
                  <p
                    className={cn(
                      "font-medium mb-1",
                      !notification.isRead ? "text-gray-900" : "text-gray-600",
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="text-gray-500 line-clamp-2 text-xs mb-1">
                    {notification.message}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      locale: vi,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t text-center">
          <Button
            variant="link"
            size="sm"
            className="text-xs text-gray-500 h-auto py-1"
          >
            Xem tất cả
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
