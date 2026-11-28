"use client";
/**
 * Khiên Đường tròn Đơn vị (vẽ vòng tròn) — bong bóng HIỆN SUỐT thời gian khiên còn hiệu lực (combat.ts → ward):
 *  • mở: nảy 0 → 1,12 → 1 trong 0,35 s, lưới lục giác "mọc" từ chân lên + một dải sáng quét qua vỏ trong 100 ms (T24);
 *  • thân: viền fresnel BẬC (2 nấc kiểu cel, ngọc bích → ngà), lưới lục giác mảnh thưa, lõi gần trong suốt (thấy nhân vật);
 *  • bị đánh: mảng tiếp xúc loé 90 ms + gợn sóng lan từ phía đòn; còn < 1 s: nhấp nháy báo sắp hết;
 *  • hết: tan rã theo ô (220 ms) — mảnh đặc bong ra do fx/SpellFx.tsx phát.
 * Vòng khép dưới chân (cung = thời gian còn lại) nằm trong pool vòng của fx/SpellFx.tsx.
 * 1 lệnh vẽ, chỉ MẶT TRƯỚC (bớt nửa overdraw so với hai mặt), cộng sáng (không ghi depth).
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ward } from "../combat/combat";
import { useWorld } from "../store";
import { SPELL_PALETTE } from "@/lib/world/spellFx";
import { fxNow } from "./fxClock";

const VS = /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec3 vL;
  void main(){ vL = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = /* glsl */ `uniform vec3 uCol; uniform vec3 uCol2; uniform float uT; uniform float uOpen; uniform float uEnd; uniform float uHit; uniform vec3 uHitDir; uniform float uBlink; uniform float uSweep; uniform float uFloorY;
  varying vec3 vN; varying vec3 vW; varying vec3 vL;
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // khoảng cách tới cạnh lưới lục giác (toạ độ 2D)
  float hexEdge(vec2 p){
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
    vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
    q = abs(q);
    return 0.5 - max(dot(q, s * 0.5), q.x);
  }
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float fr = 1.0 - abs(dot(normalize(vN), V));
    // fresnel BẬC: 2 nấc rõ ràng (cel) thay vì dốc mượt
    float frs = smoothstep(0.5, 0.54, fr) * 0.42 + smoothstep(0.76, 0.8, fr) * 0.58;
    float lon = atan(vL.z, vL.x);
    float lat = asin(clamp(vL.y, -1.0, 1.0));
    vec2 uv = vec2(lon * 3.2, lat * 3.6);
    float e = hexEdge(uv);
    float grid = 1.0 - smoothstep(0.02, 0.06, e);
    float rise = smoothstep(uOpen * 2.4 - 1.2 - 0.15, uOpen * 2.4 - 1.2, vL.y);
    float n = h1(floor(uv * 1.0));
    float gone = step(n, uEnd);
    // dải quét lúc mở (100 ms, chân → đỉnh) + dải quét chậm khi giữ
    // x * x thay pow(x, 2.0) (cơ số âm → NaN trên ANGLE / Metal → đen cả bloom HalfFloat)
    float sw = (vL.y - (uSweep * 2.6 - 1.3)) * 5.0;
    float sweep = uSweep < 1.0 ? exp(-sw * sw) : 0.0;
    float bd = (vL.y - sin(uT * 1.3) * 0.9) * 6.0;
    float band = exp(-bd * bd);
    // tiếp xúc: mảng loé 90 ms tại phía bị đánh + gợn lan ra
    float hd = acos(clamp(dot(vL, normalize(uHitDir + vec3(0.0, 1e-5, 0.0))), -1.0, 1.0));
    float rh = (hd - uHit * 2.4) * 7.0;
    float ring = exp(-rh * rh) * (1.0 - uHit);
    float hitPatch = exp(-hd * hd * 10.0) * (1.0 - smoothstep(0.0, 0.2, uHit));
    float a = frs * 0.9 + grid * (0.04 + 0.12 * frs) + band * 0.08 * (0.4 + grid) + ring * 0.9 + hitPatch * 1.4 + sweep * 0.9;
    // TIẾP XÚC SÀN (mặt sàn giải tích tại chân — GPU tích hợp không có depth pre-pass): vỏ mờ dần sát đất thay vì bị sàn cắt
    // thẳng + một đường may sáng mảnh đúng chỗ vỏ chạm đất (contact rim)
    float hgt = vW.y - uFloorY;
    float soft = smoothstep(0.0, 0.22, hgt);
    float seam = (1.0 - smoothstep(0.0, 0.07, hgt)) * step(0.0, hgt);
    a = a * soft + seam * 0.85;
    a *= (1.0 - rise) * (1.0 - gone) * uBlink;
    vec3 col = mix(uCol, uCol2, clamp(frs * 0.55 + grid * 0.4 + ring * 0.5 + hitPatch + sweep + seam, 0.0, 1.0)) * (1.0 + ring * 1.5 + hitPatch * 1.2 + seam * 0.6);
    if (a < 0.003) discard;
    gl_FragColor = vec4(col * a, 1.0);
  }`;

const END_MS = 220;

export function Ward() {
  const bubble = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCol: { value: new THREE.Color(SPELL_PALETTE.shield.body).multiplyScalar(1.5) },
          uCol2: { value: new THREE.Color(SPELL_PALETTE.shield.core).multiplyScalar(1.8) },
          uT: { value: 0 },
          uOpen: { value: 0 },
          uEnd: { value: 0 },
          uHit: { value: 1 },
          uHitDir: { value: new THREE.Vector3(0, 0, 1) },
          uBlink: { value: 1 },
          uSweep: { value: 1 },
          uFloorY: { value: -1e4 },
        },
        vertexShader: VS,
        fragmentShader: FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.FrontSide,
      }),
    [],
  );
  const g = useRef<THREE.Group>(null);
  const warm = useRef(0);
  useFrame((state) => {
    // 2 khung đầu: hiện trong suốt để biên dịch shader sẵn (không khựng lúc niệm phép lần đầu)
    if (warm.current < 2) {
      warm.current++;
      if (g.current) g.current.visible = true;
      bubble.uniforms.uBlink.value = 0;
      return;
    }
    const now = fxNow();
    const t = state.clock.elapsedTime;
    const active = now < ward.until;
    const sinceEnd = now - ward.until;
    const vis = active || sinceEnd < END_MS;
    if (g.current) g.current.visible = vis;
    if (!vis) return;
    const p = useWorld.getState().player;
    const age = (now - ward.born) / 1000;
    // mở nảy: 0 → 1,12 → 1
    const o = Math.min(1, age / 0.35);
    const pop = o < 1 ? Math.sin(o * Math.PI * 0.5) * 1.12 - Math.sin(o * Math.PI) * 0.12 * o : 1;
    g.current?.position.set(p.x, p.y + 0.95, p.z);
    g.current?.scale.setScalar(1.08 * Math.max(0.05, pop));
    const U = bubble.uniforms;
    U.uT.value = t;
    U.uOpen.value = Math.min(1, age / 0.45);
    U.uSweep.value = Math.min(1, age / 0.1);
    U.uFloorY.value = p.y;
    U.uEnd.value = active ? 0 : Math.min(1, sinceEnd / END_MS);
    U.uHit.value = Math.min(1, (now - ward.hitAt) / 450);
    U.uHitDir.value.copy(ward.hitDir);
    const left = ward.until - now;
    U.uBlink.value = left < 1000 && active ? 0.55 + 0.45 * Math.sin(now / 45) : 1;
  });
  return (
    <group ref={g} visible={false}>
      <mesh material={bubble} renderOrder={12}>
        <icosahedronGeometry args={[1, 4]} />
      </mesh>
    </group>
  );
}
