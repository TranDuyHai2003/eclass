"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Hộp thoại kiểu bảng gỗ của Tiệm Quà: tiêu đề nổi trên viền, nút đóng đỏ góc phải */
export function ShopModal({
  open, onOpenChange, title, description, children, className, testId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={testId}
        className={cn("shop-font max-h-[92dvh] overflow-visible rounded-[1.5rem] border-[3px] border-[#5b3d1e] bg-[#fffaf0] p-0 shadow-[0_8px_0_0_#5b3d1e] sm:max-w-lg", className)}
      >
        <div className="pointer-events-none absolute -top-5 left-1/2 z-10 max-w-[calc(100%-3.5rem)] -translate-x-1/2" data-testid="shop-modal-title">
          <DialogTitle className="block truncate rounded-full border-[2.5px] border-[#5b3d1e] bg-gradient-to-b from-[#ffd84d] to-[#f5b61e] px-3.5 py-1.5 text-sm font-black sm:px-5 sm:text-[15px] text-[#3b2a14] shadow-[0_4px_0_0_#5b3d1e]">
            {title}
          </DialogTitle>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          data-testid="shop-modal-close"
          onClick={() => onOpenChange(false)}
          className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-[#5b3d1e] bg-[#ef5a3c] text-base font-black text-white shadow-[0_3px_0_0_#5b3d1e]"
        >
          ✕
        </button>
        <div className="max-h-[88dvh] overflow-y-auto px-4 pb-4 pt-7 sm:px-5">
          {description ? <DialogDescription className="mb-3 text-center text-xs font-semibold text-[#7a5a35]">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
