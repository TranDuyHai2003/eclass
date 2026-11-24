import { prisma } from "@/lib/prisma";
import { isPointsEnabled } from "@/lib/points/config";
import { isEligibleStudent, type Tx } from "@/lib/points/engine";
import { ITEM_BY_ID } from "./items";

/**
 * Nhiệm vụ ẩn → biệt danh (danh hiệu ô `title`, nguồn QUEST). Theo tài liệu "Biệt danh" của thầy (24/11/2026):
 * hoàn thành → biệt danh TỰ ĐEO ngay (đổi lại được) + thông báo; bảng "Nhiệm vụ ẩn" hiện ??? cho nhiệm vụ chưa mở.
 * Mọi kiểm tra chạy trong giao dịch riêng SAU khi cộng điểm (runQuestsSafely) → lỗi ở đây không ảnh hưởng nộp bài / điểm.
 * PLAN: docs/ai-reviews/hidden-quests/PLAN.md
 */
import { QUEST_BY_ID, QUEST_ITEM_IDS, vnHour, DEADLINE_WINDOW_MIN, COMEBACK_JUMP, DRAGON_XU, isTissueReward, type QuestId } from "./quests-shared";
export * from "./quests-shared";

const MIN = 60 * 1000;

/**
 * Cấp một biệt danh (nếu chưa có hoặc bản cũ đã hết hạn): thêm vào túi (nguồn QUEST), tự đeo, gửi thông báo.
 * Trả về true nếu vừa cấp mới.
 */
export async function grantQuestInTx(tx: Tx, userId: string, id: QuestId, now = new Date()): Promise<boolean> {
  const q = QUEST_BY_ID[id];
  const item = ITEM_BY_ID[q.itemId];
  if (!item) return false;
  const existing = await tx.userItem.findUnique({ where: { userId_itemId: { userId, itemId: q.itemId } }, select: { expiresAt: true } });
  if (existing && (!existing.expiresAt || existing.expiresAt > now)) return false;
  const expiresAt = q.hours ? new Date(now.getTime() + q.hours * 60 * MIN) : null;
  await tx.userItem.upsert({
    where: { userId_itemId: { userId, itemId: q.itemId } },
    create: { userId, itemId: q.itemId, source: "QUEST", expiresAt },
    update: { source: "QUEST", expiresAt, createdAt: now },
  });
  // Tự đeo ngay (thầy chọn) — đổi lại được ở Hồ sơ & Trang trí
  const row = await tx.userAvatar.findUnique({ where: { userId }, select: { config: true } });
  const config = { ...((row?.config as Record<string, unknown> | null) ?? {}), title: q.itemId };
  await tx.userAvatar.upsert({ where: { userId }, create: { userId, config }, update: { config } });
  await tx.notification.create({
    data: {
      userId,
      title: "🕵️ Hoàn thành nhiệm vụ ẩn!",
      message: `Bạn nhận biệt danh "${item.name}"${q.hours ? ` (${q.hours} giờ)` : ""}. ${q.how}.`,
      link: "/rewards#nhiem-vu",
      type: "SYSTEM",
    },
  });
  return true;
}

/** Chạy kiểm tra nhiệm vụ trong giao dịch riêng; lỗi chỉ ghi log. Trả về danh sách nhiệm vụ vừa mở. */
export async function runQuestsSafely(label: string, userId: string, fn: (tx: Tx) => Promise<QuestId[]>): Promise<QuestId[]> {
  if (!isPointsEnabled()) return [];
  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await isEligibleStudent(tx, userId))) return [];
      const want = await fn(tx);
      const got: QuestId[] = [];
      for (const id of want) if (await grantQuestInTx(tx, userId, id)) got.push(id);
      return got;
    }, { timeout: 15000 });
  } catch (err) {
    console.error(`[quests] ${label} failed:`, err);
    return [];
  }
}

/** Chưa từng tiêu xu (đổi quà, mở hộp, mua đồ) mà số dư đã trên 5.000 */
async function dragon(tx: Tx, userId: string): Promise<boolean> {
  const w = await tx.pointWallet.findUnique({ where: { userId }, select: { balance: true } });
  if (!w || w.balance <= DRAGON_XU) return false;
  const spent = await tx.pointLedger.count({ where: { userId, currency: "XU", amount: { lt: 0 }, source: { in: ["REDEEM", "GACHA", "ITEM"] } } });
  return spent === 0;
}

/** Nộp bài kiểm tra / bài tập (gọi sau khi đã cộng điểm). `due` = hạn hiệu lực của học sinh (đã tính hạn riêng lớp). */
export async function checkSubmitQuests(tx: Tx, p: {
  userId: string;
  kind: "test" | "homework";
  now: Date;
  due?: Date | null;
  testId?: string;
  attemptId?: string;
  /** Điểm cuối (null khi còn tự luận chờ chấm) */
  score?: number | null;
}): Promise<QuestId[]> {
  const out: QuestId[] = [];
  const h = vnHour(p.now);
  if (h >= 0 && h < 3) out.push("owl");
  if (h >= 5 && h < 8) out.push("early");

  if (p.kind === "test" && p.testId) {
    const late = !!p.due && p.now > p.due;
    if (p.due && !late && p.due.getTime() - p.now.getTime() <= DEADLINE_WINDOW_MIN * MIN) out.push("deadline89");

    if (typeof p.score === "number") {
      if (p.score >= 10) out.push("perfect");
      const prev = await tx.studentAttempt.findFirst({
        where: { userId: p.userId, completedAt: { not: null, lt: p.now }, score: { not: null }, ...(p.attemptId ? { id: { not: p.attemptId } } : {}), testId: { not: p.testId } },
        orderBy: { completedAt: "desc" },
        select: { score: true },
      });
      if (prev?.score !== null && prev?.score !== undefined && p.score - prev.score >= COMEBACK_JUMP) out.push("comeback");
    }

    if (late) {
      // 5 bài nộp gần nhất trước bài này đều đúng hạn (mỗi bài đúng hạn có dòng ON_TIME cùng mã bài)
      const prev = await tx.pointLedger.findMany({
        where: { userId: p.userId, source: "TEST_SUBMIT", key: { startsWith: "TEST:", not: `TEST:${p.testId}` } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { key: true },
      });
      if (prev.length === 5) {
        const onTime = await tx.pointLedger.count({ where: { userId: p.userId, source: "ON_TIME", key: { in: prev.map((r: { key: string | null }) => `ONTIME:${(r.key ?? "").slice(5)}`) } } });
        if (onTime === 5) out.push("turtle");
      }
    }
  }

  if (await dragon(tx, p.userId)) out.push("dragon");
  return out;
}

/** Mở Hộp bí ẩn */
export function checkGachaQuests(rarity: string): QuestId[] {
  return rarity === "epic" || rarity === "legendary" ? ["lucky"] : [];
}

/** Đổi quà: người đầu tiên trong lớp đổi Túi giấy ăn */
export async function checkRedeemQuests(tx: Tx, p: { userId: string; redemptionId: string }): Promise<QuestId[]> {
  const r = await tx.redemption.findUnique({ where: { id: p.redemptionId }, select: { rewardId: true, createdAt: true, reward: { select: { title: true } } } });
  if (!r || !isTissueReward(r.reward.title)) return [];
  const me = await tx.user.findUnique({ where: { id: p.userId }, select: { classId: true } });
  if (!me?.classId) return [];
  const earlier = await tx.redemption.count({
    where: { rewardId: r.rewardId, id: { not: p.redemptionId }, status: { in: ["PENDING", "DELIVERED"] }, createdAt: { lte: r.createdAt }, user: { classId: me.classId } },
  });
  return earlier === 0 ? ["tissue"] : [];
}

/** Biệt danh học sinh đang có (còn hạn) + thời điểm mở, cho bảng "Nhiệm vụ ẩn" */
export async function getQuestProgress(userId: string) {
  const rows = await prisma.userItem.findMany({
    where: { userId, itemId: { in: [...QUEST_ITEM_IDS] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { itemId: true, createdAt: true, expiresAt: true },
  });
  return rows.map((r) => ({ itemId: r.itemId, at: r.createdAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null }));
}
