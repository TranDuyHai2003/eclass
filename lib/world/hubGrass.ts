/**
 * Gieo lá cỏ cho bồn cỏ Quảng trường (thuần, không three) — theo nghiên cứu Genshin / Ghost of Tsushima (Codex 2026-11):
 *  • phân bố theo CỤM, mật độ thay đổi theo mảng (dày ~12 lá/m² sát lối đi, thưa ~2 lá/m² phía trong) thay vì rải đều;
 *  • lá trong cụm chia sẻ hướng nghiêng (±25°), độ cao, sắc độ (±10%); mỗi lá lệch thêm ±3%;
 *  • 3 dáng: thẳng / cong / xoè; cao 12–32 cm, 7% lá vượt 35–45 cm; rộng gốc 2,5–5 cm; ngọn lệch 0,15–0,65 × cao.
 * Đầu ra theo 12 hình quạt (để three cắt bỏ cụm ngoài khung nhìn): mỗi lá = 8 số
 *   [x, z, vườn? 1 : 0, yaw, cao, rộng, nghiêng, sắc độ].
 */
import { GARDEN, PATH_HALF, isBed, pathDistance } from "./hubLayout";

export const BLADE_STRIDE = 8;
export const N_SECT = 12;

/** trường mảng mượt (0…1): chỗ cỏ dày ↔ khoảng thưa */
export function patchField(x: number, z: number): number {
  const a = Math.sin(x * 0.42 + Math.sin(z * 0.31) * 1.7) * Math.cos(z * 0.37 + Math.sin(x * 0.27) * 1.3);
  const b = Math.sin(x * 1.13 - z * 0.71 + 2.1) * 0.35;
  return Math.min(1, Math.max(0, 0.5 + 0.5 * (a * 0.8 + b)));
}

const inGarden = (x: number, z: number, m = 0.3) => Math.hypot(x - GARDEN.x, z - GARDEN.z) < GARDEN.r - m;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function grassBlades(count: number, seed = 13): Float32Array[] {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const per: number[][] = Array.from({ length: N_SECT }, () => []);
  let made = 0;
  let tries = 0;
  while (made < count && tries < count * 6) {
    tries++;
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 34;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const garden = inGarden(cx, cz);
    if (!garden && !isBed(cx, cz)) continue;
    // xác suất giữ tâm cụm: mảng dày + sát lối đi (người chơi nhìn gần nhất)
    const nearPath = garden ? 0.5 : smooth(PATH_HALF + 3, PATH_HALF + 0.3, pathDistance(cx, cz));
    const keep = 0.12 + 0.88 * Math.max(smooth(0.35, 0.7, patchField(cx, cz)), nearPath * 0.8);
    if (r() > keep) continue;
    const shape = r(); // < 0,4 thẳng, < 0,8 cong, còn lại xoè
    const n = 8 + Math.floor(r() * 13);
    const rad = 0.22 + r() * 0.22;
    const yaw0 = r() * Math.PI * 2;
    const h0 = 0.12 + r() * 0.2;
    const shade = (r() - 0.5) * 0.2;
    for (let k = 0; k < n && made < count; k++) {
      const ba = r() * Math.PI * 2;
      const br = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(ba) * br;
      const z = cz + Math.sin(ba) * br;
      const g = inGarden(x, z);
      if (!g && !isBed(x, z)) continue;
      const tall = r() < 0.07;
      const h = tall ? 0.35 + r() * 0.1 : Math.min(0.32, Math.max(0.12, h0 * (0.75 + r() * 0.5)));
      const w = 0.025 + r() * 0.025;
      let yaw: number;
      let lean: number;
      if (shape < 0.4) {
        yaw = yaw0 + (r() - 0.5) * 0.87;
        lean = 0.15 + r() * 0.12;
      } else if (shape < 0.8) {
        yaw = yaw0 + (r() - 0.5) * 0.87;
        lean = 0.32 + r() * 0.2;
      } else {
        // xoè: ngả ra xa tâm cụm
        yaw = ba + (r() - 0.5) * 0.6;
        lean = 0.4 + r() * 0.25;
      }
      const sect = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * N_SECT) % N_SECT;
      per[sect].push(x, z, g ? 1 : 0, yaw, h, w, lean, shade + (r() - 0.5) * 0.06);
      made++;
    }
  }
  return per.map((l) => new Float32Array(l));
}
