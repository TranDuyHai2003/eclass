import type { AvatarConfig } from "@/lib/game/avatar";
import { ITEM_BY_ID } from "@/lib/game/items";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileScene } from "./ProfileScene";
import { EffectLayer } from "./EffectLayer";
import { FrameRing } from "./FrameRing";

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
      <div className="relative h-[178px] overflow-hidden rounded-t-[20px]">
        <ProfileScene bgId={config.background} className="absolute inset-0" />
        <EffectLayer effectId={config.effect} />
        {previewing && (
          <span className="absolute left-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full bg-[#140e30]/70 px-2.5 py-1.5 text-xs font-semibold text-white" data-testid="previewing">
            <Eye className="h-3.5 w-3.5" aria-hidden /> Đang xem trước
          </span>
        )}
        <div className="absolute inset-x-0 bottom-1 flex items-end justify-center gap-1 pl-16 sm:pl-10">
          <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={118} className="animate-float drop-shadow-[0_6px_8px_rgba(15,23,42,0.25)]" title={name ?? undefined} />
          {config.pet && (
            <span className="mb-1 shrink-0" title={ITEM_BY_ID[config.pet]?.name}>
              <PetSvg itemId={config.pet} size={58} className="drop-shadow-[0_4px_6px_rgba(15,23,42,0.25)]" />
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
