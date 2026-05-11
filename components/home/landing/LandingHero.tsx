"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

export function LandingHero() {
  const [text, setText] = useState("");
  const fullText = "Trở thành Thủ Khoa Đại Học.";
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center overflow-hidden pt-8 sm:pt-12 pb-10">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-[#0F172A]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="container relative z-10 px-4 sm:px-6 text-center space-y-4 sm:space-y-6">
        <div className="inline-block px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest animate-bounce mb-1 sm:mb-2">
          New Season: Luyện Thi Đại Học 2026
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 text-balance">
            <span className="block mb-1 sm:mb-2">Làm Chủ</span>
          </h1>
          <p className="text-lg sm:text-2xl md:text-3xl font-black italic text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)] min-h-[1.5rem] sm:min-h-[2.5rem] md:min-h-[3rem]">
            <span className="align-middle">{text}</span>
            <span className="inline-block w-1 ml-1 animate-pulse">|</span>
          </p>
        </div>

        <p className="max-w-2xl mx-auto text-xs sm:text-base text-gray-400 font-medium leading-relaxed px-4">
          Đừng chỉ học Toán, hãy học cách tư duy để giải quyết mọi bài toán khó. 
          Lộ trình bài bản từ Mất Gốc đến Vận Dụng Cao.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 pt-4 sm:pt-6 w-full max-w-[320px] sm:max-w-none mx-auto">
          <Link 
            href="/register" 
            className="w-full sm:w-auto group relative px-8 sm:px-10 py-3 sm:py-4 bg-red-600 text-white rounded-2xl font-black text-sm sm:text-lg uppercase tracking-wider overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_50px_rgba(220,38,38,0.5)]"
          >
            <span className="relative z-10">Bắt đầu hành trình</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </Link>
          
          <button className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-2 border-white/10 hover:border-white/30 text-white font-bold transition-all backdrop-blur-sm group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-red-600 transition-colors">
              <Play className="w-3 h-3 fill-current" />
            </div>
            <span className="text-xs sm:text-sm">Xem Demo</span>
          </button>
        </div>
      </div>
    </section>
  );
}
