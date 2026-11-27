/**
 * Đồng hồ Pomodoro cho phòng Học cùng nhau — logic thuần (không React, không DOM).
 *
 * Hai chế độ:
 *  - "room": nhịp CHUNG của cả phòng, suy ra từ giờ thực (25 phút học / 5 phút nghỉ, khớp mốc :00 và :30).
 *    Mọi người trong phòng (online hay chơi một mình) thấy cùng một pha mà KHÔNG cần máy chủ đồng bộ.
 *  - "solo": đồng hồ riêng, tự chọn nhịp (25/5, 15/3, 50/10), tạm dừng được; tính bằng mốc thời gian
 *    (không đếm tích tắc) nên tab ngủ / máy chậm vẫn đúng.
 * Nghiên cứu: không có nhịp "tối ưu" duy nhất — 25/5 là mặc định dễ bắt đầu, 15/3 cho người mới, 50/10 cho học sâu.
 */

export type Phase = "focus" | "short" | "long";
export interface TimerPlan {
  id: string;
  /** phút */
  focus: number;
  short: number;
  long: number;
  /** sau bao nhiêu khối học thì nghỉ dài */
  every: number;
}
export const PLANS: TimerPlan[] = [
  { id: "25/5", focus: 25, short: 5, long: 15, every: 4 },
  { id: "15/3", focus: 15, short: 3, long: 10, every: 4 },
  { id: "50/10", focus: 50, short: 10, long: 20, every: 2 },
];
export const PLAN_BY_ID: Record<string, TimerPlan> = Object.fromEntries(PLANS.map((p) => [p.id, p]));
const MIN = 60_000;

export interface PhaseView {
  phase: Phase;
  /** ms còn lại của pha */
  remain: number;
  /** độ dài pha (ms) */
  dur: number;
  /** số thứ tự chu kỳ (đổi khi sang khối học mới) — để biết "vừa hết pha" */
  cycle: number;
}

// ───────────── Nhịp chung của phòng ─────────────
export const ROOM_PLAN = { focus: 25, short: 5 } as const;
const ROOM_CYCLE = (ROOM_PLAN.focus + ROOM_PLAN.short) * MIN;

/** Pha chung của phòng ở thời điểm `now` (ms từ epoch). Chu kỳ 30 phút khớp nửa giờ của đồng hồ thật. */
export function roomPhase(now: number): PhaseView {
  const cycle = Math.floor(now / ROOM_CYCLE);
  const t = now - cycle * ROOM_CYCLE;
  const f = ROOM_PLAN.focus * MIN;
  if (t < f) return { phase: "focus", remain: f - t, dur: f, cycle };
  return { phase: "short", remain: ROOM_CYCLE - t, dur: ROOM_PLAN.short * MIN, cycle };
}

// ───────────── Đồng hồ riêng ─────────────
export interface SoloTimer {
  plan: string;
  phase: Phase;
  /** số khối học đã xong (để biết lúc nghỉ dài) */
  done: number;
  /** đang chạy từ lúc nào (ms), null = đang dừng */
  since: number | null;
  /** ms đã chạy của pha hiện tại trước `since` */
  spent: number;
}

export function newSolo(plan = "25/5"): SoloTimer {
  return { plan: PLAN_BY_ID[plan] ? plan : "25/5", phase: "focus", done: 0, since: null, spent: 0 };
}
export function phaseMs(s: SoloTimer, phase: Phase = s.phase): number {
  const p = PLAN_BY_ID[s.plan] ?? PLANS[0];
  return (phase === "focus" ? p.focus : phase === "short" ? p.short : p.long) * MIN;
}
export function elapsed(s: SoloTimer, now: number): number {
  return s.spent + (s.since !== null ? Math.max(0, now - s.since) : 0);
}
export function soloView(s: SoloTimer, now: number): PhaseView {
  const dur = phaseMs(s);
  return { phase: s.phase, remain: Math.max(0, dur - elapsed(s, now)), dur, cycle: s.done * 2 + (s.phase === "focus" ? 0 : 1) };
}
export function start(s: SoloTimer, now: number): SoloTimer {
  return s.since !== null ? s : { ...s, since: now };
}
export function pause(s: SoloTimer, now: number): SoloTimer {
  return s.since === null ? s : { ...s, spent: elapsed(s, now), since: null };
}
export function reset(s: SoloTimer): SoloTimer {
  return { ...s, phase: "focus", since: null, spent: 0 };
}
export function setPlan(s: SoloTimer, plan: string): SoloTimer {
  return { ...newSolo(plan), done: s.done };
}
/** Pha kế tiếp sau `phase` khi đã xong `done` khối học */
export function nextPhase(phase: Phase, done: number, every: number): Phase {
  if (phase !== "focus") return "focus";
  return done > 0 && done % every === 0 ? "long" : "short";
}

/**
 * Tiến thời gian: nếu pha hiện tại đã hết → sang pha kế. Hết giờ học → tự vào nghỉ (đang chạy);
 * hết giờ nghỉ → khối học mới DỪNG chờ người chơi bấm bắt đầu (chủ động quay lại, không chạy "vô hồn").
 * Trả về trạng thái mới + pha vừa kết thúc (nếu có).
 */
export function tick(s: SoloTimer, now: number): { s: SoloTimer; ended: Phase | null } {
  if (s.since === null) return { s, ended: null };
  const dur = phaseMs(s);
  const e = elapsed(s, now);
  if (e < dur) return { s, ended: null };
  const plan = PLAN_BY_ID[s.plan] ?? PLANS[0];
  const ended = s.phase;
  if (ended === "focus") {
    const done = s.done + 1;
    const phase = nextPhase("focus", done, plan.every);
    // phần dư sau khi hết giờ tính sang giờ nghỉ (tab ngủ lâu vẫn đúng)
    const over = Math.min(e - dur, phaseMs(s, phase));
    return { s: { ...s, phase, done, spent: 0, since: now - over }, ended };
  }
  return { s: { ...s, phase: "focus", spent: 0, since: null }, ended };
}

/** "mm:ss" (hoặc "h:mm:ss" nếu ≥ 1 giờ) */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
