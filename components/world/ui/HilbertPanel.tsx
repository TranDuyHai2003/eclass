"use client";
/** Quầy lễ tân Khách sạn Hilbert: 3 "phép màu" + sơ đồ phòng 1–16 trước / sau (khách cũ xanh, khách mới vàng, phòng trống) */
import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useWorld } from "../store";
import { occupantAfter, type Move } from "@/lib/world/hilbert";
import { hilbertMove } from "../scene/HilbertHotel";
import { sfx } from "@/lib/world/sfx";
import "./babel.css";

type L = { en: string; vi: string };
const MOVES: { id: Move; title: L; rule: string; idea: L }[] = [
  { id: "one", title: { en: "One new guest", vi: "Một khách mới" }, rule: "n → n + 1", idea: { en: "Everyone steps one door down at the same time. Nobody is left without a room — and room 1 is now free.", vi: "Mọi người cùng lúc chuyển sang cửa kế bên. Không ai mất phòng — và phòng 1 trống ra." } },
  { id: "bus", title: { en: "A bus with infinitely many guests", vi: "Một xe buýt chở vô hạn khách" }, rule: "n → 2n", idea: { en: "Everyone doubles their room number. All the odd rooms — infinitely many — are free for the bus.", vi: "Mọi người nhân đôi số phòng. Tất cả phòng lẻ — vô hạn phòng — trống ra cho cả xe buýt." } },
  { id: "buses", title: { en: "Infinitely many buses", vi: "Vô hạn xe buýt" }, rule: "n → 2ⁿ ;  bus k, seat s → pₖˢ", idea: { en: "Old guests go to powers of 2; bus k uses powers of the k-th odd prime (3, 5, 7…). Unique factorisation: no two people share a room — and infinitely many rooms are STILL empty.", vi: "Khách cũ vào các luỹ thừa của 2; xe buýt thứ k dùng luỹ thừa của số nguyên tố lẻ thứ k (3, 5, 7…). Phân tích nguyên tố là duy nhất: không ai trùng phòng — và VẪN còn vô hạn phòng trống." } },
];

export function HilbertPanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [sel, setSel] = useState<Move>("one");
  const m = MOVES.find((x) => x.id === sel)!;
  const rooms = Array.from({ length: 16 }, (_, i) => i + 1);
  return (
    <motion.div className="w-modal w-babel-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-babel w-hotel" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <header className="w-babel__head">
          <div className="w-babel__ht">
            <span className="w-babel__kicker">{lang === "vi" ? "KHÁCH SẠN HILBERT · ĐÃ KÍN CHỖ" : "HILBERT'S GRAND HOTEL · NO VACANCY"}</span>
            <h2 className="w-babel__title">{lang === "vi" ? "Vẫn còn chỗ cho bạn" : "There is still room for you"}</h2>
          </div>
          <button type="button" className="w-babel__btn w-babel__btn--icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="w-hotel__body">
          <div className="w-hotel__moves">
            {MOVES.map((x) => (
              <button key={x.id} type="button" className={`w-hotel__move${sel === x.id ? " is-on" : ""}`} onClick={() => setSel(x.id)}>
                <b>{x.title[lang]}</b>
                <code>{x.rule}</code>
              </button>
            ))}
          </div>
          <p className="w-hotel__idea">{m.idea[lang]}</p>
          <div className="w-hotel__diagram" aria-label="rooms 1 to 16">
            {(["before", "after"] as const).map((row) => (
              <div key={row} className="w-hotel__row">
                <span className="w-hotel__rl">{row === "before" ? (lang === "vi" ? "Trước" : "Before") : lang === "vi" ? "Sau" : "After"}</span>
                {rooms.map((n) => {
                  const o = row === "before" ? { kind: "old" as const, from: n } : occupantAfter(sel, n);
                  const cls = !o ? "is-empty" : o.kind === "new" ? "is-new" : "is-old";
                  const tip = !o ? "—" : o.kind === "new" ? (o.seat ? `B${o.k}·${o.seat}` : `+${o.k}`) : `${o.from}`;
                  return (
                    <span key={n} className={`w-hotel__room ${cls}`} title={`${lang === "vi" ? "Phòng" : "Room"} ${n}`}>
                      <small>{n}</small>
                      <i>{tip}</i>
                    </span>
                  );
                })}
                <span className="w-hotel__more">…</span>
              </div>
            ))}
          </div>
          <footer className="w-babel__bar">
            <span>{lang === "vi" ? "Số trong ô = khách cũ từ phòng nào đến; vàng = khách mới; trống = phòng còn trống." : "Number in a box = which old room the guest came from; gold = new guest; blank = free."}</span>
            <button
              type="button"
              className="w-babel__btn w-babel__btn--gold"
              onClick={() => {
                hilbertMove(sel);
                sfx.chime(3);
                onClose();
              }}
            >
              {lang === "vi" ? "Thực hiện — xem ngoài hành lang" : "Do it — watch the corridor"}
            </button>
          </footer>
        </div>
      </motion.div>
    </motion.div>
  );
}
