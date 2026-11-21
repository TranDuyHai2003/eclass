"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, Trophy } from "lucide-react";

interface RankGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  minRequiredTests?: number;
}

export function RankGuideModal({ isOpen, onClose, minRequiredTests = 5 }: RankGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-14 sm:top-16 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-[0_6px_0_0_#bfdbfe] max-w-md w-full text-slate-900 p-4 sm:p-6 space-y-4 relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-blue-300 transition-colors z-10 shadow-lg"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 pr-10">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 shadow-md shrink-0">
            <Swords className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase">
              CÔNG THỨC & QUY TẮC RANK
            </h2>
          </div>
        </div>

        {/* Công thức Power Score */}
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2 tabular-nums">
          <div className="text-xs font-black text-blue-700 uppercase">⚡ CÔNG THỨC POWER SCORE</div>
          <div className="p-2.5 rounded-lg bg-slate-50 text-blue-700 font-extrabold text-xs sm:text-sm text-center border border-blue-200">
            Power Score = (Điểm TB × 10) + Bài Thi + (Streak × 0.5)
          </div>
          <ul className="text-xs text-slate-600 space-y-1 font-sans">
            <li>• <strong>Điểm TB × 10</strong>: Kết quả bài làm (tối đa 100đ).</li>
            <li>• <strong>+1 PTS / Bài thi</strong>: Thưởng làm bài.</li>
            <li>• <strong>+0.5 PTS / Ngày streak</strong>: Thưởng học đều đặn.</li>
          </ul>
        </div>

        {/* Phân cấp Rank */}
        <div className="space-y-2">
          <div className="text-xs tabular-nums font-black text-amber-700 uppercase flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-700" />
            <span>PHÂN CẤP RANK</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold">
              👑 SSS: Top 3
            </div>
            <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 font-bold">
              🟠 SS: Top 5%
            </div>
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold">
              🔴 S: Top 10%
            </div>
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold">
              🔵 A: Top 25%
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
              🟢 B: Top 50%
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-bold">
              ⚪ C: Dưới 50%
            </div>
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 font-bold col-span-2 text-center animate-pulse">
              🚨 DANGER (BÁO ĐỘNG): Chưa làm bài thi nào
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold col-span-2 text-center">
              ⏳ TẠM TÍNH: Chưa đủ {minRequiredTests} bài → xếp sau những bạn đã đủ bài, chưa tính hạng chính thức
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 font-black text-xs text-white uppercase tracking-wider transition-colors shadow-lg text-center mt-2"
        >
          ĐÃ HIỂU
        </button>
      </div>
    </div>,
    document.body
  );
}
