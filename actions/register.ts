'use server'

import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { redirect } from "next/navigation"

export async function register(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!name || !email || !password) {
    return { error: "Missing fields" }
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: "Email already exists" }
  }

  // Hash password
  const hashedPassword = await hash(password, 10)

  // Check if there is already an ADMIN in the system
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  })

  // Create user
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      // If no admin exists yet and this is the special admin email, make this account ADMIN & auto-approved
      role: !existingAdmin && email === "admin@gmail.com" ? "ADMIN" : undefined,
      isApproved: !existingAdmin && email === "admin@gmail.com" ? true : undefined,
    },
  })

  return { success: true }
}
