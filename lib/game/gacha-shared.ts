/**
 * Rương bí ẩn — phần thuần (tỉ lệ, bể quà, quay bằng RNG truyền vào). Không import Prisma → dùng ở client và test.
 * Chỉ đồ ảo (quyết định 21/11): đồ trang trí, gói xu, ngọc. Trùng đồ → trả xu theo bậc.
 */
import type { Rarity } from "@/lib/points/rarity";
import { DUPLICATE_REFUND, ITEMS, type Item } from "./items";

export type ChestId = "xu" | "gem";

export interface Chest {
  id: ChestId;
  name: string;
  emoji: string;
  cost: { xu: number } | { gem: number };
  /** Tỉ lệ phần trăm theo bậc, tổng = 100 */
  rates: Partial<Record<Rarity, number>>;
  /** Bảo hiểm: sau `pity - 1` lượt liên tiếp không ra Sử thi+, lượt thứ `pity` chắc chắn ≥ Sử thi (null = không có) */
  pity: number | null;
  /** Tối đa lượt mỗi ngày (giờ VN); null = không trần (review Gemini: Rương Xu 3/ngày) */
  dailyLimit: number | null;
  description: string;
}

export const CHESTS: Record<ChestId, Chest> = {
  xu: {
    id: "xu",
    name: "Rương Xu",
    emoji: "🧰",
    cost: { xu: 600 },
    rates: { common: 60, rare: 28, epic: 10, legendary: 2 },
    pity: 5,
    dailyLimit: 3,
    description: "Mở bằng xu. Lần mở thứ 5 liên tiếp chưa ra Sử thi sẽ chắc chắn Sử thi trở lên.",
  },
  gem: {
    id: "gem",
    name: "Rương Ngọc",
    emoji: "💎",
    cost: { gem: 3 },
    rates: { rare: 55, epic: 35, legendary: 10 },
    pity: null,
    dailyLimit: null,
    description: "Mở bằng ngọc thầy phát. Không có đồ Phổ thông.",
  },
};

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

/** Gói tiền trong bể quà (ngoài đồ trang trí) */
export interface CurrencyPrize {
  kind: "xu" | "gem";
  amount: number;
  rarity: Rarity;
  /** Rương nào có gói này */
  chests: ChestId[];
}
export const CURRENCY_PRIZES: CurrencyPrize[] = [
  { kind: "xu", amount: 150, rarity: "common", chests: ["xu"] },
  { kind: "xu", amount: 300, rarity: "common", chests: ["xu"] },
  { kind: "xu", amount: 600, rarity: "rare", chests: ["xu", "gem"] },
  { kind: "xu", amount: 1500, rarity: "epic", chests: ["gem"] },
  { kind: "gem", amount: 1, rarity: "legendary", chests: ["xu"] },
  { kind: "gem", amount: 2, rarity: "legendary", chests: ["gem"] },
];

export type Prize = { kind: "item"; item: Item } | CurrencyPrize;

/** Bể quà của một rương ở một bậc: đồ trang trí không miễn phí của bậc đó + gói tiền dành cho rương */
export function poolFor(chest: ChestId, rarity: Rarity): Prize[] {
  const items: Prize[] = ITEMS.filter((i) => !i.free && i.rarity === rarity).map((item) => ({ kind: "item", item }));
  const money: Prize[] = CURRENCY_PRIZES.filter((p) => p.rarity === rarity && p.chests.includes(chest));
  return [...items, ...money];
}

export type Outcome =
  | { kind: "item"; itemId: string; name: string; rarity: Rarity; duplicate: boolean; refundXu: number }
  | { kind: "xu"; amount: number; rarity: Rarity }
  | { kind: "gem"; amount: number; rarity: Rarity };

/** Chọn bậc theo tỉ lệ; `forceMinEpic` khi tới lượt bảo hiểm */
export function rollRarity(chest: Chest, rng: () => number, forceMinEpic = false): Rarity {
  const entries = RARITY_ORDER.filter((r) => (chest.rates[r] ?? 0) > 0 && (!forceMinEpic || r === "epic" || r === "legendary"));
  const total = entries.reduce((s, r) => s + (chest.rates[r] ?? 0), 0);
  let x = rng() * total;
  for (const r of entries) {
    x -= chest.rates[r] ?? 0;
    if (x < 0) return r;
  }
  return entries[entries.length - 1];
}

/**
 * Quay một lượt (thuần). `pityCount` = số lượt Rương Xu liên tiếp chưa ra Sử thi+ trước lượt này.
 * Trả về kết quả và pityCount mới.
 */
export function roll(chestId: ChestId, rng: () => number, pityCount: number, owned: Set<string>): { outcome: Outcome; pityAfter: number; guaranteed: boolean } {
  const chest = CHESTS[chestId];
  const guaranteed = chest.pity !== null && pityCount >= chest.pity - 1;
  const rarity = rollRarity(chest, rng, guaranteed);
  const pool = poolFor(chestId, rarity);
  const prize = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const outcome: Outcome =
    prize.kind === "item"
      ? {
          kind: "item",
          itemId: prize.item.id,
          name: prize.item.name,
          rarity,
          duplicate: owned.has(prize.item.id),
          refundXu: owned.has(prize.item.id) ? DUPLICATE_REFUND[rarity] : 0,
        }
      : { kind: prize.kind, amount: prize.amount, rarity };
  const epicPlus = rarity === "epic" || rarity === "legendary";
  const pityAfter = chest.pity === null ? pityCount : epicPlus ? 0 : pityCount + 1;
  return { outcome, pityAfter, guaranteed };
}

/** Bảng tỉ lệ để hiện cho học sinh */
export function ratesTable(chestId: ChestId) {
  const chest = CHESTS[chestId];
  return RARITY_ORDER.filter((r) => (chest.rates[r] ?? 0) > 0).map((r) => ({
    rarity: r,
    percent: chest.rates[r] ?? 0,
    prizes: poolFor(chestId, r).map((p) => (p.kind === "item" ? p.item.name : `${p.amount.toLocaleString("vi-VN")} ${p.kind === "xu" ? "xu" : "ngọc"}`)),
  }));
}
