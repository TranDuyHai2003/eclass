"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, History, Info, Loader2, Pin, PinOff, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { EARNING_RULES, SOURCE_LABEL } from "@/lib/points/config";
import { LEVELS, getLevel, type LevelInfo } from "@/lib/points/levels";
import { rarityOf } from "@/lib/points/rarity";
import { resolveKindFilter, type KindFilter } from "@/lib/points/filters";
import { getAvatarThumbUrl } from "@/lib/game-rank";
import type { StudentPointsPageData } from "@/lib/points/queries";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confetti } from "./Confetti";
import { Mascot } from "./Mascot";

type Reward = StudentPointsPageData["rewards"][number];
type TabKey = "shop" | "mine" | "history" | "rules";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const STATUS: Record<string, { label: string; cls: string; step: number }> = {
  PENDING: { label: "Chờ nhận quà", cls: "bg-amber-50 text-amber-700 ring-amber-200", step: 1 },
  DELIVERED: { label: "Đã nhận", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 2 },
  CANCELLED: { label: "Đã huỷ", cls: "bg-slate-100 text-slate-500 ring-slate-200", step: -1 },
  REJECTED: { label: "Bị từ chối", cls: "bg-rose-50 text-rose-700 ring-rose-200", step: -1 },
  EXPIRED: { label: "Hết hạn", cls: "bg-slate-100 text-slate-500 ring-slate-200", step: -1 },
};

/** Biểu tượng + màu theo nguồn điểm (tab Lịch sử) */
const SOURCE_ICON: Record<string, { icon: string; cls: string }> = {
  TEST_SUBMIT: { icon: "📝", cls: "bg-blue-50" },
  TEST_SCORE: { icon: "🎯", cls: "bg-amber-50" },
  BREAKTHROUGH: { icon: "🚀", cls: "bg-violet-50" },
  FINAL_TEST: { icon: "🏁", cls: "bg-indigo-50" },
  HOMEWORK_SUBMIT: { icon: "📒", cls: "bg-sky-50" },
  HOMEWORK_PASS: { icon: "✅", cls: "bg-emerald-50" },
  STREAK: { icon: "🔥", cls: "bg-orange-50" },
  MANUAL: { icon: "👨‍🏫", cls: "bg-teal-50" },
  REDEEM: { icon: "🎁", cls: "bg-rose-50" },
  REFUND: { icon: "↩️", cls: "bg-slate-100" },
  REVOKE: { icon: "⛔", cls: "bg-slate-100" },
};

const RULE_ICONS = ["📝", "🎯", "🚀", "🏁", "📒", "🔥", "👨‍🏫"];

export function StudentRewards({ data, user }: { data: StudentPointsPageData; user: { name?: string | null; image?: string | null } }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("shop");
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [celebrated, setCelebrated] = useState(0);
  const [pending, startTransition] = useTransition();
  const { wallet, goal } = data;
  const level = getLevel(wallet.lifetimeEarned);
  const pendingCount = data.redemptions.filter((r) => r.status === "PENDING").length;

  // Chỉ hiện các lựa chọn lọc có quà thực tế (vd học sinh online không có quà "Nhận tại lớp")
  const kinds = useMemo(() => Array.from(new Set(data.rewards.map((r) => r.kind))), [data.rewards]);
  // Loại đang lọc không còn quà (vd thầy vừa ẩn món cuối) → tự về "Tất cả", tránh kẹt ở lưới trống (review Gemini)
  const activeKind = resolveKindFilter(kind, kinds);
  const rewards = activeKind === "ALL" ? data.rewards : data.rewards.filter((r) => r.kind === activeKind);

  const tips = useMemo(() => buildTips(data, level), [data, level]);

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
    <div className="space-y-5" data-celebrated={celebrated}>
      <Confetti burst={celebrated} />

      {/* ============ Thanh trạng thái người chơi ============ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-4 text-white shadow-[0_6px_0_0_#1e3a8a] sm:p-6">
        <div aria-hidden className="dots-bg absolute inset-0 opacity-40" style={{ "--dot": "rgba(255,255,255,.18)" } as React.CSSProperties} />
        <div aria-hidden className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {/* Hồ sơ + cấp độ */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-4 border-white/80 bg-white/20 shadow-lg sm:h-20 sm:w-20">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getAvatarThumbUrl(user.name, user.image, 128)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-black">{user.name?.[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-base shadow-md ring-2 ring-blue-200" title={`Cấp ${level.level}`}>
                {level.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-100">Điểm thưởng của bạn</p>
              <p className="truncate text-lg font-black sm:text-2xl">{user.name || "Học sinh"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-black ring-1 ring-white/25">
                  Cấp {level.level} · {level.name}
                </span>
                <span className="text-xs font-semibold text-blue-100">
                  {level.next ? `Còn ${level.toNext} điểm lên ${level.next.icon} ${level.next.name}` : "Cấp cao nhất 👑"}
                </span>
              </div>
              <div className="mt-2 h-2.5 max-w-md overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Kinh nghiệm">
                <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", level.bar)} style={{ width: `${Math.max(4, level.progress)}%` }} />
              </div>
            </div>
          </div>

          {/* Chỉ số */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat value={wallet.balance} label="điểm" icon="⭐" accent="text-amber-300" testId="hud-balance" />
            <Stat
              value={wallet.weekStreak}
              label={wallet.thisWeekCounted ? "tuần · tuần này ✓" : `tuần · ${Math.min(wallet.weekActivities, wallet.weekTarget)}/${wallet.weekTarget} bài`}
              icon="🔥"
              accent="text-orange-300"
            />
            <Stat value={wallet.streakFreezes} label="thẻ giữ chuỗi" icon="🧊" accent="text-sky-200" />
          </div>
        </div>
      </section>

      {/* ============ Quà mục tiêu + linh vật (một thẻ, gọn trên điện thoại) ============ */}
      <section className="grid grid-cols-1 gap-3 rounded-3xl border-2 border-slate-200/80 bg-white p-3 shadow-[0_4px_0_0_#e2e8f0] sm:p-4 md:grid-cols-2 md:items-center md:gap-0">
        <div className="min-w-0 md:pr-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">🎯 Quà mục tiêu</p>
          {goal ? (
            <div className="mt-2 flex items-center gap-3">
              <span className={cn("dots-bg flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl", rarityOf(goal.price).art)}>{goal.emoji || "🎁"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-900">{goal.title}</p>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (wallet.balance / goal.price) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {wallet.balance >= goal.price ? "Đủ điểm rồi, đổi thôi! 🎉" : `Còn ${goal.price - wallet.balance} điểm nữa`}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-slate-500">Bấm 📌 trên một món quà để đặt làm mục tiêu và theo dõi còn bao nhiêu điểm nữa.</p>
          )}
        </div>
        <div className="min-w-0 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <Mascot tips={tips} />
        </div>
      </section>

      {!data.canEarn && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Tài khoản cần được thầy duyệt để bắt đầu nhận điểm và đổi quà.</p>
      )}

      {/* ============ Tabs ============ */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-slate-200/80 bg-slate-100/80 p-1.5 sm:flex">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-black transition-all sm:flex-1 sm:text-sm",
              tab === t.key ? "bg-white text-blue-700 shadow-[0_3px_0_0_#cbd5e1]" : "text-slate-500 hover:bg-white/60 hover:text-slate-700",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {!!t.badge && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] text-amber-950">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "shop" && (
        <section className="space-y-3">
          {kinds.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ALL", "Tất cả"],
                  ["PHYSICAL", "🏫 Nhận tại lớp"],
                  ["VIRTUAL", "✨ Đặc quyền"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={activeKind === k}
                  className={cn(
                    "rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
                    activeKind === k ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!data.isOffline && data.rewards.length > 0 && (
            <p className="text-xs text-slate-500">Quà hiện vật được trao tại lớp học offline, vì vậy bạn chỉ thấy các quà dành cho mọi học sinh.</p>
          )}

          {data.rewards.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white/70 p-10 text-center">
              <p className="text-5xl animate-float">🎁</p>
              <p className="mt-3 font-black text-slate-700">Thầy đang chuẩn bị quà</p>
              <p className="text-sm text-slate-500">Cứ chăm học tích điểm, quà sẽ sớm có ở đây!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  balance={wallet.balance}
                  canEarn={data.canEarn}
                  isGoal={goal?.id === r.id}
                  pending={pending}
                  onPin={() => run(() => setGoalReward(goal?.id === r.id ? null : r.id))}
                  onRedeem={() => setConfirm(r)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "mine" && (
        <section className="space-y-3">
          {data.redemptions.length === 0 ? (
            <p className="rounded-3xl border-2 border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">Bạn chưa đổi quà nào.</p>
          ) : (
            data.redemptions.map((r) => {
              const st = STATUS[r.status] ?? STATUS.CANCELLED;
              return (
                <div key={r.id} data-testid="redemption" className="flex items-start gap-3 rounded-3xl border-2 border-slate-200/80 bg-white p-3.5 shadow-[0_3px_0_0_#e2e8f0] sm:p-4">
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl", rarityOf(r.price).art)}>{r.reward.emoji || "🎁"}</span>
                  {/* Màn hẹp: nhãn trạng thái + nút Huỷ xuống dòng dưới tên quà, không chen ngang (review Gemini) */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="line-clamp-2 font-black leading-snug text-slate-900">{r.reward.title}</p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(r.createdAt)} · ⭐ {r.price}
                          {r.note ? ` · ${r.note}` : ""}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1", st.cls)}>{st.label}</span>
                    </div>
                    {(st.step > 0 || r.status === "PENDING") && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {st.step > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                            {["Đã đổi", "Chờ trao", "Đã nhận"].map((s, i) => (
                              <span key={s} className="flex items-center gap-1">
                                <span className={cn("rounded-full px-1.5 py-0.5", i <= st.step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>{s}</span>
                                {i < 2 && <span className="text-slate-300">›</span>}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => cancelRedemption(r.id))}
                            className="rounded-xl border-2 border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
                          >
                            Huỷ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="rounded-3xl border-2 border-slate-200/80 bg-white p-2 shadow-[0_4px_0_0_#e2e8f0] sm:p-3">
          {data.ledger.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Chưa có điểm nào. Nộp bài đầu tiên để nhận điểm thưởng nhé!</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {data.ledger.map((l) => {
                const ic = SOURCE_ICON[l.source] ?? { icon: "•", cls: "bg-slate-100" };
                return (
                  <li key={l.id} className="flex items-center gap-3 px-2 py-2.5">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg", ic.cls)}>{ic.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-slate-800">{l.reason || SOURCE_LABEL[l.source] || l.source}</p>
                      <p className="text-xs text-slate-400">
                        {SOURCE_LABEL[l.source] ?? l.source} · {fmtDate(l.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-sm font-black tabular-nums",
                        l.amount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {l.amount > 0 ? `+${l.amount}` : l.amount}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {tab === "rules" && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EARNING_RULES.map((r, i) => (
              <div key={r.label} className="flex items-start gap-3 rounded-2xl border-2 border-slate-200/80 bg-white p-3.5 shadow-[0_3px_0_0_#e2e8f0]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">{RULE_ICONS[i] ?? "⭐"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-800">{r.label}</p>
                  {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">{r.points}</span>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border-2 border-slate-200/80 bg-white p-4 shadow-[0_4px_0_0_#e2e8f0]">
            <p className="text-sm font-black text-slate-800">Cấp độ</p>
            <p className="text-xs text-slate-500">Tính theo tổng điểm đã kiếm — đổi quà không làm tụt cấp.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LEVELS.map((lv, i) => (
                <div
                  key={lv.name}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-2 ring-1",
                    i + 1 === level.level ? cn(lv.badge, "ring-2") : "bg-slate-50 text-slate-500 ring-slate-200",
                  )}
                >
                  <span className="text-xl">{lv.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{lv.name}</span>
                    <span className="block text-[11px] font-semibold opacity-80">từ {lv.min} điểm</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Mỗi bài chỉ được tính điểm một lần. Đổi quà xong, thầy sẽ trao ở buổi học tới; quá 30 ngày chưa nhận thì điểm tự hoàn lại.
          </p>
        </section>
      )}

      {/* ============ Xác nhận đổi quà ============ */}
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
          {confirm && (
            <div className={cn("dots-bg relative flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br", rarityOf(confirm.price).art)} style={{ "--dot": rarityOf(confirm.price).dot } as React.CSSProperties}>
              <span className="animate-pop-in text-6xl">{confirm.emoji || "🎁"}</span>
              <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase", rarityOf(confirm.price).chip)}>{rarityOf(confirm.price).label}</span>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="rounded-2xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              Để sau
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirm &&
                run(
                  () => redeemReward(confirm.id),
                  () => {
                    setConfirm(null);
                    setCelebrated((n) => n + 1);
                  },
                )
              }
              className="btn-3d btn-3d-amber px-5 py-2 text-sm disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Đổi quà
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ value, label, icon, accent, testId }: { value: number; label: string; icon: string; accent: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 px-2.5 py-2 text-center ring-1 ring-white/20 backdrop-blur-sm sm:min-w-[104px] sm:px-4 sm:py-3">
      <p className={cn("text-xl font-black tabular-nums sm:text-3xl", accent)} data-testid={testId}>
        <span aria-hidden className="mr-0.5 text-base sm:text-xl">
          {icon}
        </span>
        {value}
      </p>
      <p className="truncate text-[10px] font-bold text-blue-100 sm:text-xs">{label}</p>
    </div>
  );
}

function RewardCard({
  reward: r,
  balance,
  canEarn,
  isGoal,
  pending,
  onPin,
  onRedeem,
}: {
  reward: Reward;
  balance: number;
  canEarn: boolean;
  isGoal: boolean;
  pending: boolean;
  onPin: () => void;
  onRedeem: () => void;
}) {
  const rar = rarityOf(r.price);
  const soldOut = r.stock !== null && r.stock <= 0;
  const limitReached = r.perStudentMonthlyLimit !== null && r.usedThisMonth >= r.perStudentMonthlyLimit;
  const enough = balance >= r.price;
  const canRedeem = enough && !soldOut && !limitReached && canEarn;

  return (
    <div
      data-testid="reward-card"
      data-title={r.title}
      data-rarity={rar.key}
      className={cn("group relative flex flex-col rounded-3xl border-2 bg-white p-2 transition-transform duration-200 hover:-translate-y-1", rar.card)}
    >
      <div
        className={cn("dots-bg relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br", rar.art)}
        style={{ "--dot": rar.dot } as React.CSSProperties}
      >
        <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", rar.chip)}>{rar.label}</span>
        <button
          type="button"
          data-testid="pin"
          disabled={pending}
          onClick={onPin}
          title={isGoal ? "Bỏ ghim mục tiêu" : "Ghim làm quà mục tiêu"}
          aria-pressed={isGoal}
          className={cn(
            "absolute right-2 top-2 rounded-xl p-1.5 transition-colors",
            isGoal ? "bg-blue-600 text-white" : "bg-white/70 text-slate-400 hover:bg-white hover:text-blue-600",
          )}
        >
          {isGoal ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <span className="group-hover-float text-5xl drop-shadow-sm sm:text-6xl">{r.emoji || "🎁"}</span>
        <span className="absolute bottom-2 left-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {r.kind === "PHYSICAL" ? "🏫 Nhận tại lớp" : "✨ Đặc quyền"}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5">
        <p className="line-clamp-2 font-black leading-snug text-slate-900">{r.title}</p>
        {r.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 sm:line-clamp-2">{r.description}</p>}
        <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-semibold text-slate-400">
          {r.stock !== null && <span>Còn {Math.max(0, r.stock)}</span>}
          {r.perStudentMonthlyLimit !== null && (
            <span>
              Tháng này {r.usedThisMonth}/{r.perStudentMonthlyLimit}
            </span>
          )}
        </p>
        <div className="mt-auto space-y-1.5 pt-2.5">
          {!enough && !soldOut && !limitReached && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (balance / r.price) * 100)}%` }} />
              </div>
              <p className="mt-1 text-center text-[11px] font-bold text-slate-400">Còn thiếu {r.price - balance} điểm</p>
            </div>
          )}
          <button
            type="button"
            data-testid="redeem"
            disabled={pending || !canRedeem}
            onClick={onRedeem}
            className={cn("btn-3d w-full py-2 text-sm", canRedeem ? "btn-3d-amber" : "btn-3d-muted")}
          >
            {soldOut ? "Hết quà" : limitReached ? "Đủ lượt tháng này" : `⭐ ${r.price}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Câu nhắc của linh vật — tính từ dữ liệu (không ngẫu nhiên) */
function buildTips(data: StudentPointsPageData, level: LevelInfo): string[] {
  const { wallet, goal } = data;
  const tips: string[] = [];
  if (!data.canEarn) tips.push("Tài khoản cần thầy duyệt để bắt đầu nhận điểm nhé!");
  if (wallet.lifetimeEarned === 0) tips.push("Nộp bài đầu tiên để nhận điểm thưởng nhé! Làm ít nhất một nửa số câu là có điểm.");
  if (goal) {
    tips.push(
      wallet.balance >= goal.price
        ? `Đủ điểm đổi "${goal.title}" rồi — đổi thôi! ${goal.emoji || "🎁"}`
        : `Còn ${goal.price - wallet.balance} điểm nữa là đổi được "${goal.title}" ${goal.emoji || "🎁"}`,
    );
  }
  if (!wallet.thisWeekCounted) {
    const left = Math.max(0, wallet.weekTarget - wallet.weekActivities);
    tips.push(left > 0 ? `Nộp thêm ${left} bài tuần này để giữ chuỗi 🔥` : "Tuần này đủ bài rồi, chuỗi sẽ được tính 🔥");
  }
  if (level.next) tips.push(`Thêm ${level.toNext} điểm nữa là lên cấp ${level.next.icon} ${level.next.name}.`);
  tips.push("Đạt từ 8,5 điểm được thưởng thêm, làm tốt hơn hẳn mọi khi còn có điểm \"Bứt phá\" 🚀");
  tips.push("Đổi quà không làm tụt cấp đâu — cấp tính theo tổng điểm đã kiếm.");
  return tips;
}
