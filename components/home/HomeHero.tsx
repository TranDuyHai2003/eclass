"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const teachers = [
  { name: "Môn Toán", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Math", subject: "Toán" },
  { name: "Môn Hóa", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Chemistry", subject: "Hóa" },
  { name: "Môn Anh", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=English", subject: "Anh" },
  { name: "Môn Lý", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Physics", subject: "Lý" },
];

export function HomeHero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <div className="relative w-full aspect-[21/9] rounded-[2rem] overflow-hidden bg-[#A01D24] shadow-2xl group border-4 border-white">
      {/* Background Graphic elements like in Image 5 */}
      <div className="absolute top-8 left-8 text-white/10">
        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM3.89 9L12 4.57 20.11 9 12 13.43 3.89 9z" />
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center px-12 sm:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 w-full gap-8 items-center">
            {/* Text Content */}
            <div className="text-white space-y-4">
                <div className="inline-block bg-white text-[#A01D24] px-4 py-1 rounded-full font-black text-2xl rotate-[-2deg] shadow-lg">
                    2K9
                </div>
                <h2 className="text-4xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tighter">
                    Xuất Phát <br />
                    <span className="text-[#FEE715]">Sớm</span>
                </h2>
                <div className="bg-[#FEE715] text-[#A01D24] py-1 px-4 inline-block font-black skew-x-[-10deg]">
                    TOÁN - LÝ - HÓA - ANH
                </div>
                <p className="text-sm font-bold opacity-90 uppercase tracking-widest max-w-sm">
                    Luyện thi tốt nghiệp THPT 2027 cùng Tenschool
                </p>
            </div>

            {/* Teacher Cards */}
            <div className="hidden lg:grid grid-cols-4 gap-4 mt-auto pb-12">
                {teachers.map((t) => (
                    <div key={t.name} className="flex flex-col items-center group/card cursor-pointer">
                        <div className="relative w-full aspect-[3/4] bg-white/10 rounded-2xl border border-white/20 overflow-hidden transition-all group-hover/card:bg-white/20 group-hover/card:scale-105">
                            <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#A01D24] to-transparent p-2 text-center">
                                <p className="text-[10px] font-bold text-white uppercase">{t.name}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Carousel Controls */}
      <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40">
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}
