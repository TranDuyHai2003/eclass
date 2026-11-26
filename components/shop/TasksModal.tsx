"use client";

import Link from "next/link";
import { useState } from "react";
import { ShopModal } from "./ShopModal";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { POINTS } from "@/lib/points/config";

const fmtDue = (d: Date | string, now: number) => {
  const t = new Date(d).getTime() - now;
  if (t < 0) return "Quá hạn";
  const days = Math.floor(t / 86400000);
  if (days === 0) return `Hôm nay ${new Date(d).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`;
  return `Còn ${days} ngày`;
};

/** "Nộp Bài +": bài kiểm tra chưa nộp kèm xu nhận được; chụp ảnh bài tập thì làm trong trang bài học */
export interface RecentDone {
  attemptId: string;
  lessonId: string;
  title: string;
  /** Điểm thang 10 (null nếu bài chưa chấm) */
  score: number | null;
}

export function TasksModal({ open, onOpenChange, inline, todo, todoTotal, recent = [] }: { open: boolean; onOpenChange: (o: boolean) => void; inline?: boolean; todo: HomeTodoItem[]; todoTotal: number; recent?: RecentDone[] }) {
  // Mốc "bây giờ" lấy một lần khi tạo (hộp chỉ render sau khi mở ở client)
  const [now] = useState(() => Date.now());
  return (
    <ShopModal open={open} onOpenChange={onOpenChange} inline={inline} title="📝 Nộp Bài Tập Nhận Xu" testId="tasks-modal">
      {todo.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#4fae4a] bg-[#eef9ea] p-5 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 font-black text-[#1f6b22]">Không còn bài nào cần nộp!</p>
          <p className="text-xs text-[#2f7a33]">Xem lại lộ trình ở trang chủ để học bài mới nhé.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {todo.map((t) => {
            const overdue = t.dueDate && new Date(t.dueDate).getTime() < now;
            return (
              <li key={t.lessonId} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#f5b61e] bg-[#fff8e6] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#3b2a14]">{t.title}</p>
                  <p className="text-[11px] font-semibold text-[#7a5a35]">
                    {t.dueDate ? `⏰ ${fmtDue(t.dueDate, now)}` : "📚 Không hạn"}
                    {POINTS.testSubmit > 0 ? ` · 🪙 +${POINTS.testSubmit.toLocaleString("vi-VN")} Xu` : ""}
                    {POINTS.onTimeBonus > 0 && t.dueDate && !overdue ? ` + ⏱️ ${POINTS.onTimeBonus} đúng hạn` : ""}
                  </p>
                </div>
                <Link href={`/watch/${t.lessonId}`} className="btn-pill btn-pill-yellow shrink-0 px-3 py-1.5 text-xs">Nộp ngay</Link>
              </li>
            );
          })}
          {todoTotal > todo.length && <li className="text-center text-[11px] font-bold text-[#7a5a35]">+{todoTotal - todo.length} bài nữa ở trang chủ</li>}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className="mt-2 space-y-2" data-testid="tasks-done">
          {recent.slice(0, 3).map((r) => (
            <li key={r.attemptId} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#4fae4a]/60 bg-[#f3fbee] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-black text-[#3b2a14]">{r.title}</p>
                <p className="text-[11px] font-semibold text-[#2f7a33]">{r.score !== null ? `🎯 ${r.score.toFixed(r.score % 1 === 0 ? 0 : 1)} điểm` : "⏳ Chờ chấm"}</p>
              </div>
              <Link href={`/watch/${r.lessonId}`} className="shrink-0 rounded-full border-2 border-[#1f6b22] bg-[#d6f3cf] px-2.5 py-1 text-[11px] font-black text-[#1f6b22]">Đã nộp ✨</Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-2xl border-2 border-[#5b3d1e]/40 bg-[#fff1c2] p-3 text-center">
        <p className="text-sm font-black text-[#5b3d1e]">📸 Chụp / Đăng ảnh bài làm</p>
        <p className="mt-0.5 text-[11px] font-semibold text-[#7a5a35]">Bài tập về nhà nộp ảnh trong trang bài học trước hạn (+{POINTS.homeworkSubmit} Xu, lần nộp đầu). Thầy duyệt chữa bài trên lớp: +{POINTS.homeworkReview.partial} / +{POINTS.homeworkReview.full} Xu.</p>
        <Link href="/#lo-trinh" className="btn-pill btn-pill-brown mt-2 px-4 py-1.5 text-xs">Mở lộ trình học</Link>
      </div>
    </ShopModal>
  );
}
