import { randomUUID } from "crypto";
import type { Role, StudentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POINTS } from "@/lib/points/config";

/**
 * Dữ liệu mẫu cho test: mọi bản ghi gắn một "tag" riêng để dọn sạch sau mỗi file test
 * (xoá user → tự xoá ví, sổ điểm, yêu cầu đổi quà, bài làm, thông báo).
 */
export function createFixture() {
  const tag = `ptest-${Date.now()}-${randomUUID().slice(0, 6)}`;
  let n = 0;
  const next = () => `${tag}-${++n}`;

  const fx = {
    tag,
    prisma,
    async cls(name?: string) {
      return prisma.studyClass.create({ data: { name: name ?? next() } });
    },
    async user(opts: { role?: Role; isApproved?: boolean; isDemo?: boolean; studentType?: StudentType; classId?: string | null } = {}) {
      const id = next();
      return prisma.user.create({
        data: {
          email: `${id}@test.local`,
          name: `Học sinh ${id.slice(-4)}`,
          role: opts.role ?? "STUDENT",
          isApproved: opts.isApproved ?? true,
          isDemo: opts.isDemo ?? false,
          studentType: opts.studentType ?? "OFFLINE",
          classId: opts.classId ?? null,
        },
      });
    },
    async test(opts: { dueDate?: Date | null; courseId?: string | null } = {}) {
      return prisma.test.create({ data: { pdfUrl: "test.pdf", duration: 10, title: tag, dueDate: opts.dueDate ?? null, courseId: opts.courseId ?? null } });
    },
    async attempt(testId: string, userId: string, score: number | null, completedAt: Date | null = new Date()) {
      return prisma.studentAttempt.create({ data: { testId, userId, score, completedAt } });
    },
    async reward(opts: Partial<{ price: number; stock: number | null; perStudentMonthlyLimit: number | null; kind: "PHYSICAL" | "VIRTUAL"; offlineOnly: boolean; isActive: boolean; deletedAt: Date | null; classIds: string[]; costVnd: number | null }> = {}) {
      const kind = opts.kind ?? "PHYSICAL";
      return prisma.reward.create({
        data: {
          title: `${tag} quà ${++n}`,
          price: opts.price ?? 10,
          stock: opts.stock === undefined ? null : opts.stock,
          perStudentMonthlyLimit: opts.perStudentMonthlyLimit ?? null,
          kind,
          offlineOnly: opts.offlineOnly ?? kind !== "VIRTUAL",
          isActive: opts.isActive ?? true,
          deletedAt: opts.deletedAt ?? null,
          costVnd: opts.costVnd ?? null,
          classes: opts.classIds?.length ? { connect: opts.classIds.map((id) => ({ id })) } : undefined,
        },
      });
    },
    /** Cộng điểm thẳng vào ví (giả lập học sinh đã tích điểm) */
    async give(userId: string, amount: number) {
      await prisma.pointLedger.create({ data: { userId, amount, source: "MANUAL", reason: "fixture" } });
      await prisma.pointWallet.upsert({
        where: { userId },
        create: { userId, balance: amount, lifetimeEarned: Math.max(0, amount) },
        update: { balance: { increment: amount }, lifetimeEarned: { increment: Math.max(0, amount) } },
      });
    },
    async balance(userId: string) {
      return (await prisma.pointWallet.findUnique({ where: { userId } }))?.balance ?? 0;
    },
    async wallet(userId: string) {
      return prisma.pointWallet.findUnique({ where: { userId } });
    },
    /** Tổng sổ điểm — phải luôn bằng số dư ví */
    async ledgerSum(userId: string) {
      return (await prisma.pointLedger.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? 0;
    },
    async cleanup() {
      await prisma.reward.deleteMany({ where: { title: { startsWith: tag } } });
      await prisma.test.deleteMany({ where: { title: tag } });
      await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
      await prisma.studyClass.deleteMany({ where: { name: { startsWith: tag } } });
    },
  };
  return fx;
}

/** Tạm đổi cấu hình điểm trong một test (vd giới hạn ngày), tự khôi phục */
export async function withPoints<T>(patch: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const cfg = POINTS as unknown as Record<string, unknown>;
  const saved = Object.fromEntries(Object.keys(patch).map((k) => [k, cfg[k]]));
  Object.assign(cfg, patch);
  try {
    return await fn();
  } finally {
    Object.assign(cfg, saved);
  }
}

export async function disconnect() {
  await prisma.$disconnect();
}
