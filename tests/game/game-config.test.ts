/**
 * Admin sửa giá thú cưng / khung / bảng tên (nhập tiền thật → xu = ÷3,6 làm tròn lên trăm) và mức xu các hoạt động (DB local).
 * Dọn bảng GameConfig sau khi chạy để không đổi giá của server dev đang dùng chung DB.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import {
  EARNING_DEFAULTS,
  PRICE_EDITABLE_ITEMS,
  applyGameConfig,
  basePriceOf,
  loadGameConfig,
  normalizeEarning,
  normalizeItemPrices,
  parseVnd,
  vndToXu,
  writeGameConfig,
} from "@/lib/game/game-config";
import { ITEM_BY_ID } from "@/lib/game/items";
import { POINTS } from "@/lib/points/config";
import { buyItemInTx } from "@/lib/game/inventory";
import { onTestSubmitted } from "@/lib/points/hooks";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await prisma.gameConfig.deleteMany({ where: { key: { in: ["itemPrices", "earning"] } } });
  applyGameConfig(null);
  await fx.cleanup();
  await disconnect();
});

describe("Đổi tiền thật ra xu", () => {
  test("chia 3,6 rồi làm tròn LÊN hàng trăm", () => {
    assert.equal(vndToXu(20000), 5600); // 5.555,6 → 5.600
    assert.equal(vndToXu(954), 300); // 265 → 300 (ví dụ của thầy)
    assert.equal(vndToXu(3600), 1000); // chia hết: không cộng thêm 100
    assert.equal(vndToXu(3601), 1100);
    assert.equal(vndToXu(0), 0);
  });
  test("đọc số tiền: 20000, 20.000, 20k, 1,5tr", () => {
    assert.equal(parseVnd("20000"), 20000);
    assert.equal(parseVnd("20.000"), 20000);
    assert.equal(parseVnd("20k"), 20000);
    assert.equal(parseVnd("1,5tr"), 1_500_000);
    assert.equal(parseVnd("25.000đ"), 25000);
    assert.equal(parseVnd("abc"), null);
    assert.equal(parseVnd(""), null);
  });
});

describe("Kiểm tra bảng giá", () => {
  test("chỉ sửa được thú cưng / khung / bảng tên đang bán; xu tính lại ở server từ tiền thật", () => {
    assert.ok(PRICE_EDITABLE_ITEMS.length > 20);
    assert.ok(PRICE_EDITABLE_ITEMS.every((i) => ["pet", "frame", "nameplate"].includes(i.slot) && !i.gachaOnly && !i.quest));
    const ok = normalizeItemPrices({ "pet-moka": { vnd: 20000, xu: 1 }, "frame-gold": { gem: 9 } });
    assert.ok("data" in ok);
    assert.deepEqual(ok.data["pet-moka"], { xu: 5600, vnd: 20000 }, "không tin số xu client gửi");
    assert.deepEqual(ok.data["frame-gold"], { gem: 9 });
    for (const bad of [{ "frame-rainbow": { vnd: 20000 } }, { "q-owl": { vnd: 20000 } }, { "hair-spiky": { vnd: 20000 } }, { "nope": { vnd: 1 } }, { "pet-moka": { vnd: 500 } }, { "pet-moka": { gem: 0 } }, { "pet-moka": { xu: -1 } }]) {
      assert.ok("error" in normalizeItemPrices(bad), JSON.stringify(bad));
    }
  });
  test("mức xu: ngoài khoảng → lỗi; bằng mặc định / để trống → không lưu", () => {
    const r = normalizeEarning({ testSubmit: 500, onTimeBonus: EARNING_DEFAULTS.onTimeBonus, homeworkPass: "" });
    assert.ok("data" in r);
    assert.deepEqual(r.data, { testSubmit: 500 });
    for (const bad of [{ testSubmit: -1 }, { finalScoreMultiplier: 9 }, { hack: 1 }, { testSubmit: "abc" }]) assert.ok("error" in normalizeEarning(bad), JSON.stringify(bad));
  });
});

describe("Áp cấu hình", () => {
  test("đổi giá + mức xu, gỡ cấu hình thì về mặc định", () => {
    const base = basePriceOf("pet-moka");
    applyGameConfig({ itemPrices: { "pet-moka": { xu: 5600, vnd: 20000 }, "frame-gold": { gem: 9 } }, earning: { testSubmit: 500, score10: 900, streak4: 1000 } });
    assert.deepEqual(ITEM_BY_ID["pet-moka"].price, { xu: 5600 });
    assert.deepEqual(ITEM_BY_ID["frame-gold"].price, { gem: 9 });
    assert.equal(POINTS.testSubmit, 500);
    assert.equal(POINTS.scoreTiers[0].points, 900);
    assert.equal(POINTS.streak.milestones[4], 1000);
    applyGameConfig(null);
    assert.deepEqual(ITEM_BY_ID["pet-moka"].price, base);
    assert.equal(POINTS.testSubmit, EARNING_DEFAULTS.testSubmit);
    assert.equal(POINTS.scoreTiers[0].points, EARNING_DEFAULTS.score10);
  });
});

describe("Luồng thật (DB local)", () => {
  test("mua thú cưng trừ đúng giá admin đặt", async () => {
    const admin = await fx.user({ role: "ADMIN" });
    await writeGameConfig("itemPrices", { "pet-moka": { xu: 5600, vnd: 20000 } }, admin.id);
    const s = await fx.user();
    await fx.give(s.id, 6000);
    const res = await prisma.$transaction((tx) => buyItemInTx(tx, s.id, "pet-moka"));
    assert.ok(res.success, JSON.stringify(res));
    assert.equal(await fx.balance(s.id), 400);
  });

  test("nộp bài cộng mức xu admin đặt (đọc lại từ DB qua runPointsSafely)", async () => {
    const admin = await fx.user({ role: "ADMIN" });
    await writeGameConfig("earning", { testSubmit: 777 }, admin.id);
    applyGameConfig(null); // giả lập tiến trình khác chưa áp: hook phải tự nạp từ DB
    await loadGameConfig(true);
    applyGameConfig(null);
    const s = await fx.user();
    const t1 = await fx.test();
    const at = await fx.attempt(t1.id, s.id, 5);
    await onTestSubmitted({ userId: s.id, attemptId: at.id, test: { id: t1.id, dueDate: null, courseId: null }, score: 5, answeredCount: 10, questionCount: 10, hasPendingEssay: false });
    const row = await prisma.pointLedger.findFirst({ where: { userId: s.id, source: "TEST_SUBMIT" } });
    assert.equal(row?.amount, 777);
  });
});
