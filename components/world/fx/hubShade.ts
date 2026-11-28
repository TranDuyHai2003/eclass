"use client";
/**
 * Quảng trường kiểu Genshin — ánh sáng "mặt đất" dùng chung cho sàn đá, cỏ, khóm hoa (docs/ai-reviews/hub-genshin/PLAN.md):
 *  • uHubContact (tĩnh, 512² trên 80 m ≈ 16 cm/texel): AO tiếp xúc dưới gốc cây, chân đèn, ghế, trụ cổng, cột, bồn đài phun, thành hồ
 *    → vật "đứng" trên sân thay vì trôi (máy yếu không có bóng thời gian thực);
 *  • uHubShadow (động, 256² ≈ 31 cm/texel): bóng tán cây GIẢI TÍCH theo hướng nắng thật (DAY.light) — elip dài h·cot(cao độ)
 *    ngược nắng + vệt thân; vẽ lại bằng canvas CHỈ khi mặt trời dịch > 0,4° (giờ thật đổi chậm → vài phút một lần);
 *    shader lốm đốm nắng xuyên lá bằng noise; tắt dần khi tắt nắng (đêm).
 *  • texture vẽ tay (Codex, scripts/hub-genshin-art.py): vân đá sa thạch, thảm cỏ.
 * Không thêm lệnh vẽ. Texture là singleton module (như noiseTex) — không tạo lại mỗi lần vào cảnh.
 */
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { COLLIDERS, NPC, POOL } from "@/lib/world/hubLayout";
import { TREE_CASTERS, shadowCenter } from "@/lib/world/hubFlora";
import { DAY } from "./dayState";

const SPAN = 80;

let stone: THREE.Texture | null = null;
let lawn: THREE.Texture | null = null;
function tex(name: string, srgb: boolean) {
  const t = new THREE.TextureLoader().load(worldAsset(`fx/tex/hub/${name}`));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
/** vân đá vẽ tay: hệ số nhân quanh 1 (lưu 0,5 = không đổi) */
export const stonePaintTex = () => (stone ??= tex("stone_paint.jpg", false));
/** thảm cỏ vẽ tay (sRGB) */
export const lawnPaintTex = () => (lawn ??= tex("grass_paint.jpg", true));

let contact: THREE.CanvasTexture | null = null;
/** AO tiếp xúc tĩnh: R = độ sáng còn lại (1 = không che) */
export function contactTex(): THREE.Texture {
  if (contact) return contact;
  const N = 512;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, N, N);
  const k = N / SPAN;
  const blob = (x: number, z: number, r: number, a: number) => {
    const px = (x + SPAN / 2) * k;
    const pz = (z + SPAN / 2) * k;
    const gr = g.createRadialGradient(px, pz, 0, px, pz, r * k);
    gr.addColorStop(0, `rgba(0,0,0,${a})`);
    gr.addColorStop(0.45, `rgba(0,0,0,${a * 0.55})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(px - r * k, pz - r * k, 2 * r * k, 2 * r * k);
  };
  const npc = Object.values(NPC);
  for (const col of COLLIDERS) {
    if (npc.some((n) => n.x === col.x && n.z === col.z)) continue; // NPC có bóng riêng
    blob(col.x, col.z, Math.max(0.6, col.r * 2.1), col.r > 1.2 ? 0.32 : 0.5);
  }
  // chân thành hồ: dải tối mềm ngay ngoài vành
  const cx = (SPAN / 2) * k;
  const ring = g.createRadialGradient(cx, cx, POOL.rim * k, cx, cx, (POOL.rim + 1.3) * k);
  ring.addColorStop(0, "rgba(0,0,0,0.42)");
  ring.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = ring;
  g.beginPath();
  g.arc(cx, cx, (POOL.rim + 1.3) * k, 0, Math.PI * 2);
  g.arc(cx, cx, POOL.rim * k, 0, Math.PI * 2, true);
  g.fill();
  contact = new THREE.CanvasTexture(c);
  contact.flipY = false;
  contact.colorSpace = THREE.NoColorSpace;
  return contact;
}

let shadow: { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; last: THREE.Vector3 } | null = null;
const L3: [number, number, number] = [0, 1, 0];
/** bóng tán (R = độ che 0…1) theo hướng nắng hiện tại; gọi updateHubShadow() định kỳ */
export function shadowTex(): THREE.Texture {
  if (shadow) return shadow.tex;
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  shadow = { tex: t, g, last: new THREE.Vector3(0, -9, 0) };
  updateHubShadow(true);
  return t;
}
/** vẽ lại bóng khi mặt trời dịch > ~0,4° (rẻ: 16 elip trên canvas 256², tải lên GPU 256 KB) */
export function updateHubShadow(force = false) {
  if (!shadow) return;
  const L = DAY.light.value;
  if (!force && L.dot(shadow.last) > 0.99997) return;
  shadow.last.copy(L);
  const { g } = shadow;
  const N = g.canvas.width;
  const k = N / SPAN;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#000";
  g.fillRect(0, 0, N, N);
  L3[0] = L.x;
  L3[1] = L.y;
  L3[2] = L.z;
  const el = Math.max(L.y, 0.38);
  const az = Math.atan2(L.z, L.x);
  g.filter = "blur(1.2px)";
  for (const tc of TREE_CASTERS) {
    const [sx, sz] = shadowCenter(tc, L3);
    // thân: vệt từ gốc tới nửa đường bóng tán
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineCap = "round";
    g.lineWidth = Math.max(1.5, 0.16 * tc[2] * k);
    g.beginPath();
    g.moveTo((tc[0] + SPAN / 2) * k, (tc[1] + SPAN / 2) * k);
    g.lineTo((tc[0] + (sx - tc[0]) * 0.55 + SPAN / 2) * k, (tc[1] + (sz - tc[1]) * 0.55 + SPAN / 2) * k);
    g.stroke();
    // tán: elip kéo dài theo phương nắng (trục lớn R / sin(cao độ))
    g.setTransform(1, 0, 0, 1, (sx + SPAN / 2) * k, (sz + SPAN / 2) * k);
    g.rotate(az);
    g.scale(1 / el, 1);
    const r = tc[2] * k;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.62, "rgba(255,255,255,0.85)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = "none";
  g.setTransform(1, 0, 0, 1, 0, 0);
  shadow.tex.needsUpdate = true;
}

/** uniform dùng chung (gắn thẳng vào vật liệu sàn / cỏ / hoa) */
export function hubShadeUniforms() {
  return {
    uHubContact: { value: contactTex() },
    uHubShadow: { value: shadowTex() },
    uHubSunK: DAY.sunK,
    uHubSunDir: DAY.sun,
  };
}

/**
 * GLSL: hubGold() — mức "giờ vàng" 0…1; hubContact(p) — AO tiếp xúc (1 = sáng); hubShadow(p, n) — độ che nắng của tán (0…1) đã lốm đốm + tắt theo nắng.
 * p = (x, z) thế giới; n = giá trị noise 0…1 (truyền từ noise texture của vật liệu) cho đốm nắng.
 */
export const HUB_SHADE_GLSL = /* glsl */ `
  uniform sampler2D uHubContact; uniform sampler2D uHubShadow; uniform float uHubSunK; uniform vec3 uHubSunDir;
  // giờ vàng: nắng thấp (cao độ ~3°–25°) còn chiếu → mặt đất ngả vàng ấm (Genshin hoàng hôn: sáng vàng, bóng lam)
  float hubGold(){ return smoothstep(0.45, 0.1, uHubSunDir.y) * smoothstep(-0.03, 0.06, uHubSunDir.y) * smoothstep(0.03, 0.2, uHubSunK); }
  float hubContact(vec2 p){ return texture2D(uHubContact, p / ${SPAN.toFixed(1)} + 0.5).r; }
  float hubShadow(vec2 p, float n){
    float s = texture2D(uHubShadow, p / ${SPAN.toFixed(1)} + 0.5).r;
    // đốm nắng xuyên lá: lỗ sáng rải trong bóng (mạnh ở giữa bóng, mép vẫn mềm)
    s *= 1.0 - 0.55 * smoothstep(0.58, 0.74, n) * smoothstep(0.35, 0.8, s);
    return s * smoothstep(0.03, 0.22, uHubSunK);
  }
`;
