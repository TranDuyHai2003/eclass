"use client";
/** Sân khấu Ba Cánh Cửa (Monty Hall): chơi thật trên sân khấu 3D, chế độ 100 cửa để thấy trực giác, và "Vì sao?" */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { X, RotateCcw, Cpu, DoorOpen } from "lucide-react";
import { useWorld } from "../store";
import { MARK } from "../scene/MontyStage";
import { decide, newRound, pickDoor, resetTally, runSimulation, useMonty } from "../scene/montyState";
import { unlockNote } from "../story/quest";
import { hostOpens, otherDoor, randInt, rate } from "@/lib/world/monty";
import { sfx } from "@/lib/world/sfx";
import "./monty.css";

type Tab = "play" | "hundred" | "why";
const pct = (w: number, n: number) => (n ? `${Math.round(rate(w, n) * 100)}%` : "—");

export function MontyPanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const [tab, setTab] = useState<Tab>("play");
  useEffect(() => {
    // Đứng vào vạch thí sinh giữa sân khấu, máy quay sau lưng nhìn thẳng ba cánh cửa
    const s = useWorld.getState();
    s.player.set(MARK.x, 0.45, MARK.z);
    useWorld.setState({ playerYaw: 0, camYaw: Math.PI, camPitch: 0.42, camDist: 6.5 });
    if (useMonty.getState().phase === "idle") newRound();
    return () => useWorld.setState({ camDist: 3.2, camPitch: 0.16 });
  }, []);
  return (
    <motion.div className="w-mstage pointer-events-auto" initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-mstage__head">
        <span className="w-mstage__kicker">{t("BA CÁNH CỬA · BÀI TOÁN MONTY HALL", "THE THREE DOORS · MONTY HALL PROBLEM")}</span>
        <nav className="w-mstage__tabs">
          {(
            [
              ["play", t("Chơi", "Play")],
              ["hundred", t("100 cửa", "100 doors")],
              ["why", t("Vì sao?", "Why?")],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" className={`w-mstage__tab${tab === id ? " is-on" : ""}`} onClick={() => (setTab(id), sfx.click())}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className="w-mstage__btn w-mstage__btn--icon" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      {tab === "play" && <Play t={t} />}
      {tab === "hundred" && <Hundred t={t} />}
      {tab === "why" && <Why t={t} />}
    </motion.div>
  );
}

type T = (vi: string, en: string) => string;
function shuffle<V>(a: V[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const DOOR_CLS = ["is-pink", "is-teal", "is-gold"];

function Play({ t }: { t: T }) {
  const { phase, pick, keep, opened, final, car, swapped, tally, sim, simTarget } = useMonty();
  const win = phase === "result" && final === car;
  useEffect(() => {
    if (phase === "result") unlockNote("monty");
  }, [phase]);
  return (
    <div className="w-mstage__body">
      {phase === "idle" && <p>{t("Sau một cánh cửa là chiếc xe, sau hai cửa kia là dê. Bạn chọn cửa nào?", "Behind one door is a car, behind the other two are goats. Which door do you choose?")}</p>}
      {phase === "hostOpening" && <p>{t(`Bạn chọn cửa ${pick + 1}. MC Lumi biết xe ở đâu… và mở một cửa khác…`, `You chose door ${pick + 1}. Lumi knows where the car is… and opens another door…`)}</p>}
      {phase === "decide" && (
        <p>
          {t(`Cửa ${opened[0] + 1}: một con dê! Bạn giữ cửa ${pick + 1}, hay đổi sang cửa ${keep + 1}?`, `Door ${opened[0] + 1}: a goat! Do you stay with door ${pick + 1}, or switch to door ${keep + 1}?`)}
        </p>
      )}
      {phase === "finalOpening" && <p className="w-mstage__drum">{t(`Cửa ${final + 1}… trống dồn…`, `Door ${final + 1}… drum roll…`)}</p>}
      {phase === "result" && (
        <p className={`w-mstage__result${win ? " is-win" : ""}`}>
          <b>{win ? t("CHIẾC XE LÀ CỦA BẠN!", "YOU WIN THE CAR!") : t("Một con dê… dễ thương nhưng không phải xe.", "A goat… adorable, but not a car.")}</b>{" "}
          {swapped
            ? win
              ? t("Đổi thắng mỗi khi lần chọn đầu trượt — tức 2 trên 3 lần.", "Switching wins whenever your first pick was wrong — 2 times in 3.")
              : t("Đổi chỉ thua khi lần chọn đầu đã trúng xe — 1 trên 3 lần.", "Switching only loses when your first pick was already the car — 1 time in 3.")
            : win
              ? t("Giữ chỉ thắng khi lần chọn đầu trúng ngay — 1 trên 3 lần.", "Staying only wins when your first pick was right — 1 time in 3.")
              : t("Xe nằm ở cánh cửa MC cố tình chừa lại.", "The car was behind the door the host carefully left closed.")}
        </p>
      )}
      <div className="w-mstage__row">
        {phase === "idle" &&
          [0, 1, 2].map((i) => (
            <button key={i} type="button" className={`w-mstage__door ${DOOR_CLS[i]}`} onClick={() => pickDoor(i)}>
              <DoorOpen />
              {t(`Cửa ${i + 1}`, `Door ${i + 1}`)}
            </button>
          ))}
        {phase === "decide" && (
          <>
            <button type="button" className="w-mstage__btn" onClick={() => decide(false)}>
              {t(`Giữ cửa ${pick + 1}`, `Stay with ${pick + 1}`)}
            </button>
            <button type="button" className="w-mstage__btn w-mstage__btn--hot" onClick={() => decide(true)}>
              {t(`Đổi sang cửa ${keep + 1}`, `Switch to ${keep + 1}`)}
            </button>
          </>
        )}
        {phase === "result" && (
          <>
            <button type="button" className="w-mstage__btn w-mstage__btn--hot" onClick={newRound}>
              <RotateCcw />
              {t("Ván mới", "New round")}
            </button>
            <button type="button" className="w-mstage__btn" onClick={() => runSimulation(1000)}>
              <Cpu />
              {t("Cho máy chơi 1000 ván", "Let the computer play 1000")}
            </button>
          </>
        )}
      </div>
      <div className="w-mstage__stats">
        <span>
          {t("Bạn · giữ", "You · stay")} <b>{pct(tally.stayWin, tally.stayN)}</b> ({tally.stayWin}/{tally.stayN})
        </span>
        <span>
          {t("đổi", "switch")} <b>{pct(tally.swapWin, tally.swapN)}</b> ({tally.swapWin}/{tally.swapN})
        </span>
        {simTarget > 0 && (
          <span className="is-sim">
            {t("Máy", "Computer")} · {t("giữ", "stay")} <b>{pct(sim.stayWin, sim.stayN)}</b> · {t("đổi", "switch")} <b>{pct(sim.swapWin, sim.swapN)}</b> ({sim.stayN}/{simTarget})
          </span>
        )}
        {(tally.stayN + tally.swapN > 0 || simTarget > 0) && (
          <button type="button" className="w-mstage__link" onClick={resetTally}>
            {t("xoá điểm", "reset")}
          </button>
        )}
      </div>
    </div>
  );
}

/** 100 cửa: chọn 1, MC mở 98 cửa dê → còn cửa của bạn và đúng một cửa MC chừa lại */
function Hundred({ t }: { t: T }) {
  const N = 100;
  const [car, setCar] = useState(() => randInt(N));
  const [pick, setPick] = useState(-1);
  const [keep, setKeep] = useState(-1);
  const [shown, setShown] = useState(0);
  const [final, setFinal] = useState(-1);
  const [order, setOrder] = useState<number[]>([]);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const choose = (i: number) => {
    if (pick >= 0) return;
    const k = otherDoor(N, car, i);
    setOrder(shuffle(hostOpens(N, i, k)));
    setPick(i);
    setKeep(k);
    sfx.drumroll(1.6);
    let n = 0;
    timer.current = window.setInterval(() => {
      n = Math.min(N - 2, n + 4);
      setShown(n);
      if (n >= N - 2 && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        sfx.baa();
      }
    }, 60);
  };
  const end = (swap: boolean) => {
    const f = swap ? keep : pick;
    setFinal(f);
    if (f === car) sfx.fanfare();
    else sfx.baa();
  };
  const again = () => {
    setCar(randInt(N));
    setPick(-1);
    setKeep(-1);
    setShown(0);
    setFinal(-1);
    setOrder([]);
  };
  const openSet = new Set(order.slice(0, shown));
  const ready = pick >= 0 && shown >= N - 2;
  return (
    <div className="w-mstage__body">
      <p>
        {pick < 0
          ? t("100 cánh cửa, chỉ 1 chiếc xe. Chọn một cửa bất kỳ.", "100 doors, just 1 car. Pick any door.")
          : !ready
            ? t("MC mở các cửa dê — trừ cửa của bạn và đúng MỘT cửa khác…", "The host opens goat doors — all except yours and exactly ONE other…")
            : final < 0
              ? t(`Còn cửa ${pick + 1} của bạn (chọn bừa, 1%) và cửa ${keep + 1} — cửa duy nhất MC né. Giữ hay đổi?`, `Left: your door ${pick + 1} (a blind 1% guess) and door ${keep + 1} — the one door the host avoided. Stay or switch?`)
              : final === car
                ? t("Xe! Thấy chưa: cửa MC chừa lại gần như chắc chắn là xe.", "Car! See? The door the host left is almost certainly the car.")
                : t("Dê… Bạn đã cược vào 1%. Thử lại và đổi xem!", "Goat… You bet on the 1%. Try again and switch!")}
      </p>
      <div className="w-mstage__grid" role="grid">
        {Array.from({ length: N }, (_, i) => {
          const prize = final >= 0 || openSet.has(i) ? (i === car ? "car" : "goat") : "";
          return (
            <button
              key={i}
              type="button"
              disabled={pick >= 0}
              className={`w-mstage__cell${i === pick ? " is-pick" : ""}${i === keep && ready ? " is-keep" : ""}${prize ? ` is-${prize}` : ""}`}
              onClick={() => choose(i)}
              aria-label={`${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="w-mstage__row">
        {ready && final < 0 && (
          <>
            <button type="button" className="w-mstage__btn" onClick={() => end(false)}>
              {t(`Giữ cửa ${pick + 1}`, `Stay with ${pick + 1}`)}
            </button>
            <button type="button" className="w-mstage__btn w-mstage__btn--hot" onClick={() => end(true)}>
              {t(`Đổi sang cửa ${keep + 1}`, `Switch to ${keep + 1}`)}
            </button>
          </>
        )}
        {final >= 0 && (
          <button type="button" className="w-mstage__btn w-mstage__btn--hot" onClick={again}>
            <RotateCcw />
            {t("Chơi lại", "Play again")}
          </button>
        )}
      </div>
    </div>
  );
}

function Why({ t }: { t: T }) {
  const rows: [string, string, string, string][] = [
    [t("Xe sau cửa 1", "Car behind 1"), t("MC mở 2 hoặc 3", "Host opens 2 or 3"), t("THẮNG", "WIN"), t("thua", "lose")],
    [t("Xe sau cửa 2", "Car behind 2"), t("MC buộc phải mở 3", "Host must open 3"), t("thua", "lose"), t("THẮNG", "WIN")],
    [t("Xe sau cửa 3", "Car behind 3"), t("MC buộc phải mở 2", "Host must open 2"), t("thua", "lose"), t("THẮNG", "WIN")],
  ];
  return (
    <div className="w-mstage__body w-mstage__why">
      <p>{t("Giả sử bạn chọn cửa 1. Xe có thể ở một trong ba cửa, mỗi khả năng 1/3:", "Say you pick door 1. The car is behind one of three doors, each with chance 1/3:")}</p>
      <table className="w-mstage__table">
        <thead>
          <tr>
            <th />
            <th>{t("MC làm gì", "Host does")}</th>
            <th>{t("Giữ", "Stay")}</th>
            <th>{t("Đổi", "Switch")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={c === "THẮNG" || c === "WIN" ? "is-win" : ""}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <b>{t("Giữ thắng 1/3, đổi thắng 2/3.", "Stay wins 1/3, switch wins 2/3.")}</b>{" "}
        {t(
          "Lần chọn đầu chỉ trúng 1/3. Hai phần ba còn lại dồn hết vào cánh cửa MC chừa lại, vì MC BIẾT xe ở đâu và không bao giờ mở cửa xe — hành động của MC mang thông tin.",
          "Your first pick is right only 1/3 of the time. The other 2/3 all flows into the door the host leaves closed, because the host KNOWS where the car is and never opens it — the host's action carries information.",
        )}
      </p>
      <p className="w-mstage__note">
        {t(
          "Nghĩ thêm: nếu MC mở bừa một cửa (có thể lộ xe) và tình cờ ra dê, thì đổi hay giữ đều 1/2! Cùng một cảnh trước mắt, nhưng cách thông tin được tạo ra khác nhau thì xác suất khác nhau. Năm 1990 khoảng 10 000 độc giả (nhiều người có bằng tiến sĩ) viết thư bảo lời giải 2/3 là sai — mô phỏng máy tính đã phân xử.",
          "Think further: if the host opened a door at random (it might reveal the car) and it happened to show a goat, staying and switching would both be 1/2! Same scene in front of you, different way the information was produced, different probabilities. In 1990 about 10 000 readers (many with PhDs) wrote in to say the 2/3 answer was wrong — computer simulations settled it.",
        )}
      </p>
    </div>
  );
}
