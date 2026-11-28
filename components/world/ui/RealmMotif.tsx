"use client";
/**
 * Hoạ tiết nét mảnh cho thẻ chương mỗi thế giới (SVG — tự "vẽ nét" khi hiện): một ý toán học nhận ra ngay.
 * Chủ đề toán (TOPIC) hiện thành dòng nhỏ phía trên tên thế giới.
 */
import { motion } from "motion/react";
import type { L } from "@/lib/world/i18n";

export const TOPIC: Record<string, L> = {
  hub: { en: "Calculus · area under a curve", vi: "Giải tích · diện tích dưới đường cong" },
  expanse: { en: "Noise functions · procedural worlds", vi: "Hàm nhiễu · thế giới sinh thủ tục" },
  impossible: { en: "Geometry · the fourth dimension", vi: "Hình học · chiều thứ tư" },
  paradox: { en: "Logic · paradoxes", vi: "Logic · nghịch lý" },
  babel: { en: "Combinatorics · counting the infinite", vi: "Tổ hợp · đếm cái vô hạn" },
  siren: { en: "Waves · Fourier series", vi: "Sóng · chuỗi Fourier" },
  valley: { en: "Functions · derivatives", vi: "Hàm số · đạo hàm" },
  study: { en: "Focus · together", vi: "Tập trung · cùng nhau" },
  vault: { en: "Proof · lemmas", vi: "Chứng minh · bổ đề" },
  bazaar: { en: "Probability · expected value", vi: "Xác suất · kỳ vọng" },
  coast: { en: "Trigonometry · superposition", vi: "Lượng giác · chồng chất sóng" },
  torus: { en: "Topology · the torus", vi: "Tô pô · mặt xuyến" },
  archive: { en: "Graphs · connectivity of an endless maze", vi: "Đồ thị · tính liên thông của mê cung vô tận" },
};

/** đường nét (viewBox 0 0 100 100), vẽ lần lượt */
const PATHS: Record<string, string[]> = {
  hub: ["M12 86 H92", "M14 90 V12", "M14 66 C32 22 58 18 90 52", "M22 86 V52 H34 V86 M34 86 V38 H46 V86 M46 86 V30 H58 V86 M58 86 V34 H70 V86 M70 86 V44 H82 V86"],
  expanse: ["M50 10 L86 30 L86 70 L50 90 L14 70 L14 30 Z", "M14 30 L50 50 L86 30", "M50 50 V90", "M32 20 L68 40 M68 20 L32 40"],
  impossible: ["M32 32 H68 V68 H32 Z", "M14 14 H86 V86 H14 Z", "M14 14 L32 32 M86 14 L68 32 M86 86 L68 68 M14 86 L32 68"],
  paradox: ["M50 50 C36 26 10 30 10 50 C10 70 36 74 50 50 C64 26 90 30 90 50 C90 70 64 74 50 50"],
  babel: ["M50 8 L86 29 L86 71 L50 92 L14 71 L14 29 Z", "M50 26 L70 38 L70 62 L50 74 L30 62 L30 38 Z", "M50 8 V26 M86 29 L70 38 M86 71 L70 62 M50 92 V74 M14 71 L30 62 M14 29 L30 38"],
  siren: ["M6 50 C14 22 22 22 30 50 S46 78 54 50 S70 22 78 50 S94 78 98 50", "M6 76 H20 V58 H40 V76 H60 V58 H80 V76 H96"],
  valley: ["M10 18 Q50 118 90 18", "M14 78 L86 46"],
  study: ["M50 30 C38 22 20 22 10 26 V80 C20 76 38 76 50 84 C62 76 80 76 90 80 V26 C80 22 62 22 50 30 Z", "M50 30 V84"],
  vault: ["M50 10 A40 40 0 1 1 49.9 10", "M38 38 H62 V62 H38 Z"],
  bazaar: ["M22 22 H78 V78 H22 Z", "M36 36 h0.1 M64 36 h0.1 M50 50 h0.1 M36 64 h0.1 M64 64 h0.1"],
  coast: ["M6 40 C16 24 26 24 36 40 S56 56 66 40 S86 24 96 40", "M6 64 C12 56 18 56 24 64 S36 72 42 64 S54 56 60 64 S72 72 78 64 S90 56 96 64"],
  archive: ["M14 14 H86 V86 H14 Z", "M38 14 V86 M62 14 V86 M14 38 H86 M14 62 H86", "M20 22 V32 M26 22 V32 M44 46 V56 M50 46 V56 M68 70 V80 M74 70 V80"],
  torus: ["M8 50 C8 26 92 26 92 50 C92 74 8 74 8 50 Z", "M32 50 C40 42 60 42 68 50", "M28 46 C38 58 62 58 72 46"],
};

export function RealmMotif({ id, reduced }: { id: string; reduced: boolean }) {
  const paths = PATHS[id] ?? ["M50 10 A40 40 0 1 1 49.9 10"];
  return (
    <svg className="w-chap__motif" viewBox="0 0 100 100" aria-hidden>
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          initial={reduced ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
          transition={{ duration: reduced ? 0.3 : 1.1, delay: reduced ? 0 : 0.15 + i * 0.22, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}
