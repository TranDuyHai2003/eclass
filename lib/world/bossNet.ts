/**
 * Đồng bộ nhiều người cho boss / sự kiện Vùng Kỳ quan — MÃ HOÁ / GIẢI MÃ trạng thái (thuần, test ở tests/world/bossNet.test.ts).
 *
 * Chủ trận đóng gói trạng thái có thẩm quyền 8 lần / giây; khách áp vào mô phỏng cục bộ (KHÔNG tự quyết AI) rồi vẽ y như
 * chủ: cùng đòn, cùng hình báo trước, cùng cọc / lượt rút / đợt bướm. Mọi mốc thời gian đổi sang ĐỒNG HỒ SERVER khi gói và đổi
 * về đồng hồ máy khi mở: t_server = t_máy + shift, shift = (Date.now() + lệch server) − performance.now().
 * Sát thương lên người chơi mỗi máy tự tính theo vị trí mình từ trạng thái đã đồng bộ (cờ "đã trúng" của từng đòn giữ cục bộ).
 */
import { foldLine, lineThrough, makeRoute, reflect, type FoldKind, type Surveyor, type SvAtk } from "./foldbackSurveyor";
import type { Ledger } from "./rainLedger";
import type { LanternEvent, LnState } from "./lanternNight";

/** Độ lệch đổi đồng hồ máy (performance.now) → đồng hồ server (ms) */
export function clockShift(perfNow: number, dateNow: number, serverOffset: number): number {
  return dateNow + serverOffset - perfNow;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** mốc thời gian: 0 / âm vô cùng giữ nguyên nghĩa "chưa có" */
const tOut = (t: number, sh: number) => (t > 0 ? Math.round(t + sh) : t);
const tIn = (t: number, sh: number) => (t > 0 ? t - sh : t);

// ───────────── Kẻ Khảo sát Gấp ─────────────

export interface SvPack {
  hp: number;
  mx: number;
  ph: 1 | 2 | 3;
  md: Surveyor["mode"];
  ma: number;
  sd: number;
  da: number;
  n: number;
  a: null | { k: SvAtk["kind"]; p: number[] | null; f: number[] | null; b: number[] | null; e: 0 | 1; t0: number; te: number; du: number; rc: number };
  s: null | { lk: FoldKind; k: number; st: number[]; pn: number; h: number[]; g: 0 | 1; t0: number; tr: number };
}

/** sh = clockShift của máy chủ */
export function packSurveyor(s: Surveyor, sh: number): SvPack {
  const a = s.atk;
  const seal = s.seal;
  return {
    hp: s.hp,
    mx: s.maxHp,
    ph: s.phase,
    md: s.mode,
    ma: tOut(s.modeAt, sh),
    sd: s.sealsDone,
    da: tOut(s.deadAt, sh),
    n: s.n,
    a: a
      ? {
          k: a.kind,
          p: a.route ? a.route.pts.map(r2) : null,
          f: a.fold ? [r4(a.fold.a), r4(a.fold.b), r4(a.fold.c)] : null,
          b: a.bars ? [a.bars.ou, a.bars.ov, a.bars.du, a.bars.dv, a.bars.nu, a.bars.nv, a.bars.off[0], a.bars.off[1]].map(r4) : null,
          e: a.echo ? 1 : 0,
          t0: tOut(a.t0, sh),
          te: a.tele,
          du: Math.round(a.dur),
          rc: a.rec,
        }
      : null,
    s: seal
      ? {
          lk: seal.line.kind,
          k: seal.line.k,
          st: seal.stakes.flatMap((p) => [p.u, p.v]),
          pn: seal.pinned.reduce((m, b, i) => m | (b ? 1 << i : 0), 0),
          h: seal.hold.map((x) => Math.round(x)),
          g: seal.ghost ? 1 : 0,
          t0: tOut(seal.t0, sh),
          tr: seal.tries,
        }
      : null,
  };
}

/**
 * Áp gói vào mô phỏng của khách (sh = clockShift của máy khách). Đòn cùng mốc t0 được GIỮ NGUYÊN đối tượng (giữ cờ đã trúng
 * cục bộ — không bị trúng hai lần vì gói tới sau); khiên cùng đường + cọc giữ đối tượng (chỉ cập nhật ghim / giữ).
 */
export function applySurveyor(s: Surveyor, p: SvPack, sh: number) {
  s.hp = p.hp;
  s.maxHp = p.mx;
  s.phase = p.ph;
  s.mode = p.md;
  s.modeAt = tIn(p.ma, sh);
  s.sealsDone = p.sd;
  s.deadAt = tIn(p.da, sh);
  s.n = p.n;
  const pa = p.a;
  if (!pa) s.atk = null;
  else {
    const t0 = tIn(pa.t0, sh);
    if (!s.atk || Math.abs(s.atk.t0 - t0) > 40 || s.atk.kind !== pa.k) {
      const b = pa.b;
      s.atk = {
        kind: pa.k,
        route: pa.p ? makeRoute(pa.p) : null,
        fold: pa.f ? lineThrough(0, 0, 1, 0) : null,
        bars: b ? { ou: b[0], ov: b[1], du: b[2], dv: b[3], nu: b[4], nv: b[5], off: [b[6], b[7]] } : null,
        echo: pa.e === 1,
        t0,
        tele: pa.te,
        dur: pa.du,
        rec: pa.rc,
        hitMain: false,
        hitEcho: false,
      };
      if (s.atk.fold && pa.f) {
        s.atk.fold.a = pa.f[0];
        s.atk.fold.b = pa.f[1];
        s.atk.fold.c = pa.f[2];
      }
    } else s.atk.t0 = t0;
  }
  const ps = p.s;
  if (!ps) s.seal = null;
  else {
    const same = s.seal && s.seal.line.kind === ps.lk && s.seal.line.k === ps.k && s.seal.tries === ps.tr && s.seal.stakes.length * 2 === ps.st.length && s.seal.stakes.every((q, i) => q.u === ps.st[i * 2] && q.v === ps.st[i * 2 + 1]);
    if (!same) {
      const line = foldLine(ps.lk, ps.k);
      const stakes = [];
      for (let i = 0; i + 1 < ps.st.length; i += 2) stakes.push({ u: ps.st[i], v: ps.st[i + 1] });
      s.seal = { line, stakes, images: stakes.map((q) => reflect(line, q.u, q.v)), pinned: stakes.map(() => false), hold: stakes.map(() => 0), ghost: false, t0: 0, tries: ps.tr, wrongAt: -1e9 };
    }
    const seal = s.seal!;
    for (let i = 0; i < seal.stakes.length; i++) {
      seal.pinned[i] = (ps.pn & (1 << i)) !== 0;
      seal.hold[i] = ps.h[i] ?? 0;
    }
    seal.ghost = ps.g === 1;
    seal.t0 = tIn(ps.t0, sh);
  }
}

// ───────────── Sổ Mưa ─────────────

export interface LgPack {
  hp: number;
  mx: number;
  ph: 1 | 2;
  md: Ledger["mode"];
  ma: number;
  w: number[];
  pay: number[];
  rd: number;
  pt: number;
  nd: number;
  c: number[];
  x: number[];
  nd2: number;
  sp: [number, number];
  da: number;
  d: null | { t0: number; k: 1 | 2; ln: number[]; cm: 0 | 1; st: 0 | 1; bt: number[] };
}

export function packLedger(l: Ledger, sh: number): LgPack {
  const d = l.draw;
  return {
    hp: l.hp,
    mx: l.maxHp,
    ph: l.phase,
    md: l.mode,
    ma: tOut(l.modeAt, sh),
    w: l.bag.w,
    pay: l.bag.pay,
    rd: l.round,
    pt: Math.round(l.points * 100) / 100,
    nd: l.need,
    c: l.counts,
    x: l.expect.map((v) => Math.round(v * 100) / 100),
    nd2: l.draws,
    sp: l.spill,
    da: tOut(l.deadAt, sh),
    d: d ? { t0: tOut(d.t0, sh), k: d.k, ln: d.lanes, cm: d.committed ? 1 : 0, st: d.settled ? 1 : 0, bt: d.bets } : null,
  };
}

export function applyLedger(l: Ledger, p: LgPack, sh: number) {
  l.hp = p.hp;
  l.maxHp = p.mx;
  l.phase = p.ph;
  // xả lũ mới: cờ "sóng đã trúng" là cục bộ
  if (p.md === "spill" && l.mode !== "spill") l.spillHit = false;
  l.mode = p.md;
  l.modeAt = tIn(p.ma, sh);
  l.bag = { w: p.w.slice(), pay: p.pay.slice() };
  l.round = p.rd;
  l.points = p.pt;
  l.need = p.nd;
  l.counts = p.c.slice();
  l.expect = p.x.slice();
  l.draws = p.nd2;
  l.spill = [p.sp[0], p.sp[1]];
  l.deadAt = tIn(p.da, sh);
  const pd = p.d;
  if (!pd) l.draw = null;
  else {
    const t0 = tIn(pd.t0, sh);
    if (!l.draw || Math.abs(l.draw.t0 - t0) > 40) l.draw = { t0, k: pd.k, lanes: pd.ln.slice(), bet: -1, bets: [], committed: false, settled: false, hit: pd.ln.map(() => false), gain: 0 };
    const d = l.draw;
    d.t0 = t0;
    d.committed = pd.cm === 1;
    d.settled = pd.st === 1;
    d.bets = pd.bt.slice();
  }
}

// ───────────── Đêm Đèn lồng ─────────────

export interface LnPack {
  st: LnState;
  at: number;
  w: number;
  wa: number;
  ox: number;
  oz: number;
  /** số bướm của đợt + mặt nạ bit bướm còn sống */
  n: number;
  al: number;
  rw: number;
}

export function packLantern(e: LanternEvent, ox: number, oz: number, n: number, alive: number, sh: number): LnPack {
  return { st: e.state, at: tOut(e.at, sh), w: e.wave, wa: tOut(e.waveAt, sh), ox: r2(ox), oz: r2(oz), n, al: alive, rw: e.rewarded };
}

export function applyLantern(e: LanternEvent, p: LnPack, sh: number) {
  e.state = p.st;
  e.at = tIn(p.at, sh);
  e.wave = p.w;
  e.waveAt = tIn(p.wa, sh);
  e.rewarded = p.rw;
}

/** Bố trí bướm i / n (giống hệt ở chủ và khách): góc xuất phát + bán kính bay */
export function mothSlot(i: number, n: number, rMin: number, rMax: number): { th0: number; r: number } {
  return { th0: (i / Math.max(1, n)) * Math.PI * 2, r: rMin + ((i * 0.618) % 1) * (rMax - rMin) };
}

// ───────────── Sự kiện suy ra ở khách (âm thanh, thông báo, phần thưởng riêng từng người) ─────────────

export interface SvSeen {
  mode: string;
  atkT0: number;
  pinned: number;
  tries: number;
}
/** So trạng thái trước / sau một gói → sự kiện như tickSurveyor trả ở máy chủ */
export function surveyorEvent(prev: SvSeen, s: Surveyor): string | null {
  const pinned = s.seal ? s.seal.pinned.filter(Boolean).length : 0;
  const tries = s.seal?.tries ?? 0;
  const atkT0 = s.atk?.t0 ?? 0;
  let ev: string | null = null;
  if (s.mode === "dead" && prev.mode !== "dead") ev = "dead";
  else if (s.mode === "stun" && prev.mode === "seal") ev = "fold";
  else if (s.mode === "seal" && prev.mode !== "seal") ev = "seal";
  else if (s.mode === "seal" && tries > prev.tries) ev = "fail";
  else if (s.mode === "seal" && pinned > prev.pinned) ev = "pin";
  else if (s.atk && Math.abs(atkT0 - prev.atkT0) > 40) ev = "tele";
  prev.mode = s.mode;
  prev.atkT0 = atkT0;
  prev.pinned = pinned;
  prev.tries = tries;
  return ev;
}
