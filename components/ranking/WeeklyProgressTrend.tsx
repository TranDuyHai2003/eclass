"use client";

import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PeriodProgressItem {
  periodCode: string;
  label: string;
  averageScore: number;
  rankingScore: number;
  completedTests: number;
  isValid: boolean;
  statusMessage?: string;
}

interface WeeklyProgressTrendProps {
  progressData?: {
    periods: PeriodProgressItem[];
    deltaScore: number;
    initialScore: number;
    currentScore: number;
    feedbackMessage: string;
    feedbackType: "EXCELLENT" | "STABLE" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA";
  };
}

export function WeeklyProgressTrend({ progressData }: WeeklyProgressTrendProps) {
  const defaultPeriods: PeriodProgressItem[] = [
    { periodCode: "P1", label: "Chu kỳ 1", averageScore: 7.2, rankingScore: 74, completedTests: 4, isValid: true },
    { periodCode: "P2", label: "Chu kỳ 2", averageScore: 7.8, rankingScore: 80, completedTests: 5, isValid: true },
    { periodCode: "P3", label: "Chu kỳ 3", averageScore: 8.1, rankingScore: 83, completedTests: 4, isValid: true },
    { periodCode: "P4", label: "Chu kỳ 4", averageScore: 8.4, rankingScore: 86, completedTests: 6, isValid: true },
  ];

  const data = progressData || {
    periods: defaultPeriods,
    deltaScore: 1.2,
    initialScore: 7.2,
    currentScore: 8.4,
    feedbackMessage: "Cải thiện tuyệt vời! +1.2 điểm so với 4 chu kỳ trước 🚀",
    feedbackType: "EXCELLENT" as const,
  };

  const maxScore = Math.max(...data.periods.map((p) => p.averageScore || 10), 10);

  return (
    <section className="glass-card p-5 sm:p-6 rounded-3xl space-y-5 bg-white/95 backdrop-blur-xl border border-white/80 shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl shrink-0 border border-emerald-200 shadow-xs">
            📈
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs tracking-wide border border-emerald-200/80 inline-block mb-0.5">
              Growth Mindset • Bản thân
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Tiến Bộ Học Tập Cá Nhân
            </h3>
          </div>
        </div>

        {/* Primary Delta Indicator */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl shrink-0 self-start sm:self-auto shadow-xs">
          <TrendingUp className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="text-sm font-black text-emerald-800">
            {data.deltaScore >= 0 ? `+${data.deltaScore.toFixed(1)}` : `${data.deltaScore.toFixed(1)}`} điểm (4 chu kỳ qua)
          </span>
        </div>
      </div>

      {/* 4 Active Periods Visual Graph */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-extrabold text-slate-600">
          <span>Hành trình 4 chu kỳ gần nhất (Tối thiểu 3 bài/chu kỳ)</span>
          <span className="text-emerald-700 text-xs font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 self-start sm:self-auto">
            {data.initialScore} ➔ {data.currentScore} ĐTB
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.periods.map((item, idx) => {
            const heightPercent = item.isValid ? Math.max(25, Math.min(100, (item.averageScore / maxScore) * 100)) : 0;

            return (
              <div
                key={item.periodCode || `period-${idx}`}
                className={cn(
                  "p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all",
                  item.isValid
                    ? "bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 border-slate-200 shadow-xs hover:border-emerald-400"
                    : "bg-amber-50/60 border-amber-200"
                )}
              >
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-slate-700">{item.label}</span>
                  {item.isValid ? (
                    <span className="text-emerald-700 bg-emerald-100 font-extrabold px-2 py-0.5 rounded-md text-xs">
                      {item.completedTests} bài
                    </span>
                  ) : (
                    <span className="text-amber-800 bg-amber-100 font-extrabold px-2 py-0.5 rounded-md text-xs">
                      Chưa đủ
                    </span>
                  )}
                </div>

                {item.isValid ? (
                  <div className="space-y-1 text-center py-1">
                    <strong className="text-2xl sm:text-3xl font-black text-slate-900 block leading-tight">
                      {item.averageScore.toFixed(1)}
                    </strong>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${heightPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs font-extrabold text-amber-800 leading-snug">
                    Chưa đủ dữ liệu
                  </div>
                )}

                <div className="text-xs text-slate-500 font-semibold text-center border-t border-slate-200/60 pt-2 truncate">
                  {item.isValid ? `Điểm ĐT: ${item.rankingScore}` : "Cần ≥3 bài"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Growth Feedback Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 p-4 rounded-2xl flex items-center gap-3.5 shadow-xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          🌟
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
            Đánh Giá Sự Cải Thiện Bản Thân
          </h4>
          <p className="text-sm text-slate-800 font-bold mt-0.5 leading-snug">
            {data.feedbackMessage}
          </p>
        </div>
      </div>
    </section>
  );
}
