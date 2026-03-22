"use server"

import { signIn } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AuthError } from "next-auth"

export async function login(formData: FormData) {
  try {
    const email = formData.get("email") as string | null
    const password = formData.get("password") as string | null

    if (!email || !password) {
      return { error: "Vui lòng nhập đầy đủ email và mật khẩu!" }
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { isApproved: true },
    })

    if (!user) {
      return { error: "Email hoặc mật khẩu không chính xác!" }
    }

    if (!user.isApproved) {
      return {
        error:
          "Tài khoản của bạn đang chờ được quản trị viên duyệt. Vui lòng liên hệ giáo viên hoặc thử lại sau.",
      }
    }

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    return { success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email hoặc mật khẩu không chính xác!" }
        default:
          return { error: "Đã có lỗi xảy ra!" }
      }
    }
    throw error
  }
}
