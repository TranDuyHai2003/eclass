/**
 * Shader tự viết cho phong cách anime cel-shading: vòng tròn phép, hộ thể (khiên fresnel + lục giác + gợn sóng),
 * bầu trời gradient, cỏ lay gió, linh hồn sinh vật. Tất cả procedural — không dùng asset của game khác.
 */
import * as THREE from "three";

/** Gradient 3 bậc cho MeshToonMaterial (đổ bóng kiểu anime) */
/** Dải toon: số (xám) hoặc [r,g,b] (vùng tối có sắc màu như tranh vẽ tay) */
export function toonGradient(steps: (number | [number, number, number])[] = [[0.56, 0.55, 0.74], [0.56, 0.55, 0.74], [1, 0.99, 0.97], [1, 0.99, 0.97], [1, 1, 1]]): THREE.DataTexture {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    const [r, g, b] = typeof v === "number" ? [v, v, v] : v;
    data.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255], i * 4);
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Vật liệu toon + viền sáng (rim light) */
export function toonMaterial(color: THREE.ColorRepresentation, opts: { rim?: THREE.ColorRepresentation; rimPower?: number; emissive?: THREE.ColorRepresentation } = {}) {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, emissive: opts.emissive ?? 0x000000 });
  const rim = new THREE.Color(opts.rim ?? 0xffffff);
  const power = opts.rimPower ?? 3;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uRimPower = { value: power };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;\nuniform float uRimPower;")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition) * -1.0, normal), 0.0, 1.0), uRimPower);
        gl_FragColor.rgb += uRim * smoothstep(0.45, 0.75, rimF) * 0.55;`,
      );
  };
  return mat;
}

// three chỉ đọc kênh .r của gradientMap → sửa chunk để vùng tối mang màu (một lần, trước khi biên dịch shader)
if (!THREE.ShaderChunk.gradientmap_pars_fragment.includes("gradientMap, coord ).rgb"))
  THREE.ShaderChunk.gradientmap_pars_fragment = THREE.ShaderChunk.gradientmap_pars_fragment.replace(
    "return vec3( texture2D( gradientMap, coord ).r );",
    "return texture2D( gradientMap, coord ).rgb;",
  );

export const GRADIENT = typeof document !== "undefined" ? toonGradient() : (null as unknown as THREE.DataTexture);

// ───────────── Vòng tròn phép ─────────────

/** Texture ký tự toán trên vòng (vẽ bằng canvas một lần) */
export function glyphRingTexture(glyphs = "∫∂Σπ∞√Δf′θλ∮≈∇φ", size = 1024): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, size, size);
  g.translate(size / 2, size / 2);
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Hai vòng chữ
  const rings = [
    { r: size * 0.4, font: size * 0.055, n: 24 },
    { r: size * 0.27, font: size * 0.04, n: 16 },
  ];
  for (const ring of rings) {
    g.font = `600 ${ring.font}px "Times New Roman", serif`;
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2;
      g.save();
      g.rotate(a);
      g.translate(0, -ring.r);
      g.fillText(glyphs[i % glyphs.length], 0, 0);
      g.restore();
    }
  }
  // Ngôi sao 6 cánh + đa giác ở giữa
  g.lineWidth = size * 0.004;
  const star = (n: number, r: number, skip: number) => {
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ((i * skip) / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  star(6, size * 0.2, 2);
  star(5, size * 0.12, 2);
  // Đồ thị bậc ba nhỏ ở tâm — chữ ký của Thung lũng Hàm số
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * 2 - 1;
    const y = x * x * x - 0.75 * x;
    const px = x * size * 0.075;
    const py = -y * size * 0.12;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const magicCircleShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#ffd27a") },
    uColor2: { value: new THREE.Color("#7ad7ff") },
    uGlyphs: { value: null as THREE.Texture | null },
    uIntensity: { value: 1 },
    uReveal: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColor; uniform vec3 uColor2; uniform sampler2D uGlyphs;
    uniform float uIntensity; uniform float uReveal;
    varying vec2 vUv;
    float ring(float r, float c, float w) { return 1.0 - smoothstep(0.0, w, abs(r - c)); }
    mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float ang = atan(p.y, p.x);
      // Lộ dần theo góc khi vòng phép xuất hiện
      float reveal = step((ang + 3.14159) / 6.28318, uReveal);
      float a = 0.0;
      a += ring(r, 0.96, 0.012) + ring(r, 0.9, 0.006) + ring(r, 0.62, 0.008) + ring(r, 0.5, 0.004);
      // Vạch chia độ chạy quanh vành
      float ticks = step(0.92, fract((ang + uTime * 0.3) * 60.0 / 6.28318)) * step(0.9, r) * step(r, 0.96);
      a += ticks * 0.8;
      // Ký tự: vòng ngoài quay thuận, vòng trong quay nghịch
      vec2 q1 = rot(uTime * 0.25) * p;
      vec2 q2 = rot(-uTime * 0.4) * p;
      float g1 = texture2D(uGlyphs, q1 * 0.5 + 0.5).a * step(0.7, r);
      float g2 = texture2D(uGlyphs, q2 * 0.5 + 0.5).a * step(r, 0.7);
      a += g1 + g2;
      a *= step(r, 1.0) * reveal;
      float pulse = 0.75 + 0.25 * sin(uTime * 3.0 - r * 8.0);
      vec3 col = mix(uColor2, uColor, smoothstep(0.2, 0.95, r)) * (1.2 + pulse);
      // Quầng sáng mềm
      float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.18 * reveal;
      gl_FragColor = vec4(col, clamp(a * pulse + glow, 0.0, 1.0) * uIntensity);
    }
  `,
};

// ───────────── Hộ thể (khiên) ─────────────

export const shieldShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#8fe3ff") },
    uHitPos: { value: new THREE.Vector3(0, 0, 1) },
    uHitTime: { value: -10 },
    uCrack: { value: 0 },
    uOpacity: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vView; varying vec3 vPos;
    void main() {
      vPos = normalize(position);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColor; uniform vec3 uHitPos; uniform float uHitTime; uniform float uCrack; uniform float uOpacity;
    varying vec3 vN; varying vec3 vView; varying vec3 vPos;
    // Lưới lục giác trên mặt cầu (chiếu theo kinh/vĩ độ)
    float hex(vec2 p) {
      p *= vec2(1.0, 1.1547);
      p.x += mod(floor(p.y), 2.0) * 0.5;
      p = abs(fract(p) - 0.5);
      return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0);
    }
    void main() {
      float fres = pow(1.0 - abs(dot(vN, vView)), 2.5);
      vec2 uv = vec2(atan(vPos.z, vPos.x) * 3.0, acos(vPos.y) * 6.0);
      float h = (1.0 - smoothstep(0.0, 0.08, hex(uv)));
      float t = uTime - uHitTime;
      float d = distance(vPos, normalize(uHitPos));
      float ripple = (t >= 0.0 && t < 1.2) ? (1.0 - smoothstep(0.0, 0.12, abs(d - t * 1.6))) * (1.0 - t / 1.2) : 0.0;
      float flash = (t >= 0.0 && t < 0.25) ? (1.0 - t / 0.25) * (1.0 - smoothstep(0.0, 0.8, d)) : 0.0;
      // Vết nứt: các ô lục giác tắt dần theo uCrack
      float cell = fract(sin(dot(floor(uv), vec2(12.9898, 78.233))) * 43758.5453);
      float broken = step(cell, uCrack);
      float a = fres * 0.9 + h * (0.25 + 0.5 * fres) + ripple * 1.5 + flash;
      a *= (1.0 - broken * 0.85);
      vec3 col = uColor * (1.0 + ripple * 2.0 + flash * 2.0) + vec3(1.0) * flash * 0.6;
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
    }
  `,
};

// ───────────── Bầu trời ─────────────

export const skyShader = {
  uniforms: {
    uTop: { value: new THREE.Color("#3b8cff") },
    uMid: { value: new THREE.Color("#9fd3ff") },
    uHorizon: { value: new THREE.Color("#ffd9c2") },
    uSunDir: { value: new THREE.Vector3(0.3, 0.35, -1).normalize() },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform float uTime;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 col = mix(uHorizon, uMid, smoothstep(-0.05, 0.25, h));
      col = mix(col, uTop, smoothstep(0.25, 0.9, h));
      float sun = max(dot(vDir, uSunDir), 0.0);
      col += vec3(1.0, 0.92, 0.75) * (pow(sun, 600.0) * 3.0 + pow(sun, 12.0) * 0.35);
      // Dải cực quang mảnh
      float band = sin(vDir.x * 6.0 + uTime * 0.05) * 0.04 + 0.42;
      col += vec3(0.6, 0.9, 1.0) * (1.0 - smoothstep(0.0, 0.03, abs(h - band))) * 0.25;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ───────────── Cỏ lay gió (instanced) ─────────────

export const grassShader = {
  uniforms: {
    uTime: { value: 0 },
    uBase: { value: new THREE.Color("#1f6b3a") },
    uMid: { value: new THREE.Color("#4fa04e") },
    uTip: { value: new THREE.Color("#a6d86a") },
    uPlayer: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    uniform float uTime; uniform vec3 uPlayer;
    varying float vH; varying float vVar;
    void main() {
      vH = uv.y;
      vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
      // Biến thiên theo cụm (giá trị giả ngẫu nhiên theo vị trí gốc)
      vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vVar = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
      float sway = sin(uTime * 1.4 + root.x * 0.5 + root.z * 0.35) * 0.14 + sin(uTime * 2.7 + root.x * 1.3) * 0.04;
      world.x += sway * vH * vH;
      world.z += sway * 0.5 * vH * vH;
      vec2 away = world.xz - uPlayer.xz;
      float d = length(away);
      world.xz += normalize(away + 1e-4) * (1.0 - smoothstep(0.0, 1.1, d)) * 0.3 * vH;
      world.y -= (1.0 - smoothstep(0.0, 1.1, d)) * 0.12 * vH;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uBase; uniform vec3 uMid; uniform vec3 uTip; varying float vH; varying float vVar;
    void main() {
      vec3 mid = mix(uMid, uMid * vec3(1.08, 1.0, 0.85), vVar);
      vec3 c = mix(uBase, mid, smoothstep(0.0, 0.55, vH));
      c = mix(c, uTip, smoothstep(0.6, 1.0, vH) * (0.5 + 0.5 * vVar));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

// ───────────── Mặt đất kiểu tranh vẽ ─────────────

/** Mặt đảo: mảng cỏ đậm nhạt (value noise), lối lát đá ấm, vòng đá giữa, tối dần về mép + bóng mờ dưới nhân vật */
export const groundShader = {
  uniforms: {
    uRadius: { value: 15 },
    uGrassA: { value: new THREE.Color("#3f8f4a") },
    uGrassB: { value: new THREE.Color("#6eb35a") },
    uStone: { value: new THREE.Color("#cdb994") },
    uStoneDark: { value: new THREE.Color("#a48f6e") },
    uPlayer: { value: new THREE.Vector3() },
    uGrassTex: { value: null as THREE.Texture | null },
    uPathTex: { value: null as THREE.Texture | null },
    uUseTex: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vXZ;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vXZ = w.xz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uRadius; uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uStone; uniform vec3 uStoneDark; uniform vec3 uPlayer;
    uniform sampler2D uGrassTex; uniform sampler2D uPathTex; uniform float uUseTex;
    mat2 rot2(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
    varying vec2 vXZ;
    float h(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
    float n(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float cells(vec2 p) {
      vec2 i = floor(p), f = fract(p); float d = 1.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h(i + g), h(i + g + 17.0));
        d = min(d, length(g + o - f));
      }
      return d;
    }
    void main() {
      float r = length(vXZ);
      float patches = n(vXZ * 0.35) * 0.65 + n(vXZ * 1.3) * 0.35;
      vec3 col = mix(uGrassA, uGrassB, smoothstep(0.3, 0.75, patches));
      if (uUseTex > 0.5) {
        // Texture vẽ tay: hai lần lấy mẫu khác tỉ lệ + xoay để không lộ ô lặp; nhiễu lớn điều biến sáng tối
        vec3 g1 = texture2D(uGrassTex, vXZ * 0.22).rgb;
        vec3 g2 = texture2D(uGrassTex, rot2(0.7) * vXZ * 0.09 + 0.37).rgb;
        col = mix(g1, g2, 0.45) * mix(0.72, 0.98, patches);
      }
      // Lối đi + vòng đá
      float path = (1.0 - smoothstep(1.05, 1.2, abs(vXZ.x))) * (1.0 - smoothstep(0.9, 1.1, vXZ.y)) * smoothstep(-9.1, -8.9, vXZ.y);
      float ring = (1.0 - smoothstep(0.0, 0.08, abs(r - 3.7) - 0.45));
      float stoneMask = max(path, ring);
      float c = cells(vXZ * 1.6);
      vec3 stone = mix(uStoneDark, uStone, smoothstep(0.05, 0.35, c));
      if (uUseTex > 0.5) stone = texture2D(uPathTex, vXZ * 0.35).rgb;
      col = mix(col, stone, stoneMask * 0.92);
      // Tối dần ra mép, viền sáng nhẹ ở rìa đảo
      col *= mix(1.0, 0.72, smoothstep(uRadius * 0.6, uRadius, r));
      // Bóng mờ dưới nhân vật
      col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.75, length(vXZ - uPlayer.xz)));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

// ───────────── Linh hồn sinh vật ─────────────

export const spiritShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#5ad1a8") },
    uFeral: { value: 0 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime; uniform float uFeral;
    varying vec3 vN; varying vec3 vView;
    void main() {
      vec3 p = position;
      float wob = sin(p.y * 6.0 + uTime * 4.0) * 0.04 + sin(p.x * 9.0 + uTime * 7.0) * 0.03 * uFeral;
      p += normal * wob;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uFeral; uniform float uFade; uniform float uTime;
    varying vec3 vN; varying vec3 vView;
    void main() {
      float f = pow(1.0 - abs(dot(vN, vView)), 1.8);
      float core = smoothstep(0.0, 0.6, 1.0 - f);
      vec3 c = mix(uColor, vec3(1.0, 0.25, 0.35), uFeral * (0.6 + 0.4 * sin(uTime * 10.0)));
      vec3 col = c * (0.6 + f * 2.2) + vec3(1.0) * core * 0.35;
      gl_FragColor = vec4(col, (0.55 + f * 0.45) * uFade);
    }
  `,
};
