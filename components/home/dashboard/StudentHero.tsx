import Link from "next/link";
import { BookOpen, ChevronRight, Gamepad2, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevel } from "@/lib/points/levels";
import { rarityOf } from "@/lib/points/rarity";
import type { PointsCardData } from "@/lib/points/queries";
import type { ReactNode } from "react";
import type { AvatarConfig } from "@/lib/game/avatar";
import { Chibi } from "@/components/avatar/Chibi";

export interface StudentHeroProps {
  name?: string | null;
  /** null khi tắt Điểm thưởng → chỉ hiện lời chào, bài gần nhất, số bài đã học */
  points: PointsCardData | null;
  lastLesson: { id: string; title: string; courseTitle: string } | null;
  stats: { completedLessons: number; courseCount: number };
  /** Nơi bắt đầu khi chưa học bài nào (bài đầu của khoá đã ghi danh, hoặc /courses) */
  startHref: string;
  /** Khối nhỏ ở đầu cột phải (vd thẻ đếm ngược kỳ thi) */
  aside?: ReactNode;
  /** Nhân vật chibi (null khi tắt Xu) */
  avatar?: AvatarConfig | null;
  userId?: string;
  /** Tiệm quà mở cho tài khoản này (tạm thời chỉ học sinh offline) */
  shopOpen?: boolean;
}

/** Tên gọi: chữ cuối của họ tên tiếng Việt ("Nguyễn Văn An" → "An") */
function givenName(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "bạn";
}

/** Thẻ chào trên trang chủ học sinh: mình đang ở đâu, học tiếp gì, sắp đổi được gì */
export function StudentHero({ name, points, lastLesson, stats, startHref, aside, avatar, userId, shopOpen = true }: StudentHeroProps) {
  const level = points ? getLevel(points.lifetimeEarned) : null;

  return (
    <section data-testid="student-hero" className={cn("grid grid-cols-1 gap-4", (points || aside) && "lg:grid-cols-3")}>
      <div className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 text-white shadow-[0_6px_0_0_#1e3a8a] sm:p-6 lg:col-span-2">
        <div aria-hidden className="dots-bg absolute inset-0 opacity-40" style={{ "--dot": "rgba(255,255,255,.18)" } as React.CSSProperties} />
        <div aria-hidden className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex h-full flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {avatar && (
                <Link href={userId ? `/profile/${userId}` : "/profile"} title="Hồ sơ nhân vật" data-testid="hero-chibi" className="shrink-0 rounded-2xl bg-white/15 p-1 ring-1 ring-white/30 transition-transform hover:scale-105">
                  <Chibi config={avatar} size={56} className="animate-float" />
                </Link>
              )}
              <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Chào {givenName(name)}! 👋</h2>
                <p className="text-sm font-medium text-blue-100">Hôm nay mình cùng học tiếp nhé.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Vào game Thế giới Toán 3D (trang riêng, toàn màn hình) */}
              <Link
                href="/world"
                data-testid="hero-game"
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-3.5 py-1.5 text-xs font-black text-indigo-950 shadow-[0_3px_0_0_#b45309] ring-1 ring-white/40 transition-transform hover:scale-105 active:translate-y-0.5 active:shadow-none"
              >
                <Gamepad2 className="h-4 w-4" /> Vào Game
              </Link>
              {level && (
                <Link
                  href={shopOpen ? "/rewards" : "/profile"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black ring-1 ring-white/25 hover:bg-white/25"
                >
                  <span aria-hidden>{level.icon}</span> {level.short}
                </Link>
              )}
            </div>
          </div>

          {level && points && (
            <div className="max-w-2xl">
              <div className="flex justify-between gap-2 text-[11px] font-bold text-blue-100">
                <span>Kinh nghiệm</span>
                <span className="truncate">{level.next ? `còn ${level.toNext.toLocaleString("vi-VN")} xu lên ${level.next.icon} ${level.next.name}` : "Danh hiệu cao nhất 👑"}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Kinh nghiệm">
                <div className={cn("h-full rounded-full bg-gradient-to-r", level.bar)} style={{ width: `${Math.max(4, level.progress)}%` }} />
              </div>
            </div>
          )}

          <div className={cn("grid gap-2", points ? "grid-cols-3" : "max-w-sm grid-cols-2")}>
            {points && (
              <>
                <HeroStat href={shopOpen ? "/rewards" : undefined} icon="🪙" value={points.balance} label="xu" accent="text-amber-300" />
                <HeroStat
                  icon="🔥"
                  value={points.weekStreak}
                  label={points.thisWeekCounted ? "tuần · tuần này ✓" : `tuần · ${Math.min(points.weekActivities, points.weekTarget)}/${points.weekTarget} bài`}
                  accent="text-orange-300"
                />
              </>
            )}
            <HeroStat icon="✅" value={stats.completedLessons} label="bài đã học" accent="text-emerald-300" />
            {!points && <HeroStat icon="📚" value={stats.courseCount} label="khoá học" accent="text-sky-200" />}
          </div>

          {lastLesson ? (
            <div className="mt-auto flex flex-col gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-blue-100">Học tiếp bài gần nhất</p>
                <p className="truncate font-black">{lastLesson.title}</p>
                <p className="truncate text-xs text-blue-100">{lastLesson.courseTitle}</p>
              </div>
              <Link href={`/watch/${lastLesson.id}`} className="btn-3d btn-3d-white shrink-0 px-4 py-2 text-sm">
                <PlayCircle className="h-4 w-4" /> Học tiếp
              </Link>
            </div>
          ) : (
            <Link href={startHref} className="btn-3d btn-3d-white mt-auto self-start px-5 py-2.5 text-sm">
              <BookOpen className="h-4 w-4" /> Bắt đầu học <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {(points || aside) && (
        <div className="flex min-w-0 flex-col gap-4">
          {aside}
          {points && shopOpen && (
            <div
              data-testid="hero-shop"
              className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-[0_6px_0_0_#fde68a] sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-amber-700">🎁 Tiệm quà</p>
                <Link href="/rewards" className="inline-flex items-center text-xs font-black text-amber-700 hover:text-amber-800">
                  Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Quà mục tiêu */}
              <Link href="/rewards" className="group flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-200 transition hover:ring-2 hover:ring-amber-300">
                <span className={cn("dots-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl", points.goal ? rarityOf(points.goal.price).art : "from-slate-50 to-slate-100")}>
                  <span className="group-hover-float">{points.goal?.emoji || "🎯"}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Mục tiêu</span>
                  {points.goal ? (
                    <>
                      <span className="block truncate font-black text-slate-900">{points.goal.title}</span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-amber-100">
                        <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (points.balance / points.goal.price) * 100)}%` }} />
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
                        {points.balance >= points.goal.price ? "Đủ xu đổi quà! 🎉" : `còn ${(points.goal.price - points.balance).toLocaleString("vi-VN")} xu`}
                      </span>
                    </>
                  ) : (
                    <span className="block text-sm font-semibold text-slate-600">Ghim 📌 một món trong tiệm làm mục tiêu nhé!</span>
                  )}
                </span>
              </Link>

              {/* Vài món gợi ý: đổi được ngay / sắp đổi được */}
              {points.shop.length > 0 && (
                <ul className="space-y-1">
                  {points.shop.map((r) => {
                    const ok = points.balance >= r.price;
                    return (
                      <li key={r.id}>
                        <Link href="/rewards" className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-amber-100/60">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg", rarityOf(r.price).art)}>{r.emoji || "🎁"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-800">{r.title}</span>
                            {ok ? (
                              <span className="block text-[11px] font-black text-emerald-600">Đổi được ngay ✓</span>
                            ) : (
                              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (points.balance / r.price) * 100)}%` }} />
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">🪙 {r.price.toLocaleString("vi-VN")}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HeroStat({ icon, value, label, accent, href }: { icon: string; value: number; label: string; accent: string; href?: string }) {
  const body = (
    <>
      <p className={cn("text-xl font-black tabular-nums sm:text-2xl", accent)}>
        <span aria-hidden className="mr-0.5 text-base">
          {icon}
        </span>
        {value.toLocaleString("vi-VN")}
      </p>
      <p className="truncate text-[10px] font-bold text-blue-100 sm:text-xs">{label}</p>
    </>
  );
  const cls = "min-w-0 rounded-2xl bg-white/10 px-2.5 py-2 text-center ring-1 ring-white/20";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-white/20")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
