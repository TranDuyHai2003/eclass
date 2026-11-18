import type { Season } from "@/lib/seasonal-theme";

const LIGHTS = 28;

/**
 * Băng-rôn lễ hội cho trang xếp hạng (Giáng sinh / Tết). `daysLeft` tính sẵn ở server
 * (giờ Việt Nam) để HTML server và trình duyệt giống nhau.
 */
export function SeasonalBanner({ season, daysLeft }: { season: Season | null; daysLeft: number | null }) {
  if (!season) return null;
  const isXmas = season === "christmas";

  return (
    <div
      className={
        "relative overflow-hidden rounded-none sm:rounded-2xl border-y sm:border shadow-lg " +
        (isXmas
          ? "border-red-500/40 bg-gradient-to-r from-[#3b0a0a] via-[#0c2a1a] to-[#3b0a0a]"
          : "border-amber-400/50 bg-gradient-to-r from-[#5a0b0b] via-[#7a1010] to-[#5a0b0b]")
      }
    >
      {/* Dây đèn */}
      <div className="season-lights px-3 pt-1" aria-hidden>
        {Array.from({ length: LIGHTS }, (_, i) => (
          <i key={i} className={i >= LIGHTS / 2 ? "hidden sm:block" : undefined} />
        ))}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl sm:text-4xl shrink-0 drop-shadow" aria-hidden>
            {isXmas ? "🎄" : "🧧"}
          </span>
          <div className="min-w-0">
            <p className={"text-base sm:text-xl font-black tracking-tight " + (isXmas ? "text-white" : "text-amber-200")}>
              {isXmas ? "Mùa Giáng sinh – Đua top cuối năm!" : "Chúc mừng năm mới – Năm mới bứt phá!"}
            </p>
            <p className={"text-xs sm:text-sm font-medium " + (isXmas ? "text-emerald-100/80" : "text-amber-100/80")}>
              {isXmas
                ? "Giữ vững phong độ qua mùa lễ hội, khép lại năm bằng thứ hạng thật đẹp."
                : "Giữ chuỗi học tập cả dịp Tết — ai về đích đầu xuân sẽ có hạng đẹp nhất lớp."}
            </p>
          </div>
        </div>

        {daysLeft !== null && daysLeft > 0 && (
          <div
            className={
              "flex items-baseline gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 font-mono font-black shrink-0 " +
              (isXmas ? "bg-red-600/80 text-white" : "bg-amber-400 text-red-900")
            }
          >
            <span className="text-xl sm:text-2xl leading-none">{daysLeft}</span>
            <span className="text-[11px] sm:text-xs uppercase tracking-wider">
              ngày nữa {isXmas ? "tới Giáng sinh" : "tới Tết"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
