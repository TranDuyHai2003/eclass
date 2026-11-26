"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { POINTS } from "@/lib/points/config";
import { LEVELS } from "@/lib/points/levels";
import type { HomeTodoItem } from "@/lib/home/student-home";
import type { RecentDone } from "../TasksModal";
import { fmt } from "./parts";

const fmtDue = (d: Date | string, now: number) => {
  const t = new Date(d).getTime() - now;
  if (t < 0) return "Quá hạn";
  const days = Math.floor(t / 86400000);
  if (days === 0) return `Hạn nộp: hôm nay ${new Date(d).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`;
  return `Hạn nộp: còn ${days} ngày`;
};

/** Mục "Nộp bài tập nhận xu" (canvas v2): danh sách bài chưa nộp / đã nộp + thang Cấp độ & danh hiệu */
export function EarnSection({ todo, todoTotal, recent, lifetimeEarned, level }: { todo: HomeTodoItem[]; todoTotal: number; recent: RecentDone[]; lifetimeEarned: number; level: number }) {
  const [now] = useState(() => Date.now());
  const row = "flex flex-wrap items-center gap-3 rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fffaf0] px-4 py-3.5 shadow-[0_3px_0_#241e1a]";
  return (
    <div className="flex flex-col gap-[18px]" data-testid="tasks-modal">
      <section className="ah-panel flex flex-col gap-3 p-5">
        <p className="font-bold text-[#6e4722]">Chọn bài tập đã làm xong và nộp để nhận xu, tăng cấp độ.</p>
        {todo.length === 0 && (
          <div className={row}>
            <div className="flex-[1_1_220px]"><div className="ah-hand text-base font-bold">Không còn bài nào cần nộp!</div><div className="text-xs font-bold text-[#6e4722]">Xem lộ trình ở trang chủ để học bài mới nhé.</div></div>
            <Link href="/#lo-trinh" className="ah-btn ah-cream h-[42px] px-[18px]">Mở lộ trình</Link>
          </div>
        )}
        {todo.map((t) => {
          const overdue = t.dueDate && new Date(t.dueDate).getTime() < now;
          return (
            <div key={t.lessonId} className={row}>
              <div className="min-w-0 flex-[1_1_220px]">
                <div className="ah-hand line-clamp-1 text-base font-bold">{t.title}</div>
                <div className="text-xs font-bold text-[#6e4722]">{t.dueDate ? fmtDue(t.dueDate, now) : "Không hạn nộp"}</div>
              </div>
              {POINTS.testSubmit > 0 && <span className="font-black text-[#9e6b3f]">+{fmt(POINTS.testSubmit)} xu{t.dueDate && !overdue && POINTS.onTimeBonus > 0 ? ` · +${POINTS.onTimeBonus} đúng hạn` : ""}</span>}
              <Link href={`/watch/${t.lessonId}`} className="ah-btn ah-gold h-[42px] px-[18px]">Nộp ngay</Link>
            </div>
          );
        })}
        {todoTotal > todo.length && <p className="text-center text-xs font-bold text-[#6e4722]">+{todoTotal - todo.length} bài nữa ở trang chủ</p>}
        {recent.length > 0 && (
          <div className="flex flex-col gap-3" data-testid="tasks-done">
            {recent.slice(0, 3).map((r) => (
              <div key={r.attemptId} className={row}>
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="ah-hand line-clamp-1 text-base font-bold">{r.title}</div>
                  <div className="text-xs font-bold text-[#6e4722]">{r.score !== null ? `Đã nộp · ${r.score.toFixed(r.score % 1 === 0 ? 0 : 1)} điểm` : "Đã nộp · chờ chấm"}</div>
                </div>
                <Link href={`/watch/${r.lessonId}`} className="ah-btn ah-mint h-[42px] px-[18px]">{r.score !== null ? "Đã duyệt" : "Đã nộp"}</Link>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-[18px] border-2 border-dashed border-[#241e1a] bg-[#fff6db] px-4 py-3 text-[13px] font-bold">
          Bài tập về nhà: chụp ảnh bài làm và nộp trong trang bài học <b>trước hạn</b> (+{fmt(POINTS.homeworkSubmit)} xu, chỉ lần nộp đầu — nộp lại không cộng thêm). Lên lớp thầy duyệt chữa bài: có chữa +{fmt(POINTS.homeworkReview.partial)} xu, chữa đủ và tốt +{fmt(POINTS.homeworkReview.full)} xu.
        </div>
      </section>
      <section className="ah-panel flex flex-col gap-3 p-5">
        <h2 className="ah-hand text-xl font-bold">Cấp độ &amp; danh hiệu</h2>
        <div className="text-[13px] font-bold text-[#6e4722]">Tổng xu tích lũy không bị giảm khi tiêu xu. Lên cấp càng cao càng mở khóa nhiều viền avatar và bảng tên.</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {LEVELS.map((l, i) => {
            const lv = i + 1;
            return (
              <div key={l.name} className={cn("flex flex-col gap-1.5 rounded-2xl border-[2.5px] border-[#241e1a] p-3.5", lv === level ? "bg-[#fff1c9] shadow-[0_4px_0_#241e1a]" : lv < level ? "bg-[#fffdf8]" : "bg-[#f2e8dc] opacity-80")}>
                <div className="flex justify-between text-xs font-black"><span>Lv.{lv}</span><span>{fmt(l.min)} xu</span></div>
                <div className="ah-hand text-[15px] font-bold">{l.name}</div>
                <div className="text-xs font-semibold leading-snug">{lv === level ? "Cấp hiện tại của bạn" : lv < level ? "Đã đạt" : `Còn ${fmt(l.min - lifetimeEarned)} xu tích lũy`}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
