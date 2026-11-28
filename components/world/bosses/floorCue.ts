"use client";
/**
 * Mặt sàn báo trước (telegraph) cho boss Vùng Kỳ quan — MỘT lưới + MỘT ShaderMaterial vẽ mọi hình nguy hiểm bằng giải tích
 * (nghiên cứu Valorant: biên gameplay là hình học sắc nét, mờ dần ở trong; báo trước = gạch chéo, đòn thật = lõi đặc,
 * vùng đã qua tắt nhanh; hình + chuyển động đọc được cả khi tắt bloom).
 *
 * Lưới: mỗi ô khối một tứ giác PHẲNG đặt đúng mặt trên khối (lấy bằng ENV.ground), nên dán sát địa hình bậc thang voxel
 * mà không xuyên vào khối. Lấy mẫu lại độ cao 2 s / lần (người chơi xây / phá trong đấu trường) — ghi đè tại chỗ.
 * GLSL ES 3.0: tránh định danh dành riêng (patch, sample, input, output, filter, active, common, partition).
 */
import * as THREE from "three";
import { ENV } from "../combat/combat";

/** Lưới độ cao của đấu trường: ô (i, j) ↔ khối x0 + i, z0 + j */
export class ArenaGround {
  readonly nx: number;
  readonly nz: number;
  readonly x0: number;
  readonly z0: number;
  readonly refY: number;
  readonly h: Float32Array;
  constructor(cx: number, cz: number, halfX: number, halfZ: number, refY: number) {
    this.x0 = Math.floor(cx - halfX);
    this.z0 = Math.floor(cz - halfZ);
    this.nx = Math.ceil(halfX * 2) + 1;
    this.nz = Math.ceil(halfZ * 2) + 1;
    this.refY = refY;
    this.h = new Float32Array(this.nx * this.nz);
    this.sample();
  }
  /** lấy mẫu lại (≈ 800 ô, gọi thưa) — mặt đất thật dưới độ cao tham chiếu + 4 (bỏ qua tán cây phía trên) */
  sample() {
    for (let j = 0; j < this.nz; j++)
      for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = ENV.ground(this.x0 + i + 0.5, this.z0 + j + 0.5, this.refY + 4);
  }
  /** độ cao mặt đất tại (x, z) thế giới (ô gần nhất; ngoài lưới → kẹp biên) */
  at(x: number, z: number): number {
    const i = Math.max(0, Math.min(this.nx - 1, Math.floor(x - this.x0)));
    const j = Math.max(0, Math.min(this.nz - 1, Math.floor(z - this.z0)));
    return this.h[j * this.nx + i];
  }
}

/** Hình học: mỗi ô một tứ giác phẳng ở độ cao ô (+lift). Toạ độ thế giới (lưới đặt ở gốc). */
export function cellGeometry(g: ArenaGround, lift = 0.035): THREE.BufferGeometry {
  const n = g.nx * g.nz;
  const pos = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  for (let j = 0; j < g.nz; j++)
    for (let i = 0; i < g.nx; i++) {
      const c = j * g.nx + i;
      const x = g.x0 + i;
      const z = g.z0 + j;
      const o = c * 12;
      pos.set([x, 0, z, x + 1, 0, z, x + 1, 0, z + 1, x, 0, z + 1], o);
      idx.set([c * 4, c * 4 + 2, c * 4 + 1, c * 4, c * 4 + 3, c * 4 + 2], c * 6);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  updateCellHeights(geo, g, lift);
  return geo;
}

/** Ghi lại độ cao từng ô vào lưới (không cấp phát) */
export function updateCellHeights(geo: THREE.BufferGeometry, g: ArenaGround, lift = 0.035) {
  const a = geo.getAttribute("position") as THREE.BufferAttribute;
  const arr = a.array as Float32Array;
  for (let c = 0; c < g.nx * g.nz; c++) {
    const y = g.h[c] + lift;
    arr[c * 12 + 1] = y;
    arr[c * 12 + 4] = y;
    arr[c * 12 + 7] = y;
    arr[c * 12 + 10] = y;
  }
  a.needsUpdate = true;
  geo.computeBoundingSphere();
}

const VERT = /* glsl */ `
  varying vec2 vW;
  #include <fog_pars_vertex>
  void main() {
    vW = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

/** Các hàm chung: khoảng cách đoạn, gạch chéo chạy, viền mực, nét đứt */
const LIB = /* glsl */ `
  float segD(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a; float L2 = max(dot(ab, ab), 1e-6);
    t = clamp(dot(p - a, ab) / L2, 0.0, 1.0);
    return length(p - a - ab * t);
  }
  float aa(float d) { return clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0); }
  // dải: 1 bên trong |d| < w (viền khử răng cưa)
  float band(float d, float w) { return aa(abs(d) - w); }
  // gạch chéo chạy theo hướng 'along' (đơn vị: m)
  float hatch(float along, float across, float speed, float t) {
    float s = fract((along + across) * 1.15 - t * speed);
    return smoothstep(0.42, 0.5, s) * (1.0 - smoothstep(0.88, 0.96, s));
  }
  // nét đứt dọc toạ độ 'along'
  float dash(float along, float on) { return step(fract(along / on), 0.55); }
  vec4 over(vec4 base, vec3 c, float a) { a = clamp(a, 0.0, 1.0); return vec4(mix(base.rgb, c, a), base.a + a * (1.0 - base.a)); }
`;

// ───────────── Kẻ Khảo sát Gấp ─────────────

export type SurveyorFloorU = ReturnType<typeof surveyorFloorUniforms>;
export function surveyorFloorUniforms() {
  return {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector2() },
    uHalf: { value: 12 },
    /** độ đậm chung (vào / ra trận) */
    uFade: { value: 0 },
    // lộ trình (Quét / Gập): tối đa 3 đỉnh (toạ độ đấu trường)
    uR0: { value: new THREE.Vector2() },
    uR1: { value: new THREE.Vector2() },
    uR2: { value: new THREE.Vector2() },
    uRN: { value: 0 },
    uRLen: { value: 1 },
    uLaneHalf: { value: 1.5 },
    /** 0 không · 1 báo trước · 2 đang đánh · 3 hồi chiêu */
    uStage: { value: 0 },
    uTele: { value: 0 },
    uHeadS: { value: 0 },
    uBody: { value: 16 },
    /** tiếng vọng: khoảng trống [uEchoA, uEchoB] phía sau đầu (m); 0 0 = không */
    uEcho: { value: new THREE.Vector2() },
    // đường gấp của Gập Ngược (a, b, c), bật / tắt
    uFold: { value: new THREE.Vector3() },
    uFoldOn: { value: 0 },
    // Thả Thước
    uBarOn: { value: 0 },
    uBarO: { value: new THREE.Vector2() },
    uBarD: { value: new THREE.Vector2(1, 0) },
    uBarOff: { value: new THREE.Vector2() },
    uBarLen: { value: 12 },
    uBarW: { value: 2.2 },
    // Khiên Đối xứng
    uSealOn: { value: 0 },
    uSeal: { value: new THREE.Vector3() },
    uStake0: { value: new THREE.Vector3(0, 0, -1) },
    uStake1: { value: new THREE.Vector3(0, 0, -1) },
    uStake2: { value: new THREE.Vector3(0, 0, -1) },
    uImg0: { value: new THREE.Vector3(0, 0, -1) },
    uImg1: { value: new THREE.Vector3(0, 0, -1) },
    uImg2: { value: new THREE.Vector3(0, 0, -1) },
    /** bóng gương (u, v, bật) + người chơi (u, v, tiến độ ghim 0..1) */
    uGhost: { value: new THREE.Vector3() },
    uPlayer: { value: new THREE.Vector3() },
    /** lúc gấp xong (khiên vỡ) — sóng gấp lan từ ℓ */
    uFoldFlash: { value: -100 },
  };
}

export function surveyorFloorMaterial(U: SurveyorFloorU): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, ...U },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHalf, uFade, uRN, uRLen, uLaneHalf, uStage, uTele, uHeadS, uBody, uFoldOn, uBarOn, uBarLen, uBarW, uSealOn, uFoldFlash;
      uniform vec2 uCenter, uR0, uR1, uR2, uEcho, uBarO, uBarD, uBarOff;
      uniform vec3 uFold, uSeal, uStake0, uStake1, uStake2, uImg0, uImg1, uImg2, uGhost, uPlayer;
      varying vec2 vW;
      #include <fog_pars_fragment>
      ${LIB}
      const vec3 INK = vec3(0.10, 0.07, 0.12);
      const vec3 IVORY = vec3(1.0, 0.95, 0.80);
      const vec3 CORAL = vec3(1.0, 0.47, 0.38);
      const vec3 HOT = vec3(1.0, 0.94, 0.75);
      const vec3 MINT = vec3(0.50, 1.0, 0.78);
      const vec3 GOLD = vec3(1.0, 0.82, 0.38);
      const vec3 SEALC = vec3(0.62, 0.66, 1.0);

      vec4 marker(vec4 col, vec2 p, vec3 s, vec3 c, float filled) {
        if (s.z < 0.0) return col;
        float d = length(p - s.xy);
        col = over(col, INK, band(d - 0.62, 0.09));
        col = over(col, c, band(d - 0.62, 0.05) + filled * aa(d - 0.45) * 0.85);
        // chữ thập ở tâm (đánh dấu đúng tâm khối)
        vec2 q = abs(p - s.xy);
        col = over(col, c, (1.0 - filled) * aa(min(q.x, q.y) - 0.04) * aa(max(q.x, q.y) - 0.3));
        return col;
      }

      void main() {
        vec2 p = vW - uCenter;
        vec4 col = vec4(0.0);
        float inside = step(max(abs(p.x), abs(p.y)), uHalf);
        // biên đấu trường + lưới phấn 1 m (trục x, z đậm hơn) — để đọc toạ độ
        float edge = max(abs(p.x), abs(p.y)) - uHalf;
        col = over(col, INK, band(edge, 0.12) * 0.8);
        col = over(col, IVORY, band(edge, 0.06));
        vec2 gq = abs(fract(p + 0.5) - 0.5);
        float grid = aa(min(gq.x, gq.y) - 0.025) * inside;
        col = over(col, IVORY, grid * 0.16);
        float axis = (aa(abs(p.x) - 0.05) + aa(abs(p.y) - 0.05)) * inside;
        col = over(col, IVORY, axis * 0.42);
        // vạch chia mỗi 4 m trên trục
        float tick = inside * (aa(abs(p.y) - 0.28) * aa(abs(fract(p.x / 4.0 + 0.5) - 0.5) * 4.0 - 0.06)
                             + aa(abs(p.x) - 0.28) * aa(abs(fract(p.y / 4.0 + 0.5) - 0.5) * 4.0 - 0.06));
        col = over(col, IVORY, tick * 0.7);

        // ── lộ trình (Quét / Gập) ──
        if (uRN > 1.5 && uStage > 0.5) {
          float t0; float t1;
          float d0 = segD(p, uR0, uR1, t0);
          float L0 = length(uR1 - uR0);
          float d = d0; float s = t0 * L0;
          if (uRN > 2.5) {
            float d1 = segD(p, uR1, uR2, t1);
            if (d1 < d) { d = d1; s = L0 + t1 * length(uR2 - uR1); }
          }
          vec2 dir = uRN > 2.5 && s > L0 ? normalize(uR2 - uR1) : normalize(uR1 - uR0);
          float across = dot(p - uR0, vec2(-dir.y, dir.x));
          float inLane = aa(d - uLaneHalf);
          float rim = band(d - uLaneHalf, 0.09);
          if (uStage < 1.5) {
            // báo trước: viền mực + gạch chéo chạy theo chiều đi + vệt "đổ đầy" theo thứ tự đi (tới cuối = lúc đánh)
            float fill = step(s, uTele * (uRLen + 2.0));
            col = over(col, INK, rim * 0.9);
            col = over(col, CORAL, inLane * (0.22 + 0.5 * hatch(s, across * 0.3, 1.6, uTime)) );
            col = over(col, CORAL, inLane * fill * 0.28);
            col = over(col, IVORY, band(d - uLaneHalf, 0.035));
            // mũi tên ở cuối lộ trình
            float tip = smoothstep(uRLen - 2.2, uRLen, s) * inLane * step(abs(across), (uRLen - s) * 0.7 + 0.15);
            col = over(col, HOT, tip * 0.9);
          } else {
            // đang đánh: lõi đặc chỗ đoàn toa đang đi; phía sau đuôi tắt nhanh
            float behind = uHeadS - s;
            float body = step(0.0, behind) * step(behind, uBody) * (1.0 - step(uEcho.x, behind) * step(behind, uEcho.y) * step(0.01, uEcho.y));
            float spent = step(uBody, behind) * exp(-(behind - uBody) * 0.6);
            float ahead = step(behind, 0.0) * step(s, uRLen + 0.5);
            col = over(col, INK, rim * (0.9 * (ahead + body)));
            col = over(col, HOT, inLane * body * 0.85);
            col = over(col, CORAL, inLane * ahead * (0.25 + 0.4 * hatch(s, across * 0.3, 3.0, uTime)));
            col = over(col, CORAL, inLane * spent * 0.35);
          }
        }
        // đường gấp (Gập Ngược): nét đứt ngà + vạch vuông góc
        if (uFoldOn > 0.5) {
          float df = dot(vec2(uFold.x, uFold.y), p) - uFold.z;
          float along = dot(vec2(-uFold.y, uFold.x), p);
          float reach = step(abs(along - dot(vec2(-uFold.y, uFold.x), uR1)), 7.0);
          col = over(col, INK, band(df, 0.09) * dash(along, 0.8) * reach);
          col = over(col, IVORY, band(df, 0.045) * dash(along, 0.8) * reach);
        }
        // Thả Thước: hai thanh có vạch chia (thước đo) + khe an toàn
        if (uBarOn > 0.5) {
          vec2 n = vec2(-uBarD.y, uBarD.x);
          vec2 q = p - uBarO;
          float al = dot(q, uBarD);
          float of = dot(q, n);
          float inLen = aa(abs(al) - uBarLen * 0.5);
          float b0 = aa(abs(of - uBarOff.x) - uBarW * 0.5) * inLen;
          float b1 = aa(abs(of - uBarOff.y) - uBarW * 0.5) * inLen;
          float bars = max(b0, b1);
          float rim0 = band(max(abs(of - uBarOff.x) - uBarW * 0.5, abs(al) - uBarLen * 0.5), 0.08);
          float rim1 = band(max(abs(of - uBarOff.y) - uBarW * 0.5, abs(al) - uBarLen * 0.5), 0.08);
          float gapC = (uBarOff.x + uBarOff.y) * 0.5;
          float gapW = abs(uBarOff.y - uBarOff.x) - uBarW;
          float gap = aa(abs(of - gapC) - gapW * 0.5) * inLen;
          // vạch chia 0,5 m / 1 m dọc thước
          float tk = aa(abs(fract(al + 0.5) - 0.5) - 0.03) * step(abs(abs(of - uBarOff.x) - uBarW * 0.5), 0.45)
                   + aa(abs(fract(al + 0.5) - 0.5) - 0.03) * step(abs(abs(of - uBarOff.y) - uBarW * 0.5), 0.45);
          if (uStage < 1.5) {
            col = over(col, INK, (rim0 + rim1) * 0.9);
            col = over(col, CORAL, bars * (0.25 + 0.45 * hatch(of, al * 0.2, -1.2, uTime) + 0.25 * uTele));
            col = over(col, IVORY, tk * bars * 0.9);
            // khe: bạc hà + mũi tên nhỏ chỉ vào giữa
            float chev = step(fract(al * 0.6 + abs(of - gapC) * 0.6 - uTime * 1.2), 0.25);
            col = over(col, MINT, gap * (0.25 + 0.35 * chev));
          } else if (uStage < 2.5) {
            col = over(col, HOT, bars * 0.95);
          } else {
            col = over(col, INK, bars * 0.25 * (1.0 - uTele));
          }
        }
        // ── Khiên Đối xứng ──
        if (uSealOn > 0.5) {
          float ds = dot(vec2(uSeal.x, uSeal.y), p) - uSeal.z;
          float along = dot(vec2(-uSeal.y, uSeal.x), p);
          float glow = exp(-abs(ds) * 3.0) * 0.35;
          col = over(col, SEALC, glow * inside);
          col = over(col, INK, band(ds, 0.11) * inside);
          col = over(col, SEALC, band(ds, 0.06) * inside * (0.6 + 0.4 * dash(along - uTime * 0.8, 1.0)));
          // cọc (vàng, chữ thập) + ảnh đã ghim (bạc hà, đặc) + đoạn nối vuông góc qua ℓ
          col = marker(col, p, uStake0, GOLD, 0.0);
          col = marker(col, p, uStake1, GOLD, 0.0);
          col = marker(col, p, uStake2, GOLD, 0.0);
          float tq;
          if (uImg0.z > 0.5) { col = over(col, MINT, band(segD(p, uStake0.xy, uImg0.xy, tq), 0.04) * dash(tq * 12.0, 1.0)); col = marker(col, p, uImg0, MINT, 1.0); }
          if (uImg1.z > 0.5) { col = over(col, MINT, band(segD(p, uStake1.xy, uImg1.xy, tq), 0.04) * dash(tq * 12.0, 1.0)); col = marker(col, p, uImg1, MINT, 1.0); }
          if (uImg2.z > 0.5) { col = over(col, MINT, band(segD(p, uStake2.xy, uImg2.xy, tq), 0.04) * dash(tq * 12.0, 1.0)); col = marker(col, p, uImg2, MINT, 1.0); }
          // bóng gương của người chơi + đoạn nối mờ
          if (uGhost.z > 0.5) {
            float dg = length(p - uGhost.xy);
            col = over(col, SEALC, band(dg - 0.5, 0.07) * (0.7 + 0.3 * sin(uTime * 6.0)));
            col = over(col, SEALC, aa(dg - 0.18) * 0.8);
            col = over(col, SEALC, band(segD(p, uPlayer.xy, uGhost.xy, tq), 0.025) * dash(tq * 14.0, 1.0) * 0.6);
          }
          // tiến độ ghim dưới chân
          if (uPlayer.z > 0.01) {
            vec2 rp = p - uPlayer.xy;
            float ang = (atan(rp.x, -rp.y) + 3.14159) / 6.28318;
            col = over(col, MINT, band(length(rp) - 0.85, 0.07) * step(ang, uPlayer.z));
          }
        }
        // sóng "gấp xong": vạch sáng lan ra hai phía từ ℓ
        float ff = uTime - uFoldFlash;
        if (ff > 0.0 && ff < 1.2) {
          float ds = abs(dot(vec2(uSeal.x, uSeal.y), p) - uSeal.z);
          col = over(col, HOT, band(ds - ff * 12.0, 0.25) * (1.0 - ff / 1.2) * inside);
        }
        col.a *= uFade;
        gl_FragColor = vec4(col.rgb, col.a);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

// ───────────── Sổ Mưa ─────────────

export type LedgerFloorU = ReturnType<typeof ledgerFloorUniforms>;
export function ledgerFloorUniforms() {
  return {
    uTime: { value: 0 },
    uFade: { value: 0 },
    /** gốc bến + hướng dọc bến (đơn vị) — làn chạy theo v (dọc), xếp theo u (ngang) */
    uOrigin: { value: new THREE.Vector2() },
    uAxis: { value: new THREE.Vector2(0, 1) },
    uLaneW: { value: 4 },
    uHalfLen: { value: 11 },
    /** trạng thái 4 làn: 0 thường · 1 lộ (báo trước) · 2 mưa; tiến độ báo trước 0..1 */
    uLane: { value: new THREE.Vector4() },
    uLaneT: { value: new THREE.Vector4() },
    /** làn đang đứng (cược) */
    uBet: { value: -1 },
    /** xả lũ: làn a, làn b, đầu sóng v (−99 = chưa), đang báo trước (0/1) */
    uSpill: { value: new THREE.Vector4(-1, -1, -99, 0) },
    /** trống hạ xuống (lộ) */
    uExposed: { value: 0 },
    uDrumV: { value: 13 },
  };
}

export function ledgerFloorMaterial(U: LedgerFloorU): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, ...U },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFade, uLaneW, uHalfLen, uBet, uExposed, uDrumV;
      uniform vec2 uOrigin, uAxis;
      uniform vec4 uLane, uLaneT, uSpill;
      varying vec2 vW;
      #include <fog_pars_fragment>
      ${LIB}
      const vec3 INK = vec3(0.08, 0.08, 0.14);
      const vec3 IVORY = vec3(0.98, 0.96, 0.88);
      const vec3 CORAL = vec3(1.0, 0.47, 0.38);
      const vec3 WET = vec3(0.70, 0.90, 1.0);
      const vec3 FOAM = vec3(0.92, 0.98, 1.0);
      vec3 laneCol(float i) {
        return i < 0.5 ? vec3(1.0, 0.55, 0.55) : i < 1.5 ? vec3(1.0, 0.82, 0.42) : i < 2.5 ? vec3(0.55, 0.92, 0.62) : vec3(0.55, 0.72, 1.0);
      }
      float pick(vec4 v, float i) { return i < 0.5 ? v.x : i < 1.5 ? v.y : i < 2.5 ? v.z : v.w; }
      void main() {
        vec2 w = vW - uOrigin;
        // toạ độ bến: u ngang (xếp làn), v dọc (về phía trống)
        float v = dot(w, uAxis);
        float u = dot(w, vec2(-uAxis.y, uAxis.x));
        float hw = uLaneW * 2.0;
        vec4 col = vec4(0.0);
        float onDock = aa(abs(u) - hw) * aa(abs(v) - uHalfLen);
        float lane = floor((u + hw) / uLaneW);
        float lu = u + hw - (lane + 0.5) * uLaneW; // lệch so với tâm làn
        // nền làn: màu làn nhạt, vạch chia mực, viền bến
        col = over(col, laneCol(lane), onDock * 0.13);
        float sep = band(abs(fract((u + hw) / uLaneW + 0.5) - 0.5) * uLaneW, 0.06) * aa(abs(v) - uHalfLen) * step(abs(u), hw + 0.1);
        col = over(col, INK, sep * 0.75);
        float rim = band(max(abs(u) - hw, abs(v) - uHalfLen), 0.1);
        col = over(col, INK, rim);
        col = over(col, IVORY, band(max(abs(u) - hw, abs(v) - uHalfLen), 0.05));
        // lối ngang hai đầu bến (chỗ tránh an toàn)
        float walkway = aa(abs(u) - hw) * (step(uHalfLen, abs(v)) * aa(abs(v) - uHalfLen - 2.0));
        col = over(col, IVORY, walkway * 0.12 * (0.6 + 0.4 * step(0.5, fract((u + v) * 0.5))));
        // làn đang đứng (cược): viền sáng trong
        if (abs(lane - uBet) < 0.1) col = over(col, laneCol(lane), onDock * band(abs(lu) - uLaneW * 0.5 + 0.18, 0.06));
        // trạng thái làn
        float st = pick(uLane, lane);
        float tt = pick(uLaneT, lane);
        if (onDock > 0.0 && st > 0.5) {
          float inner = band(abs(lu) - uLaneW * 0.5 + 0.12, 0.1);
          if (st < 1.5) {
            // lộ: viền mực + gạch chéo chạy xuống + vạch "mực nước" dâng từ trống về phía người chơi (đầy = mưa)
            float level = step(uHalfLen - v, tt * uHalfLen * 2.0);
            col = over(col, INK, inner * onDock);
            col = over(col, CORAL, onDock * (0.22 + 0.45 * hatch(-v, lu * 0.4, 1.4, uTime)));
            col = over(col, CORAL, onDock * level * 0.3);
          } else {
            // mưa: lõi đặc + gợn tròn
            float rip = 0.5 + 0.5 * sin(length(fract(vec2(lu, v) * 0.5) - 0.5) * 30.0 - uTime * 10.0);
            col = over(col, WET, onDock * (0.7 + 0.25 * rip));
            col = over(col, INK, inner * onDock);
          }
        }
        // xả lũ: mũi tên chạy xuống ở 2 làn, rồi đầu sóng đặc
        if (abs(lane - uSpill.x) < 0.1 || abs(lane - uSpill.y) < 0.1) {
          if (uSpill.w > 0.5) {
            float chev = step(fract(v * 0.35 + abs(lu) * 0.35 + uTime * 1.4), 0.3);
            col = over(col, CORAL, onDock * (0.25 + 0.5 * chev));
            col = over(col, INK, onDock * band(abs(lu) - uLaneW * 0.5 + 0.12, 0.1));
          } else if (uSpill.z > -50.0) {
            float f = v - uSpill.z;
            col = over(col, FOAM, onDock * aa(abs(f) - 1.3));
            col = over(col, WET, onDock * step(0.0, f) * exp(-f * 0.35) * 0.6);
            col = over(col, INK, onDock * band(abs(f) - 1.3, 0.08));
          }
        }
        // trống hạ xuống: vòng đáp sáng ở đầu bến
        if (uExposed > 0.5) {
          float dd = length(vec2(u, v - (uDrumV - 2.5)));
          col = over(col, vec3(1.0, 0.9, 0.5), band(dd - 2.2, 0.12) * (0.7 + 0.3 * sin(uTime * 5.0)));
        }
        col.a *= uFade;
        gl_FragColor = vec4(col.rgb, col.a);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Vật liệu "phát sáng" mềm (fresnel) cho khiên / quầng — cộng sáng, không ghi chiều sâu */
export function fresnelMaterial(color: string, power = 2.2, strength = 1.4): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power }, uK: { value: strength }, uTime: { value: 0 }, uOn: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uPow, uK, uTime, uOn;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - clamp(abs(dot(vN, vV)), 0.0, 1.0), uPow);
        // vân lục giác thưa trôi lên (đọc là "khiên")
        float hex = step(0.92, fract(vP.y * 2.2 - uTime * 0.4)) * 0.35;
        float stepped = floor((f + hex) * 3.0) / 3.0;
        gl_FragColor = vec4(uColor * uK, stepped * uOn);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
