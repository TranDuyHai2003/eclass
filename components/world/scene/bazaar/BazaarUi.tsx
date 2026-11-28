"use client";
/**
 * Giao diện Chợ Xác Suất (lớp DOM): thẻ dấu quầy + vé hội, lời gợi ý / à há, và bảng quầy (không che màn hình —
 * neo bên phải để vẫn thấy cảnh 3D chạy). Mỗi quầy: Đoán → Xem → Thương vụ (nhận / bỏ, chấm theo kì vọng) → Dấu.
 */
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorld } from "../../store";
import {
  CHEST_GOLD,
  DAYS,
  P_RED,
  SLIME_STAGES,
  STALLS,
  birthdayP,
  diceCounts,
  diceTotal,
  offerEV,
  pairs,
  posterior,
  wheelOffers,
  type Offer,
  type StallId,
} from "@/lib/world/bazaar";
import {
  chestFx,
  decideOffer,
  mimicReveal,
  mimicSweep,
  releaseSlimes,
  setStep,
  settleDeal,
  startDeal,
  useBazaar,
  wheelMany,
  wheelWatch,
  wispMany,
  wispWatch,
} from "./bazaarState";

const NAMES: Record<StallId, { vi: string; en: string }> = {
  wisp: { vi: "Đèn Năm", en: "Year Lanterns" },
  mimic: { vi: "Rương Mimic", en: "Mimic Chests" },
  slime: { vi: "Ruộng Slime", en: "Slime Ranch" },
  wheel: { vi: "Bánh Xe Chuỗi", en: "Streak Wheel" },
};
const ICON: Record<StallId, string> = {
  wisp: "✦",
  mimic: "▣",
  slime: "●",
  wheel: "◎",
};

function pct(x: number, vi: boolean, d = 1) {
  const s = (x * 100).toFixed(d);
  return `${vi ? s.replace(".", ",") : s}%`;
}
function num(x: number, vi: boolean, d = 2) {
  const s = (Math.round(x * 10 ** d) / 10 ** d).toString();
  return vi ? s.replace(".", ",") : s;
}

function Btn({
  onClick,
  children,
  kind = "main",
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  kind?: "main" | "ghost" | "yes" | "no" | "yesOn" | "noOn";
  disabled?: boolean;
}) {
  const cls = {
    main: "bg-amber-300 text-slate-900 hover:bg-amber-200",
    ghost: "bg-white/10 text-white hover:bg-white/20",
    yes: "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40",
    no: "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/40",
    yesOn: "bg-emerald-400 text-slate-900",
    noOn: "bg-rose-400 text-slate-900",
  }[kind];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-bold transition disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  fmt,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-300"
      />
      <span className="w-16 text-right font-mono text-[13px] font-bold text-amber-200">
        {fmt(value)}
      </span>
    </div>
  );
}

/** biểu đồ cột nhỏ (SVG) có vạch đoán + vạch thật */
function Bars({
  values,
  from,
  guess,
  truth,
  color = "#ffd27a",
  labelEvery = 5,
}: {
  values: number[];
  from: number;
  guess?: number;
  truth?: number;
  color?: string;
  labelEvery?: number;
}) {
  const W = 330;
  const H = 86;
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  const x = (v: number) => (v - from + 0.5) * bw;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} className="mt-1 block">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * bw + 0.5}
          y={H - (v / max) * H}
          width={Math.max(1, bw - 1)}
          height={(v / max) * H}
          fill={color}
          opacity={0.85}
          rx={1}
        />
      ))}
      {values.map((_, i) =>
        (i + from) % labelEvery === 0 ? (
          <text
            key={`t${i}`}
            x={x(i + from)}
            y={H + 11}
            fontSize={9}
            fill="rgba(255,255,255,0.6)"
            textAnchor="middle"
          >
            {i + from}
          </text>
        ) : null,
      )}
      {guess !== undefined && (
        <line
          x1={x(guess)}
          x2={x(guess)}
          y1={0}
          y2={H}
          stroke="#7cf0ff"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}
      {truth !== undefined && (
        <line
          x1={x(truth)}
          x2={x(truth)}
          y1={0}
          y2={H}
          stroke="#ff8ad8"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

function Legend({
  vi,
  guessLabel,
  truthLabel,
}: {
  vi: boolean;
  guessLabel: string;
  truthLabel: string;
}) {
  void vi;
  return (
    <div className="mt-0.5 flex gap-3 text-[11px] text-white/70">
      <span>
        <i className="mr-1 inline-block h-0.5 w-3 bg-[#7cf0ff] align-middle" />
        {guessLabel}
      </span>
      <span>
        <i className="mr-1 inline-block h-0.5 w-3 bg-[#ff8ad8] align-middle" />
        {truthLabel}
      </span>
    </div>
  );
}

// ───────────── Thương vụ (chung cho Đèn Năm / Rương / Bánh xe) ─────────────

function offerText(
  o: Offer,
  i: number,
  vi: boolean,
): { title: string; sub: string } {
  if (o.kind === "jar")
    return {
      title: vi ? `Vò ${o.jar} con đom đóm` : `A jar of ${o.jar} wisps`,
      sub: vi
        ? "Bà Lịch cá: KHÔNG có hai con chung đèn. Bạn đặt 1 vé cược 'có trùng' — thắng nhận 2."
        : "The Keeper bets NO two share a lantern. You stake 1 ticket on 'a match' — win 2.",
    };
  if (o.kind === "chest") {
    const r = (o.readings ?? [])
      .map((x) => (x ? (vi ? "ĐỎ" : "RED") : vi ? "xanh" : "green"))
      .join(" + ");
    return {
      title: vi
        ? `Rương ${i + 1} · xe hàng ${Math.round((o.base ?? 0) * 100)}% mimic`
        : `Chest ${i + 1} · cart ${Math.round((o.base ?? 0) * 100)}% mimics`,
      sub: vi
        ? `Đèn Soi (${(o.readings ?? []).length} lần): ${r}. Giá 1 vé, rương thường có ${CHEST_GOLD} vé.`
        : `Lantern (${(o.readings ?? []).length} reading${(o.readings ?? []).length > 1 ? "s" : ""}): ${r}. Costs 1, a real chest holds ${CHEST_GOLD}.`,
    };
  }
  const col =
    o.color === "r"
      ? vi
        ? "ĐỎ"
        : "RED"
      : o.color === "b"
        ? vi
          ? "ĐEN"
          : "BLACK"
        : vi
          ? "XANH"
          : "GREEN";
  const who =
    o.who === "seer"
      ? vi
        ? "Thầy Chuỗi"
        : "The Streak Seer"
      : vi
        ? "Cô Hàng Bên"
        : "The Next-Stall Lady";
  const pitch =
    o.who === "seer"
      ? o.color === "b"
        ? vi
          ? `"Đỏ ra ${o.streak} lần liền rồi — Đen CHẮC CHẮN sắp về!"`
          : `"Red came ${o.streak} times in a row — black is DUE!"`
        : o.color === "r"
          ? vi
            ? `"Đỏ đang hên, ${o.streak} lần liền — theo vận đi!"`
            : `"Red is hot, ${o.streak} in a row — ride the luck!"`
          : vi
            ? `"Ô Xanh lâu lắm chưa ra — sắp tới lượt nó!"`
            : `"Green hasn't come up for ages — it's overdue!"`
      : vi
        ? `"Tôi không đoán chuỗi. Tôi chỉ trả cao hơn một chút."`
        : `"I don't read streaks. I just pay a little more."`;
  return {
    title: `${who}: ${vi ? "cược" : "bet"} ${col} ×${num(o.payout, vi, 1)}`,
    sub: pitch,
  };
}

function whyText(o: Offer, vi: boolean): string {
  const ev = offerEV(o);
  const evs = `${ev > 0 ? "+" : ""}${num(ev, vi)}`;
  if (o.kind === "jar")
    return vi
      ? `P(trùng | ${o.jar} con) = ${pct(o.pWin, vi)} (${pairs(o.jar ?? 0)} cặp) → kì vọng ${evs} vé/lần`
      : `P(match | ${o.jar}) = ${pct(o.pWin, vi)} (${pairs(o.jar ?? 0)} pairs) → expected ${evs} tickets`;
  if (o.kind === "chest")
    return vi
      ? `P(mimic | đèn) = ${pct(1 - o.pWin, vi)} → kì vọng ${num(o.pWin * CHEST_GOLD, vi)} − 1 = ${evs} vé`
      : `P(mimic | lamps) = ${pct(1 - o.pWin, vi)} → expected ${num(o.pWin * CHEST_GOLD, vi)} − 1 = ${evs}`;
  return vi
    ? `P(thắng) = ${o.color === "g" ? "1/37" : "18/37"} = ${pct(o.pWin, vi)} — chuỗi trước không đổi được số này → kì vọng ${evs} vé`
    : `P(win) = ${o.color === "g" ? "1/37" : "18/37"} = ${pct(o.pWin, vi)} — no streak changes that → expected ${evs}`;
}

function outcomeText(
  o: Offer,
  r: { win: boolean; detail: number },
  vi: boolean,
): string {
  const d = r.win ? `+${num(o.payout - 1, vi, 1)}` : "−1";
  if (o.kind === "jar")
    return r.win
      ? vi
        ? `trùng ở con thứ ${r.detail} (${d} vé)`
        : `match at wisp #${r.detail} (${d})`
      : vi
        ? `không trùng (${d} vé)`
        : `no match (${d})`;
  if (o.kind === "chest")
    return r.win
      ? vi
        ? `rương thật! (${d} vé)`
        : `a real chest! (${d})`
      : vi
        ? `MIMIC cắn! (${d} vé)`
        : `MIMIC bites! (${d})`;
  return vi ? `ra ô ${r.detail} (${d} vé)` : `landed on ${r.detail} (${d})`;
}

function Deal({ st, vi }: { st: StallId; vi: boolean }) {
  const offers = useBazaar((s) => s.offers);
  const accepts = useBazaar((s) => s.accepts);
  const result = useBazaar((s) => s.result);
  const stamp = useBazaar((s) => s.stamps[st]);
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-white/70">
        {vi
          ? "Nhận hay bỏ từng vụ. Thắng / thua là may rủi — quầy chấm QUYẾT ĐỊNH của bạn theo kì vọng."
          : "Take or pass each deal. Winning is luck — the stall grades your DECISION by expected value."}
      </p>
      {offers.map((o, i) => {
        const t = offerText(o, i, vi);
        const v = result?.verdicts[i];
        const r = result?.outcomes[i];
        return (
          <div
            key={o.id + i}
            className={`rounded-xl p-2 ring-1 ${v ? (v.right ? "bg-emerald-500/10 ring-emerald-300/40" : "bg-rose-500/10 ring-rose-300/40") : "bg-white/5 ring-white/10"}`}
          >
            <div className="text-[13px] font-bold">{t.title}</div>
            <div className="text-[12px] text-white/75">{t.sub}</div>
            {!result ? (
              <div className="mt-1.5 flex gap-2">
                <Btn
                  kind={accepts[i] === true ? "yesOn" : "yes"}
                  onClick={() => decideOffer(i, true)}
                >
                  {o.kind === "chest"
                    ? vi
                      ? "Mua"
                      : "Buy"
                    : vi
                      ? "Nhận cược"
                      : "Take it"}
                </Btn>
                <Btn
                  kind={accepts[i] === false ? "noOn" : "no"}
                  onClick={() => decideOffer(i, false)}
                >
                  {vi ? "Bỏ qua" : "Pass"}
                </Btn>
              </div>
            ) : (
              <div className="mt-1 text-[12px]">
                <div
                  className={v!.right ? "text-emerald-200" : "text-rose-200"}
                >
                  {v!.right ? "✔ " : "✘ "}
                  {v!.accepted
                    ? vi
                      ? "Bạn nhận"
                      : "You took it"
                    : vi
                      ? "Bạn bỏ"
                      : "You passed"}
                  {r ? ` — ${outcomeText(o, r, vi)}` : ""}
                </div>
                <div className="text-white/70">{whyText(o, vi)}</div>
              </div>
            )}
          </div>
        );
      })}
      {!result && (
        <Btn
          disabled={accepts.some((a) => a === null)}
          onClick={() => settleDeal(st)}
        >
          {vi ? "Chốt các vụ" : "Settle the deals"}
        </Btn>
      )}
      {result && (
        <div
          className={`rounded-xl p-2 text-[13px] font-bold ${result.allRight ? "bg-amber-300/20 text-amber-100" : "bg-white/5 text-white/85"}`}
        >
          {result.allRight
            ? vi
              ? `Cả ba quyết định đều đúng kì vọng! ${stamp ? `Dấu ${NAMES[st].vi} ✦` : ""}`
              : `All three decisions match expected value! ${stamp ? `${NAMES[st].en} stamp ✦` : ""}`
            : vi
              ? "Có vụ chọn chưa đúng kì vọng (dù có thể vẫn thắng nhờ may). Xem dòng giải thích rồi thử bộ khác."
              : "Some choices went against expected value (even if luck paid). Read the reasons, then try a fresh set."}
          <div className="mt-1.5 flex gap-2">
            {!result.allRight && (
              <Btn onClick={() => startDeal(st)}>
                {vi ? "Thử bộ khác" : "Try a fresh set"}
              </Btn>
            )}
            {result.allRight && (
              <Btn kind="ghost" onClick={() => setStep(st, "guess")}>
                {vi ? "Chơi lại từ đầu" : "Play again"}
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── Từng quầy ─────────────

function WispPanel({ vi }: { vi: boolean }) {
  const step = useBazaar((s) => s.step.wisp);
  const guess = useBazaar((s) => s.guess.wisp);
  const first = useBazaar((s) => s.wispFirst);
  const hist = useBazaar((s) => s.wispHist);
  const setGuess = (v: number) =>
    useBazaar.setState({ guess: { ...useBazaar.getState().guess, wisp: v } });
  return (
    <div className="space-y-2 text-[13px] leading-snug">
      <p className="text-white/85">
        {vi
          ? `${DAYS} đèn lồng = ${DAYS} đêm trong năm. Mỗi đom đóm sinh vào một đêm ngẫu nhiên và bay về đèn của đêm ấy. Hai con chung một đèn → nổ thành pháo hoa.`
          : `${DAYS} lanterns = ${DAYS} nights of the year. Each wisp is born on a random night and flies to that lantern. Two wisps in one lantern → fireworks.`}
      </p>
      {step === "guess" && (
        <>
          <p className="font-bold text-amber-100">
            {vi
              ? "Đoán: thả từng con một — trung bình đến con thứ mấy thì có hai con CHUNG một đèn?"
              : "Guess: releasing one by one — around which wisp do two first SHARE a lantern?"}
          </p>
          <Slider
            value={guess}
            min={2}
            max={183}
            onChange={setGuess}
            fmt={(v) => `#${v}`}
          />
          <Btn onClick={wispWatch}>
            {vi ? "Chốt & mở vò" : "Lock in & open the jar"}
          </Btn>
        </>
      )}
      {step === "watch" && (
        <>
          <p>
            {vi ? "Bạn đoán: " : "Your guess: "}
            <b className="text-cyan-200">#{guess}</b>.{" "}
            {first > 0 && (
              <>
                {vi ? "Vò vừa rồi trùng ở con " : "This jar matched at wisp "}
                <b className="text-pink-200">#{first}</b>.
              </>
            )}
          </p>
          {!hist ? (
            <Btn onClick={wispMany}>
              {vi
                ? "Một vò thì may rủi — mở 1000 vò"
                : "One jar is luck — open 1000 jars"}
            </Btn>
          ) : (
            <>
              <Bars
                values={hist.hist.slice(1, 81)}
                from={1}
                guess={Math.min(80, guess)}
                truth={hist.median}
                color="#ffd27a"
                labelEvery={10}
              />
              <Legend
                vi={vi}
                guessLabel={vi ? "bạn đoán" : "your guess"}
                truthLabel={
                  vi
                    ? `trung vị: con #${hist.median}`
                    : `median: wisp #${hist.median}`
                }
              />
              <p className="rounded-xl bg-white/5 p-2 text-white/85">
                {vi
                  ? `Một nửa số vò đã trùng trước con #${hist.median} (trung bình ${num(hist.mean, vi, 1)}). Bí mật: không đếm CON mà đếm CẶP — 23 con có ${pairs(23)} cặp, cặp nào cũng có thể trùng. P(23 con có trùng) = ${pct(birthdayP(23), vi)}.`
                  : `Half the jars matched before wisp #${hist.median} (mean ${num(hist.mean, vi, 1)}). The secret: count PAIRS, not wisps — 23 wisps make ${pairs(23)} pairs, any of which can match. P(match among 23) = ${pct(birthdayP(23), vi)}.`}
              </p>
              <Btn onClick={() => setStep("wisp", "deal")}>
                {vi ? "Sang thương vụ với Bà Lịch" : "Deal with the Keeper"}
              </Btn>
            </>
          )}
        </>
      )}
      {(step === "deal" || step === "done") && <Deal st="wisp" vi={vi} />}
    </div>
  );
}

function Mosaic({ vi }: { vi: boolean }) {
  const f = chestFx.field;
  return (
    <div>
      <div className="grid w-[200px] grid-cols-10 gap-[3px]">
        {f.map((c, i) => (
          <i
            key={i}
            className={`block h-[15px] w-[15px] rounded-[3px] ${c.red ? (c.mimic ? "bg-fuchsia-500 ring-2 ring-red-400" : "bg-amber-300 ring-2 ring-red-400") : c.mimic ? "bg-fuchsia-500/60" : "bg-white/15"}`}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-white/70">
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-fuchsia-500 align-middle ring-2 ring-red-400" />
          {vi ? "mimic, đèn đỏ (9)" : "mimic, red (9)"}
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-300 align-middle ring-2 ring-red-400" />
          {vi ? "rương thật, đỏ nhầm (18)" : "real chest, false red (18)"}
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-fuchsia-500/60 align-middle" />
          {vi ? "mimic lọt (1)" : "missed mimic (1)"}
        </span>
      </div>
    </div>
  );
}

function MimicPanel({ vi }: { vi: boolean }) {
  const step = useBazaar((s) => s.step.mimic);
  const guess = useBazaar((s) => s.guess.mimic);
  const shown = useBazaar((s) => s.fieldShown);
  const setGuess = (v: number) =>
    useBazaar.setState({ guess: { ...useBazaar.getState().guess, mimic: v } });
  const truth = posterior(0.1, [true]);
  return (
    <div className="space-y-2 text-[13px] leading-snug">
      <p className="text-white/85">
        {vi
          ? "Bãi có 100 rương, 10% là MIMIC. Đèn Soi bật đỏ với 90% mimic — nhưng cũng báo nhầm 20% rương thường."
          : "The yard holds 100 chests; 10% are MIMICS. The Lantern glows red for 90% of mimics — but also for 20% of real chests."}
      </p>
      {step === "guess" && (
        <>
          <p className="font-bold text-amber-100">
            {vi
              ? "Đoán: một rương ĐÈN ĐỎ — khả năng nó là mimic?"
              : "Guess: a chest with a RED lamp — how likely is it a mimic?"}
          </p>
          <Slider
            value={guess}
            min={0}
            max={100}
            onChange={setGuess}
            fmt={(v) => `${v}%`}
          />
          <Btn onClick={mimicSweep}>
            {vi ? "Chốt & soi cả bãi" : "Lock in & sweep the yard"}
          </Btn>
        </>
      )}
      {step === "watch" && (
        <>
          {shown !== "reveal" ? (
            <>
              <p>
                {vi
                  ? "Đèn Soi quét từng hàng… 27 rương bật đỏ. Mở hết chúng ra xem?"
                  : "The Lantern sweeps row by row… 27 chests glow red. Open them all?"}
              </p>
              <Btn onClick={mimicReveal}>
                {vi ? "Mở mọi rương đèn đỏ" : "Open every red chest"}
              </Btn>
            </>
          ) : (
            <>
              <Mosaic vi={vi} />
              <p className="rounded-xl bg-white/5 p-2 text-white/85">
                {vi
                  ? `Bạn đoán ${guess}%. Thật: 9 mimic / 27 đèn đỏ = ${pct(truth, vi)}. Mimic HIẾM (10 con → 9 đỏ), rương thường NHIỀU (90 → 18 đỏ nhầm). Đèn đỏ chỉ nhân tỉ số cược lên 0,9 / 0,2 = 4,5 lần: 1 : 9 → 4,5 : 9 = 1 : 2.`
                  : `You guessed ${guess}%. Truth: 9 mimics / 27 red = ${pct(truth, vi)}. Mimics are RARE (10 → 9 red), real chests are MANY (90 → 18 false reds). A red lamp only multiplies the odds by 0.9 / 0.2 = 4.5: 1 : 9 → 4.5 : 9 = 1 : 2.`}
              </p>
              <Btn onClick={() => setStep("mimic", "deal")}>
                {vi ? "Sang thương vụ: mua rương" : "Deals: buy chests"}
              </Btn>
            </>
          )}
        </>
      )}
      {(step === "deal" || step === "done") && <Deal st="mimic" vi={vi} />}
    </div>
  );
}

function SlimePanel({ vi }: { vi: boolean }) {
  const stage = useBazaar((s) => s.slimeStage);
  const nets = useBazaar((s) => s.nets);
  const busy = useBazaar((s) => s.slimeBusy);
  const run = useBazaar((s) => s.slimeRun);
  const stamp = useBazaar((s) => s.stamps.slime);
  if (stage >= SLIME_STAGES.length)
    return (
      <div className="space-y-2 text-[13px] leading-snug">
        <p className="font-bold text-amber-100">
          {vi
            ? "Ruộng Slime đã xong — dấu ● của bạn."
            : "Slime Ranch cleared — your ● stamp."}
        </p>
        {run && <SlimeResult vi={vi} dice={3} run={run} nets={[10, 11]} />}
        <p className="text-white/80">
          {vi
            ? "Một xúc xắc thì phẳng; cộng nhiều xúc xắc thì tổng dồn về giữa thành hình chuông — vì giữa có NHIỀU CÁCH tạo ra hơn. Đó là định lí giới hạn trung tâm."
            : "One die is flat; add several and the sum piles up in the middle as a bell — because the middle can be made in MORE WAYS. That is the central limit theorem."}
        </p>
        <Btn
          kind="ghost"
          onClick={() =>
            useBazaar.setState({ slimeStage: 0, nets: [], slimeRun: null })
          }
        >
          {vi ? "Chơi lại từ màn 1" : "Replay from stage 1"}
        </Btn>
      </div>
    );
  const st = SLIME_STAGES[stage];
  const need = st.need / diceTotal(st.dice);
  return (
    <div className="space-y-2 text-[13px] leading-snug">
      <p className="font-bold text-amber-100">
        {vi
          ? `Màn ${stage + 1}/3 — slime ${st.dice} xúc xắc · ${st.nets} lưới`
          : `Stage ${stage + 1}/3 — ${st.dice}-dice slimes · ${st.nets} net${st.nets > 1 ? "s" : ""}`}
        {stamp ? " ●" : ""}
      </p>
      <p className="text-white/85">
        {vi
          ? `Mỗi slime nhảy ${st.dice} bước, mỗi bước dài bằng một mặt xúc xắc (1–6), rồi dừng ở ô = TỔNG. Đứng trên đường ray, bấm F để cắm lưới. Cần chọn chỗ bắt được ≥ ${pct(need, vi, 1)} số slime (tính theo xác suất, không theo may).`
          : `Each slime hops ${st.dice} time${st.dice > 1 ? "s" : ""}, each hop as long as a die face (1–6), and stops on tile = the SUM. Stand on the track and press F to plant a net. Pick tiles that catch ≥ ${pct(need, vi, 1)} of slimes (by probability, not luck).`}
      </p>
      <p>
        {vi ? "Lưới: " : "Nets: "}
        {nets.length ? (
          nets.map((t) => (
            <b
              key={t}
              className="mr-1 rounded bg-amber-300/20 px-1.5 text-amber-100"
            >
              {t}
            </b>
          ))
        ) : (
          <span className="text-white/50">{vi ? "chưa cắm" : "none yet"}</span>
        )}
        <span className="text-white/50"> / {st.nets}</span>
      </p>
      <Btn disabled={busy || !nets.length} onClick={releaseSlimes}>
        {busy
          ? vi
            ? "Đàn slime đang nhảy…"
            : "Slimes hopping…"
          : vi
            ? `Thả đàn slime (${st.wave} con)`
            : `Release the herd (${st.wave})`}
      </Btn>
      {run && !busy && (
        <SlimeResult
          vi={vi}
          dice={SLIME_STAGES[Math.max(0, stage - (run.pass ? 1 : 0))].dice}
          run={run}
          nets={nets}
        />
      )}
    </div>
  );
}

function SlimeResult({
  vi,
  dice,
  run,
  nets,
}: {
  vi: boolean;
  dice: number;
  run: { caught: number; total: number; pass: boolean; sums: number[] };
  nets: number[];
}) {
  void nets;
  const counts = diceCounts(dice);
  const lo = dice;
  const hi = dice * 6;
  const vals = Array.from(
    { length: hi - lo + 1 },
    (_, i) => run.sums.filter((s) => s === lo + i).length,
  );
  const best = counts.indexOf(Math.max(...counts));
  return (
    <div className="rounded-xl bg-white/5 p-2">
      <div
        className={
          run.pass ? "font-bold text-emerald-200" : "font-bold text-rose-200"
        }
      >
        {vi
          ? `Bắt được ${run.caught}/${run.total}. `
          : `Caught ${run.caught}/${run.total}. `}
        {run.pass
          ? vi
            ? "Qua màn — lưới đặt đúng chỗ nhiều cách nhất!"
            : "Stage cleared — your nets sit where the most ways are!"
          : vi
            ? "Chưa qua: lưới chưa ở chỗ nhiều cách nhất."
            : "Not yet: the nets aren't where the most ways are."}
      </div>
      <Bars
        values={vals}
        from={lo}
        truth={dice > 1 ? best : undefined}
        color="#7fe08a"
        labelEvery={dice === 1 ? 1 : 2}
      />
      <p className="text-[12px] text-white/75">
        {dice === 1
          ? vi
            ? "1 xúc xắc: mỗi ô đúng 1 cách / 6 — phẳng. Đống slime cao thấp chỉ là may."
            : "1 die: every tile has exactly 1 way in 6 — flat. Uneven piles are just luck."
          : dice === 2
            ? vi
              ? "Ô 7 có 6 cách (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) trên 36; ô 2 và 12 chỉ 1 cách."
              : "Tile 7 has 6 ways (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) out of 36; tiles 2 and 12 just 1."
            : vi
              ? "3 xúc xắc: ô 10 và 11 mỗi ô 27 cách / 216; ô 3 và 18 chỉ 1 cách. Cộng càng nhiều xúc xắc, hình càng giống chuông."
              : "3 dice: tiles 10 and 11 have 27 ways each out of 216; tiles 3 and 18 only 1. The more dice you add, the more bell-shaped it gets."}
      </p>
    </div>
  );
}

function WheelPanel({ vi }: { vi: boolean }) {
  const step = useBazaar((s) => s.step.wheel);
  const guess = useBazaar((s) => s.guess.wheel);
  const stats = useBazaar((s) => s.wheelStats);
  const variant = useBazaar((s) => s.variant.wheel);
  const setGuess = (v: number) =>
    useBazaar.setState({ guess: { ...useBazaar.getState().guess, wheel: v } });
  const k = wheelOffers(variant)[0].streak ?? 5;
  return (
    <div className="space-y-2 text-[13px] leading-snug">
      <p className="text-white/85">
        {vi
          ? "Bánh xe 37 ô: 18 Đỏ, 18 Đen, 1 Xanh (nhà cái). Thầy Chuỗi đọc 'vận' qua chuỗi kết quả."
          : "A 37-slot wheel: 18 red, 18 black, 1 green (the house). The Streak Seer reads 'fate' in streaks."}
      </p>
      {step === "guess" && (
        <>
          <p className="font-bold text-amber-100">
            {vi
              ? `Đoán: sau ${k} lần Đỏ liền, khả năng lần sau ra ĐEN là bao nhiêu?`
              : `Guess: after ${k} reds in a row, how likely is BLACK next?`}
          </p>
          <Slider
            value={guess}
            min={0}
            max={100}
            onChange={setGuess}
            fmt={(v) => `${v}%`}
          />
          <Btn onClick={wheelWatch}>
            {vi ? "Chốt & xem Thầy quay" : "Lock in & watch the Seer spin"}
          </Btn>
        </>
      )}
      {step === "watch" && (
        <>
          <p className="italic text-pink-100">
            {vi
              ? `Thầy Chuỗi: "Thấy chưa? Đỏ ${k} lần liền! Đen sắp về rồi!"`
              : `The Seer: "See? ${k} reds in a row! Black is coming!"`}
          </p>
          {!stats ? (
            <Btn onClick={wheelMany}>
              {vi
                ? "Đừng tin lời — quay 20 000 lần"
                : "Don't trust him — spin 20,000 times"}
            </Btn>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/5 p-2">
                  <div className="text-[11px] text-white/60">
                    {vi
                      ? `Sau mỗi chuỗi ≥ ${k} Đỏ (${stats.after.n} lần)`
                      : `After each ≥ ${k}-red streak (${stats.after.n})`}
                  </div>
                  <div className="text-lg font-black text-white">
                    {pct(stats.after.n ? stats.after.b / stats.after.n : 0, vi)}
                  </div>
                  <div className="text-[11px] text-white/60">
                    {vi
                      ? `ra Đen · bạn đoán ${guess}%`
                      : `black · you guessed ${guess}%`}
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 p-2">
                  <div className="text-[11px] text-white/60">
                    {vi ? "Lúc nào cũng vậy" : "Any time at all"}
                  </div>
                  <div className="text-lg font-black text-white">
                    {pct(P_RED, vi)}
                  </div>
                  <div className="text-[11px] text-white/60">
                    {vi
                      ? "18/37 — bánh xe không có trí nhớ"
                      : "18/37 — the wheel has no memory"}
                  </div>
                </div>
              </div>
              <LlnChart trace={stats.trace} vi={vi} />
              <Btn onClick={() => setStep("wheel", "deal")}>
                {vi ? "Sang thương vụ" : "To the deals"}
              </Btn>
            </>
          )}
        </>
      )}
      {(step === "deal" || step === "done") && <Deal st="wheel" vi={vi} />}
    </div>
  );
}

function LlnChart({
  trace,
  vi,
}: {
  trace: { n: number; ratio: number; gap: number }[];
  vi: boolean;
}) {
  const W = 330;
  const H = 70;
  const xs = (i: number) => 8 + (i / (trace.length - 1)) * (W - 16);
  const yr = (r: number) => H / 2 - (r - P_RED) * 300;
  const gmax = Math.max(10, ...trace.map((t) => Math.abs(t.gap)));
  const yg = (g: number) => H / 2 - (g / gmax) * (H / 2 - 4);
  return (
    <div className="rounded-xl bg-white/5 p-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H + 12}`} className="block">
        <line
          x1={0}
          x2={W}
          y1={H / 2}
          y2={H / 2}
          stroke="rgba(255,255,255,0.25)"
        />
        <polyline
          fill="none"
          stroke="#ff5a7a"
          strokeWidth={2}
          points={trace
            .map(
              (t, i) => `${xs(i)},${Math.max(2, Math.min(H - 2, yr(t.ratio)))}`,
            )
            .join(" ")}
        />
        <polyline
          fill="none"
          stroke="#ffd27a"
          strokeWidth={2}
          strokeDasharray="4 3"
          points={trace.map((t, i) => `${xs(i)},${yg(t.gap)}`).join(" ")}
        />
        {trace.map((t, i) => (
          <text
            key={t.n}
            x={xs(i)}
            y={H + 10}
            fontSize={8}
            fill="rgba(255,255,255,0.55)"
            textAnchor="middle"
          >
            {t.n >= 1000 ? `${t.n / 1000}k` : t.n}
          </text>
        ))}
      </svg>
      <div className="text-[11px] text-white/75">
        <span className="mr-2 text-[#ff5a7a]">
          ━{" "}
          {vi
            ? "tỉ lệ Đỏ − 18/37 (dồn về 0)"
            : "red share − 18/37 (settles to 0)"}
        </span>
        <span className="text-[#ffd27a]">
          ┅{" "}
          {vi
            ? "số Đỏ − số Đen (KHÔNG về 0)"
            : "#red − #black (does NOT return to 0)"}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-white/80">
        {vi
          ? "Luật số lớn: tỉ lệ tiến về 18/37 không phải vì bánh xe 'bù' cho chuỗi cũ, mà vì hàng nghìn lần quay mới NHẤN CHÌM nó. Xem Tháp Số Lớn ở giữa chợ."
          : "Law of large numbers: the share settles to 18/37 not because the wheel 'makes up' for old streaks, but because thousands of new spins SWAMP them. See the Tower in the middle of the market."}
      </p>
    </div>
  );
}

// ───────────── Khung chung ─────────────

export function BazaarUi() {
  const vi = useWorld((s) => s.lang === "vi");
  const overlay = useWorld((s) => s.overlay);
  const hint = useBazaar((s) => s.hint);
  const panel = useBazaar((s) => s.panel);
  const stamps = useBazaar((s) => s.stamps);
  const tickets = useBazaar((s) => s.tickets);
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    setShowHint(true);
    const t = window.setTimeout(
      () => setShowHint(false),
      hint.kind === "aha" ? 13000 : 9000,
    );
    return () => window.clearTimeout(t);
  }, [hint]);
  useEffect(() => {
    if (!panel) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const h = (e: KeyboardEvent) =>
      e.key === "Escape" && useBazaar.setState({ panel: null });
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel]);
  if (overlay) return null;
  return (
    <div className="w-hud">
      <div className="pointer-events-none absolute right-[var(--pr)] top-[calc(var(--pt)+var(--u)*64px)] z-10 w-[168px] rounded-2xl bg-slate-900/55 p-2 text-white shadow-lg backdrop-blur-md">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/90">
          {vi ? "Chợ Xác Suất" : "Chance Bazaar"}
        </div>
        <ul className="space-y-0.5 text-[11px] leading-tight">
          {STALLS.map((k) => (
            <li
              key={k}
              className={stamps[k] ? "text-amber-200" : "text-white/80"}
            >
              <span className="mr-1 inline-block w-3 text-center">
                {stamps[k] ? ICON[k] : "◇"}
              </span>
              {vi ? NAMES[k].vi : NAMES[k].en}
            </li>
          ))}
        </ul>
        <div className="mt-1.5 text-[11px] text-white/80">
          {vi ? "Vé hội: " : "Fair tickets: "}
          <b className="text-amber-200">{num(tickets, vi, 1)}</b>
        </div>
      </div>

      <AnimatePresence>
        {hint && showHint && (
          <motion.div
            key={hint.at}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`pointer-events-none absolute left-1/2 top-[calc(var(--pt)+var(--u)*58px)] z-10 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-[13px] leading-snug text-white shadow-xl backdrop-blur-md ${hint.kind === "aha" ? "bg-gradient-to-r from-[#ff8ad8]/70 via-[#7a5cff]/60 to-[#ffd27a]/70" : hint.kind === "warn" ? "bg-slate-900/70" : "bg-slate-900/60"}`}
          >
            {hint.kind === "aha" && (
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">
                ✦ {vi ? "À há!" : "Aha!"} ✦
              </div>
            )}
            {vi ? hint.vi : hint.en}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && panel !== "monty" && (
          <motion.div
            key={panel}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            className="pointer-events-auto absolute right-[var(--pr)] top-[calc(var(--pt)+var(--u)*200px)] z-20 max-h-[calc(100vh-var(--pt)-var(--u)*230px)] w-[min(92vw,380px)] overflow-y-auto rounded-2xl bg-slate-900/85 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-amber-200">
                {ICON[panel]} {vi ? NAMES[panel].vi : NAMES[panel].en}
              </h2>
              <button
                type="button"
                onClick={() => useBazaar.setState({ panel: null })}
                className="rounded-full bg-white/10 px-2 text-[12px] text-white/80 hover:bg-white/20"
                aria-label={vi ? "Đóng" : "Close"}
              >
                ✕
              </button>
            </div>
            {panel === "wisp" && <WispPanel vi={vi} />}
            {panel === "mimic" && <MimicPanel vi={vi} />}
            {panel === "slime" && <SlimePanel vi={vi} />}
            {panel === "wheel" && <WheelPanel vi={vi} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
