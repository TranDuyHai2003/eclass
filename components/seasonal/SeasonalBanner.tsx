import type { Season } from "@/lib/seasonal-theme";

/**
 * Một dòng chúc nhỏ trên trang xếp hạng khi người dùng bật theme mùa (Giáng sinh / Tết).
 * `daysLeft` tính sẵn ở server (giờ Việt Nam) để HTML server và trình duyệt giống nhau.
 */
export function SeasonalBanner({ season, daysLeft }: { season: Season | null; daysLeft: number | null }) {
  if (!season) return null;
  const isXmas = season === "christmas";

  return (
    <div className="mx-3 sm:mx-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-slate-200">
      <span aria-hidden>{isXmas ? "🎄" : "🧧"}</span>
      <span className="font-semibold">{isXmas ? "Giáng sinh an lành!" : "Chúc mừng năm mới!"}</span>
      <span className="text-slate-400 text-xs sm:text-sm">
        {isXmas ? "Giữ vững phong độ trong mùa lễ hội nhé." : "Năm mới bứt phá, giữ chuỗi học tập dịp Tết."}
      </span>
      {daysLeft !== null && daysLeft > 0 && (
        <span className={"ml-auto text-xs font-bold " + (isXmas ? "text-rose-300" : "text-amber-300")}>
          Còn {daysLeft} ngày {isXmas ? "tới Giáng sinh" : "tới Tết"}
        </span>
      )}
    </div>
  );
}
