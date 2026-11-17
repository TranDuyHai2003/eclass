"use server"

import { demoGuard } from "@/lib/demo";
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { StudentType, Role, Level } from "@prisma/client"
import { compare, hash } from "bcryptjs"
import { randomInt } from "crypto"

export async function getUsers() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized")
    }

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { studyClass: true },
        omit: { password: true }
    })

    return users
}

export async function toggleUserApproval(userId: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return { success: false, error: "User not found" }

        await prisma.user.update({
            where: { id: userId },
            data: { isApproved: !user.isApproved }
        })

        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Internal Server Error" }
    }
}

export async function updateUserRole(userId: string, newRole: Role) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    // Prevent changing your own role
    if (session.user.id === userId) {
        return { success: false, error: "Bạn không thể tự thay đổi quyền của chính mình" }
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return { success: false, error: "User not found" }

        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole }
        })

        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Internal Server Error" }
    }
}

export async function updateStudentType(userId: string, newType: StudentType) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return { success: false, error: "User not found" }

        await prisma.user.update({
            where: { id: userId },
            data: { studentType: newType }
        })

        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Internal Server Error" }
    }
}

export async function updateUserLevel(userId: string, newLevel: Level) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { success: false, error: "User not found" }

    await prisma.user.update({
      where: { id: userId },
      data: { level: newLevel }
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: "Internal Server Error" }
  }
}

export async function updateUserClass(userId: string, classId: string | null) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { classId }
        });
        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function deleteUser(userId: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await prisma.user.delete({ where: { id: userId } })
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Failed to delete user" }
    }
}

export async function updateProfile(data: { name?: string; image?: string }) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || !session.user) {
        return { success: false, error: "Chưa đăng nhập" }
    }

    const userId = session.user.id;

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.image !== undefined ? { image: data.image } : {}),
            }
        })

        revalidatePath("/profile")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Lỗi hệ thống khi cập nhật hồ sơ" }
    }
}

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 72 // giới hạn của bcrypt

function validateNewPassword(password: string): string | null {
    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return `Mật khẩu mới phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        return `Mật khẩu mới tối đa ${PASSWORD_MAX_LENGTH} ký tự`
    }
    return null
}

/** Sinh mật khẩu tạm dễ đọc (bỏ các ký tự dễ nhầm như 0/O, 1/l/I). */
function generateTempPassword(length = 10) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    let result = ""
    for (let i = 0; i < length; i++) {
        result += alphabet[randomInt(alphabet.length)]
    }
    return result
}

/** Người dùng tự đổi mật khẩu. Tài khoản đăng nhập bằng Google/Facebook chưa có mật khẩu thì được tạo mới. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, error: "Chưa đăng nhập" }
    }

    const validationError = validateNewPassword(newPassword)
    if (validationError) return { success: false, error: validationError }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { password: true }
        })
        if (!user) return { success: false, error: "Không tìm thấy tài khoản" }

        if (user.password) {
            const isCurrentValid = await compare(currentPassword || "", user.password)
            if (!isCurrentValid) {
                return { success: false, error: "Mật khẩu hiện tại không đúng" }
            }
            if (await compare(newPassword, user.password)) {
                return { success: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại" }
            }
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: await hash(newPassword, 10) }
        })

        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Lỗi hệ thống khi đổi mật khẩu" }
    }
}

/** Admin đặt lại mật khẩu cho người dùng: sinh mật khẩu tạm và trả về để admin gửi cho học sinh. */
export async function adminResetPassword(userId: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    if (session.user.id === userId) {
        return { success: false, error: "Hãy đổi mật khẩu của chính bạn trong trang Hồ sơ" }
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
        if (!user) return { success: false, error: "User not found" }

        const tempPassword = generateTempPassword()
        await prisma.user.update({
            where: { id: userId },
            data: { password: await hash(tempPassword, 10) }
        })

        return { success: true, tempPassword }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Không thể đặt lại mật khẩu" }
    }
}
