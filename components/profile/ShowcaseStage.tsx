import type { AvatarConfig } from "@/lib/game/avatar";
import { ITEM_BY_ID } from "@/lib/game/items";
import { Chibi } from "@/components/avatar/Chibi";
import { cn } from "@/lib/utils";
import { ProfileScene } from "./ProfileScene";
import { EffectLayer } from "./EffectLayer";
import { Sprite, hasSprite } from "@/components/studio/Sprite";
import { PetImage } from "@/components/studio/CutArt";

/**
 * "Sân khấu" khoe đồ trang trí: Hình nền + Hiệu ứng động + nhân vật cả người + thú cưng.
 * Dùng chung cho banner Hồ sơ, khối hồ sơ trong Tiệm quà và từng bạn trên Bảng Vàng
 * (28/11: thầy muốn lên Bảng Vàng / Tiệm quà là khoe được hết như ở Hồ sơ, không chỉ mặt + khung).
 */
export function ShowcaseStage({
  config, name, className, chibiSize = 132, petSize = 72, align = "center", sceneMinW = 322, children, contentClassName,
}: {
  config: AvatarConfig;
  name?: string | null;
  className?: string;
  /** Bề rộng nhân vật (px) */
  chibiSize?: number;
  /** Cạnh ảnh thú cưng (px) */
  petSize?: number;
  align?: "center" | "right" | "left";
  /** Bề rộng tối thiểu của ảnh cảnh (tỉ lệ 112:62) để phủ kín chiều cao sân khấu */
  sceneMinW?: number;
  /** Lớp phủ thêm (huy hiệu, thông tin) */
  children?: React.ReactNode;
  /** Lớp của hàng nhân vật + thú cưng (vd chừa chỗ ảnh đại diện) */
  contentClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)} data-testid="showcase-stage" data-bg={config.background ?? ""} data-pet={config.pet ?? ""} data-effect-id={config.effect ?? ""}>
      {config.background && hasSprite(config.background) ? (
        // Ảnh cảnh của canvas thiết kế: giữ tỉ lệ ô 112:62, phủ kín (cắt trên/dưới), không kéo méo
        <span className="absolute inset-0 overflow-hidden" data-scene={config.background}>
          <Sprite id={config.background} className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2" style={{ minWidth: sceneMinW }} />
        </span>
      ) : (
        <ProfileScene bgId={config.background} className="absolute inset-0" />
      )}
      <EffectLayer effectId={config.effect} />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-end gap-1",
          align === "right" ? "justify-end pr-2" : align === "left" ? "justify-start pl-2" : "justify-center",
          contentClassName,
        )}
      >
        <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={chibiSize} className="animate-float drop-shadow-[0_6px_8px_rgba(15,23,42,0.25)]" title={name ?? undefined} />
        {config.pet && (
          <span className="mb-1 shrink-0" title={ITEM_BY_ID[config.pet]?.name} data-testid="stage-pet">
            <PetImage id={config.pet} size={Math.round(petSize * 0.8)} className="drop-shadow-[0_4px_6px_rgba(15,23,42,0.25)]" style={{ width: petSize, height: petSize }} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
