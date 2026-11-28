/**
 * Thế võ của từng vũ khí (thuần dữ liệu + hàm chấm nhịp; không React / three → kiểm thử được).
 * Mỗi nhát = một đoạn clip thật (Quaternius UAL1 + UAL2, retarget sang VRM) [from, to] chạy với tốc độ `speed`;
 * khung trúng `t` lấy từ động học thuận của clip (đỉnh tốc độ bàn tay — scratch `clip_peaks.py`), nên nhát chém
 * tính đúng lúc lưỡi vũ khí tới. Xem docs/ai-reviews/game-3d/COMBAT_COMBOS.md.
 */
export type L = { vi: string; en: string };

export type Shape =
  /** quạt trước mặt (bán kính, góc mở rad) */
  | { k: "arc"; range: number; arc: number }
  /** đường thẳng từ người chơi theo hướng nhìn (đâm / lướt) */
  | { k: "line"; len: number; w: number }
  /** vòng tròn tâm cách người chơi `fwd` m */
  | { k: "circle"; fwd: number; r: number }
  /** đòn bẩy: mô-men = lực × cánh tay đòn → quái càng xa (trong tầm) càng đau */
  | { k: "torque"; range: number }
  /** tên bay theo parabol (n mũi, xoè `spread` rad); charged = xuyên thấu */
  | { k: "arrow"; n: number; spread: number; charged?: boolean }
  /** mưa tên rơi quanh mục tiêu */
  | { k: "rain"; n: number; r: number }
  /** tia sáng xuyên thấu (lăng kính): n tia xoè `spread` rad */
  | { k: "beams"; n: number; spread: number; len: number }
  /** sét lan qua `hops` quái */
  | { k: "chain"; hops: number; range: number }
  /** vật bay quanh người (con lắc / xoắn ốc) */
  | { k: "orbit"; kind: "pendulum" | "spiral"; dur: number; count?: number }
  /** sóng tròn đồng tâm (Fourier): `rings` vòng nở dần */
  | { k: "wave"; fwd: number; r: number; rings: number }
  /** hút quái về tâm rồi nổ */
  | { k: "pull"; r: number }
  /** Giáo Sin: đâm theo sóng y = A·sin(k·s) (đỉnh ×1,5, nút ×0,7) + phóng bó sóng chạy (lib/world/sineLance.ts) */
  | { k: "sine"; len: number; packet: "chain" | "charged" }
  /** Giáo Sin — Sóng dừng: bó sóng đi + bó phản xạ về từ vách cách 2λ */
  | { k: "standing" }
  /** Khiên Con lắc: đập quả lắc, sát thương theo động năng lúc chạm (lib/world/pendShield.ts) */
  | { k: "bob"; range: number; arc: number }
  /** Khiên Con lắc — giải phóng năng lượng cộng hưởng đã tích */
  | { k: "release" }
  /** Khiên Con lắc — dao động cưỡng bức: `pulses` nhịp sóng, mỗi nhịp cách nhau đúng chu kỳ T */
  | { k: "drive"; pulses: number };

export interface Hit {
  /** giây trong clip */
  t: number;
  /** hệ số sát thương × công vũ khí */
  mul: number;
  shape: Shape;
  push?: number;
  shake?: number;
  /** hất quái lên không (m/s) — quái trên không bị đánh tiếp thì lơ lửng (juggle) */
  launch?: number;
  fx?: "slash" | "slashFlip" | "nova" | "none";
}

export interface Move {
  name: L;
  clip: string;
  from: number;
  to: number;
  speed: number;
  hits: Hit[];
  /** quãng lao tới (m) trong lúc ra đòn */
  lunge?: number;
  /** bất tử trong lúc ra đòn (đòn lướt) */
  iframe?: boolean;
  /** tư thế dự phòng khi chưa nạp clip */
  pose: "slash" | "cast" | "roll";
}

export interface Moveset {
  style: L;
  tip: L;
  chain: Move[];
  charged: Move;
  skill: Move;
}

const S = (vi: string, en: string): L => ({ vi, en });

export const MOVESETS: Record<string, Moveset> = {
  blade: {
    style: S("Kiếm nhanh — 4 nhát, nhát 4 nổ sóng", "Fast blade — 4 hits, the 4th bursts"),
    tip: S("Bấm ngay khi lưỡi kiếm loé (sau mỗi nhát trúng) để giữ Nhịp. Giữ chuột: Lướt Tiếp Tuyến xuyên qua hàng quái.", "Press right as the blade flashes (after each impact) to keep the Rhythm. Hold: Tangent Dash through a line of foes."),
    chain: [
      { name: S("Chém xuôi", "Downcut"), clip: "Sword_Regular_A", from: 0, to: 0.43, speed: 1.2, lunge: 0.5, pose: "slash", hits: [{ t: 0.23, mul: 1.0, shape: { k: "arc", range: 2.6, arc: 2.0 }, fx: "slash" }] },
      { name: S("Chém ngược", "Backcut"), clip: "Sword_Regular_B", from: 0, to: 0.53, speed: 1.2, lunge: 0.5, pose: "slash", hits: [{ t: 0.25, mul: 1.1, shape: { k: "arc", range: 2.6, arc: 2.0 }, fx: "slashFlip" }] },
      { name: S("Xoay trảm", "Spin cut"), clip: "Sword_Regular_C", from: 0.3, to: 1.0, speed: 1.15, lunge: 0.8, pose: "slash", hits: [{ t: 0.63, mul: 1.45, shape: { k: "arc", range: 2.9, arc: 2.5 }, fx: "slash" }] },
      { name: S("Sóng tiếp tuyến", "Tangent wave"), clip: "Sword_Heavy_Combo", from: 2.25, to: 3.0, speed: 1.1, lunge: 0.6, pose: "slash", hits: [{ t: 2.53, mul: 2.1, shape: { k: "circle", fwd: 1.2, r: 2.8 }, fx: "nova", shake: 0.25, push: 7, launch: 6 }] },
    ],
    charged: { name: S("Lướt Tiếp Tuyến", "Tangent Dash"), clip: "Sword_Dash", from: 0, to: 0.9, speed: 1.05, lunge: 5, iframe: true, pose: "slash", hits: [{ t: 0.32, mul: 2.4, shape: { k: "line", len: 5.5, w: 1.3 }, fx: "slash", shake: 0.15 }] },
    skill: {
      name: S("Liên trảm", "Flurry"),
      clip: "Sword_Regular_Combo",
      from: 0,
      to: 1.8,
      speed: 1.5,
      lunge: 2.4,
      pose: "slash",
      hits: [
        { t: 0.23, mul: 1.2, shape: { k: "arc", range: 2.9, arc: 2.2 }, fx: "slash" },
        { t: 0.72, mul: 1.2, shape: { k: "arc", range: 2.9, arc: 2.2 }, fx: "slashFlip" },
        { t: 1.53, mul: 2.2, shape: { k: "circle", fwd: 1.0, r: 3.0 }, fx: "nova", shake: 0.3, push: 8, launch: 7 },
      ],
    },
  },
  lever: {
    style: S("Đòn bẩy nặng — chậm, hất văng, quái càng xa càng đau", "Heavy lever — slow, launches foes, farther = harder"),
    tip: S("Giữ khoảng cách 2–3,5 m: mô-men lớn nhất ở đầu cánh tay đòn. Giữ chuột: Đập Điểm Tựa.", "Keep 2–3.5 m away: torque peaks at the arm's tip. Hold: Fulcrum Slam."),
    chain: [
      { name: S("Bẩy ngang", "Side lever"), clip: "Sword_Heavy_Combo", from: 0.15, to: 0.85, speed: 1.1, lunge: 0.4, pose: "slash", hits: [{ t: 0.37, mul: 1.2, shape: { k: "torque", range: 3.6 }, fx: "slash", shake: 0.15 }, { t: 0.5, mul: 0.4, shape: { k: "arc", range: 2.4, arc: 1.6 } }] },
      { name: S("Bẩy ngược", "Back lever"), clip: "Sword_Heavy_Combo", from: 0.85, to: 1.45, speed: 1.05, lunge: 0.4, pose: "slash", hits: [{ t: 1.15, mul: 1.5, shape: { k: "torque", range: 3.7 }, fx: "slashFlip", shake: 0.18 }] },
      { name: S("Bẩy chéo", "Cross lever"), clip: "Sword_Heavy_Combo", from: 1.5, to: 2.1, speed: 1.05, lunge: 0.5, pose: "slash", hits: [{ t: 1.8, mul: 1.7, shape: { k: "torque", range: 3.8 }, fx: "slash", shake: 0.2 }] },
      { name: S("Nện đòn bẩy", "Lever smash"), clip: "Sword_Heavy_Combo", from: 2.2, to: 3.3, speed: 1.0, lunge: 0.5, pose: "slash", hits: [{ t: 2.53, mul: 2.8, shape: { k: "circle", fwd: 1.0, r: 3.6 }, fx: "nova", shake: 0.42, push: 10, launch: 8 }] },
    ],
    charged: { name: S("Đập Điểm Tựa", "Fulcrum Slam"), clip: "Sword_Attack", from: 0.15, to: 1.1, speed: 1.0, lunge: 0.6, pose: "slash", hits: [{ t: 0.37, mul: 2.6, shape: { k: "circle", fwd: 1.4, r: 3.2 }, fx: "nova", shake: 0.38, push: 11, launch: 7.5 }] },
    skill: { name: S("Bập bênh", "Seesaw"), clip: "Sword_Heavy_Combo", from: 0.15, to: 0.75, speed: 0.75, pose: "slash", hits: [{ t: 0.37, mul: 3.0, shape: { k: "circle", fwd: 0, r: 4.5 }, fx: "nova", shake: 0.5, push: 12, launch: 9 }] },
  },
  spiral: {
    style: S("Thương xoắn ốc — 5 nhát nhanh, đâm xa", "Spiral spear — 5 quick hits, long thrusts"),
    tip: S("Nhát 2 và 4 là đâm thẳng 3,4 m: đứng xa hơn kiếm một bước. Giữ chuột: Mũi Khoan.", "Hits 2 and 4 are 3.4 m thrusts: stand a step farther than with a sword. Hold: Drill."),
    chain: [
      { name: S("Móc", "Hook"), clip: "Melee_Hook", from: 0, to: 0.47, speed: 1.25, lunge: 0.3, pose: "slash", hits: [{ t: 0.23, mul: 0.8, shape: { k: "arc", range: 2.8, arc: 1.6 }, fx: "slash" }] },
      { name: S("Đâm", "Thrust"), clip: "Punch_Cross", from: 0.02, to: 0.55, speed: 1.3, lunge: 0.5, pose: "slash", hits: [{ t: 0.17, mul: 0.85, shape: { k: "line", len: 3.4, w: 0.9 } }] },
      { name: S("Quét", "Sweep"), clip: "Sword_Regular_B", from: 0, to: 0.53, speed: 1.3, lunge: 0.3, pose: "slash", hits: [{ t: 0.25, mul: 0.9, shape: { k: "arc", range: 2.8, arc: 2.3 }, fx: "slashFlip" }] },
      { name: S("Đâm kép", "Double thrust"), clip: "Punch_Jab", from: 0, to: 0.5, speed: 1.3, lunge: 0.5, pose: "slash", hits: [{ t: 0.13, mul: 0.85, shape: { k: "line", len: 3.4, w: 0.9 } }] },
      { name: S("Lốc xoắn", "Vortex"), clip: "Sword_Regular_C", from: 0.3, to: 1.1, speed: 1.2, lunge: 0.4, pose: "slash", hits: [{ t: 0.63, mul: 1.3, shape: { k: "arc", range: 3.0, arc: 6.28 }, fx: "slash", launch: 4.5 }, { t: 0.66, mul: 0.6, shape: { k: "orbit", kind: "spiral", dur: 1500 } }] },
    ],
    charged: { name: S("Mũi Khoan", "Drill"), clip: "Shield_Dash", from: 0, to: 0.8, speed: 1.2, lunge: 4.5, iframe: true, pose: "slash", hits: [{ t: 0.3, mul: 2.0, shape: { k: "line", len: 4.8, w: 1.1 }, shake: 0.12, launch: 5 }] },
    skill: { name: S("Xoáy hút", "Vortex pull"), clip: "Sword_Regular_C", from: 0.3, to: 1.4, speed: 1.0, pose: "slash", hits: [{ t: 0.45, mul: 0.4, shape: { k: "pull", r: 5.5 } }, { t: 0.63, mul: 2.2, shape: { k: "circle", fwd: 0, r: 3.2 }, fx: "nova", shake: 0.3, push: 6, launch: 7 }] },
  },
  bow: {
    style: S("Cung parabol — 4 phát, phát 3–4 tách mũi", "Parabola bow — 4 shots, shots 3–4 split"),
    tip: S("Tên bay theo parabol thật; giữ chuột để bắn phát tụ lực xuyên thấu, chuột phải để ngắm qua vai.", "Arrows fly real parabolas; hold to fire a piercing charged shot, right-click to aim."),
    chain: [
      { name: S("Bắn", "Shot"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.4, pose: "cast", hits: [{ t: 0.12, mul: 1.0, shape: { k: "arrow", n: 1, spread: 0 } }] },
      { name: S("Bắn nhanh", "Quick shot"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.55, pose: "cast", hits: [{ t: 0.12, mul: 1.0, shape: { k: "arrow", n: 1, spread: 0 } }] },
      { name: S("Tên đôi", "Twin arrows"), clip: "OverhandThrow", from: 0.1, to: 0.65, speed: 1.4, pose: "cast", hits: [{ t: 0.32, mul: 0.8, shape: { k: "arrow", n: 2, spread: 0.12 } }] },
      { name: S("Quạt tên", "Fan"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.15, pose: "cast", hits: [{ t: 0.12, mul: 0.85, shape: { k: "arrow", n: 3, spread: 0.22 } }] },
    ],
    charged: { name: S("Tên tụ lực", "Charged arrow"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.9, pose: "cast", hits: [{ t: 0.12, mul: 2.4, shape: { k: "arrow", n: 1, spread: 0, charged: true }, shake: 0.1 }] },
    skill: { name: S("Mưa parabol", "Parabola rain"), clip: "OverhandThrow", from: 0.05, to: 1.0, speed: 1.2, pose: "cast", hits: [{ t: 0.32, mul: 0.9, shape: { k: "rain", n: 9, r: 3.2 } }] },
  },
  staff: {
    style: S("Trượng Fourier — sóng tròn, nhát 3 chồng chập 3 vòng", "Fourier staff — ring waves, hit 3 stacks 3 rings"),
    tip: S("Sóng nở ra trước mặt 2–3 m: đứng giữa tầm, đừng áp sát. Giữ chuột: Sóng Dừng quanh mình.", "Waves bloom 2–3 m ahead: fight at mid range. Hold: Standing Wave around you."),
    chain: [
      { name: S("Sóng đơn", "Pulse"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.2, pose: "cast", hits: [{ t: 0.15, mul: 1.0, shape: { k: "wave", fwd: 2.2, r: 2.4, rings: 1 } }] },
      { name: S("Sóng ném", "Thrown wave"), clip: "OverhandThrow", from: 0.1, to: 0.7, speed: 1.3, pose: "cast", hits: [{ t: 0.32, mul: 1.0, shape: { k: "wave", fwd: 3.2, r: 2.0, rings: 1 } }] },
      { name: S("Chồng chập", "Superposition"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.95, pose: "cast", hits: [{ t: 0.15, mul: 1.7, shape: { k: "wave", fwd: 2.4, r: 3.2, rings: 3 }, shake: 0.15 }] },
    ],
    charged: { name: S("Sóng dừng", "Standing wave"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.7, pose: "cast", hits: [{ t: 0.15, mul: 2.2, shape: { k: "wave", fwd: 0, r: 4.5, rings: 4 }, shake: 0.2, push: 6 }] },
    skill: { name: S("Biến đổi Fourier", "Fourier transform"), clip: "OverhandThrow", from: 0.05, to: 1.0, speed: 1.0, pose: "cast", hits: [{ t: 0.32, mul: 2.4, shape: { k: "wave", fwd: 0, r: 6, rings: 3 }, shake: 0.3, push: 7 }] },
  },
  pendulum: {
    style: S("Con lắc — ném quả lắc quay quanh, nhát 3 con lắc kép", "Pendulum — thrown bobs orbit you, hit 3 is a double pendulum"),
    tip: S("Quả lắc quét vòng 1,4 s: đánh xong hãy kéo quái vào vòng quét. Giữ chuột: Quét Foucault.", "Bobs sweep for 1.4 s: lure foes into the sweep. Hold: Foucault sweep."),
    chain: [
      { name: S("Ném lắc", "Bob throw"), clip: "OverhandThrow", from: 0.1, to: 0.7, speed: 1.3, pose: "cast", hits: [{ t: 0.32, mul: 0.9, shape: { k: "orbit", kind: "pendulum", dur: 1400 } }] },
      { name: S("Giật dây", "Tug"), clip: "Melee_Hook", from: 0, to: 0.47, speed: 1.2, pose: "slash", hits: [{ t: 0.23, mul: 1.0, shape: { k: "arc", range: 2.6, arc: 2.2 }, fx: "slash" }] },
      { name: S("Con lắc kép", "Double pendulum"), clip: "OverhandThrow", from: 0.1, to: 0.8, speed: 1.1, pose: "cast", hits: [{ t: 0.32, mul: 0.9, shape: { k: "orbit", kind: "pendulum", dur: 1800, count: 2 } }] },
    ],
    charged: { name: S("Quét Foucault", "Foucault sweep"), clip: "Sword_Regular_C", from: 0.3, to: 1.1, speed: 1.0, pose: "slash", hits: [{ t: 0.63, mul: 2.2, shape: { k: "circle", fwd: 0, r: 3.4 }, fx: "nova", push: 6 }] },
    skill: { name: S("Trường dao động", "Oscillator field"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.9, pose: "cast", hits: [{ t: 0.15, mul: 1.0, shape: { k: "orbit", kind: "pendulum", dur: 4000, count: 3 } }] },
  },
  coil: {
    style: S("Cuộn cảm — sét lan, nhát 3 lan 5 quái", "Coil — chain lightning, hit 3 jumps 5 foes"),
    tip: S("Sét nhảy từ quái gần nhất sang quái kế bên: gom quái lại rồi mới đánh nhát 3. Giữ chuột: Quá tải.", "Lightning hops to the next nearest foe: group them before hit 3. Hold: Overload."),
    chain: [
      { name: S("Phóng điện", "Zap"), clip: "Punch_Jab", from: 0, to: 0.5, speed: 1.3, pose: "cast", hits: [{ t: 0.13, mul: 1.0, shape: { k: "chain", hops: 2, range: 8 } }] },
      { name: S("Phóng kép", "Double zap"), clip: "Punch_Cross", from: 0.02, to: 0.55, speed: 1.3, pose: "cast", hits: [{ t: 0.17, mul: 1.0, shape: { k: "chain", hops: 2, range: 8 } }] },
      { name: S("Sét lan", "Chain bolt"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.05, pose: "cast", hits: [{ t: 0.15, mul: 1.5, shape: { k: "chain", hops: 5, range: 10 }, shake: 0.12 }] },
    ],
    charged: { name: S("Quá tải", "Overload"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.75, pose: "cast", hits: [{ t: 0.15, mul: 2.0, shape: { k: "circle", fwd: 0, r: 4.0 }, fx: "nova", shake: 0.2 }] },
    skill: { name: S("Trường Tesla", "Tesla field"), clip: "OverhandThrow", from: 0.05, to: 1.0, speed: 1.0, pose: "cast", hits: [{ t: 0.32, mul: 1.2, shape: { k: "chain", hops: 6, range: 12 } }, { t: 0.5, mul: 1.2, shape: { k: "chain", hops: 6, range: 12 } }] },
  },
  prism: {
    style: S("Lăng kính — tia xuyên thấu, mỗi nhát thêm tia", "Prism — piercing beams, each hit adds beams"),
    tip: S("Tia xuyên mọi quái trên đường: xếp quái thành hàng. Nhát 4 tán bảy sắc. Giữ chuột: Hội tụ.", "Beams pierce everything in line: line foes up. Hit 4 fans seven colours. Hold: Focus."),
    chain: [
      { name: S("Tia đơn", "Ray"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.4, pose: "cast", hits: [{ t: 0.12, mul: 1.0, shape: { k: "beams", n: 1, spread: 0, len: 10 } }] },
      { name: S("Tia đôi", "Twin rays"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.4, pose: "cast", hits: [{ t: 0.12, mul: 0.7, shape: { k: "beams", n: 2, spread: 0.18, len: 10 } }] },
      { name: S("Khúc xạ", "Refraction"), clip: "OverhandThrow", from: 0.1, to: 0.65, speed: 1.3, pose: "cast", hits: [{ t: 0.32, mul: 0.7, shape: { k: "beams", n: 3, spread: 0.32, len: 11 } }] },
      { name: S("Tán sắc", "Dispersion"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 1.1, pose: "cast", hits: [{ t: 0.12, mul: 0.5, shape: { k: "beams", n: 7, spread: 0.9, len: 12 }, shake: 0.12 }] },
    ],
    charged: { name: S("Hội tụ", "Focus"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.8, pose: "cast", hits: [{ t: 0.12, mul: 2.6, shape: { k: "beams", n: 1, spread: 0, len: 16 }, shake: 0.15 }] },
    skill: { name: S("Cầu vồng", "Rainbow"), clip: "Sword_Regular_C", from: 0.3, to: 1.1, speed: 1.0, pose: "cast", hits: [{ t: 0.63, mul: 1.1, shape: { k: "beams", n: 12, spread: Math.PI * 2, len: 9 }, shake: 0.2 }] },
  },
};

MOVESETS.lance = {
  style: S("Giáo Sin — đâm phóng sóng, đỉnh sóng ×1,5", "Sine lance — wave thrusts, crests hit ×1.5"),
  tip: S(
    "Đỉnh sóng nằm ở s = λ/4, 3λ/4… (chấm sáng trên đất): đổi λ (X) cho đỉnh rơi đúng quái. Giữ chuột để tăng biên độ A rồi thả. Thả sóng thứ hai đúng sau một chu kỳ T (kim pha ở đỉnh) → hai sóng cùng pha cộng lại; lệch nửa chu kỳ → triệt tiêu.",
    "Crests sit at s = λ/4, 3λ/4… (glowing dots on the ground): change λ (X) so a crest lands on the foe. Hold to raise the amplitude A, then release. Release a second wave exactly one period T later (phase needle at the top) → in phase, they add up; half a period off → they cancel.",
  ),
  chain: [
    { name: S("Đâm sin", "Sine thrust"), clip: "Punch_Jab", from: 0, to: 0.5, speed: 1.2, lunge: 0.4, pose: "slash", hits: [{ t: 0.13, mul: 1.0, shape: { k: "sine", len: 3.6, packet: "chain" } }] },
    { name: S("Đâm chéo", "Cross thrust"), clip: "Punch_Cross", from: 0.02, to: 0.55, speed: 1.2, lunge: 0.4, pose: "slash", hits: [{ t: 0.17, mul: 1.05, shape: { k: "sine", len: 3.6, packet: "chain" } }] },
    { name: S("Quét pha", "Phase sweep"), clip: "Sword_Regular_B", from: 0, to: 0.53, speed: 1.2, lunge: 0.3, pose: "slash", hits: [{ t: 0.25, mul: 0.9, shape: { k: "arc", range: 3.0, arc: 2.2 }, fx: "slashFlip" }] },
    { name: S("Đâm cộng hưởng", "Resonant lunge"), clip: "Sword_Dash", from: 0, to: 0.9, speed: 1.1, lunge: 1.2, pose: "slash", hits: [{ t: 0.32, mul: 1.7, shape: { k: "sine", len: 4.2, packet: "chain" }, shake: 0.2, launch: 4 }] },
  ],
  charged: { name: S("Sóng tụ", "Charged wave"), clip: "Punch_Cross", from: 0.02, to: 0.6, speed: 0.9, lunge: 0.3, pose: "slash", hits: [{ t: 0.17, mul: 1.3, shape: { k: "sine", len: 4.2, packet: "charged" }, shake: 0.18 }] },
  skill: { name: S("Sóng dừng", "Standing wave"), clip: "Sword_Regular_C", from: 0.3, to: 1.1, speed: 1.0, pose: "slash", hits: [{ t: 0.63, mul: 1.0, shape: { k: "standing" }, shake: 0.2 }] },
};

MOVESETS.shield = {
  style: S("Khiên Con lắc — đập theo động năng, đỡ ở đáy để phản đòn", "Pendulum shield — bash by kinetic energy, parry at the bottom"),
  tip: S(
    "Chuột phải buông quả lắc từ đỉnh: nó qua đáy sau T/4 rồi cứ mỗi T/2. Thấy quái vung đòn thì buông sao cho đòn tới đúng lúc quả lắc ở đáy → đỡ hoàn hảo, hất trả ½mv². Đỡ hoàn hảo liên tiếp = cộng hưởng, biên độ lớn dần. Đổi dây L (X): dây dài chậm nhưng mạnh. Giữ chuột trái: giải phóng năng lượng.",
    "Right mouse releases the bob from the top: it passes the bottom after T/4, then every T/2. When a foe winds up, release so the hit lands while the bob is at the bottom → perfect parry, ½mv² thrown back. Chain perfect parries = resonance, the swing grows. Change the chain L (X): longer is slower but stronger. Hold left mouse: release the stored energy.",
  ),
  chain: [
    { name: S("Đập lắc", "Bob bash"), clip: "Shield_OneShot", from: 0, to: 0.83, speed: 1.25, lunge: 0.4, pose: "slash", hits: [{ t: 0.3, mul: 1.0, shape: { k: "bob", range: 2.4, arc: 2.0 }, fx: "slash" }] },
    { name: S("Vung ngược", "Back swing"), clip: "Melee_Hook", from: 0, to: 0.47, speed: 1.2, lunge: 0.3, pose: "slash", hits: [{ t: 0.23, mul: 1.05, shape: { k: "bob", range: 2.6, arc: 2.2 }, fx: "slashFlip" }] },
    { name: S("Con lắc nện", "Pendulum slam"), clip: "Sword_Regular_C", from: 0.3, to: 1.0, speed: 1.1, lunge: 0.4, pose: "slash", hits: [{ t: 0.63, mul: 1.6, shape: { k: "bob", range: 2.9, arc: 2.6 }, fx: "nova", shake: 0.25, push: 7, launch: 5 }] },
  ],
  charged: { name: S("Giải phóng cộng hưởng", "Resonance release"), clip: "Shield_Dash", from: 0, to: 0.8, speed: 1.1, lunge: 1.5, pose: "slash", hits: [{ t: 0.3, mul: 1.0, shape: { k: "release" }, shake: 0.35 }] },
  skill: { name: S("Dao động cưỡng bức", "Driven oscillation"), clip: "Spell_Simple_Shoot", from: 0, to: 0.5, speed: 0.8, pose: "cast", hits: [{ t: 0.15, mul: 0.9, shape: { k: "drive", pulses: 3 } }] },
};

// ───────────── Chấm nhịp ─────────────

/** Chuỗi bỏ lỡ: hết đòn quá chừng này (ms) chưa bấm thì quay về nhát 1 */
export const GRACE_MS = 350;
/** Cửa sổ "Nhịp hoàn hảo" tính từ khung trúng cuối của nhát (ms) */
export const PERFECT_FROM = 60;
export const PERFECT_TO = 260;
/** Bấm quá chừng này lần trong một nhát = loạn nhịp */
export const MASH_LIMIT = 3;
/** Giữ chuột lâu hơn chừng này (ms) = đòn tụ lực */
export const HOLD_MS = 380;

export interface MoveTimes {
  /** mốc trúng (ms kể từ đầu nhát) */
  hits: number[];
  end: number;
  /** từ đây bấm là nối nhát ngay (trước đó: xếp hàng) */
  linkOpen: number;
  perfectFrom: number;
  perfectTo: number;
  /** từ đây né được (huỷ pha thu thế) */
  cancelFrom: number;
}

export function moveTimes(m: Move, speedMul = 1): MoveTimes {
  const sp = m.speed * speedMul;
  const ms = (t: number) => Math.max(0, ((t - m.from) / sp) * 1000);
  const hits = m.hits.map((h) => ms(h.t));
  const end = ms(m.to);
  const last = hits.length ? Math.max(...hits) : end * 0.5;
  return { hits, end, linkOpen: last + 40, perfectFrom: last + PERFECT_FROM, perfectTo: Math.min(last + PERFECT_TO, end + GRACE_MS), cancelFrom: last + 60 };
}

export type Judge = "early" | "perfect" | "link" | "late";

/** Chấm một lần bấm khi đang ở nhát có mốc `tm`, `elapsed` ms sau khi nhát bắt đầu */
export function judge(elapsed: number, tm: MoveTimes): Judge {
  if (elapsed < tm.linkOpen) return "early";
  if (elapsed >= tm.perfectFrom && elapsed <= tm.perfectTo) return "perfect";
  if (elapsed <= tm.end + GRACE_MS) return "link";
  return "late";
}

/** Nhát kế trong chuỗi (vòng lại sau nhát cuối) */
export function nextStep(step: number, len: number): number {
  return (step + 1) % Math.max(1, len);
}

/** Hệ số sát thương theo số Nhịp liên tiếp (≥ 3 Nhịp: nhát kết cường hoá) */
export function rhythmMul(perfect: boolean, streak: number, finisher: boolean): number {
  let m = perfect ? 1.35 : 1;
  if (finisher && streak >= 3) m *= 1.5;
  return m;
}
