/** Phần dùng chung server + trình duyệt của Nhiệm vụ ẩn (không import Prisma) — xem lib/game/quests.ts */
export type QuestId = "deadline89" | "lucky" | "owl" | "early" | "turtle" | "dragon" | "tissue" | "comeback" | "perfect" | "catlover";

export interface QuestDef {
  id: QuestId;
  itemId: string;
  /** Cách đạt (hiện khi đã mở) */
  how: string;
  /** Gợi ý mơ hồ cho ô ??? */
  hint: string;
  /** Biệt danh có hạn (giờ); không có = vĩnh viễn */
  hours?: number;
}

export const QUESTS: QuestDef[] = [
  { id: "deadline89", itemId: "q-deadline89", how: "Nộp bài kiểm tra trong 30 phút cuối trước hạn", hint: "Đồng hồ sắp điểm…" },
  { id: "owl", itemId: "q-owl", how: "Nộp bài lúc 0h–3h sáng", hint: "Khi cả nhà đã ngủ say…" },
  { id: "early", itemId: "q-early", how: "Nộp bài lúc 5h–8h sáng", hint: "Gà chưa gáy đã…" },
  { id: "perfect", itemId: "q-perfect", how: "Đạt điểm 10 tròn trĩnh", hint: "Không thể cao hơn được nữa" },
  { id: "comeback", itemId: "q-comeback", how: "Điểm bài kiểm tra tăng ít nhất 2,5 so với bài trước", hint: "Té ngã rồi đứng dậy thật cao" },
  { id: "turtle", itemId: "q-turtle", how: "Lần đầu nộp trễ hạn sau chuỗi 5 bài đúng hạn", hint: "Ai rồi cũng có lúc…" },
  { id: "dragon", itemId: "q-dragon", how: "Tích trên 5.000 xu mà chưa từng tiêu xu", hint: "Của để dành mãi chẳng tiêu…" },
  { id: "lucky", itemId: "q-lucky", how: "Mở Hộp bí ẩn ra món Sử thi hoặc Huyền thoại", hint: "Thần may mắn mỉm cười" },
  { id: "tissue", itemId: "q-tissue", how: "Người đầu tiên trong lớp đổi quà Túi giấy ăn nhỏ hoạt hình", hint: "Người tiên phong của một món quà nhỏ" },
  { id: "catlover", itemId: "q-catlover", how: "Vuốt ve mèo chủ tiệm 20 lần trong một ngày (biệt danh 24 giờ)", hint: "Mèo nào cũng cần được cưng", hours: 24 },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q])) as Record<QuestId, QuestDef>;
export const QUEST_ITEM_IDS = new Set(QUESTS.map((q) => q.itemId));

/** Mốc giờ Việt Nam (UTC+7) */
export const vnHour = (d: Date) => (d.getUTCHours() + 7) % 24;
const MIN = 60 * 1000;
export const DEADLINE_WINDOW_MIN = 30;
export const COMEBACK_JUMP = 2.5;
export const DRAGON_XU = 5000;
export const CAT_PETS_PER_DAY = 20;

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
/** Quà "Túi giấy ăn nhỏ hoạt hình" (so tên không dấu, chịu được viết khác: giấy ăn / khăn giấy) */
export const isTissueReward = (title: string) => /giay an|khan giay/.test(norm(title));

