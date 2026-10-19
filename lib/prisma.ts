import { PrismaClient } from "@prisma/client"
import { withDemoPrivacy } from "@/lib/demo-privacy"

type ExtendedPrismaClient = ReturnType<typeof withDemoPrivacy>

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient
  prisma?: ExtendedPrismaClient
}

/** Client gốc, không ẩn danh — chỉ dùng cho NextAuth (adapter, callbacks). */
export const prismaBase = globalForPrisma.prismaBase || new PrismaClient()

/** Client dùng trong ứng dụng: tự ẩn danh dữ liệu cá nhân khi người xem là tài khoản demo. */
export const prisma = globalForPrisma.prisma || withDemoPrivacy(prismaBase)

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase
  globalForPrisma.prisma = prisma
}
