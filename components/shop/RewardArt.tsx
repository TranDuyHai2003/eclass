import { PetSvg } from "@/components/avatar/PetSvg";

/**
 * Hình minh hoạ quà theo mockup (nét nâu, màu kem): chọn theo từ khoá trong tên quà, không khớp thì dùng emoji thầy đặt.
 * SVG tĩnh, không JS → nhẹ, render được ở server.
 */
type Kind = "milktea" | "pen" | "notebook" | "plush" | "pass" | "vip" | "snack" | "candy" | "sticker";

const RULES: [RegExp, Kind][] = [
  [/trà sữa|tra sua|milk ?tea|trà/i, "milktea"],
  [/vip|chỗ ngồi|cho ngoi|chọn chỗ|ngồi cạnh/i, "vip"],
  [/vé|phiếu|miễn|gia hạn|pass|thẻ/i, "pass"],
  [/gấu|thú bông|bông|plush/i, "plush"],
  [/hộp bút|bút|pen/i, "pen"],
  [/sổ|vở|notebook|tập/i, "notebook"],
  [/bim ?bim|snack|khoai/i, "snack"],
  [/kẹo|bánh|socola|chocolate/i, "candy"],
  [/sticker|nhãn dán|hình dán/i, "sticker"],
];

export function rewardArtKind(title: string): Kind | null {
  for (const [re, k] of RULES) if (re.test(title)) return k;
  return null;
}

const S = { stroke: "#5b3d1e", strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function RewardArt({ title, emoji, size = 96 }: { title: string; emoji?: string | null; size?: number }) {
  const kind = rewardArtKind(title);
  if (!kind) return <span className="text-5xl drop-shadow-sm sm:text-6xl" aria-hidden>{emoji || "🎁"}</span>;
  if (kind === "plush") return <PetSvg itemId="pet-moka" size={size} />;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="drop-shadow-sm">
      <ellipse cx="50" cy="93" rx="26" ry="4" fill="#5b3d1e" opacity=".15" />
      {kind === "milktea" && (
        <g {...S}>
          <path d="M30 34h40l-5 54a5 5 0 0 1-5 4H40a5 5 0 0 1-5-4z" fill="#e9c49a" />
          <path d="M33 60h34l-2.6 28a5 5 0 0 1-5 4H40.6a5 5 0 0 1-5-4z" fill="#c8915c" />
          <path d="M27 34h46" />
          <path d="M30 34c0-10 8-16 20-16s20 6 20 16" fill="#fff" />
          <path d="M33 24l-3-10 10 6M67 24l3-10-10 6" fill="#fff" />
          <path d="M55 18l6-14" stroke="#d94a3a" strokeWidth="4" />
          {[[42, 76], [50, 82], [58, 75], [46, 86], [56, 86]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="#4a2c14" strokeWidth="1.5" />)}
          <circle cx="44" cy="46" r="2" fill="#5b3d1e" stroke="none" /><circle cx="56" cy="46" r="2" fill="#5b3d1e" stroke="none" />
          <path d="M47 51q3 3 6 0" strokeWidth="2" fill="none" />
        </g>
      )}
      {kind === "pen" && (
        <g {...S}>
          <path d="M18 44q0-12 12-12h40q12 0 12 12v22q0 14-14 14H32q-14 0-14-14z" fill="#f3d7a8" />
          <path d="M26 33l-4-12 12 8M74 33l4-12-12 8" fill="#f3d7a8" />
          <path d="M18 56h64" strokeDasharray="3 4" strokeWidth="2" />
          <circle cx="80" cy="44" r="4" fill="#ffd84d" />
          <circle cx="40" cy="48" r="2.2" fill="#5b3d1e" stroke="none" /><circle cx="60" cy="48" r="2.2" fill="#5b3d1e" stroke="none" />
          <path d="M46 53q4 3 8 0" strokeWidth="2" fill="none" />
        </g>
      )}
      {kind === "notebook" && (
        <g {...S}>
          <rect x="26" y="14" width="52" height="72" rx="6" fill="#8fc77d" />
          <rect x="36" y="24" width="34" height="40" rx="4" fill="#fffaf0" />
          {[22, 34, 46, 58, 70].map((y) => <path key={y} d="M20 0h12" transform={`translate(0 ${y})`} strokeWidth="3.5" />)}
          <path d="M44 38l-3-8 7 4h10l7-4-3 8v10q0 6-9 6t-9-6z" fill="#fff" strokeWidth="2.2" />
          <circle cx="49" cy="42" r="1.4" fill="#5b3d1e" stroke="none" /><circle cx="57" cy="42" r="1.4" fill="#5b3d1e" stroke="none" />
        </g>
      )}
      {(kind === "pass" || kind === "vip") && (
        <g {...S} transform="rotate(-10 50 55)">
          <path d="M14 38h72v10a7 7 0 0 0 0 14v10H14V62a7 7 0 0 0 0-14z" fill={kind === "vip" ? "#ffd84d" : "#9fd3f5"} />
          <path d="M34 40v30" strokeDasharray="3 4" strokeWidth="2" />
          <text x="60" y="61" textAnchor="middle" fontSize="15" fontWeight="900" fill="#3b2a14" stroke="none" fontFamily="system-ui, sans-serif">{kind === "vip" ? "VIP" : "PASS"}</text>
          <circle cx="24" cy="55" r="4" fill="#fff" />
        </g>
      )}
      {kind === "snack" && (
        <g {...S}>
          <path d="M28 16h44l-4 8 4 8-2 50 2 8H28l2-8-2-50 4-8z" fill="#ff9f5a" />
          <path d="M30 32h40M30 82h40" strokeWidth="2.5" />
          <circle cx="50" cy="56" r="15" fill="#ffd84d" />
          <circle cx="45" cy="53" r="2" fill="#5b3d1e" stroke="none" /><circle cx="55" cy="53" r="2" fill="#5b3d1e" stroke="none" />
          <path d="M45 60q5 4 10 0" strokeWidth="2" fill="none" />
        </g>
      )}
      {kind === "candy" && (
        <g {...S}>
          <path d="M22 50l-12-10v20zM78 50l12-10v20z" fill="#ff8fb1" />
          <circle cx="50" cy="50" r="24" fill="#ffb3c8" />
          <path d="M34 40q16-10 32 0M32 54q18-10 36 0" stroke="#fff" strokeWidth="4" fill="none" />
        </g>
      )}
      {kind === "sticker" && (
        <g {...S}>
          <path d="M50 12l10 22 24 3-18 16 5 24-21-12-21 12 5-24-18-16 24-3z" fill="#ffd84d" />
          <path d="M66 70l10 10" strokeWidth="2.5" />
          <circle cx="44" cy="44" r="2.2" fill="#5b3d1e" stroke="none" /><circle cx="56" cy="44" r="2.2" fill="#5b3d1e" stroke="none" />
          <path d="M45 51q5 4 10 0" strokeWidth="2" fill="none" />
        </g>
      )}
    </svg>
  );
}
