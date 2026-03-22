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
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-[#0F172A]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="container relative z-10 px-4 sm:px-6 text-center space-y-8">
        <div className="inline-block px-4 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-widest animate-bounce">
          New Season: Luyện Thi Đại Học 2026
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 text-balance">
            <span className="block mb-1 sm:mb-3">Làm Chủ</span>
          </h1>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black italic text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)] min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem]">
            <span className="align-middle">{text}</span>
            <span className="inline-block w-1 ml-1 animate-pulse">|</span>
          </p>
        </div>

        <p className="max-w-2xl mx-auto text-lg text-gray-400 font-medium leading-relaxed">
          Đừng chỉ học Toán, hãy học cách tư duy để giải quyết mọi bài toán khó. 
          Lộ trình bài bản từ Mất Gốc đến Vận Dụng Cao.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-8">
          <Link 
            href="/register" 
            className="group relative px-8 sm:px-10 py-4 sm:py-5 bg-red-600 text-white rounded-2xl font-black text-lg sm:text-xl uppercase tracking-wider overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_50px_rgba(220,38,38,0.5)]"
          >
            <span className="relative z-10">Bắt đầu hành trình ngay</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </Link>
          
          <button className="flex items-center gap-3 px-7 sm:px-8 py-4 sm:py-5 rounded-2xl border-2 border-white/10 hover:border-white/30 text-white font-bold transition-all backdrop-blur-sm group">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-red-600 transition-colors">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <span>Xem Demo</span>
          </button>
        </div>
      </div>
    </section>
  );
}
