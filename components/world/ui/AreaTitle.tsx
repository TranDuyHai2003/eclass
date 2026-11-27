"use client";
/** Tên vùng khi đặt chân tới (kiểu game nhập vai): hai vạch mảnh + hình thoi, tên lớn, phụ đề ý tưởng toán học */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorld } from "../store";

export const TITLES: Record<string, { name: { en: string; vi: string }; sub: { en: string; vi: string } }> = {
  hub: { name: { en: "Plaza of Origins", vi: "Quảng trường Khởi nguyên" }, sub: { en: "Where every theorem began", vi: "Nơi mọi định lý bắt đầu" } },
  expanse: { name: { en: "Wonder Expanse", vi: "Vùng Kỳ quan" }, sub: { en: "An infinite world grown from functions and noise", vi: "Thế giới vô hạn mọc lên từ hàm số và nhiễu" } },
  impossible: { name: { en: "Impossible Halls", vi: "Sảnh Bất Khả" }, sub: { en: "Rooms bigger on the inside — space that bends", vi: "Căn phòng bên trong lớn hơn bên ngoài — không gian uốn cong" } },
  paradox: { name: { en: "Paradox Void", vi: "Hư Không Nghịch Lý" }, sub: { en: "Ten islands where common sense breaks.", vi: "Mười hòn đảo nơi lẽ thường gãy đổ." } },
  babel: { name: { en: "The Library of Babel", vi: "Thư viện Babel" }, sub: { en: "Every possible book. Every one of them, exactly once.", vi: "Mọi cuốn sách có thể có. Mỗi cuốn đúng một lần." } },
  siren: { name: { en: "Labyrinth of Harmonics", vi: "Mê cung Hoạ âm" }, sub: { en: "Every attack is a wave. Listen.", vi: "Mọi đòn đánh là một con sóng. Hãy lắng nghe." } },
  valley: { name: { en: "Function Valley", vi: "Thung lũng Hàm số" }, sub: { en: "Shape the curve, read the slope", vi: "Nặn đường cong, đọc độ dốc" } },
  study: { name: { en: "Study Together", vi: "Phòng Học cùng nhau" }, sub: { en: "Sit down, pick one goal, and focus — together.", vi: "Ngồi xuống, chọn một mục tiêu, cùng nhau tập trung." } },
};

export function AreaTitle({ title }: { title: { id: string; at: number } | null }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [show, setShow] = useState<string | null>(null);
  useEffect(() => {
    if (!title) return;
    setShow(title.id);
    const t = window.setTimeout(() => setShow(null), 3200);
    return () => window.clearTimeout(t);
  }, [title]);
  const d = show ? TITLES[show] : null;
  return (
    <AnimatePresence>
      {d && (
        <motion.div key={show} className="w-area" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.6 }}>
          <motion.i className="w-area__line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
          <span className="w-area__name">{d.name[lang]}</span>
          <span className="w-area__sub">{d.sub[lang]}</span>
          <motion.i className="w-area__line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
