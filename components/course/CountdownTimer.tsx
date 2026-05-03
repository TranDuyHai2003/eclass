"use client";

import { useEffect, useState, useMemo } from "react";
import { Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: string; // ISO string or Date string
  title?: string;
}

export function CountdownTimer({ 
  targetDate, 
  title = "Đếm ngược ngày thi" 
}: CountdownTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isFinished: false
  });

  const target = useMemo(() => new Date(targetDate).getTime(), [targetDate]);

  useEffect(() => {
    setMounted(true);
    
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isFinished: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isFinished: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [target]);

  if (!mounted) return null;

  if (timeLeft.isFinished) {
    return (
      <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden group">
        <div className="relative z-10 flex items-center gap-3">
           <Trophy className="w-8 h-8 opacity-50 absolute -right-2 -top-2 rotate-12 transition-transform group-hover:scale-125" />
           <div>
             <h4 className="font-black uppercase tracking-widest text-[10px] opacity-80 mb-1">Kỳ thi đã bắt đầu</h4>
             <p className="font-bold text-sm">Chúc các sĩ tử thi tốt! 🚀</p>
           </div>
        </div>
      </div>
    );
  }

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center flex-1">
      <div className="relative w-full aspect-square flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner group-hover:border-white/40 transition-colors">
        <span className="text-xl md:text-2xl font-black tabular-nums drop-shadow-md">
          {value.toString().padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] font-black uppercase tracking-tighter opacity-70 mt-1.5">{label}</span>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden group transition-all hover:shadow-indigo-500/20 active:scale-[0.98]">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl transition-transform group-hover:scale-150" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-400/20 rounded-full -ml-12 -mb-12 blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
              <Timer className="w-4 h-4" />
            </div>
            <h4 className="font-black uppercase tracking-widest text-[10px] leading-none">{title}</h4>
          </div>
          <div className="px-2 py-0.5 bg-red-500 rounded-full text-[8px] font-black animate-pulse shadow-lg shadow-red-500/50">
            SẮP THI
          </div>
        </div>

        <div className="flex gap-2.5">
          <Unit value={timeLeft.days} label="Ngày" />
          <Unit value={timeLeft.hours} label="Giờ" />
          <Unit value={timeLeft.minutes} label="Phút" />
          <Unit value={timeLeft.seconds} label="Giây" />
        </div>

        <div className="mt-4 flex items-center justify-between">
           <div className="flex -space-x-1.5">
             {[1,2,3].map(i => (
               <div key={i} className="w-5 h-5 rounded-full border-2 border-indigo-600 bg-indigo-200 overflow-hidden" />
             ))}
             <div className="text-[8px] font-bold self-center ml-2 opacity-80 uppercase tracking-tighter">
               1.2K+ học sinh đang ôn luyện
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
