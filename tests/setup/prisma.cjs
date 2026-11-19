// PrismaClient thường cho test (thay cho lib/prisma.ts vốn bọc thêm phần ẩn danh demo phụ thuộc next-auth)
const { PrismaClient } = require("@prisma/client");

const prisma = globalThis.__testPrisma || (globalThis.__testPrisma = new PrismaClient());
module.exports = { prisma, prismaBase: prisma };
