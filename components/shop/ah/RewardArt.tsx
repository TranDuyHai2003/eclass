import { cn } from "@/lib/utils";
import { V2Art, rewardArtV2 } from "@/components/studio/Sprite";
import { isTissueReward } from "@/lib/game/quests-shared";

/** Gói khăn giấy hoạt hình (quà "Túi giấy ăn" — mở nhiệm vụ ẩn "Người Mở Đường Khăn Giấy"): canvas không có tranh này */
export function TissueArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("block aspect-square", className)} role="presentation" data-art-tissue>
      <defs>
        <linearGradient id="tis-pack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbcfe8" /><stop offset="100%" stopColor="#f472b6" /></linearGradient>
      </defs>
      <ellipse cx="50" cy="90" rx="32" ry="4" fill="#241e1a" opacity="0.12" />
      {/* tờ giấy nhô lên */}
      <path d="M38 40c-4-10 2-20 8-22 2 6 6 6 8 0 6 2 12 12 8 22z" fill="#fff" stroke="#241e1a" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M46 24c1 4 0 8-2 12M56 24c0 4 1 8 3 12" fill="none" stroke="#e2e8f0" strokeWidth="1.6" strokeLinecap="round" />
      {/* gói giấy */}
      <rect x="14" y="38" width="72" height="48" rx="14" fill="url(#tis-pack)" stroke="#241e1a" strokeWidth="2.6" />
      <path d="M36 42h28" stroke="#241e1a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 46c2-3 6-4 10-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      {/* mặt mèo in trên gói */}
      <g transform="translate(50 66)" stroke="#241e1a" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M-14-6l2-10 7 5zM14-6l-2-10-7 5z" fill="#fffdf8" />
        <ellipse rx="15" ry="12" fill="#fffdf8" />
        <circle cx="-6" cy="-1" r="2" fill="#241e1a" stroke="none" /><circle cx="6" cy="-1" r="2" fill="#241e1a" stroke="none" />
        <circle cx="-5.3" cy="-1.7" r="0.7" fill="#fff" stroke="none" /><circle cx="6.7" cy="-1.7" r="0.7" fill="#fff" stroke="none" />
        <path d="M-2 3.5c1 1.4 3 1.4 4 0" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="-10" cy="4" rx="2.6" ry="1.6" fill="#fb7185" stroke="none" opacity="0.6" /><ellipse cx="10" cy="4" rx="2.6" ry="1.6" fill="#fb7185" stroke="none" opacity="0.6" />
      </g>
      {/* tim nhỏ */}
      <path d="M77 52c-3-2-5-3.5-5-5.3 0-1.3 1-2.2 2.2-2.2.9 0 1.8.5 2.8 1.4 1-.9 1.9-1.4 2.8-1.4 1.2 0 2.2.9 2.2 2.2 0 1.8-2 3.3-5 5.3z" fill="#fff" stroke="#241e1a" strokeWidth="1.2" />
      <path d="M22 80l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#fde68a" stroke="#241e1a" strokeWidth="0.8" />
    </svg>
  );
}

/** Tranh của một quà thầy tạo: ảnh admin đăng → tranh riêng (khăn giấy) → ô tranh v2 theo từ khoá */
export function RewardPic({ title, kind, imageUrl, className }: { title: string; kind: "PHYSICAL" | "VIRTUAL"; imageUrl?: string | null; className?: string }) {
  if (imageUrl)
    // eslint-disable-next-line @next/next/no-img-element -- ảnh trên CDN của web (đã cắt vuông, ≤ 800px), không qua tối ưu ảnh của Next
    return <img src={imageUrl} alt="" loading="lazy" decoding="async" draggable={false} data-reward-img className={cn("ah-rimg", className)} />;
  if (kind === "PHYSICAL" && isTissueReward(title)) return <TissueArt className={className} />;
  return <V2Art index={rewardArtV2(title, kind)} className={className} />;
}

/**
 * Khung ảnh của một quà thầy tạo: quà hiện vật = hộp quà (ruy băng + nơ, "Nhận tại lớp", "Sắp hết" khi còn ≤ 3),
 * thẻ đặc quyền = tấm vé (khuyết hai bên, đường xé, cuống "VÉ", giới hạn mỗi tháng). Dùng ở lưới tiệm và khu quản lý quà.
 */
export function RewardArt({ title, kind, imageUrl, stock, limit, className, children }: {
  title: string;
  kind: "PHYSICAL" | "VIRTUAL";
  imageUrl?: string | null;
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
      <RewardPic title={title} kind={kind} imageUrl={imageUrl} className={cn("relative h-[74%]", kind === "PHYSICAL" && "ah-gift-item")} />
      {low && <span className={cn("ah-chip-in low", kind === "PHYSICAL" ? "br" : "tr")}>Sắp hết!</span>}
    </span>
  );
}
