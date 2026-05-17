"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitHomework(lessonId: string, attachments: { name: string, url: string }[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const submission = await prisma.homeworkSubmission.upsert({
    where: {
      userId_lessonId: {
        userId: session.user.id,
        lessonId,
      },
    },
    update: {
      attachments: attachments as any,
      status: "PENDING", // Reset to pending if re-submitted
    },
    create: {
      userId: session.user.id,
      lessonId,
      attachments: attachments as any,
    },
  });

  revalidatePath(`/watch/${lessonId}`);
  return { success: true, submission };
}

export async function gradeHomework(submissionId: string, status: "SATISFACTORY" | "UNSATISFACTORY", feedback?: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }

  const submission = await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      feedback,
    },
  });

  revalidatePath(`/watch/${submission.lessonId}`);
  return { success: true, submission };
}

export async function getHomeworkSubmission(lessonId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;

    return await prisma.homeworkSubmission.findUnique({
        where: {
            userId_lessonId: {
                userId: session.user.id,
                lessonId,
            }
        }
    });
}
