import Link from "next/link";
import { Flame, Medal, Palette, Pencil, Settings, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVELS } from "@/lib/points/levels";
import type { PublicProfile } from "@/lib/game/profile";
import { Chibi } from "@/components/avatar/Chibi";
import { ITEM_BY_ID } from "@/lib/game/items";
import { ProfileScene } from "./ProfileScene";
import { EffectLayer } from "./EffectLayer";
import { PetImage } from "@/components/studio/CutArt";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

/** Hồ sơ cá nhân: nhân vật, danh hiệu, xu tích luỹ, thành tích; chủ nhân có nút tuỳ chỉnh */
export function PublicProfileView({ p }: { p: PublicProfile }) {
  const card = "rounded-3xl border-2 border-blue-100/80 bg-white shadow-[0_4px_0_0_#e3ecff]";
  const badges = [
    { icon: "📝", value: p.completedTests, label: "bài đã nộp" },
    { icon: "💯", value: p.tens, label: "bài điểm 10" },
    { icon: "🔥", value: p.bestWeekStreak, label: "tuần chuỗi tốt nhất" },
    { icon: "🎒", value: p.ownedCount, label: "món đồ sở hữu" },
  ];
  return (
    <div className="space-y-4" data-testid="public-profile">
      <section className={cn(card, "overflow-hidden")}>
        <div className="relative flex flex-col items-center gap-4 overflow-hidden p-5 sm:flex-row sm:items-end sm:p-7" data-testid="profile-banner" data-bg={p.avatar.background ?? ""}>
          {/* Cảnh Hình nền + Hiệu ứng (dùng chung với trang Hồ sơ & Trang trí) */}
          <ProfileScene bgId={p.avatar.background} className="absolute inset-0" />
          <EffectLayer effectId={p.avatar.effect} />
          <div className="relative shrink-0 rounded-[2rem] bg-white/70 p-2 shadow-lg ring-4 ring-white/80">
            <Chibi config={p.avatar} size={168} title={p.name ?? undefined} />
            {p.avatar.pet && (
              <span className="absolute -bottom-2 -right-4 rounded-full bg-white/90 p-1 shadow-md ring-2 ring-white" title={ITEM_BY_ID[p.avatar.pet]?.name}>
                <PetImage id={p.avatar.pet} size={64} className="h-16 w-16" />
              </span>
            )}
          </div>
          <div className="relative w-full min-w-0 flex-1 rounded-2xl bg-white/85 p-3 text-center backdrop-blur-sm sm:w-auto sm:text-left">
            {p.equippedTitle && <p className="text-xs font-black uppercase tracking-widest text-violet-700">🏷️ {p.equippedTitle}</p>}
            <h1 className="max-w-full truncate text-2xl font-black text-slate-900 sm:text-3xl">{p.name || "Học sinh"}</h1>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1", p.level.badge)}>
                <span aria-hidden>{p.level.icon}</span> {p.level.name}
              </span>
              {p.className && <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-700">Lớp {p.className}</span>}
              {p.rankInGrade && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                  <Trophy className="h-3.5 w-3.5" /> Hạng {p.rankInGrade.rank}/{p.rankInGrade.total} khối {p.grade}
                </span>
              )}
            </div>
            <div className="mt-3 max-w-md">
              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                <span>💰 {p.lifetimeEarned.toLocaleString("vi-VN")} xu tích luỹ</span>
                <span>{p.level.next ? `còn ${p.level.toNext.toLocaleString("vi-VN")} xu → ${p.level.next.icon} ${p.level.next.name}` : "Danh hiệu cao nhất 👑"}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={p.level.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full rounded-full bg-gradient-to-r", p.level.bar)} style={{ width: `${Math.max(4, p.level.progress)}%` }} />
              </div>
            </div>
          </div>
          {p.isSelf && (
            <div className="relative flex shrink-0 flex-wrap justify-center gap-2 sm:flex-col">
              <Link href="/profile" data-testid="profile-customize" className="btn-3d btn-3d-blue btn-shine px-4 py-2 text-sm">
                <Palette className="h-4 w-4" /> Tuỳ chỉnh nhân vật
              </Link>
              <Link href="/profile" className="btn-3d btn-3d-white px-4 py-2 text-sm">
                <Settings className="h-4 w-4" /> Tài khoản
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-5">
          {badges.map((b) => (
            <div key={b.label} className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                <span aria-hidden className="mr-1">{b.icon}</span>
                {b.value}
              </p>
              <p className="text-[11px] font-bold text-slate-500">{b.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cn(card, "p-4 sm:p-5")}>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Medal className="h-5 w-5 text-amber-500" /> Thang danh hiệu
          </h2>
          <ul className="mt-3 space-y-1.5">
            {LEVELS.map((lv, i) => {
              const reached = p.lifetimeEarned >= lv.min;
              const current = p.level.level === i + 1;
              return (
                <li key={lv.name} className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm", current ? "bg-blue-50 font-black text-blue-800 ring-1 ring-blue-200" : reached ? "text-slate-700" : "text-slate-400")}>
                  <span aria-hidden className="w-6 text-center">{lv.icon}</span>
                  <span className="flex-1">{lv.name}</span>
                  <span className="text-xs tabular-nums">{lv.min.toLocaleString("vi-VN")} xu</span>
                  {reached && <span className="text-emerald-600">✓</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cn(card, "p-4 sm:p-5")}>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Flame className="h-5 w-5 text-orange-500" /> {p.isSelf ? "Kết quả gần đây" : "Hoạt động"}
          </h2>
          {p.isSelf ? (
            p.recent.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Chưa có bài nào được chấm. Làm bài đầu tiên nhé!</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {p.recent.map((r) => (
                  <li key={r.id}>
                    <Link href={r.lessonId ? `/watch/${r.lessonId}/results/${r.id}` : "#"} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 hover:bg-blue-50">
                      <span className={cn("flex h-9 w-10 items-center justify-center rounded-lg text-sm font-black text-white", (r.score ?? 0) >= 8 ? "bg-emerald-500" : (r.score ?? 0) >= 5 ? "bg-blue-600" : "bg-rose-500")}>
                        {r.score === null ? "—" : r.score.toFixed(r.score % 1 === 0 ? 0 : 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{r.title}</span>
                        <span className="block text-[11px] text-slate-500">{fmtDate(r.completedAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>🔥 Chuỗi tuần hiện tại: <b>{p.weekStreak}</b> · tốt nhất <b>{p.bestWeekStreak}</b></p>
              <p>✅ Đã học <b>{p.completedLessons}</b> bài</p>
              <p>📅 Tham gia từ {fmtDate(p.memberSince)}</p>
            </div>
          )}
          {p.isSelf && (
            <Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700">
              <Pencil className="h-3.5 w-3.5" /> Đổi tên / ảnh / mật khẩu
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
