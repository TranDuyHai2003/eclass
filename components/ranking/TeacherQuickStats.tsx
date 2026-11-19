"use client";

import { Award, CheckCircle2, ShieldAlert, Users, Castle, Swords, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherQuickStatsProps {
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  completionRate?: number;
  rankSCount?: number;
  needSupportCount?: number;
}

/**
 * Số liệu server trả về là TỶ LỆ THAM GIA (% học sinh đã làm ≥ 1 bài), không phải tỷ lệ hoàn thành
 * mọi bài — trước đây gắn nhãn "Tỷ lệ hoàn thành 100%" nên mâu thuẫn với Ma trận báo động.
 */
function participationNote(rate: number | undefined) {
  if (rate === undefined) return { text: "Chưa có dữ liệu", tone: "text-slate-400" };
  if (rate >= 90) return { text: "Đã làm ít nhất 1 bài", tone: "text-emerald-300" };
  if (rate >= 60) return { text: "Còn bạn chưa làm bài nào", tone: "text-amber-300" };
  return { text: "Nhiều bạn chưa làm bài nào", tone: "text-rose-300" };
}

const fmt = (v: number | undefined, digits = 0) => (v === undefined || Number.isNaN(v) ? "—" : v.toFixed(digits));

export function TeacherQuickStats({
  studyClassName,
  totalStudents,
  classAvgScore,
  completionRate,
  rankSCount,
  needSupportCount,
}: TeacherQuickStatsProps) {
  const note = participationNote(completionRate);

  const cards = [
    {
      label: "Điểm TB lớp",
      value: classAvgScore === undefined ? "—" : `${fmt(classAvgScore, 1)} / 10`,
      sub: "Trung bình các bài đã chấm",
      subTone: "text-slate-400",
      icon: Swords,
      accent: "text-cyan-300",
      ring: "border-cyan-500/30",
      iconBg: "bg-cyan-500/10 text-cyan-300",
    },
    {
      label: "Tỷ lệ tham gia",
      value: completionRate === undefined ? "—" : `${fmt(completionRate)}%`,
      sub: note.text,
      subTone: note.tone,
      icon: CheckCircle2,
      accent: "text-emerald-300",
      ring: "border-emerald-500/30",
      iconBg: "bg-emerald-500/10 text-emerald-300",
    },
    {
      label: "Rank S trở lên",
      value: rankSCount === undefined ? "—" : `${rankSCount} HS`,
      sub: "👑 SSS · SS · S",
      subTone: "text-amber-200/80",
      icon: Award,
      accent: "text-amber-300",
      ring: "border-amber-500/30",
      iconBg: "bg-amber-500/10 text-amber-300",
    },
    {
      label: "Cần cứu trợ",
      value: needSupportCount === undefined ? "—" : `${needSupportCount} HS`,
      sub: "TB < 5 hoặc chưa đủ bài",
      subTone: "text-rose-300/90",
      icon: ShieldAlert,
      accent: "text-rose-300",
      ring: "border-rose-500/40",
      iconBg: "bg-rose-500/15 text-rose-300",
    },
  ];

  return (
    <div className="space-y-4 px-3 sm:px-0">
      {/* Tiêu đề — chữ sáng trên nền tối của trang xếp hạng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-400/40 shrink-0">
            <Castle className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Tổng quan học lực{studyClassName ? <span className="text-cyan-300"> · {studyClassName}</span> : null}
            </h2>
            <p className="text-xs text-slate-400 font-medium">Chỉ số phân hạng và hiệu suất học tập của lớp</p>
          </div>
        </div>

        <span className="text-xs font-black text-slate-200 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-cyan-300" />
          <span>Sĩ số: {totalStudents ?? "—"} học sinh</span>
        </span>
      </div>

      {/* 4 thẻ số liệu nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-2xl sm:rounded-3xl border bg-[#0D121D]/90 backdrop-blur-xl p-4 sm:p-5 shadow-xl shadow-black/30 flex items-start justify-between gap-3",
              c.ring,
            )}
          >
            <div className="space-y-1 min-w-0">
              <span className="block text-[11px] sm:text-xs text-slate-300 font-bold uppercase tracking-wider">{c.label}</span>
              <div className={cn("text-xl sm:text-2xl font-black font-mono", c.accent)}>{c.value}</div>
              <span className={cn("block text-[11px] font-bold", c.subTone)}>
                {c.label === "Cần cứu trợ" && <Skull className="inline w-3 h-3 mr-1 -mt-0.5" />}
                {c.sub}
              </span>
            </div>
            <div className={cn("hidden sm:flex w-11 h-11 rounded-2xl items-center justify-center shrink-0", c.iconBg)}>
              <c.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
