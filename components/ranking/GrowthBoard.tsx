"use client";

import { Rocket, Award } from "lucide-react";
import { useState } from "react";

interface ImprovedStudent {
  id: string;
  name: string;
  newRank: number;
  oldRank: number;
  rankGain: number;
  avgScore: number;
}

interface GrowthBoardProps {
  topImprovedStudents?: ImprovedStudent[];
}

export function GrowthBoard({ topImprovedStudents }: GrowthBoardProps) {
  const [awardedMap, setAwardedMap] = useState<Record<string, boolean>>({});

  const defaultList: ImprovedStudent[] = [
    {
      id: "imp-1",
      name: "Nguyễn Văn B",
      newRank: 11,
      oldRank: 22,
      rankGain: 11,
      avgScore: 8.25,
    },
    {
      id: "imp-2",
      name: "Trần Văn B",
      newRank: 15,
      oldRank: 24,
      rankGain: 9,
      avgScore: 7.9,
    },
    {
      id: "imp-3",
      name: "Lê Văn C",
      newRank: 19,
      oldRank: 27,
      rankGain: 8,
      avgScore: 7.5,
    },
  ];

  const list = topImprovedStudents && topImprovedStudents.length > 0 ? topImprovedStudents : defaultList;

  const handleAward = (id: string, name: string) => {
    setAwardedMap((prev) => ({ ...prev, [id]: true }));
    alert(`Đã trao huy hiệu Ghi Nhận Tiến Bộ cho ${name}!`);
  };

  return (
    <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
        <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
          <Rocket className="w-4 h-4 text-emerald-600" />
          Học Sinh Tiến Bộ Nhất Tháng
        </h3>
        <span className="text-[10px] font-bold text-emerald-600">
          Đề xuất khen thưởng
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {list.map((st) => {
          const isAwarded = awardedMap[st.id];
          const initials = st.name ? st.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "NV";

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
                    {st.name} (#{st.newRank})
                  </span>
                  <span className="text-[11px] text-emerald-700 font-extrabold">
                    ↑ Tăng +{st.rankGain} bậc (Từ #{st.oldRank} lên #{st.newRank})
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
                <span>{isAwarded ? "Đã tuyên dương" : "Ghi nhận"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
