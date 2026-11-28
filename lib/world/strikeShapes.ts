/**
 * VFX-AAA (luật 3: đa dạng hình học) — thay "vòng tròn đổi màu" (addFx ring / nova / vring) bằng HÌNH 3D RIÊNG cho từng loại đòn /
 * sự kiện. Logic THUẦN (test ở tests/world/strikeShapes.test.ts): bảng nhịp 5 pha theo hình, bộ sinh đường (đứt gãy zigzag,
 * xích catenary, tua xoắn, ô mã), ghi thẳng vào mảng có sẵn — không cấp phát mỗi khung.
 *
 * Đòn tức thời (sát thương đã tính lúc gọi): pha "báo trước" chỉ là mép vẽ vòng 30–40 ms + nín thở ngắn, rồi cao trào; dồn lực
 * thật nằm ở động tác / tụ lực của vũ khí (hình "sigil" co vào cho các pha tụ). Vùng sát thương KHÔNG đổi: mép của hình luôn đặt
 * đúng bán kính / góc của luật.
 */

export type StrikeShape =
  | "wedge" // nêm / quạt góc mở (đòn đòn bẩy, khiên đập) — mép đúng góc + bán kính trúng
  | "rupture" // đứt gãy địa tầng zigzag toả ra + phiến đá trồi (đòn tròn cận chiến)
  | "crater" // bổ nhào: miệng hố — vương miện phiến đá nghiêng ra ngoài + vết nứt dày
  | "grid" // lưới trực giao 90° trong vùng mưa tên
  | "knight" // bàn cờ 5×5: sáng đúng 8 ô nước mã (quái Mã)
  | "dial" // mặt đồng hồ quay ngược (né hoàn hảo — khúc xạ thời gian)
  | "sigil" // đa giác tụ lực CO VÀO (dồn lực / đổi vũ khí)
  | "hex" // trường lưới lục giác + vách cong (hộ vệ phản đòn / dựng khiên)
  | "star" // tinh hình sao nhọn (nhát kết nova)
  | "crest" // sóng cuộn: vương miện rèm sóng nở ra tới bán kính
  | "tendril" // tua xoắn mọc từ mép vào tâm (hút)
  | "chain" // xích catenary từ tâm tới mép rồi đứt (khiên con lắc xả)
  | "drop" // rơi kiến trúc: cột đá đổ thẳng xuống quanh vùng (tuyệt kỹ)
  | "piston" // cột nhịp đẩy lên / thụt xuống quanh người (trống con lắc)
  | "wall" // vách phản xạ đứng (sóng dừng)
  | "cage" // lồng trực giao: thanh dựng quanh hộ vệ (chia ước)
  | "muzzle" // mũi nhọn chevron ở nòng / mũi giáo (bắn tụ lực)
  | "scorch" // sét đánh đất: vết cháy phân nhánh Lichtenberg (khác "rupture" của đòn tròn: không phiến đá, nhánh con, muội)
  | "converge" // tuyệt kỹ tụ: gai pha lê từ xa trượt vào vây quanh (khác "sigil")
  | "helix" // đổi vũ khí: dải xoắn ốc bốc lên quanh người
  | "shell" // hộ vệ dựng khiên: 6 tấm vỏ cong khép quanh
  | "spring" // đệm nảy: chevron đứng chồng nhau vút lên
  | "spokes" // bật lên trăng: chùm tia toả (quay mặt máy quay)
  | "iris" // tới cổng: lá chắn sáng dạng mống mắt xoay mở
  | "gate" // bước qua mép sân khấu: khung cổng trực giao 2 cột + xà
  | "land"; // tiếp đất mạnh: vệt trượt ngắn toả + bụi

/** thời lượng từng pha (ms): báo trước, nín thở, cao trào, duy trì, nguội */
export interface BeatSpec {
  tele: number;
  hold: number;
  climax: number;
  sustain: number;
  cool: number;
}

const B = (tele: number, hold: number, climax: number, sustain: number, cool: number): BeatSpec => ({ tele, hold, climax, sustain, cool });

export const STRIKE_BEATS: Record<StrikeShape, BeatSpec> = {
  wedge: B(35, 30, 60, 160, 260),
  rupture: B(40, 45, 70, 260, 520),
  crater: B(30, 50, 80, 320, 700),
  grid: B(120, 0, 60, 900, 300),
  knight: B(60, 40, 70, 260, 320),
  dial: B(80, 40, 70, 900, 400),
  sigil: B(260, 60, 50, 60, 160),
  hex: B(60, 40, 70, 260, 320),
  star: B(30, 40, 60, 160, 320),
  crest: B(40, 30, 60, 300, 360),
  tendril: B(80, 30, 50, 260, 260),
  chain: B(160, 50, 60, 140, 320),
  drop: B(60, 40, 90, 520, 900),
  piston: B(30, 30, 60, 140, 220),
  wall: B(90, 30, 60, 700, 300),
  cage: B(120, 40, 60, 360, 300),
  muzzle: B(25, 20, 50, 90, 140),
  scorch: B(30, 40, 60, 220, 600),
  converge: B(300, 40, 60, 80, 200),
  helix: B(120, 0, 50, 120, 200),
  shell: B(120, 30, 60, 300, 260),
  spring: B(40, 0, 50, 140, 200),
  spokes: B(50, 30, 60, 200, 300),
  iris: B(120, 30, 60, 200, 260),
  gate: B(80, 20, 60, 260, 260),
  land: B(20, 0, 40, 120, 260),
};

export function strikeDuration(s: BeatSpec): number {
  return s.tele + s.hold + s.climax + s.sustain + s.cool;
}

/** Trạng thái tại một thời điểm (ghi vào out — không cấp phát) */
export interface Beat {
  /** 0 báo trước · 1 nín thở · 2 cao trào · 3 duy trì · 4 nguội · 5 xong */
  phase: number;
  /** tiến độ trong pha 0..1 */
  k: number;
  /** mép đã vẽ 0..1 (báo trước) */
  draw: number;
  /** hệ số sáng HDR (nín thở tụt, cao trào vọt lên rồi tắt bất đối xứng) */
  glow: number;
  /** nhiệt 1 → 0 (lõi nóng → muội khi nguội) */
  heat: number;
  /** ngưỡng xói 0 → 1 (pha nguội) */
  erode: number;
  /** tiến độ tổng thể 0..1 */
  t: number;
}

export function newBeat(): Beat {
  return { phase: 0, k: 0, draw: 0, glow: 0, heat: 0, erode: 0, t: 0 };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/**
 * Nhịp 5 pha: báo trước (mép vẽ outCubic, sáng 0,8) → nín thở (tụt về 0,35) → cao trào (vọt 2,6 rồi tắt mũ) → duy trì (1 → 0,8)
 * → nguội (nhiệt → 0, xói 0 → 1). Giảm chuyển động: đỉnh cao trào chỉ 1,3 (không chớp mạnh).
 */
export function beatAt(ageMs: number, s: BeatSpec, out: Beat, reduced = false): Beat {
  const total = strikeDuration(s);
  out.t = clamp01(ageMs / Math.max(1, total));
  const peak = reduced ? 1.3 : 2.6;
  let a = ageMs;
  if (a < 0) {
    out.phase = 0;
    out.k = 0;
    out.draw = 0;
    out.glow = 0;
    out.heat = 1;
    out.erode = 0;
    return out;
  }
  if (a < s.tele) {
    out.phase = 0;
    out.k = a / Math.max(1, s.tele);
    out.draw = outCubic(out.k);
    out.glow = 0.8;
    out.heat = 1;
    out.erode = 0;
    return out;
  }
  a -= s.tele;
  out.draw = 1;
  out.erode = 0;
  if (a < s.hold) {
    out.phase = 1;
    out.k = a / Math.max(1, s.hold);
    out.glow = 0.8 - 0.45 * out.k;
    out.heat = 1;
    return out;
  }
  a -= s.hold;
  if (a < s.climax) {
    out.phase = 2;
    out.k = a / Math.max(1, s.climax);
    // 1–3 khung lên đỉnh (25 % đầu) rồi tắt mũ về 1
    out.glow = out.k < 0.25 ? 0.35 + (peak - 0.35) * (out.k / 0.25) : 1 + (peak - 1) * Math.exp(-4 * (out.k - 0.25));
    out.heat = 1;
    return out;
  }
  a -= s.climax;
  if (a < s.sustain) {
    out.phase = 3;
    out.k = a / Math.max(1, s.sustain);
    out.glow = 1 - 0.2 * out.k;
    out.heat = 1 - 0.35 * out.k;
    return out;
  }
  a -= s.sustain;
  if (a < s.cool) {
    out.phase = 4;
    out.k = a / Math.max(1, s.cool);
    out.glow = 0.8 * (1 - out.k);
    out.heat = 0.65 * Math.exp(-3.5 * out.k) * (1 - out.k);
    out.erode = out.k;
    return out;
  }
  out.phase = 5;
  out.k = 1;
  out.glow = 0;
  out.heat = 0;
  out.erode = 1;
  return out;
}

// ───────────── Bộ sinh đường (ghi vào Float32Array có sẵn) ─────────────

/** băm số nguyên → [0, 1) (tất định, dùng chung cho mọi hình) */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Vết nứt zigzag nằm trên đất từ tâm (cx, cz) theo góc `ang`, dài đúng `len` (mép = bán kính trúng): `n` đốt, lệch ngang
 * xen kẽ ± amp (giảm dần về mũi). Ghi (x, y, z) vào out, trả số điểm. Điểm cuối luôn đúng ở bán kính len.
 */
export function zigzagCrack(out: Float32Array, cx: number, cy: number, cz: number, ang: number, len: number, n: number, amp: number, seed: number): number {
  const m = Math.max(2, Math.min(n + 1, Math.floor(out.length / 3)));
  const dx = Math.sin(ang);
  const dz = Math.cos(ang);
  for (let i = 0; i < m; i++) {
    const u = i / (m - 1);
    const side = i === 0 || i === m - 1 ? 0 : (i % 2 ? 1 : -1) * amp * (0.55 + 0.45 * hash01(seed * 31 + i)) * (1 - 0.6 * u);
    const r = len * u;
    out[i * 3] = cx + dx * r + dz * side;
    out[i * 3 + 1] = cy;
    out[i * 3 + 2] = cz + dz * r - dx * side;
  }
  return m;
}

/**
 * Xích catenary từ A tới B, võng xuống `sag` m ở giữa (y = a·cosh — chuẩn hoá để hai đầu đúng A, B). Ghi n điểm, trả n.
 */
export function catenary(out: Float32Array, ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number, n: number): number {
  const m = Math.max(2, Math.min(n, Math.floor(out.length / 3)));
  // hình cosh chuẩn hoá: f(u) = (cosh(c(2u−1)) − cosh c) / (1 − cosh c) ∈ [0, 1], = 1 ở giữa, 0 ở hai đầu
  const c = 1.6;
  const ch = Math.cosh(c);
  for (let i = 0; i < m; i++) {
    const u = i / (m - 1);
    const f = (Math.cosh(c * (2 * u - 1)) - ch) / (1 - ch);
    out[i * 3] = ax + (bx - ax) * u;
    out[i * 3 + 1] = ay + (by - ay) * u - sag * f;
    out[i * 3 + 2] = az + (bz - az) * u;
  }
  return m;
}

/**
 * Tua xoắn mọc từ mép (bán kính r0, góc a0) cuộn vào tâm (bán kính r1), quay `turns` vòng, nhô lên h ở giữa. Hiện phần
 * u ∈ [0, grow] (mọc dần). Ghi n điểm, trả n.
 */
export function tendril(out: Float32Array, cx: number, cy: number, cz: number, a0: number, r0: number, r1: number, turns: number, h: number, grow: number, n: number): number {
  const m = Math.max(2, Math.min(n, Math.floor(out.length / 3)));
  const g = clamp01(grow);
  for (let i = 0; i < m; i++) {
    const u = (i / (m - 1)) * g;
    const r = r0 + (r1 - r0) * u;
    const a = a0 + turns * Math.PI * 2 * u;
    out[i * 3] = cx + Math.sin(a) * r;
    out[i * 3 + 1] = cy + h * Math.sin(Math.PI * u);
    out[i * 3 + 2] = cz + Math.cos(a) * r;
  }
  return m;
}

/** 8 ô nước Mã (đơn vị ô) — khớp luật `knightSq` ở CombatScene (|dx|, |dz|) ∈ {(1, 2), (2, 1)} */
export const KNIGHT_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

/** Có phải ô nước Mã không (dùng chung cho test & shader) */
export function isKnightCell(cx: number, cz: number): boolean {
  const a = Math.abs(cx);
  const b = Math.abs(cz);
  return (a === 1 && b === 2) || (a === 2 && b === 1);
}

/** Số phần tử phụ theo mức hiệu ứng (0 thấp · 1 vừa · 2 cao), luôn ≥ min */
export function lodCount(n: number, lv: 0 | 1 | 2, min = 1): number {
  const k = lv === 0 ? 0.4 : lv === 1 ? 0.7 : 1;
  return Math.max(min, Math.round(n * k));
}
