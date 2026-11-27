"use client";
/**
 * Trạng thái sân khấu Monty Hall (dùng chung cho cảnh 3D, bảng điều khiển và bảng điểm).
 * Một ván: chọn cửa → trống dồn, MC mở một cửa dê → giữ / đổi → trống dồn, mở cửa cuối → mở hết, ghi điểm.
 */
import { create } from "zustand";
import { EMPTY_TALLY, addRound, hostOpens, otherDoor, randInt, simulate, type Tally } from "@/lib/world/monty";
import { sfx } from "@/lib/world/sfx";

export type MPhase = "idle" | "hostOpening" | "decide" | "finalOpening" | "result";
type S = {
  phase: MPhase;
  car: number;
  pick: number;
  keep: number;
  opened: number[];
  final: number;
  swapped: boolean;
  /** độ mở mục tiêu của 3 cửa (0 đóng → 1 mở) */
  open: [number, number, number];
  tally: Tally;
  sim: Tally;
  simTarget: number;
  /** thời điểm bắt đầu pháo giấy (ms) */
  burst: number;
  round: number;
};

const KEY = "world.monty";
function loadTally(): Tally {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.stayN === "number" && typeof v.swapN === "number") return { ...EMPTY_TALLY, ...v };
  } catch {}
  return EMPTY_TALLY;
}
function saveTally(t: Tally) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {}
}

export const useMonty = create<S>(() => ({
  phase: "idle",
  car: 0,
  pick: -1,
  keep: -1,
  opened: [],
  final: -1,
  swapped: false,
  open: [0, 0, 0],
  tally: typeof window === "undefined" ? EMPTY_TALLY : loadTally(),
  sim: EMPTY_TALLY,
  simTarget: 0,
  burst: -1e9,
  round: 0,
}));

const later = (round: number, ms: number, fn: () => void) =>
  setTimeout(() => {
    if (useMonty.getState().round === round) fn();
  }, ms);

/** Ván mới: đóng hết cửa, xếp lại phần thưởng khi cửa đã khép */
export function newRound() {
  const round = useMonty.getState().round + 1;
  useMonty.setState({ phase: "idle", pick: -1, keep: -1, opened: [], final: -1, swapped: false, open: [0, 0, 0], round });
  later(round, 650, () => useMonty.setState({ car: randInt(3) }));
}

export function pickDoor(i: number) {
  const s = useMonty.getState();
  if (s.phase !== "idle") return;
  const keep = otherDoor(3, s.car, i);
  const opened = hostOpens(3, i, keep);
  useMonty.setState({ phase: "hostOpening", pick: i, keep, opened });
  sfx.click();
  sfx.drumroll(1.1);
  later(s.round, 1250, () => {
    const open: [number, number, number] = [0, 0, 0];
    opened.forEach((d) => (open[d] = 1));
    useMonty.setState({ open, phase: "decide" });
    sfx.creak();
    setTimeout(() => sfx.baa(), 450);
  });
}

export function decide(swap: boolean) {
  const s = useMonty.getState();
  if (s.phase !== "decide") return;
  const final = swap ? s.keep : s.pick;
  useMonty.setState({ phase: "finalOpening", final, swapped: swap });
  sfx.drumroll(1.3);
  later(s.round, 1450, () => {
    const open = [...useMonty.getState().open] as [number, number, number];
    open[final] = 1;
    const win = final === s.car;
    const tally = addRound(useMonty.getState().tally, swap, win);
    saveTally(tally);
    useMonty.setState({ open, phase: "result", tally, burst: win ? performance.now() : -1e9 });
    sfx.creak();
    if (win) sfx.fanfare();
    else setTimeout(() => sfx.baa(), 350);
    // mở nốt các cửa còn lại để thấy toàn cảnh
    later(s.round, 1300, () => useMonty.setState({ open: [1, 1, 1] }));
  });
}

/** Cho máy chơi `n` ván mỗi chiến lược; bảng điểm đếm dần lên trong ~3 giây */
export function runSimulation(n = 1000) {
  const start = performance.now();
  const total = simulate(n);
  useMonty.setState({ sim: EMPTY_TALLY, simTarget: n });
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / 3000);
    const e = 1 - Math.pow(1 - k, 2);
    const f = (v: number) => Math.round(v * e);
    useMonty.setState({ sim: { stayWin: f(total.stayWin), stayN: f(total.stayN), swapWin: f(total.swapWin), swapN: f(total.swapN) } });
    if (k < 1) requestAnimationFrame(step);
    else sfx.chime(2);
  };
  requestAnimationFrame(step);
}

export function resetTally() {
  saveTally(EMPTY_TALLY);
  useMonty.setState({ tally: EMPTY_TALLY, sim: EMPTY_TALLY, simTarget: 0 });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __monty: unknown }).__monty = { useMonty, pickDoor, decide, newRound, runSimulation };
