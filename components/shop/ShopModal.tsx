"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hộp thoại của Tiệm Quà (GĐ9: thẻ trắng bo 20px, tiêu đề trái + nút đóng phải theo artifact) */
export function ShopModal({
  open, onOpenChange, title, description, children, className, testId, inline,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  /** Hiện thành khối trong trang (các mục của Tiệm quà v2) thay vì hộp thoại; nút ✕ quay về mục Cửa hàng */
  inline?: boolean;
}) {
  if (inline) {
    if (!open) return null;
    return (
      <section className={cn("studio-card overflow-hidden", className?.replace(/sm:max-w-\S+/g, ""))} data-testid={testId} aria-label={title}>
        <div className="flex items-center gap-3 border-b border-[#ECE9F5] px-5 py-3.5">
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-extrabold text-[#1E1B2E]" data-testid="shop-modal-title">{title}</h2>
          <button type="button" aria-label="Đóng" data-testid="shop-modal-close" onClick={() => onOpenChange(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#5F5B73] hover:bg-[#F3F1FA]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-4 pb-4 pt-4 sm:px-5">
          {description && <p className="mb-3 text-center text-xs font-medium text-[#5F5B73]">{description}</p>}
          {children}
        </div>
      </section>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={testId}
        className={cn("studio max-h-[92dvh] gap-0 overflow-hidden rounded-[20px] border border-[#ECE9F5] bg-white p-0 shadow-[0_24px_60px_rgba(20,14,48,0.3)] sm:max-w-lg", className)}
      >
        <div className="flex items-center gap-3 border-b border-[#ECE9F5] px-5 py-3.5">
          <div className="min-w-0 flex-1" data-testid="shop-modal-title">
            <DialogTitle className="block truncate text-[17px] font-extrabold text-[#1E1B2E]">{title}</DialogTitle>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            data-testid="shop-modal-close"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#5F5B73] hover:bg-[#F3F1FA]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[calc(92dvh-64px)] overflow-y-auto px-4 pb-4 pt-4 sm:px-5">
          {description ? <DialogDescription className="mb-3 text-center text-xs font-medium text-[#5F5B73]">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
