import type { RewardInput } from "./reward-input";

export type RewardTemplate = Omit<RewardInput, "classIds" | "isActive"> & {
  /** Thuộc bộ quà của tiệm theo canvas ShopV2 (nút "Thêm cả bộ") */
  shop?: true;
};

/**
 * Mẫu quà gợi ý trong trang quản lý (thang xu: học chăm cả tháng ≈ 12 000 xu ≈ 1 gói bim bim).
 * Bộ `shop` = 10 quà hiện vật + 7 thẻ đặc quyền của canvas Tiệm quà v2 (tên giữ đúng canvas để khớp tranh `rewardArtV2`);
 * giá theo chi phí thật ≈ 2 xu / 1 đồng như các mẫu cũ, thầy sửa được sau khi thêm.
 */
export const REWARD_TEMPLATES: RewardTemplate[] = [
  // ---- Quà hiện vật (canvas) ----
  { shop: true, emoji: "🧋", title: "Trà Sữa Tai Mèo 700ml", description: "Một ly trà sữa size lớn, nhận tại lớp.", price: 60000, kind: "PHYSICAL", costVnd: 30000, stock: 5, perStudentMonthlyLimit: 1 },
  { shop: true, emoji: "📒", title: "Sổ Tay Lò Xo Mèo Xinh", description: "Sổ tay lò xo bìa mèo để ghi công thức.", price: 22500, kind: "PHYSICAL", costVnd: 12000, stock: 10 },
  { shop: true, emoji: "🖊️", title: "Set Bút Gel Pastel 6 Màu", description: "6 bút gel màu pastel để tô điểm vở ghi.", price: 30000, kind: "PHYSICAL", costVnd: 15000, stock: 12 },
  { shop: true, emoji: "🧻", title: "Túi Giấy Ăn Nhỏ Hoạt Hình", description: "Gói khăn giấy bỏ túi in hình mèo. Bạn đầu tiên trong lớp đổi sẽ mở một nhiệm vụ ẩn!", price: 10000, kind: "PHYSICAL", costVnd: 5000, stock: 10 },
  { shop: true, emoji: "🐱", title: "Bộ 50 Sticker Mèo Béo", description: "50 sticker mèo béo dán vở, dán laptop.", price: 15000, kind: "PHYSICAL", costVnd: 8000, stock: 20 },
  { shop: true, emoji: "✏️", title: "Hộp Bút Mèo Béo", description: "Hộp bút hình mèo béo, đựng vừa thước và bút.", price: 45000, kind: "PHYSICAL", costVnd: 25000, stock: 3 },
  { shop: true, emoji: "🍼", title: "Bình Nước Tai Thỏ Pastel", description: "Bình nước nắp tai thỏ màu pastel.", price: 75000, kind: "PHYSICAL", costVnd: 40000, stock: 6 },
  { shop: true, emoji: "💡", title: "Đèn Ngủ Mèo Silicon Mềm", description: "Đèn ngủ silicon hình mèo, chạm để đổi màu.", price: 90000, kind: "PHYSICAL", costVnd: 50000, stock: 4 },
  { shop: true, emoji: "🧸", title: "Gấu Bông Mèo Moka", description: "Gấu bông mèo Moka ôm cực êm.", price: 120000, kind: "PHYSICAL", costVnd: 70000, stock: 2 },
  { shop: true, emoji: "👜", title: "Túi Đeo Chéo Mèo Nâu", description: "Túi đeo chéo hình mèo nâu đi học, đi chơi.", price: 135000, kind: "PHYSICAL", costVnd: 80000, stock: 3 },
  { shop: true, emoji: "🎧", title: "Tai Nghe Tai Mèo LED", description: "Tai nghe chụp tai có tai mèo phát sáng.", price: 210000, kind: "PHYSICAL", costVnd: 120000, stock: 1 },
  // ---- Thẻ đặc quyền (canvas) ----
  { shop: true, emoji: "⏰", title: "Phiếu Gia Hạn Bài +24h", description: "Nộp một bài tập muộn thêm 24 giờ mà không bị trừ.", price: 7500, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 2 },
  { shop: true, emoji: "🎵", title: "Vé Chọn Nhạc Giải Lao 10p", description: "Được chọn nhạc cho 10 phút giải lao của lớp.", price: 4500, kind: "VIRTUAL", offlineOnly: true, costVnd: 0, perStudentMonthlyLimit: 1 },
  { shop: true, emoji: "🙋", title: "Vé Hỏi Riêng Thầy/Cô 1-1", description: "Một buổi hỏi bài riêng với thầy/cô.", price: 6000, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 2 },
  { shop: true, emoji: "🧹", title: "Vé Miễn Trực Nhật 1 Tuần", description: "Được miễn trực nhật trong một tuần.", price: 12000, kind: "VIRTUAL", offlineOnly: true, costVnd: 0, perStudentMonthlyLimit: 1 },
  { shop: true, emoji: "💬", title: "Vé Gợi Ý 1 Câu Kiểm Tra", description: "Xin thầy gợi ý một câu trong bài kiểm tra.", price: 15000, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 1 },
  { shop: true, emoji: "🪑", title: "Vé Chọn Chỗ Cạnh Bạn Thân", description: "Được ngồi cạnh bạn thân trong một buổi học.", price: 24000, kind: "VIRTUAL", offlineOnly: true, costVnd: 0, perStudentMonthlyLimit: 1 },
  { shop: true, emoji: "⚡", title: "Thẻ Quyền Năng +0.5 Điểm", description: "Cộng 0,5 điểm vào một bài kiểm tra do thầy chọn.", price: 54000, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 1 },
  // ---- Mẫu nhỏ khác ----
  { emoji: "🍬", title: "Kẹo / bánh nhỏ", price: 6000, kind: "PHYSICAL", costVnd: 3000, perStudentMonthlyLimit: 2 },
  { emoji: "🖊️", title: "Bút bi", price: 9000, kind: "PHYSICAL", costVnd: 5000 },
  { emoji: "🍿", title: "Gói bim bim", price: 12000, kind: "PHYSICAL", costVnd: 6000 },
  { emoji: "📝", title: "Thầy chữa riêng 1 bài", price: 12000, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 2 },
  { emoji: "🏅", title: "Được tuyên dương trên nhóm lớp", price: 4500, kind: "VIRTUAL", costVnd: 0, perStudentMonthlyLimit: 1 },
];

export const SHOP_TEMPLATES = REWARD_TEMPLATES.filter((t) => t.shop);

/** Các mẫu bộ tiệm chưa có trong danh sách quà (so tên không phân biệt hoa thường) */
export function missingShopTemplates(existingTitles: Iterable<string>): RewardTemplate[] {
  const have = new Set(Array.from(existingTitles, (t) => t.trim().toLowerCase()));
  return SHOP_TEMPLATES.filter((t) => !have.has(t.title.toLowerCase()));
}
