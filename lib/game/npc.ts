/**
 * NPC "Lucky Boy" — câu thoại tính ở server từ dữ liệu, theo thứ tự ưu tiên, KHÔNG ngẫu nhiên (HTML server/client khớp).
 * Review Gemini: không bao giờ nhắc về rương/bảo hiểm (tránh thúc quay).
 */
export interface NpcContext {
  name?: string | null;
  canEarn?: boolean;
  /** Bài quá hạn chưa nộp */
  overdue?: { title: string }[];
  /** Bài sắp hạn (≤ 2 ngày) chưa nộp */
  dueSoon?: { title: string; dueDate: Date | string }[];
  /** Bài chưa nộp còn lại (không hạn) */
  todoCount?: number;
  weekActivities?: number;
  weekTarget?: number;
  thisWeekCounted?: boolean;
  lifetimeEarned?: number;
  levelName?: string;
  nextLevel?: { name: string; toNext: number } | null;
  balance?: number;
  gems?: number;
  goal?: { title: string; price: number } | null;
}

const given = (name?: string | null) => {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? p[p.length - 1] : "bạn";
};

const fmt = (n: number) => n.toLocaleString("vi-VN");

export function buildNpcLines(c: NpcContext): string[] {
  const lines: string[] = [];
  const me = given(c.name);
  if (c.canEarn === false) lines.push(`Chào ${me}! Tài khoản đang chờ thầy duyệt — duyệt xong là nhận xu ngay nha.`);
  if (c.overdue?.length) lines.push(`Ơ ${me} ơi, "${c.overdue[0].title}" quá hạn rồi đó 😱 Nộp muộn vẫn có xu, làm ngay thôi!`);
  if (c.dueSoon?.length) {
    const d = new Date(c.dueSoon[0].dueDate);
    const hours = Math.max(1, Math.round((d.getTime() - Date.now()) / 3600000));
    lines.push(`"${c.dueSoon[0].title}" chỉ còn ${hours < 48 ? `${hours} giờ` : "2 ngày"} nữa là hết hạn — nộp đúng hạn được thêm 150 xu nha ⏰`);
  }
  if (!c.thisWeekCounted && c.weekTarget) {
    const left = Math.max(0, c.weekTarget - (c.weekActivities ?? 0));
    if (left > 0) lines.push(`Tuần này nộp thêm ${left} bài nữa là giữ được chuỗi 🔥`);
    else lines.push("Tuần này đủ bài rồi, chuỗi tuần sắp được tính 🔥");
  }
  if ((c.todoCount ?? 0) > 0 && !c.overdue?.length && !c.dueSoon?.length) {
    lines.push(`Còn ${c.todoCount} bài chưa làm trong lộ trình — mỗi bài nộp là +300 xu đó ${me} 📝`);
  }
  if (c.nextLevel && c.nextLevel.toNext <= 1000) lines.push(`Chỉ còn ${fmt(c.nextLevel.toNext)} xu nữa là lên danh hiệu "${c.nextLevel.name}" rồi! 🎉`);
  if (c.goal && (c.balance ?? 0) >= c.goal.price) lines.push(`Đủ xu đổi "${c.goal.title}" rồi — ghé tiệm quà đổi thôi 🎁`);
  if ((c.gems ?? 0) > 0) lines.push(`Bạn đang có ${c.gems} ngọc 💎 — ngọc mua được đồ Huyền thoại cho nhân vật đó!`);
  if ((c.lifetimeEarned ?? 0) === 0 && c.canEarn !== false) lines.push(`Nộp bài đầu tiên để nhận 300 xu nhé ${me}! Làm ít nhất một nửa số câu là có xu.`);
  if (lines.length === 0) {
    lines.push(`Học đều mỗi tuần là lên danh hiệu nhanh lắm, cố lên ${me} 💪`);
  }
  lines.push("Mình là Lucky Boy, bấm vào mình để nghe tiếp nhé 😉");
  return lines;
}
