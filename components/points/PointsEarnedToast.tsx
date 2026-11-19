"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SOURCE_LABEL } from "@/lib/points/config";

/**
 * Thông báo nhỏ "+N điểm thưởng" ở màn kết quả (chỉ học sinh làm bài, chỉ hiện lần đầu mở kết quả).
 * Nổi ở đáy màn hình, tự ẩn sau vài giây — không chiếm chỗ của bố cục chữa bài.
 */
export function PointsEarnedToast({ attemptId, entries }: { attemptId: string; entries: { amount: number; source: string }[] }) {
  const [show, setShow] = useState(false);
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
    const t1 = setTimeout(() => setShow(true), 400);
    const t2 = setTimeout(() => setShow(false), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [attemptId, total]);

  if (total <= 0 || !show) return null;

  // Gộp theo nguồn: "Nộp bài +2 · Điểm cao +2"
  const parts = Object.entries(
    entries.reduce<Record<string, number>>((m, e) => ({ ...m, [e.source]: (m[e.source] ?? 0) + e.amount }), {}),
  );

  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <span aria-hidden className="text-2xl">⭐</span>
        <div className="min-w-0">
          <p className="text-sm font-black">+{total} điểm thưởng</p>
          <p className="text-xs text-white/70 line-clamp-1">
            {parts.map(([src, amt]) => `${SOURCE_LABEL[src] ?? src} +${amt}`).join(" · ")}
          </p>
        </div>
        <Link href="/rewards" className="shrink-0 rounded-xl bg-amber-500 px-2.5 py-1.5 text-xs font-black hover:bg-amber-400">
          Đổi quà
        </Link>
        <button type="button" aria-label="Đóng" onClick={() => setShow(false)} className="shrink-0 rounded-lg p-1 text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
