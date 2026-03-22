"use client";

import { Flame, CheckCircle2, Trophy } from "lucide-react";

export function StatsWidget({ type }: { type: "streak" | "exercises" }) {
  if (type === "streak") {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
        <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
        <div className="space-y-2 relative z-10">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chuỗi ngày học</p>
          <div className="flex items-end gap-3">
            <h4 className="text-5xl font-black text-gray-900 leading-none tracking-tighter">05</h4>
            <span className="text-lg font-bold text-gray-400 pb-1 italic">ngày</span>
          </div>
          <p className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-1">
            <Flame className="w-3 h-3 fill-current" /> 
            Giữ vững phong độ!
          </p>
        </div>
        <div className="w-20 h-20 bg-orange-100 rounded-[1.5rem] flex items-center justify-center relative z-10 shadow-inner group-hover:rotate-12 transition-transform">
          <Flame className="w-10 h-10 text-orange-600 fill-current" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
      <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
      <div className="space-y-4 relative z-10">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nhiệm vụ tuần</p>
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-12">
                <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center ${i <= 3 ? 'bg-green-500' : 'bg-gray-200'}`}>
                            {i <= 3 && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                    ))}
                </div>
                <span className="text-xl font-black text-gray-900 tracking-tighter">3/4</span>
            </div>
            <p className="text-[10px] font-bold text-green-600 uppercase">Còn 1 bài tập nữa!</p>
        </div>
      </div>
      <div className="w-20 h-20 bg-green-100 rounded-[1.5rem] flex items-center justify-center relative z-10 shadow-inner group-hover:-rotate-12 transition-transform">
        <Trophy className="w-10 h-10 text-green-600" />
      </div>
    </div>
  );
}
