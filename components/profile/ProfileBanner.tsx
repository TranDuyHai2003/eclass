import type { AvatarConfig } from "@/lib/game/avatar";
import { ITEM_BY_ID } from "@/lib/game/items";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { IconEye } from "@/components/studio/icons";
import { cn } from "@/lib/utils";
import { ProfileScene } from "./ProfileScene";
import { EffectLayer } from "./EffectLayer";
import { FrameRing } from "./FrameRing";
import { ShopArt, Sprite, hasSprite, shopItemIndex } from "@/components/studio/Sprite";

/**
 * Banner hồ sơ dùng chung (trang /profile và hồ sơ công khai): cảnh Hình nền + Hiệu ứng động + nhân vật + thú cưng,
 * kèm ảnh đại diện tròn có Khung viền đè mép dưới. KHÔNG chứa email / nút đăng xuất (thông tin riêng ở ngoài).
 */
export function ProfileBanner({
  config, image, name, className, showAvatar = true, previewing = false,
}: {
  config: AvatarConfig;
  image?: string | null;
  name?: string | null;
  className?: string;
  showAvatar?: boolean;
  /** Huy hiệu "Đang xem trước" khi có thay đổi chưa lưu */
  previewing?: boolean;
}) {
  return (
    <div className={cn("relative", className)} data-testid="profile-banner" data-bg={config.background ?? ""} data-effect-id={config.effect ?? ""}>
      <div className="relative h-[196px] overflow-hidden rounded-t-[20px]">
        {config.background && hasSprite(config.background) ? (
          // Ảnh cảnh của canvas thiết kế: giữ tỉ lệ ô 112:62, phủ kín banner (cắt trên/dưới), không kéo méo
          <span className="absolute inset-0 overflow-hidden" data-scene={config.background}>
            <Sprite id={config.background} className="absolute left-1/2 top-1/2 w-full min-w-[322px] -translate-x-1/2 -translate-y-1/2" />
          </span>
        ) : (
          <ProfileScene bgId={config.background} className="absolute inset-0" />
        )}
        <EffectLayer effectId={config.effect} />
        {previewing && (
          <span className="absolute left-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full bg-[#140e30]/70 px-2.5 py-1.5 text-xs font-semibold text-white" data-testid="previewing">
            <IconEye size={14} /> Đang xem trước
          </span>
        )}
        <div className={cn("absolute inset-x-0 bottom-0 flex items-end justify-center gap-1", showAvatar && "pl-16 sm:pl-10")}>
          <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={showAvatar ? 118 : 132} className="animate-float drop-shadow-[0_6px_8px_rgba(15,23,42,0.25)]" title={name ?? undefined} />
          {config.pet && (
            <span className="mb-1 shrink-0" title={ITEM_BY_ID[config.pet]?.name}>
              {hasSprite(config.pet) ? (
                <Sprite id={config.pet} className="w-[78px] rounded-xl [mask-image:radial-gradient(closest-side,#000_70%,transparent_100%)]" />
              ) : shopItemIndex(config.pet) !== undefined ? (
                <ShopArt index={shopItemIndex(config.pet)!} className="w-[72px]" />
              ) : (
                <PetSvg itemId={config.pet} size={58} className="drop-shadow-[0_4px_6px_rgba(15,23,42,0.25)]" />
              )}
            </span>
          )}
        </div>
      </div>
      {showAvatar && <AvatarRing frameId={config.frame} image={image} name={name} className="absolute -bottom-10 left-3 h-[92px] w-[92px] sm:left-4" />}
    </div>
  );
}

/** Ảnh đại diện tròn + Khung viền (ảnh chiếm ~70% giữa vòng) */
export function AvatarRing({ frameId, image, name, className }: { frameId?: string | null; image?: string | null; name?: string | null; className?: string }) {
  const initial = (name?.trim()?.[0] ?? "H").toUpperCase();
  return (
    <div className={cn("relative", className)} data-testid="profile-avatar-ring">
      <div className="absolute inset-[15%] overflow-hidden rounded-full bg-[#5B2BD6] ring-4 ring-white">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-white">{initial}</span>
        )}
      </div>
      <FrameRing frameId={frameId} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
