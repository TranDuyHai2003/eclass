import { cn } from "@/lib/utils";
import { V2Art, rewardArtV2 } from "@/components/studio/Sprite";

/**
 * Khung ảnh của một quà thầy tạo: quà hiện vật = hộp quà (ruy băng + nơ, "Nhận tại lớp", "Sắp hết" khi còn ≤ 3),
 * thẻ đặc quyền = tấm vé (khuyết hai bên, đường xé, cuống "VÉ", giới hạn mỗi tháng). Dùng ở lưới tiệm và khu quản lý quà.
 */
export function RewardArt({ title, kind, stock, limit, className, children }: {
  title: string;
  kind: "PHYSICAL" | "VIRTUAL";
  stock: number | null;
  limit: number | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const low = stock !== null && stock > 0 && stock <= 3;
  return (
    <span className={cn("ah-part", kind === "PHYSICAL" ? "ah-gift" : "ah-ticket", className)} data-art={kind === "PHYSICAL" ? "gift" : "ticket"}>
      {children}
      {kind === "PHYSICAL" ? (
        <>
          {/* ruy băng chữ thập theo màu độ hiếm (dưới món quà) */}
          <span className="ah-rib v" aria-hidden />
          <span className="ah-rib h" aria-hidden />
          <span className="ah-spot" aria-hidden />
          <svg className="ah-bow" viewBox="0 0 64 40" aria-hidden>
            <path d="M30 20C20 4 6 4 6 14s12 12 24 6z" fill="var(--h1)" stroke="#241e1a" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M34 20C44 4 58 4 58 14s-12 12-24 6z" fill="var(--h1)" stroke="#241e1a" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M12 12c4-3 9-2 13 3M52 12c-4-3-9-2-13 3" fill="none" stroke="#fffdf8" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <path d="M28 22 20 38l7-3 3 5 2-17zM36 22l8 16-7-3-3 5-2-17z" fill="var(--h2)" stroke="#241e1a" strokeWidth="2" strokeLinejoin="round" />
            <rect x="26" y="14" width="12" height="11" rx="4" fill="var(--h2)" stroke="#241e1a" strokeWidth="2.4" />
          </svg>
          <span className="ah-tag" aria-hidden>Nhận tại lớp</span>
          <span className="ah-shine" aria-hidden />
        </>
      ) : (
        <>
          <span className="ah-notch l" aria-hidden />
          <span className="ah-notch r" aria-hidden />
          <span className="ah-tear" aria-hidden />
          <span className="ah-stub" aria-hidden>VÉ</span>
          {limit ? <span className="ah-chip-in bl">{limit} lần / tháng</span> : null}
        </>
      )}
      <V2Art index={rewardArtV2(title, kind)} className={cn("relative h-[74%]", kind === "PHYSICAL" && "ah-gift-item")} />
      {low && <span className={cn("ah-chip-in low", kind === "PHYSICAL" ? "br" : "tr")}>Sắp hết!</span>}
    </span>
  );
}
