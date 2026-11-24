"use client";

import { cn } from "@/lib/utils";
import { CoinIcon, GemIcon } from "@/components/game/CurrencyIcons";
import { ITEM_BY_ID, type Item } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import type { Rarity } from "@/lib/points/rarity";
import { AvatarFace } from "@/components/studio/AvatarFace";
import { Nameplate } from "@/components/studio/Nameplate";
import { FrameRing } from "@/components/profile/FrameRing";
import { FrameFx } from "@/components/avatar/FrameFx";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { ShopArt, Sprite, V2Art, frameSpriteStyle, hasSprite, shopItemIndex, v2Index } from "@/components/studio/Sprite";

/* Mảnh giao diện dùng chung của Tiệm quà v2 "Adorable Home" (canvas ShopV2.dc.html) */

export const fmt = (n: number) => n.toLocaleString("vi-VN");

export const RAR_LABEL: Record<Rarity, string> = { common: "Phổ thông", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại" };

/** Đồng xu vàng (SVG vẽ tay: vành nổi, sao dập nổi, vệt bóng) — components/game/CurrencyIcons.tsx */
// Bỏ class viền (border-*) còn sót từ đồng xu kiểu cũ: gắn lên SVG thành ô vuông viền xám (thầy báo 24/11)
const noBorder = (c?: string) => c?.split(/\s+/).filter((x) => x && !/^border(-|$)/.test(x)).join(" ") || undefined;

export function CoinDot({ size = 20, className }: { size?: number; className?: string }) {
  return <CoinIcon size={Math.round(size * 1.12)} className={noBorder(className)} />;
}

/** Kim cương cắt giác (SVG) — cỡ cũ là ô vuông xoay 45° nên phóng ~1,5 lần cho cùng độ lớn nhìn thấy */
export function GemDot({ size = 15, className }: { size?: number; className?: string }) {
  return <GemIcon size={Math.round(size * 1.5)} className={noBorder(className)} />;
}

/** Khung viền phủ lên ảnh đại diện: tranh khung vẽ tay trong sprite đồ vật → vòng SVG nhiều lớp (FrameRing) */
export function FrameOverlay({ frameId }: { frameId?: string | null; size?: number }) {
  if (!frameId) return null;
  const st = frameSpriteStyle(frameId);
  if (st)
    return (
      <>
        <span aria-hidden className="absolute inset-0 rounded-full" style={st} />
        <FrameFx frameId={frameId} />
      </>
    );
  return <FrameRing frameId={frameId} className="absolute inset-0 h-full w-full" />;
}

/** Ảnh đại diện tròn: khuôn mặt nhân vật (nền kem) + khung viền đang đeo */
export function AvatarRing({ config, size, inset, title, className }: { config: AvatarConfig; size: number; inset: number; title?: string; className?: string }) {
  // Khung lấy từ ảnh ghép có nền sáng ở giữa → vẽ DƯỚI khuôn mặt (không phủ mờ mặt), hiệu ứng vẫn ở trên
  const under = config.frame ? frameSpriteStyle(config.frame) : undefined;
  return (
    <span className={cn("relative block shrink-0", className)} style={{ width: size, height: size }} data-testid="avatar-ring">
      {under && <span aria-hidden className="absolute inset-0 rounded-full" style={under} />}
      <span className="absolute" style={{ inset }}>
        <AvatarFace config={config} title={title} className="h-full w-full" bg="#fffdf8" />
      </span>
      {under ? <FrameFx frameId={config.frame} /> : <FrameOverlay frameId={config.frame} size={size} />}
    </span>
  );
}

/** Khối bảng tên kiểu canvas: viền mực dày, bo 20, bóng đặc; chưa có bảng tên → nền kem */
export function PlateBox({ id, className, children, testId }: { id?: string | null; className?: string; children?: React.ReactNode; testId?: string }) {
  return (
    <Nameplate id={id} testId={testId} className={cn("rounded-[20px] border-[3px] border-[#241e1a] shadow-[0_4px_0_#241e1a]", !id && "bg-none bg-[#fff6db]", className)}>
      {children}
    </Nameplate>
  );
}

/** Tên ngắn (2 chữ cuối) để in lên bảng tên xem trước */
export const shortName = (name?: string | null) => (name || "Học sinh").trim().split(/\s+/).slice(-2).join(" ");

/** Ảnh một món trong khung "part" của thẻ (canvas: tranh v2 82% chiều cao; bảng tên = dải tên 90% bề rộng) */
export function ItemArt({ it, avatar, name, withFace }: { it: Item; avatar: AvatarConfig; name?: string | null; withFace?: boolean }) {
  if (it.slot === "nameplate")
    return (
      <Nameplate id={it.id} className="flex aspect-[420/100] w-[90%] items-center rounded-[12px] border-2 border-[#241e1a] px-3">
        <span className="ah-hand text-sm font-bold">{shortName(name)}</span>
      </Nameplate>
    );
  if (it.slot === "frame") {
    // Tranh khung vẽ tay có nền sáng ở giữa → vẽ DƯỚI khuôn mặt (như AvatarRing), hiệu ứng vẫn ở trên
    const under = withFace ? frameSpriteStyle(it.id) : undefined;
    return (
      <span className="relative block aspect-square h-[86%]">
        {under && <span aria-hidden className="absolute inset-0 rounded-full" style={under} />}
        {withFace && (
          <span className="absolute inset-[21%]">
            <AvatarFace config={avatar} className="h-full w-full" bg="#fffdf8" />
          </span>
        )}
        {under ? <FrameFx frameId={it.id} /> : <FrameOverlay frameId={it.id} />}
      </span>
    );
  }
  if (it.slot === "pet") return <PetPic id={it.id} className="relative h-[84%] w-auto" />;
  const v2 = v2Index(it.id);
  if (v2 !== undefined) return <V2Art index={v2} className="relative h-[82%]" />;
  const idx = shopItemIndex(it.id);
  if (idx !== undefined) return <ShopArt index={idx} className="relative h-[86%]" />;
  if (hasSprite(it.id)) return <Sprite id={it.id} className="relative w-[78%] rounded-lg" />;
  if (it.slot === "title") return <span className="ah-ink relative rounded-full bg-[#2A1F5C] px-3 py-1.5 text-center text-xs font-extrabold text-[#FDE68A]">{it.name}</span>;
  const chibi = <Chibi config={{ ...avatar, background: null, effect: null, [it.slot]: it.id }} size={120} className="relative h-full w-auto" />;
  // Món ở đầu (tóc, mắt, phụ kiện): phóng to phần đầu — trước đây cả người nhỏ xíu, khó thấy món đang bán
  if (it.slot === "hair" || it.slot === "hairColor" || it.slot === "eyes" || it.slot === "accessory")
    return <span className="relative flex h-[118%] translate-y-[14%] items-start justify-center">{chibi}</span>;
  return (
    <span className="relative flex h-[90%] flex-col items-center justify-end">
      {chibi}
      <span aria-hidden className="-mt-[6%] h-[7%] w-[46%] rounded-[50%] bg-[#241e1a] opacity-[0.12]" />
    </span>
  );
}

/** Ảnh thú cưng: tranh vẽ tay của tiệm → ô sprite đồ vật (bo góc) → SVG có khối */
export function PetPic({ id, className }: { id: string; className?: string }) {
  const idx = shopItemIndex(id);
  if (idx !== undefined) return <ShopArt index={idx} className={cn("aspect-square", className)} />;
  if (hasSprite(id)) return <Sprite id={id} className={cn(className, "h-auto w-[80%] rounded-lg")} />;
  return <PetSvg itemId={id} size={120} className={className} />;
}

export const itemById = (id?: string | null) => (id ? ITEM_BY_ID[id] : undefined);

/** Ô mặc được ngay từ tiệm (không cần trình tuỳ chỉnh) */
export const QUICK_EQUIP: Item["slot"][] = ["frame", "background", "title", "accessory", "pet", "effect", "nameplate"];
