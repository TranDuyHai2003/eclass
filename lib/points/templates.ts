import type { RewardInput } from "./reward-input";

/** Mẫu quà gợi ý trong trang quản lý (thang xu: học chăm cả tháng ≈ 12 000 xu ≈ 1 gói bim bim) */
export const REWARD_TEMPLATES: Omit<RewardInput, "classIds" | "isActive">[] = [
  { emoji: "🍬", title: "Kẹo / bánh nhỏ", price: 6000, kind: "PHYSICAL", costVnd: 3000, perStudentMonthlyLimit: 2 },
  { emoji: "🖊️", title: "Bút bi", price: 9000, kind: "PHYSICAL", costVnd: 5000 },
  { emoji: "🍿", title: "Gói bim bim", price: 12000, kind: "PHYSICAL", costVnd: 6000 },
  { emoji: "📒", title: "Vở / sổ tay", price: 22500, kind: "PHYSICAL", costVnd: 12000 },
  { emoji: "🧋", title: "Trà sữa", price: 60000, kind: "PHYSICAL", costVnd: 30000, perStudentMonthlyLimit: 1 },
  { emoji: "🪑", title: "Tự chọn chỗ ngồi 1 buổi", price: 7500, kind: "PHYSICAL", costVnd: 0 },
  { emoji: "📝", title: "Thầy chữa riêng 1 bài", price: 12000, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 2 },
  { emoji: "🏅", title: "Được tuyên dương trên nhóm lớp", price: 4500, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 1 },
];
