"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SOURCE_LABEL } from "@/lib/points/config";
import { play } from "@/lib/sound";
import { CoinBurst, CoinSvg, CountUp } from "@/components/game/CoinBurst";

/**
 * "+N xu" ở màn kết quả (chỉ học sinh làm bài, chỉ hiện lần đầu mở kết quả): mưa xu bay về ví + số đếm tăng + âm thanh.
 * Nổi ở đáy màn hình, tự ẩn sau vài giây — không chiếm chỗ của bố cục chữa bài.
 */
export function PointsEarnedToast({ attemptId, entries }: { attemptId: string; entries: { amount: number; source: string }[] }) {
  const [show, setShow] = useState(false);
  const [burst, setBurst] = useState(0);
  const total = entries.reduce((s, e) => s + e.amount, 0);

  useEffect(() => {
    if (total <= 0) return;
    const key = `pts-seen-${attemptId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* trình duyệt chặn bộ nhớ → vẫn hiện */
    }
    const t1 = setTimeout(() => {
      setShow(true);
      setBurst(1);
      play("coin");
      setTimeout(() => play("success"), 350);
    }, 400);
    const t2 = setTimeout(() => setShow(false), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [attemptId, total]);

  if (total <= 0) return null;

  // Gộp theo nguồn: "Nộp bài +300 · Đúng hạn +150"
  const parts = Object.entries(
    entries.reduce<Record<string, number>>((m, e) => ({ ...m, [e.source]: (m[e.source] ?? 0) + e.amount }), {}),
  );

  return (
    <>
      <CoinBurst burst={burst} from={null} count={18} />
      {show && (
        <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            data-testid="points-earned"
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-amber-300 bg-slate-900/95 px-4 py-3 text-white shadow-2xl animate-pop-in"
          >
            <CoinSvg className="h-9 w-9 animate-float" />
            <div className="min-w-0">
              <p className="text-base font-black text-amber-300">
                +<CountUp value={total} /> xu
              </p>
              <p className="text-xs text-white/70 line-clamp-1">
                {parts.map(([src, amt]) => `${SOURCE_LABEL[src] ?? src} +${amt.toLocaleString("vi-VN")}`).join(" · ")}
              </p>
            </div>
            <Link href="/rewards" className="btn-3d btn-3d-amber btn-shine shrink-0 px-2.5 py-1.5 text-xs">
              Tiệm quà
            </Link>
            <button type="button" aria-label="Đóng" onClick={() => setShow(false)} className="shrink-0 rounded-lg p-1 text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
