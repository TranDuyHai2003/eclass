"use client";
/** Phòng Nghịch Lý: bảng tương tác cho 10 trạm (mỗi trạm một thí nghiệm nhỏ bằng SVG + lời giải + câu hỏi thử nghĩ) */
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { X, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { useWorld } from "../store";
import { PARADOXES, usePdx } from "../scene/paradoxData";
import { unlockNote } from "../story/quest";
import { birthdayP, braess, cesaro, grandiPartial, kochLength, kochPoints, newcombEV, reduceWord, simpsonRates, SIMPSON, twinAges, wordsUpTo, zenoSteps, catchTime, gamma, pieceOf } from "@/lib/world/paradox";
import { sfx } from "@/lib/world/sfx";
import "./paradox.css";

type Lang = "en" | "vi";
type T = (vi: string, en: string) => string;

export function ParadoxPanel({ onClose }: { onClose: () => void }) {
  const lang: Lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t: T = (vi, en) => (lang === "vi" ? vi : en);
  const id = usePdx((s) => s.id);
  const [reveal, setReveal] = useState<number | null>(null);
  const P = PARADOXES[id];
  const go = (d: number) => {
    usePdx.setState({ id: (id + d + PARADOXES.length) % PARADOXES.length });
    setReveal(null);
    sfx.click();
  };
  return (
    <motion.div className="w-pdx pointer-events-auto" style={{ ["--pdx" as string]: P.color }} initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-pdx__head">
        <button type="button" className="w-pdx__btn w-pdx__btn--icon" onClick={() => go(-1)} aria-label="prev">
          <ChevronLeft />
        </button>
        <div className="w-pdx__title">
          <span className="w-pdx__kicker">
            {t("PHÒNG NGHỊCH LÝ", "HALL OF PARADOXES")} · {id + 1}/10 · {P.who[lang]}
          </span>
          <b>{P.title[lang]}</b>
        </div>
        <button type="button" className="w-pdx__btn w-pdx__btn--icon" onClick={() => go(1)} aria-label="next">
          <ChevronRight />
        </button>
        <button type="button" className="w-pdx__btn w-pdx__btn--icon" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      <div className="w-pdx__body">
        <p className="w-pdx__story">{P.story[lang]}</p>
        <div className="w-pdx__lab">
          <Lab id={P.id} t={t} />
        </div>
        {reveal === id ? (
          <p className="w-pdx__key">
            <Lightbulb /> {P.key[lang]}
          </p>
        ) : (
          <button
            type="button"
            className="w-pdx__btn w-pdx__btn--key"
            onClick={() => {
              setReveal(id);
              sfx.chime(2);
              unlockNote("paradoxes");
            }}
          >
            <Lightbulb />
            {t("Xem lời giải", "Reveal the resolution")}
          </button>
        )}
        <p className="w-pdx__think">
          {t("Thử nghĩ", "Think")}: {P.think[lang]}
        </p>
      </div>
    </motion.div>
  );
}

function Lab({ id, t }: { id: string; t: T }) {
  switch (id) {
    case "zeno":
      return <ZenoLab t={t} />;
    case "birthday":
      return <BirthdayLab t={t} />;
    case "simpson":
      return <SimpsonLab t={t} />;
    case "banach":
      return <BanachLab t={t} />;
    case "russell":
      return <RussellLab t={t} />;
    case "newcomb":
      return <NewcombLab t={t} />;
    case "coast":
      return <CoastLab t={t} />;
    case "braess":
      return <BraessLab t={t} />;
    case "grandi":
      return <GrandiLab t={t} />;
    default:
      return <TwinLab t={t} />;
  }
}

const fmt = (x: number, d = 2) => x.toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: 0 });

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="w-pdx__slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function ZenoLab({ t }: { t: T }) {
  const [n, setN] = useState(3);
  const s = zenoSteps(n);
  const last = s[s.length - 1];
  const X = (m: number) => 10 + (m / 115) * 480;
  return (
    <>
      <Slider label={t(`Số bước Zeno: ${n}`, `Zeno steps: ${n}`)} value={n} min={1} max={14} onChange={setN} />
      <svg viewBox="0 0 500 70" className="w-pdx__svg">
        <line x1={10} y1={40} x2={490} y2={40} stroke="currentColor" opacity={0.3} />
        {s.map((x, i) => (
          <circle key={i} cx={X(x.achilles)} cy={40} r={2.5} fill="#ffd27a" opacity={0.6} />
        ))}
        <circle cx={X(last.achilles)} cy={40} r={7} fill="#ffd27a" />
        <text x={X(last.achilles)} y={62} textAnchor="middle" fontSize={9} fill="#ffd27a">
          Achilles
        </text>
        <line x1={X(last.achilles + last.gap)} y1={30} x2={X(last.achilles + last.gap)} y2={40} stroke="#6fbf6a" />
        <circle cx={X(last.achilles + last.gap)} cy={26} r={5} fill="#6fbf6a" />
        <text x={X(last.achilles + last.gap) - 8} y={22} textAnchor="end" fontSize={9} fill="#6fbf6a">
          {t("rùa", "tortoise")}
        </text>
        <line x1={X(111.11)} y1={20} x2={X(111.11)} y2={60} stroke="#ff7a9a" strokeDasharray="3 3" />
        <text x={X(111.11)} y={14} textAnchor="middle" fontSize={10} fill="#ff7a9a">
          111,1 m
        </text>
      </svg>
      <p className="w-pdx__num">
        {t("Thời gian đã chạy", "Time so far")}: <b>{fmt(last.t, 6)} s</b> · {t("khoảng cách còn", "gap left")}: <b>{fmt(last.gap, 6)} m</b> · {t("giới hạn", "limit")}: <b>{fmt(catchTime(), 4)} s</b>
      </p>
    </>
  );
}

function BirthdayLab({ t }: { t: T }) {
  const [n, setN] = useState(23);
  const [sim, setSim] = useState<number | null>(null);
  const p = birthdayP(n);
  const pts = useMemo(() => Array.from({ length: 80 }, (_, i) => `${10 + i * 6},${80 - birthdayP(i + 1) * 70}`).join(" "), []);
  const run = () => {
    let hit = 0;
    for (let k = 0; k < 1000; k++) {
      const seen = new Set<number>();
      let dup = false;
      for (let i = 0; i < n && !dup; i++) {
        const d = Math.floor(Math.random() * 365);
        if (seen.has(d)) dup = true;
        seen.add(d);
      }
      if (dup) hit++;
    }
    setSim(hit / 10);
    sfx.click();
  };
  return (
    <>
      <Slider label={t(`Số người: ${n}`, `People: ${n}`)} value={n} min={2} max={80} onChange={(v) => (setN(v), setSim(null))} />
      <svg viewBox="0 0 500 90" className="w-pdx__svg">
        <polyline points={pts} fill="none" stroke="#ff9ec0" strokeWidth={2} />
        <line x1={10} y1={45} x2={490} y2={45} stroke="currentColor" opacity={0.25} strokeDasharray="4 4" />
        <circle cx={10 + (n - 1) * 6} cy={80 - p * 70} r={5} fill="#ff9ec0" />
        <text x={14} y={42} fontSize={9} fill="currentColor" opacity={0.6}>
          50%
        </text>
      </svg>
      <p className="w-pdx__num">
        P({t("có cặp trùng", "a shared birthday")}) = <b>{fmt(p * 100, 1)}%</b> · {t("số cặp", "pairs")}: <b>{(n * (n - 1)) / 2}</b>
        {sim !== null && (
          <>
            {" "}
            · {t("mô phỏng 1000 lớp", "1000 simulated classes")}: <b>{fmt(sim, 1)}%</b>
          </>
        )}
      </p>
      <button type="button" className="w-pdx__btn" onClick={run}>
        {t("Mô phỏng 1000 lớp học", "Simulate 1000 classes")}
      </button>
    </>
  );
}

function SimpsonLab({ t }: { t: T }) {
  const [merged, setMerged] = useState(false);
  const r = simpsonRates();
  const rows = merged
    ? [[t("Tất cả bệnh nhân", "All patients"), r.A.all, r.B.all, `${SIMPSON.A.small[0] + SIMPSON.A.large[0]}/${SIMPSON.A.small[1] + SIMPSON.A.large[1]}`, `${SIMPSON.B.small[0] + SIMPSON.B.large[0]}/${SIMPSON.B.small[1] + SIMPSON.B.large[1]}`] as const]
    : ([
        [t("Sỏi nhỏ", "Small stones"), r.A.small, r.B.small, `${SIMPSON.A.small[0]}/${SIMPSON.A.small[1]}`, `${SIMPSON.B.small[0]}/${SIMPSON.B.small[1]}`],
        [t("Sỏi lớn", "Large stones"), r.A.large, r.B.large, `${SIMPSON.A.large[0]}/${SIMPSON.A.large[1]}`, `${SIMPSON.B.large[0]}/${SIMPSON.B.large[1]}`],
      ] as const);
  return (
    <>
      <div className="w-pdx__row">
        <button type="button" className={`w-pdx__btn${!merged ? " is-on" : ""}`} onClick={() => setMerged(false)}>
          {t("Theo nhóm", "By group")}
        </button>
        <button type="button" className={`w-pdx__btn${merged ? " is-on" : ""}`} onClick={() => setMerged(true)}>
          {t("Gộp chung", "Combined")}
        </button>
      </div>
      {rows.map(([name, a, b, ca, cb]) => (
        <div key={name} className="w-pdx__bars">
          <span>{name}</span>
          <div>
            <i className="is-a" style={{ width: `${a * 100}%` }}>
              A {fmt(a * 100, 0)}% ({ca})
            </i>
            <i className="is-b" style={{ width: `${b * 100}%` }}>
              B {fmt(b * 100, 0)}% ({cb})
            </i>
          </div>
        </div>
      ))}
      <p className="w-pdx__num">{merged ? t("Gộp lại: B thắng!", "Combined: B wins!") : t("Mỗi nhóm: A thắng!", "Each group: A wins!")}</p>
    </>
  );
}

function BanachLab({ t }: { t: T }) {
  const [shown, setShown] = useState(false);
  const words = wordsUpTo(2);
  const col: Record<string, string> = { a: "#ff7a9a", A: "#ffd27a", b: "#7fe3ff", B: "#b58bff", e: "#7dff9a" };
  const show = (w: string) => (w === "" ? "e" : w.replace(/A/g, "a⁻¹").replace(/B/g, "b⁻¹"));
  return (
    <>
      <p className="w-pdx__small">{t("Mọi 'từ' ghép từ a, a⁻¹, b, b⁻¹ (đã rút gọn) chia làm 5 mảnh theo chữ đầu:", "Every reduced 'word' in a, a⁻¹, b, b⁻¹ falls into 5 pieces by its first letter:")}</p>
      <div className="w-pdx__words">
        {words.map((w) => (
          <span key={w} style={{ borderColor: col[pieceOf(w)], color: col[pieceOf(w)] }}>
            {show(w)}
          </span>
        ))}
      </div>
      <button type="button" className="w-pdx__btn" onClick={() => (setShown(true), sfx.chime(1))}>
        {t("Nhân a vào mảnh a⁻¹…", "Multiply piece a⁻¹ by a…")}
      </button>
      {shown && (
        <div className="w-pdx__words">
          {words
            .filter((w) => pieceOf(w) === "A")
            .concat(["AA", "Ab", "AB", "AAb"])
            .map((w) => {
              const r = reduceWord("a" + w);
              return (
                <span key={w} style={{ borderColor: col[pieceOf(r)], color: col[pieceOf(r)] }}>
                  a·{show(w)} = {show(r)}
                </span>
              );
            })}
        </div>
      )}
      {shown && <p className="w-pdx__num">{t("Mảnh a⁻¹ sau khi xoay bằng a phủ kín MỌI từ không bắt đầu bằng a — 4 mảnh còn lại. Hai mảnh đủ dựng lại cả nhóm!", "Piece a⁻¹ turned by a covers EVERY word not starting with a — the other 4 pieces. Two pieces rebuild the whole group!")}</p>}
    </>
  );
}

function RussellLab({ t }: { t: T }) {
  const [ans, setAns] = useState<null | boolean>(null);
  return (
    <>
      <p className="w-pdx__small">{t("Người thợ cạo có tự cạo không?", "Does the barber shave himself?")}</p>
      <div className="w-pdx__row">
        <button type="button" className="w-pdx__btn" onClick={() => (setAns(true), sfx.miss())}>
          {t("Có", "Yes")}
        </button>
        <button type="button" className="w-pdx__btn" onClick={() => (setAns(false), sfx.miss())}>
          {t("Không", "No")}
        </button>
      </div>
      {ans !== null && (
        <p className="w-pdx__num">
          {ans
            ? t("→ Anh ta tự cạo, nên anh ta thuộc nhóm 'tự cạo' — mà thợ cạo KHÔNG cạo cho người tự cạo. Mâu thuẫn!", "→ He shaves himself, so he's a self-shaver — and the barber does NOT shave self-shavers. Contradiction!")
            : t("→ Anh ta không tự cạo, nên anh ta thuộc nhóm thợ cạo PHẢI cạo — tức là tự cạo. Mâu thuẫn!", "→ He doesn't, so he's one of those the barber MUST shave — i.e. himself. Contradiction!")}{" "}
          {t("Tập hợp R = { x | x ∉ x }: R ∈ R ⇔ R ∉ R.", "The set R = { x | x ∉ x }: R ∈ R ⇔ R ∉ R.")}
        </p>
      )}
    </>
  );
}

function NewcombLab({ t }: { t: T }) {
  const [p, setP] = useState(0.9);
  const [res, setRes] = useState<{ one: number; two: number } | null>(null);
  const ev = newcombEV(p);
  const max = Math.max(ev.oneBox, ev.twoBox, 1);
  const play = () => {
    let one = 0;
    let two = 0;
    for (let k = 0; k < 100; k++) {
      // kẻ tiên tri đoán đúng với xác suất p
      one += Math.random() < p ? 1_000_000 : 0;
      two += 1_000 + (Math.random() < p ? 0 : 1_000_000);
    }
    setRes({ one: one / 100, two: two / 100 });
    sfx.click();
  };
  return (
    <>
      <Slider label={t(`Kẻ tiên tri đúng ${fmt(p * 100, 0)}%`, `Predictor accuracy ${fmt(p * 100, 0)}%`)} value={p} min={0.4} max={1} step={0.01} onChange={(v) => (setP(v), setRes(null))} />
      <div className="w-pdx__bars">
        <span>{t("Chỉ lấy B", "One box")}</span>
        <div>
          <i className="is-a" style={{ width: `${(ev.oneBox / max) * 100}%` }}>
            ${fmt(ev.oneBox, 0)}
          </i>
        </div>
      </div>
      <div className="w-pdx__bars">
        <span>{t("Lấy cả hai", "Both boxes")}</span>
        <div>
          <i className="is-b" style={{ width: `${(ev.twoBox / max) * 100}%` }}>
            ${fmt(ev.twoBox, 0)}
          </i>
        </div>
      </div>
      <button type="button" className="w-pdx__btn" onClick={play}>
        {t("Chơi 100 ván với kẻ tiên tri", "Play 100 rounds vs. the predictor")}
      </button>
      {res && (
        <p className="w-pdx__num">
          {t("Trung bình mỗi ván", "Average per round")}: {t("chỉ lấy B", "one box")} <b>${fmt(res.one, 0)}</b> · {t("lấy cả hai", "both")} <b>${fmt(res.two, 0)}</b>
        </p>
      )}
    </>
  );
}

function CoastLab({ t }: { t: T }) {
  const [k, setK] = useState(2);
  const path = useMemo(() => {
    const seg = kochPoints(k);
    const out: string[] = [];
    for (let side = 0; side < 3; side++) {
      const a = (side * 2 * Math.PI) / 3 - Math.PI / 2;
      const b = a + (2 * Math.PI) / 3;
      const A = [Math.cos(a), Math.sin(a)];
      const B = [Math.cos(b), Math.sin(b)];
      const d = [B[0] - A[0], B[1] - A[1]];
      const n = [-d[1], d[0]];
      seg.forEach(([x, y]) => out.push(`${250 + (A[0] + d[0] * x - n[0] * y) * 70},${75 + (A[1] + d[1] * x - n[1] * y) * 70}`));
    }
    return out.join(" ");
  }, [k]);
  return (
    <>
      <Slider label={t(`Thước ngắn đi: mức ${k} (thước = 1/3^${k})`, `Shorter ruler: level ${k} (ruler = 1/3^${k})`)} value={k} min={0} max={6} onChange={setK} />
      <svg viewBox="0 0 500 160" className="w-pdx__svg">
        <polygon points={path} fill="rgba(111,182,255,0.12)" stroke="#6fb6ff" strokeWidth={1.2} />
      </svg>
      <p className="w-pdx__num">
        {t("Chu vi đo được", "Measured perimeter")}: <b>3 × (4/3)^{k} = {fmt(3 * kochLength(k), 3)}</b> · {t("số chiều fractal", "fractal dimension")} <b>≈ 1,26</b>
      </p>
    </>
  );
}

function BraessLab({ t }: { t: T }) {
  const [bridge, setBridge] = useState(false);
  const r = braess(4000, bridge);
  return (
    <>
      <div className="w-pdx__row">
        <button type="button" className={`w-pdx__btn${!bridge ? " is-on" : ""}`} onClick={() => setBridge(false)}>
          {t("Không có cầu tắt", "No shortcut")}
        </button>
        <button type="button" className={`w-pdx__btn${bridge ? " is-on" : ""}`} onClick={() => (setBridge(true), sfx.miss())}>
          {t("Mở cầu tắt X→Y", "Open shortcut X→Y")}
        </button>
      </div>
      <svg viewBox="0 0 500 130" className="w-pdx__svg">
        {[
          [60, 65, 250, 20, "T/100", bridge ? 4000 : 2000],
          [250, 20, 440, 65, "45", bridge ? 0 : 2000],
          [60, 65, 250, 110, "45", bridge ? 0 : 2000],
          [250, 110, 440, 65, "T/100", bridge ? 4000 : 2000],
        ].map(([x1, y1, x2, y2, lbl, n], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={Number(n) ? "#ffb347" : "currentColor"} strokeWidth={2 + Number(n) / 700} opacity={Number(n) ? 1 : 0.3} />
            <text x={(Number(x1) + Number(x2)) / 2} y={(Number(y1) + Number(y2)) / 2 - 6} textAnchor="middle" fontSize={11} fill="currentColor">
              {lbl} ({n})
            </text>
          </g>
        ))}
        {bridge && <line x1={250} y1={20} x2={250} y2={110} stroke="#ff7a7a" strokeWidth={3} strokeDasharray="6 4" />}
        {[
          [60, 65, "S"],
          [440, 65, "E"],
          [250, 20, "X"],
          [250, 110, "Y"],
        ].map(([x, y, s]) => (
          <g key={String(s)}>
            <circle cx={x} cy={y} r={11} fill="#3a3846" />
            <text x={x} y={Number(y) + 4} textAnchor="middle" fontSize={11} fill="#fff">
              {s}
            </text>
          </g>
        ))}
      </svg>
      <p className="w-pdx__num">
        {t("Mỗi tài xế mất", "Each driver needs")}: <b>{r.time} {t("phút", "min")}</b>
      </p>
    </>
  );
}

function GrandiLab({ t }: { t: T }) {
  const [n, setN] = useState(12);
  return (
    <>
      <Slider label={t(`Số hạng: ${n}`, `Terms: ${n}`)} value={n} min={2} max={40} onChange={setN} />
      <svg viewBox="0 0 500 80" className="w-pdx__svg">
        {Array.from({ length: n }, (_, i) => {
          const x = 10 + (i * 480) / 40;
          return <line key={i} x1={x} y1={70} x2={x} y2={70 - grandiPartial(i + 1) * 55} stroke="#fff07a" strokeWidth={4} />;
        })}
        <polyline points={Array.from({ length: n }, (_, i) => `${10 + (i * 480) / 40},${70 - cesaro(i + 1) * 55}`).join(" ")} fill="none" stroke="#ff9ec0" strokeWidth={2} />
        <line x1={10} y1={42.5} x2={490} y2={42.5} stroke="#ff9ec0" strokeDasharray="4 4" opacity={0.5} />
      </svg>
      <p className="w-pdx__num">
        {t("Tổng riêng", "Partial sum")} S{n} = <b>{grandiPartial(n)}</b> · {t("trung bình Cesàro", "Cesàro mean")} = <b>{fmt(cesaro(n), 4)}</b> → ½
      </p>
    </>
  );
}

function TwinLab({ t }: { t: T }) {
  const [v, setV] = useState(0.8);
  const a = twinAges(4, v);
  return (
    <>
      <Slider label={t(`Tốc độ: ${fmt(v * 100, 0)}% tốc độ ánh sáng`, `Speed: ${fmt(v * 100, 0)}% of light`)} value={v} min={0.1} max={0.99} step={0.01} onChange={setV} />
      <svg viewBox="0 0 500 120" className="w-pdx__svg">
        <line x1={60} y1={110} x2={60} y2={10} stroke="#7fe3ff" strokeWidth={2} />
        <polyline points={`60,110 ${60 + 4 * 45},60 60,10`} fill="none" stroke="#ffd27a" strokeWidth={2} />
        <text x={66} y={20} fontSize={10} fill="#7fe3ff">
          {t("Trái Đất", "Earth")}: {fmt(a.earth, 1)} {t("năm", "yr")}
        </text>
        <text x={60 + 4 * 45 + 8} y={64} fontSize={10} fill="#ffd27a">
          {t("tên lửa quay đầu", "rocket turns")}
        </text>
        <text x={300} y={40} fontSize={12} fill="currentColor">
          γ = {fmt(gamma(v), 3)}
        </text>
        <text x={300} y={62} fontSize={12} fill="#ffd27a">
          {t("Người du hành", "Traveller")}: {fmt(a.traveler, 2)} {t("năm", "yr")}
        </text>
        <text x={300} y={84} fontSize={12} fill="#7fe3ff">
          {t("Người ở nhà", "Stay-at-home")}: {fmt(a.earth, 2)} {t("năm", "yr")}
        </text>
      </svg>
    </>
  );
}
