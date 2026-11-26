/**
 * Lõi sổ điểm (DB local): cộng một lần theo khoá, thu hồi, giới hạn ngày, chạy đồng thời, ví luôn khớp sổ.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { awardOnce, isEligibleStudent, lockWallet, revokeKey, runPointsSafely, writeEntry } from "@/lib/points/engine";
import { createFixture, disconnect, withPoints } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const award = (userId: string, key: string, amount: number, capped = false) =>
  prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    return awardOnce(tx, { userId, key, amount, source: "TEST_SUBMIT", capped });
  });

describe("awardOnce / revokeKey", () => {
  let u: string;
  before(async () => (u = (await fx.user()).id));

  test("cộng một lần cho mỗi khoá", async () => {
    assert.equal(await award(u, "K1", 3), 3);
    assert.equal(await award(u, "K1", 3), 0);
    assert.equal(await fx.balance(u), 3);
  });

  test("thu hồi đưa khoá về 0, được cộng lại; thu hồi lần 2 không trừ thêm", async () => {
    const r1 = await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      return revokeKey(tx, u, "K1", "test");
    });
    assert.equal(r1, 3);
    const r2 = await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      return revokeKey(tx, u, "K1", "test");
    });
    assert.equal(r2, 0);
    assert.equal(await fx.balance(u), 0);
    assert.equal(await award(u, "K1", 3), 3, "cộng lại sau khi thu hồi");
    assert.equal(await fx.balance(u), 3);
  });

  test("số điểm ≤ 0 không ghi sổ", async () => {
    assert.equal(await award(u, "K0", 0), 0);
    assert.equal(await award(u, "Kneg", -5), 0);
    assert.equal(await prisma.pointLedger.count({ where: { userId: u, key: { in: ["K0", "Kneg"] } } }), 0);
  });

  test("ví luôn khớp tổng sổ; tổng đã kiếm không tính đổi/hoàn quà", async () => {
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      await writeEntry(tx, { userId: u, amount: -2, source: "REDEEM" });
      await writeEntry(tx, { userId: u, amount: 2, source: "REFUND" });
      await writeEntry(tx, { userId: u, amount: -1, source: "REDEEM" });
    });
    const w = await fx.wallet(u);
    assert.equal(w!.balance, await fx.ledgerSum(u));
    assert.equal(w!.lifetimeEarned, 3, "đổi/hoàn không làm đổi tổng đã kiếm");
  });
});

describe("Hai loại tiền (xu / ngọc) — review Gemini", () => {
  test("ngọc vào gems, không vào balance/lifetimeEarned; gems = Σ GEM, balance = Σ XU", async () => {
    const u = (await fx.user()).id;
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      await writeEntry(tx, { userId: u, amount: 5, source: "GIFTCODE", currency: "GEM", key: "GC1" });
      await writeEntry(tx, { userId: u, amount: 7, source: "TEST_SUBMIT", key: "T1" });
      await writeEntry(tx, { userId: u, amount: -3, source: "GACHA", currency: "GEM" });
    });
    const w = await fx.wallet(u);
    assert.equal(w!.gems, 2);
    assert.equal(w!.balance, 7);
    assert.equal(w!.lifetimeEarned, 7, "ngọc không tính vào tổng đã kiếm");
    assert.equal(w!.gems, await fx.ledgerSum(u, "GEM"));
    assert.equal(w!.balance, await fx.ledgerSum(u, "XU"));
  });

  test("xu từ gacha / mua đồ / hoàn quà không làm tăng danh hiệu; xu từ mã quà CÓ tính tích luỹ (26/11)", async () => {
    const u = (await fx.user()).id;
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      await writeEntry(tx, { userId: u, amount: 100, source: "GIFTCODE", key: "GC2" });
      await writeEntry(tx, { userId: u, amount: 50, source: "GACHA" });
      await writeEntry(tx, { userId: u, amount: -30, source: "ITEM", key: "ITEM:x" });
      await writeEntry(tx, { userId: u, amount: 10, source: "REFUND" });
      await writeEntry(tx, { userId: u, amount: 300, source: "TEST_SUBMIT", key: "T2" });
    });
    const w = await fx.wallet(u);
    assert.equal(w!.balance, 430);
    assert.equal(w!.lifetimeEarned, 400, "300 học + 100 mã quà");
  });

  test("awardOnce / revokeKey theo đúng loại tiền: khoá ngọc không chạm xu", async () => {
    const u = (await fx.user()).id;
    const run = <T,>(fn: (tx: Parameters<typeof lockWallet>[0]) => Promise<T>) =>
      prisma.$transaction(async (tx) => {
        await lockWallet(tx, u);
        return fn(tx);
      });
    assert.equal(await run((tx) => awardOnce(tx, { userId: u, amount: 4, source: "GIFTCODE", key: "GEMKEY", currency: "GEM" })), 4);
    assert.equal(await run((tx) => awardOnce(tx, { userId: u, amount: 4, source: "GIFTCODE", key: "GEMKEY", currency: "GEM" })), 0, "không cộng ngọc lần 2");
    assert.equal(await run((tx) => revokeKey(tx, u, "GEMKEY", "test")), 0, "thu hồi theo XU không thấy khoá ngọc");
    assert.equal(await run((tx) => revokeKey(tx, u, "GEMKEY", "test", null, "GEM")), 4);
    const w = await fx.wallet(u);
    assert.equal(w!.gems, 0);
    assert.equal(w!.balance, 0);
    assert.equal(await fx.ledgerSum(u, "XU"), 0);
  });

  test("thu hồi khoá xu từ mã quà trừ lại đúng phần tích luỹ đã cộng; thu hồi gacha không chạm danh hiệu", async () => {
    const u = (await fx.user()).id;
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      await awardOnce(tx, { userId: u, amount: 300, source: "TEST_SUBMIT", key: "T9" });
      await awardOnce(tx, { userId: u, amount: 500, source: "GIFTCODE", key: "GC9" });
    });
    assert.equal((await fx.wallet(u))!.lifetimeEarned, 800);
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      assert.equal(await revokeKey(tx, u, "GC9", "thu hồi mã"), 500);
    });
    let w = await fx.wallet(u);
    assert.equal(w!.balance, 300);
    assert.equal(w!.lifetimeEarned, 300, "thu hồi mã quà trừ lại phần tích luỹ của mã");
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      await awardOnce(tx, { userId: u, amount: 200, source: "GACHA", key: "GA9" });
      assert.equal(await revokeKey(tx, u, "GA9", "thu hồi rương"), 200);
    });
    w = await fx.wallet(u);
    assert.equal(w!.lifetimeEarned, 300, "xu rương / thu hồi rương không chạm danh hiệu");
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, u);
      assert.equal(await revokeKey(tx, u, "T9", "xoá bài"), 300);
    });
    w = await fx.wallet(u);
    assert.equal(w!.balance, 0);
    assert.equal(w!.lifetimeEarned, 0, "thu hồi bài học thì trừ danh hiệu");
    assert.equal(w!.balance, await fx.ledgerSum(u, "XU"));
  });
});

describe("Giới hạn xu tự động mỗi ngày", () => {
  test("cộng phần còn lại rồi dừng; nguồn không giới hạn vẫn cộng", async () => {
    const u = (await fx.user()).id;
    await withPoints({ dailyAutoCap: 5 }, async () => {
      assert.equal(await award(u, "C1", 3, true), 3);
      assert.equal(await award(u, "C2", 4, true), 2, "chỉ còn 2");
      assert.equal(await award(u, "C3", 1, true), 0, "đã đủ");
      assert.equal(await prisma.pointLedger.count({ where: { userId: u, key: "C3" } }), 0, "không ghi dòng 0 điểm");
      assert.equal(await award(u, "C4", 4, false), 4, "nguồn không giới hạn");
    });
    assert.equal(await fx.balance(u), 9);
  });

  test("điểm của hôm qua không tính vào hôm nay", async () => {
    const u = (await fx.user()).id;
    await award(u, "Y1", 5, true);
    await prisma.pointLedger.updateMany({ where: { userId: u, key: "Y1" }, data: { createdAt: new Date(Date.now() - 2 * 86400000) } });
    await withPoints({ dailyAutoCap: 5 }, async () => {
      assert.equal(await award(u, "Y2", 5, true), 5);
    });
  });
});

describe("Chạy đồng thời", () => {
  test("10 lần cộng cùng khoá cùng lúc → chỉ 1 lần", async () => {
    const u = (await fx.user()).id;
    const r = await Promise.all(Array.from({ length: 10 }, () => award(u, "SAME", 2)));
    assert.equal(r.filter((x) => x > 0).length, 1);
    assert.equal(await fx.balance(u), 2);
  });

  test("10 khoá khác nhau cùng lúc → không mất lần cộng nào", async () => {
    const u = (await fx.user()).id;
    await Promise.all(Array.from({ length: 10 }, (_, i) => award(u, `D${i}`, 1)));
    assert.equal(await fx.balance(u), 10);
    assert.equal(await fx.ledgerSum(u), 10);
  });
});

describe("Ai được nhận điểm", () => {
  test("chỉ học sinh đã duyệt, không phải demo", async () => {
    const ok = await fx.user();
    const unapproved = await fx.user({ isApproved: false });
    const demo = await fx.user({ isDemo: true });
    const teacher = await fx.user({ role: "TEACHER" });
    const admin = await fx.user({ role: "ADMIN" });
    assert.equal(await isEligibleStudent(prisma as any, ok.id), true);
    for (const u of [unapproved, demo, teacher, admin]) assert.equal(await isEligibleStudent(prisma as any, u.id), false, u.role);
    assert.equal(await isEligibleStudent(prisma as any, "khong-ton-tai"), false);
  });
});

describe("runPointsSafely", () => {
  test("lỗi trong tính điểm không ném ra ngoài (không làm hỏng việc nộp bài) và rollback", async () => {
    const u = (await fx.user()).id;
    const origError = console.error;
    console.error = () => {};
    try {
      await runPointsSafely("test", async (tx) => {
        await lockWallet(tx, u);
        await awardOnce(tx, { userId: u, key: "RB", amount: 5, source: "TEST_SUBMIT" });
        throw new Error("boom");
      });
    } finally {
      console.error = origError;
    }
    assert.equal(await fx.balance(u), 0, "giao dịch bị huỷ");
  });

  test("POINTS_ENABLED=off → không chạy", async () => {
    const u = (await fx.user()).id;
    process.env.POINTS_ENABLED = "off";
    try {
      await runPointsSafely("test", async (tx) => {
        await lockWallet(tx, u);
        await awardOnce(tx, { userId: u, key: "OFF", amount: 5, source: "TEST_SUBMIT" });
      });
    } finally {
      delete process.env.POINTS_ENABLED;
    }
    assert.equal(await fx.balance(u), 0);
  });
});
