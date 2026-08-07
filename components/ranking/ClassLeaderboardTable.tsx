"use client";

import { useState } from "react";
import { RankingUser } from "@/actions/ranking";
import { Info, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassLeaderboardTableProps {
  leaderboard: RankingUser[];
  currentUserId?: string;
  totalStudentsInClass?: number;
}

export function ClassLeaderboardTable({
  leaderboard,
  currentUserId,
  totalStudentsInClass,
}: ClassLeaderboardTableProps) {
  const [showIneligible, setShowIneligible] = useState(false);

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center text-slate-500 bg-white/80 border border-slate-100">
        Chưa có dữ liệu xếp hạng cho lớp học này.
      </div>
    );
  }

  const eligibleList = leaderboard.filter((u) => u.isEligible);
  const ineligibleList = leaderboard.filter((u) => !u.isEligible);
  const totalStudents = totalStudentsInClass || leaderboard.length;

  return (
    <section className="glass-card rounded-3xl border border-slate-200/80 bg-white/90 shadow-xl shadow-blue-900/5 overflow-hidden text-slate-800 space-y-0">
      {/* Table Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
            BẢNG PHONG THẦN LỚP HỌC
          </h3>
        </div>
        <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          Đủ điều kiện:{" "}
          <strong>
            {eligibleList.length} / {totalStudents} Học sinh
          </strong>
        </span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50/80 text-slate-400 uppercase tracking-widest font-extrabold text-[10px] border-b border-slate-100">
            <tr>
              <th className="py-3.5 px-4 text-center w-16">Hạng</th>
              <th className="py-3.5 px-4">Học Sinh</th>
              <th className="py-3.5 px-4 text-center">Bài Thi</th>
              <th className="py-3.5 px-4 text-right">Điểm TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eligibleList.map((user) => {
              const isCurrent = user.isCurrentUser || user.id === currentUserId;

              return (
                <tr
                  key={user.id}
                  id={`rank-row-${user.id}`}
                  className={cn(
                    "transition-all duration-150",
                    isCurrent
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold"
                      : "hover:bg-slate-50/80"
                  )}
                >
                  <td className="py-3.5 px-4 text-center font-extrabold text-sm">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs shadow-xs",
                        user.rank === 1
                          ? "bg-amber-400 text-slate-950"
                          : user.rank === 2
                          ? "bg-slate-200 text-slate-800"
                          : user.rank === 3
                          ? "bg-orange-300 text-slate-900"
                          : isCurrent
                          ? "bg-amber-300 text-slate-950"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      )}
                    >
                      #{user.rank}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600",
                        isCurrent && "ring-2 ring-amber-300 border-amber-300"
                      )}
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || "Avatar"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{user.name?.[0] || "U"}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-bold text-sm",
                          isCurrent ? "text-white font-black" : "text-slate-900"
                        )}
                      >
                        {user.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase bg-amber-300 text-slate-950 px-2 py-0.5 rounded-full shrink-0">
                          BẠN
                        </span>
                      )}
                    </div>
                  </td>

                  <td
                    className={cn(
                      "py-3.5 px-4 text-center font-semibold",
                      isCurrent ? "text-blue-100" : "text-slate-500"
                    )}
                  >
                    {user.completedTests} bài
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={cn(
                        "text-base font-extrabold",
                        isCurrent ? "text-amber-300" : "text-blue-600"
                      )}
                    >
                      {user.avgScore.toFixed(2)}{" "}
                      <span
                        className={cn(
                          "text-xs font-normal",
                          isCurrent ? "text-blue-200" : "text-slate-400"
                        )}
                      >
                        đ
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info for Ineligible Students */}
      {ineligibleList.length > 0 && (
        <div className="bg-slate-50/90 p-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Hiển thị {eligibleList.length} / {totalStudents} học sinh đã nộp đủ tối thiểu 5 bài thi.
            </span>
          </span>
          <button
            onClick={() => setShowIneligible(!showIneligible)}
            className="text-blue-600 font-extrabold hover:underline flex items-center gap-1"
          >
            {showIneligible ? "Ẩn danh sách" : "Xem danh sách chưa đủ bài ➔"}
          </button>
        </div>
      )}

      {/* Ineligible List Accordion */}
      {showIneligible && ineligibleList.length > 0 && (
        <div className="bg-slate-100/70 p-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {ineligibleList.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 text-xs shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-[11px] shrink-0">
                  {user.name?.[0]}
                </div>
                <span className="font-bold text-slate-800 truncate">
                  {user.name}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">
                {user.completedTests}/5 bài
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
