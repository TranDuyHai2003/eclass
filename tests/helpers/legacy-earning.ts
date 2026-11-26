import { setGameConfigForTests } from "@/lib/game/game-config";

/**
 * Mức xu cơ chế cũ (trước 26/11/2026) — từ 26/11 các nguồn này mặc định TẮT (= 0), admin bật lại được ở
 * Tiệm quà → Quản lý → Hoạt động kiếm xu. Test cơ chế cộng xu bài kiểm tra / điểm cao / chuỗi tuần dùng mức này
 * để vẫn kiểm được logic khi được bật lại. Cấu hình nằm trong bộ nhớ của file test (không ghi DB).
 */
export const LEGACY_EARNING = {
  testSubmit: 300, testSubmitLate: 150, onTimeBonus: 150,
  score10: 450, score85: 300, score7: 150, breakthrough: 150,
  finalTestSubmit: 750, homeworkPass: 150,
  streak2: 300, streak4: 600, streak8: 1200, streak12: 1800, streakEvery4: 1800,
};
export const applyLegacyEarning = () => setGameConfigForTests({ earning: LEGACY_EARNING });
