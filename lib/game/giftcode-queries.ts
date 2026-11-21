import { prisma } from "@/lib/prisma";

/** Các lô mã quà tặng cho trang quản lý của thầy (mới nhất trước) */
export async function getGiftCodeBatches(limit = 30) {
  const codes = await prisma.giftCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true, code: true, currency: true, amount: true, maxUses: true, usedCount: true, expiresAt: true, isActive: true,
      note: true, batchId: true, createdAt: true, classId: true,
      studyClass: { select: { name: true } },
      uses: { select: { createdAt: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  const map = new Map<string, {
    batchId: string; createdAt: string; currency: "XU" | "GEM"; amount: number; maxUses: number; expiresAt: string | null;
    note: string | null; className: string | null; total: number; used: number; active: number;
    codes: { code: string; usedCount: number; isActive: boolean; users: string[] }[];
  }>();
  for (const c of codes) {
    const key = c.batchId ?? c.id;
    let b = map.get(key);
    if (!b) {
      b = {
        batchId: key, createdAt: c.createdAt.toISOString(), currency: c.currency, amount: c.amount, maxUses: c.maxUses,
        expiresAt: c.expiresAt?.toISOString() ?? null, note: c.note, className: c.studyClass?.name ?? null,
        total: 0, used: 0, active: 0, codes: [],
      };
      map.set(key, b);
    }
    b.total++;
    b.used += c.usedCount;
    if (c.isActive && c.usedCount < c.maxUses && !(c.expiresAt && c.expiresAt.getTime() < Date.now())) b.active++;
    b.codes.push({ code: c.code, usedCount: c.usedCount, isActive: c.isActive, users: c.uses.map((u) => u.user.name || u.user.email) });
  }
  return [...map.values()].slice(0, limit);
}

export type GiftCodeBatch = Awaited<ReturnType<typeof getGiftCodeBatches>>[number];
