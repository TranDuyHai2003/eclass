"use client";

import { useState } from "react";
import { RankingUser } from "@/actions/ranking";
import { calculateGameRank, GameRankType } from "@/lib/game-rank";
import { Download, Search, Award, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import Image from "next/image";

interface TeacherAdminTableProps {
  leaderboard: RankingUser[];
  studyClassName?: string | null;
  minRequiredTests?: number;
}

export function TeacherAdminTable({
  leaderboard,
  studyClassName,
  minRequiredTests = 5,
}: TeacherAdminTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRankFilter, setSelectedRankFilter] = useState<"ALL" | GameRankType>("ALL");

  const totalStudents = leaderboard.length;

  // Process students with GameRank data
  const processedStudents = leaderboard.map((user, idx) => {
    const rankPos = user.rank || idx + 1;
    const gameRank = calculateGameRank(
      user.avgScore,
      rankPos,
      totalStudents,
      user.completedTests,
      minRequiredTests
    );
    return { user, rankPos, gameRank };
  });

  // Filter students by search term and selected Game Rank
  const filteredList = processedStudents.filter(({ user, gameRank }) => {
    const matchesSearch = (user.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRank = selectedRankFilter === "ALL"
      ? true
      : (gameRank.rank === selectedRankFilter || (selectedRankFilter === "C" && !gameRank.rank));
    return matchesSearch && matchesRank;
  });

  const handleExportExcel = () => {
    alert("Đang chuẩn bị xuất file Excel danh sách học sinh Lớp " + (studyClassName || "10A1") + "...");
  };

  return (
    <section className="glass-card rounded-3xl overflow-hidden shadow-xl shadow-blue-950/5 border border-slate-200/80 bg-white/95 text-slate-800">
      {/* Top Controls: Title, Search, Excel */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            BẢNG QUẢN LÝ DÂN SỐ THỢ SĂN {studyClassName ? `• LỚP ${studyClassName}` : ""}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Phân loại theo Rank Game (C đến SSS) và tỷ lệ vượt trội học lực trong lớp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên học sinh..."
              className="px-3.5 py-1.5 pl-8 rounded-xl border border-slate-200 text-xs bg-white outline-none w-44 focus:border-blue-500 transition font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Rank Filters Bar */}
      <div className="p-3 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto text-xs font-black">
        <span className="text-slate-400 text-[11px] uppercase tracking-wider px-2 shrink-0">
          Lọc Rank:
        </span>
        {(["ALL", "SSS", "S", "A", "B", "C"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRankFilter(r)}
            className={`px-3 py-1 rounded-xl transition shrink-0 ${
              selectedRankFilter === r
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {r === "ALL" ? "Tất Cả Thợ Săn" : `Rank ${r}`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest font-extrabold text-[10px] border-b border-slate-100">
            <tr>
              <th className="py-3.5 px-4 text-center w-14">Hạng</th>
              <th className="py-3.5 px-4">Học Sinh</th>
              <th className="py-3.5 px-4 text-center">Rank Game</th>
              <th className="py-3.5 px-4 text-center">Điểm TB</th>
              <th className="py-3.5 px-4 text-center">% Vượt Trội</th>
              <th className="py-3.5 px-4 text-center">Bài Đã Nộp</th>
              <th className="py-3.5 px-4 text-center">Trạng Thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredList.map(({ user, rankPos, gameRank }) => {
              const isNeedSupport = user.avgScore < 5.5 || !user.isEligible;
              const userName = user.name || "Học sinh";
              const avatarUrl = user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`;

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isNeedSupport ? "bg-rose-50/20" : ""
                  }`}
                >
                  {/* Position */}
                  <td className="py-3 px-4 text-center font-extrabold text-slate-700">
                    #{rankPos}
                  </td>

                  {/* Student Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                        <Image
                          src={avatarUrl}
                          alt={user.name || "Student"}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-extrabold text-slate-900">
                        {user.name || "Ẩn danh"}
                      </span>
                    </div>
                  </td>

                  {/* Rank Game Badge */}
                  <td className="py-3 px-4 text-center">
                    {gameRank.rank ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${gameRank.badgeBg}`}>
                        <Award className="w-3 h-3" />
                        <span>Rank {gameRank.rank}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span>Khóa ({user.completedTests}/{minRequiredTests})</span>
                      </span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="py-3 px-4 text-center font-mono font-extrabold text-blue-600 text-sm">
                    {user.avgScore.toFixed(1)}
                  </td>

                  {/* Percentile */}
                  <td className="py-3 px-4 text-center font-mono font-extrabold text-emerald-600">
                    Cao hơn {gameRank.percentile}%
                  </td>

                  {/* Completed Tests */}
                  <td className="py-3 px-4 text-center font-mono text-slate-600">
                    {user.completedTests} bài
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center">
                    {isNeedSupport ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Cần hỗ trợ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ổn định</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
