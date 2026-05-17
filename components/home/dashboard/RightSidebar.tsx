"use client";

import { useState } from "react";
import { 
  KeyRound, 
  ArrowRight, 
  Sparkles, 
  Plane,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function RightSidebar() {
  const [showModal, setShowModal] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  const newsItems = [
    { 
      title: "Thi thử TSA ngày 01/08/2025", 
      time: "12:48 - 01/08/2025", 
      category: "Thi thử",
      imageUrl: "/news1.png"
    }
  ];

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast.error("Vui lòng nhập mã truy cập!");
      return;
    }
    toast.success(`Đang kích hoạt mã: ${accessCode.toUpperCase()}...`);
    setAccessCode("");
    setShowModal(false);
  };

  return (
    <div className="w-[300px] flex flex-col shrink-0 space-y-6">
      {/* 1. Vertical Promo Banner (KHÓA TỔNG ÔN ĐỢT 2) */}
      <div className="relative rounded-[2.5rem] bg-white border border-red-100 overflow-hidden group cursor-pointer shadow-md shadow-red-100/30 flex flex-col p-5 space-y-4">
        {/* Banner Top Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-black text-red-600 tracking-tighter">LA'B</span>
            <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">HỆ THỐNG LA'B</span>
          </div>
          <Sparkles className="w-4 h-4 text-red-500 fill-current animate-pulse" />
        </div>

        {/* Banner Main Subject */}
        <div className="space-y-1">
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">
            KHÓA TỔNG ÔN <span className="text-red-600 block sm:inline">ĐỢT 2</span>
          </h4>
          <div className="w-6 h-0.5 bg-red-600 rounded-full" />
        </div>

        {/* Flight Line / Flight Vector Graphic */}
        <div className="relative bg-gradient-to-br from-red-50 to-pink-50/50 rounded-2xl p-4 flex flex-col items-center justify-center border border-red-100/50 h-36 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />
          <Plane className="w-12 h-12 text-red-600/20 transform -rotate-12 group-hover:translate-y-[-10px] group-hover:translate-x-[10px] transition-transform duration-500" />
          <span className="text-[18px] font-black text-red-600 tracking-tight mt-2">1.600 K</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Cho Học sinh đăng ký lần đầu</span>
        </div>

        {/* Pricing tag & Promo CTA */}
        <div className="bg-[#A01D24] text-white p-3.5 rounded-xl text-center shadow-md">
          <p className="text-[8px] font-black uppercase tracking-widest text-red-200">Giá Học Sinh Cũ</p>
          <p className="text-sm font-black mt-0.5">800.000 Đ & Miễn Phí Phòng Luyện</p>
        </div>
      </div>

      {/* 2. Access Code Button */}
      <Button 
        onClick={() => setShowModal(true)}
        className="w-full h-11 rounded-xl bg-[#7B2E33] hover:bg-[#A01D24] shadow-md shadow-red-100 flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] text-white font-black"
      >
        <KeyRound className="w-4 h-4 text-white" />
        <span className="font-bold uppercase tracking-wider text-[11px]">Nhập mã truy cập</span>
      </Button>

      {/* 3. News / Updates Section */}
      <div className="space-y-4 bg-transparent">
        <div className="flex items-center justify-between border-b border-red-100 pb-2">
          <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Tin tức</h3>
          <button className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors">Xem tất cả</button>
        </div>
        
        <div className="space-y-3">
          {newsItems.map((news, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-2xl border border-red-100/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
              {/* Mini News Thumbnail */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center text-red-600 shrink-0 border border-red-200/50">
                <Sparkles className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[11px] font-black text-slate-800 group-hover:text-red-600 transition-colors line-clamp-1 leading-snug">
                  {news.title}
                </p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{news.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Activation Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] border border-red-100 shadow-2xl p-8 max-w-sm w-full relative space-y-6 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-1.5 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto border border-red-100">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Kích hoạt khóa học</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Nhập mã truy cập của bạn bên dưới để mở khóa</p>
            </div>

            <form onSubmit={handleActivate} className="space-y-4">
              <Input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Nhập mã (VD: LAB-2K8-ABCD)"
                className="h-12 text-center text-sm font-black tracking-widest rounded-xl border-slate-200 focus-visible:ring-red-500 uppercase placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
              />
              <Button 
                type="submit"
                className="w-full h-12 bg-red-600 hover:bg-red-700 rounded-xl text-white font-black uppercase text-xs tracking-widest"
              >
                Kích hoạt ngay
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
