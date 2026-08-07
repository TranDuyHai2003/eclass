"use client";

import { PieChart } from "lucide-react";

interface GradeDistributionChartProps {
  studyClassName?: string | null;
  distribution?: {
    excellent: { count: number; percentage: number };
    good: { count: number; percentage: number };
    average: { count: number; percentage: number };
    needSupport: { count: number; percentage: number };
  };
}

export function GradeDistributionChart({
  studyClassName = "10A1",
  distribution = {
    excellent: { count: 8, percentage: 25 },
    good: { count: 12, percentage: 37.5 },
    average: { count: 9, percentage: 28 },
    needSupport: { count: 3, percentage: 9.5 },
  },
}: GradeDistributionChartProps) {
  return (
    <div className="glass-card p-5 rounded-3xl space-y-3 bg-white/90 backdrop-blur-xl border border-white/80">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <PieChart className="w-4 h-4 text-blue-600" />
          Phân Bố Học Lực Lớp {studyClassName || "10A1"}
        </h3>
        <span className="text-[10px] font-bold text-slate-400">Tháng 8</span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div>
          <div className="flex justify-between font-bold mb-1">
            <span className="text-emerald-700">Xuất sắc (8.5+)</span>
            <span className="text-slate-800">
              {distribution.excellent.count} Học sinh ({distribution.excellent.percentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${distribution.excellent.percentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between font-bold mb-1">
            <span className="text-blue-700">Khá (7.0 - 8.4)</span>
            <span className="text-slate-800">
              {distribution.good.count} Học sinh ({distribution.good.percentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${distribution.good.percentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between font-bold mb-1">
            <span className="text-amber-700">Trung bình (5.0 - 6.9)</span>
            <span className="text-slate-800">
              {distribution.average.count} Học sinh ({distribution.average.percentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${distribution.average.percentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between font-bold mb-1">
            <span className="text-rose-600">Cần hỗ trợ (&lt; 5.0)</span>
            <span className="text-slate-800">
              {distribution.needSupport.count} Học sinh ({distribution.needSupport.percentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${distribution.needSupport.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
