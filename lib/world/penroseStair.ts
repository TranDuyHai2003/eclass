/**
 * Cầu thang Penrose — Chiếu nghỉ Escher (bốt Siêu khối, tầng lửng 270°; TESSERACT_BOOTH.md §4.4 mục 4, §13 H3).
 * Giếng thang vuông: 4 chiếu nghỉ ở 4 góc + 4 đợt thang dọc 4 cạnh, leo theo chiều kim đồng hồ (nhìn từ trên):
 * L0 (góc đông bắc, có cửa ra hành lang) → F0 (cạnh đông, đi về nam) → L1 (đông nam) → F1 (cạnh nam, đi về tây) → L2 (tây nam)
 * → F2 (cạnh tây, đi về bắc) → L3 (tây bắc) → F3 (cạnh bắc, đi về đông) → L0 nhưng cao hơn đúng một vòng H.
 * Hình học là một "xoắn ốc vuông" — mỗi vòng chồng lên nhau, vẽ nhiều bản giống hệt nhau; khi người chơi lên quá một vòng
 * thì dời xuống đúng H (máy quay dời cùng lượng, CAM.shift) → leo mãi mà "độ cao tăng: 0 m", không bao giờ thấy mối nối.
 * Lối ra bí mật: cửa chỉ mở khi bạn đi XUỐNG tới chiếu nghỉ cửa (leo lên tới nơi thì cửa đã thành tường).
 * Toạ độ cục bộ phòng điều khiển (lib/world/tessRoom.ts): x = đông, z = nam, y = độ cao tuyệt đối.
 * Thuần logic, không three.js — có test (tests/world/penroseStair.test.ts).
 */

/** Kích thước (m). Mặt bậc = mặt trên; dưới mỗi mặt là tấm dày SLAB. */
export const ESC = {
  /** độ cao chiếu nghỉ L0 của vòng 0 = sàn tầng lửng (TR.ZM) */
  y0: 5,
  /** bề rộng lối đi (chiếu nghỉ vuông W × W) */
  W: 2.0,
  /** số mặt bậc mỗi đợt, bề sâu mặt bậc */
  treads: 9,
  run: 0.3,
  /** số cổ bậc mỗi đợt (= treads + 1: bậc cuối lên thẳng chiếu nghỉ), chiều cao cổ bậc */
  risers: 10,
  rise: 0.16,
  /** biên giếng thang (mép trong của tường): tây / đông / bắc / nam */
  X0: -29.1,
  X1: -22.4,
  Z0: -1.0,
  Z1: 5.7,
  /** tấm sàn dưới mặt bậc / chiếu nghỉ */
  SLAB: 0.45,
  /** cửa ở tường đông của L0 (z ∈ [−DOOR/2, DOOR/2] = cả bề rộng chiếu nghỉ), cao DOOR_H; lan can quanh giếng cao RAIL */
  DOOR: 2.0,
  DOOR_H: 2.6,
  RAIL: 0.95,
  /** hành lang chiếu nghỉ từ vòm tầng lửng 270° tới cửa giếng: x ∈ [X1, PX1], |z| < PW/2, sàn ở y0, cao PH */
  PX1: -13.3,
  PW: 2.4,
  PH: 3.0,
} as const;

/** chiều dài một đợt thang (theo phương ngang) */
export const FLIGHT_RUN = ESC.treads * ESC.run; // 2,7
/** độ cao một đợt */
export const FLIGHT_RISE = ESC.risers * ESC.rise; // 1,6
/** độ cao một vòng (4 đợt) */
export const LAP_H = 4 * FLIGHT_RISE; // 6,4
/** bước lên tối đa của nhân vật (khớp tessRoom.roomGround) */
export const STEP_UP = 0.55;

export type StairCell = { kind: "landing"; i: number; base: number } | { kind: "flight"; i: number; tread: number; base: number };

const inR = (v: number, a: number, b: number) => v >= a && v <= b;

/**
 * Ô cầu thang tại (x, z) và độ cao "gốc" của mặt bậc trong [0, LAP_H) (so với y0, vòng 0). null = ngoài lối đi (giếng / ngoài tường).
 * Đợt i lên từ chiếu nghỉ Lᵢ (gốc i·1,6) tới Lᵢ₊₁: mặt bậc k (0…8) cao i·1,6 + (k+1)·0,16.
 */
export function stairCell(x: number, z: number): StairCell | null {
  const { X0, X1, Z0, Z1, W } = ESC;
  if (!inR(x, X0, X1) || !inR(z, Z0, Z1)) return null;
  const east = x >= X1 - W;
  const west = x <= X0 + W;
  const north = z <= Z0 + W;
  const south = z >= Z1 - W;
  const flight = (i: number, t: number): StairCell => {
    const tread = Math.min(ESC.treads - 1, Math.max(0, Math.floor(t * ESC.treads)));
    return { kind: "flight", i, tread, base: i * FLIGHT_RISE + (tread + 1) * ESC.rise };
  };
  if (east && north) return { kind: "landing", i: 0, base: 0 };
  if (east && south) return { kind: "landing", i: 1, base: FLIGHT_RISE };
  if (west && south) return { kind: "landing", i: 2, base: 2 * FLIGHT_RISE };
  if (west && north) return { kind: "landing", i: 3, base: 3 * FLIGHT_RISE };
  if (east) return flight(0, (z - (Z0 + W)) / FLIGHT_RUN);
  if (south) return flight(1, (X1 - W - x) / FLIGHT_RUN);
  if (west) return flight(2, (Z1 - W - z) / FLIGHT_RUN);
  if (north) return flight(3, (x - (X0 + W)) / FLIGHT_RUN);
  return null; // giếng giữa
}

/** Độ cao gốc (∈ [0, LAP_H)) của mặt bậc tại (x, z), null nếu không ở trên lối đi */
export function stairBase(x: number, z: number): number | null {
  return stairCell(x, z)?.base ?? null;
}

/** Trong lòng giếng thang (kể cả giếng giữa) */
export const inShaft = (x: number, z: number, m = 0) => x > ESC.X0 + m && x < ESC.X1 - m && z > ESC.Z0 + m && z < ESC.Z1 - m;
/** Giếng giữa (rỗng, có lan can) — nới thêm m */
export const inWell = (x: number, z: number, m = 0) => x > ESC.X0 + ESC.W - m && x < ESC.X1 - ESC.W + m && z > ESC.Z0 + ESC.W - m && z < ESC.Z1 - ESC.W + m;

/**
 * Mặt bậc cao nhất mà người chơi ở độ cao y đứng được tại (x, z): các vòng chồng nhau cách đều LAP_H,
 * chọn vòng k lớn nhất sao cho mặt ≤ y + STEP_UP. null nếu không ở trên lối đi.
 */
export function stairGround(x: number, z: number, y: number): number | null {
  const b = stairBase(x, z);
  if (b === null) return null;
  const k = Math.floor((y - ESC.y0 + STEP_UP - b) / LAP_H);
  return ESC.y0 + b + k * LAP_H;
}

/**
 * Quấn vòng: trả lượng dời độ cao (−LAP_H, 0 hoặc +LAP_H) để giữ người chơi trong vòng 0: y − y0 ∈ [−0,4; LAP_H − 0,25).
 * Biên trên thấp hơn LAP_H vì độ cao nhân vật bám mặt bậc kiểu tiệm cận (không bao giờ chạm đúng 6,4 khi lên chiếu nghỉ L0);
 * biên dưới −0,4 (trễ): đứng trên bậc cuối của vòng −1 (−0,16 / −0,32) không bị dời lên xuống liên tục. Khoảng 6,55 > LAP_H.
 */
export const WRAP_HI = LAP_H - 0.25;
export const WRAP_LO = -0.4;
export function lapShift(y: number): number {
  const r = y - ESC.y0;
  if (r >= WRAP_HI) return -LAP_H * Math.floor((r - WRAP_HI) / LAP_H + 1);
  if (r < WRAP_LO) return LAP_H * Math.ceil((WRAP_LO - r) / LAP_H);
  return 0;
}

/** Chỉ số chiếu nghỉ "mở" (không quấn) khi người chơi đứng trên chiếu nghỉ: vòng·4 + i. null nếu không ở chiếu nghỉ. */
export function landingIndex(x: number, z: number, y: number, laps: number): number | null {
  const c = stairCell(x, z);
  if (!c || c.kind !== "landing") return null;
  const lapNow = Math.round((y - ESC.y0 - c.base) / LAP_H);
  return (laps + lapNow) * 4 + c.i;
}

/** Bộ đếm leo thang. idx: chiếu nghỉ (mở) hiện tại = số đợt đã leo (ròng); dir: chiều của lần đổi chiếu nghỉ gần nhất */
export type EscherState = { idx: number; dir: -1 | 0 | 1 };
export const escherStart = (): EscherState => ({ idx: 0, dir: 0 });
/** Cập nhật khi người chơi đặt chân lên một chiếu nghỉ (chỉ số mở). Leo lên → +1, đi xuống → −1 mỗi đợt. */
export function escherStep(s: EscherState, landing: number): EscherState {
  if (landing === s.idx) return s;
  return { idx: landing, dir: landing > s.idx ? 1 : -1 };
}
/** Cửa ở L0 mở khi chưa leo, hoặc khi bạn vừa đi XUỐNG tới (lối ra bí mật) */
export const doorOpen = (s: EscherState) => s.dir <= 0;
/** Số tầng đã leo hiển thị (= số đợt ròng) và độ cao tăng thêm — luôn 0 vì mọi vòng là một */
export const floorsClimbed = (s: EscherState) => s.idx;
export const heightGained = () => 0;

/**
 * Độ cao "mở" (cộng số vòng đã quấn) — dùng cho âm Shepard: mỗi vòng = một quãng tám.
 * laps = tổng số vòng đã dời (dời xuống khi leo → laps tăng).
 */
export const unwrappedHeight = (y: number, laps: number) => y - ESC.y0 + laps * LAP_H;

/**
 * Âm Shepard theo độ cao: N thành phần cách nhau một quãng tám, vị trí trên vòng quãng tám (pos + i) mod N, biên độ hình chuông
 * theo log-tần số → leo lên thì cao độ tăng mãi mà phổ không đổi (cặp đôi thính giác của cầu thang Penrose).
 * Trả đúng N giọng theo chỉ số cố định (để mỗi bộ dao động giữ một giọng); slot = vị trí quãng tám (đổi slot đột ngột = giọng vừa
 * nhảy từ đỉnh về đáy, lúc đó biên độ ≈ 0 → đặt tần số tức thời).
 */
export function shepardVoices(octavePos: number, N = 7, baseHz = 55, sigma = 1.3): { hz: number; amp: number; slot: number }[] {
  const out: { hz: number; amp: number; slot: number }[] = [];
  const f = ((octavePos % 1) + 1) % 1;
  const shift = Math.floor(octavePos);
  for (let i = 0; i < N; i++) {
    // vị trí của giọng i trên vòng 0…N (giọng i tăng dần theo octavePos, quay vòng)
    const slot = (((i + shift) % N) + N) % N;
    const pos = slot + f;
    const amp = Math.exp(-Math.pow((pos - N / 2) / sigma, 2));
    out.push({ hz: baseHz * Math.pow(2, pos), amp, slot });
  }
  return out;
}
