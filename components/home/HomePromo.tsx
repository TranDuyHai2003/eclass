"use client";

import { MessageSquareText, Timer, Sparkles } from "lucide-react";
import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

interface HomePromoProps {
  targetDate?: Date | null;
}

export function HomePromo({ targetDate }: HomePromoProps) {
  const finalDate = targetDate || new Date("2026-06-11T08:00:00");
  const { days, hours, minutes, seconds, isFinished } = useCountdown(finalDate);

  const Unit = ({ value, label, primary = false }: { value: number; label: string; primary?: boolean }) => (
    <div className="flex flex-col items-center">
      <div className={cn(
        "relative flex items-center justify-center bg-white rounded-2xl shadow-xl transition-transform hover:scale-105",
        primary ? "w-16 h-16 sm:w-20 sm:h-20 border-4 border-[#FEE715]" : "w-14 h-14 sm:w-16 sm:h-16 border-2 border-white/20 bg-white/10 backdrop-blur-md text-white"
      )}>
        <span className={cn(
          "text-2xl sm:text-4xl font-black tabular-nums italic",
          primary ? "text-[#A01D24]" : "text-white"
        )}>
          {value.toString().padStart(2, "0")}
        </span>
        {primary && (
          <div className="absolute -top-2 -right-2 bg-red-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full animate-bounce">
            HOT
          </div>
        )}
      </div>
      <span className={cn(
        "text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-2",
        primary ? "text-[#FEE715]" : "text-white/60"
      )}>{label}</span>
    </div>
  );

  return (
    <div className="relative w-full rounded-[2.5rem] overflow-hidden shadow-2xl group transition-all hover:shadow-red-500/20">
      {/* Background with multiple gradients and patterns */}
      <div className="absolute inset-0 bg-[#A01D24]" />
      <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-transparent to-orange-500 opacity-50" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400/10 rounded-full -ml-32 -mb-32 blur-3xl" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
        {/* Text Section */}
        <div className="text-center lg:text-left space-y-4 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
            <Timer className="w-3.5 h-3.5 text-[#FEE715]" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mục tiêu chiến dịch</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tighter leading-[0.9]">
              Chinh phục <br />
              <span className="text-[#FEE715] flex items-center gap-2">
                Kỳ thi 2026 <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 fill-[#FEE715]" />
              </span>
            </h2>
            <p className="text-white/70 text-sm sm:text-base font-medium">
              Chỉ còn một chút thời gian nữa thôi. Hãy bứt phá giới hạn bản thân ngay hôm nay!
            </p>
          </div>
          
          <button className="bg-[#FEE715] hover:bg-yellow-400 text-[#A01D24] px-8 py-3 rounded-2xl font-black uppercase text-sm transition-all hover:shadow-lg active:scale-95 flex items-center gap-2 border-b-4 border-[#D9C100] mx-auto lg:mx-0">
            <MessageSquareText className="w-4 h-4" />
            Nhận tư vấn lộ trình
          </button>
        </div>

        {/* Countdown Grid */}
        <div className="bg-black/20 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white/10 shadow-inner">
           <div className="flex gap-4 sm:gap-6">
              <Unit value={days} label="Ngày" primary />
              <Unit value={hours} label="Giờ" />
              <Unit value={minutes} label="Phút" />
              <Unit value={seconds} label="Giây" />
           </div>
           {!isFinished && (
             <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-4">
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-6 h-6 rounded-full border-2 border-[#A01D24] bg-white overflow-hidden shadow-sm" />
                   ))}
                </div>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  Hơn <span className="text-white">5,000+</span> học sinh đang cùng ôn tập
                </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
