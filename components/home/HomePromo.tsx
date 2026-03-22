"use client";

import { MessageSquareText } from "lucide-react";

export function HomePromo() {
  return (
    <div className="flex flex-col gap-4 mt-6">
      {/* Consultation Button */}
      <button className="w-full bg-[#A01D24] hover:bg-[#8B191E] text-white rounded-xl p-4 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 border-2 border-[#FEE715]/20 group">
        <div className="bg-[#FEE715] p-2 rounded-lg text-[#A01D24] group-hover:rotate-12 transition-transform">
          <MessageSquareText className="w-6 h-6" />
        </div>
        <div className="text-left">
          <p className="text-[10px] font-bold text-[#FEE715] uppercase tracking-widest opacity-80">Liên hệ ngay</p>
          <p className="text-lg font-black uppercase leading-tight">Nhận tư vấn ngay</p>
        </div>
      </button>

      {/* Countdown Card */}
      <div className="w-full bg-white rounded-xl border-2 border-[#A01D24]/10 shadow-sm overflow-hidden">
        <div className="bg-[#A01D24] py-2 px-4 text-center">
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Đếm ngược ngày thi</p>
        </div>
        <div className="p-4 text-center bg-gradient-to-b from-white to-red-50/30">
            <p className="text-xs font-bold text-[#A01D24] uppercase mb-3">Kỳ thi tốt nghiệp THPT 2026</p>
            <div className="flex justify-center gap-2">
                {[
                  { label: "Ngày", value: "450" },
                  { label: "Giờ", value: "12" },
                  { label: "Phút", value: "30" }
                ].map((unit) => (
                    <div key={unit.label} className="bg-white border border-red-100 rounded-lg p-2 min-w-[50px] shadow-sm">
                        <p className="text-xl font-black text-[#A01D24] leading-none">{unit.value}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{unit.label}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
