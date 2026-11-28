"use client";
/**
 * Chợ Xác Suất — trời đêm hội + biển đèn bên dưới, toàn shader (không ảnh panorama):
 *  - vòm trời: chàm thẫm → tím → cam ấm ở chân trời (ánh chợ hắt lên), sao lấp lánh, trăng tròn, dải "Ngân Hà" mờ.
 *  - đèn trời (thả đèn khổng minh): InstancedMesh hình hộp đèn bay lên chậm, lắc nhẹ, phát sáng HDR (Bloom bắt).
 *  - biển mây đêm dưới sân (y = −6) phản chiếu đèn: nhiễu cuộn + đốm sáng ấm.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";

export const BAZAAR_FOG = "#2a1f4a";
export const MOON_DIR = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();

const NOISE = /* glsl */ `
  float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), f.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uMoon: { value: MOON_DIR.clone() } },
    vertexShader:
      "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uMoon; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 zen = vec3(0.035, 0.03, 0.12);
        vec3 mid = vec3(0.12, 0.08, 0.30);
        vec3 hor = vec3(0.62, 0.30, 0.34);
        vec3 c = mix(mid, zen, smoothstep(0.1, 0.8, y));
        c = mix(c, hor, pow(1.0 - clamp(y, 0.0, 1.0), 6.0));
        c = mix(c, vec3(0.16, 0.12, 0.29), smoothstep(0.02, -0.15, y));
        // dải Ngân Hà mờ chéo trời
        float a = atan(d.z, d.x);
        float band = abs(dot(d, normalize(vec3(0.3, 0.6, 0.74))));
        float mw = smoothstep(0.32, 0.0, band) * fbm2(vec2(a * 4.0, y * 6.0)) * smoothstep(0.05, 0.3, y);
        c += vec3(0.32, 0.24, 0.48) * mw * 0.55;
        // sao: lưới theo hướng, lấp lánh
        vec2 sp = vec2(a * 60.0, y * 60.0);
        vec2 ci = floor(sp);
        float r = h2(ci);
        vec2 f = fract(sp) - 0.5 - (vec2(h2(ci + 3.1), h2(ci + 7.7)) - 0.5) * 0.6;
        float star = step(0.93, r) * smoothstep(0.09, 0.0, length(f)) * (0.6 + 0.4 * sin(uT * (2.0 + r * 5.0) + r * 40.0));
        c += vec3(1.0, 0.95, 0.85) * star * smoothstep(0.04, 0.3, y) * 1.6;
        // trăng + quầng
        float md = max(dot(d, uMoon), 0.0);
        c += vec3(0.55, 0.5, 0.75) * pow(md, 30.0) * 0.4;
        float disk = smoothstep(0.9985, 0.999, md);
        float crater = fbm2(d.xy * 260.0) * 0.25;
        c = mix(c, vec3(1.0, 0.96, 0.86) * (1.25 - crater), disk);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

function seaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Color(BAZAAR_FOG) },
    },
    vertexShader:
      "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uCam; uniform vec3 uFog; varying vec3 vW;
      ${NOISE}
      void main(){
        vec2 p = vW.xz * 0.05;
        float n = fbm2(p + vec2(uT * 0.02, uT * 0.008));
        float n2 = fbm2(p * 2.3 - vec2(uT * 0.015, 0.0));
        vec3 deep = vec3(0.10, 0.07, 0.22);
        vec3 top = vec3(0.36, 0.22, 0.42);
        vec3 c = mix(deep, top, smoothstep(0.35, 0.7, n * 0.7 + n2 * 0.3));
        // ánh đèn chợ hắt xuống: quầng ấm quanh tâm, đốm lửa lấp lánh
        float r = length(vW.xz);
        c += vec3(1.0, 0.55, 0.25) * smoothstep(60.0, 20.0, r) * 0.22;
        vec2 cell = floor(vW.xz * 0.35);
        float sp = step(0.985, h2(cell)) * (0.5 + 0.5 * sin(uT * 2.0 + h2(cell + 1.0) * 30.0));
        c += vec3(1.0, 0.75, 0.4) * sp * 0.9 * smoothstep(0.4, 0.0, length(fract(vW.xz * 0.35) - 0.5));
        float dist = length(uCam.xz - vW.xz);
        c = mix(c, uFog, smoothstep(40.0, 200.0, dist));
        gl_FragColor = vec4(c, 1.0);
      }`,
    fog: false,
    toneMapped: false,
  });
}

/** đèn trời: hộp đèn nhỏ bay lên, quay về đáy khi quá cao */
const SKY_LANTERNS = 70;

export function BazaarSky() {
  const camera = useThree((s) => s.camera);
  const quality = useWorld((s) => s.quality);
  const mats = useMemo(
    () => ({
      sky: skyMaterial(),
      sea: seaMaterial(),
      lamp: new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.4, 1.2, 0.45),
        toneMapped: false,
        fog: false,
      }),
    }),
    [],
  );
  const n = quality === "low" ? 30 : SKY_LANTERNS;
  const lanterns = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.32, 0.24, 0.6, 6, 1);
    const im = new THREE.InstancedMesh(geo, mats.lamp, n);
    im.frustumCulled = false;
    const seeds = Array.from({ length: n }, (_, i) => {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 34 + ((i * 37) % 60);
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        y0: (i * 13.7) % 60,
        sp: 0.35 + ((i * 7) % 10) / 25,
        ph: i * 1.7,
      };
    });
    return { im, geo, seeds };
  }, [mats, n]);
  useEffect(
    () => () => {
      lanterns.im.dispose();
      lanterns.geo.dispose();
    },
    [lanterns],
  );
  useEffect(
    () => () => Object.values(mats).forEach((m) => m.dispose()),
    [mats],
  );
  const dome = useRef<THREE.Mesh>(null);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  const S = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const E = useMemo(() => new THREE.Euler(), []);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    mats.sky.uniforms.uT.value += dt;
    mats.sea.uniforms.uT.value += dt;
    mats.sea.uniforms.uCam.value.copy(camera.position);
    dome.current?.position.copy(camera.position);
    lanterns.seeds.forEach((s, i) => {
      const y = ((s.y0 + t * s.sp) % 60) - 8;
      P.set(
        s.x + Math.sin(t * 0.3 + s.ph) * 1.2,
        y,
        s.z + Math.cos(t * 0.27 + s.ph) * 1.2,
      );
      E.set(
        Math.sin(t * 0.8 + s.ph) * 0.12,
        t * 0.2 + s.ph,
        Math.cos(t * 0.7 + s.ph) * 0.12,
      );
      Q.setFromEuler(E);
      const k = Math.min(1, (y + 8) / 6) * Math.min(1, (52 - y) / 8);
      S.setScalar(Math.max(0.01, k));
      lanterns.im.setMatrixAt(i, M.compose(P, Q, S));
    });
    lanterns.im.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh
        ref={dome}
        material={mats.sky}
        renderOrder={-10}
        frustumCulled={false}
        scale={400}
      >
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      <mesh material={mats.sea} rotation-x={-Math.PI / 2} position={[0, -6, 0]}>
        <planeGeometry args={[600, 600, 1, 1]} />
      </mesh>
      <primitive object={lanterns.im} />
    </group>
  );
}
