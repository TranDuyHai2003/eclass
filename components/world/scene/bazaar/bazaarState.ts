"use client";
/**
 * Chợ Xác Suất — trạng thái cảnh (zustand) + hành động của từng quầy. Lớp DOM (BazaarUi) và lớp 3D (các quầy) đều đọc từ đây;
 * hiệu ứng 3D nhận "sự kiện" qua các đối tượng FX (không React) để khỏi vẽ lại cây React mỗi khung.
 * Logic xác suất ở lib/world/bazaar.ts (thuần, có test). Tiến trình lưu localStorage theo trình duyệt.
 */
import { create } from "zustand";
import {
  NO_PROGRESS,
  SLIME_STAGES,
  afterStreak,
  chestField,
  findStreak,
  firstCollisionHistogram,
  judge,
  llnTrace,
  mimicOffers,
  mulberry32,
  parseProgress,
  playOffer,
  releaseJar,
  slimeWave,
  spinSeq,
  stagePass,
  caught,
  wheelOffers,
  wispOffers,
  type BazaarProgress,
  type Chest,
  type Offer,
  type Slime,
  type StallId,
  type Verdict,
} from "@/lib/world/bazaar";
import { sfx } from "@/lib/world/sfx";
import { unlockNote } from "../../story/quest";
import { addMat } from "../../combat/items";

const KEY = "world.bazaar";

export type Step = "guess" | "watch" | "deal" | "done";
export type BazaarHint = {
  vi: string;
  en: string;
  at: number;
  kind: "info" | "aha" | "warn";
};
export type Panel = StallId | "monty" | null;

export interface DealResult {
  verdicts: Verdict[];
  allRight: boolean;
  outcomes: ({ win: boolean; detail: number } | null)[];
  delta: number;
}

type S = BazaarProgress & {
  hint: BazaarHint | null;
  panel: Panel;
  step: Record<StallId, Step>;
  guess: Record<StallId, number>;
  variant: Record<StallId, number>;
  /** thương vụ đang bày ở quầy đang mở */
  offers: Offer[];
  accepts: (boolean | null)[];
  result: DealResult | null;
  // ── Đèn Năm
  wispHist: ReturnType<typeof firstCollisionHistogram> | null;
  wispFirst: number;
  // ── Rương
  fieldShown: "none" | "sweep" | "reveal";
  // ── Slime
  nets: number[];
  slimeRun: {
    caught: number;
    total: number;
    pass: boolean;
    sums: number[];
  } | null;
  slimeBusy: boolean;
  // ── Bánh xe
  wheelStats: {
    after: { r: number; b: number; g: number; n: number };
    trace: { n: number; ratio: number; gap: number }[];
    spins: number;
  } | null;
};

const STEP0: Record<StallId, Step> = {
  wisp: "guess",
  mimic: "guess",
  slime: "guess",
  wheel: "guess",
};

export const useBazaar = create<S>(() => ({
  ...structuredClone(NO_PROGRESS),
  hint: null,
  panel: null,
  step: { ...STEP0 },
  guess: { wisp: 100, mimic: 80, slime: 0, wheel: 70 },
  variant: { wisp: 0, mimic: 0, slime: 0, wheel: 0 },
  offers: [],
  accepts: [],
  result: null,
  wispHist: null,
  wispFirst: 0,
  fieldShown: "none",
  nets: [],
  slimeRun: null,
  slimeBusy: false,
  wheelStats: null,
}));

function save() {
  const s = useBazaar.getState();
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        stamps: s.stamps,
        tickets: s.tickets,
        slimeStage: s.slimeStage,
        grand: s.grand,
      }),
    );
  } catch {
    /* chế độ riêng tư */
  }
}

export function loadBazaar() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* bỏ qua */
  }
  const p = parseProgress(raw);
  const step = { ...STEP0 };
  for (const k of Object.keys(step) as StallId[])
    if (p.stamps[k]) step[k] = "done";
  if (p.slimeStage < SLIME_STAGES.length) step.slime = "guess";
  useBazaar.setState({
    ...p,
    step,
    hint: null,
    panel: null,
    offers: [],
    accepts: [],
    result: null,
    nets: [],
    slimeRun: null,
    slimeBusy: false,
    fieldShown: "none",
  });
}

export function bazaarHint(
  vi: string,
  en: string,
  kind: BazaarHint["kind"] = "info",
) {
  useBazaar.setState({ hint: { vi, en, kind, at: performance.now() } });
}

let seedCounter = (Date.now() >>> 0) % 1_000_000;
const freshSeed = () =>
  (seedCounter = (seedCounter * 1103515245 + 12345) >>> 0);

// ───────────── Hiệu ứng 3D (không React) ─────────────

/** Đèn Năm: vò đang thả (đèn của từng con), lúc bắt đầu, con trùng đầu tiên */
export const wispFx = {
  slots: [] as number[],
  first: 0,
  t0: -1e9,
  gap: 0.2,
  shimmer: -1e9,
};
/** Bãi rương: 100 rương (mimic / đỏ), lúc soi, lúc mở; 3 rương thương vụ: lúc mở + có phải mimic */
export const chestFx = {
  field: chestField(1) as Chest[],
  sweepAt: -1e9,
  revealAt: -1e9,
  offerOpen: [-1e9, -1e9, -1e9],
  offerMimic: [false, false, false],
};
/** Ruộng slime: đàn đang chạy, lúc thả, các ô đã có slime rơi (đống) */
export const slimeFx = {
  wave: [] as Slime[],
  t0: -1e9,
  dice: 1,
  pile: new Array<number>(19).fill(0),
};
/** Bánh xe: dãy kết quả cần quay (chậm), lúc bắt đầu; bảng chuỗi 10 ô gần nhất; Tháp Số Lớn */
export const wheelFx = {
  queue: [] as number[],
  t0: -1e9,
  board: [] as number[],
  tower: { n: 0, ratio: 0.5, gap: 0, at: -1e9 },
  fast: -1e9,
};

export const SLIME_HOP = 0.32;
export const SLIME_GAP = 0.32;
export const WHEEL_SPIN = 1.1;

// ───────────── Quầy chung: mở / đóng, thương vụ ─────────────

export function openStall(p: Panel) {
  const s = useBazaar.getState();
  if (p === s.panel) return;
  useBazaar.setState({ panel: p, result: null });
  if (
    p &&
    p !== "monty" &&
    p !== "slime" &&
    (s.step[p] === "deal" || s.step[p] === "done")
  )
    startDeal(p);
  sfx.click();
}
export const closeStall = () => useBazaar.setState({ panel: null });

function offersFor(st: StallId, v: number): Offer[] {
  return st === "wisp"
    ? wispOffers(v)
    : st === "mimic"
      ? mimicOffers(v)
      : wheelOffers(v);
}

export function setStep(st: StallId, step: Step) {
  useBazaar.setState({ step: { ...useBazaar.getState().step, [st]: step } });
  if (step === "deal") startDeal(st);
}

export function startDeal(st: StallId) {
  const s = useBazaar.getState();
  const offers = offersFor(st, s.variant[st]);
  // hết vé thì chợ cho thêm (không bao giờ kẹt vì xui)
  if (s.tickets < 3) {
    useBazaar.setState({ tickets: s.tickets + 5 });
    bazaarHint(
      "Chợ thương người: bạn được tặng 5 vé hội.",
      "The market is kind: you get 5 free fair tickets.",
    );
  }
  useBazaar.setState({ offers, accepts: offers.map(() => null), result: null });
  if (st === "mimic") chestFx.offerOpen = [-1e9, -1e9, -1e9];
}

export function decideOffer(i: number, accept: boolean) {
  const s = useBazaar.getState();
  if (s.result) return;
  const accepts = [...s.accepts];
  accepts[i] = accept;
  useBazaar.setState({ accepts });
  sfx.click();
}

const STAMP_NOTE: Record<StallId, "birthday" | "bayes" | "clt" | "gambler"> = {
  wisp: "birthday",
  mimic: "bayes",
  slime: "clt",
  wheel: "gambler",
};

function award(st: StallId) {
  const s = useBazaar.getState();
  if (s.stamps[st]) return;
  const stamps = { ...s.stamps, [st]: true };
  useBazaar.setState({ stamps, step: { ...s.step, [st]: "done" } });
  unlockNote(STAMP_NOTE[st]);
  sfx.fanfare();
  if (Object.values(stamps).every(Boolean) && !s.grand) {
    useBazaar.setState({ grand: true });
    addMat("golden", 1);
    addMat("prime", 2);
    setTimeout(
      () =>
        bazaarHint(
          "Đủ 4 dấu! Bạn là Thương Gia Xác Suất: không tin may rủi, chỉ tin kì vọng. Quà: 1 Hạt Vàng + 2 Đá Nguyên Tố.",
          "All 4 stamps! You are a Probability Merchant: you trust expected value, not luck. Reward: 1 Golden Seed + 2 Prime Stones.",
          "aha",
        ),
      6000,
    );
  }
  save();
}

/** Chốt các thương vụ: chơi THẬT các vụ đã nhận (vé lên / xuống), chấm quyết định theo kì vọng */
export function settleDeal(st: StallId) {
  const s = useBazaar.getState();
  if (s.result || s.accepts.some((a) => a === null)) return;
  const rand = mulberry32(freshSeed());
  // Đèn Năm: thả vò thật (giữ dãy đèn để vẽ đúng vò vừa chơi); quầy khác: playOffer
  let shown: { slots: number[]; first: number } | null = null;
  const outcomes = s.offers.map((o, i) => {
    if (!s.accepts[i]) return null;
    if (o.kind !== "jar") return playOffer(o, rand);
    const jar = releaseJar(rand, o.jar ?? 0, undefined, false);
    shown = { slots: jar.slots, first: jar.first };
    return { win: jar.first > 0, detail: jar.first };
  });
  let delta = 0;
  outcomes.forEach((r, i) => {
    if (!r) return;
    delta -= 1;
    if (r.win) delta += s.offers[i].payout;
  });
  const j = judge(s.offers, s.accepts as boolean[]);
  const tickets = Math.round((s.tickets + delta) * 10) / 10;
  useBazaar.setState({ result: { ...j, outcomes, delta }, tickets });
  // hiệu ứng 3D
  if (st === "mimic")
    outcomes.forEach((r, i) => {
      chestFx.offerOpen[i] = performance.now() + i * 450;
      chestFx.offerMimic[i] = r ? !r.win : posteriorIsMimic(s.offers[i]);
    });
  if (st === "wisp" && shown)
    playWispJar(
      (shown as { slots: number[] }).slots,
      (shown as { first: number }).first,
    );
  if (st === "wheel") {
    const spins = outcomes.filter(Boolean).map((r) => r!.detail);
    if (spins.length) queueSpins(spins);
  }
  if (j.allRight) {
    sfx.chime(2);
    award(st);
  } else {
    sfx.miss();
    useBazaar.setState({ variant: { ...s.variant, [st]: s.variant[st] + 1 } });
  }
  save();
}
/** rương không mua: vẫn hé lộ (để thấy) theo hậu nghiệm */
function posteriorIsMimic(o: Offer) {
  return Math.random() < 1 - o.pWin;
}

// ───────────── Đèn Năm ─────────────

export function playWispJar(slots: number[], first: number) {
  wispFx.slots = slots;
  wispFx.first = first;
  wispFx.t0 = performance.now() / 1000;
}

export function wispWatch() {
  const jar = releaseJar(mulberry32(freshSeed()), 120);
  playWispJar(jar.slots, jar.first);
  useBazaar.setState({ wispFirst: jar.first, wispHist: null });
  setStep("wisp", "watch");
  sfx.chime(0);
}
export function wispMany() {
  useBazaar.setState({ wispHist: firstCollisionHistogram(freshSeed(), 1000) });
  wispFx.shimmer = performance.now() / 1000;
  sfx.chime(1);
}

// ───────────── Rương Mimic ─────────────

export function mimicSweep() {
  chestFx.field = chestField(freshSeed());
  chestFx.sweepAt = performance.now() / 1000;
  chestFx.revealAt = -1e9;
  useBazaar.setState({ fieldShown: "sweep" });
  setStep("mimic", "watch");
  sfx.chime(0);
}
export function mimicReveal() {
  chestFx.revealAt = performance.now() / 1000;
  useBazaar.setState({ fieldShown: "reveal" });
  sfx.creak();
}

// ───────────── Ruộng Slime ─────────────

export function toggleNet(tile: number) {
  const s = useBazaar.getState();
  if (s.slimeBusy || s.slimeStage >= SLIME_STAGES.length) return;
  const max = SLIME_STAGES[s.slimeStage].nets;
  let nets = s.nets.includes(tile)
    ? s.nets.filter((t) => t !== tile)
    : [...s.nets, tile];
  if (nets.length > max) nets = nets.slice(nets.length - max);
  useBazaar.setState({ nets, slimeRun: null });
  sfx.click();
}

export function releaseSlimes() {
  const s = useBazaar.getState();
  if (s.slimeBusy || s.slimeStage >= SLIME_STAGES.length) return;
  const st = SLIME_STAGES[s.slimeStage];
  if (!s.nets.length) {
    bazaarHint(
      "Cắm lưới trước đã: đứng trên một ô của đường ray rồi bấm F.",
      "Plant a net first: stand on a tile of the track and press F.",
      "warn",
    );
    return;
  }
  const wave = slimeWave(freshSeed(), st.dice, st.wave);
  slimeFx.wave = wave;
  slimeFx.dice = st.dice;
  slimeFx.t0 = performance.now() / 1000;
  slimeFx.pile.fill(0);
  useBazaar.setState({ slimeBusy: true, slimeRun: null });
  sfx.drumroll(0.8);
  const dur = (wave.length - 1) * SLIME_GAP + st.dice * SLIME_HOP + 0.6;
  const nets = [...s.nets];
  window.setTimeout(() => {
    const pass = stagePass(st, nets);
    const run = {
      caught: caught(wave, nets),
      total: wave.length,
      pass,
      sums: wave.map((w) => w.sum),
    };
    const cur = useBazaar.getState();
    useBazaar.setState({ slimeBusy: false, slimeRun: run });
    if (pass) {
      sfx.chime(2);
      const next = cur.slimeStage + 1;
      useBazaar.setState({ slimeStage: next, nets: [] });
      if (next >= SLIME_STAGES.length) award("slime");
      save();
    } else sfx.miss();
  }, dur * 1000);
}

// ───────────── Bánh Xe Chuỗi ─────────────

export function queueSpins(slots: number[]) {
  wheelFx.queue = [...slots];
  wheelFx.t0 = performance.now() / 1000;
}

/** Thầy Chuỗi quay cho xem: dãy kết thúc bằng một chuỗi Đỏ thật (tìm trong dãy ngẫu nhiên) */
export function wheelWatch() {
  const v = useBazaar.getState().variant.wheel;
  const streak = wheelOffers(v)[0].streak ?? 5;
  const seq = spinSeq(freshSeed(), 4000);
  const end = findStreak(seq, streak);
  const show =
    end >= 0
      ? Array.from(seq.slice(Math.max(0, end - streak - 2), end + 1))
      : [1, 3, 5, 7, 9];
  queueSpins(show);
  setStep("wheel", "watch");
  sfx.chime(0);
}
export function wheelMany() {
  const seq = spinSeq(freshSeed(), 20000);
  const v = useBazaar.getState().variant.wheel;
  const streak = wheelOffers(v)[0].streak ?? 5;
  const marks = [10, 30, 100, 300, 1000, 3000, 10000, 20000];
  const trace = llnTrace(seq, marks);
  useBazaar.setState({
    wheelStats: { after: afterStreak(seq, streak), trace, spins: seq.length },
  });
  wheelFx.fast = performance.now() / 1000;
  const last = trace[trace.length - 1];
  wheelFx.tower = {
    n: last.n,
    ratio: last.ratio,
    gap: last.gap,
    at: performance.now() / 1000,
  };
  sfx.chime(1);
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production")
  Object.assign(window, { __bazaar: useBazaar });
