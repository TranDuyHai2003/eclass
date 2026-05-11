"use client";

import Link from "next/link";
import { Play, Forward } from "lucide-react";

export function ContinueMission({ lastLesson }: { lastLesson: any }) {
  return (
    <div className="relative w-full bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 overflow-hidden shadow-2xl group border border-white/5">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600/5 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />

      <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6 sm:gap-10">
        <div className="space-y-4 text-center xl:text-left flex-1 w-full">
          <div className="inline-flex items-center gap-2 bg-red-600/10 backdrop-blur-md px-4 py-1.5 rounded-full text-red-500 text-[9px] font-black uppercase tracking-[0.2em] border border-red-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span>
            </span>
            Tiếp tục nhiệm vụ
          </div>
          
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight uppercase tracking-tighter drop-shadow-sm">
              {lastLesson?.courseTitle || "Đang học dở"}
            </h2>
            <p className="text-white/60 font-bold text-sm sm:text-base tracking-tight">
              Mục tiêu: <span className="text-white">{lastLesson?.title || "Chương 1: Mở đầu"}</span>
            </p>
          </div>

          <div className="w-full max-w-sm mx-auto xl:mx-0 pt-1 space-y-2.5">
            <div className="flex justify-between text-[9px] font-black text-white/40 uppercase tracking-widest">
                <span>Tiến trình hiện tại</span>
                <span className="text-red-500">Gần hoàn thành</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-1000 w-[75%] shadow-[0_0_12px_rgba(220,38,38,0.4)]" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row xl:flex-col gap-3 w-full sm:w-auto shrink-0">
            <Link 
              href={`/watch/${lastLesson?.id || "1"}`}
              className="group/btn px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl hover:bg-red-600 hover:text-white"
            >
              <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white group-hover/btn:bg-white group-hover/btn:text-red-600 transition-colors">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
              Vào học ngay
            </Link>
            
            <button className="px-6 py-3 rounded-xl bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                <Forward className="w-3.5 h-3.5" />
                Duyệt nhiệm vụ khác
            </button>
        </div>
      </div>
    </div>
  );
}
