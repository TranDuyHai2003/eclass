import type { RewardInput } from "./reward-input";

/** Mẫu quà gợi ý trong trang quản lý (thang điểm nhỏ: học chăm cả tháng ≈ 80–90 điểm ≈ 1 gói bim bim) */
export const REWARD_TEMPLATES: Omit<RewardInput, "classIds" | "isActive">[] = [
  { emoji: "🍬", title: "Kẹo / bánh nhỏ", price: 40, kind: "PHYSICAL", costVnd: 3000, perStudentMonthlyLimit: 2 },
  { emoji: "🖊️", title: "Bút bi", price: 60, kind: "PHYSICAL", costVnd: 5000 },
  { emoji: "🍿", title: "Gói bim bim", price: 80, kind: "PHYSICAL", costVnd: 6000 },
  { emoji: "📒", title: "Vở / sổ tay", price: 150, kind: "PHYSICAL", costVnd: 12000 },
  { emoji: "🧋", title: "Trà sữa", price: 400, kind: "PHYSICAL", costVnd: 30000, perStudentMonthlyLimit: 1 },
  { emoji: "🪑", title: "Tự chọn chỗ ngồi 1 buổi", price: 50, kind: "PHYSICAL", costVnd: 0 },
  { emoji: "📝", title: "Thầy chữa riêng 1 bài", price: 80, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 2 },
  { emoji: "🏅", title: "Được tuyên dương trên nhóm lớp", price: 30, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 1 },
];
