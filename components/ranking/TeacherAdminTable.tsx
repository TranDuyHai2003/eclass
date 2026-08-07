"use client";

import { useState } from "react";
import { RankingUser } from "@/actions/ranking";
import { Download, Search, Flame, ArrowUp, ArrowDown, Eye, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherAdminTableProps {
  leaderboard: RankingUser[];
  studyClassName?: string | null;
}

export function TeacherAdminTable({ leaderboard, studyClassName }: TeacherAdminTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLeaderboard = leaderboard.filter((user) =>
    (user.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportExcel = () => {
    alert("Đang chuẩn bị file Excel danh sách bảng điểm Lớp " + (studyClassName || "10A1") + "...");
  };

  return (
    <section className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 bg-white/90">
      {/* Table Top Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
            Bảng Điểm Danh Sách Học Sinh {studyClassName || "Lớp 10A1"}
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">
            Đầy đủ thông số học tập để hỗ trợ quản lý chuyên môn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên học sinh..."
              className="px-3 py-1.5 pl-8 rounded-xl border border-slate-200 text-xs bg-white outline-none w-44 focus:border-blue-500 transition"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
            <tr>
              <th className="py-3.5 px-4 text-center w-12">Hạng</th>
              <th className="py-3.5 px-4">Học Sinh</th>
              <th className="py-3.5 px-4 text-center">Biến động</th>
              <th className="py-3.5 px-4 text-center">Bài đã nộp</th>
              <th className="py-3.5 px-4 text-center">Bài mới nhất</th>
              <th className="py-3.5 px-4 text-center">Chuỗi học</th>
              <th className="py-3.5 px-4 text-right">ĐTB</th>
              <th className="py-3.5 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredLeaderboard.map((user) => {
              const rankDisplay = user.rank ? `#${user.rank}` : "-";
              const rankChange = user.rankChange;
              const isLowScore = user.avgScore < 5.0 || !user.isEligible;
              const latestScore = user.latestTestScore ?? user.avgScore;

              return (
                <tr
                  key={user.id}
                  className={cn(
                    "hover:bg-slate-50 transition-colors",
                    isLowScore && "bg-rose-50/30"
                  )}
                >
                  <td
                    className={cn(
                      "py-3.5 px-4 text-center font-extrabold text-xs",
                      user.rank === 1
                        ? "text-amber-500 font-black text-sm"
                        : "text-slate-500"
                    )}
                  >
                    {rankDisplay}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-bold text-sm",
                          isLowScore ? "text-rose-600" : "text-slate-900"
                        )}
                      >
                        {user.name}
                      </span>
                      {!user.isEligible && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Chưa đủ bài
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5",
                        rankChange && rankChange > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : rankChange && rankChange < 0
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {rankChange && rankChange > 0 ? (
                        <>▲ +{rankChange}</>
                      ) : rankChange && rankChange < 0 ? (
                        <>▼ {rankChange}</>
                      ) : (
                        "Giữ"
                      )}
                    </span>
                  </td>

                  <td
                    className={cn(
                      "py-3.5 px-4 text-center font-bold",
                      user.completedTests >= 5 ? "text-slate-800" : "text-rose-600"
                    )}
                  >
                    {user.completedTests}/18
                  </td>

                  <td
                    className={cn(
                      "py-3.5 px-4 text-center font-bold",
                      latestScore >= 8.0
                        ? "text-emerald-600"
                        : latestScore < 5.0
                        ? "text-rose-600"
                        : "text-slate-700"
                    )}
                  >
                    {latestScore.toFixed(1)}
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                    <span className="inline-flex items-center gap-1">
                      {user.completedTests > 0 ? "7 ngày" : "0 ngày"}{" "}
                      <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                    {user.avgScore.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {isLowScore ? (
                      <button
                        onClick={() => alert(`Đã gửi thông báo cảnh báo hỗ trợ tới ${user.name}`)}
                        className="text-rose-600 hover:underline font-bold text-[11px] flex items-center gap-1 mx-auto"
                      >
                        <AlertCircle className="w-3 h-3 text-rose-600" /> Cảnh báo
                      </button>
                    ) : (
                      <button
                        onClick={() => alert(`Xem chi tiết quá trình học của ${user.name}`)}
                        className="text-blue-600 hover:underline font-bold text-[11px] flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3 h-3 text-blue-600" /> Xem chi tiết
                      </button>
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
