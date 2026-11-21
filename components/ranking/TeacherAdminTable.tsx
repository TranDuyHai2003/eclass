"use client";

import { useMemo, useState } from "react";
import { RankingUser } from "@/actions/ranking";
import { calculateGameRank, GameRankType, getSafeAvatarUrl } from "@/lib/game-rank";
import { Download, Search, Award, Lock, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeacherAdminTableProps {
  leaderboard: RankingUser[];
  studyClassName?: string | null;
  minRequiredTests?: number;
}

const PAGE_SIZE = 25;
const RANK_FILTERS = ["ALL", "SSS", "SS", "S", "A", "B", "C"] as const;

export function TeacherAdminTable({ leaderboard, studyClassName, minRequiredTests = 5 }: TeacherAdminTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRankFilter, setSelectedRankFilter] = useState<"ALL" | GameRankType>("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);

  const totalStudents = leaderboard.length;

  const processedStudents = useMemo(
    () =>
      leaderboard.map((user, idx) => {
        const rankPos = user.rank || idx + 1;
        const gameRank = calculateGameRank(user.avgScore, rankPos, totalStudents, user.completedTests, minRequiredTests);
        const isNeedSupport = user.avgScore < 5.5 || !user.isEligible;
        return { user, rankPos, gameRank, isNeedSupport };
      }),
    [leaderboard, totalStudents, minRequiredTests],
  );

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return processedStudents.filter(({ user, gameRank }) => {
      const matchesSearch = !q || (user.name || "").toLowerCase().includes(q);
      const matchesRank = selectedRankFilter === "ALL" || gameRank.rank === selectedRankFilter;
      return matchesSearch && matchesRank;
    });
  }, [processedStudents, searchTerm, selectedRankFilter]);

  const shownList = filteredList.slice(0, visibleCount);

  // Xuất Excel thật (trước đây chỉ hiện hộp thông báo, không xuất gì)
  const handleExportExcel = async () => {
    if (filteredList.length === 0) {
      toast.error("Không có học sinh nào để xuất");
      return;
    }
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Xếp hạng");
      ws.columns = [
        { header: "Hạng", key: "rank", width: 8 },
        { header: "Học sinh", key: "name", width: 32 },
        { header: "Rank", key: "tier", width: 10 },
        { header: "Điểm TB", key: "avg", width: 10 },
        { header: "Cao hơn (%)", key: "pct", width: 12 },
        { header: "Bài đã nộp", key: "tests", width: 12 },
        { header: "Trạng thái", key: "status", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const { user, rankPos, gameRank, isNeedSupport } of filteredList) {
        ws.addRow({
          rank: rankPos,
          name: user.name || "Ẩn danh",
          tier: user.isEligible ? gameRank.rank : `Tạm tính (${user.completedTests}/${minRequiredTests})`,
          avg: Number(user.avgScore.toFixed(2)),
          pct: gameRank.percentile,
          tests: user.completedTests,
          status: isNeedSupport ? "Cần hỗ trợ" : "Ổn định",
        });
      }
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `xep-hang${studyClassName ? `-${studyClassName.replace(/[^\p{L}\d]+/gu, "-")}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Không xuất được file Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="rounded-none sm:rounded-3xl overflow-hidden border-y sm:border border-slate-200 bg-white shadow-[0_4px_0_0_#e3ecff] text-slate-900">
      {/* Tiêu đề, tìm kiếm, xuất Excel */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Bảng quản lý thợ săn{studyClassName ? <span className="text-blue-700"> · {studyClassName}</span> : null}
          </h3>
          <p className="text-xs text-slate-500 font-medium">Phân hạng SSS → C theo vị trí trong lớp và mức vượt trội học lực</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:flex-none">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Tìm tên học sinh..."
              className="w-full lg:w-52 px-3.5 py-2 pl-8 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-300 transition font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition shrink-0"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Lọc theo hạng */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs font-black">
        <span className="text-slate-500 text-[11px] uppercase tracking-wider pr-1 shrink-0">Lọc:</span>
        {RANK_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => {
              setSelectedRankFilter(r);
              setVisibleCount(PAGE_SIZE);
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl transition shrink-0 border",
              selectedRankFilter === r
                ? "bg-blue-100 border-blue-200 text-blue-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            {r === "ALL" ? "Tất cả" : `Rank ${r}`}
          </button>
        ))}
        <span className="ml-auto pl-2 text-[11px] text-slate-500 font-bold shrink-0">{filteredList.length} học sinh</span>
      </div>

      {/* Bảng */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest font-black text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 text-center w-14">Hạng</th>
              <th className="py-3 px-4">Học sinh</th>
              <th className="py-3 px-4 text-center">Rank</th>
              <th className="py-3 px-4 text-center">Điểm TB</th>
              <th className="py-3 px-4 text-center">Vượt trội</th>
              <th className="py-3 px-4 text-center">Đã nộp</th>
              <th className="py-3 px-4 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {shownList.map(({ user, rankPos, gameRank, isNeedSupport }) => (
              <tr key={user.id} className={cn("transition-colors hover:bg-slate-100", isNeedSupport && "bg-rose-500/[0.06]")}>
                <td className="py-3 px-4 text-center font-black tabular-nums text-slate-600">#{rankPos}</td>

                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-200 shrink-0">
                      <Image
                        src={getSafeAvatarUrl(user.name, user.image)}
                        alt={user.name || "Học sinh"}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-bold text-slate-900 truncate">{user.name || "Ẩn danh"}</span>
                  </div>
                </td>

                <td className="py-3 px-4 text-center">
                  {user.isEligible ? (
                    <span className={cn("inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full", gameRank.badgeBg)}>
                      <Award className="w-3 h-3" />
                      Rank {gameRank.rank}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title={`Cần ${minRequiredTests} bài để xếp hạng chính thức`}>
                      <Lock className="w-3 h-3" />
                      Tạm tính {user.completedTests}/{minRequiredTests}
                    </span>
                  )}
                </td>

                <td className="py-3 px-4 text-center tabular-nums font-black text-blue-700 text-sm">{user.avgScore.toFixed(1)}</td>
                <td className="py-3 px-4 text-center tabular-nums font-bold text-emerald-700">Cao hơn {gameRank.percentile}%</td>
                <td className="py-3 px-4 text-center tabular-nums text-slate-600">{user.completedTests} bài</td>

                <td className="py-3 px-4 text-center">
                  {isNeedSupport ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="w-3 h-3" />
                      Cần hỗ trợ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Ổn định
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {shownList.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                  Không có học sinh phù hợp bộ lọc
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredList.length > visibleCount && (
        <div className="flex justify-center border-t border-slate-200 p-4">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
          >
            Xem thêm {Math.min(PAGE_SIZE, filteredList.length - visibleCount)} học sinh (còn {filteredList.length - visibleCount})
          </button>
        </div>
      )}
    </section>
  );
}
