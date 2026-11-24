/**
 * Bộ quà của tiệm theo canvas ShopV2: đủ 10 quà hiện vật + 7 thẻ đặc quyền (+ Túi giấy ăn cho nhiệm vụ ẩn), mỗi món ra đúng tranh và đúng tab,
 * nút "Thêm cả bộ" thêm một lần, không thêm trùng (DB local, chạy trong giao dịch rồi huỷ → không để lại dữ liệu).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { SHOP_TEMPLATES, missingShopTemplates } from "@/lib/points/templates";
import { addShopTemplatesInTx } from "@/lib/points/shop-templates";
import { normalizeRewardInput } from "@/lib/points/reward-input";
import { rewardArtV2 } from "@/components/studio/Sprite";
import { isTissueReward } from "@/lib/game/quests-shared";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

describe("Bộ quà của tiệm (canvas)", () => {
  test("10 quà hiện vật + 7 thẻ đặc quyền, mỗi món một tranh riêng đúng thứ tự canvas; thêm Túi giấy ăn (tranh riêng)", () => {
    const tissue = SHOP_TEMPLATES.filter((t) => isTissueReward(t.title));
    assert.equal(tissue.length, 1, "có đúng một quà túi giấy ăn để mở nhiệm vụ ẩn");
    assert.equal(tissue[0].kind, "PHYSICAL");
    const physical = SHOP_TEMPLATES.filter((t) => t.kind === "PHYSICAL" && !isTissueReward(t.title));
    const virtual = SHOP_TEMPLATES.filter((t) => t.kind === "VIRTUAL");
    assert.equal(physical.length, 10);
    assert.equal(virtual.length, 7);
    // Tranh v2: quà hiện vật ô 0–9, thẻ đặc quyền ô 10–16 (theo thứ tự trong canvas)
    assert.deepEqual(physical.map((t) => rewardArtV2(t.title, t.kind)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(virtual.map((t) => rewardArtV2(t.title, t.kind)), [10, 11, 12, 13, 14, 15, 16]);
  });

  test("mẫu hợp lệ với form quà; quà hiện vật có số lượng, thẻ đặc quyền giới hạn theo tháng", () => {
    for (const t of SHOP_TEMPLATES) {
      const r = normalizeRewardInput({ ...t, classIds: [], isActive: true });
      assert.ok(!("error" in r), t.title);
      if (t.kind === "PHYSICAL") assert.ok((t.stock ?? 0) > 0 && (t.costVnd ?? 0) > 0, t.title);
      else assert.ok(t.perStudentMonthlyLimit && t.costVnd === 0, t.title);
    }
  });

  test("thẻ đặc quyền giữ lựa chọn 'chỉ dùng tại lớp' khi lưu / sửa; quà hiện vật luôn chỉ offline", () => {
    const base = { title: "x", price: 10, classIds: [], isActive: true };
    const ok = (r: ReturnType<typeof normalizeRewardInput>) => ("data" in r ? r.data.offlineOnly : null);
    assert.equal(ok(normalizeRewardInput({ ...base, kind: "VIRTUAL" })), false);
    assert.equal(ok(normalizeRewardInput({ ...base, kind: "VIRTUAL", offlineOnly: true })), true);
    assert.equal(ok(normalizeRewardInput({ ...base, kind: "PHYSICAL", offlineOnly: false })), true);
  });

  test("thiếu món nào thì chỉ thêm món đó (so tên không phân biệt hoa thường)", () => {
    assert.equal(missingShopTemplates([]).length, 18);
    const rest = missingShopTemplates(["trà sữa tai mèo 700ml ", "VÉ MIỄN TRỰC NHẬT 1 TUẦN"]);
    assert.equal(rest.length, 16);
    assert.ok(!rest.some((t) => t.title === "Trà Sữa Tai Mèo 700ml"));
  });

  test("Thêm cả bộ: tạo đủ món đang bật, bấm lần hai không tạo trùng", async () => {
    const staff = await fx.user({ role: "TEACHER" });
    const ROLLBACK = new Error("rollback");
    await prisma
      .$transaction(async (tx) => {
        const before = await tx.reward.findMany({ where: { deletedAt: null }, select: { title: true } });
        const expect = missingShopTemplates(before.map((r) => r.title)).length;
        assert.equal(await addShopTemplatesInTx(tx, staff.id), expect);
        assert.equal(await addShopTemplatesInTx(tx, staff.id), 0, "lần hai không thêm");
        const rows = await tx.reward.findMany({ where: { title: { in: SHOP_TEMPLATES.map((t) => t.title) }, deletedAt: null } });
        assert.equal(new Set(rows.map((r) => r.title)).size, 18);
        const tea = rows.find((r) => r.title === "Trà Sữa Tai Mèo 700ml" && r.createdById === staff.id);
        if (tea) {
          assert.equal(tea.kind, "PHYSICAL");
          assert.equal(tea.offlineOnly, true);
          assert.equal(tea.isActive, true);
          assert.equal(tea.stock, 5);
        }
        // Thẻ dùng tại lớp (miễn trực nhật, chọn chỗ, chọn nhạc) ẩn với học sinh online; thẻ khác ai cũng đổi được
        const byTitle = (t: string) => rows.find((r) => r.title === t && r.createdById === staff.id);
        for (const t of ["Vé Miễn Trực Nhật 1 Tuần", "Vé Chọn Chỗ Cạnh Bạn Thân", "Vé Chọn Nhạc Giải Lao 10p"]) {
          const r = byTitle(t);
          if (r) assert.equal(r.offlineOnly, true, t);
        }
        const late = byTitle("Phiếu Gia Hạn Bài +24h");
        if (late) assert.equal(late.offlineOnly, false);
        throw ROLLBACK;
      })
      .catch((e) => {
        if (e !== ROLLBACK) throw e;
      });
  });
});
