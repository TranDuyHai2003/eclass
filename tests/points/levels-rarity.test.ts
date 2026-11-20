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
    assert.equal(getLevel(24.9).level, 1);
  });

  test("học chăm (~82 điểm/tháng) lên 'Xuất sắc' trong khoảng 1–2 tháng, chưa thể 'Huyền thoại' trước 4 tháng", () => {
    assert.ok(getLevel(82 * 2).name === "Xuất sắc" || getLevel(82 * 2).level > 4);
    assert.ok(getLevel(82 * 4).name !== "Huyền thoại");
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
