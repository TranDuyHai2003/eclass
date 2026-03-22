"use client";

import Link from "next/link";
import { Play, Forward } from "lucide-react";

export function ContinueMission({ lastLesson }: { lastLesson: any }) {
  return (
    <div className="relative w-full bg-[#A01D24] rounded-[2.5rem] p-10 overflow-hidden shadow-2xl group border-4 border-white">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4 text-center md:text-left flex-1">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Tiếp tục nhiệm vụ
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase tracking-tighter">
            {lastLesson?.courseTitle || "Đang học dở"}
          </h2>
          <p className="text-white/70 font-bold text-lg">
            Bài giảng: {lastLesson?.title || "Chương 1: Mở đầu"}
          </p>

          <div className="w-full max-w-sm pt-4 space-y-2">
            <div className="flex justify-between text-[10px] font-black text-white/60 uppercase">
                <span>Tiến độ tổng quát</span>
                <span className="text-white">45%</span>
            </div>
            <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden border border-white/10 p-[2px]">
                <div className="h-full bg-white rounded-full transition-all duration-1000 w-[45%]" />
            </div>
            <p className="text-[10px] italic text-white/50">Cố lên! Bạn sắp hoàn thành chương này rồi.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
            <Link 
              href={`/watch/${lastLesson?.id || "1"}`}
              className="px-10 py-5 bg-white text-[#A01D24] rounded-2xl font-black text-xl uppercase tracking-wider flex items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              <Play className="w-6 h-6 fill-current" />
              Tiếp tục Bài 5
            </Link>
            
            <button className="px-8 py-3 rounded-xl bg-black/20 text-white/80 border border-white/10 hover:bg-black/30 transition-all font-bold text-sm flex items-center gap-2">
                <Forward className="w-4 h-4" />
                Duyệt nhiệm vụ khác
            </button>
        </div>
      </div>
    </div>
  );
}
