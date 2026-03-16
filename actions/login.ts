"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function login(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
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
