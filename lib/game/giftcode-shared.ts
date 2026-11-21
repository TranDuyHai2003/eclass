/** Phần thuần của mã quà tặng, dùng được ở cả client (không import Prisma/crypto) */
import type { Currency } from "@prisma/client";

/** Bảng chữ không gây nhầm (bỏ O/0, I/1/L) */
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const MAX_BATCH = 200;
export const MAX_AMOUNT: Record<Currency, number> = { GEM: 50, XU: 20000 };

/** Chuẩn hoá mã người dùng gõ: chữ hoa, bỏ khoảng trắng và gạch */
export function normalizeCode(input: string) {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
