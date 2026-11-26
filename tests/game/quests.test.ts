/**
 * Nhiệm vụ ẩn → biệt danh (DB local): giờ VN, 30 phút cuối, điểm 10, tăng ≥ 2,5, rùa (5 đúng hạn → trễ), rồng (chưa tiêu > 5.000),
 * người đầu tiên trong lớp đổi túi giấy ăn, cấp 1 lần + tự đeo + thông báo, biệt danh 24 giờ hết hạn rồi cấp lại.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { QUESTS, checkGachaQuests, checkRedeemQuests, checkSubmitQuests, grantQuestInTx, isTissueReward, runQuestsSafely, vnHour } from "@/lib/game/quests";
import { getOwnedItemIds } from "@/lib/game/inventory";
import { ITEMS, ITEM_BY_ID, itemsOfSlot } from "@/lib/game/items";
import { RARITY_ORDER, poolFor } from "@/lib/game/gacha-shared";
import { onTestSubmitted } from "@/lib/points/hooks";
import { createFixture, disconnect } from "../helpers/fixtures";
import { applyLegacyEarning } from "../helpers/legacy-earning";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

const H = 3600000;
const MIN = 60000;
/** Thời điểm giờ VN hh:mm hôm nay (UTC = VN − 7) */
const atVn = (hh: number, mm = 0) => {
  const d = new Date();
  d.setUTCHours((hh - 7 + 24) % 24, mm, 0, 0);
  return d;
};
const tx = <T,>(fn: (t: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) => prisma.$transaction(fn);

describe("Định nghĩa", () => {
  test("10 biệt danh, mỗi cái là danh hiệu quest; không bán, không vào rương, không hiện khi chưa có", () => {
    assert.equal(QUESTS.length, 10);
    for (const q of QUESTS) {
      const it = ITEM_BY_ID[q.itemId];
      assert.ok(it && it.slot === "title" && it.quest && !it.price && !it.free, q.id);
      const inPool = (["xu", "gem"] as const).some((c) => RARITY_ORDER.some((r) => poolFor(c, r).some((p) => p.kind === "item" && p.item.id === q.itemId)));
      assert.ok(!inPool, `${q.id} không vào rương`);
    }
    assert.ok(!itemsOfSlot("title").some((i) => i.quest), "chưa có thì không liệt kê");
    assert.ok(itemsOfSlot("title", new Set(["q-owl"])).some((i) => i.id === "q-owl"), "đã có thì liệt kê");
    assert.equal(ITEMS.filter((i) => i.quest).length, 10);
  });
  test("giờ VN, nhận quà túi giấy ăn theo tên không dấu", () => {
    assert.equal(vnHour(atVn(1, 30)), 1);
    assert.equal(vnHour(atVn(23)), 23);
    assert.ok(isTissueReward("Túi Giấy Ăn Nhỏ Hoạt Hình"));
    assert.ok(isTissueReward("khăn giấy mèo"));
    assert.ok(!isTissueReward("Gấu bông"));
  });
});

describe("Cấp biệt danh", () => {
  test("cấp 1 lần: thêm vào túi (QUEST), tự đeo, có thông báo; cấp lại không trùng", async () => {
    const s = await fx.user();
    assert.equal(await tx((t) => grantQuestInTx(t, s.id, "owl")), true);
    assert.equal(await tx((t) => grantQuestInTx(t, s.id, "owl")), false);
    const item = await prisma.userItem.findUnique({ where: { userId_itemId: { userId: s.id, itemId: "q-owl" } } });
    assert.equal(item?.source, "QUEST");
    assert.equal(item?.expiresAt, null);
    const av = await prisma.userAvatar.findUnique({ where: { userId: s.id } });
    assert.equal((av?.config as { title?: string }).title, "q-owl");
    assert.equal(await prisma.notification.count({ where: { userId: s.id, title: { contains: "nhiệm vụ ẩn" } } }), 1);
  });

  test("biệt danh 24 giờ: hết hạn thì không còn sở hữu, cấp lại được", async () => {
    const s = await fx.user();
    const past = new Date(Date.now() - 25 * H);
    assert.equal(await tx((t) => grantQuestInTx(t, s.id, "catlover", past)), true);
    assert.ok(!(await getOwnedItemIds(s.id)).includes("q-catlover"), "hết hạn → không còn");
    assert.equal(await tx((t) => grantQuestInTx(t, s.id, "catlover")), true, "hết hạn → cấp lại");
    assert.ok((await getOwnedItemIds(s.id)).includes("q-catlover"));
    assert.equal(await tx((t) => grantQuestInTx(t, s.id, "catlover")), false, "còn hạn → không cấp lại");
  });

  test("học sinh chưa duyệt không nhận", async () => {
    const s = await fx.user({ isApproved: false });
    assert.deepEqual(await runQuestsSafely("test", s.id, async () => ["owl"]), []);
  });
});

describe("Điều kiện khi nộp bài", () => {
  const ids = (xs: string[]) => new Set(xs);

  test("cú đêm 0h–3h, dậy sớm 5h–8h (cả bài tập về nhà)", async () => {
    const s = await fx.user();
    assert.ok(ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "homework", now: atVn(1) }))).has("owl"));
    assert.ok(ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "homework", now: atVn(6, 30) }))).has("early"));
    const noon = ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "homework", now: atVn(12) })));
    assert.ok(!noon.has("owl") && !noon.has("early"));
  });

  test("nộp trong 30 phút cuối trước hạn → Phút 89; sớm hơn hoặc trễ thì không", async () => {
    const s = await fx.user();
    const now = atVn(15);
    const check = (due: Date) => tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "test", now, due, testId: "x", score: null }));
    assert.ok(ids(await check(new Date(now.getTime() + 20 * MIN))).has("deadline89"));
    assert.ok(!ids(await check(new Date(now.getTime() + 40 * MIN))).has("deadline89"));
    assert.ok(!ids(await check(new Date(now.getTime() - 5 * MIN))).has("deadline89"));
  });

  test("điểm 10 → Quái Vật; tăng ≥ 2,5 so với bài trước → Lội Ngược Dòng", async () => {
    const s = await fx.user();
    const t1 = await fx.test();
    const t2 = await fx.test();
    await fx.attempt(t1.id, s.id, 5, new Date(Date.now() - 2 * H));
    const now = new Date();
    const up = ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "test", now, testId: t2.id, score: 7.5 })));
    assert.ok(up.has("comeback") && !up.has("perfect"));
    assert.ok(!ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "test", now, testId: t2.id, score: 7.4 }))).has("comeback"));
    assert.ok(ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "test", now, testId: t2.id, score: 10 }))).has("perfect"));
  });

  test("rùa: lần đầu trễ sau 5 bài đúng hạn liền; thiếu 1 bài đúng hạn thì không", async () => {
    const mk = async (onTime: number) => {
      const s = await fx.user();
      for (let i = 0; i < 5; i++) {
        const at = new Date(Date.now() - (10 - i) * H);
        await prisma.pointLedger.create({ data: { userId: s.id, amount: 300, source: "TEST_SUBMIT", key: `TEST:t${i}`, createdAt: at } });
        if (i < onTime) await prisma.pointLedger.create({ data: { userId: s.id, amount: 150, source: "ON_TIME", key: `ONTIME:t${i}`, createdAt: at } });
      }
      const now = new Date();
      return ids(await tx((t) => checkSubmitQuests(t, { userId: s.id, kind: "test", now, due: new Date(now.getTime() - H), testId: "t9", score: null })));
    };
    assert.ok((await mk(5)).has("turtle"));
    assert.ok(!(await mk(4)).has("turtle"));
  });

  test("rồng: trên 5.000 xu và chưa từng tiêu → có; đã đổi quà → không", async () => {
    const a = await fx.user();
    await fx.give(a.id, 6000);
    assert.ok(ids(await tx((t) => checkSubmitQuests(t, { userId: a.id, kind: "homework", now: atVn(12) }))).has("dragon"));
    const b = await fx.user();
    await fx.give(b.id, 7000);
    await prisma.pointLedger.create({ data: { userId: b.id, amount: -500, source: "REDEEM", reason: "đổi quà" } });
    assert.ok(!ids(await tx((t) => checkSubmitQuests(t, { userId: b.id, kind: "homework", now: atVn(12) }))).has("dragon"));
    const c = await fx.user();
    await fx.give(c.id, 4000);
    assert.ok(!ids(await tx((t) => checkSubmitQuests(t, { userId: c.id, kind: "homework", now: atVn(12) }))).has("dragon"));
  });
});

describe("Mở hộp, đổi quà", () => {
  test("hộp ra Sử thi / Huyền thoại → May Mắn", () => {
    assert.deepEqual(checkGachaQuests("legendary"), ["lucky"]);
    assert.deepEqual(checkGachaQuests("epic"), ["lucky"]);
    assert.deepEqual(checkGachaQuests("rare"), []);
  });

  test("người đầu tiên trong lớp đổi túi giấy ăn → Người Mở Đường; người sau thì không", async () => {
    const cls = await fx.cls();
    const [a, b] = await Promise.all([fx.user({ classId: cls.id }), fx.user({ classId: cls.id })]);
    const reward = await prisma.reward.create({ data: { title: `${fx.tag} Túi Giấy Ăn Nhỏ Hoạt Hình`, price: 6000 } });
    const r1 = await prisma.redemption.create({ data: { userId: a.id, rewardId: reward.id, price: 6000, createdAt: new Date(Date.now() - MIN) } });
    const r2 = await prisma.redemption.create({ data: { userId: b.id, rewardId: reward.id, price: 6000 } });
    assert.deepEqual(await tx((t) => checkRedeemQuests(t, { userId: a.id, redemptionId: r1.id })), ["tissue"]);
    assert.deepEqual(await tx((t) => checkRedeemQuests(t, { userId: b.id, redemptionId: r2.id })), []);
  });
});

describe("Luồng thật (móc nối nộp bài)", () => {
  test("nộp bài 10 phút trước hạn → vẫn cộng xu, thêm biệt danh Phút 89 tự đeo", async () => {
    applyLegacyEarning(); // xu bài kiểm tra mặc định tắt từ 26/11 — bật lại để kiểm cả việc cộng xu
    const s = await fx.user();
    const t1 = await fx.test({ dueDate: new Date(Date.now() + 10 * MIN) });
    const at = await fx.attempt(t1.id, s.id, 6);
    await onTestSubmitted({ userId: s.id, attemptId: at.id, test: { id: t1.id, dueDate: t1.dueDate, courseId: null }, score: 6, answeredCount: 10, questionCount: 10, hasPendingEssay: false });
    assert.ok((await fx.balance(s.id)) > 0, "vẫn cộng xu nộp bài");
    assert.ok((await getOwnedItemIds(s.id)).includes("q-deadline89"));
    const av = await prisma.userAvatar.findUnique({ where: { userId: s.id } });
    assert.equal((av?.config as { title?: string }).title, "q-deadline89");
  });
});
