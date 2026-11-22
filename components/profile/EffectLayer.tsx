import { ITEM_BY_ID } from "@/lib/game/items";
import { FxShape } from "@/components/avatar/Chibi";
import { cn } from "@/lib/utils";

/** Kiểu chuyển động của từng hiệu ứng */
const MOTION: Record<string, { anim: "fall" | "rise" | "twinkle" | "flutter" | "streak"; n: number; size: number }> = {
  sakura: { anim: "fall", n: 14, size: 14 },
  snow: { anim: "fall", n: 18, size: 12 },
  sparkle: { anim: "twinkle", n: 12, size: 16 },
  bubble: { anim: "rise", n: 10, size: 20 },
  flame: { anim: "rise", n: 12, size: 16 },
  butterfly: { anim: "flutter", n: 6, size: 22 },
  meteor: { anim: "streak", n: 5, size: 22 },
  thunder: { anim: "twinkle", n: 6, size: 18 },
};

/**
 * Lớp hiệu ứng động trên banner hồ sơ (ô "effect"): hạt SVG chạy bằng CSS, `pointer-events:none`,
 * vị trí/độ trễ suy từ chỉ số (không ngẫu nhiên) → server/client khớp; `prefers-reduced-motion` thì đứng yên.
 */
export function EffectLayer({ effectId, className }: { effectId?: string | null; className?: string }) {
  const kind = effectId ? ITEM_BY_ID[effectId]?.v : undefined;
  const m = kind ? MOTION[kind] : undefined;
  if (!kind || !m) return null;
  return (
    <div aria-hidden className={cn("fx-layer", className)} data-effect={effectId}>
      {kind === "thunder" && <span className="fx-ring" />}
      {Array.from({ length: m.n }, (_, i) => (
        <span
          key={i}
          className={`fx-p fx-${m.anim}`}
          style={{
            left: `${(i * 37 + 9) % 96}%`,
            top: `${(i * 53 + 7) % 88}%`,
            ["--s" as string]: `${m.size * (0.7 + (i % 3) * 0.2)}px`,
            ["--d" as string]: `${6 + (i % 4) * 1.5}s`,
            ["--dl" as string]: `${-i * 1.3}s`,
            ["--dx" as string]: `${(i % 2 ? 1 : -1) * (12 + (i % 5) * 6)}px`,
          }}
        >
          <svg viewBox="-10 -10 20 20"><FxShape kind={kind} i={i} /></svg>
        </span>
      ))}
    </div>
  );
}
