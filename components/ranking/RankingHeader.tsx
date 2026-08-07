"use client";

import { Clock, TrendingUp, CheckCircle, Flame, Award } from "lucide-react";
import { useState } from "react";

interface RankingHeaderProps {
  studyClassName: string | null;
  totalStudents: number;
  classAvgScore: number;
  classCompletionRate: number;
  studentsRankIncreasedCount: number;
  activeStreakStudentsCount: number;
  onPeriodChange?: (period: "WEEKLY" | "MONTHLY" | "ALL_TIME") => void;
}

export function RankingHeader({
  studyClassName,
  totalStudents,
  classAvgScore,
  classCompletionRate,
  studentsRankIncreasedCount,
  activeStreakStudentsCount,
  onPeriodChange,
}: RankingHeaderProps) {
  const [activePeriod, setActivePeriod] = useState<"WEEKLY" | "MONTHLY" | "ALL_TIME">("MONTHLY");

  const handleSelect = (period: "WEEKLY" | "MONTHLY" | "ALL_TIME") => {
    setActivePeriod(period);
    if (onPeriodChange) onPeriodChange(period);
  };

  return (
    <header className="glass-card p-5 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 space-y-4 border border-white/80 bg-white/85 backdrop-blur-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-blue-500/20 shrink-0">
            {studyClassName ? studyClassName.slice(0, 4).toUpperCase() : "10A1"}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[10px] uppercase tracking-wider border border-blue-100">
                {studyClassName || "Lớp 10A1"} • {totalStudents} Học sinh
              </span>
              <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Còn 12 ngày (Tháng 8)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Bảng Tiến Bộ {studyClassName ? studyClassName : "Lớp 10A1"}
            </h1>
          </div>
        </div>

        {/* TIME FILTER TABS */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold shrink-0 self-start md:self-auto">
          <button
            onClick={() => handleSelect("WEEKLY")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activePeriod === "WEEKLY"
                ? "bg-white text-blue-600 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Tuần này
          </button>
          <button
            onClick={() => handleSelect("MONTHLY")}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              activePeriod === "MONTHLY"
                ? "bg-white text-blue-600 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Tháng 8
          </button>
          <button
            onClick={() => handleSelect("ALL_TIME")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activePeriod === "ALL_TIME"
                ? "bg-white text-blue-600 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Học kỳ 1
          </button>
        </div>
      </div>

      {/* CLASS STATS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 text-center">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            ĐTB Lớp
          </span>
          <span className="text-sm font-extrabold text-slate-800">
            {classAvgScore.toFixed(2)} Điểm
          </span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 text-center">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Hoàn thành bài
          </span>
          <span className="text-sm font-extrabold text-blue-600">
            {classCompletionRate}% Bài tập
          </span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 text-center">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Học sinh tăng hạng
          </span>
          <span className="text-sm font-extrabold text-emerald-600">
            {studentsRankIncreasedCount} Bạn
          </span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 text-center">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Chuỗi tích cực
          </span>
          <span className="text-base font-extrabold text-amber-600">
            {activeStreakStudentsCount} Bạn &gt; 7 ngày
          </span>
        </div>
      </div>
    </header>
  );
}
