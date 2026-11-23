import type { AvatarConfig } from "@/lib/game/avatar";
import { presetIndexOf } from "@/lib/game/presets";
import { Chibi } from "@/components/avatar/Chibi";
import { cn } from "@/lib/utils";
import { faceStyle } from "./Sprite";

/**
 * Khuôn mặt nhân vật trong vòng ảnh đại diện (canvas: hồ sơ, thẻ cấp độ, Bảng Vàng).
 * Trùng mẫu → cắt mặt từ tranh của design; tự chỉnh khác mẫu → phóng to phần đầu nhân vật SVG.
 */
export function AvatarFace({ config, className, bg = "#fffdf8", title }: { config: AvatarConfig; className?: string; bg?: string; title?: string }) {
  const idx = presetIndexOf(config);
  return (
    <span role="img" aria-label={title ?? "Avatar nhân vật"} data-testid="avatar-face" data-preset={idx} className={cn("block overflow-hidden rounded-full", className)} style={idx >= 0 ? { backgroundColor: bg, ...faceStyle(idx) } : { backgroundColor: bg }}>
      {idx < 0 && (
        <span className="block h-full w-full" style={{ transform: "scale(1.9) translateY(18%)" }}>
          <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={64} className="h-full w-full" painted={false} />
        </span>
      )}
    </span>
  );
}
