/**
 * Mờ dần vật chắn máy quay bằng dither (kiểu Genshin: tán cây / thân cây che nhân vật tan thành chấm rồi biến mất)
 * — không cần blend / sắp xếp trong suốt, vẫn ghi depth. Nhiễu IGN (Jimenez 2014) ổn định theo điểm ảnh.
 *  • sát camera (0,9–2,6 m);
 *  • nằm trên đoạn camera → nhân vật (ống bán kính ~1,6 m quanh tia nhìn, trước nhân vật) — dùng FOCUS (đầu nhân vật, cập nhật mỗi khung).
 * NEAR_FADE_GLSL khai báo uFocus + nearFade(p) với p = điểm − camera (toạ độ thế giới hoặc view đều được, f cùng hệ).
 */
import * as THREE from "three";

export const NEAR_FADE = { from: 0.9, to: 2.6 };
/** đầu nhân vật (thế giới) — cảnh cập nhật mỗi khung; 0 = tắt phần "chắn nhân vật" */
export const FOCUS = { value: new THREE.Vector3(0, -1e4, 0) };

export const NEAR_FADE_GLSL = /* glsl */ `
  uniform vec3 uFocus;
  float nfIgn(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  // p, f: điểm và đầu nhân vật, tương đối với camera, cùng hệ toạ độ
  void nearFade(vec3 p, vec3 f){
    float camDist = length(p);
    float fade = smoothstep(${NEAR_FADE.from.toFixed(2)}, ${NEAR_FADE.to.toFixed(2)}, camDist);
    float ff = dot(f, f);
    if (ff > 1.0 && ff < 3600.0) {
      float t = dot(p, f) / ff;
      if (t > 0.0 && t < 0.9) {
        float d = length(p - f * t);
        // lõi ống nhìn: TAN HẲN (trước còn 12% điểm ảnh → màn chấm sẫm vì không có TAA); chỉ mép ống còn dải dither hẹp
        fade = min(fade, smoothstep(0.75, 1.75, d));
      }
    }
    if (fade < 0.999 && nfIgn(gl_FragCoord.xy) > fade) discard;
  }
`;
