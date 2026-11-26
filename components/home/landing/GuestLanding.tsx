"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Facebook, Gift, MessageCircle, MonitorPlay, SquareCheckBig, Youtube } from "lucide-react";
import { CourseTile, type CourseTileData } from "@/components/course/CourseTile";
import { usePointsEnabled } from "@/components/points/PointsFlag";
import { EXAM_DATE } from "@/components/home/HomePromo";
import { useCountdown } from "@/hooks/use-countdown";
import { beVietnam } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { COURSE_GROUPS, getCourseGroup, groupOrder, type CourseGroup } from "@/lib/course-grade";
import { POINTS } from "@/lib/points/config";

export type LandingReward = { id: string; title: string; imageUrl: string | null; emoji: string | null };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Trang chủ khi chưa đăng nhập — theo artboard "Home" của artifact thiết kế (22/11/2026):
 * hero + ảnh minh hoạ, dải đếm ngược kỳ thi, 3 bước học, lộ trình theo khối, quà thật, footer.
 */
export function GuestLanding({ courses, rewards }: { courses: (CourseTileData & { id: string })[]; rewards: LandingReward[] }) {
  const pointsEnabled = usePointsEnabled();
  const { days, hours, minutes, seconds } = useCountdown(EXAM_DATE);
  const [grade, setGrade] = useState<CourseGroup | null>(null);

  const sorted = useMemo(
    () => courses.map((c) => ({ course: c, group: getCourseGroup(c) })).sort((a, b) => groupOrder(a.group) - groupOrder(b.group)),
    [courses],
  );
  const groups = COURSE_GROUPS.filter((g) => sorted.some((x) => x.group === g.id));
  const lessonCount = courses.reduce((n, c) => n + (c.chapters ?? []).reduce((m, ch) => m + (ch.lessons?.length ?? 0), 0), 0);

  const features = [
    { icon: MonitorPlay, text: "Video bài giảng theo lộ trình từng chương" },
    { icon: SquareCheckBig, text: "Đề kiểm tra chấm tự động, lời giải chi tiết từng câu" },
    ...(pointsEnabled ? [{ icon: Gift, text: "Học chăm tích xu, đổi quà tại lớp, trang trí nhân vật riêng", gold: true }] : []),
  ];
  const steps = [
    { title: "Xem bài giảng", text: "Video theo lộ trình từng chương, học xong chương nào đánh dấu chương đó." },
    { title: "Làm đề, xem lời giải", text: "Đề kiểm tra chấm tự động. Sai câu nào xem lời giải chi tiết câu đó." },
    ...(pointsEnabled ? [{ title: "Tích xu, đổi quà", text: "Nộp bài nhận xu, đổi quà tại lớp hoặc trang trí nhân vật của riêng bạn.", gold: true }] : []),
  ];

  return (
    <div className={cn(beVietnam.variable, "bg-white font-[family-name:var(--font-bvp)] text-[15px] text-[#1E1B2E]")} data-testid="guest-landing">
      {/* Hero */}
      <section className="bg-[#F6F3FF]" data-testid="guest-hero">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 pb-20 pt-12 sm:px-6 lg:flex-row lg:items-center lg:pt-[72px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
            <span className="self-start rounded-full border border-[#E4DCFB] bg-white px-3 py-1.5 text-[13px] font-bold text-[#4319A8]">Học cùng thầy Đức</span>
            <h1 className="text-[34px] font-extrabold leading-[1.12] tracking-[-0.02em] sm:text-[44px] xl:text-[52px]">
              Học toán THPT dễ hiểu, <span className="text-[#5B2BD6]">có lộ trình</span>
            </h1>
            <p className="max-w-[540px] text-base leading-relaxed text-[#4B4566] sm:text-lg">Xem bài giảng, làm đề, xem lời giải từng câu và theo dõi tiến bộ mỗi tuần.</p>
            <ul className="flex flex-col gap-3">
              {features.map((f) => (
                <li key={f.text} className="flex items-center gap-3 font-semibold text-[#2D2840]">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border bg-white", f.gold ? "border-[#F3DC8E] text-[#B7791F]" : "border-[#E4DCFB] text-[#5B2BD6]")}>
                    <f.icon className="h-4 w-4" aria-hidden />
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-1.5">
              <Link href="/register" className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-[#5B2BD6] px-[26px] text-base font-extrabold text-white shadow-[0_10px_24px_rgba(91,43,214,0.28)] transition-colors hover:bg-[#4319A8]">
                Đăng ký học <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
              </Link>
              <Link href="/login" className="flex h-[52px] items-center rounded-[14px] border border-[#E4DCFB] bg-white px-[22px] text-base font-bold text-[#2A1F5C] transition-colors hover:border-[#5B2BD6] sm:hidden">
                Đăng nhập
              </Link>
              <a href="#lo-trinh" className="flex h-[52px] items-center rounded-[14px] border border-[#E4DCFB] bg-white px-[22px] text-base font-bold text-[#2A1F5C] transition-colors hover:border-[#5B2BD6]">
                Xem lộ trình
              </a>
            </div>
          </div>

          {/* Ảnh minh hoạ + 2 thẻ nổi (minh hoạ tính năng) */}
          <div className="relative min-w-0 flex-1 lg:min-h-[440px]">
            <div className="relative aspect-[687/324] w-full overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(42,31,92,0.25)] lg:absolute lg:right-0 lg:top-0 lg:aspect-auto lg:h-[300px] lg:w-[88%]">
              <Image src="/landing/hero.webp" alt="Nhân vật học sinh và mèo tinh linh trong thư viện đêm sao" fill priority sizes="(min-width: 1024px) 500px, 92vw" className="object-cover" />
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-4 lg:mt-0">
              <div className="flex w-full max-w-[280px] flex-col gap-3 rounded-[20px] bg-white p-[18px] shadow-[0_18px_40px_rgba(42,31,92,0.16)] lg:absolute lg:left-0 lg:top-[230px] lg:w-[280px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6B6680]">ĐỀ KIỂM TRA · VÍ DỤ</span>
                  <span className="rounded-full bg-[#DDF3E4] px-2 py-0.5 text-[11px] font-bold text-[#17603A]">Đã chấm</span>
                </div>
                <p className="text-[15px] font-extrabold">Hàm số &amp; đồ thị</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[34px] font-extrabold text-[#5B2BD6]">8,5</span>
                  <span className="text-[13px] text-[#6B6680]">/ 10 điểm</span>
                </p>
                <div className="h-2 rounded-full bg-[#F1EEF8]">
                  <div className="h-full w-[85%] rounded-full bg-[#5B2BD6]" />
                </div>
                <p className="text-xs text-[#5F5B73]">Xem lời giải từng câu →</p>
              </div>
              {pointsEnabled && (
                <div className="flex items-center gap-2.5 rounded-full border border-[#F3DC8E] bg-[#FFF6DB] py-2.5 pl-2.5 pr-4 shadow-[0_12px_28px_rgba(122,78,0,0.15)] lg:absolute lg:right-3 lg:top-[330px]">
                  <span aria-hidden className="h-8 w-8 rounded-full border-[3px] border-[#D8961B] bg-[#F5B82E]" />
                  <span className="flex flex-col">
                    <span className="font-extrabold text-[#7A4E00]">+{(POINTS.testSubmit || POINTS.homeworkSubmit).toLocaleString("vi-VN")} xu</span>
                    <span className="text-xs text-[#6B4E12]">{POINTS.testSubmit ? "Nộp bài kiểm tra" : "Nộp bài tập đúng hạn"}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Đếm ngược + số liệu */}
      <section className="relative mx-auto -mt-9 max-w-[1200px] px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#1E1745] px-5 py-6 text-white shadow-[0_20px_50px_rgba(30,23,69,0.25)] sm:px-7" data-testid="landing-countdown">
          <div className="flex flex-[1_1_220px] flex-col gap-1">
            <span className="text-[13px] font-semibold text-[#C9BEFF]">Đếm ngược</span>
            <span className="text-[22px] font-extrabold">Kỳ thi THPT 2027</span>
            <span className="text-sm text-[#D9D3F5]">Ngày 11/06/2027</span>
          </div>
          <div className="grid flex-[2_1_300px] grid-cols-4 gap-2.5" aria-label="Thời gian còn lại đến kỳ thi">
            {[
              [days, "ngày"],
              [pad(hours), "giờ"],
              [pad(minutes), "phút"],
              [pad(seconds), "giây"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-white/14 bg-white/8 px-2 py-3 text-center">
                <div className="text-2xl font-extrabold tabular-nums sm:text-[30px]" suppressHydrationWarning>
                  {v}
                </div>
                <div className="text-xs text-[#D9D3F5]">{l}</div>
              </div>
            ))}
          </div>
          <div aria-hidden className="hidden w-px self-stretch bg-white/16 md:block" />
          <div className="flex flex-[1_1_220px] justify-center gap-6">
            <div>
              <div className="text-[30px] font-extrabold">{courses.length}</div>
              <div className="text-[13px] text-[#D9D3F5]">khóa học</div>
            </div>
            <div>
              <div className="text-[30px] font-extrabold">{lessonCount}</div>
              <div className="text-[13px] text-[#D9D3F5]">bài học</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 bước */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-6 pt-[72px] sm:px-6 sm:pt-[88px]">
        <div className="flex max-w-[640px] flex-col gap-2">
          <h2 className="text-[28px] font-extrabold tracking-[-0.01em] sm:text-[34px]">Học mỗi tuần theo {steps.length} bước</h2>
          <p className="text-base text-[#5F5B73]">Mỗi chương đều đi theo cùng một nhịp, để bạn biết hôm nay cần làm gì.</p>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {steps.map((s, i) => (
            <li key={s.title} className={cn("flex flex-col gap-3 rounded-[22px] border p-[26px]", s.gold ? "border-[#F3DC8E] bg-[#FFFBEF]" : "border-[#ECE9F5]")}>
              <span className={cn("text-[13px] font-extrabold", s.gold ? "text-[#8A5A00]" : "text-[#5B2BD6]")}>BƯỚC {i + 1}</span>
              <h3 className="text-xl font-extrabold">{s.title}</h3>
              <p className="leading-relaxed text-[#5F5B73]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Lộ trình */}
      <section id="lo-trinh" className="mx-auto flex max-w-[1200px] scroll-mt-24 flex-col gap-7 px-4 pb-6 pt-[72px] sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-extrabold tracking-[-0.01em] sm:text-[34px]">Lộ trình học tập</h2>
            <p className="text-base text-[#5F5B73]">Chọn mục tiêu của bạn và bắt đầu ngay.</p>
          </div>
          {groups.length >= 2 && (
            <div role="tablist" aria-label="Chọn khối" className="flex max-w-full gap-1.5 overflow-x-auto rounded-[14px] bg-[#F3F1FA] p-1 [scrollbar-width:none]">
              {[{ id: null, label: "Tất cả" } as { id: CourseGroup | null; label: string }, ...groups].map((g) => {
                const on = grade === g.id;
                return (
                  <button
                    key={g.id ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setGrade(g.id)}
                    className={cn("h-10 shrink-0 rounded-[10px] px-4 text-sm font-bold transition-colors", on ? "bg-white text-[#2A1F5C] shadow-[0_1px_3px_rgba(30,27,46,0.12)]" : "text-[#5F5B73] hover:text-[#2A1F5C]")}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {sorted.length > 0 ? (
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            {sorted.map(({ course, group }) => (
              <li key={course.id} className="flex flex-col">
                <CourseTile course={course} variant="roadmap" step={group ? groups.findIndex((g) => g.id === group) + 1 : undefined} dimmed={grade !== null && grade !== group} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-[22px] border border-dashed border-[#E4E0F0] px-6 py-12 text-center text-[#5F5B73]">Khoá học đang được cập nhật.</p>
        )}
        <Link href="/courses" className="flex h-12 items-center self-center rounded-[14px] border border-[#E4DCFB] px-[22px] font-bold text-[#2A1F5C] transition-colors hover:border-[#5B2BD6]">
          Xem tất cả khóa học
        </Link>
      </section>

      {/* Quà thật */}
      {pointsEnabled && (
        <section className="mx-auto max-w-[1200px] px-4 pb-[88px] pt-[72px] sm:px-6">
          <div className="flex flex-wrap items-center gap-8 rounded-[28px] border border-[#F3DC8E] bg-[#FFF8E6] p-6 sm:p-10" data-testid="landing-rewards">
            <div className="flex flex-[1_1_320px] flex-col gap-3.5">
              <h2 className="text-[26px] font-extrabold sm:text-[30px]">Học chăm có quà thật</h2>
              <p className="text-base leading-relaxed text-[#5C4A1E]">Nộp bài kiểm tra, bài tập để tích xu. Dùng xu đổi quà nhận tại lớp, thẻ đặc quyền, hoặc trang trí nhân vật và thú cưng của riêng bạn.</p>
              <Link href="/rewards" className="flex h-12 items-center self-start rounded-[14px] bg-[#1E1B2E] px-5 font-bold text-white transition-colors hover:bg-[#2A1F5C]">
                Ghé Tiệm quà
              </Link>
            </div>
            {rewards.length > 0 && (
              <ul className="grid flex-[1_1_320px] grid-cols-2 gap-3 sm:grid-cols-4">
                {rewards.map((r) => (
                  <li key={r.id} className="flex flex-col items-center gap-2 rounded-[18px] bg-white p-2.5">
                    <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[#FFFBEF] text-4xl">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden>{r.emoji || "🎁"}</span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-center text-xs font-bold">{r.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-[#1E1745] text-[#D9D3F5]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2.5 text-[17px] font-extrabold text-white">
            <span aria-hidden className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#5B2BD6]">
              ∑
            </span>
            Thật Dễ Học Toán
          </div>
          <nav aria-label="Liên kết" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {[
              { href: "https://facebook.com", label: "Facebook", icon: Facebook },
              { href: "https://messenger.com", label: "Messenger", icon: MessageCircle },
              { href: "https://youtube.com", label: "Youtube", icon: Youtube },
            ].map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 py-2 text-[#D9D3F5] hover:text-white">
                <l.icon className="h-4 w-4" aria-hidden /> {l.label}
              </a>
            ))}
            <a
              href="https://discord.gg/eclass"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("open-discord-modal"));
              }}
              className="py-2 text-[#D9D3F5] hover:text-white"
            >
              Discord
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
