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

/**
 * 26/11/2026 — thầy đổi cơ chế: CHỈ cộng xu qua 3 hành động (docs/ai-reviews/xu-3-actions/PLAN.md):
 *   1) nộp bài tập về nhà đúng hạn +100; 2) giáo viên duyệt chữa bài +280 / +400; 3) mã quà tặng.
 * Các nguồn cũ (bài kiểm tra, điểm cao, bứt phá, thi cuối khoá, chấm Đạt online, chuỗi tuần) để 0 = tắt;
 * admin bật lại được ở Tiệm quà → Quản lý → Hoạt động kiếm xu. Thầy thưởng tay giữ nguyên.
 */
export const POINTS = {
  /** Nộp bài kiểm tra / bài tập trắc nghiệm (lần đầu) — tắt từ 26/11 (trước 300) */
  testSubmit: 0,
  /** Nộp sau hạn — tắt (trước 150) */
  testSubmitLate: 0,
  /** Nộp đúng hạn bài kiểm tra — tắt (trước 150) */
  onTimeBonus: 0,
  /** Phải làm ít nhất tỉ lệ này số câu mới được xu nộp bài (chống nộp trắng lấy xu) */
  minAnsweredRatio: 0.5,
  /** Thưởng theo điểm bài (lấy mức cao nhất đạt được) */
  scoreTiers: [
    { min: 10, points: 0 },
    { min: 8.5, points: 0 },
    { min: 7, points: 0 },
  ],
  /** Bứt phá: điểm bài này ≥ trung bình `window` bài gần nhất + `margin` (cần ít nhất `minPrevious` bài trước) */
  breakthrough: { points: 0, window: 5, minPrevious: 3, margin: 1.5 },
  /** Đề thi cuối khoá: xu nộp bài riêng, thưởng điểm cao nhân hệ số */
  finalTestSubmit: 0,
  finalScoreMultiplier: 2,
  /** Bài tập về nhà (nộp ảnh): chỉ cộng khi nộp TRƯỚC hạn của lớp (chưa đặt hạn → nộp là cộng) */
  homeworkSubmit: 100,
  /** Chấm Đạt bài nộp online — tắt (thay bằng duyệt chữa bài trên lớp) */
  homeworkPass: 0,
  /** Giáo viên duyệt chữa bài trên lớp: Có chữa / Chữa đủ, tốt (Chưa chữa = 0) */
  homeworkReview: { partial: 280, full: 400 },
  /** Tối đa xu tự động (bài kiểm tra, bài tập) mỗi ngày — chặn bất thường */
  dailyAutoCap: 4500,
  /** Chuỗi tuần học: tuần đạt khi có ít nhất `minActivities` lần nộp bài (kiểm tra hoặc bài tập về nhà) */
  streak: {
    minActivities: 2,
    /** Xu thưởng khi chuỗi đạt mốc (số tuần → xu) */
    milestones: { 2: 0, 4: 0, 8: 0, 12: 0 } as Record<number, number>,
    /** Sau 12 tuần: cứ mỗi 4 tuần thêm — tắt (trước 1800) */
    every4WeeksAfter12: 0,
    /** Mỗi 4 tuần liên tiếp được thêm 1 thẻ giữ chuỗi, giữ tối đa */
    maxFreezes: 2,
  },
  /** Thầy thưởng/trừ tay (26/11: thu nhỏ theo thang mới — tối đa bằng 1 bài tập làm tốt; trước 1500) */
  manual: { maxPerGrant: 500, dailyCapPerStudent: 500 },
  /** Yêu cầu đổi quà chưa trao sau số ngày này thì tự hết hạn và hoàn xu */
  pendingExpiryDays: 30,
} as const;

/** Các nguồn xu tự động tính vào giới hạn mỗi ngày */
export const AUTO_CAPPED_SOURCES = ["TEST_SUBMIT", "ON_TIME", "TEST_SCORE", "BREAKTHROUGH", "HOMEWORK_SUBMIT", "HOMEWORK_PASS"] as const;

/** Các lần nộp bài được tính là "hoạt động" của chuỗi tuần */
export const STREAK_ACTIVITY_SOURCES = ["TEST_SUBMIT", "FINAL_TEST", "HOMEWORK_SUBMIT"] as const;

/**
 * Các nguồn tính vào "xu tích luỹ" (lifetimeEarned → danh hiệu, Bảng Vàng). Xu từ HỌC, thầy thưởng và MÃ QUÀ TẶNG
 * (26/11/2026: mã quà là 1 trong 3 cách nhận xu chính thức — thầy báo xu từ mã không được cộng tích luỹ);
 * gacha, mua đồ, đổi/hoàn quà không ảnh hưởng. REVOKE (âm) trừ lại phần đã kiếm. Ngọc (GEM) không bao giờ tính.
 */
export const EARNING_SOURCES = [
  "TEST_SUBMIT", "ON_TIME", "TEST_SCORE", "BREAKTHROUGH", "FINAL_TEST", "HOMEWORK_SUBMIT", "HOMEWORK_PASS", "HOMEWORK_REVIEW", "STREAK", "MANUAL", "GIFTCODE", "REVOKE",
] as const;

export const SOURCE_LABEL: Record<string, string> = {
  TEST_SUBMIT: "Nộp bài",
  ON_TIME: "Đúng hạn",
  TEST_SCORE: "Điểm cao",
  BREAKTHROUGH: "Bứt phá",
  FINAL_TEST: "Thi cuối khoá",
  HOMEWORK_SUBMIT: "Nộp bài tập về nhà",
  HOMEWORK_PASS: "Bài tập về nhà đạt",
  HOMEWORK_REVIEW: "Thầy duyệt chữa bài",
  STREAK: "Chuỗi tuần học",
  MANUAL: "Thầy thưởng",
  REDEEM: "Đổi quà",
  REFUND: "Hoàn xu",
  REVOKE: "Thu hồi",
  GIFTCODE: "Mã quà tặng",
  GACHA: "Rương bí ẩn",
  ITEM: "Mua đồ trang trí",
  RESET: "Reset xu (bắt đầu tính lại)",
};

const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Quy tắc hiển thị cho học sinh (trang Xu) — lấy từ cấu hình để luôn khớp (hàm: admin sửa mức xu → tính lại) */
export const earningRules = (): { label: string; points: string; note?: string }[] => {
  const rules: { label: string; points: string; note?: string; on: boolean }[] = [
    { on: POINTS.homeworkSubmit > 0, label: "Làm / nộp bài tập về nhà đúng hạn", points: `+${fmt(POINTS.homeworkSubmit)}`, note: "Làm BTVN trên web (hoặc nộp ảnh) trước hạn, bài của khoá lớp mình — chỉ lần đầu, làm lại không cộng thêm" },
    {
      on: POINTS.homeworkReview.full > 0 || POINTS.homeworkReview.partial > 0,
      label: "Thầy duyệt chữa bài",
      points: `+${fmt(POINTS.homeworkReview.partial)} / +${fmt(POINTS.homeworkReview.full)}`,
      note: "Có chữa / Chữa đủ, tốt — thầy kiểm tra vở trên lớp",
    },
    { on: true, label: "Mã quà tặng", points: "Xu / Ngọc", note: "Thầy phát mã — nhập ở Tiệm quà → Thẻ cào, mỗi mã dùng một lần" },
    { on: POINTS.testSubmit > 0, label: "Nộp bài kiểm tra", points: `+${fmt(POINTS.testSubmit)}`, note: `Nộp sau hạn +${fmt(POINTS.testSubmitLate)}. Cần làm ít nhất một nửa số câu` },
    { on: POINTS.onTimeBonus > 0, label: "Nộp bài kiểm tra đúng hạn", points: `+${fmt(POINTS.onTimeBonus)}` },
    {
      on: POINTS.scoreTiers.some((t) => t.points > 0),
      label: "Điểm cao",
      points: POINTS.scoreTiers.map((t) => `+${fmt(t.points)}`).reverse().join(" / "),
      note: POINTS.scoreTiers.map((t) => `≥${String(t.min).replace(".", ",")}`).reverse().join(" / "),
    },
    { on: POINTS.breakthrough.points > 0, label: "Bứt phá", points: `+${fmt(POINTS.breakthrough.points)}`, note: `Cao hơn trung bình ${POINTS.breakthrough.window} bài gần nhất từ ${String(POINTS.breakthrough.margin).replace(".", ",")} điểm` },
    { on: POINTS.finalTestSubmit > 0, label: "Đề thi cuối khoá", points: `+${fmt(POINTS.finalTestSubmit)}`, note: `Thưởng điểm cao ×${POINTS.finalScoreMultiplier}` },
    { on: POINTS.homeworkPass > 0, label: "Bài tập về nhà được chấm Đạt", points: `+${fmt(POINTS.homeworkPass)}` },
    {
      on: Object.values(POINTS.streak.milestones).some((v) => v > 0),
      label: "Chuỗi tuần học",
      points: Object.values(POINTS.streak.milestones).map((v) => `+${fmt(v)}`).join(" / "),
      note: `Mốc ${Object.keys(POINTS.streak.milestones).join(" / ")} tuần liên tiếp, mỗi tuần nộp ít nhất ${POINTS.streak.minActivities} bài`,
    },
    { on: POINTS.manual.maxPerGrant > 0, label: "Thầy thưởng", points: `+1 … +${fmt(POINTS.manual.maxPerGrant)}`, note: "Trường hợp đặc biệt" },
  ];
  return rules.filter((r) => r.on).map(({ on: _on, ...r }) => r);
};

/**
 * Học sinh tự huỷ đơn đổi quà (hoàn xu) chỉ trong 2 giờ đầu — đủ để sửa đổi nhầm.
 * 26/11/2026 (rà lỗ hổng): trước đây huỷ được mọi lúc khi đơn còn "chờ trao" → nhận quà trên lớp xong, thầy chưa kịp bấm
 * "Đã trao" thì huỷ để lấy lại xu. Quá 2 giờ: báo thầy, thầy từ chối (hoàn xu) ở Quản lý tiệm.
 */
export const STUDENT_CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;
export const studentCanCancel = (createdAt: string | Date, now: number = Date.now()) => now - new Date(createdAt).getTime() <= STUDENT_CANCEL_WINDOW_MS;
