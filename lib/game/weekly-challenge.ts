/**
 * Banner "Thử thách tuần" ở hộp Bảng Vàng của Tiệm Quà — dựng từ dữ liệu thật của ví (chuỗi tuần),
 * không bịa sự kiện. Thuần (không Prisma) để test được.
 */
import { getVietnamWeekStart } from "@/lib/ranking/history-engine";

const DAY = 86_400_000;

export interface WeeklyChallenge {
  title: string;
  text: string;
  badge: string;
  done: boolean;
}

/** Số ngày (làm tròn lên) còn lại tới Thứ Hai 00:00 giờ VN tuần sau; tối thiểu 1 */
export function daysLeftInWeek(now: Date = new Date()): number {
  const end = getVietnamWeekStart(now).getTime() + 7 * DAY;
  return Math.max(1, Math.ceil((end - now.getTime()) / DAY));
}

export function weeklyChallenge(
  w: { weekActivities: number; weekTarget: number; thisWeekCounted: boolean; weekStreak: number },
  now: Date = new Date(),
): WeeklyChallenge {
  const left = daysLeftInWeek(now);
  const done = w.thisWeekCounted || w.weekActivities >= w.weekTarget;
  const streak = w.weekStreak > 0 ? ` Chuỗi hiện tại: ${w.weekStreak} tuần 🔥` : "";
  if (done) {
    return {
      title: "Thử thách tuần: đã hoàn thành ✅",
      text: `Tuần này bạn đã nộp đủ ${w.weekTarget} bài, chuỗi được giữ.${streak}`,
      badge: `Còn ${left} ngày`,
      done: true,
    };
  }
  const need = Math.max(0, w.weekTarget - w.weekActivities);
  return {
    title: "Thử thách tuần: giữ chuỗi 🔥",
    text: `Nộp thêm ${need} bài trong tuần này (đang ${w.weekActivities}/${w.weekTarget}) để giữ chuỗi và nhận thưởng mốc tuần.${streak}`,
    badge: `Còn ${left} ngày`,
    done: false,
  };
}
