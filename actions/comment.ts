"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createComment(
  lessonId: string,
  content: string,
  parentId?: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        lessonId,
        userId: session.user.id,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Trigger Notification for Reply
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (parentComment && parentComment.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentComment.userId,
            title: "Có phản hồi mới",
            message: `${session.user.name || "Ai đó"} đã trả lời bình luận của bạn`,
            link: `/watch/${lessonId}`,
            type: "REPLY",
          },
        });
      }
    } else {
      // Optional: Notify Teacher if it's a root comment (Bonus/Future scope based on prompt 1)
      // For now, adhering strictly to Prompt 2's request for Reply notifications via parentId check.
    }

    revalidatePath(`/watch/${lessonId}`);
    return { success: true, comment };
  } catch (error) {
    console.error("Create comment error:", error);
    return { success: false, error: "Failed to create comment" };
  }
}

export async function getComments(lessonId: string) {
  try {
    const comments = await prisma.comment.findMany({
      where: {
        lessonId,
        parentId: null, // Get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
          },
        },
        children: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, comments };
  } catch (error) {
    console.error("Get comments error:", error);
    return { success: false, comments: [] };
  }
}

export async function updateComment(commentId: string, content: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        isEdited: true,
      },
    });

    // Revalidate path is tricky here because we don't know the lessonId easily without fetching.
    // Ideally we pass lessonId or fetch it.
    if (comment.lessonId) {
      revalidatePath(`/watch/${comment.lessonId}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update comment" };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) return { success: false, error: "Comment not found" };

    const isAdminOrTeacher =
      session.user.role === "ADMIN" || session.user.role === "TEACHER";
    const isOwner = comment.userId === session.user.id;

    if (!isAdminOrTeacher && !isOwner) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Attempt revalidate if we can get lessonId via relation or passed param
    if (comment.lessonId) {
      revalidatePath(`/watch/${comment.lessonId}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete comment" };
  }
}
