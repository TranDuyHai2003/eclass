/**
 * Đêm Đèn lồng (Lantern Night) — sự kiện đầu tiên của Vùng Kỳ quan (nghiên cứu Terraria; docs/ai-reviews/voxel-world/BOSSES.md).
 * Logic THUẦN → test ở tests/world/lanternNight.test.ts.
 *
 * Kích hoạt: trời ĐÊM, người chơi đã hạ Kẻ Khảo sát Gấp ít nhất một lần, và đêm nay chưa có sự kiện (khoá theo "ngày của
 * buổi tối": trước 12 h trưa tính là đêm hôm trước). Đèn lồng bay lên trời theo nhịp tuần hoàn; Bướm Chu kỳ kéo tới thành 3 đợt.
 *
 * Móc toán = HÀM TUẦN HOÀN + BỘI CHUNG NHỎ NHẤT:
 *  • Mỗi bướm bay vòng và nhấp nhô h(t) = h₀ + A·(1 − cos(2π(t − φ)/T))/2 → sà thấp nhất đúng các lúc t = φ + kT.
 *    Chỉ khi sà thấp (h ≤ REACH) đòn cận chiến mới với tới (tên bắn vẫn trúng nếu bay tới đúng độ cao).
 *  • Đợt 3 có hai đàn chu kỳ 2 s và 3 s, cùng xuất phát → cùng sà xuống mỗi BCNN(2, 3) = 6 s: thời điểm vàng cho
 *    Tích phân Bùng nổ (Q) trúng cả đàn.
 * Phần thưởng: Lụa Pha (vật phẩm mới) sau mỗi đợt; hết đợt 3 thêm phần thưởng lớn.
 */

export const LN = {
  /** số bướm mỗi đợt (trước khi cắt theo ngân sách) */
  WAVES: [4, 6, 8] as const,
  /** chu kỳ (giây) của các đàn trong từng đợt: bướm thứ i thuộc đàn i % số đàn */
  PERIODS: [[3], [2.4], [2, 3]] as const,
  /** ngân sách diễn viên chiến đấu gần người chơi (nghiên cứu: ≤ 24) */
  ACTOR_CAP: 24,
  LOW_Y: 0.9,
  HIGH_Y: 4.2,
  /** độ cao tối đa mà đòn cận chiến còn với tới */
  REACH_Y: 1.9,
  R_MIN: 4.5,
  R_MAX: 8.5,
  /** tốc độ góc bay vòng (rad/s) */
  OMEGA: 0.45,
  GAP_MS: 5000,
  INTRO_MS: 4000,
  /** người chơi rời xa tâm quá LEAVE_R trong LEAVE_MS → sự kiện tan */
  LEAVE_R: 40,
  LEAVE_MS: 8000,
  /** Lụa Pha thưởng sau mỗi đợt */
  REWARD: [2, 2, 3] as const,
  MOTH_HP: 40,
  DIVE_DMG: 7,
  /** bán kính vòng sà (đứng gần hơn lúc bướm chạm đáy thì bị cắn) */
  DIVE_R: 1.8,
  /** đèn lồng trang trí bay lên (cosmetic, một InstancedMesh) */
  SKY_LANTERNS: 40,
} as const;

/** Khoá "đêm": ngày của buổi tối theo giờ địa phương (sau nửa đêm, trước 12 h vẫn thuộc đêm hôm trước) */
export function nightKey(year: number, month: number, day: number, hour: number): string {
  if (hour < 12) {
    const d = new Date(Date.UTC(year, month - 1, day) - 86400e3);
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  }
  return `${year}-${month}-${day}`;
}

export function shouldStart(o: { night: boolean; cleared: number; key: string; lastKey: string | null; busy: boolean }): boolean {
  return o.night && o.cleared > 0 && o.key !== o.lastKey && !o.busy;
}

/** Số bướm thật sự sinh ra ở đợt w khi đã có `live` diễn viên chiến đấu khác (giữ tổng ≤ ACTOR_CAP) */
export function waveSize(w: number, live: number, cap: number = LN.ACTOR_CAP): number {
  const want = LN.WAVES[Math.min(w, LN.WAVES.length - 1)];
  return Math.max(1, Math.min(want, cap - live));
}

/** Chu kỳ của bướm thứ i trong đợt w */
export function mothPeriod(w: number, i: number): number {
  const ps = LN.PERIODS[Math.min(w, LN.PERIODS.length - 1)];
  return ps[i % ps.length];
}

/** Độ cao nhấp nhô (t, φ giây): thấp nhất LOW_Y tại t = φ + kT, cao nhất HIGH_Y tại giữa chu kỳ */
export function mothHeight(t: number, T: number, phi: number): number {
  return LN.LOW_Y + (LN.HIGH_Y - LN.LOW_Y) * 0.5 * (1 - Math.cos((2 * Math.PI * (t - phi)) / T));
}

/** Lần sà thấp kế tiếp (≥ t) */
export function nextDip(t: number, T: number, phi: number): number {
  const k = Math.ceil((t - phi) / T - 1e-9);
  return phi + k * T;
}

export const reachable = (h: number) => h <= LN.REACH_Y;

/** Khoảng thời gian quanh mỗi lần sà mà bướm còn trong tầm với: |t − đáy| ≤ w (giải cos cho h = REACH_Y) */
export function reachWindow(T: number): number {
  const k = (LN.REACH_Y - LN.LOW_Y) / (LN.HIGH_Y - LN.LOW_Y); // = (1 − cos x)/2
  return (T / (2 * Math.PI)) * Math.acos(1 - 2 * k);
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
/** BCNN của các chu kỳ (giây, tới 0,1 s) — lúc mọi đàn cùng sà */
export function lcmPeriods(ps: readonly number[]): number {
  const ints = ps.map((p) => Math.round(p * 10));
  let l = ints[0];
  for (let i = 1; i < ints.length; i++) l = (l * ints[i]) / gcd(l, ints[i]);
  return l / 10;
}

export type LnState = "idle" | "intro" | "wave" | "gap" | "done" | "failed";
export interface LanternEvent {
  state: LnState;
  at: number;
  wave: number;
  /** bướm còn sống của đợt hiện tại */
  alive: number;
  spawned: number;
  /** thời điểm (ms) đợt hiện tại bắt đầu — gốc pha φ của mọi bướm trong đợt */
  waveAt: number;
  rewarded: number;
  awayMs: number;
  cx: number;
  cz: number;
}

export function newEvent(): LanternEvent {
  return { state: "idle", at: 0, wave: 0, alive: 0, spawned: 0, waveAt: 0, rewarded: 0, awayMs: 0, cx: 0, cz: 0 };
}

export function startEvent(e: LanternEvent, now: number, cx: number, cz: number) {
  e.state = "intro";
  e.at = now;
  e.wave = 0;
  e.alive = 0;
  e.spawned = 0;
  e.rewarded = 0;
  e.awayMs = 0;
  e.cx = cx;
  e.cz = cz;
}

/**
 * Một bước máy trạng thái. `alive` = số bướm còn sống (lớp vẽ đếm). Trả sự kiện: "spawn" (sinh đợt `wave`), "cleared"
 * (vừa xong một đợt → thưởng REWARD[wave]), "done", "failed" hoặc null.
 */
export function tickEvent(e: LanternEvent, now: number, dtMs: number, alive: number, distFromCenter: number, night: boolean): string | null {
  if (e.state === "idle" || e.state === "done" || e.state === "failed") return null;
  e.awayMs = distFromCenter > LN.LEAVE_R ? e.awayMs + dtMs : 0;
  if (e.awayMs > LN.LEAVE_MS || (!night && e.state !== "wave")) {
    e.state = "failed";
    e.at = now;
    return "failed";
  }
  e.alive = alive;
  if (e.state === "intro" && now - e.at >= LN.INTRO_MS) {
    e.state = "wave";
    e.at = now;
    e.waveAt = now;
    return "spawn";
  }
  if (e.state === "wave" && alive === 0 && now - e.waveAt > 500) {
    e.rewarded += LN.REWARD[e.wave];
    if (e.wave >= LN.WAVES.length - 1) {
      e.state = "done";
      e.at = now;
      return "done";
    }
    e.state = "gap";
    e.at = now;
    return "cleared";
  }
  if (e.state === "gap" && now - e.at >= LN.GAP_MS) {
    e.wave++;
    e.state = "wave";
    e.at = now;
    e.waveAt = now;
    return "spawn";
  }
  return null;
}
