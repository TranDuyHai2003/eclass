/**
 * KIẾN TRÚC "THỞ" (Thế giới Bất Khả, chất Lovecraft): đá / vỏ ốc của quần đảo phồng – xẹp theo pháp tuyến như một sinh vật
 * khổng lồ đang ngủ — nhịp ~8 s, pha trôi chậm qua không gian (sóng thở lan từ đảo này sang đảo khác).
 *  • mặt ngang (sàn, mặt đứng) KHÔNG dịch (mặt nạ theo pháp tuyến) → chỗ đứng / va chạm không đổi;
 *  • biên độ tăng theo khoảng cách tới camera (gần vài cm, đảo xa ~0,5 m) → nhìn thấy cả quần đảo cùng thở;
 *  • BREATH.amp do cảnh điều khiển: đứng yên lâu → thở sâu, đi lại → thở rất nhẹ.
 * withBreath(m) nối thêm vào onBeforeCompile sẵn có (vật liệu nướng / hybrid / PBR) — không phá các bản vá khác.
 * Dùng thuộc tính `normal` (luôn khai báo cho mọi vật liệu lưới) chứ KHÔNG dùng `objectNormal`: MeshBasicMaterial (vật liệu
 * nướng của chế độ Hoạt hình) chỉ có beginnormal_vertex khi có envMap / skinning → "objectNormal: undeclared identifier".
 */
import * as THREE from "three";

export const BREATH = { amp: { value: 0.25 }, t: { value: 0 } };

export function withBreath(m: THREE.Material) {
  if (m.userData.breath) return m;
  m.userData.breath = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uBreathAmp = BREATH.amp;
    sh.uniforms.uBreathT = BREATH.t;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uBreathAmp; uniform float uBreathT;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      {
        vec3 bw = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float ph = dot(bw, vec3(0.021, 0.013, 0.017));
        float inhale = 0.5 + 0.5 * sin(uBreathT * 0.785 - ph * 6.2832);
        inhale = inhale * inhale * (3.0 - 2.0 * inhale);
        vec3 bN = vec3(normal);
        float side = 1.0 - smoothstep(0.55, 0.85, abs(bN.y));
        float far = clamp(0.04 + 0.0045 * distance(bw, cameraPosition), 0.04, 0.55);
        transformed += bN * uBreathAmp * far * side * inhale;
      }`,
    );
  };
  m.customProgramCacheKey = () => `${prevKey()}|breath`;
  return m;
}
