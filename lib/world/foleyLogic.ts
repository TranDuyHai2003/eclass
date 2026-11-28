/**
 * Âm bước chân — LOGIC THUẦN (test được): mặt đất theo cảnh / khối dưới chân, bộ đếm sải chân.
 */
export type Surface = "grass" | "stone" | "wood" | "paper" | "sand" | "snow" | "leaf" | "crystal";

const BLOCK_SURFACE: Record<string, Surface> = {
  grass: "grass",
  dirt: "grass",
  moss: "grass",
  leaf: "leaf",
  blossom: "leaf",
  pine: "leaf",
  stone: "stone",
  ruin: "stone",
  copper: "stone",
  intcrystal: "crystal",
  crystal: "crystal",
  glass: "crystal",
  gold: "stone",
  sand: "sand",
  snow: "snow",
  wood: "wood",
  plank: "wood",
  rope: "wood",
  bench: "wood",
};

/** Mặt đất dưới chân: khối voxel (Vùng Mở rộng) nếu biết, không thì theo cảnh */
export function surfaceFor(scene: string, block?: string | null): Surface {
  if (block && BLOCK_SURFACE[block]) return BLOCK_SURFACE[block];
  switch (scene) {
    case "hub":
    case "valley":
    case "expanse":
    case "coast":
      return "grass";
    case "siren":
      return "paper";
    case "study":
    case "babel":
    case "bazaar":
      return "wood";
    case "paradox":
    case "torus":
      return "crystal";
    default:
      return "stone";
  }
}

/**
 * Bộ đếm sải: cộng quãng đường ngang khi đang đứng trên đất; đủ một sải (0,75 m đi bộ → 1,05 m chạy) thì phát một bước.
 * Dịch chuyển tức thời (> 3 m trong một nhịp) / tốc độ vô lý bị bỏ qua.
 */
export class StrideCounter {
  acc = 0;
  speed = 0;
  step(dx: number, dz: number, dt: number, grounded: boolean): boolean {
    const d = Math.hypot(dx, dz);
    if (!grounded || dt <= 0 || d > 3) {
      this.acc = grounded ? this.acc : 0.5;
      return false;
    }
    const v = d / dt;
    this.speed = v;
    if (v < 0.6 || v > 16) {
      if (v < 0.6) this.acc = Math.min(this.acc, 0.5);
      return false;
    }
    this.acc += d;
    const stride = v > 5 ? 1.05 : 0.75;
    if (this.acc >= stride) {
      this.acc -= stride;
      return true;
    }
    return false;
  }
}
