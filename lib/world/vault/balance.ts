/**
 * Hầm Bổ đề · Phòng II — Cân Archimedes (Noether). Logic thuần.
 *
 * Ý toán / lý: mô-men τ = m·d. Đòn cân thăng bằng khi Σ mᵢdᵢ = 0: vật nhẹ ở xa cân được vật nặng ở gần.
 * Mỗi người (và Tiếng Vọng) nặng 1; "cánh tay đòn" = số khắc gần nhất nơi mình đứng (−7…7, âm = bên trái).
 * Đòn nghiêng theo mô-men tổng: θ_cb = atan(Στ / K) (như cân thật có trọng tâm dưới trục), θ tiến dần tới θ_cb.
 * θ > 0: đầu PHẢI chúi xuống. Thăng bằng khi |Στ| < 0,5 (màn 2: < 1).
 *
 * Màn:
 *  S1 "Cân đá": Tảng Bổ đề cố định bên phải, M·D chọn sao cho CẦN ĐỦ N người: 7(N−1) < M·D ≤ 7N.
 *  S2 "Cùng sang bờ": đá trượt được trên ray (đứng cạnh đá bấm F để đẩy xa mình 1 khắc). Mọi người phải đứng ở đầu phải
 *     (khắc ≥ 5) trong khi đòn vẫn thăng bằng → phải đẩy đá sang trái đúng nhịp với đoàn người đi sang phải.
 *  S3 "Máy bắn đá": sân riêng phía sau đòn cân. Bập bênh 6 m dưới tháp gió: người BỔ NHÀO (rơi từ đỉnh cột gió) xuống đầu
 *     ngắn bắn người / Quả cân ở đầu dài lên. Va chạm KHÔNG đàn hồi quanh trục — bảo toàn mô-men động lượng (Noether):
 *       v₂ = m₁·v₁·d₁·d₂ / (m₁·d₁² + m₂·d₂²)     (mọi khối lượng = 1; m₁ = số người chạm trong cùng 250 ms)
 *     v₁ = √(2·40·h_rơi) (trọng lực bổ nhào 40; cú lao −26 lúc bắt đầu chỉ để "cảm giác", KHÔNG tính), bay cao h₂ = v₂² / (2·22).
 *     Chuông A (4,5 m) cần 1 người rơi (ổ giữa); chuông B (9 m) cần 2 người chạm CÙNG LÚC (đếm 3-2-1) + điểm tựa ở ổ XA
 *     (d₂/d₁ = √2). B bị niêm cho tới khi A đã kêu. Server quyết cú bắn; client người được bắn đặt motion.vy = v₂.
 */
import { clamp } from "./geom";

export const BEAM = { half: 8, y: 2.2, w: 0.9 };
export const PLAT = { x0: 8.4, x1: 15, w: 3.2 };
export const K_TILT = 60;
export const MAX_TILT = 0.26;
export const SLIDE_FROM = (6 * Math.PI) / 180;
export const B_STAGES = 3;
export const CHASM_Y = -20;
/** ray của Tảng Bổ đề chạy dọc mép sau của đòn (người đi ngang qua đá được) */
export const STONE_Z = -1.55;

export interface BState {
  /** màn 0 / 1 */
  sg: number;
  /** góc nghiêng hiện tại (rad), mô-men tổng */
  th: number;
  tau: number;
  /** khối lượng + vị trí (khắc) của Tảng Bổ đề; mov = đẩy được */
  m: number;
  sx: number;
  mov: boolean;
  /** thời gian đã giữ thăng bằng (ms) */
  hold: number;
  /** cánh tay đòn từng ghế (null = không đứng trên đòn) */
  arms: (number | null)[];
  pushAt: number;
  pushes: number;
  /** máy bắn đá (chỉ màn 3) */
  cat: Cat | null;
}

export function stoneFor(stage: number, n: number): { m: number; x: number } {
  if (stage === 0) return n >= 4 ? { m: 5, x: 5 } : n === 3 ? { m: 3, x: 6 } : { m: 2, x: 6 };
  // màn 3: đá nằm giữa ray (đòn cân đứng yên làm cảnh nền)
  if (stage === 2) return { m: n, x: 0 };
  return { m: n, x: 3 };
}
export function bInit(stage: number, n: number): BState {
  const s = stoneFor(stage, n);
  return { sg: stage, th: 0, tau: 0, m: s.m, sx: s.x, mov: stage === 1, hold: 0, arms: Array.from({ length: n }, () => null), pushAt: 0, pushes: 0, cat: stage === 2 ? cInit(n) : null };
}

/** Mặt đòn tại x (θ > 0 → bên phải thấp) */
export function beamY(th: number, x: number): number {
  return BEAM.y - x * Math.tan(th);
}
/** Đứng trên đòn? → cánh tay đòn (khắc gần nhất), không thì null */
export function armOf(th: number, x: number, y: number, z: number): number | null {
  if (Math.abs(x) > BEAM.half + 0.1 || Math.abs(z) > BEAM.w + 0.15) return null;
  if (Math.abs(y - beamY(th, x)) > 1.2) return null;
  return clamp(Math.round(x), -7, 7);
}
export function torque(arms: (number | null)[], m: number, sx: number): number {
  let t = m * sx;
  for (const a of arms) if (a !== null) t += a;
  return t;
}
export function tiltTarget(tau: number): number {
  return clamp(Math.atan(tau / K_TILT), -MAX_TILT, MAX_TILT);
}
/** Lò xo tắt dần tới θ đích (≈ 0,6 s tới gần đủ) */
export function tiltStep(th: number, target: number, dt: number): number {
  return th + (target - th) * (1 - Math.exp(-dt / 0.22));
}
export const levelTol = (st: BState) => (st.sg === 1 ? 1 : 0.5);

/** Mục tiêu màn đã đạt (chưa tính thời gian giữ) */
export function bGoal(st: BState): boolean {
  if (st.cat) return st.cat.sw[0] && st.cat.sw[1];
  if (Math.abs(st.tau) >= levelTol(st)) return false;
  if (st.sg === 0) return true;
  return st.arms.every((a) => a !== null && a >= 5);
}

export function bTick(st: BState, pos: ([number, number, number] | null)[], dt: number) {
  st.arms = st.arms.map((_, i) => {
    const p = pos[i];
    return p ? armOf(st.th, p[0], p[1], p[2]) : null;
  });
  st.tau = torque(st.arms, st.m, st.sx);
  st.th = tiltStep(st.th, tiltTarget(st.tau), dt);
  if (Math.abs(st.th) < 1e-4) st.th = 0;
  st.hold = bGoal(st) ? st.hold + dt * 1000 : 0;
}
export const B_HOLD = 2000;
export const bClear = (st: BState) => st.hold >= B_HOLD;
export function bProgress(st: BState): number {
  if (st.cat) {
    const c = st.cat;
    return Math.round(((c.sw[0] ? 0.4 : 0) + (c.sw[1] ? 0.4 : 0) + Math.min(1, c.best / SW_H[1]) * 0.2) * 20) / 20;
  }
  const lv = clamp(1 - Math.abs(st.tau) / (st.m * 7 + 7), 0, 1);
  if (st.sg === 0) return Math.round(lv * 20) / 20;
  const right = st.arms.filter((a) => a !== null && a >= 5).length / st.arms.length;
  return Math.round((lv * 0.4 + right * 0.6) * 20) / 20;
}

/** Đẩy đá (màn 2): phải đứng cạnh đá (≤ 1,7 m), đẩy XA mình 1 khắc; nghỉ 350 ms giữa hai lần */
export function bPush(st: BState, px: number, pz: number, now: number): boolean {
  if (!st.mov || now - st.pushAt < 350) return false;
  if (Math.hypot(px - st.sx, pz - STONE_Z) > 1.9) return false;
  const dir = px <= st.sx ? 1 : -1;
  const nx = clamp(st.sx + dir, -7, 7);
  if (nx === st.sx) return false;
  st.sx = nx;
  st.pushAt = now;
  st.pushes++;
  return true;
}

/** Mặt đất phòng Cân: bệ trái (xuất phát), đòn, bệ phải (lối ra); còn lại là vực. Màn 3 (sg = 2): sân máy bắn đá */
export function bGround(th: number, x: number, z: number, sg = 0): number {
  if (sg === 2) return cGround(x, z);
  if (Math.abs(x) <= BEAM.half && Math.abs(z) <= BEAM.w) return beamY(th, x);
  if (Math.abs(x) >= PLAT.x0 && Math.abs(x) <= PLAT.x1 && Math.abs(z) <= PLAT.w) return BEAM.y;
  // khe giữa đầu đòn và bệ: lấy mặt gần nhất (không rơi qua khe)
  if (Math.abs(x) > BEAM.half && Math.abs(x) < PLAT.x0 && Math.abs(z) <= BEAM.w) return Math.max(BEAM.y, beamY(th, Math.sign(x) * BEAM.half));
  return CHASM_Y;
}
export function bBlocked(th: number, x: number, z: number, y: number, sg = 0): boolean {
  // không bước ra vực (mép đòn, mép bệ); màn 3: thân tháp gió chắn
  if (sg === 2 && Math.hypot(x - TOWER.x, z - TOWER.z) < TOWER.r && y < CAT.top) return true;
  return bGround(th, x, z, sg) === CHASM_Y;
}
/** Hướng trượt trên đòn khi nghiêng quá 6° (−1 trái, 1 phải, 0 không trượt) */
export function slideDir(th: number): number {
  return Math.abs(th) > SLIDE_FROM ? Math.sign(th) : 0;
}
export function slideSpeed(th: number): number {
  return Math.abs(th) > SLIDE_FROM ? Math.min(3, ((Math.abs(th) - SLIDE_FROM) / (MAX_TILT - SLIDE_FROM)) * 3 + 0.6) : 0;
}

// ───────────── Màn 3: máy bắn đá (bập bênh dưới tháp gió) ─────────────

/** trọng lực thường (bay lên) và khi bổ nhào — đúng hằng số của Player (scene/Hub.tsx) */
export const G_UP = 22;
export const G_PLUNGE = 40;
/** sân máy bắn (mặt y = BEAM.y), phía sau đòn cân, cách vực */
export const COURT = { x0: -9, x1: 7, z0: -16, z1: -6 };
/**
 * Bập bênh dọc trục x tại z: bệ đáp (đầu ngắn) ở padX, ghế bắn (đầu dài) ở seatX; mặt trên y. Cột gió trên bệ đáp
 * cao `up` m (đỉnh = top), bán kính upR.
 */
export const CAT = { z: -11, padX: -2.5, seatX: 2.5, half: 3.1, w: 1.0, y: BEAM.y + 0.6, padR: 1.2, seatR: 1.1, up: 10, upR: 1.3, top: BEAM.y + 0.6 + 10 };
/** thân tháp gió (đứng cạnh đầu ngắn) */
export const TOWER = { x: -4.9, z: -11, r: 0.85 };
/** cần gạt dời điểm tựa (người vận hành đứng trong r) */
export const LEVER = { x: 0, z: -8.4, r: 2.0 };
/** ba ổ điểm tựa: tỉ số d₂/d₁ (ổ 0 gần ghế, ổ 1 giữa, ổ 2 XA ghế) */
export const SOCKETS = [Math.SQRT1_2, 1, Math.SQRT2];
/** chuông A / B: độ cao bay (m, tính từ mặt ghế) */
export const SW_H = [4.5, 9];
/** chạm chuông: vòng chuông dày + người có chiều cao → tính là tới khi bay ≥ SW_H − 0,2 m (độ rơi thật của người ≈ 9,7–10,8 m) */
export const SW_TOL = 0.2;
/** độ rơi tối đa được tính (đỉnh cột gió + chỗ vọt quá khi lượn) — kẹp, không thưởng thêm */
export const FALL_MAX = 10.8;
export const VY_MAX = Math.sqrt(2 * G_PLUNGE * FALL_MAX);
/** chạm cùng lúc = trong 250 ms; chạm trễ (≤ 700 ms sau cú bắn) bị phí; bổ nhào phải bắt đầu trong cột gió ≤ 3 s trước */
export const GROUP_MS = 250;
export const LATE_MS = 700;
export const UP_MS = 3000;
/** Tiếng Vọng bổ nhào lúc GO: chạm bệ sau 500 ms (≈ phản xạ + thời gian rơi của người thật) */
export const ECHO_PLUNGE_MS = 500;

export interface Launch {
  /** ghế được bắn (−1 = Quả cân Bổ đề) */
  by: number;
  v: number;
  h: number;
  /** số người cùng chạm, độ rơi trung bình */
  n: number;
  h1: number;
  sock: number;
  at: number;
}
export interface Cat {
  /** ổ điểm tựa 0 / 1 / 2 */
  sock: number;
  /** chuông A, B đã kêu (chốt) */
  sw: boolean[];
  /** lần cuối mỗi ghế ở cao trong cột gió; lần cuối gửi cú chạm */
  up: number[];
  last: number[];
  /** nhóm cú chạm đang mở (t0 = cú đầu) */
  grp: { t0: number; imp: { s: number; v: number; at: number }[] } | null;
  /** Tiếng Vọng đã hẹn bổ nhào (chạm lúc at) */
  ep: { s: number; at: number }[];
  launch: Launch | null;
  best: number;
  tries: number;
}

export function cInit(n: number): Cat {
  return { sock: 1, sw: [false, false], up: Array.from({ length: n }, () => -1e12), last: Array.from({ length: n }, () => -1e12), grp: null, ep: [], launch: null, best: 0, tries: 0 };
}
/** cánh tay đòn: d₁ (bệ đáp → điểm tựa), d₂ (điểm tựa → ghế); d₁ + d₂ = khoảng cách bệ – ghế; fx = x của điểm tựa */
export function catArms(sock: number): { d1: number; d2: number; fx: number } {
  const L = CAT.seatX - CAT.padX;
  const r = SOCKETS[clamp(Math.round(sock), 0, SOCKETS.length - 1)];
  const d1 = L / (1 + r);
  return { d1, d2: L - d1, fx: CAT.padX + d1 };
}
/** Va chạm không đàn hồi quanh trục: mô-men động lượng trước = sau → vận tốc ở ghế */
export function catapultV(m1: number, v1: number, d1: number, d2: number, m2: number): number {
  const I = m1 * d1 * d1 + m2 * d2 * d2;
  return I > 0 ? (m1 * v1 * d1 * d2) / I : 0;
}
/** vận tốc chạm khi rơi h (trọng lực bổ nhào), độ cao bay lên với vận tốc v (trọng lực thường) */
export const fallV = (h: number) => Math.sqrt(2 * G_PLUNGE * clamp(h, 0, FALL_MAX));
export const launchH = (v: number) => (v * v) / (2 * G_UP);
/** Một cú bắn: n người cùng rơi h₁ ở ổ sock → độ cao bay (m) */
export function shotH(n: number, h1: number, sock: number): number {
  const { d1, d2 } = catArms(sock);
  return launchH(catapultV(n, fallV(h1), d1, d2, 1));
}

export const onPad = (x: number, z: number) => Math.hypot(x - CAT.padX, z - CAT.z) <= CAT.padR;
export const onSeat = (x: number, y: number, z: number) => Math.hypot(x - CAT.seatX, z - CAT.z) <= CAT.seatR && Math.abs(y - CAT.y) < 1.2;
/** ở cao trong cột gió (đủ để tính là "bổ nhào từ tháp") */
export const inUpdraft = (x: number, y: number, z: number) => Math.hypot(x - CAT.padX, z - CAT.z) < CAT.upR + 0.4 && y > CAT.y + 2.5;

/** Mặt đất sân máy bắn: bập bênh (cố định khi đứng — chỉ nghiêng để nhìn lúc bắn), sân, còn lại vực */
export function cGround(x: number, z: number): number {
  if (Math.abs(x) <= CAT.half && Math.abs(z - CAT.z) <= CAT.w) return CAT.y;
  if (x >= COURT.x0 && x <= COURT.x1 && z >= COURT.z0 && z <= COURT.z1) return BEAM.y;
  return CHASM_Y;
}

/** Ghi nhận ai đang ở cao trong cột gió (gọi mỗi nhịp với vị trí đã biết) */
export function cTrack(c: Cat, pos: ([number, number, number] | null)[], now: number) {
  pos.forEach((p, i) => {
    if (p && i < c.up.length && inUpdraft(p[0], p[1], p[2])) c.up[i] = now;
  });
}

/**
 * Cú chạm bệ do client gửi (ghế seat, vy = √(2·40·độ rơi)) — hoặc của Tiếng Vọng (echo = true, bỏ kiểm vị trí).
 * Kiểm: đứng trên bệ đáp (≤ 1,2 m), đã ở cao trong cột gió ≤ 3 s trước, vy ≤ √(2·40·FALL_MAX) + 1, nghỉ 600 ms.
 * Trả về "ok" (vào nhóm), "late" (trễ — phí), "" (sai luật / rác).
 */
export function cClaim(c: Cat, seat: number, vy: number, pos: [number, number, number] | null, now: number, echo = false): "ok" | "late" | "" {
  if (!Number.isInteger(seat) || seat < 0 || seat >= c.up.length) return "";
  if (typeof vy !== "number" || !Number.isFinite(vy)) return "";
  const v = Math.abs(vy);
  if (v > VY_MAX + 1 || v < 1) return "";
  if (!echo) {
    if (!pos || !onPad(pos[0], pos[2]) || pos[1] < CAT.y - 0.4) return "";
    if (now - c.up[seat] > UP_MS) return "";
    if (now - c.last[seat] < 600) return "";
  }
  if (c.grp?.imp.some((m) => m.s === seat)) return "";
  c.last[seat] = now;
  c.up[seat] = -1e12;
  if ((c.launch && now >= c.launch.at && now - c.launch.at < LATE_MS) || (c.grp && now - c.grp.t0 > GROUP_MS)) return "late";
  if (!c.grp) c.grp = { t0: now, imp: [] };
  c.grp.imp.push({ s: seat, v: Math.min(v, VY_MAX), at: now });
  return "ok";
}

/** Đóng nhóm (≥ 250 ms sau cú chạm đầu) → tính cú bắn. pos = vị trí mọi ghế (tìm người đứng trên ghế bắn). */
export function cResolve(c: Cat, pos: ([number, number, number] | null)[], now: number): Launch | null {
  const g = c.grp;
  if (!g || now - g.t0 < GROUP_MS) return null;
  c.grp = null;
  const imp = g.imp.filter((m) => m.at - g.t0 <= GROUP_MS);
  if (!imp.length) return null;
  // người được bắn: đứng trên ghế (không phải người vừa rơi), gần tâm ghế nhất; không ai → Quả cân Bổ đề
  let by = -1;
  let bd = Infinity;
  pos.forEach((p, i) => {
    if (!p || imp.some((m) => m.s === i) || !onSeat(p[0], p[1], p[2])) return;
    const d = Math.hypot(p[0] - CAT.seatX, p[2] - CAT.z);
    if (d < bd) {
      bd = d;
      by = i;
    }
  });
  const n = imp.length;
  const v1 = imp.reduce((s, m) => s + m.v, 0) / n;
  const { d1, d2 } = catArms(c.sock);
  const v = catapultV(n, v1, d1, d2, 1);
  const h = launchH(v);
  const a = c.sw[0];
  if (h >= SW_H[0] - SW_TOL) c.sw[0] = true;
  // chuông B bị niêm cho tới khi A đã kêu (từ cú TRƯỚC)
  if (a && h >= SW_H[1] - SW_TOL) c.sw[1] = true;
  const L: Launch = { by, v: Math.round(v * 100) / 100, h: Math.round(h * 100) / 100, n, h1: Math.round(((v1 * v1) / (2 * G_PLUNGE)) * 100) / 100, sock: c.sock, at: now };
  c.launch = L;
  c.best = Math.max(c.best, L.h);
  c.tries++;
  return L;
}

/** Dời điểm tựa (đứng ở cần gạt; không đổi giữa lúc đang có nhóm chạm) */
export function cSocket(c: Cat, i: number, px: number, pz: number): boolean {
  if (!Number.isInteger(i) || i < 0 || i >= SOCKETS.length || i === c.sock || c.grp) return false;
  if (Math.hypot(px - LEVER.x, pz - LEVER.z) > LEVER.r) return false;
  c.sock = i;
  return true;
}
