/**
 * Hầm Bổ đề (The Lemma Vaults) — một lượt chơi: ghế, pha, khoá N, ping, nói nhanh, đếm ngược chung, gợi ý 3 bậc,
 * bạn đồng hành "Tiếng Vọng" (chỉ làm theo ping, KHÔNG biết lời giải). Logic thuần, tất định theo (now, vị trí):
 *  - chơi một mình: client chạy trực tiếp (components/world/vault/vaultClient.ts);
 *  - tổ đội: realtime/vault.mjs (sinh từ các file này bằng scripts/gen-realtime.mjs) là trọng tài.
 * Thiết kế: docs/ai-reviews/game-3d/COOP_PUZZLE.md (§4 giao tiếp, §5 tổ đội, §6 gợi ý, §8 các phòng, §10 mạng).
 */
import { clamp, type V3 } from "./geom";
import { K_STAGES, LOOK_Y, bridgeGeos, deckY, graphById, kBlocked, kClear, kGround, kInit, kProgress, kRewind, kStep, kStuck, locate, type KState } from "./konigsberg";
import { BEAM, B_STAGES, CAT, COURT, ECHO_PLUNGE_MS, LEVER, STONE_Z, armOf, bBlocked, bClear, bGround, bInit, bProgress, bPush, bTick, beamY, cClaim, cResolve, fallV, cSocket, cTrack, onPad, type BState, type Cat } from "./balance";
import { F_STAGES, PODIUM, fBlocked, fClear, fDial, fInit, fProgress, fTick, nudge, pedestal, pedestalAt, type FState } from "./fourier";
import { ENGINE_FLOOR_R, HALL_R, ROPES, eClear, eInit, eProgress, eTick, ropeAt, tBlocked, tClear, tInit, tProgress, tRing, tTick, type EState, type TState } from "./threshold";

export type ChamberId = "threshold" | "konigsberg" | "balance" | "fourier" | "finale";
export const PLAN: ChamberId[] = ["threshold", "konigsberg", "balance", "fourier", "finale"];
export const STAGES: Record<ChamberId, number> = { threshold: 1, konigsberg: K_STAGES, balance: B_STAGES, fourier: F_STAGES, finale: 1 };
export const MAX_SEATS = 4;
/** Ghế: ký hiệu + màu (luôn đi cặp, an toàn cho người mù màu) */
export const GLYPHS = ["●", "▲", "■", "◆"];
export const SEAT_COLORS = ["#ffc94a", "#ff6f9f", "#4fd6ff", "#9be36a"];
/** Tiếng Vọng của ghế i (khoá tên) */
export const ECHOES = ["euler", "noether", "turing", "ada"];
/** Mã tổ đội: 4 ký tự từ bảng chữ không gây nhầm (không O/0, I/1, S/5, B/8, Z/2) */
export const CODE_ABC = "ACDEFHJKMNPRTUVWXY3479";
export const SAY_IDS = ["ready", "on3", "wait", "mine", "yourturn", "undo", "other", "count", "moreless", "balanced", "nice", "thanks", "k.odd", "k.spent", "b.out", "b.in", "f.loud", "f.flip"];
export const PING_KINDS = ["here", "go", "use", "val", "look", "avoid"];
const ECHO_SPEED = 4.2;
const GLIDE_SPEED = 6.5;
const CLEAR_MS = 2800;
const HINT_WINDOW = 5000;
const STUCK_OFFER = 90000;
const GRACE_MS = 120000;

export type Phase = "lobby" | "play" | "clear" | "reveal" | "done";
export interface Seat {
  /** null = ghế Tiếng Vọng (bạn đồng hành) */
  uid: string | null;
  name: string;
  conn: boolean;
  ready: boolean;
  /** vị trí do Tiếng Vọng giữ (ghế bạn đồng hành, hoặc người đang mất kết nối) */
  p: V3;
  yaw: number;
  /** các điểm còn phải đi (y = NaN: bám theo mặt đất) */
  path: V3[];
  /** việc chờ làm: "ring" = kéo dây chuông lúc đếm ngược tới GO */
  task: string;
  leftAt: number;
  /** thống kê khoảnh khắc (chỉ điều tích cực) */
  sc: { br: number; push: number; dial: number; ring: number; ping: number; hold: number };
  lastPing: number;
  lastSay: number;
  lastAsk: number;
}
export interface Ping {
  id: number;
  by: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  /** giá trị (+, −, 0, f = đảo dấu) cho ping ống */
  v?: string;
  /** đích (chỉ số ống / cầu) */
  t?: number;
  until: number;
}
export interface Ev {
  id: number;
  k: string;
  by: number;
  s?: string;
  at: number;
}
export type ChamberState = TState | KState | BState | FState | EState;
export interface Run {
  code: string;
  seed: number;
  solo: boolean;
  phase: Phase;
  at: number;
  ch: number;
  sg: number;
  n: number;
  seats: Seat[];
  st: ChamberState | null;
  hint: { lv: number; ask: number; by: number; best: number; since: number; offer: boolean };
  count: { at: number; by: number; go: boolean };
  pings: Ping[];
  ev: Ev[];
  nid: number;
  reset: number[];
  t0: number;
  hints: number;
}

export const chamberOf = (r: Run): ChamberId => PLAN[clamp(r.ch, 0, PLAN.length - 1)];
export const isComp = (s: Seat) => s.uid === null || !s.conn;

function newSeat(uid: string | null, name: string, conn: boolean): Seat {
  return { uid, name, conn, ready: false, p: [0, 0, 0], yaw: 0, path: [], task: "", leftAt: 0, sc: { br: 0, push: 0, dial: 0, ring: 0, ping: 0, hold: 0 }, lastPing: -1e12, lastSay: -1e12, lastAsk: -1e12 };
}
export function newRun(code: string, seed: number, now: number, solo = false): Run {
  return {
    code,
    seed: seed >>> 0,
    solo,
    phase: "lobby",
    at: now,
    ch: 0,
    sg: 0,
    n: 0,
    seats: [],
    st: null,
    hint: { lv: 0, ask: 0, by: -1, best: 0, since: now, offer: false },
    count: { at: 0, by: -1, go: false },
    pings: [],
    ev: [],
    nid: 1,
    reset: [],
    t0: 0,
    hints: 0,
  };
}
export function validCode(c: unknown): c is string {
  return typeof c === "string" && c.length === 4 && [...c].every((ch) => CODE_ABC.includes(ch));
}
export function makeCode(rand: () => number): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ABC[Math.floor(rand() * CODE_ABC.length) % CODE_ABC.length];
  return s;
}

function push(r: Run, k: string, by: number, s: string | undefined, now: number) {
  r.ev.push({ id: r.nid++, k, by, s, at: now });
  if (r.ev.length > 16) r.ev.splice(0, r.ev.length - 16);
}
const humans = (r: Run) => r.seats.filter((s) => s.uid !== null);
const online = (r: Run) => r.seats.filter((s) => s.uid !== null && s.conn);

// ───────────── Ghế ─────────────

/** Vào ghế: ghế theo uid (kết nối lại giữ ghế cũ); trước khi bắt đầu thì thêm ghế / thay Tiếng Vọng; đã chơi thì chỉ thay Tiếng Vọng hoặc ghế bỏ đi quá 120 s. */
export function seatJoin(r: Run, uid: string, name: string, now: number): number {
  const old = r.seats.findIndex((s) => s.uid === uid);
  if (old >= 0) {
    const s = r.seats[old];
    s.conn = true;
    s.name = name || s.name;
    s.path = [];
    s.task = "";
    push(r, "join", old, undefined, now);
    return old;
  }
  let i = r.seats.findIndex((s) => s.uid === null);
  if (i < 0 && r.phase !== "lobby") i = r.seats.findIndex((s) => s.uid !== null && !s.conn && now - s.leftAt > GRACE_MS);
  if (i < 0 && r.phase === "lobby" && r.seats.length < MAX_SEATS) {
    r.seats.push(newSeat(uid, name, true));
    i = r.seats.length - 1;
  } else if (i >= 0) {
    const keep = r.seats[i];
    r.seats[i] = { ...newSeat(uid, name, true), p: keep.p, yaw: keep.yaw, sc: keep.sc };
  }
  if (i >= 0) push(r, "join", i, undefined, now);
  return i;
}
export function seatLeave(r: Run, uid: string, now: number) {
  const i = r.seats.findIndex((s) => s.uid === uid);
  if (i < 0) return;
  const s = r.seats[i];
  if (r.phase === "lobby") {
    r.seats.splice(i, 1);
    return;
  }
  s.conn = false;
  s.leftAt = now;
  s.ready = false;
  push(r, "left", i, undefined, now);
}

// ───────────── Pha + màn ─────────────

function enterStage(r: Run, now: number) {
  const c = chamberOf(r);
  r.st = c === "threshold" ? tInit(r.n, r.seed) : c === "konigsberg" ? kInit(r.sg, r.n) : c === "balance" ? bInit(r.sg, r.n) : c === "fourier" ? fInit(r.sg, r.n) : eInit(r.n);
  r.phase = "play";
  r.at = now;
  r.hint = { lv: 0, ask: 0, by: -1, best: 0, since: now, offer: false };
  r.count = { at: 0, by: -1, go: false };
  r.pings = [];
  r.reset = [];
  r.seats.forEach((s, i) => {
    s.p = spawnFor(r, i);
    s.path = [];
    s.task = "";
    s.ready = false;
  });
  push(r, "stage", -1, `${r.ch}.${r.sg}`, now);
}

/** Bắt đầu lượt (khoá N = người + Tiếng Vọng, tối thiểu 2) */
export function startRun(r: Run, now: number): boolean {
  if (r.phase !== "lobby") return false;
  while (r.seats.length < 2) r.seats.push(newSeat(null, "@" + ECHOES[r.seats.length], true));
  r.n = clamp(r.seats.length, 2, MAX_SEATS);
  r.ch = 0;
  r.sg = 0;
  r.t0 = now;
  enterStage(r, now);
  return true;
}
export function addEcho(r: Run): boolean {
  if (r.phase !== "lobby" || r.seats.length >= MAX_SEATS) return false;
  r.seats.push(newSeat(null, "@" + ECHOES[r.seats.length], true));
  return true;
}
export function removeEcho(r: Run): boolean {
  if (r.phase !== "lobby") return false;
  for (let i = r.seats.length - 1; i >= 0; i--)
    if (r.seats[i].uid === null) {
      r.seats.splice(i, 1);
      r.seats.forEach((s, j) => s.uid === null && (s.name = "@" + ECHOES[j]));
      return true;
    }
  return false;
}

/** Nhảy thẳng tới phòng / màn (công cụ thử khi phát triển; server KHÔNG gọi) */
export function jumpTo(r: Run, ch: number, sg: number, now: number) {
  if (r.phase === "lobby") startRun(r, now);
  r.ch = clamp(ch, 0, PLAN.length - 1);
  r.sg = clamp(sg, 0, STAGES[PLAN[r.ch]] - 1);
  enterStage(r, now);
}

/** Điểm xuất hiện của ghế i ở màn hiện tại (client dịch chuyển tới đây khi đổi màn) */
export function spawnFor(r: Run, i: number): V3 {
  const c = chamberOf(r);
  const n = Math.max(2, r.n || r.seats.length);
  const a = (i / n) * Math.PI * 2;
  if (c === "konigsberg" && r.st) {
    const g = graphById((r.st as KState).g);
    return [g.look.x + Math.cos(a) * 1.6, LOOK_Y, g.look.z + Math.sin(a) * 1.6];
  }
  if (c === "balance" && r.sg === 2) return [-4.2 + (i % 2) * 1.4, BEAM.y, -6.9 - Math.floor(i / 2) * 1.3];
  if (c === "balance") return [-11.5 + (i % 2) * 1.4, BEAM.y, -1 + Math.floor(i / 2) * 1.6];
  if (c === "fourier") return [(i - (n - 1) / 2) * 1.5, 0, 10.2];
  if (c === "finale") return [(i - (n - 1) / 2) * 1.5, 0, 9];
  return [(i - (n - 1) / 2) * 1.4, 0, 4.6];
}

// ───────────── Mặt đất / va chạm theo phòng (client: Player; server: Tiếng Vọng) ─────────────

export function groundFor(r: Run, x: number, z: number, y = 0): number {
  const c = chamberOf(r);
  if (!r.st) return 0;
  if (c === "konigsberg") return kGround(graphById((r.st as KState).g), x, z, y);
  if (c === "balance") return bGround((r.st as BState).th, x, z, (r.st as BState).sg);
  return 0;
}
export function blockedFor(r: Run, x: number, z: number, y: number): boolean {
  const c = chamberOf(r);
  if (!r.st || r.phase === "lobby") return tBlocked(x, z);
  if (c === "konigsberg") {
    const st = r.st as KState;
    return kBlocked(graphById(st.g), st.lit, x, z, y);
  }
  if (c === "balance") return bBlocked((r.st as BState).th, x, z, y, (r.st as BState).sg);
  if (c === "fourier") return fBlocked(x, z);
  if (c === "finale") return Math.hypot(x, z) > ENGINE_FLOOR_R - 0.4 || Math.hypot(x, z) < 2.2;
  return tBlocked(x, z);
}

function progressOf(r: Run): number {
  const c = chamberOf(r);
  if (!r.st) return 0;
  if (c === "threshold") return tProgress(r.st as TState);
  if (c === "konigsberg") return kProgress(r.st as KState);
  if (c === "balance") return bProgress(r.st as BState);
  if (c === "fourier") return fProgress(r.st as FState);
  return eProgress(r.st as EState);
}
function clearOf(r: Run): boolean {
  const c = chamberOf(r);
  if (!r.st) return false;
  if (c === "threshold") return tClear(r.st as TState);
  if (c === "konigsberg") return kClear(r.st as KState);
  if (c === "balance") return bClear(r.st as BState);
  if (c === "fourier") return fClear(r.st as FState);
  return eClear(r.st as EState);
}

// ───────────── Tiếng Vọng ─────────────

function moveEcho(r: Run, s: Seat, dt: number) {
  let budget = dt;
  while (budget > 1e-4 && s.path.length) {
    const w = s.path[0];
    const dx = w[0] - s.p[0];
    const dz = w[2] - s.p[2];
    const fy = Number.isFinite(w[1]);
    // điểm có độ cao cho trước (lượn / hạ xuống): đo khoảng cách 3 chiều
    const d = fy ? Math.hypot(dx, dz, w[1] - s.p[1]) : Math.hypot(dx, dz);
    const glide = fy && Math.abs(w[1] - s.p[1]) > 1.5;
    const sp = glide ? GLIDE_SPEED : ECHO_SPEED;
    const step = sp * budget;
    if (Math.hypot(dx, dz) > 1e-3) s.yaw = Math.atan2(dx, dz);
    if (d <= step) {
      s.p = [w[0], Number.isFinite(w[1]) ? w[1] : groundFor(r, w[0], w[2], s.p[1] + 0.6), w[2]];
      s.path.shift();
      budget -= d / sp;
    } else {
      const f = step / d;
      const ny = Number.isFinite(w[1]) ? s.p[1] + (w[1] - s.p[1]) * f : groundFor(r, s.p[0] + dx * f, s.p[2] + dz * f, s.p[1] + 0.6);
      s.p = [s.p[0] + dx * f, ny, s.p[2] + dz * f];
      budget = 0;
    }
  }
  // (Tiếng Vọng đang lơ lửng trên đỉnh cột gió chờ GO thì không dính đất)
  if (!s.path.length && chamberOf(r) === "balance" && s.task !== "plunge") s.p[1] = groundFor(r, s.p[0], s.p[2], s.p[1] + 0.6);
  s.p = [Math.round(s.p[0] * 100) / 100, Math.round(s.p[1] * 100) / 100, Math.round(s.p[2] * 100) / 100];
}

/** Đường vòng qua giếng giữa (phòng Hợp xướng) / bệ trung tâm (Cỗ máy) */
function around(from: V3, x: number, z: number, rMin: number): V3[] {
  const out: V3[] = [];
  const ax = from[0];
  const az = from[2];
  const dx = x - ax;
  const dz = z - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(-(ax * dx + az * dz) / l2, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  if (Math.hypot(cx, cz) < rMin) {
    const a0 = Math.atan2(az, ax);
    const a1 = Math.atan2(z, x);
    let da = a1 - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const rr = rMin + 1.4;
    for (const f of [0.33, 0.66]) out.push([Math.cos(a0 + da * f) * rr, NaN, Math.sin(a0 + da * f) * rr]);
  }
  out.push([x, NaN, z]);
  return out;
}

/** Tiếng Vọng làm theo ping. Trả về khoá câu thoại (để hiện bong bóng) */
function obey(r: Run, i: number, pg: Ping, now: number): string {
  const s = r.seats[i];
  const c = chamberOf(r);
  if (c === "konigsberg" && r.st) {
    const st = r.st as KState;
    const g = graphById(st.g);
    const tr = st.tr[i];
    const here = locate(g, s.p[0], s.p[1], s.p[2]);
    const tgt = locate(g, pg.x, Math.min(pg.y, 0.5), pg.z);
    // trên đài: lượn xuống đảo được chỉ
    if (here.k === "look" || here.k === "air" || tr.a < 0) {
      if (tgt.k !== "island") return "e.island";
      const I = g.islands[tgt.i];
      const dx = I.x - g.look.x;
      const dz = I.z - g.look.z;
      const L = Math.hypot(dx, dz) || 1;
      // lượn CAO tới trên đảo rồi mới hạ xuống (không lướt thấp qua cầu khác → không tính nhầm là đã đi qua)
      const tx = I.x - (dx / L) * I.r * 0.4;
      const tz = I.z - (dz / L) * I.r * 0.4;
      s.path = [
        [g.look.x + (dx / L) * 3.4, s.p[1], g.look.z + (dz / L) * 3.4],
        [tx, 3.4, tz],
        [tx, 0, tz],
      ];
      return "e.glide";
    }
    const at = tr.a;
    let e = -1;
    if (tgt.k === "bridge") e = tgt.e;
    else if (tgt.k === "island" && tgt.i !== at) e = g.bridges.findIndex((b, k) => st.lit[k] < 0 && ((b.a === at && b.b === tgt.i) || (b.b === at && b.a === tgt.i)));
    else return "e.where";
    if (e < 0) return "e.nobridge";
    const b = g.bridges[e];
    if (b.a !== at && b.b !== at) return "e.notend";
    if (st.lit[e] >= 0) return "e.spent";
    const geo = bridgeGeos(g)[e];
    const fwd = b.a === at;
    const pts: V3[] = [];
    const I = g.islands[at];
    pts.push([I.x + (geo.pts[fwd ? 2 : geo.pts.length - 4] - I.x) * 0.5, 0, I.z + (geo.pts[fwd ? 3 : geo.pts.length - 3] - I.z) * 0.5]);
    for (let k = 1; k < geo.pts.length / 2 - 1; k++) {
      const j = fwd ? k : geo.pts.length / 2 - 1 - k;
      const t = j / (geo.pts.length / 2 - 1);
      pts.push([geo.pts[j * 2], deckY(geo, t), geo.pts[j * 2 + 1]]);
    }
    const J = g.islands[fwd ? b.b : b.a];
    pts.push([J.x, 0, J.z]);
    s.path = pts;
    return "e.cross";
  }
  if (c === "balance" && r.st && (r.st as BState).cat) return obeyCat(r, i, pg);
  if (c === "balance" && r.st) {
    const st = r.st as BState;
    if (st.mov && Math.hypot(pg.x - st.sx, pg.z - STONE_Z) < 1.6) {
      // đẩy đá: đứng bên phải đá rồi đẩy về trái một khắc mỗi lần được ping
      const want: V3 = [Math.min(BEAM.half - 0.3, st.sx + 0.9), NaN, -0.5];
      if (Math.hypot(s.p[0] - want[0], s.p[2] - want[2]) < 0.6) {
        if (bPush(st, s.p[0], s.p[2], now)) s.sc.push++;
        return "e.push";
      }
      s.path = [want];
      return "e.tostone";
    }
    const arm = armOf(0, pg.x, beamY(0, pg.x), pg.z);
    if (arm !== null) {
      s.path = [[arm, NaN, 0]];
      return "e.notch";
    }
    s.path = [[clamp(pg.x, -14, 14), NaN, clamp(pg.z, -2.5, 2.5)]];
    return "e.ok";
  }
  if (c === "fourier" && r.st) {
    const st = r.st as FState;
    if (pg.kind === "val" && typeof pg.t === "number") {
      const p = pedestal(st, pg.t);
      if (pedestalAt(st, s.p[0], s.p[2]) !== pg.t) {
        s.path = around(s.p, p.x, p.z, 3.4);
        return "e.topipe";
      }
      const v = st.amp[pg.t];
      st.amp[pg.t] = pg.v === "+" ? nudge(v, 1) : pg.v === "-" ? nudge(v, -1) : pg.v === "0" ? 0 : -v;
      s.sc.dial++;
      return "e.turn";
    }
    const pi = pedestalAt(st, pg.x, pg.z);
    if (pi >= 0) {
      const p = pedestal(st, pi);
      s.path = around(s.p, p.x, p.z, 3.4);
      return "e.topipe";
    }
    if (Math.hypot(pg.x - PODIUM.x, pg.z - PODIUM.z) < 1.6) {
      s.path = around(s.p, PODIUM.x, PODIUM.z, 3.4);
      return "e.podium";
    }
    s.path = around(s.p, pg.x, pg.z, 3.4);
    return "e.ok";
  }
  if (c === "threshold" && r.st) {
    const ri = ropeAt(pg.x, pg.z);
    if (ri >= 0) {
      s.path = [[ROPES[ri][0] * 0.9, NaN, ROPES[ri][1] + 0.6]];
      s.task = "ring";
      return "e.rope";
    }
    s.task = "";
    s.path = [[clamp(pg.x, -HALL_R + 1, HALL_R - 1), NaN, clamp(pg.z, -HALL_R + 1, HALL_R - 1)]];
    return "e.ok";
  }
  s.path = around(s.p, pg.x, pg.z, 2.4);
  return "e.ok";
}

/** Máy bắn đá: ping cần gạt = dời điểm tựa; ping bệ đáp / tháp = lên đỉnh cột gió chờ GO; ping ghế = ngồi ghế bắn */
function obeyCat(r: Run, i: number, pg: Ping): string {
  const s = r.seats[i];
  const cat = (r.st as BState).cat as Cat;
  if (Math.hypot(pg.x - LEVER.x, pg.z - LEVER.z) < 1.6) {
    s.task = "";
    if (Math.hypot(s.p[0] - LEVER.x, s.p[2] - LEVER.z) < LEVER.r - 0.3 && cSocket(cat, (cat.sock + 1) % 3, s.p[0], s.p[2])) {
      s.sc.push++;
      return "e.socket";
    }
    s.path = [[LEVER.x, NaN, LEVER.z + 0.8]];
    return "e.tolever";
  }
  if (Math.hypot(pg.x - CAT.padX, pg.z - CAT.z) < 1.8 || Math.hypot(pg.x - (CAT.padX - 2.4), pg.z - CAT.z) < 1.4) {
    // hai Tiếng Vọng cùng chờ: đứng lệch nhau trên bệ
    const k = r.seats.filter((o, j) => j !== i && o.task === "plunge").length;
    const z = CAT.z + (k % 2 ? 0.45 : -0.45);
    s.task = "plunge";
    s.path = [
      [CAT.padX, NaN, z],
      [CAT.padX, CAT.top, z],
    ];
    return "e.tower";
  }
  s.task = "";
  if (Math.hypot(pg.x - CAT.seatX, pg.z - CAT.z) < 1.5) {
    s.path = [[CAT.seatX, NaN, CAT.z]];
    return "e.seat";
  }
  s.path = [[clamp(pg.x, COURT.x0 + 0.5, COURT.x1 - 0.5), NaN, clamp(pg.z, COURT.z0 + 0.5, COURT.z1 - 0.5)]];
  return "e.ok";
}

/** Đóng nhóm cú chạm nếu đủ 250 ms → cú bắn (sự kiện + Tiếng Vọng được bắn bay lên rồi rơi về ghế) */
function catFlush(r: Run, cat: Cat, now: number) {
  const L = cResolve(
    cat,
    r.seats.map((s) => s.p),
    now,
  );
  if (!L) return;
  push(r, "launch", L.by, `${L.v}|${L.h}|${L.n}`, now);
  const s = L.by >= 0 ? r.seats[L.by] : null;
  if (s && isComp(s)) {
    s.task = "";
    s.path = [
      [s.p[0], CAT.y + L.h, s.p[2]],
      [s.p[0], CAT.y, s.p[2]],
    ];
  }
}
/** Một cú chạm bệ (người: từ động từ "plunge"; Tiếng Vọng: lúc tới hẹn) */
function catImpact(r: Run, cat: Cat, seat: number, vy: number, pos: V3 | null, now: number, echo: boolean): boolean {
  const res = cClaim(cat, seat, vy, pos, now, echo);
  if (!res) return false;
  push(r, res === "late" ? "late" : "plunge", seat, String(Math.round(Math.abs(vy) * 10) / 10), now);
  return true;
}

// ───────────── Hành động (client gửi động từ; server / bộ chạy local quyết) ─────────────

export interface Act {
  k: string;
  [key: string]: unknown;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/** Thực hiện động từ của ghế `seat` (pos = vị trí server biết của người gửi). true = trạng thái đổi. */
export function actRun(r: Run, seat: number, a: Act, now: number, pos: V3 | null): boolean {
  const s = r.seats[seat];
  if (!s || !a || typeof a.k !== "string") return false;
  const c = chamberOf(r);
  switch (a.k) {
    case "start":
      if (r.phase !== "lobby") return false;
      if (online(r).length <= 1 || online(r).every((h) => h.ready || h === s)) return startRun(r, now);
      return false;
    case "ready":
      if (r.phase !== "lobby" && r.phase !== "reveal") return false;
      s.ready = a.on !== false;
      if (r.phase === "reveal" && online(r).every((h) => h.ready)) nextChamber(r, now);
      else if (r.phase === "lobby" && online(r).length > 1 && online(r).every((h) => h.ready)) startRun(r, now);
      return true;
    case "fill":
      return addEcho(r);
    case "unfill":
      return removeEcho(r);
    case "ping": {
      if (r.phase !== "play" && r.phase !== "lobby") return false;
      const kind = String(a.kind);
      const x = num(a.x);
      const y = num(a.y);
      const z = num(a.z);
      if (!PING_KINDS.includes(kind) || ![x, y, z].every(Number.isFinite)) return false;
      if (now - s.lastPing < 500) return false;
      if (pos && Math.hypot(pos[0] - x, pos[2] - z) > 60) return false;
      const mine = r.pings.filter((p) => p.by === seat);
      if (mine.length >= 3) r.pings.splice(r.pings.indexOf(mine[0]), 1);
      const pg: Ping = { id: r.nid++, by: seat, kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, until: now + 4000 };
      if (typeof a.v === "string" && ["+", "-", "0", "f"].includes(a.v)) pg.v = a.v;
      const t = num(a.t);
      if (Number.isInteger(t) && t >= 0 && t < 64) pg.t = t;
      r.pings.push(pg);
      s.lastPing = now;
      s.sc.ping++;
      // Tiếng Vọng: ghế được chọn (to) hoặc Tiếng Vọng gần điểm ping nhất
      if (r.phase === "play") {
        const to = num(a.to);
        let e = Number.isInteger(to) && r.seats[to] && isComp(r.seats[to]) ? to : -1;
        if (e < 0) {
          let bd = Infinity;
          r.seats.forEach((o, j) => {
            if (j === seat || !isComp(o)) return;
            const d = Math.hypot(o.p[0] - x, o.p[2] - z);
            if (d < bd) {
              bd = d;
              e = j;
            }
          });
        }
        if (e >= 0) push(r, "echo", e, obey(r, e, pg, now), now);
      }
      return true;
    }
    case "say": {
      const id = String(a.id);
      if (!SAY_IDS.includes(id) || now - s.lastSay < 1000) return false;
      s.lastSay = now;
      push(r, "say", seat, id, now);
      if (id === "on3") startCount(r, seat, now);
      return true;
    }
    case "count":
      return startCount(r, seat, now);
    case "hint": {
      if (r.phase !== "play" || r.hint.lv >= 3 || r.hint.ask || now - s.lastAsk < 2000) return false;
      s.lastAsk = now;
      if (online(r).length <= 1) bumpHint(r, seat, now);
      else {
        r.hint.ask = now;
        r.hint.by = seat;
      }
      return true;
    }
    case "notyet":
      if (!r.hint.ask) return false;
      r.hint.ask = 0;
      push(r, "notyet", seat, undefined, now);
      return true;
    case "reset": {
      if (r.phase !== "play") return false;
      r.reset[seat] = now;
      const votes = r.seats.filter((o, j) => o.uid !== null && o.conn && now - (r.reset[j] || 0) < 5000).length;
      if (votes * 2 > online(r).length || online(r).length <= 1) {
        enterStage(r, now);
        push(r, "reset", seat, undefined, now);
      }
      return true;
    }
  }
  // ── động từ của từng phòng ──
  if (r.phase !== "play" || !r.st || !pos) return false;
  if (c === "konigsberg" && a.k === "rewind") {
    kRewind(r.st as KState, seat);
    push(r, "tp", seat, "look", now);
    return true;
  }
  if (c === "balance" && (a.k === "plunge" || a.k === "socket")) {
    const cat = (r.st as BState).cat;
    if (!cat) return false;
    if (a.k === "socket") {
      const i = num(a.i);
      const ok = cSocket(cat, Number.isInteger(i) ? i : (cat.sock + 1) % 3, pos[0], pos[2]);
      if (ok) s.sc.push++;
      return ok;
    }
    return catImpact(r, cat, seat, num(a.vy), pos, now, false);
  }
  if (c === "balance" && a.k === "push") {
    const ok = bPush(r.st as BState, pos[0], pos[2], now);
    if (ok) s.sc.push++;
    return ok;
  }
  if (c === "fourier" && a.k === "dial") {
    const ok = fDial(r.st as FState, num(a.i), num(a.v), pos[0], pos[2]);
    if (ok) s.sc.dial++;
    return ok;
  }
  if (c === "threshold" && a.k === "ring") {
    const i = ropeAt(pos[0], pos[2]);
    const ok = i >= 0 && tRing(r.st as TState, i, pos[0], pos[2], now);
    if (ok) {
      s.sc.ring++;
      push(r, "ring", seat, String(i), now);
    }
    return ok;
  }
  return false;
}

function startCount(r: Run, seat: number, now: number): boolean {
  if (r.count.at && now < r.count.at + 1200) return false;
  r.count = { at: now + 3000, by: seat, go: false };
  push(r, "count", seat, undefined, now);
  return true;
}
function bumpHint(r: Run, seat: number, now: number) {
  r.hint.lv = Math.min(3, r.hint.lv + 1);
  r.hint.ask = 0;
  r.hint.by = seat;
  r.hints++;
  push(r, "hint", seat, String(r.hint.lv), now);
}
function nextChamber(r: Run, now: number) {
  r.ch++;
  r.sg = 0;
  if (r.ch >= PLAN.length) {
    r.phase = "done";
    r.at = now;
    return;
  }
  enterStage(r, now);
}

// ───────────── Nhịp 10 Hz ─────────────

/** ext[i] = vị trí do client của ghế i gửi (null nếu không có / mất kết nối) */
export function tickRun(r: Run, ext: (V3 | null)[], now: number, dt: number) {
  dt = clamp(dt, 0, 0.25);
  const pos: (V3 | null)[] = r.seats.map((s, i) => {
    if (!isComp(s)) {
      const p = ext[i];
      if (p) s.p = [p[0], p[1], p[2]];
      return p ?? null;
    }
    if (r.phase === "play") moveEcho(r, s, dt);
    return s.p;
  });
  r.pings = r.pings.filter((p) => p.until > now);
  // hết hạn chờ "Chưa cần" → gợi ý bậc kế
  if (r.hint.ask && now - r.hint.ask >= HINT_WINDOW) bumpHint(r, r.hint.by, now);
  if (r.phase === "lobby" || r.phase === "reveal" || r.phase === "done" || !r.st) return;
  if (r.phase === "clear") {
    if (now - r.at >= CLEAR_MS) {
      const c = chamberOf(r);
      if (r.sg + 1 < STAGES[c]) {
        r.sg++;
        enterStage(r, now);
      } else if (c === "threshold") nextChamber(r, now);
      else if (c === "finale") {
        r.phase = "done";
        r.at = now;
        push(r, "done", -1, undefined, now);
      } else {
        r.phase = "reveal";
        r.at = now;
        r.seats.forEach((s) => (s.ready = false));
        if (online(r).length === 0) nextChamber(r, now);
      }
    }
    return;
  }
  const c = chamberOf(r);
  // đếm ngược tới GO: Tiếng Vọng đang được giao kéo dây thì kéo đúng lúc
  if (r.count.at && !r.count.go && now >= r.count.at) {
    r.count.go = true;
    r.seats.forEach((s, i) => {
      if (!isComp(s) || s.task !== "ring" || c !== "threshold") return;
      const ri = ropeAt(s.p[0], s.p[2]);
      if (ri >= 0 && tRing(r.st as TState, ri, s.p[0], s.p[2], now)) {
        s.sc.ring++;
        push(r, "ring", i, String(ri), now);
      }
    });
    // máy bắn đá: Tiếng Vọng đang chờ trên đỉnh cột gió bổ nhào theo GO
    const cat = c === "balance" ? (r.st as BState).cat : null;
    if (cat)
      r.seats.forEach((s, i) => {
        if (isComp(s) && s.task === "plunge" && !s.path.length && onPad(s.p[0], s.p[2]) && s.p[1] > CAT.top - 1.5) cat.ep.push({ s: i, at: r.count.at + ECHO_PLUNGE_MS });
      });
  }
  if (c === "threshold") tTick(r.st as TState, pos, dt);
  else if (c === "konigsberg") {
    const st = r.st as KState;
    pos.forEach((p, i) => {
      if (!p) return;
      const e = kStep(st, i, p[0], p[1], p[2]);
      if (e >= 0) {
        r.seats[i].sc.br++;
        push(r, "lit", i, String(e), now);
      }
    });
  } else if (c === "balance") {
    const st = r.st as BState;
    bTick(st, pos, dt);
    const cat = st.cat;
    if (cat) {
      cTrack(cat, pos, now);
      // Tiếng Vọng tới hẹn: rơi xuống bệ (chạm lúc đã hẹn) rồi lại bay lên đỉnh chờ lượt sau
      for (const e of cat.ep.filter((q) => q.at <= now)) {
        const s = r.seats[e.s];
        if (!s || !isComp(s) || s.task !== "plunge") continue;
        const fall = s.p[1] - CAT.y;
        s.p = [s.p[0], CAT.y, s.p[2]];
        catImpact(r, cat, e.s, fallV(fall), null, e.at, true);
        s.path = [[s.p[0], CAT.top, s.p[2]]];
      }
      cat.ep = cat.ep.filter((q) => q.at > now);
      catFlush(r, cat, now);
    }
  }
  else if (c === "fourier") fTick(r.st as FState, pos, dt);
  else eTick(r.st as EState, pos, dt);
  // gợi ý: theo dõi tiến độ để biết đội đang kẹt bao lâu
  const p = progressOf(r);
  if (p > r.hint.best + 1e-6) {
    r.hint.best = p;
    r.hint.since = now;
  }
  const attempts = c === "konigsberg" ? (r.st as KState).rew : 0;
  r.hint.offer = r.hint.lv === 0 && (now - r.hint.since > STUCK_OFFER || attempts >= 3);
  if (clearOf(r)) {
    r.phase = "clear";
    r.at = now;
    if (c === "balance" || c === "finale") pos.forEach((q, i) => q && r.seats[i].sc.hold++);
    push(r, "clear", -1, `${r.ch}.${r.sg}`, now);
  }
}

/** Ghế đang thắt nút (Königsberg) — để hiện nút thắt + gợi ý tua lại */
export function stuckSeats(r: Run): number[] {
  if (chamberOf(r) !== "konigsberg" || !r.st) return [];
  return r.seats.map((_, i) => i).filter((i) => kStuck(r.st as KState, i));
}

/** Bản gửi qua mạng: bỏ uid (không lộ định danh), làm tròn số */
export function packRun(r: Run): unknown {
  return {
    ...r,
    // vị trí người đang kết nối đã có trong ảnh chụp p → bỏ ở đây (trạng thái không đổi mỗi khi ai đó bước đi)
    seats: r.seats.map((s) => ({ h: s.uid !== null, name: s.name, conn: s.conn, ready: s.ready, p: s.uid !== null && s.conn ? null : s.p, yaw: Math.round(s.yaw * 100) / 100, task: s.task, sc: s.sc, busy: s.path.length > 0 })),
    st: r.st && chamberOf(r) === "balance" ? { ...(r.st as BState), th: Math.round((r.st as BState).th * 10000) / 10000, tau: Math.round((r.st as BState).tau * 100) / 100 } : r.st,
  };
}
