/**
 * GĐ8 "Hồ sơ & Trang trí": danh mục mới, mẫu nhân vật, mua cả bộ (buyBundleInTx), ô Hiệu ứng, bể rương — DB local.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { ITEMS, ITEM_BY_ID, SLOTS } from "@/lib/game/items";
import { PRESETS } from "@/lib/game/presets";
import { defaultAvatar, sanitizeAvatar } from "@/lib/game/avatar";
import { BundleAbort, buyBundleInTx, buyItemInTx } from "@/lib/game/inventory";
import { RARITY_ORDER, poolFor } from "@/lib/game/gacha-shared";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

/** Như action buyBundle: BundleAbort → rollback, trả lỗi */
const bundle = async (userId: string, ids: string[]) => {
  try {
    return await prisma.$transaction((tx) => buyBundleInTx(tx, userId, ids));
  } catch (e) {
    if (e instanceof BundleAbort) return { success: false as const, error: e.message };
    throw e;
  }
};
const gem = async (userId: string, n: number) => {
  await prisma.pointLedger.create({ data: { userId, amount: n, source: "GIFTCODE", currency: "GEM" } });
  await prisma.pointWallet.update({ where: { userId }, data: { gems: { increment: n } } });
};

describe("Danh mục GĐ8", () => {
  test("ô Hiệu ứng là ô tuỳ chọn, có món; mỗi loại mới đủ số lượng như mockup", () => {
    assert.ok(SLOTS.some((s) => s.key === "effect" && s.optional));
    const count = (slot: string) => ITEMS.filter((i) => i.slot === slot).length;
    assert.ok(count("effect") >= 8);
    assert.ok(count("pet") >= 12);
    assert.ok(count("frame") >= 12);
    assert.ok(count("background") >= 11);
  });

  test("mẫu nhân vật chỉ tham chiếu món tồn tại đúng ô; mẫu không có món ngọc (nút ghi giá xu)", () => {
    assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
    for (const p of PRESETS) {
      for (const [slot, id] of Object.entries(p.items)) {
        if (!id) continue;
        assert.equal(ITEM_BY_ID[id]?.slot, slot, `${p.id}: ${id}`);
        assert.ok(!(ITEM_BY_ID[id].price && "gem" in ITEM_BY_ID[id].price!), `${p.id}: ${id} bán bằng ngọc`);
      }
    }
    // Phần lớn mẫu mua được hẳn bằng xu; mẫu có món chỉ-từ-rương được UI báo "Có món từ rương"
    const buyable = PRESETS.filter((p) => Object.values(p.items).every((id) => !id || !ITEM_BY_ID[id].gachaOnly));
    assert.ok(buyable.length >= 6);
  });

  test("bể rương: đồ studio (bán ở Hồ sơ) không vào bể; mọi món chỉ-rương mới vẫn có trong bể (review Gemini GĐ8)", () => {
    const all = RARITY_ORDER.flatMap((r) => [...poolFor("xu", r), ...poolFor("gem", r)]);
    const ids = new Set(all.flatMap((p) => (p.kind === "item" ? [p.item.id] : [])));
    for (const i of ITEMS.filter((x) => x.studio)) assert.ok(!ids.has(i.id), i.id);
    for (const i of ITEMS.filter((x) => x.gachaOnly)) assert.ok(ids.has(i.id), i.id);
    // tỉ lệ ra 1 ngọc ở Rương Xu không bị loãng bởi đồ mới: bể Huyền thoại cũ có 10 món + 1 gói ngọc
    assert.ok(poolFor("xu", "legendary").length <= 13, `bể Huyền thoại: ${poolFor("xu", "legendary").length}`);
  });

  test("cấu hình cũ không có khoá effect → effect null, các ô khác giữ nguyên; món effect chưa sở hữu bị bỏ", () => {
    const old = { hair: "hair-spiky", title: "title-nerd" };
    const cfg = sanitizeAvatar(old, "u", ["hair-spiky", "title-nerd"]);
    assert.equal(cfg.effect, null);
    assert.equal(cfg.hair, "hair-spiky");
    assert.equal(cfg.title, "title-nerd");
    assert.equal(defaultAvatar("u").effect, null);
    assert.equal(sanitizeAvatar({ effect: "fx-snow" }, "u", []).effect, null);
    assert.equal(sanitizeAvatar({ effect: "fx-snow" }, "u", ["fx-snow"]).effect, "fx-snow");
    assert.equal(sanitizeAvatar({ effect: "pet-bi" }, "u", ["pet-bi"]).effect, null, "sai ô");
  });
});

describe("Mua cả bộ (buyBundleInTx)", () => {
  test("đủ xu → mua mọi món thiếu một lần, bỏ qua món miễn phí/đã có; ví khớp sổ", async () => {
    const s = await fx.user();
    await fx.give(s.id, 5000);
    await prisma.$transaction(async (tx) => { await tx.userItem.create({ data: { userId: s.id, itemId: "acc-catears", source: "SHOP" } }); });
    // Cô bé mũ mèo: hair-long 1200 + outfit-cathoodie 1500 (+ catears đã có, hc-brown/eye-brown miễn phí)
    const ids = Object.values(PRESETS.find((p) => p.id === "preset-catgirl")!.items).filter((x): x is string => !!x);
    const r = await bundle(s.id, [...ids, ids[0]]);
    assert.equal(r.success, true, JSON.stringify(r));
    assert.deepEqual((r as { bought: { id: string }[] }).bought.map((i) => i.id).sort(), ["hair-long", "outfit-cathoodie"]);
    assert.equal(await fx.balance(s.id), 5000 - 2700);
    assert.equal(await fx.balance(s.id), await fx.ledgerSum(s.id, "XU"));
    // gọi lại (tab thứ hai): đủ món → thành công, không ghi sổ
    const again = await bundle(s.id, ids);
    assert.equal(again.success, true);
    assert.equal(await fx.balance(s.id), 2300);
  });

  test("thiếu tiền → không mua món nào (kể cả món rẻ trong bộ)", async () => {
    const s = await fx.user();
    await fx.give(s.id, 1300);
    const r = await bundle(s.id, ["hair-long", "outfit-cathoodie"]);
    assert.equal(r.success, false);
    assert.match((r as { error: string }).error, /thêm 1\.400 xu/);
    assert.equal(await prisma.userItem.count({ where: { userId: s.id } }), 0);
    assert.equal(await fx.balance(s.id), 1300);
  });

  test("món chỉ-từ-rương / slug lạ / mảng rỗng → từ chối trước khi ghi", async () => {
    const s = await fx.user();
    await fx.give(s.id, 9000);
    for (const ids of [["outfit-gamer", "acc-headphones"], ["xxx"], []]) {
      const r = await bundle(s.id, ids);
      assert.equal(r.success, false, JSON.stringify(ids));
    }
    assert.equal(await prisma.userItem.count({ where: { userId: s.id } }), 0);
    assert.equal(await fx.balance(s.id), 9000);
  });

  test("xu + ngọc trong một bộ: kiểm cả hai; thiếu ngọc → không trừ xu", async () => {
    const s = await fx.user();
    await fx.give(s.id, 2000);
    await gem(s.id, 5);
    const r = await bundle(s.id, ["acc-scarf", "fx-flame"]); // 450 xu + 8 ngọc
    assert.equal(r.success, false);
    assert.equal(await fx.balance(s.id), 2000);
    await gem(s.id, 3);
    assert.equal((await bundle(s.id, ["acc-scarf", "fx-flame"])).success, true);
    const w = await fx.wallet(s.id);
    assert.equal(w!.balance, 1550);
    assert.equal(w!.gems, 0);
    assert.equal(w!.gems, await fx.ledgerSum(s.id, "GEM"));
  });

  test("hai tab cùng mua cả bộ (chỉ đủ tiền một lần) → trừ một lần, không trùng món", async () => {
    const s = await fx.user();
    await fx.give(s.id, 3000);
    const ids = ["hair-long", "outfit-cathoodie"];
    const rs = await Promise.allSettled([bundle(s.id, ids), bundle(s.id, ids)]);
    assert.ok(rs.every((r) => r.status === "fulfilled"), "không ném lỗi");
    assert.equal(await fx.balance(s.id), 300);
    assert.equal(await prisma.userItem.count({ where: { userId: s.id } }), 2);
    assert.equal(await fx.balance(s.id), await fx.ledgerSum(s.id, "XU"));
  });

  test("chưa duyệt / demo / giáo viên không mua được cả bộ", async () => {
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      await fx.give(u.id, 9000);
      assert.equal((await bundle(u.id, ["acc-scarf"])).success, false, JSON.stringify(opts));
      assert.equal(await prisma.userItem.count({ where: { userId: u.id } }), 0);
    }
  });
});

describe("Bảng tên & món mở theo cấp (canvas Tiệm quà v2)", () => {
  test("ô Bảng tên có 7 món, mỗi món có cấp tối thiểu, không vào bể rương", () => {
    const plates = ITEMS.filter((i) => i.slot === "nameplate");
    assert.equal(plates.length, 7);
    for (const p of plates) {
      assert.ok((p.minLevel ?? 0) >= 1, p.id);
      assert.ok(p.studio, `${p.id} phải là đồ studio (ngoài bể rương)`);
    }
    assert.ok(SLOTS.some((s) => s.key === "nameplate" && s.optional));
    assert.equal(defaultAvatar("u").nameplate, null);
  });

  test("chưa đủ cấp → không mua được (báo cần Lv), đủ xu tích luỹ lên cấp → mua được; tiêu xu không làm mất quyền", async () => {
    const s = await fx.user();
    await fx.give(s.id, 1000); // Lv.1
    const buy = (id: string) => prisma.$transaction((tx) => buyItemInTx(tx, s.id, id));
    const r1 = await buy("np-sakura"); // cần Lv.2
    assert.equal(r1.success, false);
    assert.match((r1 as { error: string }).error, /Lv\.2/);
    assert.equal(await fx.balance(s.id), 1000);
    assert.equal((await bundle(s.id, ["np-sakura"])).success, false, "mua cả bộ cũng bị chặn");
    await fx.give(s.id, 600); // tích luỹ 1 600 → Lv.2
    assert.equal((await buy("np-sakura")).success, true);
    assert.equal(await fx.balance(s.id), 1000);
    assert.equal((await buy("np-pond")).success, true, "Lv.1 mua được bảng tên Lv.1 dù số dư đã giảm");
    assert.equal(sanitizeAvatar({ nameplate: "np-sakura" }, s.id, ["np-sakura"]).nameplate, "np-sakura");
  });
});
