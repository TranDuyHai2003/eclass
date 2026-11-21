"use client";

import { MessageSquareText, Timer, Sparkles } from "lucide-react";
import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

const Unit = ({
  value,
  label,
  primary = false,
}: {
  value: number;
  label: string;
  primary?: boolean;
}) => (
  <div className="flex flex-col items-center">
    <div
      className={cn(
        "relative flex items-center justify-center bg-white rounded-2xl shadow-xl transition-transform hover:scale-105",
        primary
          ? "w-12 h-12 sm:w-16 sm:h-16 border-4 border-[#FEE715]"
          : "w-11 h-11 sm:w-14 sm:h-14 border-2 border-white/20 bg-white/10 backdrop-blur-md text-white",
      )}
    >
      <span
        className={cn(
          "text-xl sm:text-3xl font-black tabular-nums italic",
          primary ? "text-[#2563EB]" : "text-white",
        )}
      >
        {value.toString().padStart(2, "0")}
      </span>
      {primary && (
        <div className="absolute -top-2 -right-2 bg-blue-600 text-xs font-black text-white px-2 py-0.5 rounded-full animate-bounce">
          HOT
        </div>
      )}
    </div>
    <span
      className={cn(
        "text-[10px] sm:text-xs font-black uppercase tracking-wider mt-1.5",
        primary ? "text-[#FEE715]" : "text-white/80",
      )}
    >
      {label}
    </span>
  </div>
);

const EXAM_DATE = new Date("2027-06-11T08:00:00");

/**
 * Đếm ngược kỳ thi.
 * - "banner": dải lớn (trang chủ khách / giáo viên)
 * - "card": thẻ trắng gọn ở cột phải trang chủ học sinh — không tranh chỗ với thẻ chào
 */
export function HomePromo({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const { days, hours, minutes, seconds } = useCountdown(EXAM_DATE);

  if (variant === "card") {
    const units = [
      { v: days, l: "Ngày" },
      { v: hours, l: "Giờ" },
      { v: minutes, l: "Phút" },
      { v: seconds, l: "Giây" },
    ];
    return (
      <div data-testid="exam-countdown" className="min-w-0 rounded-3xl border-2 border-blue-100 bg-white p-4 shadow-[0_4px_0_0_#dbeafe]">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Timer className="h-4 w-4" />
            </span>
            <span className="truncate">Kỳ thi THPT 2027</span>
          </p>
          <span className="shrink-0 text-xs font-bold text-slate-400">11/06/2027</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {units.map((u, i) => (
            <div
              key={u.l}
              className={cn(
                "flex min-w-0 flex-col items-center rounded-2xl py-2",
                i === 0 ? "bg-blue-600 text-white shadow-[0_3px_0_0_#1e3a8a]" : "bg-blue-50 text-blue-700",
              )}
            >
              <span suppressHydrationWarning className="text-xl font-black tabular-nums leading-tight sm:text-2xl">
                {i === 0 ? u.v : u.v.toString().padStart(2, "0")}
              </span>
              <span className={cn("text-[11px] font-bold", i === 0 ? "text-blue-100" : "text-blue-500")}>{u.l}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_6px_0_0_#1e3a8a] group transition-all">
      {/* Background with multiple gradients and patterns */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-sky-500" />
      <div aria-hidden className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      <div aria-hidden className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-300/15 rounded-full -ml-24 -mb-32 blur-3xl" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row items-center justify-between gap-5 md:gap-8">
        {/* Text Section */}
        <div className="text-center lg:text-left space-y-2.5 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
            <Timer className="w-4 h-4 text-[#FEE715]" />
            <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Mục tiêu chiến dịch
            </span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-[0.95]">
              Chinh phục <br />
              <span className="text-[#FEE715] flex items-center justify-center lg:justify-start gap-2">
                Kỳ thi 2027{" "}
                <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 fill-[#FEE715]" />
              </span>
            </h2>
            <p className="text-white/70 text-sm sm:text-base font-medium">
              Chỉ còn một chút thời gian nữa thôi. Hãy bứt phá giới hạn bản thân
              ngay hôm nay!
            </p>
          </div>
        </div>

        {/* Countdown Grid */}
        <div className="bg-black/20 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/10 shadow-inner">
          <div className="flex gap-3 sm:gap-5">
            <Unit value={days} label="Ngày" primary />
            <Unit value={hours} label="Giờ" />
            <Unit value={minutes} label="Phút" />
            <Unit value={seconds} label="Giây" />
          </div>
        </div>
      </div>
    </div>
  );
}
