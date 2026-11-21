"use server";

import { demoGuard } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { z } from "zod";

const classSchema = z.object({
  name: z.string().trim().min(1, "Tên lớp không được để trống").max(50, "Tên lớp tối đa 50 ký tự"),
});

export async function getClasses() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }

  const classes = await prisma.studyClass.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return classes;
}

export async function createClass(name: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const validatedData = classSchema.parse({ name });

    const newClass = await prisma.studyClass.create({
      data: {
        name: validatedData.name,
      },
    });

    revalidatePath("/admin/classes");
    return { success: true, data: newClass };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: false, error: "Lớp đã tồn tại" };
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).errors[0].message };
    }
    return { success: false, error: "Đã có lỗi xảy ra" };
  }
}

export async function updateClass(id: string, name: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const validatedData = classSchema.parse({ name });

    const updatedClass = await prisma.studyClass.update({
      where: { id },
      data: {
        name: validatedData.name,
      },
    });

    revalidatePath("/admin/classes");
    return { success: true, data: updatedClass };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: false, error: "Lớp đã tồn tại" };
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).errors[0].message };
    }
    return { success: false, error: "Đã có lỗi xảy ra" };
  }
}

/** Đặt khối (10/11/12…) cho lớp — "server" của Bảng Vàng; null = bỏ khối */
export async function updateClassGrade(id: string, grade: number | null) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return { success: false, error: "Unauthorized" };
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) return { success: false, error: "Khối từ 1 đến 12." };
  try {
    const updated = await prisma.studyClass.update({ where: { id }, data: { grade } });
    revalidatePath("/admin/classes");
    revalidatePath("/leaderboard");
    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Đã có lỗi xảy ra" };
  }
}

export async function deleteClass(id: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const result = await prisma.studyClass.deleteMany({
      where: {
        id,
        users: { none: {} },
        courses: { none: {} },
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Không thể xóa lớp đang có học viên hoặc khóa học" };
    }

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Đã có lỗi xảy ra khi xóa lớp" };
  }
}
