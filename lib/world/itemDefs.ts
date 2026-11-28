/**
 * G4 — Vật phẩm của Vùng Kỳ quan (khối, nguyên liệu toán, dụng cụ). Thuần (không React / three) → test được.
 * Mã vật phẩm là CHUỖI ỔN ĐỊNH (lưu trong túi đồ / IndexedDB): chỉ thêm, không đổi tên. Chỉ số trong ITEM_IDS chỉ dùng
 * trong bộ nhớ (thực thể rơi dùng mảng số) — không lưu.
 */
import { B } from "./blocks";
import type { L } from "./i18n";

export type ItemKind = "block" | "material" | "tool";
/** Nhóm vật liệu khối — dụng cụ tăng tốc theo nhóm */
export type BlockClass = "soil" | "wood" | "stone" | "plant" | "misc";

export interface ToolDef {
  /** cấp đào: 0 = tay không, 1 = Cuốc Trục, 2 = Cuốc Tỉ lệ */
  tier: number;
  /** hệ số tốc độ theo nhóm khối (thiếu = 1) */
  speed: Partial<Record<BlockClass, number>>;
}

export interface ItemDef {
  id: string;
  name: L;
  kind: ItemKind;
  /** khối đặt ra (nếu là vật phẩm khối) */
  block?: number;
  stack: number;
  /** màu hiển thị (ô túi đồ, thực thể rơi) */
  color: string;
  tool?: ToolDef;
  /** gợi ý toán / nguồn gốc (hiện trong bảng chế tạo) */
  note?: L;
}

const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

const blockItem = (id: string, block: number, vi: string, en: string, c: [number, number, number]): ItemDef => ({
  id,
  block,
  name: { vi, en },
  kind: "block",
  stack: 64,
  color: rgb(...c),
});

export const ITEMS: Record<string, ItemDef> = {};
const add = (d: ItemDef) => (ITEMS[d.id] = d);

// Khối (màu khớp BLOCK_RGB mặt trên — lib/world/voxels.ts)
add(blockItem("grass", B.grass, "Khối cỏ", "Grass block", [0.42, 0.72, 0.36]));
add(blockItem("dirt", B.dirt, "Đất", "Dirt", [0.58, 0.42, 0.3]));
add(blockItem("stone", B.stone, "Đá", "Stone", [0.62, 0.62, 0.68]));
add(blockItem("sand", B.sand, "Cát", "Sand", [0.9, 0.84, 0.62]));
add(blockItem("snow", B.snow, "Tuyết", "Snow", [0.9, 0.92, 0.96]));
add(blockItem("crystal", B.crystal, "Pha lê sáng", "Glow crystal", [0.55, 0.88, 1]));
add(blockItem("gold", B.gold, "Vàng", "Gold", [1, 0.84, 0.42]));
add(blockItem("wood", B.wood, "Gỗ", "Wood", [0.72, 0.55, 0.36]));
add(blockItem("leaf", B.leaf, "Lá", "Leaves", [0.38, 0.66, 0.38]));
add(blockItem("glass", B.glass, "Kính", "Glass", [0.72, 0.93, 0.96]));
add(blockItem("blossom", B.blossom, "Tán anh đào", "Blossom", [0.98, 0.72, 0.84]));
add(blockItem("pine", B.pine, "Lá kim", "Pine needles", [0.24, 0.5, 0.46]));
add(blockItem("plank", B.plank, "Ván", "Plank", [0.86, 0.68, 0.44]));
add(blockItem("ruin", B.ruin, "Gạch đá", "Stone brick", [0.78, 0.74, 0.66]));
add(blockItem("moss", B.moss, "Gạch rêu", "Mossy brick", [0.5, 0.66, 0.42]));
add(blockItem("rope", B.rope, "Dây", "Rope", [0.9, 0.42, 0.36]));
add(blockItem("torch", B.torch, "Đuốc", "Torch", [1, 0.86, 0.5]));
add(blockItem("bench", B.bench, "Bàn Dã chiến", "Field Bench", [0.86, 0.7, 0.46]));
add(blockItem("water", B.water, "Nguồn nước", "Water source", [0.37, 0.72, 0.9]));
ITEMS.torch.note = { vi: "Nguồn sáng: soi sáng 14 ô quanh nó trong hang", en: "Light source: lights up 14 cells around it in caves" };
ITEMS.bench.note = { vi: "Trạm chế tạo: đặt xuống, chuột phải để mở", en: "Crafting station: place it, right-click to open" };
ITEMS.water.note = { vi: "Chảy xuống trước, rồi lan ngang tối đa 7 ô (mỗi ô giảm 1 mức)", en: "Falls first, then spreads up to 7 cells sideways (one level less per cell)" };

// Nguyên liệu toán (Terraria tier 0–1)
add({
  id: "int_crystal",
  name: { vi: "Tinh thể Số nguyên", en: "Integer Crystal" },
  kind: "material",
  stack: 64,
  color: rgb(0.7, 0.58, 1),
  note: { vi: "Mỏ tím trên mặt đất và vách hang — đào tay được", en: "Violet nodes on the surface and cave walls — mine by hand" },
});
add({
  id: "ratio_copper",
  name: { vi: "Đồng Tỉ lệ", en: "Ratio Copper" },
  kind: "material",
  stack: 64,
  color: rgb(0.9, 0.56, 0.34),
  note: { vi: "Mỏ cam trong hang và trên đồi đá — cần Cuốc Trục", en: "Orange ore in caves and rocky hills — needs an Axis Pick" },
});
add({
  id: "survey_key",
  name: { vi: "Chìa Khảo sát", en: "Survey Key" },
  kind: "material",
  stack: 16,
  color: rgb(0.98, 0.82, 0.4),
  note: { vi: "Chuột phải ban đêm, hoặc chuột phải lên Bàn Dã chiến → triệu hồi Kẻ Khảo sát Gấp (chìa không mất)", en: "Right-click at night, or right-click a Field Bench → summons the Foldback Surveyor (the key is kept)" },
});

// Bậc 2 — từ boss / sự kiện (docs/ai-reviews/voxel-world/BOSSES.md). Mã ổn định: chỉ thêm, không đổi tên.
add({
  id: "mirror_shard",
  name: { vi: "Mảnh Gương Gấp", en: "Fold Mirror Shard" },
  kind: "material",
  stack: 64,
  color: rgb(0.78, 0.9, 1),
  note: { vi: "Rơi từ Kẻ Khảo sát Gấp — mỗi mảnh giữ một nửa của một phép đối xứng", en: "Dropped by the Foldback Surveyor — each shard holds half of a reflection" },
});
add({
  id: "survey_lens",
  name: { vi: "Thấu kính Khảo sát", en: "Survey Lens" },
  kind: "material",
  stack: 16,
  color: rgb(0.62, 0.95, 0.9),
  note: { vi: "Phần thưởng hạ Kẻ Khảo sát Gấp — nguyên liệu bậc 2", en: "Reward for defeating the Foldback Surveyor — a tier-2 ingredient" },
});
add({
  id: "phase_silk",
  name: { vi: "Lụa Pha", en: "Phase Silk" },
  kind: "material",
  stack: 64,
  color: rgb(1, 0.78, 0.5),
  note: { vi: "Từ Đêm Đèn lồng: dệt bởi Bướm Chu kỳ bay đúng nhịp", en: "From Lantern Night: woven by Period Moths flying in rhythm" },
});
add({
  id: "pattern_press",
  name: { vi: "Máy Ép Hoa văn", en: "Pattern Press" },
  kind: "material",
  stack: 1,
  color: rgb(0.85, 0.75, 1),
  note: { vi: "Giữ trong túi và đứng cạnh Bàn Dã chiến → mở các công thức bậc 2", en: "Keep it in your bag and stand by a Field Bench → unlocks tier-2 recipes" },
});
add({
  id: "draw_token",
  name: { vi: "Thẻ Rút", en: "Draw Token" },
  kind: "material",
  stack: 16,
  color: rgb(0.55, 0.75, 1),
  note: { vi: "Chuột phải ở ngoài trời → triệu hồi Sổ Mưa (thẻ không mất)", en: "Right-click outdoors → summons the Rain Ledger (the token is kept)" },
});
add({
  id: "chance_amber",
  name: { vi: "Hổ phách May rủi", en: "Chance Amber" },
  kind: "material",
  stack: 64,
  color: rgb(1, 0.66, 0.24),
  note: { vi: "Rơi từ Sổ Mưa — trong mỗi viên có một hạt bị rút", en: "Dropped by the Rain Ledger — each one holds a drawn bead" },
});
add({
  id: "observatory_seal",
  name: { vi: "Ấn Đài Quan sát", en: "Observatory Seal" },
  kind: "material",
  stack: 16,
  color: rgb(0.7, 0.66, 1),
  note: { vi: "Hạ Sổ Mưa — chìa của bậc 4 (Đèn lồng Thứ tư, sắp có)", en: "From the Rain Ledger — the key to tier 4 (Fourth Lantern, coming soon)" },
});

// Dụng cụ
add({
  id: "axis_pick",
  name: { vi: "Cuốc Trục", en: "Axis Pick" },
  kind: "tool",
  stack: 1,
  color: rgb(0.6, 0.5, 0.98),
  tool: { tier: 1, speed: { stone: 4, wood: 2, soil: 2 } },
  note: { vi: "Đào đá và Đồng Tỉ lệ; nhanh gấp 4 với đá", en: "Mines stone and Ratio Copper; 4× faster on stone" },
});
add({
  id: "ratio_pick",
  name: { vi: "Cuốc Tỉ lệ", en: "Ratio Pick" },
  kind: "tool",
  stack: 1,
  color: rgb(0.92, 0.5, 0.3),
  tool: { tier: 2, speed: { stone: 6, wood: 3, soil: 3 } },
  note: { vi: "Nhanh gấp 6 với đá", en: "6× faster on stone" },
});
add({
  id: "amber_pick",
  name: { vi: "Cuốc Hổ phách", en: "Amber Pick" },
  kind: "tool",
  stack: 1,
  color: rgb(1, 0.62, 0.22),
  tool: { tier: 3, speed: { stone: 9, wood: 4, soil: 4 } },
  note: { vi: "Nhanh gấp 9 với đá", en: "9× faster on stone" },
});

/** Thứ tự ổn định (bảng sáng tạo, chỉ số số học cho thực thể rơi) */
export const ITEM_IDS: string[] = Object.keys(ITEMS);
export const ITEM_INDEX: Record<string, number> = Object.fromEntries(ITEM_IDS.map((id, i) => [id, i]));
export const isItem = (id: unknown): id is string => typeof id === "string" && id in ITEMS;
/** Vật phẩm khối theo id khối (khối không có vật phẩm → undefined) */
export const ITEM_OF_BLOCK: Record<number, string> = {};
for (const d of ITEM_IDS.map((i) => ITEMS[i])) if (d.block !== undefined) ITEM_OF_BLOCK[d.block] = d.id;
