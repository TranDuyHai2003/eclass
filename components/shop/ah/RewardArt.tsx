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
          <span className="ah-gift-bow" aria-hidden>🎀</span>
          <span className="ah-chip-in bl">Nhận tại lớp</span>
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
      <V2Art index={rewardArtV2(title, kind)} className="relative h-[78%]" />
      {low && <span className="ah-chip-in tr">Sắp hết!</span>}
    </span>
  );
}
