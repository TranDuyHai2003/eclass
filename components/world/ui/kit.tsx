"use client";
/**
 * UI kit with motion: framed panel (spring pop-in), skewed buttons, diagonal scene wipe, slide-in banners.
 */
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { X } from "lucide-react";
import "./world.css";
import "./hud.css";
import "./story.css";

export function WPanel({ title, onClose, children, className = "", wide }: { title?: string; onClose?: () => void; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94, rotate: -0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={`w-panel flex max-h-[88dvh] w-full flex-col overflow-hidden ${wide ? "max-w-3xl" : "max-w-xl"} ${className}`}
    >
      {title && (
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="w-title text-xl sm:text-2xl">{title}</h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#ecd7a9] ring-1 ring-[#ecd7a9]/60 transition hover:rotate-90 hover:bg-white/20"
              >
                <X size={18} strokeWidth={2.6} />
              </button>
            )}
          </div>
          <div className="w-divider mt-2" />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">{children}</div>
    </motion.div>
  );
}

export function WButton({ tone = "cyan", size = "md", className = "", children, ...rest }: { tone?: "cyan" | "gold" | "ghost"; size?: "sm" | "md" | "lg" } & HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      className={`w-btn ${tone === "gold" ? "w-btn--gold" : tone === "ghost" ? "w-btn--ghost" : ""} ${size === "sm" ? "w-btn--sm" : size === "lg" ? "w-btn--lg" : ""} ${className}`}
      {...rest}
    >
      <span className="inline-flex items-center gap-1.5">{children as React.ReactNode}</span>
    </motion.button>
  );
}

export function WChip({ tone = "cyan", children }: { tone?: "cyan" | "gold" | "rose"; children: React.ReactNode }) {
  return (
    <span className={`w-chip ${tone === "gold" ? "w-chip--gold" : tone === "rose" ? "w-chip--rose" : ""}`}>
      <span>{children}</span>
    </span>
  );
}

/** Màn che lớp phủ (mờ + tối nhẹ) và căn giữa / đáy trên điện thoại */
export function WBackdrop({ children, bottom }: { children: React.ReactNode; bottom?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`pointer-events-auto absolute inset-0 z-30 flex justify-center bg-[#0c1030]/35 p-3 ${bottom ? "items-end" : "items-end sm:items-center"}`}
    >
      {children}
    </motion.div>
  );
}

/** Chuyển cảnh: sọc chéo trượt ngang, hoặc "lỗ sâu" — đường hầm xoáy hút vào tâm */
export function SceneWipe({ show, kind = "stripes" }: { show: boolean; kind?: "stripes" | "wormhole" }) {
  if (kind === "wormhole") {
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            key="worm"
            className="pointer-events-none absolute inset-0 z-[60] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-[260vmax] w-[260vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, #000 0 3%, rgba(255,255,255,.95) 4%, transparent 9%), repeating-conic-gradient(from 0deg, #12163a 0 8deg, #2ec5ff 8deg 10deg, #12163a 10deg 20deg, #ecd7a9 20deg 21deg)",
              }}
              initial={{ scale: 0.05, rotate: 0 }}
              animate={{ scale: 1, rotate: 220 }}
              transition={{ duration: 0.9, ease: [0.6, 0, 0.2, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="wipe"
          className="w-wipe"
          initial={{ x: "-120%" }}
          animate={{ x: "0%" }}
          exit={{ x: "120%" }}
          transition={{ duration: 0.42, ease: [0.7, 0, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

/** Băng thông báo nghiêng trượt vào */
export function WBanner({ text, tone = "rose" }: { text: string; tone?: "rose" | "cyan" | "gold" }) {
  const bg = tone === "rose" ? "from-[#ff7fa8] to-[#ff4f86] text-white" : tone === "gold" ? "from-[#fff1c4] to-[#f0cf7f] text-[#3b2a07]" : "from-[#bff0ff] to-[#5fd8ff] text-[#0b2948]";
  return (
    <motion.div
      initial={{ x: 60, opacity: 0, skewX: -12 }}
      animate={{ x: 0, opacity: 1, skewX: -12 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`bg-gradient-to-r ${bg} px-5 py-1.5 text-xs font-black italic tracking-wide shadow-lg`}
    >
      <div style={{ transform: "skewX(12deg)" }}>{text}</div>
    </motion.div>
  );
}

export { motion, AnimatePresence };
