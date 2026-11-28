"use client";
/**
 * Quần đảo Xuyến — bầu trời + biển mây + "bánh vòng" trên trời, toàn bằng shader (không ảnh panorama).
 *  - TorusSkyDome: trời sớm mai pastel (thiên đỉnh xanh biếc → chân trời hồng đào), mặt trời thấp, mây tích vẽ tay ở chân trời,
 *    dải cực quang mảnh. Đi theo máy quay.
 *  - CloudSea: biển mây dưới chân, nhiễu TUẦN HOÀN chu kỳ L (= cạnh ô vuông) → khi người chơi bị quấn ±L, mây khớp tuyệt đối;
 *    vẽ mờ lưới đường khâu (san hô: mép x, ngọc lam: mép z) để thấy thế giới là các ô vuông giống hệt nhau.
 *  - SkyTorus: chiếc xuyến 3D khổng lồ lơ lửng trên trời = chính thế giới này khi dán mép; chấm sáng chạy trên nó là VỊ TRÍ CỦA BẠN
 *    (u = x/L quanh vòng lớn, v = z/L quanh vòng nhỏ) — một bản đồ sống.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { TORUS_L } from "@/lib/world/torus";
import { ISLANDS, SEAM_X_COLOR, SEAM_Z_COLOR } from "@/lib/world/torusWorld";

/** hướng mặt trời (thấp, phía đông nam — chiếu xiên qua Hàng Chuông) */
export const TORUS_SUN = new THREE.Vector3(0.62, 0.36, 0.7).normalize();
export const TORUS_FOG = "#f3d9df";
export const SEA_Y = -15;

const NOISE = /* glsl */ `
  float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), f.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSun: { value: TORUS_SUN.clone() } },
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uSun; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        float sd = max(dot(d, uSun), 0.0);
        float az = dot(normalize(vec2(d.x, d.z) + 1e-4), normalize(vec2(uSun.x, uSun.z)));
        vec3 zen = vec3(0.30, 0.56, 0.95);
        vec3 mid = vec3(0.56, 0.74, 1.0);
        vec3 hor = mix(vec3(0.99, 0.82, 0.86), vec3(1.0, 0.80, 0.62), smoothstep(-0.3, 1.0, az));
        vec3 c = mix(mid, zen, smoothstep(0.15, 0.85, y));
        c = mix(c, hor, pow(1.0 - clamp(y, 0.0, 1.0), 5.0));
        // dưới chân trời: hoà vào màu sương của biển mây
        c = mix(c, vec3(0.953, 0.851, 0.875), smoothstep(0.03, -0.12, y));
        // quầng + đĩa mặt trời
        c += vec3(1.0, 0.72, 0.5) * pow(sd, 7.0) * 0.5 + vec3(1.0, 0.9, 0.7) * pow(sd, 90.0) * 0.9;
        c += vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9996, sd) * 5.0;
        // mây tích vẽ tay sát chân trời (viền nắng vàng phía mặt trời)
        if (y > -0.06 && y < 0.42) {
          float a = atan(d.z, d.x);
          vec2 q = vec2(a * 3.0, y * 8.0);
          float base = fbm2(q * vec2(1.0, 1.25) + vec2(uT * 0.003, 0.0));
          float tower = smoothstep(0.06, 0.38, 0.34 - y + base * 0.55 - 0.2) * smoothstep(-0.06, 0.04, y);
          float shade = fbm2(q * 2.3 + 3.0);
          vec3 lit = mix(vec3(1.0, 0.94, 0.95), vec3(1.0, 0.84, 0.66), smoothstep(-0.2, 1.0, az));
          vec3 sh = mix(vec3(0.70, 0.68, 0.92), vec3(0.92, 0.70, 0.80), smoothstep(-0.3, 1.0, az));
          vec3 cc = mix(sh, lit, smoothstep(0.35, 0.65, shade + y * 1.5));
          cc += vec3(1.0, 0.8, 0.45) * pow(sd, 4.0) * smoothstep(0.55, 0.75, shade) * 0.8;
          c = mix(c, cc, tower * 0.95);
        }
        // dải sáng mảnh như cực quang ban ngày, uốn lượn chậm (nhắc đường khâu: san hô + ngọc lam)
        if (y > 0.18) {
          float a = atan(d.z, d.x);
          float band = sin(a * 2.0 + uT * 0.05) * 0.06 + 0.5;
          float r1 = smoothstep(0.03, 0.0, abs(y - band)) * (0.5 + 0.5 * fbm2(vec2(a * 6.0, uT * 0.04)));
          float r2 = smoothstep(0.025, 0.0, abs(y - band - 0.07)) * (0.5 + 0.5 * fbm2(vec2(a * 5.0 + 9.0, uT * 0.05)));
          c += vec3(1.0, 0.54, 0.42) * r1 * 0.22 + vec3(0.37, 0.88, 0.82) * r2 * 0.22;
        }
        // mây ti mảnh trên cao
        if (y > 0.06) {
          vec2 p = d.xz / (y + 0.22) * 1.3 + vec2(uT * 0.005, uT * 0.002);
          float ci = fbm2(p * vec2(0.6, 2.3));
          float w = smoothstep(0.56, 0.86, ci) * smoothstep(0.06, 0.3, y) * (1.0 - smoothstep(0.7, 1.0, y));
          c = mix(c, mix(vec3(1.0, 0.96, 0.97), vec3(1.0, 0.82, 0.64), pow(sd, 2.0)), w * 0.5);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

/** biển mây: nhiễu giá trị TUẦN HOÀN (lưới nguyên lấy mod P) → hình mây lặp đúng chu kỳ L */
function seaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uL: { value: TORUS_L },
      uSun: { value: TORUS_SUN.clone() },
      uCam: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Color(TORUS_FOG) },
      uSX: { value: new THREE.Color(SEAM_X_COLOR) },
      uSZ: { value: new THREE.Color(SEAM_Z_COLOR) },
    },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: /* glsl */ `uniform float uT; uniform float uL; uniform vec3 uSun; uniform vec3 uCam; uniform vec3 uFog; uniform vec3 uSX; uniform vec3 uSZ; varying vec3 vW;
      float hp(vec2 p, float P){ p = mod(p, P); p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
      float np(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hp(i, P), hp(i+vec2(1.0,0.0), P), f.x), mix(hp(i+vec2(0.0,1.0), P), hp(i+vec2(1.0,1.0), P), f.x), f.y); }
      // fbm tuần hoàn: quãng lặp P ô lưới ở tầng 1, gấp đôi mỗi tầng → mọi tầng đều lặp đúng sau một ô vuông L
      float fbmp(vec2 p, float P){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * np(p, P); p *= 2.0; P *= 2.0; a *= 0.5; } return s; }
      void main(){
        float P = 6.0;
        vec2 uv = vW.xz / uL * P;
        // trôi chậm (dịch cả mẫu — mẫu dịch vẫn tuần hoàn chu kỳ P)
        vec2 drift = vec2(uT * 0.03, uT * 0.012);
        float n = fbmp(uv + drift, P);
        float n2 = fbmp(uv * 1.0 + vec2(3.7, 1.3) - drift * 0.7, P);
        float h = n * 0.65 + n2 * 0.35;
        // tông mây kiểu hoạt hình: 3 bậc sáng, viền nắng phía mặt trời
        float lit = smoothstep(0.38, 0.62, h);
        vec3 deep = vec3(0.70, 0.66, 0.90);
        vec3 midc = vec3(0.96, 0.84, 0.92);
        vec3 top = vec3(1.0, 0.97, 0.95);
        vec3 c = mix(deep, midc, smoothstep(0.3, 0.5, h));
        c = mix(c, top, lit);
        vec3 toCam = normalize(uCam - vW);
        float glint = pow(max(dot(reflect(-uSun, vec3(0.0, 1.0, 0.0)), toCam), 0.0), 18.0);
        c += vec3(1.0, 0.8, 0.55) * glint * 0.35 * lit;
        // lưới đường khâu (x ≡ L/2, z ≡ L/2 mod L): mảnh, mờ, nhoè theo khoảng cách
        vec2 g = abs(mod(vW.xz + uL * 0.5, uL) - uL * 0.5);
        float dist = length(uCam.xz - vW.xz);
        float wline = 0.25 + dist * 0.004;
        float sx = smoothstep(wline, 0.0, uL * 0.5 - g.x);
        float sz = smoothstep(wline, 0.0, uL * 0.5 - g.y);
        float k = (1.0 - smoothstep(30.0, 150.0, dist)) * 0.55;
        c = mix(c, uSX * 1.4, sx * k);
        c = mix(c, uSZ * 1.4, sz * k);
        // sương xa
        float f = smoothstep(60.0, 260.0, dist);
        c = mix(c, uFog, f);
        gl_FragColor = vec4(c, 1.0);
      }`,
    fog: false,
    toneMapped: false,
  });
}

/** xuyến trên trời: lưới toạ độ (u, v), hai vòng khâu màu, chấm đảo + chấm vị trí người chơi */
function donutMaterial() {
  const isl = ISLANDS.map((i) => new THREE.Vector2(((i.x + TORUS_L / 2) / TORUS_L) % 1, ((i.z + TORUS_L / 2) / TORUS_L) % 1));
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uP: { value: new THREE.Vector2() },
      uSX: { value: new THREE.Color(SEAM_X_COLOR) },
      uSZ: { value: new THREE.Color(SEAM_Z_COLOR) },
      uIsl: { value: isl },
      uSun: { value: TORUS_SUN.clone() },
    },
    vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec2 uP; uniform vec3 uSX; uniform vec3 uSZ; uniform vec2 uIsl[4]; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float dw(float a, float b){ float d = abs(a - b); return min(d, 1.0 - d); }
      void main(){
        vec2 uv = vUv;
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        // thân xuyến màu ngọc trai tím – lam (đậm hơn nền trời để nổi khối), sáng theo mặt trời
        vec3 c = mix(vec3(0.36, 0.42, 0.86), vec3(0.62, 0.40, 0.80), 0.5 + 0.5 * sin(uv.y * 6.2832));
        c *= 0.5 + 0.6 * max(dot(normalize(vN), normalize(vec3(0.3, 0.8, 0.5))), 0.0);
        // lưới 12 × 6 ô (mỗi ô = 1/12 cạnh ô vuông)
        float gu = smoothstep(0.012, 0.0, abs(fract(uv.x * 12.0) - 0.5) - 0.488);
        float gv = smoothstep(0.012, 0.0, abs(fract(uv.y * 6.0) - 0.5) - 0.488);
        c = mix(c, vec3(0.92, 0.96, 1.0), (gu + gv) * 0.45);
        // hai đường khâu: u = 0 (mép x) san hô, v = 0 (mép z) ngọc lam
        float su = smoothstep(0.014, 0.004, dw(uv.x, 0.0));
        float sv = smoothstep(0.022, 0.008, dw(uv.y, 0.0));
        c = mix(c, uSX * 2.2, su);
        c = mix(c, uSZ * 2.2, sv);
        // các đảo
        for (int i = 0; i < 4; i++) {
          vec2 d = vec2(dw(uv.x, uIsl[i].x), dw(uv.y, uIsl[i].y) * 0.5);
          c = mix(c, vec3(0.45, 0.86, 0.5), smoothstep(0.04, 0.025, length(d)));
        }
        // bạn ở đây (nhấp nháy)
        vec2 dp = vec2(dw(uv.x, uP.x), dw(uv.y, uP.y) * 0.5);
        float pd = length(dp);
        float pulse = 0.6 + 0.4 * sin(uT * 4.0);
        c += vec3(1.0, 0.85, 0.4) * (smoothstep(0.03, 0.012, pd) * 3.0 + smoothstep(0.09, 0.0, pd) * 0.8 * pulse);
        c += vec3(0.85, 0.9, 1.0) * fr * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }`,
    fog: false,
    toneMapped: false,
  });
}

export function TorusSky() {
  const { camera } = useThree();
  const mats = useMemo(() => ({ sky: skyMaterial(), sea: seaMaterial(), donut: donutMaterial() }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const sky = useRef<THREE.Mesh>(null);
  const sea = useRef<THREE.Mesh>(null);
  const donut = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 1000;
    mats.sky.uniforms.uT.value = t;
    mats.sea.uniforms.uT.value = t;
    mats.donut.uniforms.uT.value = t;
    mats.sea.uniforms.uCam.value.copy(camera.position);
    sky.current?.position.copy(camera.position);
    if (sea.current) sea.current.position.set(camera.position.x, SEA_Y, camera.position.z);
    const p = useWorld.getState().player;
    (mats.donut.uniforms.uP.value as THREE.Vector2).set((((p.x + TORUS_L / 2) / TORUS_L) % 1 + 1) % 1, (((p.z + TORUS_L / 2) / TORUS_L) % 1 + 1) % 1);
    const d = donut.current;
    if (d) {
      // treo cố định theo hướng trời (đi theo máy quay như bầu trời)
      d.position.set(camera.position.x - 150, camera.position.y + 150, camera.position.z - 300);
    }
  });
  return (
    <>
      <mesh ref={sky} material={mats.sky} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[470, 48, 24]} />
      </mesh>
      <mesh ref={sea} material={mats.sea} rotation-x={-Math.PI / 2} renderOrder={-1} frustumCulled={false}>
        <planeGeometry args={[900, 900, 1, 1]} />
      </mesh>
      <group ref={donut} rotation={[0.75, 0.3, 0]}>
        <mesh material={mats.donut} frustumCulled={false}>
          <torusGeometry args={[36, 14, 40, 96]} />
        </mesh>
      </group>
    </>
  );
}
