"use client";

import Link from "next/link";
import { Lock, ArrowRight, BookOpen } from "lucide-react";
import { PersonalRankingContext } from "@/actions/ranking";

interface IneligibleCardProps {
  whyRanked: PersonalRankingContext["whyRanked"];
  studyClassName: string | null;
}

export function IneligibleCard({
  whyRanked,
  studyClassName,
}: IneligibleCardProps) {
  const completed = whyRanked.completedTests;
  const required = whyRanked.minRequiredTests;
  const remaining = Math.max(0, required - completed);
  const percentage = Math.min(100, Math.round((completed / required) * 100));

  return (
    <section className="glass-card rounded-3xl p-6 sm:p-7 border border-amber-200 bg-amber-50/70 text-slate-800 shadow-lg shadow-amber-900/5 space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 text-xl font-bold shadow-xs">
            <Lock className="w-6 h-6 text-amber-700" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black tracking-widest uppercase">
                YÊU CẦU ĐIỀU KIỆN GHI DANH
              </span>
              <span className="text-xs text-amber-800 font-bold">
                {studyClassName || "Lớp 10A1"}
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Yêu cầu tối thiểu {required} bài test để xuất hiện trên bảng xếp hạng
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed max-w-xl font-medium">
              Bạn hiện mới hoàn thành{" "}
              <strong className="text-amber-800 font-black">
                {completed}/{required} bài
              </strong>
              . Cần hoàn thành thêm{" "}
              <strong className="text-amber-700 font-black">
                {remaining} bài nữa
              </strong>{" "}
              để xuất hiện chính thức!
            </p>

            {/* Progress Bar */}
            <div className="pt-1 max-w-md">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-500">Tiến độ điều kiện:</span>
                <span className="text-amber-800 font-black">
                  {completed}/{required} Bài ({percentage}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-amber-200/80 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-amber-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(8, percentage)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/practice"
          className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 shrink-0 transition"
        >
          <BookOpen className="w-4 h-4 text-white" />
          <span>Làm bài tập ngay ➔</span>
        </Link>
      </div>
    </section>
  );
}
