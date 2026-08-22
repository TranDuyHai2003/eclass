"use client";

import { TrendingUp, Info } from "lucide-react";
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
    deltaScore: number | null;
    initialScore: number | null;
    currentScore: number;
    feedbackMessage: string;
    feedbackType: "EXCELLENT" | "STABLE" | "NEEDS_IMPROVEMENT" | "INSUFFICIENT_DATA";
    hasSufficientData?: boolean;
  };
}

export function WeeklyProgressTrend({ progressData }: WeeklyProgressTrendProps) {
  if (!progressData || !progressData.periods || progressData.periods.length === 0) {
    return (
      <section className="glass-card p-5 sm:p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-md text-center text-slate-500">
        <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">Đang tích lũy dữ liệu tiến bộ cá nhân</p>
      </section>
    );
  }

  const { periods, deltaScore, initialScore, currentScore, feedbackMessage } = progressData;
  const maxScore = Math.max(...periods.map((p) => (p.isValid ? p.averageScore : 0)), 10);

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
        {deltaScore !== null ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl shrink-0 self-start sm:self-auto shadow-xs">
            <TrendingUp className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="text-sm font-black text-emerald-800">
              {deltaScore >= 0 ? `+${deltaScore.toFixed(1)}` : `${deltaScore.toFixed(1)}`} điểm (4 chu kỳ)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-2xl shrink-0 self-start sm:self-auto text-xs font-bold text-slate-600">
            <span>Đang thu thập lịch sử</span>
          </div>
        )}
      </div>

      {/* 4 Active Periods Visual Graph */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-extrabold text-slate-600">
          <span>Hành trình 4 chu kỳ tuần gần nhất</span>
          {initialScore !== null && (
            <span className="text-emerald-700 text-xs font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 self-start sm:self-auto">
              {initialScore.toFixed(1)} ➔ {currentScore.toFixed(1)} ĐTB
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {periods.map((item, idx) => {
            const heightPercent = item.isValid ? Math.max(20, Math.min(100, (item.averageScore / maxScore) * 100)) : 0;

            return (
              <div
                key={item.periodCode || `period-${idx}`}
                className={cn(
                  "p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all",
                  item.isValid
                    ? "bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 border-slate-200 shadow-xs hover:border-emerald-400"
                    : "bg-slate-50/80 border-slate-200/80"
                )}
              >
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-slate-700">{item.label}</span>
                  {item.isValid ? (
                    <span className="text-emerald-700 bg-emerald-100 font-extrabold px-2 py-0.5 rounded-md text-xs">
                      {item.completedTests} bài
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-slate-200 font-semibold px-2 py-0.5 rounded-md text-xs">
                      Trống
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
                  <div className="py-3 text-center text-xs font-medium text-slate-400 leading-snug">
                    Chưa có snapshot
                  </div>
                )}

                <div className="text-xs text-slate-500 font-semibold text-center border-t border-slate-200/60 pt-2 truncate">
                  {item.isValid ? `Điểm ĐT: ${item.rankingScore}` : "Chưa có dữ liệu"}
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
            {feedbackMessage}
          </p>
        </div>
      </div>
    </section>
  );
}
