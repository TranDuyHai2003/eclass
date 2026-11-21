/**
 * Test thuần logic (không cần DB): thang điểm, cân bằng "kinh tế điểm", chuẩn hoá form quà, kiểm tra thưởng tay, giờ VN.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PointSource } from "@prisma/client";
import { EARNING_RULES, POINTS, SOURCE_LABEL } from "@/lib/points/config";
import { scoreTierPoints } from "@/lib/points/hooks";
import { vietnamDayStart } from "@/lib/points/engine";
import { normalizeRewardInput, type RewardInput } from "@/lib/points/reward-input";
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

  test("bảng 'Cách nhận điểm' hiển thị đúng số trong cấu hình", () => {
    const submit = EARNING_RULES.find((r) => r.label.startsWith("Nộp bài kiểm tra"));
    assert.equal(submit?.points, `+${POINTS.testSubmit}`);
    const tiers = EARNING_RULES.find((r) => r.label === "Điểm cao");
    assert.equal(tiers?.points, "+150 / +300 / +450");
    assert.equal(tiers?.note, "≥7 / ≥8,5 / ≥10");
    for (const r of EARNING_RULES) assert.ok(r.label && r.points, "mỗi dòng có nhãn và điểm");
  });
});

describe("Cân bằng kinh tế xu (chăm cả tháng ≈ 1 gói bim bim)", () => {
  // Mô phỏng một tháng (4 tuần)
  function month(p: { testsPerWeek: number; avgScore: number; homeworkPerWeek: number; homeworkPassRate: number }) {
    const perTest = POINTS.testSubmit + scoreTierPoints(p.avgScore);
    const perHw = POINTS.homeworkSubmit + POINTS.homeworkPass * p.homeworkPassRate;
    const weekly = p.testsPerWeek * perTest + p.homeworkPerWeek * perHw;
    const streak = p.testsPerWeek + p.homeworkPerWeek >= POINTS.streak.minActivities ? (POINTS.streak.milestones[2] ?? 0) + (POINTS.streak.milestones[4] ?? 0) : 0;
    return Math.round(weekly * 4 + streak);
  }
  const bimbim = REWARD_TEMPLATES.find((t) => t.title === "Gói bim bim")!;

  test("học sinh chăm cả tháng vừa đủ đổi 1 gói bim bim (không dư nhiều)", () => {
    const diligent = month({ testsPerWeek: 5, avgScore: 8, homeworkPerWeek: 2, homeworkPassRate: 1 });
    assert.ok(diligent >= bimbim.price, `chăm chỉ ${diligent} điểm phải đủ ${bimbim.price}`);
    assert.ok(diligent < bimbim.price * 1.5, `chăm chỉ ${diligent} điểm không nên đổi được 1,5 gói`);
  });

  test("học sinh trung bình cần hơn 1 tháng cho 1 gói bim bim", () => {
    const average = month({ testsPerWeek: 3, avgScore: 6, homeworkPerWeek: 1, homeworkPassRate: 0.5 });
    assert.ok(average < bimbim.price, `trung bình ${average} điểm/tháng`);
    assert.ok(average >= 20, "nhưng vẫn có điểm để thấy tiến bộ");
  });

  test("giới hạn ngày không chặn một ngày học bình thường (3 bài điểm 10 đúng hạn + 2 bài tập về nhà)", () => {
    const busyDay = 3 * (POINTS.testSubmit + POINTS.onTimeBonus + scoreTierPoints(10) + POINTS.breakthrough.points) + 2 * (POINTS.homeworkSubmit + POINTS.homeworkPass);
    assert.ok(busyDay <= POINTS.dailyAutoCap, `${busyDay} ≤ ${POINTS.dailyAutoCap}`);
  });

  test("nộp bài 300 xu; bài đúng hạn điểm 10 có bứt phá ≈ 300 × 3,5; đúng hạn không lớn hơn xu nộp bài", () => {
    assert.equal(POINTS.testSubmit, 300);
    const best = POINTS.testSubmit + POINTS.onTimeBonus + scoreTierPoints(10) + POINTS.breakthrough.points;
    assert.ok(best >= 300 * 3 && best <= 300 * 4, String(best));
    assert.ok(POINTS.onTimeBonus <= POINTS.testSubmit);
    assert.ok(POINTS.testSubmitLate < POINTS.testSubmit);
  });

  test("thưởng tay mỗi ngày không lấn át điểm học (≤ 1/5 quà lớn nhất trong mẫu thường dùng)", () => {
    assert.ok(POINTS.manual.dailyCapPerStudent <= bimbim.price / 5);
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
