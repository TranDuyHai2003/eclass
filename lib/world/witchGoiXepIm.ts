/**
 * Phù thuỷ hoạ âm #2 — GỐI XẾP IM (sóng dừng, cú lộ dạng NGANG). Logic THUẦN (test được, có hạt giống, không cấp phát mỗi khung).
 * Thiết kế: docs/ai-reviews/siren-witch/WITCHES_CODEX.md §2. Hình: components/world/scene/siren/witches/GoiXepIm.tsx.
 *
 * Một chiếc gối chần bông bé xíu, hai mắt chỉ thêu, đặt giữa đấu trường. Hai gọng đầu (Kẹp Biên Vải) kéo căng → gối mở NGANG
 * thành vách vải xếp ly dài L. Mặt thêu bị ép phẳng thành đường may, túi vải phập phồng thành bụng sóng. Nó muốn cả căn phòng
 * thôi cựa quậy. Sứ giả Suốt Chỉ Lặng trượt dọc mép vải, dừng ở NÚT để may một vạch chỉ bền.
 *
 * Quy luật (một nguồn cho cả LUẬT lẫn HÌNH):
 *  - vách là dây hai đầu cố định, mode n: biên độ theo vị trí  env(u) = |sin(nπu/L)|, u ∈ [0, L] dọc vách;
 *    nút (đứng yên) tại u = kL/n (k = 0…n), bụng ở giữa hai nút;
 *  - "Gập Bụng": cột vải ở u đổ xuống dải sàn tới độ sâu D·reach(u), reach = clamp(K(env − S)/(1 − S), 0, 1)
 *    → dải quanh nút (env ≤ S) AN TOÀN, bụng sóng đập xuống. Đỉnh vách lúc đập nằm ĐÚNG mép vùng hiểm (test);
 *  - "Dây Chỉ Quất": sợi chỉ căng dọc sàn ở độ sâu VC rung cùng mode → vùng quét = bao |v − VC| < HW + AW·env(u);
 *    đi qua ở nút hoặc nhảy qua;
 *  - THẮNG = hiểu khái niệm: chỉ đòn đánh từ chỗ đứng ở NÚT mới "ghim" được vách (bụng sóng nuốt đòn). Ghim đủ mọi nút trong
 *    của mode n → vách đổi sang n + 1 (2 → 3 → 4). Trước mỗi lần đổi là lượt DỰ ĐOÁN: đường may cũ bung, sàn không hiện
 *    vạch; đứng đúng nút mới (u = kL/(n+1)) khi vách đập → nút đó được may ngay.
 *  - Mọi đòn: dồn lực (anticipation) → báo trước ≥ 2 phách (1,25 s ở 96 BPM) → chốt (commit) → đánh (active) → hồi (recovery).
 *  - Tất định: thời gian do người gọi truyền vào (giây), loại đòn = hàm băm(seed, số đòn) — sẵn cho nhiều người chơi sau này.
 *
 * Biểu thức vùng hiểm / độ nghiêng vách viết MỘT lần dưới dạng chuỗi hợp lệ CẢ GLSL lẫn JS (DANGER_EXPR, TILT_EXPR) — shader
 * vẽ sàn / vách dùng nguyên chuỗi; test so bản JS của chuỗi với luật (dangerAt / wallTilt) ở hàng chục nghìn điểm.
 */
import { HARMONIC_BPM } from "./harmonicState";
import type { L } from "./i18n";

/** một phách (s) — 0,625 s ở 96 BPM */
export const BEAT = 60 / HARMONIC_BPM;

export const GXI = {
  /** chiều dài vách khi mở hết (m) — gấp đôi bản phác 6 m để đứng / né được ở góc nhìn người thứ ba */
  L: 12,
  /** độ sâu dải sàn bị đập = chiều cao vách (m) — đỉnh vách đổ xuống đúng mép vùng hiểm */
  D: 5,
  /** ngưỡng biên độ: env ≤ S là dải nút an toàn (bề rộng nửa dải = L·asin(S)/(nπ): 0,83 / 0,55 / 0,41 m với n = 2 / 3 / 4) */
  S: 0.42,
  /** độ dốc tầm đập theo biên độ (bụng đập hết tầm khi env ≥ S + (1 − S)/K) */
  K: 3,
  /** Dây Chỉ Quất: độ sâu sợi chỉ, nửa bề dày, biên độ quét tối đa (m) */
  VC: 2.6,
  HW: 0.3,
  AW: 1.5,
  /** gối lúc ngủ (m) */
  PILLOW_W: 0.85,
  PILLOW_H: 0.55,
  /** chuỗi mode (số bụng sóng) */
  MODES: [2, 3, 4] as const,
  /** số đòn ghim mỗi nút */
  PIN_HITS: 2,
  /** lại gần gối trong bán kính này (m) → thức dậy */
  WAKE_R: 6,
  /** chỉ ghim được khi đứng cách chân vách ≤ PIN_REACH (m) */
  PIN_REACH: 3.4,
  /** lộ dạng (s), khúc mẫu vô hại (beat), ru ngủ lại khi thua (s) */
  REVEAL: 4.4,
  DEMO: 8,
  HUSH: 4.5,
  /** sát thương lên người chơi */
  DMG: { slam: 14, whip: 9 } as const,
  /** cao hơn mặt sàn bao nhiêu thì đòn trượt qua (m): vải đập ~ chiều cao người, chỉ quất ngang gối → nhảy qua được */
  SLAM_Y: 2.4,
  WHIP_Y: 0.85,
  /** tần số cơ bản của vách (Hz) — f_n = n·F1, khoá nhịp: n = 2 → 1 dao động / 2 phách */
  F1: HARMONIC_BPM / 60 / 4,
  /** cao độ âm cơ bản của "dây vải" (Hz) — mode n kêu n·110 Hz (hoạ âm bậc n) */
  HZ: 110,
} as const;

// ───────────── Quy luật sóng dừng ─────────────

/** dạng mode chuẩn hoá sin(nπu/L) (có dấu) */
export function modeShape(u: number, n: number, L: number = GXI.L): number {
  return Math.sin((3.141592653589793 * n * u) / L);
}
/** biên độ theo vị trí |sin(nπu/L)| */
export function envelope(u: number, n: number, L: number = GXI.L): number {
  return Math.abs(Math.sin((3.141592653589793 * n * u) / L));
}
/** tầm đập 0…1 của cột vải ở u (0 = đứng yên ở dải nút) */
export function reach(u: number, n: number, L: number = GXI.L): number {
  const r = (GXI.K * (Math.abs(Math.sin((3.141592653589793 * n * u) / L)) - GXI.S)) / (1.0 - GXI.S);
  return Math.min(1.0, Math.max(0.0, r));
}
/** vị trí các nút TRONG (bỏ hai đầu kẹp): u = kL/n, k = 1…n − 1 */
export function nodePositions(n: number, L: number = GXI.L): number[] {
  return Array.from({ length: n - 1 }, (_, i) => ((i + 1) * L) / n);
}
/** bụng sóng: u = (k + ½)L/n, k = 0…n − 1 */
export function antinodePositions(n: number, L: number = GXI.L): number[] {
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * L) / n);
}
/** nửa bề rộng dải nút an toàn (m) */
export function nodeHalfWidth(n: number, L: number = GXI.L): number {
  return (L * Math.asin(GXI.S)) / (Math.PI * n);
}
/** nút trong gần nhất (chỉ số 0…n − 2) nếu u nằm trong dải nút an toàn của nó, ngược lại −1 */
export function nodeAt(u: number, n: number, L: number = GXI.L): number {
  if (u < 0 || u > L) return -1;
  if (envelope(u, n, L) > GXI.S) return -1;
  const k = Math.round((u * n) / L);
  return k >= 1 && k <= n - 1 ? k - 1 : -1;
}

export type Atk = "slam" | "whip";
/**
 * LUẬT vùng hiểm tại (u dọc vách, v = khoảng cách trước chân vách), mode n.
 * slam: 0 ≤ v < D·reach(u);  whip: |v − VC| < HW + AW·env(u). Ngoài [0, L] (sau hai kẹp) luôn an toàn.
 */
export function dangerAt(u: number, v: number, n: number, atk: Atk, L: number = GXI.L): boolean {
  if (!(u >= 0.0 && u <= L)) return false;
  const e = Math.abs(Math.sin((3.141592653589793 * n * u) / L));
  if (atk === "slam") return v >= 0.0 && v < GXI.D * Math.min(1.0, Math.max(0.0, (GXI.K * (e - GXI.S)) / (1.0 - GXI.S)));
  return Math.abs(v - GXI.VC) < GXI.HW + GXI.AW * e;
}

/**
 * CÙNG biểu thức cho shader sàn (GLSL) và bản kiểm (JS). Biến: u, v; uniform: uL uD uN uS uK uVc uHw uAw uAtk (0 slam, 1 whip).
 * Đổi luật ở đây phải đổi dangerAt — test tests/world/witchGoiXepIm.test.ts bắt lệch.
 */
export const DANGER_EXPR =
  "((u >= 0.0 && u <= uL) && (uAtk < 0.5 ? (v >= 0.0 && v < uD * clamp(uK * (abs(sin(3.141592653589793 * uN * u / uL)) - uS) / (1.0 - uS), 0.0, 1.0)) : (abs(v - uVc) < uHw + uAw * abs(sin(3.141592653589793 * uN * u / uL)))))";

/**
 * Độ nghiêng sin θ của cột vải ở u (đỉnh vách cao D nằm ở v = D·sin θ, y = D·cos θ) — CÙNG chuỗi cho vertex shader và CPU:
 *  dao động thường uAmp·sin(nπu/L)·uOsc, kéo lùi dồn lực −uPull·reach, đập xuống reach (uSlam = 1 → đỉnh chạm ĐÚNG mép vùng hiểm).
 */
export const TILT_EXPR =
  "mix(uAmp * sin(3.141592653589793 * uN * u / uL) * uOsc - uPull * clamp(uK * (abs(sin(3.141592653589793 * uN * u / uL)) - uS) / (1.0 - uS), 0.0, 1.0), clamp(uK * (abs(sin(3.141592653589793 * uN * u / uL)) - uS) / (1.0 - uS), 0.0, 1.0), uSlam)";

/** bản CPU của TILT_EXPR (túi vải / chỗ đứng sứ giả / test) */
export function wallTilt(u: number, n: number, amp: number, osc: number, pull: number, slam: number, L: number = GXI.L): number {
  const r = reach(u, n, L);
  const idle = amp * modeShape(u, n, L) * osc - pull * r;
  return idle + (r - idle) * slam;
}

type Uni = Record<string, number>;
const fnCache = new Map<string, (...a: unknown[]) => unknown>();
/** chạy một biểu thức GLSL-cũng-là-JS (chỉ cho test / công cụ — không gọi trong vòng khung) */
export function evalShared(expr: string, vars: Uni): number | boolean {
  const keys = Object.keys(vars).sort();
  const id = expr + "|" + keys.join(",");
  let f = fnCache.get(id);
  if (!f) {
    f = new Function(...keys, "abs", "sin", "clamp", "mix", `return ${expr};`) as (...a: unknown[]) => unknown;
    fnCache.set(id, f);
  }
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return f(...keys.map((k) => vars[k]), Math.abs, Math.sin, clamp, mix) as number | boolean;
}
/** uniform chuẩn của shader cho mode n / đòn atk */
export function dangerUniforms(n: number, atk: Atk, L: number = GXI.L): Uni {
  return { uL: L, uD: GXI.D, uN: n, uS: GXI.S, uK: GXI.K, uVc: GXI.VC, uHw: GXI.HW, uAw: GXI.AW, uAtk: atk === "slam" ? 0 : 1 };
}

// ───────────── Nhịp đòn ─────────────

/** mốc (beat, tính từ lúc bắt đầu đòn): dồn lực → báo trước → chốt → đánh → hồi → nghỉ */
export const ATK_BEATS = {
  slam: { tele: 1, commit: 3, active: 3.5, recover: 4, end: 6 },
  whip: { tele: 1, commit: 3, active: 3.5, recover: 5, end: 6.5 },
} as const;
/** lượt dự đoán khi đổi mode: bung chỉ → đoán → chốt (vách hiện dáng mới) → đập → hồi */
export const PREDICT_BEATS = { guess: 2, commit: 6, active: 6.5, recover: 7, end: 8 } as const;
/** cửa sổ tính trúng của cú đập (beat) — ngắn, như một nhát */
export const SLAM_WINDOW = 0.4;
/** nghỉ giữa hai đòn (beat) theo pha */
export const GAP = [2, 2, 1] as const;

export type AtkStage = "antic" | "tele" | "commit" | "active" | "recover" | "gap";
export function atkStage(b: number, atk: Atk): AtkStage {
  const s = ATK_BEATS[atk];
  if (b < s.tele) return "antic";
  if (b < s.commit) return "tele";
  if (b < s.active) return "commit";
  if (b < s.recover) return "active";
  if (b < s.end) return "recover";
  return "gap";
}
export function cycleBeats(atk: Atk, mi: number): number {
  return ATK_BEATS[atk].end + GAP[Math.min(GAP.length - 1, mi)];
}

/** băm số nguyên → [0, 1) (tất định, như mulberry32 một bước) */
export function hash01(seed: number, k: number): number {
  let t = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k | 0, 0x85ebca6b)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** đòn thứ atkNo trong mode mi: pha 1 chỉ Gập Bụng (dạy nút); sau đó đòn lẻ có 60 % là Dây Chỉ Quất; đòn đầu mỗi mode luôn Gập Bụng */
export function pickAtk(seed: number, atkNo: number, mi: number): Atk {
  if (mi === 0 || atkNo % 2 === 0) return "slam";
  return hash01(seed, atkNo * 31 + mi) < 0.6 ? "whip" : "slam";
}

// ───────────── Máy trạng thái ─────────────

export type Stage = "dormant" | "reveal" | "demo" | "fight" | "predict" | "hush" | "done";

export interface GxiSim {
  seed: number;
  L: number;
  stage: Stage;
  /** lúc vào stage (s) */
  at: number;
  /** chỉ số mode (n = GXI.MODES[mi]) */
  mi: number;
  /** n của mode trước (HUD "2 → 3", đường may đang bung) */
  prevN: number;
  /** số đòn đã ghim vào từng nút trong (chỉ số 0…n − 2) */
  pins: Int8Array;
  atkNo: number;
  atkAt: number;
  atk: Atk;
  /** beat của khung trước trong đòn / lượt dự đoán (bắt mốc vượt) */
  lastB: number;
  /** số đòn đã làm người chơi này đau (mỗi đòn tối đa 1 lần) */
  hurtNo: number;
  /** nút đoán đúng trong lượt dự đoán gần nhất (−1 = chưa / sai) */
  guessNode: number;
  lastDmg: number;
  /** nút vừa ghim (chỉ số) — cho hình / âm */
  lastNode: number;
  hp: number;
  maxHp: number;
  /** số lần dự đoán đúng / sai (thống kê, ghi chép) */
  guessOk: number;
  guessMiss: number;
}

export const MAX_HP = GXI.MODES.reduce((s, n) => s + (n - 1) * GXI.PIN_HITS, 0);

export function newGxi(seed: number, L: number = GXI.L): GxiSim {
  return { seed: seed | 0, L, stage: "dormant", at: 0, mi: 0, prevN: GXI.MODES[0], pins: new Int8Array(4), atkNo: 0, atkAt: 0, atk: "slam", lastB: -1, hurtNo: -1, guessNode: -1, lastDmg: 0, lastNode: -1, hp: MAX_HP, maxHp: MAX_HP, guessOk: 0, guessMiss: 0 };
}
export const modeN = (s: GxiSim) => GXI.MODES[Math.min(GXI.MODES.length - 1, s.mi)];
/** pha boss (1…3) */
export const gxiPhase = (s: GxiSim) => Math.min(3, s.mi + 1);
export function pinsDone(s: GxiSim): boolean {
  const n = modeN(s);
  for (let k = 0; k < n - 1; k++) if (s.pins[k] < GXI.PIN_HITS) return false;
  return true;
}

function enter(s: GxiSim, st: Stage, t: number) {
  s.stage = st;
  s.at = t;
  s.lastB = -1;
}

/** sự kiện trong khung (mặt nạ bit) — hình / âm đọc, logic không cần */
export const EV = {
  STAGE: 1,
  ATK: 2,
  TELE: 4,
  COMMIT: 8,
  ACTIVE: 16,
  RECOVER: 32,
  HURT: 64,
  GUESS_OK: 128,
  GUESS_MISS: 256,
  BEAT: 512,
  MODE: 1024,
} as const;

const crossed = (a: number, b: number, x: number) => a < x && b >= x;

/**
 * Một bước mô phỏng ở thời điểm t (s). (pu, pv) = vị trí người chơi trong hệ vách (pu dọc vách 0…L, pv trước chân vách),
 * py = độ cao trên mặt sàn (m). Trả về mặt nạ EV. Không cấp phát.
 */
export function tickGxi(s: GxiSim, t: number, pu: number, pv: number, py: number): number {
  let ev = 0;
  const n = modeN(s);
  if (s.stage === "dormant") {
    if (Math.hypot(pu - s.L / 2, pv) < GXI.WAKE_R && py < 3) {
      enter(s, "reveal", t);
      ev |= EV.STAGE;
    }
    return ev;
  }
  if (s.stage === "reveal") {
    if (t - s.at >= GXI.REVEAL) {
      enter(s, "demo", t);
      ev |= EV.STAGE;
    }
    return ev;
  }
  if (s.stage === "demo") {
    const b = (t - s.at) / BEAT;
    if (Math.floor(b) !== Math.floor(s.lastB)) ev |= EV.BEAT;
    s.lastB = b;
    if (b >= GXI.DEMO) {
      startFight(s, t);
      ev |= EV.STAGE | EV.ATK;
    }
    return ev;
  }
  if (s.stage === "fight") {
    let b = (t - s.atkAt) / BEAT;
    const cyc = cycleBeats(s.atk, s.mi);
    if (b >= cyc) {
      // đòn kế (bước theo chu kỳ — tất định, không trôi theo FPS)
      s.atkAt += cyc * BEAT;
      if (t - s.atkAt > cyc * BEAT) s.atkAt = t;
      s.atkNo++;
      s.atk = pickAtk(s.seed, s.atkNo, s.mi);
      s.lastB = -1;
      b = (t - s.atkAt) / BEAT;
      ev |= EV.ATK;
    }
    const k = ATK_BEATS[s.atk];
    const a = s.lastB;
    if (crossed(a, b, k.tele)) ev |= EV.TELE;
    if (b >= k.tele && b < k.commit && Math.floor(b) !== Math.floor(a)) ev |= EV.BEAT;
    if (crossed(a, b, k.commit)) ev |= EV.COMMIT;
    if (crossed(a, b, k.active)) ev |= EV.ACTIVE;
    if (crossed(a, b, k.recover)) ev |= EV.RECOVER;
    // trúng: Gập Bụng chỉ trong cửa sổ ngắn sau lúc đập; Chỉ Quất suốt lúc rung
    const winEnd = s.atk === "slam" ? k.active + SLAM_WINDOW : k.recover;
    if (b >= k.active && b < winEnd && s.hurtNo !== s.atkNo) {
      const high = s.atk === "slam" ? GXI.SLAM_Y : GXI.WHIP_Y;
      if (py < high && dangerAt(pu, pv, n, s.atk, s.L)) {
        s.hurtNo = s.atkNo;
        s.lastDmg = GXI.DMG[s.atk];
        ev |= EV.HURT;
      }
    }
    s.lastB = b;
    return ev;
  }
  if (s.stage === "predict") {
    const b = (t - s.at) / BEAT;
    const a = s.lastB;
    const P = PREDICT_BEATS;
    if (b >= P.guess && b < P.commit && Math.floor(b) !== Math.floor(a)) ev |= EV.BEAT;
    if (crossed(a, b, P.guess)) ev |= EV.TELE;
    if (crossed(a, b, P.commit)) ev |= EV.COMMIT | EV.MODE;
    if (crossed(a, b, P.active)) {
      ev |= EV.ACTIVE;
      // chấm dự đoán ĐÚNG lúc vách đập: đứng trong dải sàn ở một nút trong của mode mới → nút đó được may ngay
      if (pv >= 0 && pv < GXI.D && py < GXI.SLAM_Y) {
        const node = nodeAt(pu, n, s.L);
        if (node >= 0) {
          s.guessNode = node;
          s.pins[node] = GXI.PIN_HITS;
          s.lastNode = node;
          s.guessOk++;
          s.hp = hpLeft(s);
          ev |= EV.GUESS_OK;
        } else {
          s.guessNode = -1;
          s.guessMiss++;
          ev |= EV.GUESS_MISS;
          if (dangerAt(pu, pv, n, "slam", s.L)) {
            s.lastDmg = GXI.DMG.slam;
            ev |= EV.HURT;
          }
        }
      }
    }
    if (crossed(a, b, P.recover)) ev |= EV.RECOVER;
    s.lastB = b;
    if (b >= P.end) {
      if (pinsDone(s)) finishMode(s, t);
      else startFight(s, t);
      ev |= EV.STAGE | EV.ATK;
    }
    return ev;
  }
  if (s.stage === "hush") {
    if (t - s.at >= GXI.HUSH) {
      enter(s, "done", t);
      ev |= EV.STAGE;
    }
  }
  return ev;
}

function startFight(s: GxiSim, t: number) {
  enter(s, "fight", t);
  s.atkAt = t;
  s.atkNo = 0;
  s.atk = pickAtk(s.seed, 0, s.mi);
  s.hurtNo = -1;
}
function hpLeft(s: GxiSim): number {
  let left = 0;
  for (let mi = s.mi; mi < GXI.MODES.length; mi++) {
    const n = GXI.MODES[mi];
    for (let k = 0; k < n - 1; k++) left += mi === s.mi ? GXI.PIN_HITS - Math.min(GXI.PIN_HITS, s.pins[k]) : GXI.PIN_HITS;
  }
  return left;
}
/** đủ nút của mode hiện tại: sang lượt dự đoán mode kế, hoặc ru ngủ nếu là mode cuối (true = thắng) */
function finishMode(s: GxiSim, t: number): boolean {
  if (s.mi >= GXI.MODES.length - 1) {
    s.hp = 0;
    enter(s, "hush", t);
    return true;
  }
  s.prevN = modeN(s);
  s.mi++;
  s.pins.fill(0);
  s.guessNode = -1;
  s.hp = hpLeft(s);
  enter(s, "predict", t);
  return false;
}

export type HitResult = "wake" | "pin" | "node" | "mode" | "win" | "antinode" | "sewn" | "far" | "locked";
/**
 * Người chơi đánh trúng vách khi đang đứng ở (pu, pv). Chỉ đòn từ dải NÚT mới ghim được; bụng sóng nuốt đòn.
 *  pin = thêm một mũi; node = may xong một nút; mode = xong mọi nút → lượt dự đoán; win = xong mode cuối.
 */
export function hitGxi(s: GxiSim, t: number, pu: number, pv: number): HitResult {
  if (s.stage === "dormant") {
    enter(s, "reveal", t);
    return "wake";
  }
  if (s.stage !== "fight") return "locked";
  if (pv > GXI.PIN_REACH || pv < -1.5) return "far";
  const n = modeN(s);
  const node = nodeAt(pu, n, s.L);
  if (node < 0) return "antinode";
  if (s.pins[node] >= GXI.PIN_HITS) return "sewn";
  s.pins[node]++;
  s.lastNode = node;
  s.hp = hpLeft(s);
  if (s.pins[node] < GXI.PIN_HITS) return "pin";
  if (!pinsDone(s)) return "node";
  return finishMode(s, t) ? "win" : "mode";
}

// ───────────── Hình (thuần — cùng mốc thời gian với luật) ─────────────

const sm = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** trạng thái hình của vách / sàn / gối ở thời điểm t (luật) — tv = đồng hồ hình (HARMONIC.time) cho dao động trôi */
export interface GxiVisual {
  /** 0 = gối gấp, 1 = vách mở hết chiều dài */
  unfold: number;
  /** 0 = cao như gối, 1 = cao D */
  rise: number;
  /** vách hiện (0 / 1) */
  wall: number;
  /** gối (mặt trước) hiện 0…1 — dẹt dần khi lộ dạng */
  pillow: number;
  /** mắt bị ép thành đường may 0…1 */
  squash: number;
  /** mắt nhắm (ngủ) 0 / 1 */
  sleep: number;
  n: number;
  amp: number;
  osc: number;
  pull: number;
  slam: number;
  /** sàn: độ đậm vùng hiểm 0…1, loại đòn 0 slam / 1 whip, chớp chốt 0…1, xem trước mờ (khúc mẫu), khung dự đoán */
  tele: number;
  atk: number;
  commit: number;
  preview: number;
  predict: number;
  /** sợi chỉ: hiện 0…1, độ lệch có dấu (−1…1) */
  whip: number;
  whipOsc: number;
  /** đường may nút: mode đang vẽ + độ hiện */
  seamN: number;
  seamA: number;
  /** đếm lùi (phách còn lại, 0 khi không đếm) */
  count: number;
}
export function newVisual(): GxiVisual {
  return { unfold: 0, rise: 0, wall: 0, pillow: 1, squash: 0, sleep: 0, n: 2, amp: 0, osc: 0, pull: 0, slam: 0, tele: 0, atk: 0, commit: 0, preview: 0, predict: 0, whip: 0, whipOsc: 0, seamN: 2, seamA: 0, count: 0 };
}

/** điền V (không cấp phát). calm = giảm chuyển động: dao động nhỏ, không rung — giữ nguyên hình dạng + báo trước */
export function gxiVisual(s: GxiSim, t: number, tv: number, V: GxiVisual, calm = false): GxiVisual {
  const n = modeN(s);
  V.n = n;
  V.unfold = 1;
  V.rise = 1;
  V.wall = 1;
  V.pillow = 0;
  V.squash = 1;
  V.sleep = 0;
  V.amp = calm ? 0.06 : 0.16;
  V.osc = Math.cos(2 * Math.PI * GXI.F1 * n * tv);
  V.pull = 0;
  V.slam = 0;
  V.tele = 0;
  V.atk = 0;
  V.commit = 0;
  V.preview = 0;
  V.predict = 0;
  V.whip = 0;
  V.whipOsc = 0;
  V.seamN = n;
  V.seamA = 1;
  V.count = 0;
  const dt = t - s.at;
  switch (s.stage) {
    case "dormant":
    case "done": {
      V.unfold = 0;
      V.rise = 0;
      V.wall = 0;
      V.pillow = 1;
      V.squash = 0;
      V.sleep = s.stage === "done" ? 1 : 0;
      V.amp = 0;
      V.seamA = 0;
      return V;
    }
    case "reveal": {
      const k = dt / GXI.REVEAL;
      V.unfold = sm(0.18, 0.78, k);
      V.rise = sm(0.55, 0.96, k);
      V.wall = k > 0.14 ? 1 : 0;
      V.pillow = 1 - sm(0.14, 0.42, k);
      V.squash = sm(0.2, 0.55, k);
      V.amp = 0;
      V.seamN = GXI.MODES[0];
      V.seamA = sm(0.6, 1, k);
      return V;
    }
    case "hush": {
      const k = dt / GXI.HUSH;
      V.unfold = 1 - sm(0.1, 0.75, k);
      V.rise = 1 - sm(0, 0.45, k);
      V.wall = k < 0.86 ? 1 : 0;
      V.pillow = sm(0.6, 0.9, k);
      V.squash = 1 - sm(0.6, 0.95, k);
      V.sleep = 1;
      V.amp = (calm ? 0.03 : 0.08) * (1 - k);
      V.seamA = 1 - sm(0.3, 0.8, k);
      return V;
    }
    case "demo": {
      // khúc mẫu vô hại: vách dao động rõ, sàn hiện mờ nơi bụng SẼ đập (đường nét đứt)
      V.amp = calm ? 0.12 : 0.32;
      V.preview = sm(0, 2, dt / BEAT);
      return V;
    }
    case "predict": {
      const b = dt / BEAT;
      const P = PREDICT_BEATS;
      // bung đường may cũ, vách chùng phẳng (không lộ nút mới) → đếm lùi đoán → chốt: vách hiện dáng mới → đập
      V.seamN = b < P.commit ? s.prevN : n;
      V.seamA = b < P.guess ? 1 - sm(0, P.guess, b) : b < P.commit ? 0 : sm(P.recover, P.end, b);
      V.amp = b < P.guess ? (calm ? 0.06 : 0.16) * (1 - sm(0, P.guess, b)) : 0;
      if (b < P.guess) V.n = s.prevN;
      V.predict = b >= P.guess - 0.5 && b < P.recover ? 1 : 0;
      if (b >= P.guess && b < P.commit) V.count = Math.ceil(P.commit - b);
      if (b >= P.commit && b < P.active) {
        V.pull = 0.45 * sm(P.commit, P.commit + 0.25, b);
        V.commit = 1 - sm(P.commit, P.active, b) * 0.5;
      } else if (b >= P.active) {
        V.slam = sm(P.active, P.active + 0.15, b) * (1 - sm(P.recover, P.end, b));
        V.tele = b < P.active + SLAM_WINDOW ? 1 : 1 - sm(P.active + SLAM_WINDOW, P.recover, b);
      }
      return V;
    }
    case "fight": {
      const b = (t - s.atkAt) / BEAT;
      const k = ATK_BEATS[s.atk];
      V.atk = s.atk === "slam" ? 0 : 1;
      // sàn: hiện dần trong pha dồn lực, đậm suốt báo trước → đánh, tan khi hồi
      V.tele = b < k.tele ? sm(0, k.tele, b) * 0.7 : b < k.recover + 0.4 ? 1 : 1 - sm(k.recover + 0.4, k.recover + 1.2, b);
      if (b >= k.tele && b < k.commit) V.count = Math.ceil(k.commit - b);
      if (b >= k.commit && b < k.active) V.commit = 1 - sm(k.commit, k.active, b) * 0.4;
      if (s.atk === "slam") {
        // dồn lực: bụng hít về sau (ngược hướng đập), giữ run khi báo trước, kéo hết cỡ lúc chốt → đập → nhấc dần
        V.amp = (calm ? 0.06 : 0.16) * (1 - sm(0, k.tele, b)) + (b >= k.recover ? (calm ? 0.06 : 0.16) * sm(k.recover + 0.5, k.end, b) : 0);
        V.pull = b < k.commit ? 0.3 * sm(0, k.tele, b) : b < k.active ? 0.3 + 0.15 * sm(k.commit, k.commit + 0.3, b) : 0;
        V.slam = b < k.active ? 0 : sm(k.active, k.active + 0.15, b) * (1 - sm(k.recover, k.recover + 1.6, b));
      } else {
        // Dây Chỉ Quất: chỉ căng hiện từ hai kẹp, gảy lúc chốt, rung suốt pha đánh với tần số bậc n
        V.whip = b < k.tele ? sm(0, k.tele, b) : b < k.recover + 0.6 ? 1 : 1 - sm(k.recover + 0.6, k.end, b);
        if (b >= k.active && b < k.recover) V.whipOsc = Math.cos(2 * Math.PI * GXI.F1 * n * 4 * (b - k.active) * BEAT);
        else if (b >= k.commit && b < k.active) V.whipOsc = -sm(k.commit, k.active, b);
        else if (b >= k.recover) V.whipOsc = 0.15 * Math.cos(2 * Math.PI * GXI.F1 * n * 4 * (b - k.active) * BEAT) * (1 - sm(k.recover, k.recover + 1, b));
        V.amp = calm ? 0.05 : 0.1;
      }
      return V;
    }
  }
  return V;
}

// ───────────── Văn bản song ngữ (i18n: kiểu L = { en, vi }) ─────────────

export const GXI_TEXT = {
  name: { en: "The Hushed Pleat", vi: "Gối Xếp Im" },
  mode: { en: "Mode n = {n}", vi: "Mode n = {n}" },
  modeNext: { en: "n: {a} → {b}", vi: "n: {a} → {b}" },
  dormant: { en: "A tiny quilted pillow. Some stitches never move when it breathes…", vi: "Một chiếc gối chần bông bé xíu. Khi nó thở, vài mũi chỉ chẳng bao giờ động đậy…" },
  reveal: { en: "It unfolds sideways!", vi: "Nó mở ngang ra!" },
  demo: { en: "Watch: which points of the wall never move?", vi: "Quan sát: điểm nào trên vách không bao giờ chuyển động?" },
  slam: { en: "Fold Slam — stand in a node lane (solid edges)!", vi: "Gập Bụng — đứng ở dải NÚT (viền liền)!" },
  whip: { en: "Thread Whip — cross at a node, or jump!", vi: "Dây Chỉ Quất — băng qua ở nút, hoặc nhảy!" },
  pinHint: { en: "Strike the wall from a NODE to pin it ({k}/{m})", vi: "Đánh vào vách từ chỗ NÚT để ghim ({k}/{m})" },
  predict: { en: "The wall is re-tuning to {n} loops. Stand where you predict a node!", vi: "Vách đổi sang {n} bụng. Đứng ở chỗ bạn đoán là NÚT!" },
  predictFormula: { en: "Ends are fixed: nodes at x = k·L/n", vi: "Hai đầu cố định: nút ở x = k·L/n" },
  hush: { en: "The room is still.", vi: "Căn phòng đã lặng." },
  win: { en: "The Hushed Pleat falls asleep. Standing waves noted!", vi: "Gối Xếp Im ngủ say. Đã ghi chép sóng dừng!" },
  fPin: { en: "pinned!", vi: "ghim!" },
  fNode: { en: "node sewn ✓", vi: "đã may nút ✓" },
  fAntinode: { en: "antinode — the cloth swallows it", vi: "bụng sóng — vải nuốt đòn" },
  fSewn: { en: "already sewn — find another node", vi: "nút này đã may — tìm nút khác" },
  fLocked: { en: "the cloth is re-tuning…", vi: "vải đang đổi mode…" },
  fFar: { en: "get closer to the wall", vi: "lại gần vách hơn" },
  fGuessOk: { en: "Predicted node! ✓", vi: "Đoán đúng nút! ✓" },
  fGuessMiss: { en: "not a node — x = k·L/{n}", vi: "chưa phải nút — x = k·L/{n}" },
  fWake: { en: "…!", vi: "…!" },
  node: { en: "node", vi: "nút" },
  loops: { en: "{n} loops · f = {n}·f₁ = {hz} Hz", vi: "{n} bụng · f = {n}·f₁ = {hz} Hz" },
  reward: { en: "Field note unlocked: Standing waves", vi: "Mở ghi chép: Sóng dừng" },
} satisfies Record<string, L>;

export type GxiTextKey = keyof typeof GXI_TEXT;
/** văn bản theo ngôn ngữ, tham số {k} */
export function gxiText(lang: "en" | "vi", key: GxiTextKey, p?: Record<string, string | number>): string {
  let s = GXI_TEXT[key][lang] ?? GXI_TEXT[key].en;
  if (p) for (const k in p) s = s.split(`{${k}}`).join(String(p[k]));
  return s;
}
