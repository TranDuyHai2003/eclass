import { cn } from "@/lib/utils";

/** Thanh 5 ngôi sao bảo hiểm: sao vàng = số lượt liên tiếp chưa ra Sử thi */
export function PityBar({ pity, pityMax, compact = false }: { pity: number; pityMax: number; compact?: boolean }) {
  const left = Math.max(1, pityMax - pity);
  return (
    <div className={cn("relative mt-3 flex items-center justify-between gap-2 rounded-2xl border border-white/20 bg-[#1d1236]/60 px-3 py-2", compact && "mt-0")}>
      <span className="text-[11px] font-bold text-[#ffe9a8]">
        {left === 1 ? "🌟 Lượt Hộp Sao tới chắc chắn ra Sử thi / Huyền thoại!" : `🌟 Mở thêm ${left} lượt Hộp Sao chắc chắn nổ Sử thi / Huyền thoại!`}
      </span>
      <span className="flex shrink-0 gap-1" aria-label={`Bảo hiểm ${pity}/${pityMax}`}>
        {Array.from({ length: pityMax }, (_, i) => (
          <span key={i} className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[10px]", i < pity ? "border-[#b4531a] bg-[#ffd84d] text-[#7c4a03]" : "border-white/30 bg-white/10 text-white/40")}>★</span>
        ))}
      </span>
    </div>
  );
}
