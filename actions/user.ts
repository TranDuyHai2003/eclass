"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function getUsers() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized")
    }

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return users
}

export async function toggleUserApproval(userId: string) {
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

export async function deleteUser(userId: string) {
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
