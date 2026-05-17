"use client";

import { 
  KeyRound, 
  ArrowRight, 
  Sparkles, 
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function RightSidebar() {
  const newsItems = [
    { title: "Bí kíp đạt điểm 10 môn Toán thi THPT Quốc gia", time: "2 giờ trước", category: "Kinh nghiệm" },
    { title: "Lịch thi thử đợt 3 chính thức được công bố", time: "5 giờ trước", category: "Thông báo" },
    { title: "Top 10 thủ khoa tháng 5 gọi tên ai?", time: "1 ngày trước", category: "Vinh danh" },
  ];

  return (
    <aside className="w-[320px] bg-white border-l border-blue-100 flex flex-col h-full shrink-0 overflow-y-auto custom-scrollbar p-6 space-y-8">
      {/* Access Code Button */}
      <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 group flex items-center justify-between px-6 transition-all duration-300 active:scale-[0.98]">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
               <KeyRound className="w-4 h-4 text-white" />
            </div>
            <span className="font-black uppercase tracking-widest text-[11px]">Nhập mã truy cập</span>
         </div>
         <ArrowRight className="w-4 h-4 text-white/50 group-hover:translate-x-1 transition-transform" />
      </Button>

      {/* Vertical Promo Banner */}
      <div className="relative rounded-[2rem] overflow-hidden group cursor-pointer aspect-[4/5]">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-800" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
         
         <div className="relative h-full p-6 flex flex-col justify-between z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
               <Sparkles className="w-5 h-5 text-white" />
            </div>
            
            <div className="space-y-3">
               <h4 className="text-xl font-black text-white leading-tight uppercase">Khám phá<br/>Kho sách giải<br/>Siêu tốc</h4>
               <p className="text-xs text-blue-100 font-medium leading-relaxed">Tổng hợp hơn 5000+ bài tập có lời giải chi tiết và video hướng dẫn.</p>
               <button className="mt-2 w-fit px-5 py-2 bg-[#FEE715] text-blue-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 shadow-xl">
                  Mua ngay
               </button>
            </div>
         </div>

         {/* Animated Glow */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[60px] rounded-full group-hover:bg-white/20 transition-all duration-1000" />
      </div>

      {/* News / Updates Section */}
      <div className="space-y-5">
         <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">Tin tức mới nhất</h3>
            <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors">Xem tất cả</button>
         </div>
         
         <div className="space-y-4">
            {newsItems.map((news, i) => (
               <div key={i} className="group flex gap-4 cursor-pointer">
                  <div className="w-1.5 h-12 rounded-full bg-blue-50 group-hover:bg-blue-600 transition-all duration-300" />
                  <div className="flex-1 space-y-1">
                     <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded">{news.category}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{news.time}</span>
                     </div>
                     <p className="text-[12px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors line-clamp-2 leading-snug">
                        {news.title}
                     </p>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* Mini Stats Card */}
      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 space-y-4">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
               <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Năng lực tuần này</span>
         </div>
         <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800">+12%</span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest italic">Tăng trưởng</span>
         </div>
         <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '70%' }} />
         </div>
      </div>
    </aside>
  );
}
