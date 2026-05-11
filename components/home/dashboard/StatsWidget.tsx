"use client";

import { Flame, CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsWidget({ type }: { type: "streak" | "exercises" }) {
  if (type === "streak") {
    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between group overflow-hidden relative transition-all hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-1">
        <div className="absolute right-[-10%] top-[-10%] w-32 h-32 bg-orange-50/50 rounded-full blur-3xl group-hover:bg-orange-100/50 transition-colors duration-700" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 mb-0.5">
             <div className="w-1 h-3 bg-orange-500 rounded-full" />
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Học liên tiếp</p>
          </div>
          <div className="flex items-end gap-1.5">
            <h4 className="text-4xl font-black text-slate-900 leading-none tracking-tighter">05</h4>
            <span className="text-[11px] font-black text-slate-400 pb-0.5 uppercase tracking-widest">Ngày</span>
          </div>
          <p className="text-[9px] font-bold text-orange-600 uppercase flex items-center gap-1.5 mt-1.5">
            <span className="flex h-1.5 w-1.5 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
            </span>
            Keep it up!
          </p>
        </div>
        
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl flex items-center justify-center relative z-10 shadow-sm border border-orange-200/20 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
          <Flame className="w-7 h-7 sm:w-9 sm:h-9 text-orange-600 fill-current" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between group overflow-hidden relative transition-all hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1">
      <div className="absolute right-[-10%] top-[-10%] w-32 h-32 bg-emerald-50/50 rounded-full blur-3xl group-hover:bg-emerald-100/50 transition-colors duration-700" />
      
      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-2 mb-0.5">
           <div className="w-1 h-3 bg-emerald-500 rounded-full" />
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Nhiệm vụ tuần</p>
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={cn(
                          "w-8 h-8 rounded-xl border-2 border-white flex items-center justify-center transition-all shadow-sm",
                          i <= 3 ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
                        )}>
                            {i <= 3 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-1 h-1 bg-current rounded-full" />}
                        </div>
                    ))}
                </div>
                <div className="flex flex-col">
                   <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">3 / 4</span>
                   <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">Sắp xong!</span>
                </div>
            </div>
        </div>
      </div>
      
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl flex items-center justify-center relative z-10 shadow-sm border border-emerald-200/20 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500">
        <Trophy className="w-7 h-7 sm:w-9 sm:h-9 text-emerald-600" />
      </div>
    </div>
  );
}
