/**
 * Cấu hình Xu (tiền thưởng học tập) — chỉnh số ở đây, không cần đụng logic.
 *
 * Thang xu = thang điểm cũ × 150 (quyết định 21/11/2026): nộp bài 300 xu. Ý nghĩa giữ nguyên — học sinh chăm cả tháng
 * (~5 bài/tuần điểm khá, 2 bài tập về nhà/tuần) được ~12 000 xu, vừa đủ đổi một món quà nhỏ (vd gói bim bim).
 * Học sinh trung bình ~6 000 xu/tháng.
 */
export const POINTS_LABEL = "Xu";
/** Đơn vị viết thường trong câu: "300 xu" */
export const POINTS_UNIT = "xu";
export const GEM_LABEL = "Ngọc";
export const GEM_UNIT = "ngọc";

/** Tắt nhanh toàn bộ tính năng: đặt biến môi trường POINTS_ENABLED=off (không cần deploy lại). */
export function isPointsEnabled() {
  return (process.env.POINTS_ENABLED ?? "on").toLowerCase() !== "off";
}

export const POINTS = {
  /** Nộp bài kiểm tra / bài tập trắc nghiệm (lần đầu) */
  testSubmit: 300,
  /** Nộp sau hạn */
  testSubmitLate: 150,
  /** Nộp đúng hạn (chỉ khi đề có hạn hiệu lực với học sinh — hạn lớp hoặc hạn chung) */
  onTimeBonus: 150,
  /** Phải làm ít nhất tỉ lệ này số câu mới được xu nộp bài (chống nộp trắng lấy xu) */
  minAnsweredRatio: 0.5,
  /** Thưởng theo điểm bài (lấy mức cao nhất đạt được) */
  scoreTiers: [
    { min: 10, points: 450 },
    { min: 8.5, points: 300 },
    { min: 7, points: 150 },
  ],
  /** Bứt phá: điểm bài này ≥ trung bình `window` bài gần nhất + `margin` (cần ít nhất `minPrevious` bài trước) */
  breakthrough: { points: 150, window: 5, minPrevious: 3, margin: 1.5 },
  /** Đề thi cuối khoá: xu nộp bài riêng, thưởng điểm cao nhân hệ số */
  finalTestSubmit: 750,
  finalScoreMultiplier: 2,
  /** Bài tập về nhà (nộp ảnh) */
  homeworkSubmit: 150,
  homeworkPass: 150,
  /** Tối đa xu tự động (bài kiểm tra, bài tập) mỗi ngày — chặn bất thường */
  dailyAutoCap: 4500,
  /** Chuỗi tuần học: tuần đạt khi có ít nhất `minActivities` lần nộp bài (kiểm tra hoặc bài tập về nhà) */
  streak: {
    minActivities: 2,
    /** Xu thưởng khi chuỗi đạt mốc (số tuần → xu) */
    milestones: { 2: 300, 4: 600, 8: 1200, 12: 1800 } as Record<number, number>,
    /** Sau 12 tuần: cứ mỗi 4 tuần thêm */
    every4WeeksAfter12: 1800,
    /** Mỗi 4 tuần liên tiếp được thêm 1 thẻ giữ chuỗi, giữ tối đa */
    maxFreezes: 2,
  },
  /** Giáo viên thưởng/trừ tay */
  manual: { maxPerGrant: 1500, dailyCapPerStudent: 1500 },
  /** Yêu cầu đổi quà chưa trao sau số ngày này thì tự hết hạn và hoàn xu */
  pendingExpiryDays: 30,
} as const;

/** Các nguồn xu tự động tính vào giới hạn mỗi ngày */
export const AUTO_CAPPED_SOURCES = ["TEST_SUBMIT", "ON_TIME", "TEST_SCORE", "BREAKTHROUGH", "HOMEWORK_SUBMIT", "HOMEWORK_PASS"] as const;

/** Các lần nộp bài được tính là "hoạt động" của chuỗi tuần */
export const STREAK_ACTIVITY_SOURCES = ["TEST_SUBMIT", "FINAL_TEST", "HOMEWORK_SUBMIT"] as const;

/**
 * Các nguồn tính vào "tổng xu đã kiếm" (lifetimeEarned → danh hiệu). Chỉ xu từ HỌC và thầy thưởng;
 * mã quà tặng, gacha, mua đồ, đổi/hoàn quà không ảnh hưởng danh hiệu. REVOKE (âm) trừ lại phần đã kiếm.
 */
export const EARNING_SOURCES = [
  "TEST_SUBMIT", "ON_TIME", "TEST_SCORE", "BREAKTHROUGH", "FINAL_TEST", "HOMEWORK_SUBMIT", "HOMEWORK_PASS", "STREAK", "MANUAL", "REVOKE",
] as const;

export const SOURCE_LABEL: Record<string, string> = {
  TEST_SUBMIT: "Nộp bài",
  ON_TIME: "Đúng hạn",
  TEST_SCORE: "Điểm cao",
  BREAKTHROUGH: "Bứt phá",
  FINAL_TEST: "Thi cuối khoá",
  HOMEWORK_SUBMIT: "Nộp bài tập về nhà",
  HOMEWORK_PASS: "Bài tập về nhà đạt",
  STREAK: "Chuỗi tuần học",
  MANUAL: "Thầy thưởng",
  REDEEM: "Đổi quà",
  REFUND: "Hoàn xu",
  REVOKE: "Thu hồi",
  GIFTCODE: "Mã quà tặng",
  GACHA: "Rương bí ẩn",
  ITEM: "Mua đồ trang trí",
};

const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Quy tắc hiển thị cho học sinh (trang Xu) — lấy từ cấu hình để luôn khớp (hàm: admin sửa mức xu → tính lại) */
export const earningRules = (): { label: string; points: string; note?: string }[] => [
  { label: "Nộp bài kiểm tra / bài tập", points: `+${fmt(POINTS.testSubmit)}`, note: `Nộp sau hạn +${fmt(POINTS.testSubmitLate)}. Cần làm ít nhất một nửa số câu` },
  { label: "Nộp đúng hạn", points: `+${fmt(POINTS.onTimeBonus)}`, note: "Khi bài có hạn nộp và bạn nộp kịp" },
  {
    label: "Điểm cao",
    points: POINTS.scoreTiers.map((t) => `+${fmt(t.points)}`).reverse().join(" / "),
    note: POINTS.scoreTiers.map((t) => `≥${String(t.min).replace(".", ",")}`).reverse().join(" / "),
  },
  { label: "Bứt phá", points: `+${fmt(POINTS.breakthrough.points)}`, note: `Cao hơn trung bình ${POINTS.breakthrough.window} bài gần nhất từ ${String(POINTS.breakthrough.margin).replace(".", ",")} điểm` },
  { label: "Đề thi cuối khoá", points: `+${fmt(POINTS.finalTestSubmit)}`, note: `Thưởng điểm cao ×${POINTS.finalScoreMultiplier}` },
  { label: "Nộp bài tập về nhà", points: `+${fmt(POINTS.homeworkSubmit)}`, note: `Được chấm Đạt thêm +${fmt(POINTS.homeworkPass)}` },
  {
    label: "Chuỗi tuần học",
    points: Object.values(POINTS.streak.milestones).map((v) => `+${fmt(v)}`).join(" / "),
    note: `Mốc ${Object.keys(POINTS.streak.milestones).join(" / ")} tuần liên tiếp, mỗi tuần nộp ít nhất ${POINTS.streak.minActivities} bài`,
  },
  { label: "Thầy thưởng", points: `+1 … +${fmt(POINTS.manual.maxPerGrant)}`, note: "Phát biểu, giúp bạn, đi học đầy đủ…" },
  { label: "Mã quà tặng", points: "Ngọc", note: "Thẻ cào thầy phát khi được điểm 10 trên lớp — nhập mã ở tiệm" },
];
