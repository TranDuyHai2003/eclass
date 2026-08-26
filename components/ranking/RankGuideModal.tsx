"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, Trophy } from "lucide-react";

interface RankGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  minRequiredTests?: number;
}

export function RankGuideModal({ isOpen, onClose }: RankGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-14 sm:top-16 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D121D] border-2 border-cyan-500/80 rounded-2xl max-w-md w-full text-white p-4 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.4)] space-y-4 relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-400 transition-colors z-10 shadow-lg"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 pr-10">
          <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/60 shadow-md shrink-0">
            <Swords className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-100 uppercase">
              CÔNG THỨC & QUY TẮC RANK
            </h2>
          </div>
        </div>

        {/* Công thức Power Score */}
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 space-y-2 font-mono">
          <div className="text-xs font-black text-cyan-300 uppercase">⚡ CÔNG THỨC POWER SCORE</div>
          <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-300 font-extrabold text-xs sm:text-sm text-center border border-cyan-500/30">
            Power Score = (Điểm TB × 10) + Bài Thi + (Streak × 0.5)
          </div>
          <ul className="text-xs text-slate-300 space-y-1 font-sans">
            <li>• <strong>Điểm TB × 10</strong>: Kết quả bài làm (tối đa 100đ).</li>
            <li>• <strong>+1 PTS / Bài thi</strong>: Thưởng làm bài.</li>
            <li>• <strong>+0.5 PTS / Ngày streak</strong>: Thưởng học đều đặn.</li>
          </ul>
        </div>

        {/* Phân cấp Rank */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-black text-amber-400 uppercase flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>PHÂN CẤP RANK</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 font-bold">
              👑 SSS: Top 3
            </div>
            <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-500/40 text-orange-300 font-bold">
              🟠 SS: Top 5%
            </div>
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 font-bold">
              🔴 S: Top 10%
            </div>
            <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 font-bold">
              🔵 A: Top 25%
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-bold">
              🟢 B: Top 50%
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-bold">
              ⚪ C: Dưới 50%
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/80 text-red-300 font-bold col-span-2 text-center animate-pulse">
              🚨 DANGER (BÁO ĐỘNG): Chưa làm bài thi nào
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-black text-xs text-white uppercase tracking-wider transition-colors shadow-lg shadow-cyan-500/25 text-center mt-2"
        >
          ĐÃ HIỂU
        </button>
      </div>
    </div>,
    document.body
  );
}
