"use client";

import { cn } from "@/lib/utils";
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

/** Đồng xu vàng viền mực (đúng hình tròn trong canvas) */
export function CoinDot({ size = 20, className }: { size?: number; className?: string }) {
  // Đồng xu có điểm sáng + viền trong → vẫn nổi trên nút vàng (trước đây cùng màu nút nên trông như vòng rỗng)
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 rounded-full border-[2.2px] border-[#241e1a]", className)}
      style={{ width: size, height: size, background: "radial-gradient(circle at 34% 30%, #fff7cf 0 16%, #ffd84d 17% 58%, #e9a21c 100%)", boxShadow: "inset 0 0 0 1.5px rgba(255,247,207,0.55)" }}
    />
  );
}

/** Kim cương: ô vuông xoay 45° màu xanh trời */
export function GemDot({ size = 15, className }: { size?: number; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rotate-45 rounded-[3px] border-[2.2px] border-[#241e1a] bg-[#6acbf7]", className)} style={{ width: size, height: size }} />;
}

/** Khung viền phủ lên ảnh đại diện: tranh v2 → tranh khung cũ trong sprite → vòng SVG */
export function FrameOverlay({ frameId, size }: { frameId?: string | null; size: number }) {
  if (!frameId) return null;
  const i = v2Index(frameId);
  if (i !== undefined)
    return (
      <>
        <V2Art index={i} className="absolute inset-0 h-full w-full" />
        <FrameFx frameId={frameId} />
      </>
    );
  const st = frameSpriteStyle(frameId, size);
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
  return (
    <span className={cn("relative block shrink-0", className)} style={{ width: size, height: size }} data-testid="avatar-ring">
      <span className="absolute" style={{ inset }}>
        <AvatarFace config={config} title={title} className="h-full w-full" bg="#fffdf8" />
      </span>
      <FrameOverlay frameId={config.frame} size={size} />
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
  if (it.slot === "frame")
    return (
      <span className="relative block aspect-square h-[86%]">
        {withFace && (
          <span className="absolute inset-[21%]">
            <AvatarFace config={avatar} className="h-full w-full" bg="#fffdf8" />
          </span>
        )}
        <FrameOverlay frameId={it.id} size={120} />
      </span>
    );
  const v2 = v2Index(it.id);
  if (v2 !== undefined) return <V2Art index={v2} className="relative h-[82%]" />;
  const idx = shopItemIndex(it.id);
  if (idx !== undefined) return <ShopArt index={idx} className="relative h-[86%]" />;
  if (hasSprite(it.id)) return <Sprite id={it.id} className="relative w-[78%] rounded-lg" />;
  if (it.slot === "pet") return <PetSvg itemId={it.id} size={120} className="relative h-[82%] w-auto" />;
  if (it.slot === "title") return <span className="ah-ink relative rounded-full bg-[#2A1F5C] px-3 py-1.5 text-center text-xs font-extrabold text-[#FDE68A]">{it.name}</span>;
  return <Chibi config={{ ...avatar, background: null, effect: null, [it.slot]: it.id }} size={120} className="relative h-[86%] w-auto" />;
}

export const itemById = (id?: string | null) => (id ? ITEM_BY_ID[id] : undefined);

/** Ô mặc được ngay từ tiệm (không cần trình tuỳ chỉnh) */
export const QUICK_EQUIP: Item["slot"][] = ["frame", "background", "title", "accessory", "pet", "effect", "nameplate"];
