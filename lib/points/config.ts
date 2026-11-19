/**
 * Cấu hình Điểm thưởng — chỉnh số ở đây, không cần đụng logic.
 *
 * Thang điểm cố ý nhỏ: học sinh chăm cả tháng (~4–5 bài/tuần, điểm khá, nộp bài tập về nhà) được ~80–100 điểm,
 * vừa đủ đổi một món quà nhỏ (vd gói bim bim). Học sinh trung bình ~40 điểm/tháng.
 */
export const POINTS_LABEL = "Điểm thưởng";

/** Tắt nhanh toàn bộ tính năng: đặt biến môi trường POINTS_ENABLED=off (không cần deploy lại). */
export function isPointsEnabled() {
  return (process.env.POINTS_ENABLED ?? "on").toLowerCase() !== "off";
}

export const POINTS = {
  /** Nộp bài kiểm tra / bài tập trắc nghiệm (lần đầu) */
  testSubmit: 2,
  /** Nộp sau hạn */
  testSubmitLate: 1,
  /** Phải làm ít nhất tỉ lệ này số câu mới được điểm nộp bài (chống nộp trắng lấy điểm) */
  minAnsweredRatio: 0.5,
  /** Thưởng theo điểm bài (lấy mức cao nhất đạt được) */
  scoreTiers: [
    { min: 10, points: 3 },
    { min: 8.5, points: 2 },
    { min: 7, points: 1 },
  ],
  /** Bứt phá: điểm bài này ≥ trung bình `window` bài gần nhất + `margin` (cần ít nhất `minPrevious` bài trước) */
  breakthrough: { points: 1, window: 5, minPrevious: 3, margin: 1.5 },
  /** Đề thi cuối khoá: điểm nộp bài riêng, thưởng điểm nhân hệ số */
  finalTestSubmit: 5,
  finalScoreMultiplier: 2,
  /** Bài tập về nhà (nộp ảnh) */
  homeworkSubmit: 1,
  homeworkPass: 1,
  /** Tối đa điểm tự động (bài kiểm tra, bài tập) mỗi ngày — chặn bất thường */
  dailyAutoCap: 20,
  /** Chuỗi tuần học: tuần đạt khi có ít nhất `minActivities` lần nộp bài (kiểm tra hoặc bài tập về nhà) */
  streak: {
    minActivities: 2,
    /** Điểm thưởng khi chuỗi đạt mốc (số tuần → điểm) */
    milestones: { 2: 2, 4: 4, 8: 8, 12: 12 } as Record<number, number>,
    /** Sau 12 tuần: cứ mỗi 4 tuần thêm */
    every4WeeksAfter12: 12,
    /** Mỗi 4 tuần liên tiếp được thêm 1 thẻ giữ chuỗi, giữ tối đa */
    maxFreezes: 2,
  },
  /** Giáo viên thưởng/trừ tay */
  manual: { maxPerGrant: 10, dailyCapPerStudent: 10 },
  /** Yêu cầu đổi quà chưa trao sau số ngày này thì tự hết hạn và hoàn điểm */
  pendingExpiryDays: 30,
} as const;

/** Các nguồn điểm tự động tính vào giới hạn mỗi ngày */
export const AUTO_CAPPED_SOURCES = ["TEST_SUBMIT", "TEST_SCORE", "BREAKTHROUGH", "HOMEWORK_SUBMIT", "HOMEWORK_PASS"] as const;

/** Các lần nộp bài được tính là "hoạt động" của chuỗi tuần */
export const STREAK_ACTIVITY_SOURCES = ["TEST_SUBMIT", "FINAL_TEST", "HOMEWORK_SUBMIT"] as const;

export const SOURCE_LABEL: Record<string, string> = {
  TEST_SUBMIT: "Nộp bài",
  TEST_SCORE: "Điểm cao",
  BREAKTHROUGH: "Bứt phá",
  FINAL_TEST: "Thi cuối khoá",
  HOMEWORK_SUBMIT: "Nộp bài tập về nhà",
  HOMEWORK_PASS: "Bài tập về nhà đạt",
  STREAK: "Chuỗi tuần học",
  MANUAL: "Thầy thưởng",
  REDEEM: "Đổi quà",
  REFUND: "Hoàn điểm",
  REVOKE: "Thu hồi",
};

/** Quy tắc hiển thị cho học sinh (trang Điểm thưởng) — lấy từ cấu hình để luôn khớp */
export const EARNING_RULES: { label: string; points: string; note?: string }[] = [
  { label: "Nộp bài kiểm tra / bài tập", points: `+${POINTS.testSubmit}`, note: `Nộp sau hạn +${POINTS.testSubmitLate}. Cần làm ít nhất một nửa số câu` },
  {
    label: "Điểm cao",
    points: POINTS.scoreTiers.map((t) => `+${t.points}`).reverse().join(" / "),
    note: POINTS.scoreTiers.map((t) => `≥${String(t.min).replace(".", ",")}`).reverse().join(" / "),
  },
  { label: "Bứt phá", points: `+${POINTS.breakthrough.points}`, note: `Cao hơn trung bình ${POINTS.breakthrough.window} bài gần nhất từ ${String(POINTS.breakthrough.margin).replace(".", ",")} điểm` },
  { label: "Đề thi cuối khoá", points: `+${POINTS.finalTestSubmit}`, note: `Thưởng điểm cao ×${POINTS.finalScoreMultiplier}` },
  { label: "Nộp bài tập về nhà", points: `+${POINTS.homeworkSubmit}`, note: `Được chấm Đạt thêm +${POINTS.homeworkPass}` },
  {
    label: "Chuỗi tuần học",
    points: Object.values(POINTS.streak.milestones).map((v) => `+${v}`).join(" / "),
    note: `Mốc ${Object.keys(POINTS.streak.milestones).join(" / ")} tuần liên tiếp, mỗi tuần nộp ít nhất ${POINTS.streak.minActivities} bài`,
  },
  { label: "Thầy thưởng", points: "+1 … +10", note: "Phát biểu, giúp bạn, đi học đầy đủ…" },
];
