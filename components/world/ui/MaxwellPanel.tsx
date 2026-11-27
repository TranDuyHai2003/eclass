"use client";
/** Quỷ Maxwell: chọn chế độ cửa, tự làm quỷ (giữ nút), xem nhiệt độ hai ngăn, entropy khí vs. bit trí nhớ, xoá trí nhớ (Landauer) */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, RotateCcw, Eraser, Hand } from "lucide-react";
import { useWorld } from "../store";
import { LAB_VIEW, eraseMemory, resetGas, useMaxwell, type MxMode } from "../scene/MaxwellLab";
import { unlockNote } from "../story/quest";
import { sfx } from "@/lib/world/sfx";
import "./maxwell.css";

type T = (vi: string, en: string) => string;
const K = (t: number) => Math.round(300 * t);

export function MaxwellPanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t: T = (vi, en) => (lang === "vi" ? vi : en);
  const { mode, stats } = useMaxwell();
  const [why, setWhy] = useState(false);
  useEffect(() => {
    useWorld.getState().player.set(LAB_VIEW.x, 0, LAB_VIEW.z);
    useWorld.setState({ playerYaw: -Math.PI / 2, camYaw: Math.PI / 2, camPitch: 0.1, camDist: 4.6 });
    // giữ phím Space = mở cửa sập (chế độ bạn làm quỷ)
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && useMaxwell.getState().mode === "manual") {
        e.preventDefault();
        e.stopPropagation();
        useMaxwell.setState({ held: true });
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && useMaxwell.setState({ held: false });
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      useMaxwell.setState({ held: false });
      useWorld.setState({ camDist: 3.2, camPitch: 0.16 });
    };
  }, []);
  const setMode = (m: MxMode) => {
    useMaxwell.setState({ mode: m, held: false });
    sfx.click();
    if (m === "auto") unlockNote("maxwell");
  };
  const dT = stats.tR - stats.tL;
  const gasDrop = Math.max(0, -stats.dS) / Math.LN2; // entropy khí đã giảm, đơn vị "bit" (k ln 2)
  const memory = stats.bits + stats.erased; // tổng bit quỷ đã phải ghi
  const scale = Math.max(8, gasDrop, memory);
  return (
    <motion.div className="w-mx pointer-events-auto" initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-mx__head">
        <span className="w-mx__kicker">{t("QUỶ MAXWELL · NHIỆT ĐỘNG LỰC HỌC & THÔNG TIN", "MAXWELL'S DEMON · THERMODYNAMICS & INFORMATION")}</span>
        <button type="button" className="w-mx__btn w-mx__btn--icon" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      <div className="w-mx__modes">
        {(
          [
            ["closed", t("Cửa đóng", "Door shut")],
            ["open", t("Cửa mở", "Door open")],
            ["manual", t("Bạn làm quỷ", "You are the demon")],
            ["auto", t("Quỷ tự động", "Demon on duty")],
          ] as [MxMode, string][]
        ).map(([m, label]) => (
          <button key={m} type="button" className={`w-mx__mode${mode === m ? " is-on" : ""}`} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>
      <div className="w-mx__temps">
        <div className="is-l">
          <span>{t("Ngăn trái", "Left")}</span>
          <b>{K(stats.tL)} K</b>
          <small>
            {stats.nL} {t("phân tử", "molecules")}
          </small>
        </div>
        <div className={`w-mx__delta${Math.abs(dT) > 0.15 ? " is-on" : ""}`}>
          ΔT = {dT >= 0 ? "+" : ""}
          {K(dT)} K
        </div>
        <div className="is-r">
          <span>{t("Ngăn phải", "Right")}</span>
          <b>{K(stats.tR)} K</b>
          <small>
            {stats.nR} {t("phân tử", "molecules")}
          </small>
        </div>
      </div>
      {mode === "manual" && (
        <button
          type="button"
          className="w-mx__hold"
          onPointerDown={() => useMaxwell.setState({ held: true })}
          onPointerUp={() => useMaxwell.setState({ held: false })}
          onPointerLeave={() => useMaxwell.setState({ held: false })}
        >
          <Hand />
          {t("GIỮ để mở cửa sập (hoặc giữ Space) — cho phân tử ĐỎ sang phải, XANH sang trái", "HOLD to open the trapdoor (or hold Space) — let RED molecules go right, BLUE go left")}
        </button>
      )}
      <div className="w-mx__ledger">
        <div>
          <span>{t("Entropy khí đã giảm", "Gas entropy removed")}</span>
          <i style={{ width: `${(gasDrop / scale) * 100}%` }} className="is-gas" />
          <b>{gasDrop.toFixed(1)}</b>
        </div>
        <div>
          <span>{t("Bit quỷ phải ghi nhớ", "Bits the demon recorded")}</span>
          <i style={{ width: `${(memory / scale) * 100}%` }} className="is-mem" />
          <b>{memory}</b>
        </div>
        <small>{t("đơn vị: k ln 2 (một bit)", "units: k ln 2 (one bit)")}</small>
      </div>
      <div className="w-mx__row">
        <button type="button" className="w-mx__btn" onClick={() => (eraseMemory(), sfx.shatter())} disabled={stats.bits === 0}>
          <Eraser />
          {t(`Xoá trí nhớ quỷ (${stats.bits} bit)`, `Erase the demon's memory (${stats.bits} bits)`)}
        </button>
        <button type="button" className="w-mx__btn" onClick={() => (resetGas(), sfx.click())}>
          <RotateCcw />
          {t("Khí mới", "Fresh gas")}
        </button>
        <button type="button" className={`w-mx__btn${why ? " is-on" : ""}`} onClick={() => setWhy((v) => !v)}>
          {t("Vì sao định luật 2 vẫn đúng?", "Why does the 2nd law survive?")}
        </button>
      </div>
      {stats.heat > 0 && (
        <p className="w-mx__heat">
          {t(
            `Xoá ${stats.erased} bit đã toả ít nhất ${stats.erased} × kT ln 2 nhiệt ra phòng → entropy môi trường tăng ≥ ${stats.heat.toFixed(1)} k, nhiều hơn lượng entropy khí đã giảm.`,
            `Erasing ${stats.erased} bits released at least ${stats.erased} × kT ln 2 of heat → the room's entropy rose by ≥ ${stats.heat.toFixed(1)} k, more than the gas lost.`,
          )}
        </p>
      )}
      {why && (
        <div className="w-mx__why">
          <p>
            {t(
              "1867 — Maxwell tưởng tượng một \"sinh vật\" canh cửa: chỉ cho phân tử nhanh sang phải, chậm sang trái. Không tốn công, một bên nóng lên một bên lạnh đi — như thể định luật 2 nhiệt động lực học (entropy không giảm) bị phá vỡ.",
              "1867 — Maxwell imagined a \"being\" guarding a door: fast molecules may go right, slow ones left. With no work done, one side heats and the other cools — as if the 2nd law (entropy never decreases) were broken.",
            )}
          </p>
          <p>
            {t(
              "Chìa khoá là THÔNG TIN. Để quyết định, quỷ phải ĐO từng phân tử và GHI NHỚ kết quả. Szilárd (1929) chỉ ra mỗi bit thông tin tương ứng k ln 2 entropy. Landauer (1961) và Bennett (1982): đo có thể gần như không tốn gì, nhưng XOÁ một bit trí nhớ bắt buộc toả ít nhất kT ln 2 nhiệt. Trí nhớ quỷ hữu hạn → sớm muộn phải xoá → entropy sinh ra ≥ entropy khí đã mất.",
              "The key is INFORMATION. To decide, the demon must MEASURE each molecule and REMEMBER the result. Szilárd (1929) showed each bit corresponds to k ln 2 of entropy. Landauer (1961) and Bennett (1982): measuring can be nearly free, but ERASING one bit of memory must release at least kT ln 2 of heat. A finite memory must eventually be erased → the entropy produced ≥ the entropy the gas lost.",
            )}
          </p>
          <p className="w-mx__note">
            {t(
              "Năm 2012 các nhà vật lý đo được đúng nhiệt lượng Landauer khi xoá một bit nhớ làm từ một hạt keo. Thông tin là vật lý: máy tính của bạn nóng lên một phần vì nó xoá thông tin.",
              "In 2012 physicists measured the Landauer heat when erasing a one-bit memory made of a single colloidal bead. Information is physical: your computer warms up partly because it erases information.",
            )}
          </p>
        </div>
      )}
    </motion.div>
  );
}
