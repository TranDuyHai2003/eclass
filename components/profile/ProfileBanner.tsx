import type { AvatarConfig } from "@/lib/game/avatar";
import { IconEye } from "@/components/studio/icons";
import { cn } from "@/lib/utils";
import { FrameRing } from "./FrameRing";
import { FrameCut, faceBoxStyle, hasCutFrame } from "@/components/studio/CutArt";
import { ShowcaseStage } from "./ShowcaseStage";

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
      <ShowcaseStage
        config={config}
        name={name}
        className="h-[196px] rounded-t-[20px]"
        chibiSize={showAvatar ? 118 : 132}
        petSize={72}
        contentClassName={showAvatar ? "pl-16 sm:pl-10" : undefined}
      >
        {previewing && (
          <span className="absolute left-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full bg-[#140e30]/70 px-2.5 py-1.5 text-xs font-semibold text-white" data-testid="previewing">
            <IconEye size={14} /> Đang xem trước
          </span>
        )}
      </ShowcaseStage>
      {showAvatar && <AvatarRing frameId={config.frame} image={image} name={name} className="absolute -bottom-10 left-3 h-[92px] w-[92px] sm:left-4" />}
    </div>
  );
}

/** Ảnh đại diện tròn + Khung viền (ảnh chiếm ~70% giữa vòng) */
export function AvatarRing({ frameId, image, name, className }: { frameId?: string | null; image?: string | null; name?: string | null; className?: string }) {
  const initial = (name?.trim()?.[0] ?? "H").toUpperCase();
  return (
    <div className={cn("relative", className)} data-testid="profile-avatar-ring">
      {/* Khung tranh vẽ tay: mặt đặt đúng lỗ giữa từng khung (trước inset 15% → khung đè mất mép ảnh) */}
      <div className={cn("absolute overflow-hidden rounded-full bg-[#5B2BD6]", hasCutFrame(frameId) ? "" : "ring-4 ring-white")} style={faceBoxStyle(frameId, 15)}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-white">{initial}</span>
        )}
      </div>
      {hasCutFrame(frameId) ? <FrameCut id={frameId} /> : <FrameRing frameId={frameId} className="absolute inset-0 h-full w-full" />}
    </div>
  );
}
