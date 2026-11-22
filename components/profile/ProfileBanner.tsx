import type { AvatarConfig } from "@/lib/game/avatar";
import { ITEM_BY_ID } from "@/lib/game/items";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { cn } from "@/lib/utils";
import { ProfileScene } from "./ProfileScene";
import { EffectLayer } from "./EffectLayer";
import { FrameRing } from "./FrameRing";

/**
 * Banner hồ sơ dùng chung (trang /profile và hồ sơ công khai): cảnh Hình nền + Hiệu ứng động + nhân vật + thú cưng,
 * kèm ảnh đại diện tròn có Khung viền đè mép dưới. KHÔNG chứa email / nút đăng xuất (thông tin riêng ở ngoài).
 */
export function ProfileBanner({
  config, image, name, className, showAvatar = true,
}: {
  config: AvatarConfig;
  image?: string | null;
  name?: string | null;
  className?: string;
  showAvatar?: boolean;
}) {
  const initial = (name?.trim()?.[0] ?? "H").toUpperCase();
  return (
    <div className={cn("relative", className)} data-testid="profile-banner" data-bg={config.background ?? ""} data-effect-id={config.effect ?? ""}>
      <div className="relative h-44 overflow-hidden rounded-t-3xl sm:h-48">
        <ProfileScene bgId={config.background} className="absolute inset-0" />
        <EffectLayer effectId={config.effect} />
        <div className="absolute inset-x-0 bottom-1 flex items-end justify-center gap-1 pl-16 sm:pl-10">
          <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={118} className="animate-float drop-shadow-[0_6px_8px_rgba(15,23,42,0.25)]" title={name ?? undefined} />
          {config.pet && (
            <span className="mb-1 shrink-0" title={ITEM_BY_ID[config.pet]?.name}>
              <PetSvg itemId={config.pet} size={58} className="drop-shadow-[0_4px_6px_rgba(15,23,42,0.25)]" />
            </span>
          )}
        </div>
      </div>
      {showAvatar && (
        <div className="absolute -bottom-10 left-3 h-[92px] w-[92px] sm:left-4" data-testid="profile-avatar-ring">
          <div className="absolute inset-[14px] overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-blue-600 ring-4 ring-white">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-black text-white">{initial}</span>
            )}
          </div>
          <FrameRing frameId={config.frame} className="absolute inset-0 h-full w-full" />
        </div>
      )}
    </div>
  );
}
