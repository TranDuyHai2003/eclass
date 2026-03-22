"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createEnrollment(courseId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Bạn đã ghi danh khóa học này rồi hoặc đang chờ duyệt." };
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: session.user.id,
        courseId,
        status: "PENDING",
      },
    });

    revalidatePath(`/courses/${courseId}`);
    return { success: true, enrollment };
  } catch (error) {
    console.error("Create Enrollment Error:", error);
    return { success: false, error: "Không thể tạo yêu cầu ghi danh. Có thể do lỗi kết nối Database." };
  }
}

export async function getEnrollmentStatus(courseId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    });

    return enrollment?.status || null;
  } catch (error) {
    return null;
  }
}

export async function getPendingEnrollments() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  try {
    return await prisma.enrollment.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { name: true, email: true, image: true } },
        course: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Fetch Enrollments Error:", error);
    return [];
  }
}

export async function adminApproveEnrollment(enrollmentId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "ACTIVE" },
      include: { course: true }
    });

    revalidatePath("/admin/finance");
    revalidatePath(`/courses/${enrollment.courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Approve Enrollment Error:", error);
    return { success: false, error: "Lỗi duyệt." };
  }
}

export async function adminRejectEnrollment(enrollmentId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "REJECTED" },
    });

    revalidatePath("/admin/finance");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi từ chối." };
  }
}
