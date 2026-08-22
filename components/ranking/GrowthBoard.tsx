"use client";

import { Rocket, Award, Info } from "lucide-react";
import { useState } from "react";

interface ImprovedStudent {
  id: string;
  name: string;
  currentScore: number;
  previousScore: number | null;
  scoreGrowth: number | null;
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null;
}

interface GrowthBoardProps {
  topImprovedStudents?: ImprovedStudent[];
}

export function GrowthBoard({ topImprovedStudents = [] }: GrowthBoardProps) {
  const [awardedMap, setAwardedMap] = useState<Record<string, boolean>>({});

  const handleAward = (id: string, name: string) => {
    setAwardedMap((prev) => ({ ...prev, [id]: true }));
    alert(`Đã trao huy hiệu Ghi Nhận Tiến Bộ cho ${name}!`);
  };

  if (!topImprovedStudents || topImprovedStudents.length === 0) {
    return (
      <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-3xl p-5 text-center text-slate-500 space-y-1">
        <Info className="w-6 h-6 text-emerald-600 mx-auto" />
        <p className="text-xs font-semibold text-slate-700">Chưa có dữ liệu bứt phá điểm số trong chu kỳ này</p>
        <p className="text-[11px] text-slate-500">Cần ít nhất 1 snapshot chu kỳ trước để so sánh sự tăng trưởng</p>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
        <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
          <Rocket className="w-4 h-4 text-emerald-600" />
          Học Sinh Tiến Bộ Nhất Lớp
        </h3>
        <span className="text-[10px] font-bold text-emerald-600">
          Đề xuất khen thưởng
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {topImprovedStudents.map((st) => {
          const isAwarded = awardedMap[st.id];
          const initials = st.name ? st.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "HS";

          return (
            <div
              key={st.id}
              className="bg-white p-3 rounded-2xl border border-emerald-100 flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shrink-0">
                  {initials}
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 block">
                    {st.name} {st.currentRank ? `(#${st.currentRank})` : ""}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-extrabold">
                    Tăng +{st.scoreGrowth ? st.scoreGrowth.toFixed(1) : 0} điểm
                    {st.rankChange && st.rankChange > 0 ? ` (↑ ${st.rankChange} bậc)` : ""}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleAward(st.id, st.name)}
                disabled={isAwarded}
                className={`px-3 py-1.5 font-extrabold rounded-xl text-[10px] shrink-0 transition flex items-center gap-1 ${
                  isAwarded
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>{isAwarded ? "Đã Khen Thưởng" : "Khen Thưởng"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
