/**
 * Phù thuỷ hoạ âm #4 — KHOẢNG TRỪ (giao thoa, HOÀN TOÀN TRỪU TƯỢNG). Logic THUẦN (tất định, test được, không cấp phát mỗi khung).
 * Thiết kế: docs/ai-reviews/siren-witch/WITCHES_CODEX.md §4. Hình: components/world/scene/siren/witches/KhoangTru.tsx.
 *
 * Không có thân, mặt hay mắt: chỉ hai dải sóng giấy khắc treo song song, biên mực và khoảng rỗng. Căn phòng (Phòng Chờ — tầng
 * "Bản nháp") cứ in thêm một bản sao để cố xoá bản trước. Hai sứ giả trừu tượng giữ thang đo cố định trong lúc dải trượt:
 * NÊM BIÊN ĐỘ (tam giác xếp tầng = độ lớn A₂) và VẠCH ĐẢO PHA (cặp vạch gãy chung gốc = độ lệch pha φ).
 *
 * Quy luật (một nguồn cho cả LUẬT lẫn HÌNH):
 *  - nguồn 1 cố định: y₁(u) = A₁·sin(ku − θ); nguồn 2 người chơi chỉnh: y₂(u) = A₂·sin(ku − θ + φ) (A₂ ∈ AMPS, φ ∈ PHASES);
 *  - dải tổng y = y₁ + y₂ = R·sin(ku − θ + δ), R = √(A₁² + A₂² + 2A₁A₂·cos φ) — R = 0 ⇔ A₂ = A₁ VÀ φ = 180°;
 *  - "Bản In Chồng": mỗi chu kỳ 8 phách, bản in tích lực rồi DẬP xuống dải sàn ở phách 6: chỗ |y(u)| > S là vùng hiểm;
 *    báo trước 5 phách (phách 1 → 6: hiện hai đường thành phần + đường tổng cạnh nhau); núm khoá từ phách 5,5 (chốt);
 *  - THẮNG = hiểu khái niệm: lúc dập mà R ≈ 0 → dải tổng phẳng thành đường trắng → "khoảng lặng", qua vòng. 3 vòng:
 *      1) A₂ = A₁, φ = 0 → chỉ cần đảo pha 180°;
 *      2) A₂ = ½A₁, đã đảo pha sẵn → tổng vẫn còn sóng R = ½: phải tăng A₂ bằng A₁;
 *      3) DỰ ĐOÁN: A₂ = 1,5·A₁, φ = 90°, đường tổng bị che ("? ? ?") — tự chỉnh cả hai rồi chờ dập.
 *  - Tất định: thời gian do người gọi truyền vào (giây, cùng đồng hồ nhạc 96 BPM), không ngẫu nhiên.
 *
 * Biểu thức vùng hiểm viết MỘT lần dưới dạng chuỗi hợp lệ CẢ GLSL lẫn JS (KTR_SUM_EXPR / KTR_DANGER_EXPR) — shader sàn + dải tổng
 * dùng nguyên chuỗi; test so bản JS với luật (ktrDanger) ở hàng chục nghìn điểm (dùng evalShared của Gối Xếp Im).
 */
import { HARMONIC_BPM } from "./harmonicState";
import type { L } from "./i18n";

export const KTR_BEAT = 60 / HARMONIC_BPM;
export const KTR = {
  /** dải sàn: dài L (dọc u), sâu W (v ∈ [0, W] trước chân dải treo) */
  L: 8,
  W: 2.6,
  /** bước sóng (m) → k = 2π/λ: 2 bước sóng trên dải */
  LAMBDA: 4,
  A1: 1,
  /** |y| > S → vùng hiểm lúc dập */
  S: 0.22,
  /** R ≤ EPS → coi là triệt tiêu (khoảng lặng) */
  EPS: 1e-6,
  AMPS: [0.5, 1, 1.5] as const,
  PHASES: [0, 90, 180, 270] as const,
  /** vòng: chỉ số A₂, chỉ số φ ban đầu, có che đường tổng (dự đoán) không */
  ROUNDS: [
    { a: 1, p: 0, hide: false },
    { a: 0, p: 2, hide: false },
    { a: 2, p: 1, hide: true },
  ] as const,
  /** lại gần tâm sân trong bán kính này → lộ diện */
  WAKE_R: 7,
  REVEAL: 3.2,
  /** chu kỳ đòn (phách): báo trước từ TELE, chốt núm từ LOCK, dập ở STAMP, hồi tới hết chu kỳ */
  CYCLE: 8,
  TELE: 1,
  LOCK: 5.5,
  STAMP: 6,
  ACTIVE: 0.5,
  DMG: 16,
} as const;
export const KTR_K = (2 * Math.PI) / KTR.LAMBDA;

/** biên độ tổng R của hai sóng cùng tần số lệch pha φ (độ) */
export function sumAmp(a1: number, a2: number, phDeg: number): number {
  const c = Math.cos((phDeg * Math.PI) / 180);
  const r2 = a1 * a1 + a2 * a2 + 2 * a1 * a2 * c;
  return Math.sqrt(Math.max(0, r2));
}
/** dải tổng tại u, pha thời gian θ (rad) */
export function sumWave(u: number, a1: number, a2: number, phDeg: number, theta: number): number {
  const ph = (phDeg * Math.PI) / 180;
  return a1 * Math.sin(KTR_K * u - theta) + a2 * Math.sin(KTR_K * u - theta + ph);
}
/** LUẬT vùng hiểm lúc dập tại (u dọc dải, v trước chân dải) */
export function ktrDanger(u: number, v: number, a1: number, a2: number, phDeg: number, theta: number): boolean {
  if (!(u >= 0 && u <= KTR.L && v >= 0 && v <= KTR.W)) return false;
  return Math.abs(sumWave(u, a1, a2, phDeg, theta)) > KTR.S;
}
/** CÙNG biểu thức cho shader (GLSL) và kiểm (JS). Biến: u, v; uniform: uA1 uA2 uPh (rad) uTh uK uL uW uS */
export const KTR_SUM_EXPR = "(uA1 * sin(uK * u - uTh) + uA2 * sin(uK * u - uTh + uPh))";
export const KTR_DANGER_EXPR = `((u >= 0.0 && u <= uL && v >= 0.0 && v <= uW) && abs(${KTR_SUM_EXPR}) > uS)`;
export function ktrUniforms(a1: number, a2: number, phDeg: number, theta: number): Record<string, number> {
  return { uA1: a1, uA2: a2, uPh: (phDeg * Math.PI) / 180, uTh: theta, uK: KTR_K, uL: KTR.L, uW: KTR.W, uS: KTR.S };
}

// ───────────── Máy trạng thái ─────────────
export type KtrStage = "dormant" | "reveal" | "fight" | "done";
export interface KtrSim {
  stage: KtrStage;
  at: number;
  /** vòng hiện tại 0…2 */
  round: number;
  /** chỉ số A₂ / φ người chơi đang chọn */
  ai: number;
  pi: number;
  /** số chu kỳ đòn đã dập (để mỗi lần dập xử lý đúng một lần) */
  stamped: number;
  /** mốc bắt đầu chuỗi đòn (giây) — chu kỳ tính từ đây */
  t0: number;
  /** số lần dập trúng người chơi / số vòng đã qua */
  hurts: number;
  /** pha thời gian θ đóng băng lúc dập gần nhất (để vẽ / kiểm vết in) */
  lastTheta: number;
  lastR: number;
  /** số chu kỳ đã báo trước (mỗi chu kỳ đúng một lần) */
  teled: number;
  /** bắt đầu rời xa sân (giây; −1 = đang ở gần) — rời quá 6 s thì ngủ lại (thử lại từ đầu vòng hiện tại) */
  farSince: number;
}
export function newKtr(): KtrSim {
  return { stage: "dormant", at: 0, round: 0, ai: KTR.ROUNDS[0].a, pi: KTR.ROUNDS[0].p, stamped: 0, t0: 0, hurts: 0, lastTheta: 0, lastR: 1, teled: 0, farSince: -1 };
}
export const ktrA2 = (s: KtrSim) => KTR.AMPS[s.ai];
export const ktrPh = (s: KtrSim) => KTR.PHASES[s.pi];
export const ktrR = (s: KtrSim) => sumAmp(KTR.A1, ktrA2(s), ktrPh(s));
/** θ của bản in ở thời điểm t (giây): dải trượt chậm 1/4 vòng mỗi phách — nhưng đóng băng lúc dập ở chu kỳ đó */
export const ktrTheta = (t: number) => ((t / KTR_BEAT) * Math.PI) / 2;
/** phách trong chu kỳ đòn hiện tại (0 ≤ b < CYCLE) và số chu kỳ */
export function ktrBeat(s: KtrSim, t: number): { b: number; cycle: number } {
  const x = Math.max(0, (t - s.t0) / KTR_BEAT);
  const cycle = Math.floor(x / KTR.CYCLE);
  return { b: x - cycle * KTR.CYCLE, cycle };
}
/** núm đang khoá (đã chốt bản in sắp dập)? */
export function ktrLocked(s: KtrSim, t: number): boolean {
  if (s.stage !== "fight") return true;
  const { b } = ktrBeat(s, t);
  return b >= KTR.LOCK && b < KTR.STAMP + KTR.ACTIVE;
}

export const KEV = { REVEAL: 1, FIGHT: 2, TELE: 4, STAMP: 8, HURT: 16, CLEAR: 32, WIN: 64, RESET: 128 } as const;

/**
 * Một bước mô phỏng ở thời điểm t (giây). pu, pv: chỗ đứng người chơi trong hệ dải (u dọc dải, v trước chân dải); dist: khoảng
 * cách tới tâm sân. Trả về mặt nạ sự kiện KEV.
 */
export function tickKtr(s: KtrSim, t: number, pu: number, pv: number, dist: number): number {
  let ev = 0;
  if (s.stage === "dormant") {
    if (dist <= KTR.WAKE_R) {
      s.stage = "reveal";
      s.at = t;
      ev |= KEV.REVEAL;
    }
    return ev;
  }
  if (s.stage === "reveal") {
    if (t - s.at >= KTR.REVEAL) {
      s.stage = "fight";
      s.at = t;
      // chu kỳ đầu bắt đầu ở phách nguyên kế tiếp (khớp nhạc)
      s.t0 = Math.ceil(t / KTR_BEAT) * KTR_BEAT;
      s.stamped = 0;
      s.teled = 0;
      ev |= KEV.FIGHT;
    }
    return ev;
  }
  if (s.stage !== "fight") return ev;
  // rời sân quá lâu → dải ngủ lại (giữ số vòng đã qua, đặt lại núm của vòng hiện tại)
  if (dist > KTR.WAKE_R + 12) {
    if (s.farSince < 0) s.farSince = t;
    else if (t - s.farSince > 6) {
      s.stage = "dormant";
      s.farSince = -1;
      s.ai = KTR.ROUNDS[s.round].a;
      s.pi = KTR.ROUNDS[s.round].p;
      return ev | KEV.RESET;
    }
  } else s.farSince = -1;
  const { b, cycle } = ktrBeat(s, t);
  if (t < s.t0) return ev;
  // dập đúng một lần mỗi chu kỳ, ở phách STAMP
  if (cycle + 1 > s.stamped && b >= KTR.STAMP) {
    s.stamped = cycle + 1;
    const th = ktrTheta(s.t0 + (cycle * KTR.CYCLE + KTR.STAMP) * KTR_BEAT);
    s.lastTheta = th;
    const R = ktrR(s);
    s.lastR = R;
    ev |= KEV.STAMP;
    if (ktrDanger(pu, pv, KTR.A1, ktrA2(s), ktrPh(s), th)) {
      s.hurts++;
      ev |= KEV.HURT;
    }
    if (R <= KTR.EPS) {
      ev |= KEV.CLEAR;
      s.round++;
      if (s.round >= KTR.ROUNDS.length) {
        s.stage = "done";
        s.at = t;
        ev |= KEV.WIN;
      } else {
        s.ai = KTR.ROUNDS[s.round].a;
        s.pi = KTR.ROUNDS[s.round].p;
      }
    }
  } else if (b >= KTR.TELE && b < KTR.STAMP && cycle + 1 > s.teled) {
    s.teled = cycle + 1;
    ev |= KEV.TELE;
  }
  return ev;
}
/** người chơi xoay núm: "amp" = Nêm Biên Độ (vòng A₂), "phase" = Vạch Đảo Pha (+90°). Khoá khi đã chốt → false */
export function turnKtr(s: KtrSim, t: number, dial: "amp" | "phase"): boolean {
  if (ktrLocked(s, t)) return false;
  if (dial === "amp") s.ai = (s.ai + 1) % KTR.AMPS.length;
  else s.pi = (s.pi + 1) % KTR.PHASES.length;
  return true;
}
/** đường tổng có bị che không (vòng dự đoán: chỉ lộ lúc dập) */
export function ktrHideSum(s: KtrSim, t: number): boolean {
  if (s.stage !== "fight" || !KTR.ROUNDS[s.round]?.hide) return false;
  const { b } = ktrBeat(s, t);
  return b < KTR.STAMP;
}

// ───────────── Văn bản song ngữ ─────────────
export const KTR_TEXT = {
  name: { vi: "Khoảng Trừ", en: "The Subtracted Gap" },
  dormant: { vi: "Hai dải giấy khắc treo im — lại gần xem", en: "Two engraved paper ribbons hang still — come closer" },
  reveal: { vi: "Căn phòng in thêm một bản sao để xoá bản trước…", en: "The room prints another copy to erase the last…" },
  tele: { vi: "Bản in chồng sắp dập — làm dải tổng PHẲNG!", en: "The overprint is about to stamp — make the sum FLAT!" },
  locked: { vi: "Bản in đã chốt — núm khoá", en: "The print is set — dials locked" },
  clear: { vi: "Khoảng lặng! Hai sóng triệt tiêu: R = 0", en: "Silence! The waves cancel: R = 0" },
  left: { vi: "Vẫn còn sóng: R = {r}", en: "Still a wave: R = {r}" },
  predict: { vi: "Dự đoán: đường tổng bị che — tự chỉnh A₂ và φ", en: "Predict: the sum is hidden — set A₂ and φ yourself" },
  win: { vi: "Khoảng Trừ tự xoá mình — chỉ còn một đường trắng", en: "The Subtracted Gap erases itself — one white line remains" },
  amp: { vi: "Nêm Biên Độ: A₂ = {a}", en: "Amplitude Wedge: A₂ = {a}" },
  phase: { vi: "Vạch Đảo Pha: φ = {p}°", en: "Phase Mark: φ = {p}°" },
  dialAmp: { vi: "Xoay Nêm Biên Độ (A₂ = {a})", en: "Turn the Amplitude Wedge (A₂ = {a})" },
  dialPhase: { vi: "Xoay Vạch Đảo Pha (φ = {p}°)", en: "Turn the Phase Mark (φ = {p}°)" },
  formula: { vi: "R = √(A₁² + A₂² + 2A₁A₂·cos φ)", en: "R = √(A₁² + A₂² + 2A₁A₂·cos φ)" },
  round: { vi: "Vòng {i}/3", en: "Round {i}/3" },
} satisfies Record<string, L>;
export type KtrTextKey = keyof typeof KTR_TEXT;
export function ktrText(lang: "en" | "vi", key: KtrTextKey, p?: Record<string, string | number>): string {
  let s: string = KTR_TEXT[key][lang];
  if (p) for (const [k, v] of Object.entries(p)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
