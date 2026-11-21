"use client";

import Link from "next/link";
import { Backpack, Gift, Home, Medal, NotebookPen, ShoppingCart, Ticket, Trophy, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";
import { ShopModal } from "./ShopModal";
import { WEATHER_LABEL, type Weather } from "./Weather";

export type MenuAction = "shop" | "tasks" | "box" | "board" | "scratch" | "bag" | "titles";

/** "Menu Tiệm Quà": chọn thời tiết + lưới lối tắt (theo mockup; "Giáo viên" thay bằng Nhân vật / Trang chủ vì học sinh không phát mã) */
export function ShopMenuModal({
  open, onOpenChange, weather, onWeather, onAction, showBox,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  weather: Weather;
  onWeather: (w: Weather) => void;
  onAction: (a: MenuAction) => void;
  showBox: boolean;
}) {
  const tiles: { key: string; label: string; icon: React.ReactNode; action?: MenuAction; href?: string }[] = [
    { key: "shop", label: "Cửa Hàng", icon: <ShoppingCart className="h-6 w-6 text-[#ef5a3c]" />, action: "shop" },
    { key: "tasks", label: "Bài Tập", icon: <NotebookPen className="h-6 w-6 text-[#5b3d1e]" />, action: "tasks" },
    ...(showBox ? [{ key: "box", label: "Hộp Bí Ẩn", icon: <Gift className="h-6 w-6 text-[#d94a3a]" />, action: "box" as const }] : []),
    { key: "board", label: "Bảng Vàng", icon: <Trophy className="h-6 w-6 text-[#d9a52a]" />, action: "board" },
    { key: "scratch", label: "Thẻ Cào", icon: <Ticket className="h-6 w-6 text-[#5b3d1e]" />, action: "scratch" },
    { key: "bag", label: "Túi Đồ", icon: <Backpack className="h-6 w-6 text-[#b4531a]" />, action: "bag" },
    { key: "titles", label: "Danh Hiệu", icon: <Medal className="h-6 w-6 text-[#d9a52a]" />, action: "titles" },
    { key: "avatar", label: "Nhân Vật", icon: <UserRound className="h-6 w-6 text-[#2e8fe0]" />, href: "/profile/avatar" },
    ...(showBox ? [] : [{ key: "home", label: "Trang Chủ", icon: <Home className="h-6 w-6 text-[#4fae4a]" />, href: "/" }]),
  ];
  const opts: { key: Weather; label: string; cls: string }[] = [
    { key: "sun", label: "☀️ Nắng", cls: "btn-pill-yellow" },
    { key: "rain", label: "🌧️ Mưa", cls: "btn-pill-blue" },
    { key: "snow", label: "❄️ Tuyết", cls: "" },
  ];
  return (
    <ShopModal open={open} onOpenChange={onOpenChange} title="🏠 Menu Tiệm Quà" testId="shop-menu" className="sm:max-w-md">
      <div className="rounded-2xl border-[2.5px] border-[#5b3d1e] bg-gradient-to-b from-[#9fd3f5] to-[#cfe9fb] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-black text-[#0b2a44]">☁️ Thời tiết hôm nay</span>
          <span className="rounded-full border-2 border-[#5b3d1e] bg-white px-2 py-0.5 text-[11px] font-black text-[#3b2a14]" data-testid="weather-label">{WEATHER_LABEL[weather]}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thời tiết">
          {opts.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={weather === o.key}
              data-testid={`weather-${o.key}`}
              onClick={() => { play("tick"); onWeather(o.key); }}
              className={cn("btn-pill py-1.5 text-xs", o.cls, weather === o.key && "ring-4 ring-white/80")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#5b3d1e]/30 bg-white transition-transform group-hover:-translate-y-0.5 group-hover:scale-105">{t.icon}</span>
              <span className="text-[11px] font-black text-[#3b2a14]">{t.label}</span>
            </>
          );
          const cls = "group flex flex-col items-center gap-1 rounded-2xl p-1.5 hover:bg-[#fff1c2]";
          return t.href ? (
            <Link key={t.key} href={t.href} className={cls} data-testid={`menu-${t.key}`}>{inner}</Link>
          ) : (
            <button key={t.key} type="button" className={cls} data-testid={`menu-${t.key}`} onClick={() => { play("click"); onAction(t.action!); }}>{inner}</button>
          );
        })}
      </div>
    </ShopModal>
  );
}
