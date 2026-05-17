"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Trophy, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  id: number;
  bgGradient: string;
  badge: string;
  title: string;
  subtitle: string;
  price: string;
  originalPrice: string;
  extraText?: string;
  giftTitle?: string;
  giftDesc?: string;
  teacherName?: string;
  teacherTitle?: string;
  scoreLabel?: string;
  glowColor: string;
}

const slides: Slide[] = [
  {
    id: 1,
    bgGradient: "from-[#A01D24] via-[#D32F2F] to-[#E53935]",
    badge: "DÀNH RIÊNG CHO 2K8",
    title: "KHÓA LUYỆN ĐỀ THPTQG",
    subtitle: "HỆ THỐNG LAB - LÀM CHỦ TRI THỨC - BỨT PHÁ TƯ DUY",
    price: "499.000đ",
    originalPrice: "1.000.000đ",
    extraText: "Học sinh cũ khóa TSA giảm còn 299K",
    giftTitle: "QUÀ TẶNG ĐẶC BIỆT",
    giftDesc: "Sách 30 chủ đề xác suất ôn thi cực đỉnh",
    teacherName: "GV. TRẦN HOÀNG ANH",
    teacherTitle: "Chuyên gia luyện thi hàng đầu",
    scoreLabel: "Thủ khoa SPT 2025 - 29,5 điểm",
    glowColor: "rgba(229, 57, 53, 0.4)"
  },
  {
    id: 2,
    bgGradient: "from-slate-900 via-slate-800 to-[#A01D24]",
    badge: "PHÒNG LUYỆN THI THÔNG MINH",
    title: "CHIẾN DỊCH TỔNG ÔN ĐỢT 2",
    subtitle: "LÀM ĐỀ THỬ - TỰ ĐỘNG ĐÁNH GIÁ NĂNG LỰC & CHỈ RA YẾU ĐIỂM",
    price: "FREE",
    originalPrice: "Miễn Phí",
    extraText: "Mở khóa vĩnh viễn đề thi thử chuyên sâu các Sở & Trường Chuyên",
    giftTitle: "Smart Analytics",
    giftDesc: "Radar năng lực phát hiện dạng toán yếu trong 3 giây",
    teacherName: "HỌC TOÁN THẬT DỄ",
    teacherTitle: "Nền tảng công nghệ LMS",
    scoreLabel: "Hơn 5000+ học sinh đang ôn tập hàng ngày",
    glowColor: "rgba(15, 23, 42, 0.4)"
  }
];

export function HomeCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative w-full aspect-[2.2/1] min-h-[220px] max-h-[420px] rounded-[2rem] overflow-hidden shadow-2xl group border border-white/5 select-none">
      {/* Slides Container */}
      <div className="w-full h-full relative">
        {slides.map((slide, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 w-full h-full bg-gradient-to-r flex items-center p-6 sm:p-10 transition-all duration-1000",
                slide.bgGradient,
                isActive ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none"
              )}
            >
              {/* Dot & Grid Overlays */}
              <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none" />
              <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-white/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative z-10 w-full h-full flex items-center justify-between gap-6">
                {/* Left Content */}
                <div className="flex-1 space-y-2 sm:space-y-4 max-w-[65%]">
                  {/* Badge */}
                  <span className="inline-flex items-center gap-1.5 bg-yellow-400 text-[#A01D24] px-3.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black tracking-wider uppercase border border-yellow-200/50 shadow-sm animate-pulse">
                    <Sparkles className="w-3 h-3 fill-current" />
                    {slide.badge}
                  </span>

                  {/* Title & Subtitle */}
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-tight drop-shadow-md">
                      {slide.title}
                    </h2>
                    <p className="text-white/80 font-bold text-[8px] sm:text-xs tracking-wider uppercase leading-snug">
                      {slide.subtitle}
                    </p>
                  </div>

                  {/* Pricing info */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-2xl border border-white/10 flex flex-col items-center shadow-inner">
                      <span className="text-[7px] sm:text-[8px] font-bold text-white/50 uppercase tracking-widest leading-none">Ưu đãi học phí</span>
                      <span className="text-base sm:text-2xl font-black italic text-yellow-300 tracking-tight mt-0.5">{slide.price}</span>
                    </div>
                    {slide.originalPrice && (
                      <div className="flex flex-col text-white/60 leading-none">
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest leading-none">Giá gốc</span>
                        <span className="line-through text-xs sm:text-sm font-bold mt-1 text-white/50">{slide.originalPrice}</span>
                      </div>
                    )}
                  </div>

                  {/* Extra promotions */}
                  <p className="text-[8px] sm:text-xs font-bold text-yellow-300 tracking-wide uppercase italic">
                    * {slide.extraText}
                  </p>

                  {/* Gift Pack card */}
                  {slide.giftTitle && (
                    <div className="hidden md:flex items-center gap-3 bg-black/20 backdrop-blur-sm p-3 rounded-2xl border border-white/5 w-fit">
                      <div className="p-2 bg-yellow-400 rounded-xl text-[#A01D24]">
                        <Trophy className="w-4 h-4 fill-current" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-yellow-400 uppercase tracking-wider leading-none">{slide.giftTitle}</span>
                        <span className="text-[10px] font-bold text-white tracking-tight mt-0.5">{slide.giftDesc}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Teacher/Hero Card Graphic */}
                <div className="hidden sm:flex flex-col items-center justify-end h-full w-[30%] shrink-0 relative pb-2">
                  <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-3 sm:p-4 text-center space-y-1 sm:space-y-2 shadow-2xl relative overflow-hidden group/card hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-white/0 pointer-events-none" />
                    
                    {/* Circle Avatar Graphic */}
                    <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-yellow-300 to-red-500 mx-auto flex items-center justify-center text-white border-2 border-white shadow-xl relative z-10">
                      <BookOpen className="w-7 h-7" />
                    </div>

                    <div className="relative z-10">
                      <p className="text-[10px] sm:text-xs font-black text-yellow-300 tracking-tight leading-none uppercase">
                        {slide.teacherName}
                      </p>
                      <p className="text-[7px] sm:text-[8px] font-black text-white/60 tracking-widest uppercase mt-0.5">
                        {slide.teacherTitle}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-white/10 relative z-10">
                      <span className="bg-red-600 text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-inner">
                        {slide.scoreLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#A01D24] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/10 shadow-lg z-20 active:scale-90"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#A01D24] flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/10 shadow-lg z-20 active:scale-90"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Slide Indicators / Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIdx(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300 shadow-sm",
              idx === activeIdx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
            )}
          />
        ))}
      </div>
    </div>
  );
}
