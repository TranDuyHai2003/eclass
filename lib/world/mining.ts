/**
 * G4 — Đào khối: độ cứng, cấp dụng cụ, thời gian đào, đồ rơi; dò tia KHÔNG cấp phát (gọi mỗi khung).
 * Công thức kiểu Minecraft: lấy được đồ → t = độ cứng × 1,5 / tốc độ; không đủ cấp → t = độ cứng × 5 (và không rơi gì).
 */
import { B } from "./blocks";
import { ITEM_OF_BLOCK, type BlockClass, type ToolDef } from "./itemDefs";

export interface BlockRule {
  hardness: number;
  /** cấp dụng cụ tối thiểu để RƠI đồ */
  tier: number;
  cls: BlockClass;
  /** vật phẩm rơi (mặc định = vật phẩm của chính khối); null = không rơi */
  drop?: string | null;
  /** xác suất rơi (lá cây) */
  chance?: number;
}

const R = (hardness: number, tier: number, cls: BlockClass, extra: Partial<BlockRule> = {}): BlockRule => ({ hardness, tier, cls, ...extra });

export const BLOCK_RULES: Record<number, BlockRule> = {
  [B.grass]: R(0.6, 0, "soil", { drop: "dirt" }),
  [B.dirt]: R(0.5, 0, "soil"),
  [B.sand]: R(0.5, 0, "soil"),
  [B.snow]: R(0.2, 0, "soil"),
  [B.stone]: R(1.5, 1, "stone"),
  [B.crystal]: R(0.8, 0, "stone"),
  [B.gold]: R(2, 1, "stone"),
  [B.wood]: R(2, 0, "wood"),
  [B.plank]: R(2, 0, "wood"),
  [B.leaf]: R(0.2, 0, "plant", { chance: 0.25 }),
  [B.blossom]: R(0.2, 0, "plant", { chance: 0.25 }),
  [B.pine]: R(0.2, 0, "plant", { chance: 0.25 }),
  [B.glass]: R(0.3, 0, "misc"),
  [B.ruin]: R(2, 1, "stone"),
  [B.moss]: R(2, 1, "stone"),
  [B.rope]: R(0.3, 0, "misc"),
  [B.intcrystal]: R(1, 0, "stone", { drop: "int_crystal" }),
  [B.copper]: R(3, 1, "stone", { drop: "ratio_copper" }),
  [B.torch]: R(0, 0, "misc"),
  [B.bench]: R(2.5, 0, "wood"),
  // nước: tia nhắm bỏ qua (isTargetBlock) → không đào được; muốn xoá thì đặt khối đè lên rồi đào khối đó
  [B.water]: R(0, 0, "misc"),
};
const FALLBACK: BlockRule = R(1, 0, "misc");
export const ruleOf = (id: number): BlockRule => BLOCK_RULES[id] ?? FALLBACK;

export const canHarvest = (id: number, tool: ToolDef | null | undefined) => (tool?.tier ?? 0) >= ruleOf(id).tier;

/** Giây để phá khối id bằng dụng cụ tool (null = tay không). Khối độ cứng 0 phá ngay. */
export function breakTime(id: number, tool: ToolDef | null | undefined): number {
  const r = ruleOf(id);
  if (r.hardness <= 0) return 0;
  if (!canHarvest(id, tool)) return r.hardness * 5;
  const speed = tool?.speed[r.cls] ?? 1;
  return (r.hardness * 1.5) / speed;
}

/** Đồ rơi khi phá (rnd ∈ [0, 1) — truyền vào để test tất định) */
export function dropFor(id: number, tool: ToolDef | null | undefined, rnd: number): { id: string; n: number } | null {
  if (id === B.air || !canHarvest(id, tool)) return null;
  const r = ruleOf(id);
  if (r.chance !== undefined && rnd >= r.chance) return null;
  const item = r.drop === undefined ? ITEM_OF_BLOCK[id] : r.drop;
  return item ? { id: item, n: 1 } : null;
}

/**
 * Dò tia qua lưới voxel (Amanatides–Woo) ghi vào out = [x, y, z, nx, ny, nz] — không cấp phát.
 * solid(x, y, z) → true nếu ô chặn tia. Trả về true nếu trúng trong maxDist.
 */
export function raycastInto(
  out: Int32Array,
  solid: (x: number, y: number, z: number) => boolean,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): boolean {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sz = Math.sign(dz);
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx !== 0 ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
  let tmy = dy !== 0 ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
  let tmz = dz !== 0 ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  for (let guard = 0; t <= maxDist && guard < 512; guard++) {
    if (solid(x, y, z)) {
      out[0] = x;
      out[1] = y;
      out[2] = z;
      out[3] = nx;
      out[4] = ny;
      out[5] = nz;
      return true;
    }
    if (tmx < tmy && tmx < tmz) {
      x += sx;
      t = tmx;
      tmx += tdx;
      nx = -sx;
      ny = 0;
      nz = 0;
    } else if (tmy < tmz) {
      y += sy;
      t = tmy;
      tmy += tdy;
      nx = 0;
      ny = -sy;
      nz = 0;
    } else {
      z += sz;
      t = tmz;
      tmz += tdz;
      nx = 0;
      ny = 0;
      nz = -sz;
    }
  }
  return false;
}

/** Ô (x, y, z) có chồng lên thân nhân vật (hộp ±r quanh chân ở (px, py, pz), cao h) không — chặn đặt khối vào người */
export function cellHitsBody(x: number, y: number, z: number, px: number, py: number, pz: number, r = 0.3, h = 1.8): boolean {
  return x < px + r && x + 1 > px - r && z < pz + r && z + 1 > pz - r && y < py + h && y + 1 > py + 0.02;
}

/**
 * Tiến độ đào (một mục tiêu): đổi ô hoặc đổi khối → về 0. step trả true khi vừa phá xong.
 * Tách khỏi React để test: trạng thái là số, không cấp phát.
 */
export class MiningProgress {
  x = NaN;
  y = NaN;
  z = NaN;
  id = -1;
  t = 0;
  need = 1;
  get frac() {
    return this.need <= 0 ? 1 : Math.min(1, this.t / this.need);
  }
  reset() {
    this.x = NaN;
    this.t = 0;
  }
  /** dt giây; need = breakTime hiện tại (đổi dụng cụ giữa chừng → giữ tỉ lệ đã đào) */
  step(x: number, y: number, z: number, id: number, need: number, dt: number): boolean {
    if (x !== this.x || y !== this.y || z !== this.z || id !== this.id) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.id = id;
      this.t = 0;
      this.need = need;
    } else if (need !== this.need) {
      this.t = this.need > 0 ? (this.t / this.need) * need : 0;
      this.need = need;
    }
    this.t += dt;
    if (this.t >= this.need) {
      this.reset();
      return true;
    }
    return false;
  }
}
