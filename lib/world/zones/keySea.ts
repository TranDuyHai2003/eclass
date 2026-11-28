/**
 * Khu "Biển Phím Không Bờ" (id keys) — bàn phím sứ khổng lồ 3 quãng tám (C3…B5) nổi trên biển giấy than; đồi phím sứ xa.
 * Luật: lớp cao độ lặp sau 12 bán âm; phím cùng tên ở quãng kế có tần số gấp đôi (f = C3 · 2^(k/12)).
 * Cua Kẹp Quãng kẹp một phím → người chơi đứng lên phím cùng tên ở quãng trên và bấm F; ba vòng đúng → hạ đê sứ.
 * Toạ độ cục bộ (gốc khu: lib/world/zoneGraph.ts). Thuần — test: tests/world/sirenZones.test.ts.
 */
import { zbox, zwall, type ZSurf, type ZoneColliders } from "./types";

export const KEYS_HALF = { x: 55, z: 35 };
/** 36 bán âm: k = 0 → C3 */
export const KEY_N = 36;
export const C3 = 130.81;
export const keyFreq = (k: number) => C3 * Math.pow(2, k / 12);
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
export const isBlack = (k: number) => !WHITE_PC.includes(((k % 12) + 12) % 12);
export const pitchClass = (k: number) => ((k % 12) + 12) % 12;
export const octaveOf = (k: number) => 3 + Math.floor(k / 12);
export const NOTE_VI = ["Đô", "Đô♯", "Rê", "Rê♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
export const NOTE_EN = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (k: number, lang: "vi" | "en") => `${(lang === "vi" ? NOTE_VI : NOTE_EN)[pitchClass(k)]}${octaveOf(k)}`;

/** Phím trắng rộng W (dọc x), dài LEN (dọc z, từ −LEN/2 tới +LEN/2); phím đen cao hơn 0,5 m, phần phía bắc */
export const KB = { x0: -36, W: 3.4, LEN: 9, blackW: 2.1, blackZ0: -4.5, blackZ1: 1, blackTop: 0.5, top: 0 };
/** chỉ số phím trắng (0…20) của bán âm trắng k */
export function whiteIndex(k: number): number {
  let n = 0;
  for (let i = 0; i < k; i++) if (!isBlack(i)) n++;
  return n;
}
/** tâm x của phím k (phím đen: nằm trên ranh giữa hai phím trắng kề) */
export function keyX(k: number): number {
  return isBlack(k) ? KB.x0 + whiteIndex(k) * KB.W : KB.x0 + (whiteIndex(k) + 0.5) * KB.W;
}
export const WHITE_COUNT = whiteIndex(KEY_N);
export const KB_X1 = KB.x0 + WHITE_COUNT * KB.W;

/** Phím dưới (x, z) — phím đen ưu tiên (cao hơn); −1 nếu ngoài bàn phím */
export function keyAt(x: number, z: number): number {
  if (Math.abs(z) > KB.LEN / 2 || x < KB.x0 || x > KB_X1) return -1;
  if (z >= KB.blackZ0 && z <= KB.blackZ1)
    for (let k = 0; k < KEY_N; k++) if (isBlack(k) && Math.abs(x - keyX(k)) <= KB.blackW / 2) return k;
  const wi = Math.floor((x - KB.x0) / KB.W);
  let n = 0;
  for (let k = 0; k < KEY_N; k++)
    if (!isBlack(k)) {
      if (n === wi) return k;
      n++;
    }
  return -1;
}

/** Bến đầu (cửa từ hub), đê sứ (khoá), bến cuối (cửa Phòng Chờ) */
export const PIER_W = { x: -44, hx: 8, hz: 6 };
export const DIKE = { x: KB_X1 + 1.2, hz: 8, h: 5 };
export const PIER_E = { x: KB_X1 + 9.5, hx: 7.5, hz: 6 };
/** Cua Kẹp Quãng: đứng cạnh bàn phím phía nam */
export const CRAB_Z = 7.2;

/** Ba vòng: phím cua kẹp (đáp án = cùng tên ở quãng trên) */
export const OCTAVE_ROUNDS: readonly number[] = [4, 9, 14];
export const octaveTarget = (k: number) => k + 12;
export const isOctave = (a: number, b: number) => b - a === 12;

/** Mặt động: ZONE_DYN[KEY_DYN0 + k] = độ lún của phím k (m) */
export const KEY_DYN0 = 0;

const keySurfs: ZSurf[] = [];
for (let k = 0; k < KEY_N; k++) {
  if (isBlack(k)) keySurfs.push({ ...zbox(`key${k}`, keyX(k), KB.blackTop, (KB.blackZ0 + KB.blackZ1) / 2, KB.blackW / 2, (KB.blackZ1 - KB.blackZ0) / 2, 1.4, 0, `key:${k}`), dyn: KEY_DYN0 + k });
  else keySurfs.push({ ...zbox(`key${k}`, keyX(k), KB.top, 0, KB.W / 2 + 0.01, KB.LEN / 2, 1.2, 0, `key:${k}`), dyn: KEY_DYN0 + k });
}

export const KEYS_COLLIDERS: ZoneColliders = {
  surfs: [zbox("pierW", PIER_W.x, 0, 0, PIER_W.hx, PIER_W.hz, 1.5), zbox("pierE", PIER_E.x, 0, 0, PIER_E.hx, PIER_E.hz, 1.5), zbox("dikeFloor", DIKE.x, 0, 0, 1.3, 4.5, 1.2), ...keySurfs],
  walls: [
    // đê sứ: chặn tới khi giải xong (cờ "dike")
    zwall("dike", DIKE.x, 0, 0.6, DIKE.hz, -2, DIKE.h, 0, "dike"),
  ],
  cyls: [],
};

/** Mặt biển giấy than (dưới mặt phím) — chân xuống dưới mức này = chìm, kéo về chỗ đứng an toàn */
export const SEA_Y = -1.1;
