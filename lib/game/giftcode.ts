import { randomInt } from "crypto";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardOnce, isEligibleStudent, lockWallet, type Tx } from "@/lib/points/engine";
import type { PointsResult } from "@/lib/points/redemption";
import { ALPHABET, CODE_LENGTH, MAX_AMOUNT, MAX_BATCH, MAX_CODE_LENGTH, MIN_CODE_LENGTH, codeLengthOk, normalizeCode, parseVnDateTime } from "./giftcode-shared";

export { CODE_LENGTH, MAX_AMOUNT, MAX_BATCH, normalizeCode } from "./giftcode-shared";

/**
 * Mã quà tặng (thẻ cào) — thầy tạo lô mã, học sinh nhập để nhận ngọc (hoặc xu).
 * Bất biến: mỗi mã dùng tối đa maxUses lần (updateMany có điều kiện), mỗi học sinh mỗi mã một lần (unique GiftCodeUse),
 * tiền chỉ cộng qua awardOnce với khoá GIFTCODE:{id} → mọi đường đua đều về một kết quả.
 */

export function generateCode(rng: (max: number) => number = (max) => randomInt(0, max)) {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[rng(ALPHABET.length)];
  return s;
}

export interface GiftCodeBatchInput {
  count: number;
  currency: Currency;
  amount: number;
  maxUses: number;
  expiresAt?: string | Date | null;
  classId?: string | null;
  note?: string | null;
  /** Mã thầy tự đặt (4–16 chữ / số, không dấu) — chỉ khi tạo 1 mã */
  customCode?: string | null;
}

export function validateBatchInput(input: GiftCodeBatchInput): string | null {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_BATCH) return `Số mã từ 1 đến ${MAX_BATCH}.`;
  if (input.currency !== "GEM" && input.currency !== "XU") return "Loại tiền không hợp lệ.";
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_AMOUNT[input.currency]) {
    return `Giá trị mỗi mã từ 1 đến ${MAX_AMOUNT[input.currency].toLocaleString("vi-VN")}.`;
  }
  if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 500) return "Số lượt dùng mỗi mã từ 1 đến 500.";
  if (input.customCode) {
    const c = normalizeCode(input.customCode);
    if (input.count !== 1) return "Mã tự đặt chỉ tạo 1 mã mỗi lần.";
    if (!codeLengthOk(c)) return `Mã tự đặt dài ${MIN_CODE_LENGTH}–${MAX_CODE_LENGTH} chữ / số (không dấu, không khoảng trắng).`;
  }
  if (input.expiresAt) {
    const d = parseVnDateTime(input.expiresAt);
    if (!d) return "Hạn dùng không hợp lệ.";
    if (d.getTime() < Date.now()) return "Hạn dùng phải ở tương lai.";
  }
  return null;
}

/** Tạo một lô mã; trả về danh sách mã để thầy in. Kiểm tra trùng trước khi ghi (xác suất trùng cực thấp nhưng vẫn chặn). */
export class GiftCodeTaken extends Error {
  constructor(public code: string) {
    super(`Mã ${code} đã có rồi — chọn chữ khác nhé.`);
  }
}

export async function createBatch(input: GiftCodeBatchInput, createdById: string) {
  const err = validateBatchInput(input);
  if (err) throw new Error(err);
  const batchId = `${Date.now().toString(36)}-${generateCode().slice(0, 4)}`;
  const codes = new Set<string>();
  if (input.customCode) {
    const code = normalizeCode(input.customCode);
    if (await prisma.giftCode.findUnique({ where: { code }, select: { id: true } })) throw new GiftCodeTaken(code);
    codes.add(code);
  }
  while (codes.size < input.count) codes.add(generateCode());
  const existing = await prisma.giftCode.findMany({ where: { code: { in: [...codes] } }, select: { code: true } });
  for (const e of existing) {
    codes.delete(e.code);
    while (codes.size < input.count) codes.add(generateCode());
  }
  await prisma.giftCode.createMany({
    data: [...codes].map((code) => ({
      code,
      currency: input.currency,
      amount: input.amount,
      maxUses: input.maxUses,
      expiresAt: parseVnDateTime(input.expiresAt),
      classId: input.classId || null,
      note: input.note?.trim().slice(0, 120) || null,
      batchId,
      createdById,
    })),
  });
  return { batchId, codes: [...codes] };
}

const GENERIC = "Mã không hợp lệ hoặc đã được dùng.";

/**
 * Học sinh nhập mã (lõi, chạy trong giao dịch). Thứ tự: khoá ví → tìm mã → ghi lượt dùng (unique) → trừ lượt có điều kiện → cộng tiền.
 * Lỗi ở bước nào thì ném → giao dịch huỷ, không có dòng rác.
 */
export async function redeemGiftCodeInTx(tx: Tx, userId: string, rawCode: string): Promise<PointsResult & { currency?: Currency; amount?: number }> {
  const code = normalizeCode(rawCode);
  if (!codeLengthOk(code)) return { success: false, error: GENERIC };
  if (!(await isEligibleStudent(tx, userId))) return { success: false, error: "Tài khoản cần được thầy duyệt mới nhập được mã." };

  await lockWallet(tx, userId);
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { classId: true } });
  const gc = await tx.giftCode.findUnique({
    where: { code },
    select: { id: true, currency: true, amount: true, maxUses: true, usedCount: true, expiresAt: true, classId: true, isActive: true },
  });
  if (!gc || !gc.isActive) return { success: false, error: GENERIC };
  if (gc.expiresAt && gc.expiresAt.getTime() < Date.now()) return { success: false, error: "Mã đã hết hạn." };
  if (gc.classId && gc.classId !== user.classId) return { success: false, error: GENERIC };
  // Kiểm tra "đã dùng" trước "hết lượt" → thẻ cào cá nhân nhập lần 2 báo đúng lý do
  const already = await tx.giftCodeUse.count({ where: { giftCodeId: gc.id, userId } });
  if (already > 0) return { success: false, error: "Bạn đã dùng mã này rồi." };
  if (gc.usedCount >= gc.maxUses) return { success: false, error: "Mã đã hết lượt dùng." };

  // Hai bạn dùng lượt cuối cùng một lúc: chỉ một người qua được điều kiện usedCount < maxUses
  const taken = await tx.giftCode.updateMany({
    where: { id: gc.id, isActive: true, usedCount: { lt: gc.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (taken.count === 0) return { success: false, error: "Mã đã hết lượt dùng." };

  // Unique (giftCodeId, userId) → hai tab của cùng một bạn: tab sau ném lỗi, giao dịch huỷ, lượt đã tăng ở trên được hoàn lại
  await tx.giftCodeUse.create({ data: { giftCodeId: gc.id, userId } });

  const got = await awardOnce(tx, {
    userId,
    amount: gc.amount,
    source: "GIFTCODE",
    key: `GIFTCODE:${gc.id}`,
    refId: gc.id,
    reason: `Nhập mã quà tặng ${code}`,
    currency: gc.currency,
  });
  if (got === 0) throw new Error("GIFTCODE_ALREADY_AWARDED");

  return {
    success: true,
    message: `+${gc.amount.toLocaleString("vi-VN")} ${gc.currency === "GEM" ? "ngọc" : "xu"} 🎉`,
    currency: gc.currency,
    amount: gc.amount,
  };
}

/**
 * Chống dò mã: tối đa `limit` lần nhập sai trong `windowMs` VÀ `dailyLimit` lần sai trong 24 giờ cho mỗi học sinh
 * (đếm trong bộ nhớ của tiến trình — đủ cho một dyno). 26/11/2026: thêm trần ngày vì mã thầy tự đặt (4–16 chữ) có thể là từ dễ đoán.
 */
const failures = new Map<string, number[]>();
export const RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000, dailyLimit: 30, dayMs: 24 * 60 * 60 * 1000 };

const recent = (userId: string, now: number) => (failures.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.dayMs);
export function rateLimited(userId: string, now = Date.now()) {
  const day = recent(userId, now);
  failures.set(userId, day);
  if (day.length >= RATE_LIMIT.dailyLimit) return true;
  return day.filter((t) => now - t < RATE_LIMIT.windowMs).length >= RATE_LIMIT.limit;
}
export function noteFailure(userId: string, now = Date.now()) {
  const day = recent(userId, now);
  day.push(now);
  failures.set(userId, day);
}
export function resetFailures(userId?: string) {
  if (userId) failures.delete(userId);
  else failures.clear();
}
