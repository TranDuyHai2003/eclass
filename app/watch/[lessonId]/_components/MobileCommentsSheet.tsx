"use client";

import { MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CommentSection } from "@/components/comment/CommentSection";

interface MobileCommentsSheetProps {
  lessonId: string;
  commentCount: number;
}

export function MobileCommentsSheet({ lessonId, commentCount }: MobileCommentsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest">
          <MessageSquare className="w-3.5 h-3.5" />
          {commentCount}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-[90vw] max-w-[420px]">
        <div className="flex flex-col h-full bg-white">
          <SheetHeader className="px-4 py-3 border-b border-slate-100">
            <SheetTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-900">
              <MessageSquare className="w-4 h-4 text-red-600" />
              Thảo luận
              <span className="ml-auto px-2 py-0.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black">
                {commentCount}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <CommentSection lessonId={lessonId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
