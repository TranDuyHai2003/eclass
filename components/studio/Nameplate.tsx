import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";

/**
 * Bảng tên (canvas "Tiệm quà v2"): dải nền 420:100 trong public/studio/nameplates.webp (7 hàng) + hiệu ứng động
 * (gợn nước, hoa rơi, sao lấp lánh, bướm, ánh quét) — tắt khi giảm chuyển động (globals.css v2-*).
 */
export const NAMEPLATE_SPRITE = "/studio/nameplates.webp";

type Fx = { cls: string; style: React.CSSProperties };
const tw = (l: number, t: number, c: string, d: number, z = 4): Fx => ({ cls: "v2-tw", style: { left: `${l}%`, top: `${t}%`, width: z, height: z, borderRadius: "50%", background: c, animationDelay: `${d}s` } });

function fxFor(row: number): Fx[] {
  switch (row) {
    case 0: // ao sen: gợn nước
      return [0, 0.8, 1.6].map((d, i) => ({ cls: "v2-ripple", style: { left: `${66 + i * 7}%`, top: `${52 - i * 10}%`, width: 28, height: 10, animationDelay: `${d}s` } }));
    case 1: // gió xuân: cánh hoa rơi
      return [0, 0.7, 1.4, 2.1, 2.8].map((d, i) => ({ cls: "v2-fall", style: { left: `${52 + i * 9}%`, top: -6, width: 9, height: 7, background: i % 2 ? "#F9A8D4" : "#F472B6", animationDelay: `${d}s` } }));
    case 2: // trời sao
      return [tw(58, 22, "#FEF08A", 0), tw(70, 60, "#FFFFFF", 0.5, 3), tw(84, 30, "#FEF08A", 1, 5), tw(92, 70, "#FFFFFF", 0.3, 3), tw(64, 78, "#FEF08A", 1.2, 3)];
    case 3: // bướm đêm
      return [tw(60, 30, "#E9D5FF", 0, 5), tw(72, 70, "#C4B5FD", 0.6, 4), tw(88, 24, "#FFFFFF", 1.1, 3), { cls: "v2-bob", style: { left: "78%", top: "28%", width: 16, height: 12, borderRadius: "50% 50% 40% 40%", background: "#C4B5FD", opacity: 0.85 } }];
    case 4: // tiệc mèo
      return [
        { cls: "v2-bob", style: { left: "64%", top: "30%", width: 9, height: 9, borderRadius: "50%", background: "#F59E0B", opacity: 0.55 } },
        { cls: "v2-bob", style: { left: "72%", top: "58%", width: 9, height: 9, borderRadius: "50%", background: "#F59E0B", opacity: 0.55, animationDelay: "0.5s" } },
        { cls: "v2-sweep", style: {} },
      ];
    case 5: // vết cào hoả hồng
      return [{ cls: "v2-sweep", style: {} }, tw(80, 30, "#FDE68A", 0.4, 3)];
    case 6: // hoàng kim tinh tú
      return [{ cls: "v2-sweep", style: { background: "linear-gradient(90deg,transparent,rgba(253,230,138,0.6),transparent)" } }, tw(62, 26, "#FEF08A", 0, 5), tw(74, 70, "#FFFFFF", 0.7, 3), tw(90, 20, "#FEF08A", 1.2, 4)];
    default:
      return [];
  }
}

/** Nền + hiệu ứng của một bảng tên; `children` là chữ (tên, khối…) đặt bên trái. Không có bảng tên → nền tím nhạt mặc định */
export function Nameplate({ id, className, children, testId }: { id?: string | null; className?: string; children?: React.ReactNode; testId?: string }) {
  const item = id ? ITEM_BY_ID[id] : undefined;
  const row = item?.slot === "nameplate" ? Number(item.v ?? -1) : -1;
  const dark = item?.v2 === "dark";
  return (
    <div className={cn("relative overflow-hidden rounded-[14px]", row < 0 && "bg-gradient-to-r from-[#EDE7FD] via-[#F6F1FF] to-[#FCE7F3]", className)} data-testid={testId} data-nameplate={item?.id ?? ""}>
      {row >= 0 && (
        <>
          <span aria-hidden className="absolute inset-0" style={{ backgroundImage: `url(${NAMEPLATE_SPRITE})`, backgroundSize: "100% 700%", backgroundPosition: `0 ${((row / 6) * 100).toFixed(4)}%`, backgroundRepeat: "no-repeat" }} />
          {fxFor(row).map((f, i) => <span key={i} aria-hidden className={f.cls} style={f.style} />)}
        </>
      )}
      <div className={cn("relative", dark ? "text-white" : "text-[#2A1F5C]")}>{children}</div>
    </div>
  );
}
