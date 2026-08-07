"use client";

import { Calendar, Info } from "lucide-react";

interface ClassActivityHeatmapProps {
  dailyParticipation?: Array<{
    count: number;
    total: number;
    percentage: number;
  }>;
}

export function ClassActivityHeatmap({ dailyParticipation }: ClassActivityHeatmapProps) {
  const defaultData = [
    { count: 30, total: 32, percentage: 95 },
    { count: 28, total: 32, percentage: 88 },
    { count: 29, total: 32, percentage: 92 },
    { count: 27, total: 32, percentage: 85 },
    { count: 31, total: 32, percentage: 97 },
    { count: 21, total: 32, percentage: 65 },
    { count: 22, total: 32, percentage: 70 },
  ];

  const data = dailyParticipation && dailyParticipation.length === 7 ? dailyParticipation : defaultData;

  const daysLabel = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];

  const avgPercentage = Math.round(
    data.reduce((acc, d) => acc + d.percentage, 0) / data.length
  );

  return (
    <div className="glass-card p-5 rounded-3xl space-y-3 bg-white/90 backdrop-blur-xl border border-white/80">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Tỷ Lệ Làm Bài Theo Ngày Trong Tuần
        </h3>
        <span className="text-[10px] font-bold text-slate-400">
          Trung bình: {avgPercentage}%
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 pt-1">
        {daysLabel.map((day) => (
          <div key={`teacher-day-${day}`}>{day}</div>
        ))}

        {data.map((item, idx) => (
          <div
            key={`teacher-cell-${idx}`}
            className={`h-12 text-white rounded-xl flex flex-col items-center justify-center transition-all ${
              item.percentage >= 85
                ? "bg-blue-600"
                : item.percentage >= 70
                ? "bg-blue-500"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            <span className="font-extrabold text-xs">{item.percentage}%</span>
            <span className="text-[8px] font-normal opacity-90">
              {item.count}/{item.total}
            </span>
          </div>
        ))}
      </div>

      <span className="text-[10px] text-slate-400 font-medium block text-center pt-1 flex items-center justify-center gap-1">
        <Info className="w-3.5 h-3.5 text-blue-500" />
        Thứ 6 là ngày lớp hoàn thành bài tập nhiều nhất.
      </span>
    </div>
  );
}
