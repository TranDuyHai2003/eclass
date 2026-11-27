import type { DiscoveryId } from "./kcs";
import type { L } from "./i18n";

/**
 * Official title + statement of each discovery — import ONLY from the server (lib/world/service.ts).
 * Sent to the client only after the student has confirmed the discovery (name the theorem AFTER the "aha").
 * Do NOT import this file from client components.
 */
export const DISCOVERY_REVEALS: Record<DiscoveryId, { title: L; statement: L }> = {
  D_STILLPOINT: {
    title: { en: "Still point: f′(x₀) = 0", vi: "Điểm dừng: f′(x₀) = 0" },
    statement: {
      en: "At a local maximum or minimum of a smooth curve the tangent is horizontal — the derivative is zero.",
      vi: "Tại điểm cực đại hay cực tiểu của một đường cong trơn, tiếp tuyến nằm ngang — đạo hàm bằng 0.",
    },
  },
  D_SLOPE_SIGN: {
    title: { en: "The sign of the derivative", vi: "Dấu của đạo hàm" },
    statement: {
      en: "f′(x) > 0 on an interval ⇒ f is increasing there; f′(x) < 0 ⇒ f is decreasing.",
      vi: "f′(x) > 0 trên một khoảng ⇒ f đồng biến trên khoảng đó; f′(x) < 0 ⇒ f nghịch biến.",
    },
  },
  D_FLAT_NOT_PEAK: {
    title: { en: "f′ = 0 is not always an extremum", vi: "f′ = 0 chưa chắc là cực trị" },
    statement: {
      en: "An extremum needs f′ to CHANGE SIGN at x₀. If f′ = 0 without changing sign (like x³ at 0), there is no extremum.",
      vi: "Cực trị chỉ có khi f′ ĐỔI DẤU khi đi qua x₀. Nếu f′ = 0 mà không đổi dấu (như x³ tại 0) thì không có cực trị.",
    },
  },
};
