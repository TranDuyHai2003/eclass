export enum RankStatus {
  NEW = "NEW",       // Mới đủ điều kiện lọt top tuần này
  RETURN = "RETURN", // Học sinh từng rớt khỏi top nay quay lại
  UP = "UP",         // Tăng hạng
  DOWN = "DOWN",     // Giảm hạng
  SAME = "SAME",     // Giữ nguyên hạng
  EXIT = "EXIT"      // Tuần trước có rank, tuần này không đủ điều kiện
}

export type RankConfirmationState = "LOCKED" | "PROVISIONAL" | "CONFIRMED";

export interface RankingConfig {
  minRequiredTests: number;
  minimumTests: number;
  confirmationTests: number;
  priorMean: number;
  priorWeight: number;
  baseScoreMultiplier: number;
  maxCompletionBonus: number; // Tối đa +7 điểm
  maxActivityBonus: number;   // Tối đa +3 điểm
  gradeThresholds: {
    excellent: number;
    good: number;
    average: number;
  };
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  minRequiredTests: 5,
  minimumTests: 5,
  confirmationTests: 15,
  priorMean: 7.5,
  priorWeight: 10,
  baseScoreMultiplier: 10,
  maxCompletionBonus: 7,
  maxActivityBonus: 3,
  gradeThresholds: {
    excellent: 8.5,
    good: 7.0,
    average: 5.0,
  },
};
