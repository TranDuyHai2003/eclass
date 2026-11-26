import { cn } from "@/lib/utils";
import { CUT_FRAME_SCALE, CUT_PETS } from "@/lib/game/cut-art";
import { PetSvg } from "@/components/avatar/PetSvg";
import { ShopArt, shopItemIndex } from "./Sprite";

/**
 * Tranh vẽ tay đã tách nền (public/studio/cut/<id>.webp — sinh bởi scripts/studio/cut-item-art.py).
 * Thay cho cách cắt ô sprite bằng khung tròn / mặt nạ mờ (26/11: thầy báo tai mèo, đầu rồng bị cụt, mép nhoè,
 * Phượng hoàng dính ô nền hồng).
 */
export const hasCutFrame = (id?: string | null): id is string => !!id && id in CUT_FRAME_SCALE;
export const hasCutPet = (id?: string | null): id is string => !!id && CUT_PETS.has(id);
export const cutSrc = (id: string) => `/studio/cut/${id}.webp`;

/**
 * Khung viền tranh vẽ tay, phủ kín phần tử cha (relative, vuông). Lỗ giữa khung = 60% cạnh → mặt nhân vật đặt
 * inset ~21% nằm gọn trong lỗ. Trang trí thò ra ngoài (tai, đầu rồng) được vẽ tràn ra ngoài phần tử, không bị cắt.
 */
export function FrameCut({ id, className }: { id: string; className?: string }) {
  const k = CUT_FRAME_SCALE[id] ?? 1;
  const pad = ((k - 1) / 2) * 100;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ (≤ 30KB), nền trong suốt
    <img
      src={cutSrc(id)}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      data-frame-cut={id}
      className={cn("pointer-events-none absolute max-w-none select-none", className)}
      style={{ left: `-${pad}%`, top: `-${pad}%`, width: `${k * 100}%`, height: `${k * 100}%` }}
    />
  );
}

/** Ảnh thú cưng: tranh vẽ tay tách nền → ô tranh tiệm → SVG có khối. Giữ tỉ lệ, nằm gọn trong khung cha. */
export function PetImage({ id, className, size = 120 }: { id: string; className?: string; size?: number }) {
  if (hasCutPet(id))
    // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ, nền trong suốt
    return <img src={cutSrc(id)} alt="" aria-hidden draggable={false} decoding="async" data-pet-cut={id} className={cn("aspect-square object-contain", className)} />;
  const idx = shopItemIndex(id);
  if (idx !== undefined) return <ShopArt index={idx} className={cn("aspect-square", className)} />;
  return <PetSvg itemId={id} size={size} className={className} />;
}
