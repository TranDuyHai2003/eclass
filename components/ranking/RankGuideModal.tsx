"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, ShieldAlert, Zap, TrendingUp, Award, CheckCircle2, Scale } from "lucide-react";

interface RankGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  minRequiredTests?: number;
}

export function RankGuideModal({
  isOpen,
  onClose,
  minRequiredTests = 5,
}: RankGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-14 sm:top-16 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D121D] border-2 border-cyan-500/80 rounded-2xl max-w-2xl w-full text-white p-4 sm:p-6 shadow-[0_0_30px_rgba(6,182,212,0.35)] space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto relative my-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-cyan-500/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-400 transition-colors z-10 shadow-lg"
          title="Đóng Hướng Dẫn"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 border-b border-slate-800 pb-4 pr-12">
          <div className="p-3 rounded-2xl bg-cyan-950/90 border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
            <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-2xl lg:text-3xl font-black tracking-widest text-slate-100 uppercase flex items-center gap-2">
              📜 QUY TẮC XẾP HẠNG THỢ SĂN (V1 FROZEN SPEC)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
              Hướng dẫn cơ chế Bayesian Power Score, 6 Bậc Rank, Độ Ổn Định & Hệ thống Level / XP
            </p>
          </div>
        </div>

        {/* Section 1: Bảng 6 Bậc Rank chuẩn */}
        <div className="space-y-3">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400 shrink-0" />
            <span>1. BẢNG PHÂN CẤP 6 BẬC RANK THỢ SĂN (6 TIERS HIERARCHY)</span>
          </h3>

          {/* Mobile Card Roster Format (sm:hidden) */}
          <div className="sm:hidden space-y-2">
            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-amber-300 bg-amber-500/20 border border-amber-400/80">
                  RANK SSS
                </span>
                <span className="text-xs font-bold text-amber-200">Huyền Thoại (Shadow Sovereign)</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 font-bold">Top 1 – 3 (Hoặc Bayesian Skill ≥ 9.5đ)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-orange-300 bg-orange-500/20 border border-orange-400/80">
                  RANK SS
                </span>
                <span className="text-xs font-bold text-orange-200">Bán Thần (Monarch Champion)</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 font-bold">Top 5% (Hoặc Bayesian Skill ≥ 9.0đ)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-rose-300 bg-rose-500/20 border border-rose-400/80">
                  RANK S
                </span>
                <span className="text-xs font-bold text-rose-200">Cao Thủ (Monarch Hunter)</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 font-bold">Top 10% (Hoặc Bayesian Skill ≥ 8.5đ)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-cyan-300 bg-cyan-500/20 border border-cyan-400/70">
                  RANK A
                </span>
                <span className="text-xs font-bold text-cyan-200">Tinh Nhuệ (Elite Hunter)</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 font-bold">Top 25% (Hoặc Bayesian Skill ≥ 7.5đ)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-400/60">
                  RANK B
                </span>
                <span className="text-xs font-bold text-emerald-200">Trung Cấp (Veteran Hunter)</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 font-bold">Top 50% (Hoặc Bayesian Skill ≥ 6.0đ)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#080B12] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full font-mono font-black text-xs text-slate-300 bg-slate-800 border border-slate-700">
                  RANK C
                </span>
                <span className="text-xs font-bold text-slate-300">Khởi Nguyên (Awakening Hunter)</span>
              </div>
              <div className="text-xs font-mono text-slate-400">Các vị trí còn lại trong lớp</div>
            </div>
          </div>

          {/* Desktop Table View (hidden sm:block) - Spacious High-End Table */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-800 bg-[#080B12]/90 shadow-xl">
            <table className="w-full text-left text-sm font-mono border-collapse">
              <thead className="bg-[#0B0F17] text-slate-400 font-black uppercase tracking-wider text-xs border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5 w-36">BẬC RANK</th>
                  <th className="py-3.5 px-5">DANH HIỆU RPG THỢ SĂN</th>
                  <th className="py-3.5 px-5 text-center">ĐIỀU KIỆN ĐẠT RANK (LEADERBOARD TOP % / BAYESIAN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-amber-300 bg-amber-500/20 border border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                      RANK SSS
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-amber-200">Huyền Thoại (Shadow Sovereign)</td>
                  <td className="py-3.5 px-5 text-center font-bold text-cyan-300">Top 1 – 3 (Hoặc Bayesian Skill ≥ 9.5đ)</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-orange-300 bg-orange-500/20 border border-orange-400/80 shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                      RANK SS
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-orange-200">Bán Thần (Monarch Champion)</td>
                  <td className="py-3.5 px-5 text-center font-bold text-cyan-300">Top 5% (Hoặc Bayesian Skill ≥ 9.0đ)</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-rose-300 bg-rose-500/20 border border-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                      RANK S
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-rose-200">Cao Thủ (Monarch Hunter)</td>
                  <td className="py-3.5 px-5 text-center font-bold text-cyan-300">Top 10% (Hoặc Bayesian Skill ≥ 8.5đ)</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-cyan-300 bg-cyan-500/20 border border-cyan-400/70 shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                      RANK A
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-cyan-200">Tinh Nhuệ (Elite Hunter)</td>
                  <td className="py-3.5 px-5 text-center font-bold text-cyan-300">Top 25% (Hoặc Bayesian Skill ≥ 7.5đ)</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-400/60 shadow-[0_0_6px_rgba(16,185,129,0.3)]">
                      RANK B
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-emerald-200">Trung Cấp (Veteran Hunter)</td>
                  <td className="py-3.5 px-5 text-center font-bold text-cyan-300">Top 50% (Hoặc Bayesian Skill ≥ 6.0đ)</td>
                </tr>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="px-3.5 py-1 rounded-full font-black text-xs text-slate-300 bg-slate-800 border border-slate-700">
                      RANK C
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-slate-300">Khởi Nguyên (Awakening Hunter)</td>
                  <td className="py-3.5 px-5 text-center text-slate-400">Các vị trí còn lại trong lớp</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Điều kiện Kích hoạt & Trạng thái Provisional */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/60 space-y-2 text-xs sm:text-sm text-amber-200 shadow-md">
          <div className="flex items-center gap-2 font-black text-amber-300 uppercase tracking-wider text-sm sm:text-base">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>2. ĐIỀU KIỆN VÀO LEADERBOARD & 4 GIAI ĐOẠN ĐỘ ỔN ĐỊNH</span>
          </div>
          <ul className="space-y-1.5 leading-relaxed list-disc list-inside text-slate-300 font-medium">
            <li><span className="font-bold text-slate-400">0 Bài thi</span>: Chưa có điểm Power Score (hiển thị <span className="font-bold text-slate-300">— PTS</span>).</li>
            <li><span className="font-bold text-amber-300">Dưới 5 bài thi</span>: Chưa đủ điều kiện xếp hạng trên Leaderboard chính thức.</li>
            <li><span className="font-bold text-cyan-300">Từ 5 đến 14 bài thi</span>: Đã vào Leaderboard, mang nhãn <span className="font-bold text-amber-300">🔒 Rank Provisional (Độ ổn định 33% – 93%)</span>.</li>
            <li><span className="font-bold text-emerald-400">Từ 15 bài thi trở lên</span>: Rank chính thức được <span className="font-bold text-emerald-300">Xác nhận 100% (Confirmed)</span>.</li>
          </ul>
        </div>

        {/* Section 3: Power Score & Level/XP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs sm:text-sm">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#080B12]/90 border border-slate-800 space-y-2 shadow-md">
            <span className="font-black text-cyan-300 uppercase block font-mono flex items-center gap-1.5 text-xs sm:text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              POWER SCORE (BAYESIAN)
            </span>
            <p className="text-slate-400 leading-relaxed">
              Điểm sức mạnh tính bằng: <span className="text-amber-300 font-mono font-bold">BayesianSkill x 10</span>. Công thức Bayesian Prior làm mịn uy tín dựa trên mẫu bài làm, bảo vệ thực lực của thợ săn giỏi mà không dìm điểm khi mới làm ít bài!
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#080B12]/90 border border-slate-800 space-y-2 shadow-md">
            <span className="font-black text-emerald-300 uppercase block font-mono flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              HỆ THỐNG LEVEL & XP CHĂM CHỈ
            </span>
            <p className="text-slate-400 leading-relaxed">
              Tích lũy XP qua mỗi Quest (+100 XP) và Streak (+50 XP). Đủ 500 XP sẽ thăng cấp <span className="text-emerald-400 font-bold">LEVEL</span> mới mà không làm méo mó Rank năng lực cạnh tranh!
            </p>
          </div>
        </div>

        {/* Section 4: Tie-Breaking Rules */}
        <div className="p-4 rounded-2xl bg-[#080B12]/90 border border-slate-800 space-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-black text-cyan-300 uppercase tracking-wider text-xs sm:text-sm font-mono">
            <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>4. QUY TẮC PHÂN ĐỊNH HÒA THỨ HẠNG (5-LEVEL TIE-BREAKING)</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 font-mono font-medium">
            <li>Ưu tiên 1: <span className="text-amber-300 font-bold">Power Score</span> cao hơn</li>
            <li>Ưu tiên 2: <span className="text-cyan-300 font-bold">Bayesian Skill</span> cao hơn</li>
            <li>Ưu tiên 3: <span className="text-emerald-400 font-bold">Độ ổn định (Consistency %)</span> cao hơn</li>
            <li>Ưu tiên 4: <span className="text-slate-200 font-bold">Số Quests hoàn thành</span> nhiều hơn</li>
            <li>Ưu tiên 5: <span className="text-slate-400 font-bold">ID Thợ Săn</span> (Đảm bảo thứ hạng luôn cố định tuyệt đối)</li>
          </ol>
        </div>

        {/* Footer Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-black text-xs sm:text-sm text-white uppercase tracking-wider transition-colors shadow-lg shadow-cyan-500/25 text-center"
          >
            ĐÃ HIỂU (ĐÓNG)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
