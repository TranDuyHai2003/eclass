"use client";
/**
 * Quảng trường kiểu Genshin — sương độ cao + phối cảnh khí quyển + chỉnh màu, MỘT hiệu ứng gộp vào EffectPass có sẵn
 * (cùng lượt với Ink, dùng chung depth đã đọc → 0 lệnh vẽ, 0 lượt toàn màn hình mới). RESEARCH.md §4–5:
 *  • sương bắt đầu từ ~42 m (nhân vật, hồ, phần lớn đảo 72 m vẫn nét), đặc hơn ở thấp (dưới sân / chân đảo hoà vào biển mây);
 *  • màu sương theo hướng nhìn: phía mặt trời đào ấm, ngược nắng lam khói — lấy từ DAY (trời 9 mốc giờ) → đêm tự lam tối;
 *  • chỉnh màu nhẹ trên ảnh HDR tuyến tính: sáng ấm / tối lạnh (split-tone), vibrance (tăng màu nhạt, không đẩy màu đã rực).
 * Thay <fog> cố định "#f2d2bd" (trước đây cả đêm vẫn sương đào).
 */
import { forwardRef, useEffect, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import { DAY } from "./dayState";

const FRAG = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uZen; uniform vec3 uHor; uniform float uNight; uniform float uSunK;
uniform vec2 uTan; uniform mat3 uCamRot; uniform vec3 uCamPos;
uniform float uStart; uniform float uDensity; uniform float uGrade;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  if (depth < 0.99999) {
    float vz = -getViewZ(depth);
    vec3 vp = vec3((uv * 2.0 - 1.0) * uTan * vz, -vz);
    float d = length(vp);
    vec3 dir = uCamRot * (vp / d);
    // mật độ theo độ cao điểm giữa tia: dưới sân (chân đảo, biển mây) đặc gấp ~4
    float yMid = uCamPos.y + 0.5 * dir.y * d;
    float dens = uDensity * mix(4.0, 1.0, smoothstep(-25.0, 6.0, yMid));
    float fog = 1.0 - exp(-dens * max(d - uStart, 0.0));
    float up = smoothstep(-0.12, 0.05, uSunDir.y);
    float low = 1.0 - smoothstep(0.25, 0.7, uSunDir.y);
    vec3 away = mix(uHor, uZen, 0.22);
    vec3 sunward = mix(uHor, vec3(1.0, 0.74, 0.5), 0.55 * up * low + 0.15 * up);
    float warm = pow(max(dot(dir, uSunDir), 0.0), 4.0) * up;
    vec3 fogC = mix(away, sunward, warm) * mix(1.0, 0.75, uNight);
    col = mix(col, fogC, clamp(fog, 0.0, 0.92));
  }
  // chỉnh màu (HDR tuyến tính, trước tone map): sáng ấm / tối lạnh + vibrance
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 split = mix(vec3(0.95, 0.975, 1.06), vec3(1.035, 1.0, 0.95), smoothstep(0.04, 0.55, lum));
  col *= mix(vec3(1.0), split, uGrade);
  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
  float sat = (mx - mn) / max(mx, 1e-4);
  col = max(mix(vec3(lum), col, 1.0 + 0.12 * uGrade * (1.0 - sat)), 0.0);
  outputColor = vec4(col, inputColor.a);
}
`;

class HubAtmosEffect extends Effect {
  private cam: THREE.Camera | null = null;
  constructor() {
    super("HubAtmosEffect", FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uSunDir", new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ["uZen", new THREE.Uniform(new THREE.Color())],
        ["uHor", new THREE.Uniform(new THREE.Color())],
        ["uNight", new THREE.Uniform(0)],
        ["uSunK", new THREE.Uniform(1)],
        ["uTan", new THREE.Uniform(new THREE.Vector2(1, 1))],
        ["uCamRot", new THREE.Uniform(new THREE.Matrix3())],
        ["uCamPos", new THREE.Uniform(new THREE.Vector3())],
        ["uStart", new THREE.Uniform(42)],
        ["uDensity", new THREE.Uniform(0.0065)],
        ["uGrade", new THREE.Uniform(1)],
      ]),
    });
  }
  set mainCamera(c: THREE.Camera) {
    this.cam = c;
  }
  update() {
    const u = this.uniforms;
    (u.get("uSunDir")!.value as THREE.Vector3).copy(DAY.sun.value);
    (u.get("uZen")!.value as THREE.Color).copy(DAY.zen.value);
    (u.get("uHor")!.value as THREE.Color).copy(DAY.hor.value);
    u.get("uNight")!.value = DAY.night.value;
    u.get("uSunK")!.value = DAY.sunK.value;
    const c = this.cam as THREE.PerspectiveCamera | null;
    if (!c) return;
    const P = c.projectionMatrix.elements;
    (u.get("uTan")!.value as THREE.Vector2).set(1 / P[0], 1 / P[5]);
    (u.get("uCamRot")!.value as THREE.Matrix3).setFromMatrix4(c.matrixWorld);
    (u.get("uCamPos")!.value as THREE.Vector3).setFromMatrixPosition(c.matrixWorld);
  }
}

export const HubAtmos = forwardRef<HubAtmosEffect>(function HubAtmos(_, ref) {
  const effect = useMemo(() => new HubAtmosEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
