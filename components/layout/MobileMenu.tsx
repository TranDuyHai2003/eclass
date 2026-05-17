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
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { MobileSearchBar } from "./MobileSearchBar";

interface MobileMenuProps {
  user?: any;
}

export function MobileMenu({ user }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-2 -ml-2 text-gray-600 hover:text-blue-700 transition-colors active:scale-95 transition-transform">
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
               <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-100/50 blur-3xl rounded-full" />
               
               <SheetTitle className="flex items-center gap-3 relative z-10">
                 <div className="flex items-center justify-center">
                    <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
                 </div>
                 <div className="flex flex-col items-start">
                    <span className="text-base font-black text-slate-900 uppercase tracking-tighter leading-none">
                      thatdehoctoan
                    </span>
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">E-Learning Platform</span>
                 </div>
               </SheetTitle>
            </SheetHeader>
            
            <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
              <MobileSearchBar onSearch={() => setOpen(false)} />
              
              <div className="px-4 mt-6">
                <HomeSidebar user={user} />
              </div>

              <div className="mt-8 px-8 pb-10 space-y-6">
                <div className="p-6 bg-gradient-to-br from-blue-600 to-orange-500 rounded-[2rem] text-white shadow-xl shadow-blue-200">
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
