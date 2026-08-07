"use client";

import { Rocket } from "lucide-react";

interface MostImprovedSpotlightProps {
  mostImprovedStudent?: {
    name: string;
    oldRank: number;
    newRank: number;
    rankGain: number;
    avgScore: number;
  } | null;
}

export function MostImprovedSpotlight({ mostImprovedStudent }: MostImprovedSpotlightProps) {
  const name = mostImprovedStudent?.name || "Nguyễn Văn B";
  const oldRank = mostImprovedStudent?.oldRank || 22;
  const newRank = mostImprovedStudent?.newRank || 11;
  const rankGain = mostImprovedStudent?.rankGain || 11;
  const avgScore = mostImprovedStudent?.avgScore || 8.25;

  return (
    <section className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 rounded-3xl p-4.5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 text-lg shadow-md shadow-emerald-500/20">
            🚀
          </div>
          <div className="space-y-0.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
              Ghi nhận tiến bộ lớp
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              {name} (Từ #{oldRank} ➔ #{newRank})
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Cải thiện{" "}
              <strong className="text-emerald-700 font-extrabold">
                +{rankGain} bậc
              </strong>{" "}
              tuần này – Nỗ lực tích cực nhất lớp!
            </p>
          </div>
        </div>

        <div className="bg-white px-3.5 py-1.5 rounded-2xl border border-emerald-200 text-center shrink-0 w-full sm:w-auto">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            ĐTB Hiện Tại
          </span>
          <span className="text-sm font-black text-emerald-600">
            {avgScore.toFixed(2)} Điểm
          </span>
        </div>
      </div>
    </section>
  );
}
