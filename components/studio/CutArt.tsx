import { cn } from "@/lib/utils";
import { CUT_FRAME_FACE, CUT_FRAME_SCALE, CUT_PETS } from "@/lib/game/cut-art";
import { SVG_FRAME_FACE } from "@/lib/game/frame-face";
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

/**
 * Chỗ đặt mặt nhân vật trong khung (28/11: thầy báo khung lệch, khuất góc — lỗ giữa nhiều khung không tròn đều:
 * tai mèo có chân thò vào, trăng khuyết lệch, hoa anh đào bông to). Khung tranh vẽ tay → vị trí riêng từng khung
 * (CUT_FRAME_FACE, script tính); khung SVG → SVG_FRAME_FACE (đo 28/11); khung lạ → inset mặc định (% cạnh).
 */
export function faceBoxStyle(frameId?: string | null, fallbackInsetPct = 21): React.CSSProperties {
  const f = frameId ? (CUT_FRAME_FACE[frameId] ?? SVG_FRAME_FACE[frameId]) : undefined;
  if (!f) return { inset: `${fallbackInsetPct}%` };
  const [r, dx, dy] = f;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return { left: pct(0.5 + dx - r), top: pct(0.5 + dy - r), width: pct(2 * r), height: pct(2 * r) };
}

/** Ảnh thú cưng: tranh vẽ tay tách nền → ô tranh tiệm → SVG có khối. Giữ tỉ lệ, nằm gọn trong khung cha. */
export function PetImage({ id, className, size = 120, style }: { id: string; className?: string; size?: number; style?: React.CSSProperties }) {
  if (hasCutPet(id))
    // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ, nền trong suốt
    return <img src={cutSrc(id)} alt="" aria-hidden draggable={false} decoding="async" data-pet-cut={id} className={cn("aspect-square object-contain", className)} style={style} />;
  const idx = shopItemIndex(id);
  if (idx !== undefined) return <span className="block" style={style}><ShopArt index={idx} className={cn("aspect-square h-full w-full", className)} /></span>;
  return <span className="block" style={style}><PetSvg itemId={id} size={size} className={cn("h-full w-full", className)} /></span>;
}

/** Khung có chỗ đặt mặt riêng (tranh vẽ tay hoặc SVG đã đo) */
export const hasFaceSpot = (frameId?: string | null) => !!frameId && (frameId in CUT_FRAME_FACE || frameId in SVG_FRAME_FACE);
