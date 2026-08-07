"use client";

import Link from "next/link";
import { BarChart3, AlertTriangle } from "lucide-react";

interface TeacherOverviewCardProps {
  studyClassName?: string | null;
  studentsRankIncreasedCount?: number;
  activeStreakCount?: number;
  ineligibleCount?: number;
}

export function TeacherOverviewCard({
  studyClassName = "Lớp 10A1",
  studentsRankIncreasedCount = 18,
  activeStreakCount = 12,
  ineligibleCount = 3,
}: TeacherOverviewCardProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Báo cáo quản lý lớp */}
      <div className="md:col-span-2 bg-slate-900 text-white rounded-3xl p-5 shadow-xl space-y-3 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wide">
              Báo Cáo Giáo Viên ({studyClassName || "Lớp 10A1"})
            </h3>
          </div>
          <span className="text-[10px] font-bold bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
            Hôm nay
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-center sm:text-left">
          <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] mb-0.5">
              Tăng hạng
            </span>
            <strong className="text-emerald-400 font-black text-xs block">
              {studentsRankIncreasedCount} Học sinh
            </strong>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] mb-0.5">
              Giảm điểm
            </span>
            <strong className="text-amber-400 font-black text-xs block">
              {ineligibleCount} Học sinh
            </strong>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] mb-0.5">
              Chuỗi tốt
            </span>
            <strong className="text-sky-400 font-black text-xs block">
              {activeStreakCount} Bạn &gt; 7d
            </strong>
          </div>
        </div>
      </div>

      {/* TRẠNG THÁI KHÔNG ĐỦ ĐIỀU KIỆN XẾP HẠNG (CHƯA ĐỦ 5 BÀI TEST) */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-3xl p-4 flex flex-col justify-between text-xs space-y-2">
        <div className="space-y-1">
          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-black text-[9px] uppercase">
            Điều kiện ghi danh
          </span>
          <h4 className="font-extrabold text-slate-900 text-xs">
            Yêu cầu tối thiểu 5 bài test
          </h4>
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            Ví dụ học sinh mới hoàn thành{" "}
            <strong className="text-amber-700 font-black">3/5 bài</strong>. Cần
            làm thêm 2 bài nữa để xuất hiện chính thức.
          </p>
        </div>
        <Link
          href="/practice"
          className="text-[11px] font-extrabold text-amber-700 hover:underline inline-flex items-center gap-1"
        >
          Làm bài tập ngay ➔
        </Link>
      </div>
    </section>
  );
}
