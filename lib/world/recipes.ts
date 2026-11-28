/**
 * G4 — Công thức chế tạo (khai báo, mã ổn định) theo bậc 0–1 của nghiên cứu Terraria: tay không → Bàn Dã chiến.
 * Chế tạo là MỘT giao dịch: kiểm đủ nguyên liệu VÀ đủ chỗ cho thành phẩm rồi mới đổi túi (túi đầy không làm mất nguyên liệu).
 * Móc toán: mỗi công thức là một TỈ LỆ (a : b); làm ×k thì nhân cả hai vế; số lần tối đa = min ⌊có / cần⌋.
 */
import { addItem, countItem, removeItem, type Inv, type Slot } from "./inventory";
import type { L } from "./i18n";

/** hand < bench < press (Máy Ép Hoa văn = Bàn Dã chiến + vật phẩm pattern_press trong túi) */
export type Station = "hand" | "bench" | "press";
const RANK: Record<Station, number> = { hand: 0, bench: 1, press: 2 };

export interface Recipe {
  id: string;
  station: Station;
  in: [string, number][];
  out: [string, number];
  /** câu chuyện toán ngắn hiện cạnh công thức */
  idea: L;
}

export const RECIPES: Recipe[] = [
  {
    id: "plank",
    station: "hand",
    in: [["wood", 1]],
    out: ["plank", 4],
    idea: { vi: "Tỉ lệ 1 : 4 — một khúc gỗ xẻ được 4 tấm ván", en: "Ratio 1 : 4 — one log splits into 4 planks" },
  },
  {
    id: "bench",
    station: "hand",
    in: [["plank", 4]],
    out: ["bench", 1],
    idea: { vi: "2 × 2 = 4 tấm ván ghép thành mặt bàn vuông", en: "2 × 2 = 4 planks make a square table top" },
  },
  {
    id: "torch",
    station: "hand",
    in: [["crystal", 1], ["plank", 1]],
    out: ["torch", 4],
    idea: { vi: "1 pha lê + 1 ván → 4 đuốc: mỗi đuốc tốn ¼ pha lê", en: "1 crystal + 1 plank → 4 torches: each torch costs ¼ crystal" },
  },
  {
    id: "torch_int",
    station: "hand",
    in: [["int_crystal", 1], ["plank", 1]],
    out: ["torch", 4],
    idea: { vi: "Cách thứ hai ra cùng kết quả: thay pha lê bằng Tinh thể Số nguyên", en: "A second route to the same result: swap the crystal for an Integer Crystal" },
  },
  {
    id: "axis_pick",
    station: "bench",
    in: [["int_crystal", 2], ["wood", 1]],
    out: ["axis_pick", 1],
    idea: { vi: "Cuốc Trục: hai tinh thể là hai trục x và z của mặt đất", en: "Axis Pick: the two crystals are the ground axes x and z" },
  },
  {
    id: "ratio_pick",
    station: "bench",
    in: [["ratio_copper", 3], ["plank", 2]],
    out: ["ratio_pick", 1],
    idea: { vi: "Đồng : ván = 3 : 2 — đào đá nhanh gấp 6 tay không", en: "Copper : plank = 3 : 2 — mines stone 6× faster than bare hands" },
  },
  {
    id: "survey_key",
    station: "bench",
    in: [["ratio_copper", 2], ["int_crystal", 1]],
    out: ["survey_key", 1],
    idea: { vi: "Tỉ lệ 2 : 1 — chìa mở cổng vòm khảo sát", en: "Ratio 2 : 1 — the key to the survey arch" },
  },
  {
    id: "brick",
    station: "bench",
    in: [["stone", 4]],
    out: ["ruin", 4],
    idea: { vi: "Lát 2 × 2: 4 khối đá thành 4 viên gạch (tỉ lệ 1 : 1)", en: "A 2 × 2 tile: 4 stones become 4 bricks (ratio 1 : 1)" },
  },
  {
    id: "glass",
    station: "bench",
    in: [["sand", 4], ["crystal", 1]],
    out: ["glass", 4],
    idea: { vi: "Cát : pha lê : kính = 4 : 1 : 4", en: "Sand : crystal : glass = 4 : 1 : 4" },
  },
  // ── Bậc 2 (BOSSES.md): Kẻ Khảo sát Gấp → Máy Ép Hoa văn; Đêm Đèn lồng → Lụa Pha; Sổ Mưa → Hổ phách ──
  {
    id: "pattern_press",
    station: "bench",
    in: [["mirror_shard", 3], ["ratio_copper", 1]],
    out: ["pattern_press", 1],
    idea: { vi: "Máy ép lặp lại một hoa văn qua gương: 3 mảnh gương : 1 đồng", en: "A press repeats a pattern through mirrors: 3 shards : 1 copper" },
  },
  {
    id: "draw_token",
    station: "press",
    in: [["phase_silk", 2], ["mirror_shard", 1], ["int_crystal", 1]],
    out: ["draw_token", 1],
    idea: { vi: "Thẻ Rút: xác suất một làn = số hạt của làn ÷ tổng số hạt", en: "Draw Token: a lane's chance = its beads ÷ all beads" },
  },
  {
    id: "lantern_torch",
    station: "press",
    in: [["phase_silk", 1], ["plank", 1]],
    out: ["torch", 6],
    idea: { vi: "1 lụa → 6 đuốc, rẻ hơn 1 pha lê → 4 đuốc: so 1 : 6 với 1 : 4", en: "1 silk → 6 torches beats 1 crystal → 4: compare 1 : 6 with 1 : 4" },
  },
  {
    id: "mirror_glass",
    station: "press",
    in: [["sand", 4], ["mirror_shard", 1]],
    out: ["glass", 8],
    idea: { vi: "Gương nhân đôi: 4 cát → 8 kính (gấp đôi công thức ở bàn 4 → 4)", en: "A mirror doubles it: 4 sand → 8 glass (twice the bench's 4 → 4)" },
  },
  {
    id: "amber_pick",
    station: "press",
    in: [["chance_amber", 3], ["ratio_pick", 1]],
    out: ["amber_pick", 1],
    idea: { vi: "Nâng Cuốc Tỉ lệ: đá nhanh gấp 6 → gấp 9 (tăng 50 %)", en: "Upgrade the Ratio Pick: stone 6× → 9× faster (50 % more)" },
  },
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Công thức dùng được ở trạm (bàn làm được cả công thức tay không) */
export const recipeAvailable = (r: Recipe, station: Station) => RANK[r.station] <= RANK[station];

/** Số lần làm tối đa theo nguyên liệu = min ⌊có / cần⌋ (chưa xét chỗ trống) */
export function maxCraft(inv: Inv, r: Recipe): number {
  let m = Infinity;
  for (const [id, n] of r.in) m = Math.min(m, Math.floor(countItem(inv, id) / n));
  return m === Infinity ? 0 : m;
}

export type CraftResult = { ok: true; inv: Slot[] } | { ok: false; reason: "station" | "missing" | "full" | "times" };

/** Làm `times` lần — nguyên tử: thiếu nguyên liệu / không đủ chỗ → không đổi gì */
export function craft(inv: Inv, r: Recipe, times: number, station: Station): CraftResult {
  if (!recipeAvailable(r, station)) return { ok: false, reason: "station" };
  if (!Number.isInteger(times) || times < 1) return { ok: false, reason: "times" };
  let cur: Slot[] | null = inv.slice() as Slot[];
  for (const [id, n] of r.in) {
    cur = removeItem(cur, id, n * times);
    if (!cur) return { ok: false, reason: "missing" };
  }
  const want = r.out[1] * times;
  const { inv: next, added } = addItem(cur, r.out[0], want);
  if (added < want) return { ok: false, reason: "full" };
  return { ok: true, inv: next };
}
