"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Gift, History, Info, Loader2, Pin, PinOff, Snowflake, Star, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { EARNING_RULES, SOURCE_LABEL } from "@/lib/points/config";
import type { StudentPointsPageData } from "@/lib/points/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Reward = StudentPointsPageData["rewards"][number];
type TabKey = "shop" | "mine" | "history" | "rules";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ nhận quà", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  DELIVERED: { label: "Đã nhận", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Đã huỷ", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  REJECTED: { label: "Bị từ chối", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  EXPIRED: { label: "Hết hạn", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export function StudentRewards({ data }: { data: StudentPointsPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("shop");
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [pending, startTransition] = useTransition();
  const { wallet, goal } = data;
  const pendingCount = data.redemptions.filter((r) => r.status === "PENDING").length;

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        if (res.message) toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error || "Có lỗi xảy ra");
    });

  const tabs: { key: TabKey; label: string; icon: typeof Gift; badge?: number }[] = [
    { key: "shop", label: "Đổi quà", icon: Gift },
    { key: "mine", label: "Quà của tôi", icon: Star, badge: pendingCount },
    { key: "history", label: "Lịch sử điểm", icon: History },
    { key: "rules", label: "Cách nhận điểm", icon: Info },
  ];

  return (
    <div className="space-y-5">
      {/* Tổng quan */}
      <section className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-5 text-white shadow-lg shadow-amber-500/20">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">Điểm thưởng của bạn</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tabular-nums">{wallet.balance}</span>
            <span className="text-sm font-bold text-white/85">điểm</span>
          </p>
          <p className="mt-2 text-xs font-semibold text-white/85">Tổng đã kiếm: {wallet.lifetimeEarned} điểm</p>
          <span aria-hidden className="absolute -right-3 -bottom-4 text-[88px] leading-none opacity-20 select-none">⭐</span>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Flame className="h-4 w-4 text-orange-500" /> Chuỗi tuần học
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {wallet.weekStreak} <span className="text-base font-bold text-slate-500">tuần</span>
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs font-semibold text-slate-500">
              <span>Tuần này</span>
              <span className={wallet.thisWeekCounted ? "text-emerald-600" : ""}>
                {wallet.thisWeekCounted ? "Đã tính ✓" : `${Math.min(wallet.weekActivities, wallet.weekTarget)}/${wallet.weekTarget} bài`}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-500 transition-all"
                style={{ width: `${Math.min(100, (wallet.weekActivities / wallet.weekTarget) * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <Snowflake className="h-3.5 w-3.5 text-sky-500" /> {wallet.streakFreezes} thẻ giữ chuỗi · Kỷ lục {wallet.bestWeekStreak} tuần
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Target className="h-4 w-4 text-blue-600" /> Quà mục tiêu
          </p>
          {goal ? (
            <>
              <p className="mt-1.5 flex items-center gap-2 font-black text-slate-900">
                <span className="text-2xl">{goal.emoji || "🎁"}</span>
                <span className="line-clamp-1">{goal.title}</span>
              </p>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (wallet.balance / goal.price) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {wallet.balance >= goal.price ? "Đủ điểm rồi, đổi thôi! 🎉" : `Còn ${goal.price - wallet.balance} điểm nữa`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Ghim một món quà bạn thích để theo dõi còn bao nhiêu điểm nữa.</p>
          )}
        </div>
      </section>

      {!data.canEarn && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tài khoản cần được thầy duyệt để bắt đầu nhận điểm thưởng.
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/70 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors",
              tab === t.key ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {!!t.badge && (
              <span className={cn("rounded-full px-1.5 text-[11px]", tab === t.key ? "bg-white/25" : "bg-amber-100 text-amber-700")}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "shop" && (
        <section className="space-y-3">
          {!data.isOffline && (
            <p className="text-xs text-slate-500">Quà hiện vật được trao tại lớp học offline, vì vậy bạn chỉ thấy các quà dành cho học online.</p>
          )}
          {data.rewards.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
              <p className="text-4xl">🎁</p>
              <p className="mt-2 font-bold text-slate-700">Thầy đang chuẩn bị quà</p>
              <p className="text-sm text-slate-500">Cứ chăm học tích điểm, quà sẽ sớm có ở đây!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {data.rewards.map((r) => {
                const soldOut = r.stock !== null && r.stock <= 0;
                const limitReached = r.perStudentMonthlyLimit !== null && r.usedThisMonth >= r.perStudentMonthlyLimit;
                const enough = wallet.balance >= r.price;
                const isGoal = goal?.id === r.id;
                return (
                  <div key={r.id} className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-3.5 sm:p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-4xl sm:text-5xl leading-none">{r.emoji || "🎁"}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setGoalReward(isGoal ? null : r.id))}
                        title={isGoal ? "Bỏ ghim mục tiêu" : "Ghim làm quà mục tiêu"}
                        className={cn(
                          "rounded-xl p-1.5 transition-colors",
                          isGoal ? "bg-blue-50 text-blue-600" : "text-slate-300 hover:text-blue-600 hover:bg-slate-50",
                        )}
                      >
                        {isGoal ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-2 font-black text-slate-900 leading-snug line-clamp-2">{r.title}</p>
                    {r.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{r.description}</p>}
                    <div className="mt-auto pt-3 space-y-2">
                      <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-400">
                        {r.stock !== null && <span>Còn {Math.max(0, r.stock)}</span>}
                        {r.perStudentMonthlyLimit !== null && (
                          <span>
                            Tháng này {r.usedThisMonth}/{r.perStudentMonthlyLimit}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        disabled={pending || soldOut || limitReached || !enough || !data.canEarn}
                        onClick={() => setConfirm(r)}
                        className={cn(
                          "w-full rounded-2xl py-2 text-sm font-black transition-colors",
                          enough && !soldOut && !limitReached
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed",
                        )}
                      >
                        {soldOut ? "Hết quà" : limitReached ? "Đủ lượt tháng này" : `⭐ ${r.price}`}
                      </button>
                      {!enough && !soldOut && !limitReached && (
                        <p className="text-center text-[11px] font-semibold text-slate-400">Còn thiếu {r.price - wallet.balance} điểm</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "mine" && (
        <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100">
          {data.redemptions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Bạn chưa đổi quà nào.</p>
          ) : (
            data.redemptions.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3.5 sm:p-4">
                <span className="text-3xl leading-none">{r.reward.emoji || "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 line-clamp-1">{r.reward.title}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(r.createdAt)} · {r.price} điểm
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold", STATUS[r.status]?.cls)}>
                  {STATUS[r.status]?.label ?? r.status}
                </span>
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => cancelRedemption(r.id))}
                    className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Huỷ
                  </button>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100">
          {data.ledger.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Chưa có điểm nào. Nộp bài đầu tiên để nhận điểm thưởng nhé!</p>
          ) : (
            data.ledger.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 line-clamp-1">{l.reason || SOURCE_LABEL[l.source] || l.source}</p>
                  <p className="text-xs text-slate-400">
                    {SOURCE_LABEL[l.source] ?? l.source} · {fmtDate(l.createdAt)}
                  </p>
                </div>
                <span className={cn("shrink-0 text-sm font-black tabular-nums", l.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                  {l.amount > 0 ? `+${l.amount}` : l.amount}
                </span>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "rules" && (
        <section className="rounded-3xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-sm">
          <div className="divide-y divide-slate-100">
            {EARNING_RULES.map((r) => (
              <div key={r.label} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{r.label}</p>
                  {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{r.points}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Mỗi bài chỉ được tính điểm một lần. Đổi quà xong, thầy sẽ trao ở buổi học tới; quá 30 ngày chưa nhận thì điểm tự hoàn lại.
          </p>
        </section>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Đổi quà?</DialogTitle>
            <DialogDescription>
              {confirm && (
                <>
                  Dùng <b>{confirm.price} điểm</b> để đổi <b>{confirm.title}</b>. Còn lại {wallet.balance - confirm.price} điểm.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirm && <p className="text-center text-6xl py-2">{confirm.emoji || "🎁"}</p>}
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="rounded-2xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              Để sau
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm && run(() => redeemReward(confirm.id), () => setConfirm(null))}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Đổi quà
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
