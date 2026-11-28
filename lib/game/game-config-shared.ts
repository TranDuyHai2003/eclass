/**
 * Cấu hình game admin sửa được (26/11/2026): giá thú cưng / khung viền / bảng tên và mức xu các hoạt động.
 * Thuần (không Prisma) → dùng được ở client. Lưu DB ở bảng GameConfig (lib/game/game-config.ts đọc, cache, áp).
 * Áp bằng cách ghi đè giá trong ITEM_BY_ID và hằng POINTS (giữ bản gốc để "Về mặc định") — mọi chỗ đang đọc
 * item.price / POINTS.* tự dùng giá mới; server và client áp cùng một cấu hình nên không lệch khi hydrate.
 * PLAN: docs/ai-reviews/game-config/PLAN.md
 */
import { ITEMS, ITEM_BY_ID, type Item } from "./items";
import { CHESTS } from "./gacha-shared";
import { POINTS } from "@/lib/points/config";

/* ============================== Giá đồ trang trí ============================== */

export { VND_PER_XU, vndToXu } from "@/lib/points/vnd";
import { vndToXu } from "@/lib/points/vnd";

/** "20000", "20.000", "20k", "1,5tr" → số đồng */
export function parseVnd(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/đ|vnd/g, "");
  if (!t) return null;
  const m = t.match(/^([\d.,]+)(k|tr|m)?$/);
  if (!m) return null;
  const unit = m[2] === "k" ? 1000 : m[2] === "tr" || m[2] === "m" ? 1_000_000 : 1;
  // Có đơn vị → dấu phẩy / chấm là phần thập phân (1,5tr); không có → là dấu nghìn (20.000)
  const num = unit === 1 ? Number(m[1].replace(/[.,]/g, "")) : Number(m[1].replace(",", "."));
  return Number.isFinite(num) ? Math.round(num * unit) : null;
}

export type ItemPrice = { xu: number; vnd?: number } | { gem: number };
export type ItemPrices = Record<string, ItemPrice>;

const BASE_PRICE = new Map<string, Item["price"]>(ITEMS.map((i) => [i.id, i.price]));
export const basePriceOf = (id: string) => BASE_PRICE.get(id);

/**
 * Món admin sửa giá được: MỌI đồ trang trí đang bán bằng xu / kim cương (28/11: thầy muốn sửa cả tóc, áo, phụ kiện…
 * chứ không chỉ thú cưng / khung / bảng tên). Không sửa món chỉ có từ rương / nhiệm vụ / miễn phí.
 */
export const isPriceEditable = (it: Item | undefined): it is Item => !!it && !!BASE_PRICE.get(it.id) && !it.gachaOnly && !it.quest && !it.free;
export const PRICE_EDITABLE_ITEMS = ITEMS.filter(isPriceEditable);

export const PRICE_LIMITS = { xuMax: 1_000_000, gemMax: 999, vndMin: 1_000, vndMax: 10_000_000 } as const;

/** Kiểm tra bảng giá gửi lên: bỏ món không sửa được; lỗi nếu số không hợp lệ */
export function normalizeItemPrices(input: unknown): { data: ItemPrices } | { error: string } {
  if (!input || typeof input !== "object") return { data: {} };
  const out: ItemPrices = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const it = ITEM_BY_ID[id];
    if (!isPriceEditable(it)) return { error: `Món "${id}" không sửa giá được.` };
    const p = (raw ?? {}) as { xu?: unknown; gem?: unknown; vnd?: unknown };
    if (p.gem !== undefined && p.gem !== null) {
      const gem = Math.floor(Number(p.gem));
      if (!Number.isFinite(gem) || gem < 1 || gem > PRICE_LIMITS.gemMax) return { error: `Giá kim cương của "${it.name}" phải từ 1 đến ${PRICE_LIMITS.gemMax}.` };
      out[id] = { gem };
      continue;
    }
    if (p.vnd !== undefined && p.vnd !== null) {
      const vnd = Math.floor(Number(p.vnd));
      if (!Number.isFinite(vnd) || vnd < PRICE_LIMITS.vndMin || vnd > PRICE_LIMITS.vndMax)
        return { error: `Giá tiền thật của "${it.name}" phải từ ${PRICE_LIMITS.vndMin.toLocaleString("vi-VN")}đ đến ${PRICE_LIMITS.vndMax.toLocaleString("vi-VN")}đ.` };
      // Xu luôn tính lại từ tiền thật ở server (không tin số xu client gửi)
      out[id] = { xu: vndToXu(vnd), vnd };
      continue;
    }
    const xu = Math.floor(Number(p.xu));
    if (!Number.isFinite(xu) || xu < 0 || xu > PRICE_LIMITS.xuMax) return { error: `Giá xu của "${it.name}" không hợp lệ.` };
    out[id] = { xu };
  }
  return { data: out };
}

/* ============================== Mức xu các hoạt động ============================== */

type MutablePoints = {
  testSubmit: number; testSubmitLate: number; onTimeBonus: number;
  scoreTiers: { min: number; points: number }[];
  breakthrough: { points: number };
  finalTestSubmit: number; finalScoreMultiplier: number;
  homeworkSubmit: number; homeworkPass: number; dailyAutoCap: number;
  homeworkReview: { partial: number; full: number };
  streak: { milestones: Record<number, number>; every4WeeksAfter12: number };
  manual: { maxPerGrant: number; dailyCapPerStudent: number };
};
const P = POINTS as unknown as MutablePoints;

export interface EarningField {
  key: string;
  label: string;
  group: string;
  hint?: string;
  min: number;
  max: number;
  get: () => number;
  set: (v: number) => void;
}
const tier = (i: number) => ({ get: () => P.scoreTiers[i].points, set: (v: number) => (P.scoreTiers[i].points = v) });
const ms = (w: number) => ({ get: () => P.streak.milestones[w], set: (v: number) => (P.streak.milestones[w] = v) });

export const EARNING_FIELDS: EarningField[] = [
  { key: "homeworkSubmit", group: "Bài tập về nhà", label: "Làm / nộp BTVN đúng hạn (lần đầu)", min: 0, max: 100_000, get: () => P.homeworkSubmit, set: (v) => (P.homeworkSubmit = v) },
  { key: "reviewPartial", group: "Bài tập về nhà", label: "Thầy duyệt: Có chữa", min: 0, max: 100_000, get: () => P.homeworkReview.partial, set: (v) => (P.homeworkReview.partial = v) },
  { key: "reviewFull", group: "Bài tập về nhà", label: "Thầy duyệt: Chữa đủ, tốt", min: 0, max: 100_000, get: () => P.homeworkReview.full, set: (v) => (P.homeworkReview.full = v) },
  { key: "homeworkPass", group: "Bài tập về nhà", label: "Bài nộp online được chấm Đạt", min: 0, max: 100_000, get: () => P.homeworkPass, set: (v) => (P.homeworkPass = v) },
  { key: "testSubmit", group: "Bài kiểm tra", label: "Nộp bài (đúng / chưa có hạn)", min: 0, max: 100_000, get: () => P.testSubmit, set: (v) => (P.testSubmit = v) },
  { key: "testSubmitLate", group: "Bài kiểm tra", label: "Nộp sau hạn", min: 0, max: 100_000, get: () => P.testSubmitLate, set: (v) => (P.testSubmitLate = v) },
  { key: "onTimeBonus", group: "Bài kiểm tra", label: "Thưởng nộp đúng hạn", min: 0, max: 100_000, get: () => P.onTimeBonus, set: (v) => (P.onTimeBonus = v) },
  { key: "score10", group: "Điểm cao", label: "Điểm 10", min: 0, max: 100_000, ...tier(0) },
  { key: "score85", group: "Điểm cao", label: "Điểm từ 8,5", min: 0, max: 100_000, ...tier(1) },
  { key: "score7", group: "Điểm cao", label: "Điểm từ 7", min: 0, max: 100_000, ...tier(2) },
  { key: "breakthrough", group: "Điểm cao", label: "Bứt phá (cao hơn trung bình 5 bài gần nhất)", min: 0, max: 100_000, get: () => P.breakthrough.points, set: (v) => (P.breakthrough.points = v) },
  { key: "finalTestSubmit", group: "Thi cuối khoá", label: "Nộp đề thi cuối khoá", min: 0, max: 100_000, get: () => P.finalTestSubmit, set: (v) => (P.finalTestSubmit = v) },
  { key: "finalScoreMultiplier", group: "Thi cuối khoá", label: "Hệ số thưởng điểm cao (×)", hint: "1–5", min: 1, max: 5, get: () => P.finalScoreMultiplier, set: (v) => (P.finalScoreMultiplier = v) },
  { key: "streak2", group: "Chuỗi tuần học", label: "Mốc 2 tuần", min: 0, max: 100_000, ...ms(2) },
  { key: "streak4", group: "Chuỗi tuần học", label: "Mốc 4 tuần", min: 0, max: 100_000, ...ms(4) },
  { key: "streak8", group: "Chuỗi tuần học", label: "Mốc 8 tuần", min: 0, max: 100_000, ...ms(8) },
  { key: "streak12", group: "Chuỗi tuần học", label: "Mốc 12 tuần", min: 0, max: 100_000, ...ms(12) },
  { key: "streakEvery4", group: "Chuỗi tuần học", label: "Sau 12 tuần, mỗi 4 tuần", min: 0, max: 100_000, get: () => P.streak.every4WeeksAfter12, set: (v) => (P.streak.every4WeeksAfter12 = v) },
  { key: "dailyAutoCap", group: "Giới hạn", label: "Tối đa xu tự động mỗi ngày", min: 0, max: 1_000_000, get: () => P.dailyAutoCap, set: (v) => (P.dailyAutoCap = v) },
  { key: "manualMax", group: "Giới hạn", label: "Thầy thưởng tối đa mỗi lần", min: 0, max: 100_000, get: () => P.manual.maxPerGrant, set: (v) => (P.manual.maxPerGrant = v) },
  { key: "manualDaily", group: "Giới hạn", label: "Thầy thưởng tối đa / học sinh / ngày", min: 0, max: 1_000_000, get: () => P.manual.dailyCapPerStudent, set: (v) => (P.manual.dailyCapPerStudent = v) },
];
const FIELD_BY_KEY = new Map(EARNING_FIELDS.map((f) => [f.key, f]));
/** Giá trị gốc trong code (chụp lúc nạp module, trước khi áp cấu hình) */
export const EARNING_DEFAULTS: Record<string, number> = Object.fromEntries(EARNING_FIELDS.map((f) => [f.key, f.get()]));

export type EarningConfig = Record<string, number>;

export function normalizeEarning(input: unknown): { data: EarningConfig } | { error: string } {
  if (!input || typeof input !== "object") return { data: {} };
  const out: EarningConfig = {};
  for (const [k, raw] of Object.entries(input as Record<string, unknown>)) {
    const f = FIELD_BY_KEY.get(k);
    if (!f) return { error: `Mục "${k}" không sửa được.` };
    if (raw === null || raw === undefined || raw === "") continue; // bỏ trống = dùng mặc định
    const v = Math.floor(Number(raw));
    if (!Number.isFinite(v) || v < f.min || v > f.max) return { error: `"${f.label}" phải từ ${f.min.toLocaleString("vi-VN")} đến ${f.max.toLocaleString("vi-VN")}.` };
    if (v !== EARNING_DEFAULTS[k]) out[k] = v;
  }
  return { data: out };
}

/* ============================== Áp cấu hình ============================== */

/* ============================== Giá rương ============================== */

/**
 * Giá mở rương + số lượt Rương Xu mỗi ngày (28/11: thầy muốn sửa giá gacha). Rương Xu tối thiểu 500 xu:
 * kể cả khi đã có đủ bộ đồ, mỗi lượt trả lại trung bình ~430 xu (tests/game/gacha.test.ts) → giá thấp hơn sẽ thành máy in xu.
 */
export type ChestConfig = { xu?: { cost?: number; dailyLimit?: number }; gem?: { cost?: number } };
export const CHEST_LIMITS = { xuMin: 500, xuMax: 100_000, dailyMin: 1, dailyMax: 20, gemMin: 1, gemMax: 99 } as const;
const BASE_CHEST = {
  xuCost: (CHESTS.xu.cost as { xu: number }).xu,
  xuDaily: CHESTS.xu.dailyLimit ?? 3,
  gemCost: (CHESTS.gem.cost as { gem: number }).gem,
};
export const CHEST_DEFAULTS = { xu: { cost: BASE_CHEST.xuCost, dailyLimit: BASE_CHEST.xuDaily }, gem: { cost: BASE_CHEST.gemCost } } as const;

export function normalizeChestConfig(input: unknown): { data: ChestConfig } | { error: string } {
  const src = (input && typeof input === "object" ? input : {}) as { xu?: Record<string, unknown>; gem?: Record<string, unknown> };
  const out: ChestConfig = {};
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Math.floor(Number(v)));
  const xuCost = num(src.xu?.cost);
  const daily = num(src.xu?.dailyLimit);
  const gemCost = num(src.gem?.cost);
  if (xuCost !== undefined) {
    if (!Number.isFinite(xuCost) || xuCost < CHEST_LIMITS.xuMin || xuCost > CHEST_LIMITS.xuMax)
      return { error: `Giá Rương Xu phải từ ${CHEST_LIMITS.xuMin.toLocaleString("vi-VN")} đến ${CHEST_LIMITS.xuMax.toLocaleString("vi-VN")} xu.` };
    if (xuCost !== BASE_CHEST.xuCost) out.xu = { ...out.xu, cost: xuCost };
  }
  if (daily !== undefined) {
    if (!Number.isFinite(daily) || daily < CHEST_LIMITS.dailyMin || daily > CHEST_LIMITS.dailyMax) return { error: `Lượt Rương Xu mỗi ngày từ ${CHEST_LIMITS.dailyMin} đến ${CHEST_LIMITS.dailyMax}.` };
    if (daily !== BASE_CHEST.xuDaily) out.xu = { ...out.xu, dailyLimit: daily };
  }
  if (gemCost !== undefined) {
    if (!Number.isFinite(gemCost) || gemCost < CHEST_LIMITS.gemMin || gemCost > CHEST_LIMITS.gemMax) return { error: `Giá Rương Ngọc phải từ ${CHEST_LIMITS.gemMin} đến ${CHEST_LIMITS.gemMax} ngọc.` };
    if (gemCost !== BASE_CHEST.gemCost) out.gem = { cost: gemCost };
  }
  return { data: out };
}

export type GameConfigData = { itemPrices: ItemPrices; earning: EarningConfig; chests?: ChestConfig };
export const EMPTY_GAME_CONFIG: GameConfigData = { itemPrices: {}, earning: {}, chests: {} };

let appliedSig: string | null = null;

/** Ghi đè giá đồ + mức xu theo cấu hình (món / mục không có trong cấu hình → về mặc định). Gọi lại với cùng cấu hình thì bỏ qua. */
export function applyGameConfig(cfg: GameConfigData | null | undefined) {
  const c = cfg ?? EMPTY_GAME_CONFIG;
  const sig = JSON.stringify(c);
  if (sig === appliedSig) return;
  appliedSig = sig;
  for (const it of PRICE_EDITABLE_ITEMS) {
    const o = c.itemPrices?.[it.id];
    it.price = o ? ("gem" in o ? { gem: o.gem } : { xu: o.xu }) : BASE_PRICE.get(it.id);
  }
  for (const f of EARNING_FIELDS) {
    const v = c.earning?.[f.key];
    f.set(typeof v === "number" ? v : EARNING_DEFAULTS[f.key]);
  }
  const ch = c.chests ?? {};
  CHESTS.xu.cost = { xu: ch.xu?.cost ?? BASE_CHEST.xuCost };
  CHESTS.xu.dailyLimit = ch.xu?.dailyLimit ?? BASE_CHEST.xuDaily;
  CHESTS.gem.cost = { gem: ch.gem?.cost ?? BASE_CHEST.gemCost };
}
