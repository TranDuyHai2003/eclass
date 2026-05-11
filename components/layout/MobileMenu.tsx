"use client";

import { useState } from "react";
import { Menu, Phone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "./NavLinks";
import { MobileSearchBar } from "./MobileSearchBar";

interface MobileMenuProps {
  role?: string;
}

export function MobileMenu({ role }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-2 -ml-2 text-gray-600 hover:text-red-700 transition-colors active:scale-95 transition-transform">
            <Menu className="w-6 h-6" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 border-none bg-white w-[280px] sm:w-[320px] shadow-2xl"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="p-8 border-b bg-slate-50/50 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute -top-10 -left-10 w-32 h-32 bg-red-100/50 blur-3xl rounded-full" />
               
               <SheetTitle className="flex items-center gap-3 relative z-10">
                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100">
                    <img src="/logo.png" alt="Logo" className="h-7 w-auto" />
                 </div>
                 <div className="flex flex-col items-start">
                    <span className="text-base font-black text-slate-900 uppercase tracking-tighter leading-none">
                      thatdehoctoan
                    </span>
                    <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-1">E-Learning Platform</span>
                 </div>
               </SheetTitle>
            </SheetHeader>
            
            <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
              <MobileSearchBar onSearch={() => setOpen(false)} />
              
              <div className="px-6 mb-2 mt-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Menu chính</p>
              </div>
              <NavLinks role={role} vertical onClick={() => setOpen(false)} />

              {/* Mobile Hotline info in Menu */}
              <div className="mt-8 px-8 pb-10 space-y-6">
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                    Hỗ trợ học tập 24/7
                  </p>
                  <div className="space-y-3">
                    <a href="tel:02489998668" className="flex items-center gap-4 text-slate-600 hover:text-red-600 transition-colors group">
                      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-red-50 transition-colors border border-slate-100">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hotline 1</span>
                         <span className="text-sm font-black tracking-tight">024 8999 8668</span>
                      </div>
                    </a>
                    <a href="tel:0968668799" className="flex items-center gap-4 text-slate-600 hover:text-red-600 transition-colors group">
                      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-red-50 transition-colors border border-slate-100">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hotline 2</span>
                         <span className="text-sm font-black tracking-tight">0968 668 799</span>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-red-600 to-orange-500 rounded-[2rem] text-white shadow-xl shadow-red-200">
                   <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Thông báo</p>
                   <p className="text-sm font-black leading-snug">Hệ thống đang cập nhật bộ đề thi mới 2026!</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
