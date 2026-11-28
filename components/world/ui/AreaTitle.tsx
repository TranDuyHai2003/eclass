"use client";
/**
 * Tên vùng khi đặt chân tới (kiểu game nhập vai) — hai dạng:
 *  • THẺ CHƯƠNG: lần đầu tới một thế giới trong phiên — hoạ tiết toán tự vẽ nét, chủ đề toán, tên lớn, phụ đề;
 *  • DẢI TÊN gọn (hai vạch mảnh + hình thoi): những lần sau.
 * Nối tiếp chuyển cảnh: chờ lỗ sâu bay xong và màn chờ tắt (useTransit) rồi mới hiện — không bị che sau màn chờ.
 * Không chặn thao tác (pointer-events: none); phím / chạm bất kỳ = bỏ qua. Tôn trọng "giảm chuyển động".
 */
import { useEffect, useState } from "react";
import type React from "react";
import { AnimatePresence, motion } from "motion/react";
import { prefersReducedMotion } from "@/lib/world/loadProgress";
import { useWorld } from "../store";
import { RealmMotif, TOPIC } from "./RealmMotif";
import { useTransit } from "./transit";
import { REALM_PALETTE } from "./WormholeTravel";
import "./interstitial.css";

export const TITLES: Record<string, { name: { en: string; vi: string }; sub: { en: string; vi: string } }> = {
  hub: { name: { en: "Plaza of Origins", vi: "Quảng trường Khởi nguyên" }, sub: { en: "Where every theorem began", vi: "Nơi mọi định lý bắt đầu" } },
  expanse: { name: { en: "Wonder Expanse", vi: "Vùng Kỳ quan" }, sub: { en: "An infinite world grown from functions and noise", vi: "Thế giới vô hạn mọc lên từ hàm số và nhiễu" } },
  impossible: { name: { en: "Impossible Halls", vi: "Sảnh Bất Khả" }, sub: { en: "Rooms bigger on the inside — space that bends", vi: "Căn phòng bên trong lớn hơn bên ngoài — không gian uốn cong" } },
  paradox: { name: { en: "Paradox Void", vi: "Hư Không Nghịch Lý" }, sub: { en: "Ten islands where common sense breaks.", vi: "Mười hòn đảo nơi lẽ thường gãy đổ." } },
  babel: { name: { en: "The Library of Babel", vi: "Thư viện Babel" }, sub: { en: "Every possible book. Every one of them, exactly once.", vi: "Mọi cuốn sách có thể có. Mỗi cuốn đúng một lần." } },
  siren: { name: { en: "Labyrinth of Harmonics", vi: "Mê cung Hoạ âm" }, sub: { en: "Every attack is a wave. Listen.", vi: "Mọi đòn đánh là một con sóng. Hãy lắng nghe." } },
  valley: { name: { en: "Function Valley", vi: "Thung lũng Hàm số" }, sub: { en: "Shape the curve, read the slope", vi: "Nặn đường cong, đọc độ dốc" } },
  study: { name: { en: "Study Together", vi: "Phòng Học cùng nhau" }, sub: { en: "Sit down, pick one goal, and focus — together.", vi: "Ngồi xuống, chọn một mục tiêu, cùng nhau tập trung." } },
  vault: { name: { en: "The Lemma Vaults", vi: "Hầm Bổ đề" }, sub: { en: "A proof needs more than one mind.", vi: "Một chứng minh cần nhiều hơn một bộ óc." } },
  bazaar: { name: { en: "Chance Bazaar", vi: "Chợ Xác Suất" }, sub: { en: "Luck decides the round. Understanding decides the night.", vi: "May rủi quyết định một ván. Hiểu biết quyết định cả đêm." } },
  coast: { name: { en: "Wave Coast", vi: "Bờ Sóng" }, sub: { en: "Every wave is a sine — and sines add up.", vi: "Mỗi con sóng là một hình sin — và các hình sin cộng được với nhau." } },
  archive: { name: { en: "The Abandoned Archive", vi: "Thư khố bỏ hoang" }, sub: { en: "The rooms behind you are never quite where you left them.", vi: "Những căn phòng sau lưng không bao giờ ở yên chỗ cũ." } },
  torus: { name: { en: "Torus Archipelago", vi: "Quần đảo Xuyến" }, sub: { en: "Shoot straight ahead — and hit your own back.", vi: "Bắn thẳng ra trước — trúng ngay lưng mình." } },
};

const SEEN_KEY = "world.seenRealms";
/** lần đầu tới thế giới này trong phiên? (đánh dấu luôn) */
function firstVisit(id: string): boolean {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    if (seen.includes(id)) return false;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
    return true;
  } catch {
    return false;
  }
}

type Shown = { id: string; big: boolean; at: number; reduced: boolean; touch: boolean };

export function AreaTitle({ title }: { title: { id: string; at: number } | null }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [show, setShow] = useState<Shown | null>(null);
  // chờ chuyển cảnh xong (lỗ sâu, màn chờ) rồi mới hiện
  useEffect(() => {
    if (!title) return;
    const tryShow = () => {
      const t = useTransit.getState();
      if (t.travelTo || t.load !== "idle" || performance.now() - title.at < 450) return false;
      setShow({ id: title.id, big: firstVisit(title.id), at: performance.now(), reduced: prefersReducedMotion(), touch: !!window.matchMedia?.("(pointer: coarse)").matches });
      return true;
    };
    const id = window.setInterval(() => tryShow() && window.clearInterval(id), 100);
    return () => window.clearInterval(id);
  }, [title]);
  // tự tắt; phím / chạm bất kỳ = bỏ qua (không nuốt sự kiện — người chơi vẫn đi / đánh được ngay)
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(null), show.big ? 4800 : 3200);
    const skip = () => performance.now() - show.at > 350 && setShow(null);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [show]);
  const d = show ? TITLES[show.id] : null;
  const pal = show ? (REALM_PALETTE[show.id] ?? REALM_PALETTE.hub) : REALM_PALETTE.hub;
  return (
    <AnimatePresence>
      {show && d && show.big && (
        <motion.div
          key={`c${show.at}`}
          className="w-chap"
          role="status"
          style={{ "--ra": pal[0], "--rb": pal[1] } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          transition={{ duration: 0.5 }}
        >
          <motion.i className="w-chap__band" initial={show.reduced ? false : { scaleY: 0.2 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} />
          {!show.reduced && <i className="w-chap__sheen" />}
          <div className="w-chap__body">
            <RealmMotif id={show.id} reduced={show.reduced} />
            <div className="w-chap__text">
              {TOPIC[show.id] && (
                <motion.small initial={{ opacity: 0, y: show.reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
                  {TOPIC[show.id][lang]}
                </motion.small>
              )}
              <motion.b
                initial={show.reduced ? { opacity: 0 } : { clipPath: "inset(0 100% 0 0)", opacity: 1 }}
                animate={show.reduced ? { opacity: 1 } : { clipPath: "inset(0 0% 0 0)", opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
              >
                {d.name[lang]}
              </motion.b>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}>
                {d.sub[lang]}
              </motion.span>
            </div>
          </div>
          <motion.em className="w-chap__skip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
            {show.touch ? (lang === "vi" ? "Chạm để bỏ qua" : "Tap to skip") : lang === "vi" ? "Nhấn phím bất kỳ để bỏ qua" : "Press any key to skip"}
          </motion.em>
        </motion.div>
      )}
      {show && d && !show.big && (
        <motion.div key={`b${show.at}`} className="w-area" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.6 }}>
          <motion.i className="w-area__line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
          <span className="w-area__name">{d.name[lang]}</span>
          <span className="w-area__sub">{d.sub[lang]}</span>
          <motion.i className="w-area__line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
