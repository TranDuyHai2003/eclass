// SINH TỰ ĐỘNG bởi scripts/siren-zones.py — đừng sửa tay.
/** Khung uv (u0, v0, u1, v1 — v từ dưới lên) + tỉ lệ rộng / cao thật của từng hình cắt trong public/world/siren/zones_cut.webp */
export const CUT = {
  ticket_machine: { uv: [0.07568, 0.75391, 0.17383, 0.99609] as const, aspect: 0.4056 },
  ticket: { uv: [0.25391, 0.80713, 0.49609, 0.94336] as const, aspect: 1.7775 },
  chair: { uv: [0.55225, 0.75391, 0.69727, 0.99609] as const, aspect: 0.5995 },
  board: { uv: [0.75391, 0.76367, 0.99609, 0.98633] as const, aspect: 1.0873 },
  curtain: { uv: [0.05859, 0.50391, 0.19092, 0.74609] as const, aspect: 0.5461 },
  beetle_a: { uv: [0.25391, 0.55029, 0.49609, 0.70020] as const, aspect: 1.6137 },
  beetle_b: { uv: [0.50391, 0.54785, 0.74609, 0.70264] as const, aspect: 1.5636 },
  tower: { uv: [0.83154, 0.50391, 0.91846, 0.74609] as const, aspect: 0.3593 },
  crab_a: { uv: [0.00391, 0.26758, 0.24609, 0.48291] as const, aspect: 1.1247 },
  crab_b: { uv: [0.25391, 0.26758, 0.49609, 0.48242] as const, aspect: 1.1277 },
  door: { uv: [0.54590, 0.25391, 0.70361, 0.49609] as const, aspect: 0.6517 },
  shadow: { uv: [0.75391, 0.32500, 0.99609, 0.42500] as const, aspect: 2.4219 },
} as const;
export type CutName = keyof typeof CUT;
