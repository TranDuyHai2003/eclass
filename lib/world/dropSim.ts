/**
 * G4 — Thực thể đồ rơi: bể cố định (mảng kiểu SoA, KHÔNG cấp phát khi chạy), giới hạn số lượng, gộp chồng gần nhau,
 * nam châm hút về người chơi, nhặt = một giao dịch túi đồ (nhận một phần thì phần còn lại vẫn nằm đất).
 * Thuần: va chạm qua hàm solid(x, y, z) và nhặt qua hàm take(item, n) → số đã nhận.
 */

export const DROP_CAP = 64;
const GRAV = 20;
const HALF = 0.14; // nửa cạnh khối đồ rơi (m)
const MERGE_R = 1.25;
const MAGNET_R = 2.6;
const PICK_R = 0.75;
const PICK_DELAY = 0.45; // giây sau khi rơi mới hút (kịp thấy đồ văng ra)
const LIFE = 300;

export class DropPool {
  readonly cap: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly age: Float32Array;
  /** chỉ số vật phẩm (ITEM_INDEX), −1 = ô trống */
  readonly item: Int16Array;
  readonly count: Int32Array;
  /** đang nằm yên trên đất */
  readonly rest: Uint8Array;
  active = 0;
  private mergeT = 0;

  constructor(cap = DROP_CAP) {
    this.cap = cap;
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.pz = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.vz = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.item = new Int16Array(cap).fill(-1);
    this.count = new Int32Array(cap);
    this.rest = new Uint8Array(cap);
  }

  /**
   * Thả n vật phẩm tại (x, y, z) với vận tốc ban đầu. Gộp vào chồng cùng loại trong MERGE_R (không vượt maxStack);
   * bể đầy → thay chồng già nhất (đồ rơi lâu nhất mất trước — giới hạn cứng để không lag). Trả chỉ số ô.
   */
  spawn(item: number, n: number, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0, maxStack = 64): number {
    for (let i = 0; i < this.cap; i++) {
      if (this.item[i] !== item || this.count[i] + n > maxStack) continue;
      const dx = this.px[i] - x;
      const dy = this.py[i] - y;
      const dz = this.pz[i] - z;
      if (dx * dx + dy * dy + dz * dz < MERGE_R * MERGE_R) {
        this.count[i] += n;
        return i;
      }
    }
    let slot = -1;
    let oldest = -1;
    for (let i = 0; i < this.cap; i++) {
      if (this.item[i] < 0) {
        slot = i;
        break;
      }
      if (oldest < 0 || this.age[i] > this.age[oldest]) oldest = i;
    }
    if (slot < 0) slot = oldest;
    else this.active++;
    this.item[slot] = item;
    this.count[slot] = n;
    this.px[slot] = x;
    this.py[slot] = y;
    this.pz[slot] = z;
    this.vx[slot] = vx;
    this.vy[slot] = vy;
    this.vz[slot] = vz;
    this.age[slot] = 0;
    this.rest[slot] = 0;
    return slot;
  }

  free(i: number) {
    if (this.item[i] < 0) return;
    this.item[i] = -1;
    this.count[i] = 0;
    this.active--;
  }

  /**
   * Một bước mô phỏng. Người chơi đứng ở (qx, qy, qz) (chân). room(item) → còn chứa được bao nhiêu (0 = không hút);
   * take(item, n) → số thật sự nhận (một giao dịch túi đồ).
   */
  step(
    dt: number,
    solid: (x: number, y: number, z: number) => boolean,
    qx: number,
    qy: number,
    qz: number,
    room: (item: number) => number,
    take: (item: number, n: number) => number,
    maxStack: (item: number) => number = () => 64,
  ) {
    if (this.active === 0) return;
    if (dt > 0.1) dt = 0.1;
    const cy = qy + 0.8; // tâm thân người chơi
    for (let i = 0; i < this.cap; i++) {
      const it = this.item[i];
      if (it < 0) continue;
      const a = (this.age[i] += dt);
      if (a > LIFE) {
        this.free(i);
        continue;
      }
      const dx = qx - this.px[i];
      const dy = cy - this.py[i];
      const dz = qz - this.pz[i];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (a > PICK_DELAY && d2 < MAGNET_R * MAGNET_R && room(it) > 0) {
        if (d2 < PICK_R * PICK_R) {
          const got = take(it, this.count[i]);
          if (got >= this.count[i]) {
            this.free(i);
            continue;
          }
          this.count[i] -= got;
          // túi vừa đầy: phần còn lại rơi xuống ngay chân, không bay vượt qua người chơi
          this.vx[i] = 0;
          this.vy[i] = 0;
          this.vz[i] = 0;
          continue;
        }
        // hút: vận tốc hướng về người chơi, nhanh dần khi lại gần (bay xuyên khối như Minecraft)
        const d = Math.sqrt(d2) || 1;
        const sp = 4 + (MAGNET_R - d) * 5;
        const k = Math.min(1, dt * 10);
        this.vx[i] += ((dx / d) * sp - this.vx[i]) * k;
        this.vy[i] += ((dy / d) * sp - this.vy[i]) * k;
        this.vz[i] += ((dz / d) * sp - this.vz[i]) * k;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
        this.rest[i] = 0;
        continue;
      }
      // rơi tự do + va chạm sàn / vách đơn giản
      const x = this.px[i];
      const z = this.pz[i];
      if (solid(Math.floor(x), Math.floor(this.py[i]), Math.floor(z))) {
        // bị khối đè lên (vừa đặt khối vào chỗ đồ rơi) → đẩy lên mặt trên
        this.py[i] = Math.floor(this.py[i]) + 1 + HALF;
        this.vy[i] = 0;
      }
      if (this.rest[i]) {
        if (!solid(Math.floor(x), Math.floor(this.py[i] - HALF - 0.05), Math.floor(z))) this.rest[i] = 0; // sàn bị đào mất
        else continue;
      }
      this.vy[i] -= GRAV * dt;
      const nx = x + this.vx[i] * dt;
      const nz = z + this.vz[i] * dt;
      const ny = this.py[i] + this.vy[i] * dt;
      const iy = Math.floor(this.py[i]);
      if (solid(Math.floor(nx), iy, Math.floor(z))) this.vx[i] *= -0.3;
      else this.px[i] = nx;
      if (solid(Math.floor(this.px[i]), iy, Math.floor(nz))) this.vz[i] *= -0.3;
      else this.pz[i] = nz;
      const fy = Math.floor(ny - HALF);
      if (this.vy[i] <= 0 && solid(Math.floor(this.px[i]), fy, Math.floor(this.pz[i]))) {
        this.py[i] = fy + 1 + HALF;
        this.vy[i] = 0;
        this.vx[i] = 0;
        this.vz[i] = 0;
        this.rest[i] = 1;
      } else this.py[i] = ny;
      if (this.py[i] < -64) this.free(i); // rơi khỏi thế giới
    }
    // gộp chồng nằm yên gần nhau (mỗi 0,5 s, O(n²) với n ≤ cap)
    this.mergeT += dt;
    if (this.mergeT < 0.5) return;
    this.mergeT = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.item[i] < 0 || !this.rest[i]) continue;
      for (let j = i + 1; j < this.cap; j++) {
        if (this.item[j] !== this.item[i] || !this.rest[j]) continue;
        if (this.count[i] + this.count[j] > maxStack(this.item[i])) continue;
        const dx = this.px[i] - this.px[j];
        const dy = this.py[i] - this.py[j];
        const dz = this.pz[i] - this.pz[j];
        if (dx * dx + dy * dy + dz * dz < MERGE_R * MERGE_R) {
          this.count[i] += this.count[j];
          if (this.age[j] < this.age[i]) this.age[i] = this.age[j];
          this.free(j);
        }
      }
    }
  }
}
