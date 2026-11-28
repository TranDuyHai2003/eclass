import { test } from "node:test";
import assert from "node:assert/strict";
import { B, BLOCKS } from "@/lib/world/blocks";
import { ITEMS, ITEM_IDS, ITEM_INDEX, ITEM_OF_BLOCK } from "@/lib/world/itemDefs";
import { HOTBAR, INV_SIZE, addItem, countItem, emptyInv, moveStack, quickMove, removeItem, roomFor, sanitizeInv, takeFromSlot, type Slot } from "@/lib/world/inventory";
import { RECIPES, RECIPE_BY_ID, craft, maxCraft } from "@/lib/world/recipes";
import { BLOCK_RULES, MiningProgress, breakTime, canHarvest, cellHitsBody, dropFor, raycastInto } from "@/lib/world/mining";
import { DropPool } from "@/lib/world/dropSim";
import { BLOCK_RGB } from "@/lib/world/voxels";

const total = (inv: readonly Slot[]) => inv.reduce((s, x) => s + (x ? x.n : 0), 0);

// ───────────── Vật phẩm ─────────────
test("vật phẩm: mọi khối (trừ không khí) có luật đào + màu + vật phẩm; mọi công thức dùng mã có thật", () => {
  for (let id = 1; id < BLOCKS.length; id++) {
    assert.ok(BLOCK_RULES[id], `thiếu luật đào cho ${BLOCKS[id]}`);
    assert.ok(BLOCK_RGB[id], `thiếu màu cho ${BLOCKS[id]}`);
    assert.ok(ITEM_OF_BLOCK[id] || BLOCK_RULES[id].drop, `thiếu vật phẩm / đồ rơi cho ${BLOCKS[id]}`);
  }
  for (const r of RECIPES) {
    for (const [id, n] of r.in) assert.ok(ITEMS[id] && n > 0, `${r.id}: ${id}`);
    assert.ok(ITEMS[r.out[0]] && r.out[1] > 0, r.id);
  }
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, "trùng mã công thức");
  assert.equal(ITEM_IDS.length, new Set(ITEM_IDS).size);
  for (const id of ITEM_IDS) assert.equal(ITEM_IDS[ITEM_INDEX[id]], id);
  // mã ổn định — đổi tên là mất đồ đã lưu
  for (const id of ["dirt", "stone", "wood", "plank", "torch", "bench", "int_crystal", "ratio_copper", "axis_pick", "ratio_pick"]) assert.ok(ITEMS[id], id);
});

// ───────────── Túi đồ ─────────────
test("túi đồ: thêm lấp chồng cũ trước, rồi ô trống đầu tiên; đầy thì nhận một phần; không sửa mảng gốc", () => {
  const inv0 = emptyInv();
  const a = addItem(inv0, "dirt", 70);
  assert.equal(a.added, 70);
  assert.deepEqual(a.inv.slice(0, 3), [{ id: "dirt", n: 64 }, { id: "dirt", n: 6 }, null]);
  assert.equal(total(inv0), 0, "mảng gốc bị sửa");
  const b = addItem(a.inv, "dirt", 60);
  assert.deepEqual(b.inv[1], { id: "dirt", n: 64 });
  assert.deepEqual(b.inv[2], { id: "dirt", n: 2 });
  // túi gần đầy: chỉ còn 10 chỗ cho đá
  const full = emptyInv().map((_, i) => (i === 5 ? { id: "stone", n: 54 } : { id: "wood", n: 64 }));
  assert.equal(roomFor(full, "stone"), 10);
  assert.equal(roomFor(full, "dirt"), 0);
  const c = addItem(full, "stone", 25);
  assert.equal(c.added, 10);
  assert.equal(countItem(c.inv, "stone"), 64);
  // dụng cụ không chồng
  const t = addItem(emptyInv(), "axis_pick", 2);
  assert.deepEqual(t.inv.slice(0, 2), [{ id: "axis_pick", n: 1 }, { id: "axis_pick", n: 1 }]);
  assert.equal(addItem(emptyInv(), "không-có", 3).added, 0);
});

test("túi đồ: bớt nguyên tử (không đủ → null), lấy từ ô, gộp / đổi chỗ, chuyển nhanh — tổng số vật phẩm bảo toàn", () => {
  let inv = addItem(emptyInv(), "plank", 10).inv;
  inv = addItem(inv, "wood", 3).inv;
  assert.equal(removeItem(inv, "plank", 11), null);
  const r = removeItem(inv, "plank", 4)!;
  assert.equal(countItem(r, "plank"), 6);
  assert.equal(countItem(inv, "plank"), 10, "mảng gốc bị sửa");
  const tk = takeFromSlot(inv, 1, 1)!;
  assert.deepEqual(tk.stack, { id: "wood", n: 1 });
  assert.deepEqual(tk.inv[1], { id: "wood", n: 2 });
  assert.equal(takeFromSlot(inv, 7, 1), null);
  assert.equal(takeFromSlot(inv, 1, 4), null);
  // gộp: 60 + 10 ván → 64 ở đích, 6 ở lại
  let g: Slot[] = emptyInv();
  g[0] = { id: "plank", n: 10 };
  g[3] = { id: "plank", n: 60 };
  g = moveStack(g, 0, 3);
  assert.deepEqual([g[0], g[3]], [{ id: "plank", n: 6 }, { id: "plank", n: 64 }]);
  // khác loại → đổi chỗ
  g[4] = { id: "stone", n: 2 };
  const s = moveStack(g, 3, 4);
  assert.deepEqual([s[3], s[4]], [{ id: "stone", n: 2 }, { id: "plank", n: 64 }]);
  // chuyển nhanh thanh nhanh → túi
  const q = quickMove(s, 4);
  assert.equal(q[4], null);
  assert.deepEqual(q[HOTBAR], { id: "plank", n: 64 });
  assert.equal(total(q), total(s));
  assert.equal(total(quickMove(q, HOTBAR)), total(s));
});

test("túi đồ: làm sạch dữ liệu đọc từ bộ lưu (mã lạ, số âm, vượt chồng, sai độ dài)", () => {
  const inv = sanitizeInv([{ id: "dirt", n: 5 }, { id: "zzz", n: 3 }, { id: "stone", n: -2 }, { id: "axis_pick", n: 9 }, { id: "wood", n: 2.7 }, "x", null]);
  assert.equal(inv.length, INV_SIZE);
  assert.deepEqual(inv.slice(0, 5), [{ id: "dirt", n: 5 }, null, null, { id: "axis_pick", n: 1 }, { id: "wood", n: 2 }]);
  assert.equal(sanitizeInv("hỏng").length, INV_SIZE);
});

// ───────────── Chế tạo ─────────────
test("chế tạo: tỉ lệ 1 : 4, ×k nhân cả hai vế, tối đa = min ⌊có / cần⌋, cần đúng trạm", () => {
  let inv = addItem(emptyInv(), "wood", 3).inv;
  const plank = RECIPE_BY_ID.plank;
  assert.equal(maxCraft(inv, plank), 3);
  const r = craft(inv, plank, 2, "hand");
  assert.ok(r.ok);
  if (r.ok) inv = r.inv;
  assert.equal(countItem(inv, "wood"), 1);
  assert.equal(countItem(inv, "plank"), 8);
  // Cuốc Trục cần Bàn Dã chiến
  inv = addItem(inv, "int_crystal", 5).inv;
  const pick = RECIPE_BY_ID.axis_pick;
  assert.deepEqual(craft(inv, pick, 1, "hand"), { ok: false, reason: "station" });
  assert.equal(maxCraft(inv, pick), 1); // min(⌊5/2⌋, ⌊1/1⌋) = 1
  assert.deepEqual(craft(inv, pick, 2, "bench"), { ok: false, reason: "missing" });
  const ok = craft(inv, pick, 1, "bench");
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(countItem(ok.inv, "axis_pick"), 1);
    assert.equal(countItem(ok.inv, "int_crystal"), 3);
    assert.equal(countItem(ok.inv, "wood"), 0);
  }
  assert.deepEqual(craft(inv, plank, 0, "hand"), { ok: false, reason: "times" });
});

test("chế tạo: túi đầy không làm mất nguyên liệu (kiểm chỗ cho thành phẩm cùng lúc)", () => {
  // 35 ô đầy đá, 1 ô 1 gỗ: xẻ gỗ thì ô gỗ trống ra → đủ chỗ cho 4 ván
  const inv: Slot[] = emptyInv().map(() => ({ id: "stone", n: 64 }));
  inv[0] = { id: "wood", n: 1 };
  const r = craft(inv, RECIPE_BY_ID.plank, 1, "hand");
  assert.ok(r.ok);
  // 2 gỗ: bớt 2 gỗ trống 1 ô, nhưng 8 ván vẫn vừa một ô → được; còn bàn cần ô riêng khi ván không hết
  const inv2: Slot[] = emptyInv().map(() => ({ id: "stone", n: 64 }));
  inv2[0] = { id: "plank", n: 5 };
  const before = JSON.stringify(inv2);
  const r2 = craft(inv2, RECIPE_BY_ID.bench, 1, "hand");
  assert.deepEqual(r2, { ok: false, reason: "full" });
  assert.equal(JSON.stringify(inv2), before, "túi gốc bị đổi");
});

// ───────────── Đào ─────────────
test("đào: thời gian theo độ cứng và dụng cụ; đá cần Cuốc Trục mới rơi; lá rơi theo xác suất", () => {
  const axis = ITEMS.axis_pick.tool!;
  const ratio = ITEMS.ratio_pick.tool!;
  assert.equal(breakTime(B.dirt, null), 0.75);
  assert.equal(breakTime(B.torch, null), 0);
  assert.equal(breakTime(B.stone, null), 7.5); // không đủ cấp: ×5
  assert.equal(breakTime(B.stone, axis), (1.5 * 1.5) / 4);
  assert.ok(breakTime(B.stone, ratio) < breakTime(B.stone, axis));
  assert.ok(breakTime(B.copper, axis) > breakTime(B.stone, axis));
  assert.equal(canHarvest(B.copper, null), false);
  assert.equal(canHarvest(B.copper, axis), true);
  assert.equal(canHarvest(B.intcrystal, null), true, "Tinh thể Số nguyên phải đào tay được (bậc 0)");
  assert.equal(dropFor(B.stone, null, 0), null);
  assert.deepEqual(dropFor(B.stone, axis, 0.5), { id: "stone", n: 1 });
  assert.deepEqual(dropFor(B.grass, null, 0.5), { id: "dirt", n: 1 });
  assert.deepEqual(dropFor(B.intcrystal, null, 0.9), { id: "int_crystal", n: 1 });
  assert.deepEqual(dropFor(B.copper, axis, 0.9), { id: "ratio_copper", n: 1 });
  assert.deepEqual(dropFor(B.leaf, null, 0.1), { id: "leaf", n: 1 });
  assert.equal(dropFor(B.leaf, null, 0.9), null);
  assert.equal(dropFor(B.air, null, 0), null);
});

test("đào: tiến độ về 0 khi đổi mục tiêu; đổi dụng cụ giữa chừng giữ tỉ lệ đã đào", () => {
  const m = new MiningProgress();
  assert.equal(m.step(1, 2, 3, B.dirt, 1, 0.4), false);
  assert.ok(Math.abs(m.frac - 0.4) < 1e-9);
  assert.equal(m.step(1, 2, 4, B.dirt, 1, 0.4), false); // ô khác → lại từ đầu
  assert.ok(Math.abs(m.frac - 0.4) < 1e-9);
  assert.equal(m.step(1, 2, 4, B.dirt, 2, 0.2), false); // cần 2 s: 0,4 → 0,8 rồi + 0,2
  assert.ok(Math.abs(m.frac - 0.5) < 1e-9);
  assert.equal(m.step(1, 2, 4, B.dirt, 2, 1), true);
  assert.equal(m.frac, 0);
  assert.equal(m.step(0, 0, 0, B.torch, 0, 0.016), true, "khối độ cứng 0 phá ngay");
});

test("dò tia không cấp phát: trúng đúng ô + pháp tuyến mặt; chặn đặt khối vào thân nhân vật", () => {
  const out = new Int32Array(6);
  const solid = (x: number, y: number, z: number) => y < 0 || (x === 3 && y === 1 && z === 0);
  assert.equal(raycastInto(out, solid, 0.5, 1.5, 0.5, 1, 0, 0, 8), true);
  assert.deepEqual(Array.from(out), [3, 1, 0, -1, 0, 0]);
  assert.equal(raycastInto(out, solid, 0.5, 1.5, 0.5, 0, -1, 0, 8), true);
  assert.deepEqual(Array.from(out), [0, -1, 0, 0, 1, 0]);
  assert.equal(raycastInto(out, solid, 0.5, 1.5, 0.5, 0, 1, 0, 8), false);
  assert.equal(cellHitsBody(5, 10, 5, 5.5, 10, 5.5), true);
  assert.equal(cellHitsBody(5, 11, 5, 5.5, 10, 5.5), true);
  assert.equal(cellHitsBody(5, 12, 5, 5.5, 10, 5.5), false);
  assert.equal(cellHitsBody(6, 10, 5, 5.5, 10, 5.5), false);
  assert.equal(cellHitsBody(6, 10, 5, 5.8, 10, 5.5), true); // vai chạm sang ô bên
});

// ───────────── Đồ rơi ─────────────
const flat = (_x: number, y: number) => y < 10;

test("đồ rơi: gộp chồng gần nhau, rơi xuống sàn rồi nằm yên, giới hạn số lượng (thay cái cũ nhất)", () => {
  const p = new DropPool(4);
  const a = p.spawn(1, 1, 0.5, 12, 0.5);
  assert.equal(p.spawn(1, 2, 0.9, 12, 0.5), a, "không gộp");
  assert.equal(p.count[a], 3);
  assert.notEqual(p.spawn(2, 1, 0.5, 12, 0.5), a, "gộp nhầm khác loại");
  for (let i = 0; i < 60; i++) p.step(1 / 30, flat, 100, 10, 100, () => 0, () => 0);
  assert.ok(Math.abs(p.py[a] - 10.14) < 1e-4, `y = ${p.py[a]}`);
  assert.equal(p.rest[a], 1);
  // đầy bể → cái già nhất bị thay
  p.spawn(3, 1, 20, 12, 0);
  p.spawn(4, 1, 30, 12, 0);
  assert.equal(p.active, 4);
  p.step(0.5, flat, 100, 10, 100, () => 0, () => 0);
  const s = p.spawn(5, 1, 40, 12, 0);
  assert.equal(p.active, 4);
  assert.equal(p.item[s], 5);
  assert.ok(s === a || p.item[a] === 1);
});

test("đồ rơi: nam châm hút về người chơi; nhặt một giao dịch, túi đầy một phần thì phần còn lại nằm đất", () => {
  const p = new DropPool(8);
  const i = p.spawn(7, 10, 2, 10.5, 0.5);
  let room = 4;
  let got = 0;
  const take = (_it: number, n: number) => {
    const k = Math.min(n, room);
    room -= k;
    got += k;
    return k;
  };
  for (let f = 0; f < 120; f++) p.step(1 / 60, flat, 0.5, 10, 0.5, () => room, take);
  assert.equal(got, 4);
  assert.equal(p.item[i], 7, "phần còn lại bị mất");
  assert.equal(p.count[i], 6);
  room = 100;
  for (let f = 0; f < 120; f++) p.step(1 / 60, flat, 0.5, 10, 0.5, () => room, take);
  assert.equal(got, 10);
  assert.equal(p.item[i], -1);
  assert.equal(p.active, 0);
});

test("đồ rơi: không hút khi túi hết chỗ; hai chồng nằm yên cạnh nhau tự gộp", () => {
  const p = new DropPool(8);
  const a = p.spawn(1, 3, 0.5, 10.2, 0.5);
  const b = p.spawn(1, 4, 5.5, 10.2, 0.5);
  for (let f = 0; f < 30; f++) p.step(1 / 30, flat, 0.5, 10, 1.5, () => 0, () => 0);
  assert.equal(p.active, 2);
  // đẩy b lại gần a rồi để bước gộp chạy
  p.px[b] = 1.2;
  for (let f = 0; f < 20; f++) p.step(1 / 30, flat, 50, 10, 50, () => 0, () => 0);
  assert.equal(p.active, 1);
  assert.equal(p.count[a] + Math.max(0, p.count[b]), 7);
});
