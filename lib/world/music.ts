/**
 * Nhạc nền theo vùng — phần LOGIC THUẦN (không WebAudio, test được): thang âm, chuỗi Markov chọn nốt / hợp âm,
 * động cơ (motif) + biến tấu, cấu trúc câu nhạc có "khoảng thở", dãy số cho Thư viện Babel, phổ Shepard cho Bất Khả,
 * chuỗi hoạ âm cho Hư Không. Phần phát âm ở components/world/audio/*.
 *
 * Nguyên tắc (xem docs/ai-reviews/game-3d/AUDIO.md):
 *  - mật độ thấp, nhiều khoảng lặng; nhạc là nền, không giành chỗ của hiệu ứng;
 *  - không lặp máy móc: động cơ A → A' (biến tấu) → B (trả lời) → A'' rồi nghỉ; sau vài vòng sinh động cơ mới;
 *  - giai điệu đi bậc là chính (Markov ưu tiên bước ±1, ±2), sau bước nhảy thì quay ngược lại ("lấp khoảng trống");
 *  - nốt cuối câu rơi vào âm của hợp âm; hợp âm đổi chậm (mỗi 2 ô nhịp) theo đồ thị Markov chức năng.
 */

export type Rng = () => number;

/** PRNG có hạt giống (mulberry32) — tất định cho test */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chọn theo trọng số (bỏ qua trọng số ≤ 0) */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  let sum = 0;
  for (const [, w] of entries) if (w > 0) sum += w;
  if (sum <= 0) return entries[0][0];
  let r = rng() * sum;
  for (const [v, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

// ───────────── Thang âm ─────────────

export const SCALES = {
  majorPenta: [0, 2, 4, 7, 9],
  minorPenta: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
} as const satisfies Record<string, readonly number[]>;
export type ScaleName = keyof typeof SCALES;

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

/** Bậc (số nguyên, âm / vượt quãng tám được) → midi */
export function degreeToMidi(scale: readonly number[], root: number, deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return root + 12 * oct + scale[i];
}

/** Lớp cao độ (0…11) có thuộc thang không */
export function inScale(scale: readonly number[], root: number, midi: number): boolean {
  const pc = (((midi - root) % 12) + 12) % 12;
  return scale.includes(pc);
}

// ───────────── Hợp âm ─────────────

export type Quality = "maj" | "min" | "sus2" | "sus4" | "aug" | "fifth" | "add9" | "min7";
const QUALITY: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  aug: [0, 4, 8],
  fifth: [0, 7, 12],
  add9: [0, 4, 7, 14],
  min7: [0, 3, 7, 10],
};
export type ChordDef = { semis: number; q: Quality };
/** Các lớp cao độ (so với chủ âm của khoá) của hợp âm */
export function chordPcs(c: ChordDef): number[] {
  return QUALITY[c.q].map((s) => (((c.semis + s) % 12) + 12) % 12);
}
/** Xếp hợp âm quanh midi `center` (giọng đệm khép, không nhảy xa) */
export function voiceChord(c: ChordDef, root: number, center: number): number[] {
  const base = root + c.semis;
  const k = Math.round((center - base) / 12);
  return QUALITY[c.q].map((s) => base + 12 * k + s);
}

/** Đồ thị Markov hợp âm: tên → [tên kế, trọng số][] */
export type ChordGraph = Record<string, readonly (readonly [string, number])[]>;
export function nextChord(rng: Rng, g: ChordGraph, cur: string): string {
  const edges = g[cur];
  if (!edges || !edges.length) return Object.keys(g)[0];
  return weightedPick(rng, edges);
}

// ───────────── Giai điệu Markov ─────────────

/** Trọng số theo bước (đơn vị: bậc thang) — đi bậc là chính, nhảy xa hiếm */
export const STEP_WEIGHTS: readonly (readonly [number, number])[] = [
  [0, 0.45],
  [1, 3],
  [-1, 3.2],
  [2, 1.6],
  [-2, 1.7],
  [3, 0.55],
  [-3, 0.55],
  [4, 0.3],
  [-4, 0.3],
  [5, 0.12],
  [-5, 0.15],
];

/**
 * Bậc kế tiếp: Markov theo bước + luật "lấp khoảng trống" (sau bước nhảy ≥ 3 bậc → ưu tiên đi ngược chiều, bước nhỏ),
 * không lặp một nốt quá 2 lần, luôn nằm trong [lo, hi].
 */
export function nextDegree(rng: Rng, prev: number, prevStep: number, lo: number, hi: number, repeats = 0): number {
  const leap = Math.abs(prevStep) >= 3;
  const entries: [number, number][] = [];
  for (const [s, w0] of STEP_WEIGHTS) {
    const d = prev + s;
    if (d < lo || d > hi) continue;
    let w = w0;
    if (s === 0 && repeats >= 1) w = 0;
    if (leap) {
      if (Math.sign(s) === -Math.sign(prevStep) && Math.abs(s) <= 2) w *= 3;
      else if (Math.sign(s) === Math.sign(prevStep)) w *= 0.25;
    }
    // kéo nhẹ về giữa tầm (tránh dính trần / sàn)
    const mid = (lo + hi) / 2;
    w *= 1 + 0.12 * Math.sign(mid - prev) * Math.sign(s);
    entries.push([d, w]);
  }
  if (!entries.length) return Math.max(lo, Math.min(hi, prev));
  return weightedPick(rng, entries);
}

// ───────────── Động cơ + biến tấu ─────────────

/** Nốt của động cơ: bậc (so với chủ âm), độ dài (phách), lực (0…1); rest = lặng */
export type MNote = { deg: number; beats: number; vel: number; rest?: boolean };

const RHYTHMS: readonly (readonly number[])[] = [
  [1, 1, 2],
  [1.5, 0.5, 2],
  [2, 1, 1],
  [1, 1, 1, 1],
  [0.5, 0.5, 1, 2],
  [3, 1],
  [1, 2, 1],
  [2, 2],
];

/** Động cơ dài `beats` phách: nhịp từ kho mẫu, cao độ theo Markov, thường kết bằng một nốt dài */
export function makeMotif(rng: Rng, beats: number, lo: number, hi: number, start?: number): MNote[] {
  const out: MNote[] = [];
  let used = 0;
  let deg = start ?? Math.round((lo + hi) / 2 + (rng() - 0.5) * 2);
  let step = 0;
  let reps = 0;
  while (used < beats - 1e-6) {
    const pat = RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
    for (const b0 of pat) {
      if (used >= beats - 1e-6) break;
      const b = Math.min(b0, beats - used);
      const nd = out.length ? nextDegree(rng, deg, step, lo, hi, reps) : deg;
      step = nd - deg;
      reps = step === 0 ? reps + 1 : 0;
      deg = nd;
      // thỉnh thoảng một phách lặng giữa động cơ (thở)
      const rest = out.length > 0 && b <= 1 && rng() < 0.12;
      out.push({ deg, beats: b, vel: 0.55 + rng() * 0.35, rest });
      used += b;
    }
  }
  return out;
}

export type Variation = "repeat" | "transpose" | "invert" | "retro" | "augment" | "ornament" | "thin" | "displace";

const clampDeg = (d: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, d));

/** Biến tấu động cơ (giữ tổng số phách). Kết quả luôn trong [lo, hi]. */
export function vary(rng: Rng, m: MNote[], kind: Variation, lo: number, hi: number): MNote[] {
  const total = m.reduce((s, n) => s + n.beats, 0);
  let out: MNote[];
  switch (kind) {
    case "transpose": {
      const k = weightedPick(rng, [
        [1, 1],
        [-1, 1],
        [2, 0.8],
        [-2, 0.8],
        [3, 0.4],
      ] as const);
      out = m.map((n) => ({ ...n, deg: n.deg + k }));
      break;
    }
    case "invert": {
      const a = m[0].deg;
      out = m.map((n) => ({ ...n, deg: 2 * a - n.deg }));
      break;
    }
    case "retro":
      out = [...m].reverse().map((n) => ({ ...n }));
      break;
    case "augment": {
      // nửa đầu động cơ, giãn gấp đôi
      out = [];
      let b = 0;
      for (const n of m) {
        if (b >= total - 1e-6) break;
        const nb = Math.min(n.beats * 2, total - b);
        out.push({ ...n, beats: nb });
        b += nb;
      }
      break;
    }
    case "ornament": {
      // chia một nốt dài thành nốt + nốt láy (bậc kề)
      out = [];
      let done = false;
      for (const n of m) {
        if (!done && !n.rest && n.beats >= 1) {
          const h = n.beats / 2;
          out.push({ ...n, beats: h }, { ...n, deg: n.deg + (rng() < 0.5 ? 1 : -1), beats: h / 2, vel: n.vel * 0.8 }, { ...n, beats: h / 2, vel: n.vel * 0.9 });
          done = true;
        } else out.push({ ...n });
      }
      break;
    }
    case "thin":
      out = m.map((n, i) => (i > 0 && i < m.length - 1 && rng() < 0.4 ? { ...n, rest: true } : { ...n }));
      break;
    case "displace": {
      // lùi nửa phách: thêm lặng đầu, cắt bớt nốt cuối
      out = [{ deg: m[0].deg, beats: 0.5, vel: 0, rest: true }, ...m.map((n) => ({ ...n }))];
      const last = out[out.length - 1];
      last.beats = Math.max(0.5, last.beats - 0.5);
      break;
    }
    default:
      out = m.map((n) => ({ ...n }));
  }
  // giữ tầm: nếu tràn thì dịch cả câu theo bội số "quãng tám" gần nhất trong bậc, cuối cùng kẹp
  const mx = Math.max(...out.map((n) => n.deg));
  const mn = Math.min(...out.map((n) => n.deg));
  let shift = 0;
  if (mx > hi) shift = hi - mx;
  else if (mn < lo) shift = lo - mn;
  return fitBeats(
    out.map((n) => ({ ...n, deg: clampDeg(n.deg + shift, lo, hi) })),
    total,
  );
}

/** Cắt / đệm lặng để tổng đúng `beats` */
export function fitBeats(m: MNote[], beats: number): MNote[] {
  const out: MNote[] = [];
  let b = 0;
  for (const n of m) {
    if (b >= beats - 1e-6) break;
    const nb = Math.min(n.beats, beats - b);
    if (nb > 1e-6) out.push({ ...n, beats: nb });
    b += nb;
  }
  if (b < beats - 1e-6) out.push({ deg: out.length ? out[out.length - 1].deg : 0, beats: beats - b, vel: 0, rest: true });
  return out;
}

/** Kéo nốt cuối (không lặng) về âm của hợp âm gần nhất trong thang */
export function cadence(m: MNote[], scale: readonly number[], chord: number[] /* pcs so với chủ âm */, lo = -99, hi = 99): MNote[] {
  const out = m.map((n) => ({ ...n }));
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].rest) continue;
    const d = out[i].deg;
    let best = d;
    let bd = 1e9;
    for (let k = -3; k <= 3; k++) {
      if (d + k < lo || d + k > hi) continue;
      const pc = degreeToMidi(scale, 0, d + k) % 12;
      if (chord.includes(((pc % 12) + 12) % 12) && Math.abs(k) < bd) {
        bd = Math.abs(k);
        best = d + k;
      }
    }
    out[i].deg = best;
    break;
  }
  return out;
}

/**
 * Kế hoạch câu: A A' B A'' (một vòng) rồi 1–2 câu nghỉ (giai điệu lặng, chỉ còn nền); thỉnh thoảng một câu "im hẳn"
 * (cả nền cũng tắt, chỉ còn âm thanh môi trường) — khoảng 8–15 s im lặng mỗi 1–2 phút giúp nghe lâu không mệt.
 */
export type PhraseKind = "A" | "A'" | "B" | "A''" | "rest" | "silence";
export function planCycle(rng: Rng, breath: number, silence = 0.35): PhraseKind[] {
  const out: PhraseKind[] = ["A", "A'", "B", "A''"];
  // đôi khi bỏ bớt (câu ngắn hơn) để không thành công thức
  if (rng() < 0.25) out.splice(2, 1);
  const rests = rng() < breath ? (rng() < 0.4 ? 2 : 1) : 0;
  for (let i = 0; i < rests; i++) out.push("rest");
  if (rng() < silence) out.push("silence");
  return out;
}

// ───────────── Dãy số (Thư viện Babel) ─────────────

/** 120 chữ số đầu của π */
export const PI_DIGITS = "314159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745";

export type SeqKind = "pi" | "fib" | "prime" | "collatz" | "recaman";
export const SEQ_LABEL: Record<SeqKind, string> = { pi: "π", fib: "Fibonacci", prime: "số nguyên tố", collatz: "Collatz", recaman: "Recamán" };

/** Phần tử thứ i (i ≥ 0) của dãy, lấy modulo m (để thành bậc thang) */
export function seqValue(kind: SeqKind, i: number, m: number): number {
  switch (kind) {
    case "pi":
      return Number(PI_DIGITS[i % PI_DIGITS.length]) % m;
    case "fib": {
      // chu kỳ Pisano: chỉ cần tính mod m
      let a = 0;
      let b = 1;
      for (let k = 0; k < i; k++) [a, b] = [b, (a + b) % m];
      return a;
    }
    case "prime": {
      let n = 1;
      let c = -1;
      while (c < i) {
        n++;
        let p = true;
        for (let d = 2; d * d <= n; d++)
          if (n % d === 0) {
            p = false;
            break;
          }
        if (p) c++;
      }
      return n % m;
    }
    case "collatz": {
      // quỹ đạo Collatz của 27 (111 bước, lên xuống thất thường)
      let n = 27;
      for (let k = 0; k < i % 112; k++) n = n === 1 ? 4 : n % 2 ? 3 * n + 1 : n / 2;
      return n % m;
    }
    case "recaman": {
      const seen = new Set<number>([0]);
      let a = 0;
      for (let k = 1; k <= i; k++) {
        const b = a - k;
        a = b > 0 && !seen.has(b) ? b : a + k;
        seen.add(a);
      }
      return a % m;
    }
  }
}

// ───────────── Shepard (Bất Khả) ─────────────

/**
 * Hợp âm Shepard: mỗi lớp cao độ pc (0…12, số thực) → các thành phần cách nhau quãng tám, biên độ hình chuông trên trục
 * log-tần số (đỉnh quanh 55·2^3,5 ≈ 620 Hz). Nâng pc dần lên mãi mà phổ không cao lên (như cầu thang Penrose của Escher).
 */
export function shepardPartials(pc: number, baseHz = 55, octaves = 7, sigma = 1.25): { hz: number; amp: number }[] {
  const out: { hz: number; amp: number }[] = [];
  const pos0 = (((pc / 12) % 1) + 1) % 1;
  for (let k = 0; k < octaves; k++) {
    const pos = k + pos0;
    const amp = Math.exp(-Math.pow((pos - octaves / 2) / sigma, 2));
    if (amp < 0.02) continue;
    out.push({ hz: baseHz * Math.pow(2, pos), amp });
  }
  return out;
}

// ───────────── Vòng lặp lệch nhau kiểu Eno ─────────────

/**
 * Các mốc phát của nhiều dòng sự kiện có chu kỳ nguyên tố cùng nhau (23, 29, 37 s…) trong cửa sổ [t0, t1):
 * như các vòng băng dài lệch nhau của Eno ("Music for Airports") — tổ hợp gặp lại sau 23·29·37 ≈ 6,9 giờ.
 * Bỏ một mốc nếu đã có mốc khác cách nó < gap giây (tránh hai điểm nhấn chồng nhau).
 */
export function enoOnsets(t0: number, t1: number, periods: readonly number[] = [23, 29, 37], phases: readonly number[] = [3, 11, 19], gap = 0.3): { t: number; stream: number }[] {
  const out: { t: number; stream: number }[] = [];
  periods.forEach((P, i) => {
    const ph = phases[i] ?? 0;
    let k = Math.ceil((t0 - ph) / P);
    for (let t = ph + k * P; t < t1; k++, t = ph + k * P) if (t >= t0) out.push({ t, stream: i });
  });
  out.sort((a, b) => a.t - b.t);
  const kept: { t: number; stream: number }[] = [];
  for (const o of out) if (!kept.length || o.t - kept[kept.length - 1].t >= gap) kept.push(o);
  return kept;
}

// ───────────── Hồ sơ vùng ─────────────

export type Instrument = "kalimba" | "musicbox" | "marimba" | "harpsichord" | "flute" | "glass" | "bell" | "pluck";
export type PadKind = "warm" | "air" | "organ" | "shepard" | "none";
export type ZoneMode = "melodic" | "sequence" | "harmonics";

export interface ZoneProfile {
  id: string;
  /** midi chủ âm */
  root: number;
  scale: ScaleName;
  bpm: number;
  beatsPerBar: number;
  /** số ô nhịp mỗi câu */
  phraseBars: number;
  /** tầm giai điệu (bậc) */
  lo: number;
  hi: number;
  lead: Instrument;
  pad: PadKind;
  /** midi trung tâm giọng đệm */
  padCenter: number;
  /** xác suất có bass gốc mỗi lần đổi hợp âm */
  bass: number;
  /** tỉ lệ nốt giai điệu được chơi (0…1) — mật độ */
  density: number;
  /** xác suất có câu nghỉ sau mỗi vòng */
  breath: number;
  chords: Record<string, ChordDef>;
  graph: ChordGraph;
  start: string;
  mode: ZoneMode;
  /** điểm nhấn riêng của vùng */
  extras: ("chirp" | "cricket" | "shepardRise" | "drone" | "wind" | "drip")[];
  /** độ sáng (tần số cắt lọc thông thấp của nhạc cụ) Hz */
  bright: number;
  /** lượng vang 0…1 */
  space: number;
  /** âm lượng tương đối vùng (0…1) */
  level: number;
}

const FUNC: ChordGraph = {
  I: [
    ["IV", 3],
    ["vi", 2],
    ["ii", 1],
    ["V", 1],
  ],
  ii: [
    ["V", 3],
    ["IV", 1],
  ],
  IV: [
    ["I", 3],
    ["V", 1.5],
    ["ii", 1],
  ],
  V: [
    ["I", 4],
    ["vi", 2],
  ],
  vi: [
    ["IV", 3],
    ["ii", 1],
    ["V", 1],
  ],
};
const MAJ_CHORDS: Record<string, ChordDef> = { I: { semis: 0, q: "add9" }, ii: { semis: 2, q: "min7" }, IV: { semis: 5, q: "maj" }, V: { semis: 7, q: "sus4" }, vi: { semis: 9, q: "min7" } };
/** Đêm: cùng tập nốt nhưng tâm điệu là giọng thứ song song (vi) — đổi ngày ↔ đêm không vấp */
const MIN_CHORDS: Record<string, ChordDef> = { i: { semis: 0, q: "min7" }, III: { semis: 3, q: "add9" }, iv: { semis: 5, q: "min" }, VI: { semis: 8, q: "maj" }, VII: { semis: 10, q: "sus2" } };
const MIN_GRAPH: ChordGraph = {
  i: [
    ["VI", 3],
    ["iv", 2],
    ["III", 1.5],
  ],
  III: [
    ["VI", 2],
    ["VII", 2],
  ],
  iv: [
    ["i", 3],
    ["VII", 1],
  ],
  VI: [
    ["VII", 2],
    ["i", 2],
    ["iv", 1],
  ],
  VII: [
    ["i", 3],
    ["III", 1.5],
  ],
};

/** Bất Khả: cầu thang Escher — hợp âm tăng (aug) mỗi lần đổi lên một cung nguyên, hoà âm Shepard nên "lên mãi" */
const ESCHER: Record<string, ChordDef> = {};
const ESCHER_G: Record<string, [string, number][]> = {};
for (let k = 0; k < 6; k++) {
  ESCHER[`s${k}`] = { semis: 2 * k, q: k % 2 ? "aug" : "sus2" };
  ESCHER_G[`s${k}`] = [
    [`s${(k + 1) % 6}`, 6],
    [`s${(k + 3) % 6}`, 1],
  ];
}

const VOID_CH: Record<string, ChordDef> = { o: { semis: 0, q: "fifth" }, f: { semis: 5, q: "fifth" }, s: { semis: 7, q: "sus2" }, b: { semis: -2, q: "fifth" } };
const VOID_G: ChordGraph = {
  o: [
    ["f", 1],
    ["s", 1],
    ["b", 1],
  ],
  f: [["o", 1]],
  s: [["o", 1]],
  b: [["o", 1]],
};

/** Lament bass (tứ âm đi xuống) cho thư viện — bóng dáng Baroque */
const LIB_CH: Record<string, ChordDef> = { i: { semis: 0, q: "min" }, v7: { semis: -2, q: "maj" }, VI: { semis: -4, q: "maj" }, V: { semis: -5, q: "maj" }, iv: { semis: 5, q: "min" } };
const LIB_G: ChordGraph = {
  i: [
    ["v7", 3],
    ["iv", 1],
  ],
  v7: [["VI", 1]],
  VI: [
    ["V", 3],
    ["iv", 1],
  ],
  V: [["i", 1]],
  iv: [["V", 1]],
};

export const ZONES: Record<string, ZoneProfile> = {
  hubDay: {
    id: "hubDay",
    root: 62,
    scale: "majorPenta",
    bpm: 72,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 2,
    hi: 11,
    lead: "kalimba",
    pad: "warm",
    padCenter: 60,
    bass: 0.6,
    density: 0.8,
    breath: 0.6,
    chords: MAJ_CHORDS,
    graph: FUNC,
    start: "I",
    mode: "melodic",
    extras: [],
    bright: 3600,
    space: 0.35,
    level: 0.85,
  },
  hubNight: {
    id: "hubNight",
    // Si thứ ngũ cung = cùng tập nốt với Rê trưởng ngũ cung
    root: 59,
    scale: "minorPenta",
    bpm: 60,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 3,
    hi: 11,
    lead: "musicbox",
    pad: "air",
    padCenter: 57,
    bass: 0.4,
    density: 0.6,
    breath: 0.75,
    chords: MIN_CHORDS,
    graph: MIN_GRAPH,
    start: "i",
    mode: "melodic",
    extras: ["cricket"],
    bright: 2400,
    space: 0.55,
    level: 0.75,
  },
  valley: {
    id: "valley",
    root: 67,
    scale: "lydian",
    bpm: 80,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 0,
    hi: 9,
    lead: "marimba",
    pad: "warm",
    padCenter: 60,
    bass: 0.5,
    density: 0.75,
    breath: 0.55,
    chords: MAJ_CHORDS,
    graph: FUNC,
    start: "I",
    mode: "melodic",
    extras: [],
    bright: 3800,
    space: 0.3,
    level: 0.8,
  },
  expanse: {
    id: "expanse",
    root: 65,
    scale: "majorPenta",
    bpm: 58,
    beatsPerBar: 4,
    phraseBars: 3,
    lo: 0,
    hi: 9,
    lead: "flute",
    pad: "air",
    padCenter: 57,
    bass: 0.3,
    density: 0.55,
    breath: 0.8,
    chords: { I: { semis: 0, q: "fifth" }, IV: { semis: 5, q: "sus2" }, ii: { semis: 2, q: "sus4" }, vi: { semis: 9, q: "fifth" } },
    graph: {
      I: [
        ["IV", 2],
        ["vi", 1],
        ["ii", 1],
      ],
      IV: [["I", 1]],
      ii: [["I", 1]],
      vi: [
        ["IV", 1],
        ["I", 1],
      ],
    },
    start: "I",
    mode: "melodic",
    extras: ["chirp", "wind"],
    bright: 3000,
    space: 0.45,
    level: 0.75,
  },
  impossible: {
    id: "impossible",
    root: 60,
    scale: "wholeTone",
    bpm: 54,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 3,
    hi: 11,
    lead: "glass",
    pad: "shepard",
    padCenter: 60,
    bass: 0,
    density: 0.5,
    breath: 0.7,
    chords: ESCHER,
    graph: ESCHER_G,
    start: "s0",
    mode: "melodic",
    extras: ["shepardRise"],
    bright: 4200,
    space: 0.7,
    level: 0.7,
  },
  paradox: {
    id: "paradox",
    // Đô 2 (65,4 Hz): giai điệu là các hoạ âm 6…16 của nó (kể cả hoạ âm 7, 11, 13 "lệch" khỏi 12-TET)
    root: 36,
    scale: "majorPenta",
    bpm: 40,
    beatsPerBar: 4,
    phraseBars: 3,
    lo: 6,
    hi: 16,
    lead: "bell",
    pad: "organ",
    padCenter: 48,
    bass: 0,
    density: 0.35,
    breath: 0.85,
    chords: VOID_CH,
    graph: VOID_G,
    start: "o",
    mode: "harmonics",
    extras: ["drone"],
    bright: 2200,
    space: 0.85,
    level: 0.7,
  },
  babel: {
    id: "babel",
    root: 62,
    scale: "harmonicMinor",
    bpm: 76,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 0,
    hi: 9,
    lead: "harpsichord",
    pad: "none",
    padCenter: 55,
    bass: 0.85,
    density: 0.85,
    breath: 0.6,
    chords: LIB_CH,
    graph: LIB_G,
    start: "i",
    mode: "sequence",
    extras: ["drip"],
    bright: 5200,
    space: 0.4,
    level: 0.6,
  },
  vault: {
    id: "vault",
    root: 57,
    scale: "aeolian",
    bpm: 50,
    beatsPerBar: 4,
    phraseBars: 3,
    lo: 0,
    hi: 8,
    lead: "bell",
    pad: "organ",
    padCenter: 50,
    bass: 0.3,
    density: 0.4,
    breath: 0.8,
    chords: MIN_CHORDS,
    graph: MIN_GRAPH,
    start: "i",
    mode: "melodic",
    extras: ["drip"],
    bright: 2000,
    space: 0.75,
    level: 0.65,
  },
  // Quần đảo Xuyến: lydian sáng, kalimba thưa, gió — một vòng giai điệu quay về đúng chỗ cũ
  torus: {
    id: "torus",
    root: 62,
    scale: "lydian",
    bpm: 66,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 0,
    hi: 9,
    lead: "kalimba",
    pad: "air",
    padCenter: 57,
    bass: 0.45,
    density: 0.55,
    breath: 0.55,
    chords: MAJ_CHORDS,
    graph: FUNC,
    start: "I",
    mode: "melodic",
    extras: ["wind"],
    bright: 4200,
    space: 0.7,
    level: 0.6,
  },
  // Bờ Sóng: dorian sáng, marimba như giọt nước, gió biển; nhịp chậm như sóng lừng (66 bpm ≈ một phách / 0,9 s)
  coast: {
    id: "coast",
    root: 62,
    scale: "dorian",
    bpm: 66,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 0,
    hi: 9,
    lead: "marimba",
    pad: "air",
    padCenter: 57,
    bass: 0.5,
    density: 0.5,
    breath: 0.6,
    chords: MAJ_CHORDS,
    graph: FUNC,
    start: "I",
    mode: "melodic",
    extras: ["wind"],
    bright: 3600,
    space: 0.75,
    level: 0.6,
  },
  // Chợ Xác Suất: chợ đêm hội — ngũ cung trưởng, đàn gảy rộn hơn, dế đêm
  bazaar: {
    id: "bazaar",
    root: 57,
    scale: "majorPenta",
    bpm: 92,
    beatsPerBar: 4,
    phraseBars: 2,
    lo: 0,
    hi: 8,
    lead: "pluck",
    pad: "warm",
    padCenter: 55,
    bass: 0.6,
    density: 0.62,
    breath: 0.45,
    chords: MAJ_CHORDS,
    graph: FUNC,
    start: "I",
    mode: "melodic",
    extras: ["cricket"],
    bright: 3600,
    space: 0.55,
    level: 0.58,
  },
};

/**
 * Hồ sơ nhạc cho cảnh. null = vùng này không có nhạc nền (Mê cung Hoạ âm tự có bộ tổng hợp; phòng Học có mưa / lửa riêng).
 * night (0…1) chỉ dùng cho Quảng trường.
 */
export function zoneProfile(scene: string, night = 0): ZoneProfile | null {
  switch (scene) {
    case "hub":
      return night >= 0.5 ? ZONES.hubNight : ZONES.hubDay;
    case "valley":
    case "expanse":
    case "impossible":
    case "paradox":
    case "babel":
    case "vault":
    case "torus":
    case "coast":
    case "bazaar":
      return ZONES[scene];
    default:
      return null;
  }
}

/** Mức "đêm" từ giờ địa phương khi không có chu kỳ ngày đêm đang chạy (19h → 5h30 là đêm, chuyển mượt 1 giờ) */
export function nightFromHour(h: number): number {
  const H = ((h % 24) + 24) % 24;
  const s = (x: number) => Math.min(1, Math.max(0, x));
  // chiều: 18h → 19h lên 1; sáng: 5h → 6h xuống 0
  if (H >= 12) return s(H - 18);
  return s(6 - H);
}

// ───────────── Bộ soạn nhạc ─────────────

export type MusicEvent = {
  /** giây kể từ đầu câu */
  at: number;
  kind: "lead" | "pad" | "bass" | "shepard" | "chirp" | "cricket" | "drip";
  /** tần số (Hz) — với pad / shepard là nhiều nốt */
  hz: number[];
  dur: number;
  vel: number;
  /** pad Shepard: lớp cao độ thực (0…12) */
  pc?: number[];
};
export type Phrase = { kind: PhraseKind; dur: number; events: MusicEvent[]; chord: string; seq?: SeqKind };

/**
 * Bộ soạn theo câu: mỗi lần nextPhrase() trả về một câu (2–3 ô nhịp) gồm giai điệu + nền + điểm nhấn.
 * Đổi hồ sơ giữa chừng (ngày → đêm) bằng setProfile — áp dụng từ câu kế.
 */
export class Composer {
  private rng: Rng;
  p: ZoneProfile;
  private motif: MNote[] = [];
  private plan: PhraseKind[] = [];
  private cycles = 0;
  chord: string;
  /** Shepard: lớp cao độ gốc tăng mãi (không mod) */
  rise = 0;
  private seqKind: SeqKind = "pi";
  private seqI = 0;
  private hDeg = 8;

  constructor(p: ZoneProfile, seed = 1) {
    this.rng = mulberry32(seed);
    this.p = p;
    this.chord = p.start;
    this.newMotif();
  }

  setProfile(p: ZoneProfile) {
    if (p.id === this.p.id) return;
    const changed = p.chords !== this.p.chords;
    this.p = p;
    if (changed) this.chord = p.start;
    this.newMotif();
    this.plan = [];
  }

  private get beat() {
    return 60 / this.p.bpm;
  }
  private get phraseBeats() {
    return this.p.beatsPerBar * this.p.phraseBars;
  }

  private newMotif() {
    // động cơ chiếm khoảng nửa câu; câu = động cơ + đáp / biến tấu
    const b = this.phraseBeats;
    this.motif = makeMotif(this.rng, b, this.p.lo, this.p.hi);
  }

  private leadHz(deg: number): number {
    const p = this.p;
    if (p.mode === "harmonics") return midiToHz(p.root) * deg;
    return midiToHz(degreeToMidi(SCALES[p.scale], p.root, deg));
  }

  nextPhrase(): Phrase {
    const p = this.p;
    if (!this.plan.length) {
      this.plan = planCycle(this.rng, p.breath);
      this.cycles++;
      // mỗi 2 vòng: động cơ mới (phát triển dài hạn, không lặp một giai điệu mãi)
      if (this.cycles % 2 === 0) this.newMotif();
    }
    const kind = this.plan.shift()!;
    const beat = this.beat;
    const beats = this.phraseBeats;
    const dur = beats * beat;
    const events: MusicEvent[] = [];
    const scale = SCALES[p.scale];

    // ── nền: đổi hợp âm mỗi 2 ô nhịp (hoặc mỗi câu nếu câu 3 ô)
    const per = p.phraseBars >= 3 ? p.phraseBars : 2;
    const chordsThis: string[] = [];
    for (let bar = 0; bar < p.phraseBars; bar += per) {
      this.chord = nextChord(this.rng, p.graph, this.chord);
      chordsThis.push(this.chord);
      if (kind === "silence") continue;
      const c = p.chords[this.chord];
      const t = bar * p.beatsPerBar * beat;
      const len = Math.min(per, p.phraseBars - bar) * p.beatsPerBar * beat;
      if (p.pad === "shepard") {
        this.rise += 2;
        events.push({ at: t, kind: "shepard", hz: [], pc: chordPcs({ semis: this.rise, q: c.q }), dur: len + 1.5, vel: 0.5 });
      } else if (p.pad !== "none") {
        events.push({ at: t, kind: "pad", hz: voiceChord(c, p.root, p.padCenter).map(midiToHz), dur: len + 1.2, vel: 0.5 });
      }
      if (p.bass > 0 && this.rng() < p.bass) {
        const bm = p.root + c.semis - 24;
        events.push({ at: t, kind: "bass", hz: [midiToHz(bm >= 28 ? bm : bm + 12)], dur: Math.min(len, 4 * beat), vel: 0.5 });
      }
    }
    const lastChord = p.chords[chordsThis[chordsThis.length - 1]];

    // ── giai điệu
    let seq: SeqKind | undefined;
    if (kind !== "rest" && kind !== "silence") {
      if (p.mode === "sequence") {
        // dãy số → bậc thang: chuỗi móc đơn (8 nốt / ô nhịp) ngắt quãng, mỗi câu một dãy
        if (kind === "A") {
          const kinds: SeqKind[] = ["pi", "fib", "prime", "collatz", "recaman"];
          this.seqKind = kinds[Math.floor(this.rng() * kinds.length)];
          this.seqI = Math.floor(this.rng() * 40);
        }
        seq = this.seqKind;
        const n = scale.length;
        const groups = 1 + Math.floor(this.rng() * 2);
        let t = 0;
        for (let g = 0; g < groups && t < beats - 2; g++) {
          const len = [4, 6, 8][Math.floor(this.rng() * 3)];
          const base = this.rng() < 0.5 ? 0 : n;
          for (let i = 0; i < len && t < beats - 0.25; i++) {
            const v = seqValue(this.seqKind, this.seqI++, n);
            const deg = base + v > p.hi ? base + v - n : base + v;
            if (this.rng() < p.density || i === 0) events.push({ at: t * beat, kind: "lead", hz: [this.leadHz(deg)], dur: beat * 0.9, vel: (i === 0 ? 0.75 : 0.5) + this.rng() * 0.15 });
            t += 0.5;
          }
          t += 1 + Math.floor(this.rng() * 2);
        }
      } else if (p.mode === "harmonics") {
        // chuỗi hoạ âm: đi bậc trên dãy n·f₀, rất thưa
        let t = this.rng() * 2;
        while (t < beats - 1) {
          const step = weightedPick(this.rng, [
            [1, 3],
            [-1, 3],
            [2, 1],
            [-2, 1],
            [0, 0.3],
          ] as const);
          this.hDeg = Math.max(p.lo, Math.min(p.hi, this.hDeg + step));
          if (this.rng() < p.density + 0.3) events.push({ at: t * beat, kind: "lead", hz: [this.leadHz(this.hDeg)], dur: beat * (3 + this.rng() * 3), vel: 0.4 + this.rng() * 0.3 });
          t += 2 + Math.floor(this.rng() * 3);
        }
      } else {
        const ops: Variation[] = ["transpose", "invert", "retro", "augment", "ornament", "thin", "displace"];
        let m: MNote[];
        if (kind === "A") m = this.motif;
        else if (kind === "B") m = vary(this.rng, vary(this.rng, this.motif, "invert", p.lo, p.hi), "transpose", p.lo, p.hi);
        else m = vary(this.rng, this.motif, ops[Math.floor(this.rng() * ops.length)], p.lo, p.hi);
        m = cadence(fitBeats(m, beats), scale, chordPcs(lastChord), p.lo, p.hi);
        let t = 0;
        for (let i = 0; i < m.length; i++) {
          const n = m[i];
          const play = !n.rest && (i === 0 || i === m.length - 1 || this.rng() < p.density);
          if (play) events.push({ at: t * beat, kind: "lead", hz: [this.leadHz(n.deg)], dur: Math.max(0.25, n.beats) * beat, vel: n.vel });
          t += n.beats;
        }
      }
    }

    // ── điểm nhấn vùng (thưa, ngẫu nhiên — tạo cảm giác "sống")
    for (const x of p.extras) {
      if (x === "chirp" && this.rng() < 0.55) {
        const at = this.rng() * dur * 0.8;
        const k = 2 + Math.floor(this.rng() * 3);
        const f = 2400 + this.rng() * 2600;
        for (let i = 0; i < k; i++) events.push({ at: at + i * (0.09 + this.rng() * 0.05), kind: "chirp", hz: [f * (1 + (this.rng() - 0.5) * 0.12)], dur: 0.08, vel: 0.35 + this.rng() * 0.2 });
      } else if (x === "cricket" && this.rng() < 0.6) {
        const at = this.rng() * dur * 0.7;
        events.push({ at, kind: "cricket", hz: [4200 + this.rng() * 600], dur: 0.6 + this.rng() * 0.8, vel: 0.3 });
      } else if (x === "drip" && this.rng() < 0.45) {
        events.push({ at: this.rng() * dur, kind: "drip", hz: [900 + this.rng() * 1400], dur: 0.25, vel: 0.3 + this.rng() * 0.2 });
      }
    }
    events.sort((a, b) => a.at - b.at);
    return { kind, dur, events, chord: chordsThis[chordsThis.length - 1], seq };
  }
}
