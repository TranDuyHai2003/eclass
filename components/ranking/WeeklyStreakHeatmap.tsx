"use client";

import { BookOpen, Target, CheckCircle2, Award } from "lucide-react";

interface CompletionProgressCardProps {
  completedTests?: number;
  totalAssignedTests?: number;
  consecutiveCompletedStreak?: number;
}

export function WeeklyStreakHeatmap({
  completedTests = 0,
  totalAssignedTests = 0,
  consecutiveCompletedStreak = 0,
}: CompletionProgressCardProps) {
  const total = totalAssignedTests > 0 ? totalAssignedTests : Math.max(completedTests, 1);
  const percentage = total > 0 ? Math.min(100, Math.round((completedTests / total) * 100)) : 0;

  return (
    <section className="glass-card p-5 sm:p-6 rounded-3xl space-y-4 bg-white/90 backdrop-blur-xl border border-white/80 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-lg shrink-0 border border-blue-100 shadow-xs">
            📚
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
              Mức độ hoàn thành
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Chỉ số ghi nhận nỗ lực hoàn thành các bài kiểm tra
            </p>
          </div>
        </div>

        <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full shadow-xs">
          {percentage}%
        </span>
      </div>

      {/* Progress Stats & Bar */}
      <div className="space-y-2 pt-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold text-slate-600">
            Số bài kiểm tra đã nộp
          </span>
          <span className="text-sm font-black text-slate-900">
            <strong className="text-blue-600 text-base">{completedTests}</strong> {totalAssignedTests > 0 ? `/ ${totalAssignedTests} bài` : "bài"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-600 shadow-sm transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Sub-footer: Consecutive Streak */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-sm shrink-0">
            🎯
          </div>
          <span>
            Chuỗi hoạt động: <strong className="text-indigo-600 font-black">{consecutiveCompletedStreak} ngày</strong> liên tiếp
          </span>
        </div>

        <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
          Dữ liệu thực
        </span>
      </div>
    </section>
  );
}
