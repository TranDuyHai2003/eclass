/** Phần thuần của mã quà tặng, dùng được ở cả client (không import Prisma/crypto) */
import type { Currency } from "@prisma/client";

/** Bảng chữ không gây nhầm (bỏ O/0, I/1/L) */
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
/** Mã thầy đặt tên dễ nhớ (vd DIEM10, CHAMCHI) dài 4–16 ký tự; mã sinh ngẫu nhiên luôn 8 ký tự */
export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 16;
export const codeLengthOk = (code: string) => code.length >= MIN_CODE_LENGTH && code.length <= MAX_CODE_LENGTH;
export const MAX_BATCH = 200;
export const MAX_AMOUNT: Record<Currency, number> = { GEM: 50, XU: 20000 };

/**
 * Chuỗi ngày giờ từ <input type="datetime-local"> không có múi giờ ("2026-11-22T18:00") → hiểu là giờ Việt Nam (+07:00).
 * Chuỗi có múi giờ (ISO "…Z" / "+07:00") hoặc Date giữ nguyên. Review Gemini: server Heroku chạy UTC.
 */
export function parseVnDateTime(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s}${s.length === 16 ? ":00" : ""}+07:00` : s;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Chuẩn hoá mã người dùng gõ: chữ hoa, bỏ khoảng trắng và gạch */
export function normalizeCode(input: string) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
