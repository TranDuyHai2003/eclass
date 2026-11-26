/**
 * Test thuần logic (không cần DB): thang điểm, cân bằng "kinh tế điểm", chuẩn hoá form quà, kiểm tra thưởng tay, giờ VN.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PointSource } from "@prisma/client";
import { earningRules, POINTS, SOURCE_LABEL } from "@/lib/points/config";
import { vndToXu } from "@/lib/points/vnd";
import { setGameConfigForTests } from "@/lib/game/game-config";
import { applyLegacyEarning } from "../helpers/legacy-earning";
import { scoreTierPoints } from "@/lib/points/hooks";
import { vietnamDayStart } from "@/lib/points/engine";
import { normalizeRewardImageUrl, normalizeRewardInput, type RewardInput } from "@/lib/points/reward-input";
import { validateManualGrant } from "@/lib/points/manual";
import { REWARD_TEMPLATES } from "@/lib/points/templates";
import { RARITY_THRESHOLDS } from "@/lib/points/rarity";

describe("Thang điểm", () => {
  test("mức thưởng điểm cao đúng ngưỡng", () => {
    const [t10, t85, t7] = POINTS.scoreTiers.map((t) => t.points);
    const cases: [number, number][] = [
      [0, 0], [6.99, 0], [7, t7], [8.49, t7], [8.5, t85], [9.99, t85], [10, t10],
    ];
    for (const [score, pts] of cases) assert.equal(scoreTierPoints(score), pts, `điểm ${score}`);
  });

  test("ngưỡng sắp xếp giảm dần (để tìm mức cao nhất trước)", () => {
    const mins = POINTS.scoreTiers.map((t) => t.min);
    assert.deepEqual([...mins].sort((a, b) => b - a), mins);
  });

  test("mọi nguồn điểm trong DB đều có nhãn tiếng Việt", () => {
    for (const s of Object.values(PointSource)) assert.ok(SOURCE_LABEL[s], `thiếu nhãn cho ${s}`);
  });

  test("bảng 'Cách nhận xu' theo cơ chế 3 hành động; nguồn đang tắt (0 xu) không hiện", () => {
    const rules = earningRules();
    assert.equal(rules[0].label, "Nộp bài tập về nhà đúng hạn");
    assert.equal(rules[0].points, `+${POINTS.homeworkSubmit}`);
    assert.equal(rules.find((r) => r.label === "Thầy duyệt chữa bài")?.points, "+280 / +400");
    assert.ok(rules.some((r) => r.label === "Mã quà tặng"));
    assert.ok(!rules.some((r) => r.label.startsWith("Nộp bài kiểm tra") || r.label === "Điểm cao" || r.label === "Chuỗi tuần học"), "nguồn cũ đã tắt");
    for (const r of rules) assert.ok(r.label && r.points, "mỗi dòng có nhãn và điểm");
  });

  test("admin bật lại xu bài kiểm tra → bảng hiện lại đúng số", () => {
    applyLegacyEarning();
    try {
      assert.equal(earningRules().find((r) => r.label.startsWith("Nộp bài kiểm tra"))?.points, "+300");
      const tiers = earningRules().find((r) => r.label === "Điểm cao");
      assert.equal(tiers?.points, "+150 / +300 / +450");
      assert.equal(tiers?.note, "≥7 / ≥8,5 / ≥10");
    } finally {
      setGameConfigForTests(null);
    }
  });
});

describe("Cân bằng kinh tế xu (26/11: chỉ 3 hành động, giá = tiền thật ÷ 3,6)", () => {
  /** Xu một tháng (4 tuần) chỉ từ bài tập về nhà */
  const month = (hwPerWeek: number, onTimeRate: number, review: "NONE" | "PARTIAL" | "FULL") =>
    Math.round(4 * hwPerWeek * (POINTS.homeworkSubmit * onTimeRate + (review === "FULL" ? POINTS.homeworkReview.full : review === "PARTIAL" ? POINTS.homeworkReview.partial : 0)));
  const byTitle = (t: string) => REWARD_TEMPLATES.find((x) => x.title === t)!;

  test("mức xu theo tài liệu thầy: nộp đúng hạn 100, có chữa 280, chữa đủ 400; nguồn cũ tắt", () => {
    assert.equal(POINTS.homeworkSubmit, 100);
    assert.deepEqual({ ...POINTS.homeworkReview }, { partial: 280, full: 400 });
    for (const v of [POINTS.testSubmit, POINTS.onTimeBonus, POINTS.breakthrough.points, POINTS.finalTestSubmit, POINTS.homeworkPass, ...POINTS.scoreTiers.map((t) => t.points), ...Object.values(POINTS.streak.milestones)]) assert.equal(v, 0);
  });

  test("học sinh chăm (2 bài/tuần, đúng hạn, chữa đủ): mỗi tháng đổi được quà nhỏ, trà sữa trong khoảng 2–3 tháng", () => {
    const diligent = month(2, 1, "FULL");
    assert.equal(diligent, 4000);
    assert.ok(diligent >= byTitle("Gói bim bim").price, "đủ 1 gói bim bim mỗi tháng");
    const tea = byTitle("Trà Sữa Tai Mèo 700ml").price;
    assert.ok(tea > diligent && tea <= diligent * 3, `trà sữa ${tea} xu ≈ 2–3 tháng`);
  });

  test("học sinh chỉ nộp, không chữa vẫn đổi được quà rẻ nhất sau 1 tháng", () => {
    const lazy = month(2, 1, "NONE");
    assert.ok(lazy >= Math.min(...REWARD_TEMPLATES.map((t) => t.price)), `${lazy} xu/tháng`);
    assert.ok(lazy < byTitle("Gói bim bim").price * 1.5, "nhưng ít hơn hẳn bạn chữa bài");
  });

  test("giá mẫu = tiền thật ÷ 3,6 làm tròn lên trăm (quà hiện vật theo chi phí thật)", () => {
    for (const t of REWARD_TEMPLATES.filter((x) => x.kind === "PHYSICAL")) assert.equal(t.price, vndToXu(t.costVnd ?? 0), t.title);
    assert.equal(byTitle("Trà Sữa Tai Mèo 700ml").price, 8400);
  });

  test("thưởng tay mỗi lần / mỗi ngày không quá 1 bài tập làm tốt", () => {
    const best = POINTS.homeworkSubmit + POINTS.homeworkReview.full;
    assert.ok(POINTS.manual.maxPerGrant <= best && POINTS.manual.dailyCapPerStudent <= best);
  });

  test("mẫu quà: giá hợp lệ, có quà rẻ cho học sinh trung bình", () => {
    for (const t of REWARD_TEMPLATES) {
      const r = normalizeRewardInput({ ...t, classIds: [], isActive: true });
      assert.ok(!("error" in r), `mẫu "${t.title}" hợp lệ`);
    }
    assert.ok(REWARD_TEMPLATES.some((t) => t.price <= RARITY_THRESHOLDS.common), "có quà Phổ thông cho học sinh trung bình");
    assert.equal(new Set(REWARD_TEMPLATES.map((t) => t.title)).size, REWARD_TEMPLATES.length, "tên mẫu không trùng");
  });
});

describe("Chuẩn hoá form quà", () => {
  const base: RewardInput = { title: " Bim bim ", price: 100, kind: "PHYSICAL", classIds: [], isActive: true };

  test("hợp lệ: cắt khoảng trắng, quà hiện vật chỉ HS offline", () => {
    const r = normalizeRewardInput(base);
    assert.ok("data" in r);
    assert.equal(r.data.title, "Bim bim");
    assert.equal(r.data.offlineOnly, true);
    assert.equal(r.data.stock, null);
    assert.equal(r.data.perStudentMonthlyLimit, null);
  });

  test("quà 'Mọi học sinh' không giới hạn offline", () => {
    const r = normalizeRewardInput({ ...base, kind: "VIRTUAL" });
    assert.ok("data" in r && r.data.offlineOnly === false && r.data.kind === "VIRTUAL");
  });

  test("ảnh quà: chỉ nhận ảnh trên CDN của web (https) hoặc đường dẫn tĩnh; thiếu ô ảnh → giữ ảnh cũ, rỗng → bỏ ảnh", () => {
    const cdn = "https://cdn.teacherduc.me/file/teacherduc-video-storage/images/abc-qua.webp";
    assert.equal(normalizeRewardImageUrl(cdn), cdn);
    assert.equal(normalizeRewardImageUrl("https://s3.us-east-005.backblazeb2.com/x/qua.png"), "https://s3.us-east-005.backblazeb2.com/x/qua.png");
    assert.equal(normalizeRewardImageUrl("/news1.png"), "/news1.png");
    for (const v of ["", "  ", null, undefined]) assert.equal(normalizeRewardImageUrl(v), null, String(v));
    for (const bad of ["javascript:alert(1)", "http://cdn.teacherduc.me/a.png", "https://evil.com/a.png", "https://cdn.teacherduc.me.evil.com/a.png", "//evil.com/a.png", "data:image/png;base64,AAAA", 42, "/" + "a".repeat(600)]) {
      assert.equal(normalizeRewardImageUrl(bad), false, String(bad));
    }
    // Form không có ô ảnh (trang quản lý quà cũ) → không đụng ảnh đang có
    const keep = normalizeRewardInput(base);
    assert.ok("data" in keep && !("imageUrl" in keep.data));
    const set = normalizeRewardInput({ ...base, imageUrl: cdn });
    assert.ok("data" in set && set.data.imageUrl === cdn);
    const clear = normalizeRewardInput({ ...base, imageUrl: null });
    assert.ok("data" in clear && clear.data.imageUrl === null);
    assert.ok("error" in normalizeRewardInput({ ...base, imageUrl: "https://evil.com/x.png" }));
  });

  test("kind lạ → coi là quà hiện vật", () => {
    const r = normalizeRewardInput({ ...base, kind: "HACK" as any });
    assert.ok("data" in r && r.data.kind === "PHYSICAL" && r.data.offlineOnly);
  });

  test("từ chối tên trống, giá ≤ 0, giá không phải số, giá quá lớn; quà 150 000 xu vẫn hợp lệ (review Gemini)", () => {
    assert.ok("data" in normalizeRewardInput({ ...base, price: 150000 }));
    for (const bad of [{ title: "   " }, { price: 0 }, { price: -5 }, { price: NaN }, { price: "abc" as any }, { price: 1e9 }]) {
      assert.ok("error" in normalizeRewardInput({ ...base, ...bad }), JSON.stringify(bad));
    }
  });

  test("số lượng/giới hạn/chi phí: rỗng hoặc âm → null, số lẻ → làm tròn xuống; 0 lần/tháng → không giới hạn", () => {
    const r = normalizeRewardInput({ ...base, price: 99.9, stock: -1, perStudentMonthlyLimit: 0, costVnd: 5999.7 });
    assert.ok("data" in r);
    assert.equal(r.data.price, 99);
    assert.equal(r.data.stock, null);
    assert.equal(r.data.perStudentMonthlyLimit, null);
    assert.equal(r.data.costVnd, 5999);
    const r2 = normalizeRewardInput({ ...base, stock: 0, perStudentMonthlyLimit: 2 });
    assert.ok("data" in r2 && r2.data.stock === 0 && r2.data.perStudentMonthlyLimit === 2, "kho 0 = hết hàng (giữ nguyên)");
  });

  test("tên/mô tả quá dài bị cắt; lớp trùng hoặc lớp giả '__none__' bị loại", () => {
    const r = normalizeRewardInput({ ...base, title: "x".repeat(500), description: "y".repeat(2000), classIds: ["a", "a", "__none__", ""] });
    assert.ok("data" in r);
    assert.equal(r.data.title.length, 120);
    assert.equal(r.data.description!.length, 500);
    assert.deepEqual(r.classIds, ["a"]);
  });
});

describe("Kiểm tra thưởng/trừ tay", () => {
  const max = POINTS.manual.maxPerGrant;
  test("hợp lệ: 1…max và -max…-1 có lý do", () => {
    for (const v of [1, max, -1, -max]) assert.equal(validateManualGrant(v, "Phát biểu"), null, String(v));
  });
  test("không hợp lệ: 0, vượt max, số lẻ, NaN, thiếu lý do", () => {
    for (const v of [0, max + 1, -max - 1, 1.5, NaN]) assert.ok(validateManualGrant(v, "x"), String(v));
    assert.ok(validateManualGrant(3, "   "));
    assert.ok(validateManualGrant(3, undefined));
  });
});

describe("Mốc ngày theo giờ Việt Nam", () => {
  test("23:59 VN vẫn là ngày cũ, 00:00 VN sang ngày mới", () => {
    assert.equal(vietnamDayStart(new Date("2026-11-19T16:59:59Z")).toISOString(), "2026-11-18T17:00:00.000Z");
    assert.equal(vietnamDayStart(new Date("2026-11-19T17:00:00Z")).toISOString(), "2026-11-19T17:00:00.000Z");
  });
});
