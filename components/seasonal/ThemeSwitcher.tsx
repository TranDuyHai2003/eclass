"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette, Snowflake, Flower2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SEASON_LABEL, THEME_COOKIE, type Season } from "@/lib/seasonal-theme";
import { cn } from "@/lib/utils";

/** Lưu lựa chọn (cookie 1 năm) và đổi ngay thuộc tính data-season trên trang hiện tại. */
function applyThemeChoice(value: Season | null) {
  document.cookie = `${THEME_COOKIE}=${value ?? "default"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  const root = document.documentElement;
  if (value) root.setAttribute("data-season", value);
  else root.removeAttribute("data-season");
}

/**
 * Menu đổi theme trên header — chỉ hiện khi đang có mùa lễ. Mặc định là theme thường;
 * lựa chọn lưu trong cookie (1 năm) để server vẽ đúng theme ngay từ đầu, không bị nháy.
 */
export function ThemeSwitcher({ available, active }: { available: Season; active: Season | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Season | null>(active);
  const [, startTransition] = useTransition();

  const choose = (value: Season | null) => {
    setCurrent(value);
    // Đổi ngay trên trang hiện tại, rồi làm mới phần do server vẽ (hiệu ứng, dòng chúc…)
    applyThemeChoice(value);
    startTransition(() => router.refresh());
  };

  const SeasonIcon = available === "christmas" ? Snowflake : Flower2;
  const options: { value: Season | null; label: string; hint: string }[] = [
    { value: null, label: "Mặc định", hint: "Giao diện thường" },
    {
      value: available,
      label: SEASON_LABEL[available],
      hint: available === "christmas" ? "Tuyết rơi nhẹ, mũ Noel" : "Hoa mai, sắc Tết",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Đổi giao diện theo mùa"
          title="Đổi giao diện"
          className={cn(
            "h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border flex items-center justify-center transition-colors",
            current
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              : "border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200",
          )}
        >
          {current ? <SeasonIcon className="h-5 w-5" /> : <Palette className="h-5 w-5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-slate-500">Giao diện</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.label} onSelect={() => choose(o.value)} className="flex items-start gap-2 py-2">
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", current === o.value ? "opacity-100 text-blue-600" : "opacity-0")} />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-slate-500">{o.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Bản dùng trong menu ☰ trên điện thoại (header điện thoại không đủ chỗ cho thêm một nút). */
export function MobileThemeOptions({ available, active }: { available: Season; active: Season | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Season | null>(active);
  const [, startTransition] = useTransition();
  const choose = (value: Season | null) => {
    setCurrent(value);
    applyThemeChoice(value);
    startTransition(() => router.refresh());
  };
  const options: { value: Season | null; label: string }[] = [
    { value: null, label: "Mặc định" },
    { value: available, label: `${available === "christmas" ? "🎄" : "🧧"} ${SEASON_LABEL[available]}` },
  ];
  return (
    <div className="px-6">
      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Giao diện</p>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => choose(o.value)}
            aria-pressed={current === o.value}
            className={cn(
              "rounded-xl py-2.5 text-sm font-bold transition-colors",
              current === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
