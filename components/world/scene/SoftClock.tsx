"use client";
/**
 * Đồng hồ mềm (Dalí, "Sự dai dẳng của ký ức") trên đảo Lorenz — Thế giới Bất Khả:
 *  mặt đồng hồ rủ vắt qua mép đảo (lưới vòng được uốn một lần: phần vượt mép gập xuống, gần đúng giữ độ dài cung);
 *  kim phút quay nhanh / chậm thất thường theo một quỹ đạo Lorenz thật (x(t) điều khiển tốc độ) — thời gian "chảy",
 *  không dự báo được, như hai hạt lệch nhau ε trong thí nghiệm cánh bướm bên cạnh.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ISLES } from "@/lib/world/impCosmos";
import { lorenzStart, lorenzStep } from "@/lib/world/cosmosLab";
import { IMP_SUN } from "./ImpossibleCosmos";
import { Label3D } from "../ui/Labels";

const ISLE = ISLES.find((i) => i.id === "lorenz")!;
const R = 1.7;
/** hướng từ đảo về sân (mặt đồng hồ quay về phía người chơi bay tới) */
const DIR = new THREE.Vector2(-ISLE.x, -ISLE.z).normalize();
const OFF = ISLE.r - 0.45;
const CENTER = new THREE.Vector3(ISLE.x + DIR.x * OFF, ISLE.h + 0.06, ISLE.z + DIR.y * OFF);

function faceTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grd.addColorStop(0, "#f8efd9");
  grd.addColorStop(1, "#e2cfa6");
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#3a2c22";
  g.font = "bold 44px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const N = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  N.forEach((s, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(s, 256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190);
  });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 ? 228 : 218;
    g.fillRect(256 + Math.cos(a) * r0 - 2, 256 + Math.sin(a) * r0 - 2, 4, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function drapedGeometry() {
  const g = new THREE.RingGeometry(0.001, R, 64, 16);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const flat = new Float32Array(pos.count * 2);
  const sEdge = ISLE.r - OFF; // khoảng từ tâm đồng hồ tới mép đảo theo hướng DIR
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i); // dọc hướng ra mép
    const l = pos.getY(i); // ngang
    flat[i * 2] = s;
    flat[i * 2 + 1] = l;
    let x = s;
    let y = 0.02 * Math.sin(l * 3.1 + s * 2.0);
    const d = s - (sEdge - 0.12);
    if (d > 0) {
      // gập qua mép: xoay quanh đường mép một góc tăng dần theo độ dài vượt mép (vải / sáp chảy)
      const th = Math.min(1.45, d * 2.4);
      x = sEdge - 0.12 + d * Math.cos(th) * 0.9;
      y = -d * Math.sin(th) * 1.15 - d * d * 0.2;
    }
    pos.setXYZ(i, x, y, l);
  }
  g.setAttribute("aFlat", new THREE.BufferAttribute(flat, 2));
  g.computeVertexNormals();
  return g;
}

const VS = /* glsl */ `attribute vec2 aFlat; varying vec2 vF; varying vec3 vN; varying vec3 vW;
  void main(){ vF = aFlat; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */ `uniform sampler2D uFace; uniform float uMin; uniform float uHour; uniform float uR; uniform vec3 uSun;
  varying vec2 vF; varying vec3 vN; varying vec3 vW;
  float seg(vec2 p, vec2 a, vec2 b, float w){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return 1.0 - smoothstep(w * 0.6, w, length(pa - ba * h)); }
  void main(){
    vec2 p = vec2(vF.y, -vF.x) / uR;   // toạ độ mặt số phẳng (12 giờ hướng về phía mép chảy)
    float r = length(p);
    vec3 col = texture2D(uFace, p * 0.5 + 0.5).rgb;
    // vành vàng
    col = mix(col, vec3(0.86, 0.62, 0.28), smoothstep(0.9, 0.93, r));
    // kim giờ + kim phút (góc theo chiều kim đồng hồ từ 12 giờ)
    vec2 dm = vec2(sin(uMin), cos(uMin));
    vec2 dh = vec2(sin(uHour), cos(uHour));
    float hands = max(seg(p, vec2(0.0), dm * 0.78, 0.035), seg(p, vec2(0.0), dh * 0.5, 0.05));
    col = mix(col, vec3(0.12, 0.09, 0.08), hands);
    col = mix(col, vec3(0.86, 0.62, 0.28), 1.0 - smoothstep(0.04, 0.055, r));
    vec3 n = normalize(gl_FrontFacing ? vN : -vN);
    float lam = max(dot(n, uSun), 0.0);
    col *= 0.45 + 0.75 * lam;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function SoftClock() {
  const { geo, mat } = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uFace: { value: faceTexture() }, uMin: { value: 0 }, uHour: { value: 0 }, uR: { value: R }, uSun: { value: IMP_SUN.clone() } },
      vertexShader: VS,
      fragmentShader: FS,
      side: THREE.DoubleSide,
    });
    return { geo: drapedGeometry(), mat: m };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      (mat.uniforms.uFace.value as THREE.Texture).dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  // tốc độ thời gian theo một quỹ đạo Lorenz thật: x(t) đổi dấu thất thường → kim lúc lao nhanh, lúc gần đứng, lúc quay ngược
  const st = useMemo(() => ({ p: lorenzStart(), min: 0 }), []);
  useFrame((_, dt) => {
    const h = Math.min(dt, 0.05);
    for (let k = 0; k < 4; k++) lorenzStep(st.p, h * 0.25);
    st.min += h * st.p[0] * 0.35;
    mat.uniforms.uMin.value = st.min;
    mat.uniforms.uHour.value = st.min / 12;
  });
  const yaw = Math.atan2(DIR.y, DIR.x);
  return (
    <group>
      <mesh geometry={geo} material={mat} position={CENTER} rotation={[0, -yaw, 0]} name="softclock" />
      <Label3D text="Đồng hồ mềm · thời gian chảy theo quỹ đạo Lorenz — không dự báo được" position={[CENTER.x, CENTER.y + 2.4, CENTER.z]} />
    </group>
  );
}
