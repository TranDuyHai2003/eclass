"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Gift, LogIn, PlayCircle, Sparkles, UserPlus } from "lucide-react";
import { HomePromo } from "../HomePromo";
import { usePointsEnabled } from "@/components/points/PointsFlag";

const FEATURES = [
  { icon: PlayCircle, text: "Video bài giảng theo lộ trình từng chương" },
  { icon: CheckCircle2, text: "Đề kiểm tra chấm tự động, lời giải chi tiết từng câu" },
  { icon: Gift, text: "Học chăm tích xu, đổi quà tại lớp, trang trí nhân vật riêng", points: true },
];

/** Trang chủ khi chưa đăng nhập: giới thiệu ngắn + mời đăng ký, đếm ngược kỳ thi gọn bên phải */
export function GuestHero({ courseCount, lessonCount }: { courseCount: number; lessonCount: number }) {
  const pointsEnabled = usePointsEnabled();
  const features = FEATURES.filter((f) => !f.points || pointsEnabled);
  return (
    <section data-testid="guest-hero" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 text-white shadow-[0_6px_0_0_#1e3a8a] sm:p-7 lg:col-span-2">
        <div aria-hidden className="dots-bg absolute inset-0 opacity-40" style={{ "--dot": "rgba(255,255,255,.18)" } as React.CSSProperties} />
        <div aria-hidden className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-10 right-6 select-none text-[140px] font-black leading-none text-white/10">∑</div>

        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black ring-1 ring-white/25">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Thật Dễ Học Toán
          </span>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">
              Học toán THPT <span className="text-amber-300">dễ hiểu, có lộ trình</span>
            </h1>
            <p className="max-w-xl text-sm font-medium text-blue-100 sm:text-base">
              Học cùng thầy Đức: xem bài giảng, làm đề, xem lời giải từng câu và theo dõi tiến bộ mỗi tuần.
            </p>
          </div>
          <ul className={features.length === 3 ? "grid gap-2 sm:grid-cols-3" : "grid gap-2 sm:grid-cols-2"}>
            {features.map((f) => (
              <li key={f.text} className="flex items-start gap-2 rounded-2xl bg-white/10 p-3 text-sm font-semibold ring-1 ring-white/20">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/register" className="btn-3d btn-3d-amber px-5 py-2.5 text-sm">
              <UserPlus className="h-4 w-4" /> Đăng ký học
            </Link>
            <Link href="/login" className="btn-3d btn-3d-white px-5 py-2.5 text-sm">
              <LogIn className="h-4 w-4" /> Đăng nhập
            </Link>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <HomePromo variant="card" />
        <div className="flex flex-1 flex-col justify-center rounded-3xl border-2 border-blue-100 bg-white p-4 shadow-[0_4px_0_0_#dbeafe]">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-blue-50 px-3 py-3">
              <p className="text-2xl font-black text-blue-700 tabular-nums">{courseCount}</p>
              <p className="text-xs font-bold text-blue-500">khoá học</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-3 py-3">
              <p className="text-2xl font-black text-amber-700 tabular-nums">{lessonCount}</p>
              <p className="text-xs font-bold text-amber-600">bài học</p>
            </div>
          </div>
          <Link href="#lo-trinh" className="mt-3 inline-flex items-center justify-center gap-1.5 text-sm font-black text-blue-600 hover:text-blue-700">
            <BookOpen className="h-4 w-4" /> Xem các khoá học
          </Link>
        </div>
      </div>
    </section>
  );
}
