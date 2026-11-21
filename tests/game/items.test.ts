/**
 * Đồ trang trí & nhân vật (lib/game/items, avatar, inventory) — DB local.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { DUPLICATE_REFUND, ITEMS, ITEM_BY_ID, SLOTS, itemsOfSlot, shopItems } from "@/lib/game/items";
import { canEquip, defaultAvatar, sanitizeAvatar } from "@/lib/game/avatar";
import { buyItemInTx, getAvatar, getAvatars, saveAvatarConfig } from "@/lib/game/inventory";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const buy = (userId: string, itemId: string) => prisma.$transaction((tx) => buyItemInTx(tx, userId, itemId));

describe("Danh mục đồ", () => {
  test("slug duy nhất, đúng ô, mỗi ô bắt buộc có ít nhất 2 món miễn phí, giá dương", () => {
    assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
    for (const i of ITEMS) {
      assert.ok(SLOTS.some((s) => s.key === i.slot), i.id);
      if (i.price) assert.ok(("xu" in i.price ? i.price.xu : i.price.gem) > 0, i.id);
      assert.ok(!(i.free && i.price), `${i.id} vừa miễn phí vừa có giá`);
      assert.ok(!(i.free && i.gachaOnly), `${i.id} vừa miễn phí vừa chỉ rương`);
    }
    for (const s of SLOTS.filter((s) => !s.optional)) {
      assert.ok(itemsOfSlot(s.key).filter((i) => i.free).length >= 2, `ô ${s.key} cần ≥ 2 món miễn phí`);
    }
    assert.ok(shopItems().length >= 20);
    assert.ok(DUPLICATE_REFUND.legendary > DUPLICATE_REFUND.common);
  });

  test("giá đồ trang trí vừa túi: món Hiếm ≤ 1 tuần học chăm (3 000 xu), Sử thi bán bằng xu ≤ 2 tuần", () => {
    for (const i of shopItems()) {
      if (!("xu" in i.price!)) continue;
      if (i.rarity === "common") assert.ok(i.price.xu <= 900, i.id);
      if (i.rarity === "rare") assert.ok(i.price.xu <= 3000, i.id);
      if (i.rarity === "epic") assert.ok(i.price.xu <= 6000, i.id);
    }
  });
});

describe("Nhân vật mặc định và làm sạch cấu hình", () => {
  test("mặc định xác định theo id, chỉ dùng đồ miễn phí, khác nhau giữa các id", () => {
    const a = defaultAvatar("user-a");
    assert.deepEqual(defaultAvatar("user-a"), a);
    for (const k of ["skin", "hair", "hairColor", "eyes", "outfit"] as const) assert.ok(ITEM_BY_ID[a[k]!].free, k);
    const distinct = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(defaultAvatar(`u${i}`))));
    assert.ok(distinct.size >= 8, "20 id cho ít nhất 8 nhân vật khác nhau");
  });

  test("món lạ / sai ô / chưa sở hữu → mặc định; món sở hữu → giữ; ô tuỳ chọn bỏ được", () => {
    const base = defaultAvatar("u");
    const cfg = sanitizeAvatar({ hair: "hair-spiky", eyes: "hair-bob", outfit: "khong-co", accessory: "acc-crown", frame: null, title: "title-nerd" }, "u", ["hair-spiky", "title-nerd"]);
    assert.equal(cfg.hair, "hair-spiky");
    assert.equal(cfg.eyes, base.eyes, "sai ô → mặc định");
    assert.equal(cfg.outfit, base.outfit, "slug lạ → mặc định");
    assert.equal(cfg.accessory, null, "chưa sở hữu → bỏ");
    assert.equal(cfg.title, "title-nerd");
    assert.deepEqual(sanitizeAvatar("rác", "u", []), base);
    assert.deepEqual(sanitizeAvatar(null, "u", []), base);
    assert.ok(canEquip("hair-short", new Set()) && !canEquip("hair-spiky", new Set()) && canEquip("hair-spiky", new Set(["hair-spiky"])));
  });
});

describe("Mua đồ", () => {
  test("đủ xu → trừ xu, có đồ, lifetimeEarned không đổi; mua lại → đã có; ví khớp sổ", async () => {
    const s = await fx.user();
    await fx.give(s.id, 2000);
    const r = await buy(s.id, "hair-spiky");
    assert.equal(r.success, true);
    assert.equal(await fx.balance(s.id), 1100);
    assert.equal((await fx.wallet(s.id))!.lifetimeEarned, 2000);
    assert.deepEqual((await getAvatar(s.id)).owned, ["hair-spiky"]);
    const again = await buy(s.id, "hair-spiky");
    assert.equal(again.success, false);
    assert.match((again as { error: string }).error, /đã có/);
    assert.equal(await fx.balance(s.id), 1100);
    assert.equal(await fx.balance(s.id), await fx.ledgerSum(s.id, "XU"));
  });

  test("thiếu xu → báo thiếu, không có đồ; món miễn phí / chỉ rương / slug lạ → không bán", async () => {
    const s = await fx.user();
    await fx.give(s.id, 100);
    const r = await buy(s.id, "hair-spiky");
    assert.equal(r.success, false);
    assert.match((r as { error: string }).error, /thêm 800 xu/);
    assert.equal(await prisma.userItem.count({ where: { userId: s.id } }), 0);
    for (const id of ["hair-short", "hair-bun", "xxx"]) assert.equal((await buy(s.id, id)).success, false, id);
  });

  test("đồ bằng ngọc: trừ gems, không chạm xu", async () => {
    const s = await fx.user();
    await fx.give(s.id, 50);
    await prisma.pointLedger.create({ data: { userId: s.id, amount: 10, source: "GIFTCODE", currency: "GEM" } });
    await prisma.pointWallet.update({ where: { userId: s.id }, data: { gems: 10 } });
    assert.equal((await buy(s.id, "outfit-royal")).success, true);
    const w = await fx.wallet(s.id);
    assert.equal(w!.gems, 2);
    assert.equal(w!.balance, 50);
    assert.equal(w!.gems, await fx.ledgerSum(s.id, "GEM"));
    assert.equal((await buy(s.id, "acc-crown")).success, false, "còn 2 ngọc, vương miện 10");
  });

  test("hai tab cùng mua một món → chỉ trừ tiền một lần", async () => {
    const s = await fx.user();
    await fx.give(s.id, 2000);
    const rs = await Promise.allSettled([buy(s.id, "hair-twin"), buy(s.id, "hair-twin")]);
    assert.equal(rs.filter((r) => r.status === "fulfilled" && r.value.success).length, 1);
    assert.equal(await fx.balance(s.id), 1100);
    assert.equal(await prisma.userItem.count({ where: { userId: s.id, itemId: "hair-twin" } }), 1);
  });

  test("chưa duyệt / demo / giáo viên không mua được", async () => {
    for (const opts of [{ isApproved: false }, { isDemo: true }, { role: "TEACHER" as const }]) {
      const u = await fx.user(opts);
      await fx.give(u.id, 5000);
      assert.equal((await buy(u.id, "hair-spiky")).success, false, JSON.stringify(opts));
    }
  });
});

describe("Lưu nhân vật", () => {
  test("trang bị món đã mua; món chưa mua bị bỏ; getAvatars trả đủ cho nhiều người", async () => {
    const s = await fx.user();
    const other = await fx.user();
    await fx.give(s.id, 2000);
    await buy(s.id, "hair-spiky");
    const saved = await saveAvatarConfig(s.id, { hair: "hair-spiky", accessory: "acc-crown", hairColor: "hc-blonde", background: "bg-sky" });
    assert.equal(saved.hair, "hair-spiky");
    assert.equal(saved.accessory, null);
    assert.equal(saved.hairColor, "hc-blonde");
    assert.equal(saved.background, null, "nền chưa mua bị bỏ");
    const map = await getAvatars([s.id, other.id]);
    assert.equal(map.get(s.id)?.hair, "hair-spiky");
    assert.deepEqual(map.get(other.id), defaultAvatar(other.id));
    assert.deepEqual((await getAvatar(s.id)).config, saved);
  });
});
