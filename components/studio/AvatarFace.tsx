import type { AvatarConfig } from "@/lib/game/avatar";
import { paintedLook, presetIndexOf } from "@/lib/game/presets";
import { Chibi } from "@/components/avatar/Chibi";
import { cn } from "@/lib/utils";
import { faceStyle } from "./Sprite";

/**
 * Khuôn mặt nhân vật trong vòng ảnh đại diện (canvas: hồ sơ, thẻ cấp độ, Bảng Vàng).
 * Trùng mẫu → cắt mặt từ tranh của design; đổi màu tóc/mắt trên tranh hoặc tự chỉnh khác mẫu → phóng to phần đầu nhân vật.
 */
export function AvatarFace({ config, className, bg = "#fffdf8", title }: { config: AvatarConfig; className?: string; bg?: string; title?: string }) {
  const idx = presetIndexOf(config);
  // Đầu của tranh mẫu nằm thấp hơn và to hơn đầu nhân vật SVG
  const zoom = paintedLook(config) ? "scale(1.75) translateY(13%)" : "scale(1.9) translateY(18%)";
  return (
    <span role="img" aria-label={title ?? "Avatar nhân vật"} data-testid="avatar-face" data-preset={idx} className={cn("block overflow-hidden rounded-full", className)} style={idx >= 0 ? { backgroundColor: bg, ...faceStyle(idx) } : { backgroundColor: bg }}>
      {idx < 0 && (
        <span className="block h-full w-full" style={{ transform: zoom }}>
          <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={64} className="h-full w-full" />
        </span>
      )}
    </span>
  );
}
