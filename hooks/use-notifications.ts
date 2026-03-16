"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "@/actions/notification";
import { useSession } from "next-auth/react";

// Poll interval in milliseconds (30 seconds)
const POLL_INTERVAL = 30 * 1000;

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return;

    // Don't set loading to true for background polls
    const res = await getNotifications();
    if (res.success) {
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    }
    setIsLoading(false);
  }, [session?.user]);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();

    const intervalId = setInterval(fetchNotifications, POLL_INTERVAL);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await markAsRead(id);
    // Background refresh to ensure sync
    fetchNotifications();
  };

  const markAllRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    await markAllAsRead();
    fetchNotifications();
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
  };
}
