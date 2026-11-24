/**
 * Danh mục đồ trang trí nhân vật chibi — hằng số trong code, KHÔNG lưu DB.
 * Quy ước: `id` là slug ổn định (chỉ THÊM, không đổi/xoá slug vì UserItem/UserAvatar tham chiếu).
 * Thuần (không import Prisma) → dùng được ở client.
 */
import type { Rarity } from "@/lib/points/rarity";

export type Slot = "skin" | "hair" | "hairColor" | "eyes" | "outfit" | "accessory" | "frame" | "background" | "effect" | "nameplate" | "title" | "pet";

export const SLOTS: { key: Slot; label: string; icon: string; optional?: boolean }[] = [
  { key: "skin", label: "Màu da", icon: "🖐️" },
  { key: "hair", label: "Kiểu tóc", icon: "💇" },
  { key: "hairColor", label: "Màu tóc", icon: "🎨" },
  { key: "eyes", label: "Màu mắt", icon: "👀" },
  { key: "outfit", label: "Trang phục", icon: "👕" },
  { key: "accessory", label: "Phụ kiện", icon: "🎀", optional: true },
  { key: "frame", label: "Khung", icon: "🖼️", optional: true },
  { key: "background", label: "Nền", icon: "🌈", optional: true },
  { key: "effect", label: "Hiệu ứng", icon: "✨", optional: true },
  { key: "nameplate", label: "Bảng tên", icon: "🪪", optional: true },
  { key: "title", label: "Danh hiệu", icon: "🏷️", optional: true },
  { key: "pet", label: "Mèo Cún", icon: "🐱", optional: true },
];

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  /** Giá bán trong tiệm: xu hoặc ngọc; không có = miễn phí (free) hoặc chỉ từ rương (gachaOnly) */
  price?: { xu: number } | { gem: number };
  free?: boolean;
  gachaOnly?: boolean;
  /** Món bán ở "Hồ sơ & Trang trí" (GĐ8): không vào bể rương (giữ tỉ lệ rương cũ, review Gemini GĐ8), không hiện ở "Tất cả" của tiệm */
  studio?: boolean;
  /** Cấp tối thiểu (theo xu tích luỹ) mới mua được — canvas "Tiệm quà v2" */
  minLevel?: number;
  /** Món mới ra (nhãn "Mới" trên thẻ) */
  isNew?: boolean;
  /** Kiểu tóc theo giới (ô Giới tính ở Tùy chỉnh lọc danh sách kiểu tóc) */
  gender?: "male" | "female";
  /** Tham số vẽ (màu, biến thể) — Chibi.tsx đọc */
  v?: string;
  v2?: string;
}

const skin = (id: string, name: string, v: string): Item => ({ id, slot: "skin", name, rarity: "common", free: true, v });
const hairColor = (id: string, name: string, v: string, extra: Partial<Item> = {}): Item => ({ id, slot: "hairColor", name, rarity: "common", v, free: !extra.price && !extra.gachaOnly, ...extra });
const eyes = (id: string, name: string, v: string, extra: Partial<Item> = {}): Item => ({ id, slot: "eyes", name, rarity: "common", v, free: !extra.price && !extra.gachaOnly, ...extra });

export const ITEMS: Item[] = [
  // ---- Da (miễn phí)
  skin("skin-light", "Sáng", "#fde7d2"),
  skin("skin-peach", "Đào", "#f8d3b6"),
  skin("skin-tan", "Nâu nhạt", "#d9a877"),
  skin("skin-brown", "Nâu", "#a86f45"),
  // ---- Kiểu tóc
  { id: "hair-short", slot: "hair", name: "Tóc ngắn", rarity: "common", free: true, v: "short", gender: "male" },
  { id: "hair-bob", slot: "hair", name: "Tóc bob", rarity: "common", free: true, v: "bob", gender: "female" },
  { id: "hair-ponytail", slot: "hair", name: "Tóc đuôi ngựa", rarity: "common", free: true, v: "ponytail", gender: "female" },
  { id: "hair-spiky", slot: "hair", name: "Tóc dựng", rarity: "rare", price: { xu: 900 }, v: "spiky", gender: "male" },
  { id: "hair-twin", slot: "hair", name: "Tóc hai bím", rarity: "rare", price: { xu: 900 }, v: "twin", gender: "female" },
  { id: "hair-long", slot: "hair", name: "Tóc dài", rarity: "rare", price: { xu: 1200 }, v: "long", gender: "female" },
  { id: "hair-bun", slot: "hair", name: "Búi củ tỏi", rarity: "epic", gachaOnly: true, v: "bun", gender: "female" },
  { id: "hair-mohawk", slot: "hair", name: "Mohawk", rarity: "epic", gachaOnly: true, v: "mohawk", gender: "male" },
  // Kiểu tóc thêm (23/11): bán ở Hồ sơ & Trang trí, không vào bể rương (studio) — giữ tỉ lệ rương
  { id: "hair-buzz", slot: "hair", name: "Đầu đinh", rarity: "common", free: true, studio: true, isNew: true, v: "short", gender: "male" },
  { id: "hair-sidepart", slot: "hair", name: "Rẽ ngôi lệch", rarity: "common", free: true, studio: true, isNew: true, v: "short", gender: "male" },
  { id: "hair-slick", slot: "hair", name: "Vuốt ngược", rarity: "rare", price: { xu: 900 }, studio: true, isNew: true, v: "short", gender: "male" },
  { id: "hair-curly", slot: "hair", name: "Xoăn bồng", rarity: "rare", price: { xu: 900 }, studio: true, isNew: true, v: "spiky", gender: "male" },
  { id: "hair-wolf", slot: "hair", name: "Tóc wolf", rarity: "rare", price: { xu: 1200 }, studio: true, isNew: true, v: "spiky", gender: "male" },
  { id: "hair-longm", slot: "hair", name: "Dài lãng tử", rarity: "rare", price: { xu: 1200 }, studio: true, isNew: true, v: "long", gender: "male" },
  { id: "hair-manbun", slot: "hair", name: "Búi samurai", rarity: "epic", price: { xu: 1500 }, studio: true, isNew: true, v: "bun", gender: "male" },
  { id: "hair-pixie", slot: "hair", name: "Tóc tém", rarity: "common", free: true, studio: true, isNew: true, v: "bob", gender: "female" },
  { id: "hair-twintail", slot: "hair", name: "Hai đuôi cao", rarity: "rare", price: { xu: 900 }, studio: true, isNew: true, v: "twin", gender: "female" },
  { id: "hair-sidetail", slot: "hair", name: "Đuôi lệch vai", rarity: "rare", price: { xu: 900 }, studio: true, isNew: true, v: "ponytail", gender: "female" },
  { id: "hair-odango", slot: "hair", name: "Búi đôi", rarity: "rare", price: { xu: 1200 }, studio: true, isNew: true, v: "bun", gender: "female" },
  { id: "hair-wavy", slot: "hair", name: "Xoăn sóng dài", rarity: "epic", price: { xu: 1500 }, studio: true, isNew: true, v: "long", gender: "female" },
  // ---- Màu tóc
  hairColor("hc-black", "Đen", "#1f2937"),
  hairColor("hc-brown", "Nâu", "#6b3f1d"),
  hairColor("hc-blonde", "Vàng", "#f2c14e"),
  hairColor("hc-red", "Đỏ", "#c0392b", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-blue", "Xanh dương", "#2563eb", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-pink", "Hồng", "#ec4899", { rarity: "rare", price: { xu: 600 } }),
  hairColor("hc-mint", "Bạc hà", "#34d399", { rarity: "epic", gachaOnly: true }),
  hairColor("hc-silver", "Bạc", "#cbd5e1", { rarity: "epic", gachaOnly: true }),
  hairColor("hc-rainbow", "Cầu vồng", "url(#hairRainbow)", { rarity: "legendary", gachaOnly: true }),
  // ---- Màu mắt
  eyes("eye-brown", "Nâu", "#4b2e1e"),
  eyes("eye-black", "Đen", "#111827"),
  eyes("eye-blue", "Xanh", "#2563eb", { rarity: "rare", price: { xu: 450 } }),
  eyes("eye-green", "Lục", "#059669", { rarity: "rare", price: { xu: 450 } }),
  eyes("eye-violet", "Tím", "#7c3aed", { rarity: "epic", gachaOnly: true }),
  eyes("eye-gold", "Vàng kim", "#d97706", { rarity: "legendary", gachaOnly: true }),
  // ---- Trang phục
  { id: "outfit-uniform", slot: "outfit", name: "Đồng phục", rarity: "common", free: true, v: "#ffffff", v2: "#1d4ed8" },
  { id: "outfit-tee", slot: "outfit", name: "Áo phông", rarity: "common", free: true, v: "#60a5fa", v2: "#1e3a8a" },
  { id: "outfit-hoodie", slot: "outfit", name: "Áo hoodie", rarity: "rare", price: { xu: 1500 }, v: "#f97316", v2: "#9a3412" },
  { id: "outfit-dress", slot: "outfit", name: "Váy hoa", rarity: "rare", price: { xu: 1500 }, v: "#f472b6", v2: "#be185d" },
  { id: "outfit-sport", slot: "outfit", name: "Đồ thể thao", rarity: "rare", price: { xu: 1500 }, v: "#22c55e", v2: "#166534" },
  { id: "outfit-scientist", slot: "outfit", name: "Áo blouse nhà toán học", rarity: "epic", price: { xu: 4500 }, v: "#e2e8f0", v2: "#334155" },
  { id: "outfit-ninja", slot: "outfit", name: "Ninja", rarity: "epic", gachaOnly: true, v: "#1f2937", v2: "#dc2626" },
  { id: "outfit-royal", slot: "outfit", name: "Hoàng bào", rarity: "legendary", price: { gem: 8 }, v: "#7c3aed", v2: "#fbbf24" },
  { id: "outfit-astro", slot: "outfit", name: "Phi hành gia", rarity: "legendary", gachaOnly: true, v: "#f8fafc", v2: "#0ea5e9" },
  // GĐ8 (trang Hồ sơ & Trang trí)
  { id: "outfit-cathoodie", slot: "outfit", name: "Hoodie tai mèo", rarity: "rare", studio: true, price: { xu: 1500 }, v: "#f9a8d4", v2: "#be185d" },
  { id: "outfit-kimono", slot: "outfit", name: "Kimono hoa", rarity: "rare", studio: true, price: { xu: 1500 }, v: "#fbcfe8", v2: "#db2777" },
  { id: "outfit-gamer", slot: "outfit", name: "Áo game thủ", rarity: "rare", studio: true, price: { xu: 1200 }, v: "#1f2937", v2: "#22d3ee" },
  { id: "outfit-wizard", slot: "outfit", name: "Áo choàng phù thuỷ", rarity: "epic", studio: true, price: { xu: 2400 }, v: "#4c1d95", v2: "#fbbf24" },
  { id: "outfit-knight", slot: "outfit", name: "Giáp hiệp sĩ", rarity: "epic", studio: true, price: { xu: 3000 }, v: "#cbd5e1", v2: "#2563eb" },
  // ---- Phụ kiện
  { id: "acc-glasses", slot: "accessory", name: "Kính học bá", rarity: "common", price: { xu: 450 }, v: "glasses" },
  { id: "acc-cap", slot: "accessory", name: "Mũ lưỡi trai", rarity: "rare", price: { xu: 900 }, v: "cap" },
  { id: "acc-bow", slot: "accessory", name: "Nơ hồng", rarity: "rare", price: { xu: 900 }, v: "bow" },
  { id: "acc-headphones", slot: "accessory", name: "Tai nghe", rarity: "epic", gachaOnly: true, v: "headphones" },
  { id: "acc-crown", slot: "accessory", name: "Vương miện", rarity: "legendary", price: { gem: 10 }, v: "crown" },
  { id: "acc-halo", slot: "accessory", name: "Vòng hào quang", rarity: "legendary", gachaOnly: true, v: "halo" },
  { id: "acc-scarf", slot: "accessory", name: "Khăn quàng ấm", rarity: "common", studio: true, price: { xu: 450 }, v: "scarf" },
  { id: "acc-sakura", slot: "accessory", name: "Kẹp hoa anh đào", rarity: "common", studio: true, price: { xu: 450 }, v: "sakura" },
  { id: "acc-catears", slot: "accessory", name: "Bờm tai mèo", rarity: "rare", studio: true, price: { xu: 900 }, v: "catears" },
  { id: "acc-wizardhat", slot: "accessory", name: "Mũ phù thuỷ", rarity: "rare", studio: true, price: { xu: 1200 }, v: "wizardhat" },
  // ---- Khung
  { id: "frame-blue", slot: "frame", name: "Khung Thiên Thần Học Bá", rarity: "common", price: { xu: 600 }, v: "#60a5fa", v2: "angel" },
  { id: "frame-leaf", slot: "frame", name: "Khung Cỏ 4 Lá May Mắn", rarity: "rare", price: { xu: 1200 }, v: "#22c55e", v2: "clover" },
  { id: "frame-rainbow", slot: "frame", name: "Khung mây cầu vồng", rarity: "epic", gachaOnly: true, v: "rainbow" },
  { id: "frame-gold", slot: "frame", name: "Khung hào quang vàng", rarity: "legendary", price: { gem: 6 }, v: "gold" },
  // v = màu khung chữ nhật trong Chibi; v2 = kiểu vòng quanh ảnh đại diện (FrameRing)
  { id: "frame-catear", slot: "frame", name: "Khung Tai Mèo", rarity: "common", studio: true, price: { xu: 600 }, v: "#f9a8d4", v2: "catear" },
  { id: "frame-laurel", slot: "frame", name: "Khung Nguyệt Quế", rarity: "rare", studio: true, price: { xu: 1200 }, v: "#d4a017", v2: "laurel" },
  { id: "frame-sakura", slot: "frame", name: "Khung Anh Đào", rarity: "rare", studio: true, price: { xu: 1200 }, v: "#f472b6", v2: "sakura" },
  { id: "frame-ice", slot: "frame", name: "Khung Băng Tinh", rarity: "rare", studio: true, price: { xu: 1500 }, v: "#7dd3fc", v2: "ice" },
  { id: "frame-royal", slot: "frame", name: "Khung Hoàng Gia", rarity: "epic", studio: true, price: { xu: 3000 }, v: "#8b5cf6", v2: "royal" },
  { id: "frame-neon", slot: "frame", name: "Vòng Cyber Neon", rarity: "epic", gachaOnly: true, v: "#22d3ee", v2: "neon" },
  { id: "frame-fire", slot: "frame", name: "Khung Hoả Long", rarity: "legendary", studio: true, price: { gem: 8 }, v: "#f97316", v2: "fire" },
  { id: "frame-moon", slot: "frame", name: "Tinh Vân Dạ Nguyệt", rarity: "legendary", gachaOnly: true, v: "#6366f1", v2: "moon" },
  // Khung còn lại của canvas "Tiệm quà v2" (23/11): chỉ bán ở tiệm, không vào rương
  { id: "frame-butterfly", slot: "frame", name: "Điệu Van Bướm Lượn", rarity: "epic", studio: true, price: { xu: 2400 }, v: "#c084fc", v2: "butterfly" },
  { id: "frame-rose", slot: "frame", name: "Hoa Hồng Tinh Xảo", rarity: "legendary", studio: true, price: { gem: 8 }, v: "#312e81", v2: "rose" },
  // Bộ khung "rank" (24/11, thầy thích kiểu khung xếp hạng / trang trí avatar): vẽ mới hoàn toàn, chỉ bán ở tiệm, mở theo cấp
  { id: "frame-diamond", slot: "frame", name: "Khung Kim Cương Học Bá", rarity: "epic", studio: true, price: { xu: 6000 }, minLevel: 4, v: "#22d3ee", v2: "rank-diamond" },
  { id: "frame-master", slot: "frame", name: "Khung Cao Thủ", rarity: "legendary", studio: true, price: { gem: 12 }, minLevel: 5, v: "#a21caf", v2: "rank-master" },
  { id: "frame-challenger", slot: "frame", name: "Khung Thách Đấu", rarity: "legendary", studio: true, price: { gem: 20 }, minLevel: 7, v: "#f59e0b", v2: "rank-challenger" },
  { id: "frame-galaxy", slot: "frame", name: "Khung Ngân Hà", rarity: "epic", studio: true, price: { xu: 4500 }, v: "#4338ca", v2: "galaxy" },
  { id: "frame-fairy", slot: "frame", name: "Khung Tiên Tử", rarity: "epic", studio: true, price: { xu: 4500 }, v: "#f0abfc", v2: "fairy" },
  { id: "frame-phoenix", slot: "frame", name: "Khung Phượng Hoàng", rarity: "legendary", studio: true, price: { gem: 15 }, minLevel: 6, v: "#dc2626", v2: "phoenix" },
  // ---- Nền
  { id: "bg-sky", slot: "background", name: "Trời xanh", rarity: "common", price: { xu: 300 }, v: "#dbeafe", v2: "#bfdbfe" },
  { id: "bg-mint", slot: "background", name: "Bạc hà", rarity: "common", price: { xu: 300 }, v: "#d1fae5", v2: "#a7f3d0" },
  { id: "bg-sunset", slot: "background", name: "Hoàng hôn", rarity: "rare", price: { xu: 900 }, v: "#fed7aa", v2: "#fbcfe8" },
  { id: "bg-galaxy", slot: "background", name: "Dải ngân hà", rarity: "epic", gachaOnly: true, v: "#312e81", v2: "#7c3aed" },
  { id: "bg-gold", slot: "background", name: "Vàng ròng", rarity: "legendary", gachaOnly: true, v: "#fde68a", v2: "#f59e0b" },
  // Cảnh vẽ SVG cho banner hồ sơ (ProfileScene); trong Chibi là gradient v → v2
  { id: "bg-classroom", slot: "background", name: "Lớp học nắng ấm", rarity: "common", studio: true, price: { xu: 450 }, v: "#fef3c7", v2: "#fdba74" },
  { id: "bg-dusk", slot: "background", name: "Hoàng hôn mây tím", rarity: "common", studio: true, price: { xu: 600 }, v: "#c4b5fd", v2: "#f9a8d4" },
  { id: "bg-library", slot: "background", name: "Thư viện đêm sao", rarity: "rare", studio: true, price: { xu: 1200 }, v: "#1e1b4b", v2: "#4338ca" },
  { id: "bg-sakura", slot: "background", name: "Công viên anh đào", rarity: "rare", studio: true, price: { xu: 1200 }, v: "#fce7f3", v2: "#f9a8d4" },
  { id: "bg-neon", slot: "background", name: "Đêm thành phố neon", rarity: "epic", studio: true, price: { xu: 3000 }, v: "#0f172a", v2: "#7c3aed" },
  { id: "bg-forest", slot: "background", name: "Khu rừng kỳ ảo", rarity: "epic", gachaOnly: true, v: "#064e3b", v2: "#10b981" },
  // ---- Hiệu ứng (lớp động trên banner hồ sơ; bản tĩnh trong Chibi)
  { id: "fx-bubble", slot: "effect", name: "Bong bóng sắc màu", rarity: "common", studio: true, price: { xu: 450 }, v: "bubble" },
  { id: "fx-sparkle", slot: "effect", name: "Hào quang lấp lánh", rarity: "common", studio: true, price: { xu: 600 }, v: "sparkle" },
  { id: "fx-snow", slot: "effect", name: "Tuyết rơi mùa đông", rarity: "common", studio: true, price: { xu: 600 }, v: "snow" },
  { id: "fx-sakura", slot: "effect", name: "Hoa anh đào rơi", rarity: "rare", studio: true, price: { xu: 1200 }, v: "sakura" },
  { id: "fx-butterfly", slot: "effect", name: "Bướm đêm rực rỡ", rarity: "rare", studio: true, price: { xu: 1500 }, v: "butterfly" },
  { id: "fx-thunder", slot: "effect", name: "Hào quang điện", rarity: "epic", studio: true, price: { xu: 3000 }, v: "thunder" },
  { id: "fx-meteor", slot: "effect", name: "Mưa sao băng", rarity: "epic", gachaOnly: true, v: "meteor" },
  { id: "fx-flame", slot: "effect", name: "Tàn lửa rực hồng", rarity: "legendary", studio: true, price: { gem: 8 }, v: "flame" },
  // ---- Danh hiệu trang trí (khác danh hiệu theo xu)
  { id: "title-nerd", slot: "title", name: "Mọt sách", rarity: "common", price: { xu: 450 } },
  { id: "title-speed", slot: "title", name: "Thần tốc", rarity: "rare", price: { xu: 900 } },
  { id: "title-pi", slot: "title", name: "Fan của số π", rarity: "rare", gachaOnly: true },
  { id: "title-boss", slot: "title", name: "Trùm cuối", rarity: "epic", gachaOnly: true },
  { id: "title-legend", slot: "title", name: "Huyền thoại lớp", rarity: "legendary", gachaOnly: true },
  { id: "title-owl", slot: "title", name: "Cú đêm chăm chỉ", rarity: "common", studio: true, price: { xu: 600 } },
  { id: "title-hunter10", slot: "title", name: "Thợ săn điểm 10", rarity: "rare", studio: true, price: { xu: 1200 } },
  { id: "title-mathking", slot: "title", name: "Học bá Toán học", rarity: "epic", studio: true, price: { xu: 2400 } },
  { id: "title-warrior", slot: "title", name: "Chiến thần giải đề", rarity: "epic", gachaOnly: true },
  // ---- Bảng tên (canvas "Tiệm quà v2"): nền dải bảng tên + hiệu ứng động; mở theo cấp. v = hàng trong public/studio/nameplates.webp, v2 = "dark" → chữ trắng
  { id: "np-pond", slot: "nameplate", name: "Bảng tên Tí Ta Tí Tách", rarity: "common", studio: true, price: { xu: 450 }, minLevel: 1, v: "0" },
  { id: "np-sakura", slot: "nameplate", name: "Bảng tên Gió Xuân Anh Đào", rarity: "common", studio: true, price: { xu: 600 }, minLevel: 2, v: "1" },
  { id: "np-starry", slot: "nameplate", name: "Choáng Ngợp Trời Sao", rarity: "rare", studio: true, price: { xu: 1200 }, minLevel: 3, v: "2", v2: "dark" },
  { id: "np-butterfly", slot: "nameplate", name: "Bảng tên Bướm Đêm Lấp Lánh", rarity: "epic", studio: true, price: { xu: 2400 }, minLevel: 3, v: "3", v2: "dark" },
  { id: "np-catparty", slot: "nameplate", name: "Bảng tên Bữa Tiệc Mèo Béo", rarity: "epic", studio: true, price: { xu: 3000 }, minLevel: 4, v: "4" },
  { id: "np-crimson", slot: "nameplate", name: "Bảng tên Vết Cào Hỏa Hồng", rarity: "legendary", studio: true, price: { gem: 8 }, minLevel: 5, v: "5", v2: "dark" },
  { id: "np-celestial", slot: "nameplate", name: "Hoàng Kim Tinh Tú VIP", rarity: "legendary", studio: true, price: { gem: 10 }, minLevel: 6, v: "6", v2: "dark" },
  // ---- Mèo Cún đồng hành (theo mockup "Tiệm Quà Học Đường"): hiện cạnh hồ sơ, bấm vuốt ve
  { id: "pet-bi", slot: "pet", name: "Mèo Mướp Bi", rarity: "common", free: true, v: "tabby" },
  { id: "pet-moka", slot: "pet", name: "Mèo Vàng Moka Béo Ú", rarity: "common", price: { xu: 450 }, v: "orange" },
  { id: "pet-peanut", slot: "pet", name: "Bé Mèo Tam Thể Peanut", rarity: "rare", price: { xu: 600 }, v: "calico" },
  { id: "pet-shadow", slot: "pet", name: "Mèo Đen Bóng Đêm", rarity: "epic", gachaOnly: true, v: "black" },
  { id: "pet-snow", slot: "pet", name: "Mèo Hoàng Thượng Snow", rarity: "legendary", price: { gem: 8 }, v: "snow" },
  // GĐ8: thú cưng khác loài (PetSvg vẽ theo v)
  { id: "pet-slime", slot: "pet", name: "Slime hoàng kim", rarity: "common", studio: true, price: { xu: 450 }, v: "slime" },
  { id: "pet-bunny", slot: "pet", name: "Thỏ mây", rarity: "common", studio: true, price: { xu: 600 }, v: "bunny" },
  { id: "pet-shiba", slot: "pet", name: "Shiba hạt dẻ", rarity: "rare", studio: true, price: { xu: 900 }, v: "shiba" },
  { id: "pet-owl", slot: "pet", name: "Cú học giả", rarity: "rare", studio: true, price: { xu: 1200 }, v: "owl" },
  { id: "pet-dragon", slot: "pet", name: "Rồng mini sấm sét", rarity: "epic", studio: true, price: { xu: 3000 }, v: "dragon" },
  { id: "pet-robot", slot: "pet", name: "Robot trợ thủ", rarity: "epic", gachaOnly: true, v: "robot" },
  { id: "pet-phoenix", slot: "pet", name: "Phượng hoàng lửa", rarity: "legendary", studio: true, price: { gem: 10 }, v: "phoenix" },
  { id: "pet-redpanda", slot: "pet", name: "Gấu Trúc Đỏ Bông Xù", rarity: "epic", studio: true, price: { xu: 3000 }, v: "redpanda" },
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const RARITY_LABEL: Record<Rarity, string> = { common: "Phổ thông", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại" };

/** Xu trả lại khi trúng đồ đã có (theo bậc) */
export const DUPLICATE_REFUND: Record<Rarity, number> = { common: 150, rare: 450, epic: 1500, legendary: 4500 };

export function itemsOfSlot(slot: Slot) {
  return ITEMS.filter((i) => i.slot === slot);
}

export function isFree(item: Item) {
  return !!item.free;
}

/** Đồ bán trong tiệm (có giá) */
export function shopItems() {
  return ITEMS.filter((i) => i.price);
}
