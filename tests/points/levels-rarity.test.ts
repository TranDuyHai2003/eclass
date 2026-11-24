/**
 * Cấp độ (theo tổng điểm đã kiếm) và độ hiếm quà (theo giá) — thuần logic.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, getLevel } from "@/lib/points/levels";
import { rarityOf, RARITY_THRESHOLDS } from "@/lib/points/rarity";
import { REWARD_TEMPLATES } from "@/lib/points/templates";
import { resolveKindFilter } from "@/lib/points/filters";

describe("Cấp độ", () => {
  test("mốc tăng dần, bắt đầu từ 0", () => {
    assert.equal(LEVELS[0].min, 0);
    for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].min > LEVELS[i - 1].min);
  });

  test("đúng cấp ở ranh giới mốc", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      assert.equal(getLevel(LEVELS[i].min).level, i + 1, `đúng mốc ${LEVELS[i].min}`);
      if (i > 0) assert.equal(getLevel(LEVELS[i].min - 1).level, i, `trước mốc ${LEVELS[i].min}`);
    }
  });

  test("tiến độ và điểm còn thiếu", () => {
    const l = getLevel(LEVELS[1].min + Math.floor((LEVELS[2].min - LEVELS[1].min) / 2));
    assert.equal(l.level, 2);
    assert.ok(l.progress >= 45 && l.progress <= 55);
    assert.equal(l.toNext, LEVELS[2].min - (LEVELS[1].min + Math.floor((LEVELS[2].min - LEVELS[1].min) / 2)));
    assert.equal(getLevel(0).progress, 0);
  });

  test("cấp cao nhất: không có cấp tiếp, tiến độ 100", () => {
    const top = getLevel(LEVELS.at(-1)!.min + 999);
    assert.equal(top.level, LEVELS.length);
    assert.equal(top.next, null);
    assert.equal(top.toNext, 0);
    assert.equal(top.progress, 100);
  });

  test("giá trị lạ (âm, NaN, số lẻ) không làm vỡ", () => {
    for (const v of [-10, NaN, Infinity, 24.9]) {
      const l = getLevel(v);
      assert.ok(l.level >= 1 && l.progress >= 0 && l.progress <= 100, String(v));
    }
    assert.equal(getLevel(LEVELS[1].min - 0.1).level, 1);
  });

  test("bảng cấp theo tài liệu thầy (24/11): 8 cấp, học chăm (~12 000 xu/tháng) lên Lv.4 sau 1 tháng, Lv.8 sau ~2,5 tháng", () => {
    assert.equal(LEVELS.length, 8);
    assert.deepEqual(LEVELS.map((l) => l.min), [0, 2000, 5000, 9000, 13000, 20000, 25000, 30000]);
    assert.equal(getLevel(1999).name, "Chó rách hết tiền");
    assert.equal(getLevel(12000).level, 4);
    assert.equal(getLevel(30000).level, 8);
    assert.match(getLevel(30000).name, /^Thiếu Gia/);
    assert.match(getLevel(30000, "female").name, /^Tiểu Thư/);
    assert.match(getLevel(29000, "female").next!.short, /^Tiểu Thư/);
    assert.equal(getLevel(30000, "male").short, "Thiếu Gia 999 Tỷ Xu");
  });
});

describe("Độ hiếm quà", () => {
  test("theo mốc giá", () => {
    assert.equal(rarityOf(1).key, "common");
    assert.equal(rarityOf(RARITY_THRESHOLDS.common).key, "common");
    assert.equal(rarityOf(RARITY_THRESHOLDS.common + 1).key, "rare");
    assert.equal(rarityOf(RARITY_THRESHOLDS.rare).key, "rare");
    assert.equal(rarityOf(RARITY_THRESHOLDS.rare + 1).key, "epic");
    assert.equal(rarityOf(RARITY_THRESHOLDS.epic).key, "epic");
    assert.equal(rarityOf(RARITY_THRESHOLDS.epic + 1).key, "legendary");
  });

  test("mẫu quà trải đủ các độ hiếm", () => {
    const kinds = new Set(REWARD_TEMPLATES.map((t) => rarityOf(t.price).key));
    for (const k of ["common", "rare", "legendary"]) assert.ok(kinds.has(k as any), k);
  });
});

describe("Bộ lọc loại quà (hồi quy review Gemini)", () => {
  test("chỉ một loại quà → luôn 'Tất cả'", () => {
    assert.equal(resolveKindFilter("VIRTUAL", ["VIRTUAL"]), "ALL");
    assert.equal(resolveKindFilter("PHYSICAL", []), "ALL");
  });
  test("loại đang chọn biến mất sau khi làm mới → về 'Tất cả' (không kẹt lưới trống)", () => {
    assert.equal(resolveKindFilter("VIRTUAL", ["PHYSICAL", "OTHER"]), "ALL");
  });
  test("loại đang chọn còn quà → giữ nguyên", () => {
    assert.equal(resolveKindFilter("VIRTUAL", ["PHYSICAL", "VIRTUAL"]), "VIRTUAL");
    assert.equal(resolveKindFilter("ALL", ["PHYSICAL", "VIRTUAL"]), "ALL");
  });
});
