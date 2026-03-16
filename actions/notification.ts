"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, notifications: [] };
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });

    return { success: true, notifications, unreadCount };
  } catch (error) {
    console.error("Get notifications error:", error);
    return { success: false, notifications: [], unreadCount: 0 };
  }
}

export async function markAsRead(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notification.update({
      where: {
        id: notificationId,
        userId: session.user.id, // Ensure ownership
      },
      data: {
        isRead: true,
      },
    });

    revalidatePath("/"); // Revalidate globally or specific path
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark as read" };
  }
}

export async function markAllAsRead() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark all as read" };
  }
}
