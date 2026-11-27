/**
 * Trạng thái NGÀY ↔ ĐÊM dùng chung (Quảng trường): các đối tượng { value } được gắn TRỰC TIẾP làm uniform của
 * trời, cỏ, tán lá, mặt nước, ánh nướng… → HubDayCycle cập nhật một chỗ, mọi vật liệu đổi theo (không biên dịch lại).
 *  light: hướng TỚI nguồn sáng chính (mặt trời, hoặc trăng khi đêm) — dùng để tô khối;
 *  sun / moon: hướng thật trên bầu trời (đĩa mặt trời, mặt trăng);
 *  level: độ sáng môi trường so với trưa (1 = trưa, ~0,25 = đêm) — nhân vào vật liệu tự phát sáng (nước, tia nước…);
 *  night: 0 ngày → 1 đêm (đèn đường, sao).
 */
import * as THREE from "three";

const D0 = new THREE.Vector3(-0.45, 0.38, -0.82).normalize();

export const DAY = {
  light: { value: D0.clone() },
  sun: { value: D0.clone() },
  moon: { value: D0.clone().multiplyScalar(-1) },
  lightCol: { value: new THREE.Color(1, 0.96, 0.9) },
  sunK: { value: 1 },
  level: { value: 1 },
  night: { value: 0 },
  zen: { value: new THREE.Color(0.12, 0.3, 0.72) },
  hor: { value: new THREE.Color(0.78, 0.6, 0.86) },
  /** cỏ: ánh môi trường + nắng (đã nhân mức) */
  grassAmb: { value: new THREE.Color(0.58, 0.6, 0.62) },
  grassSun: { value: new THREE.Color(0.78, 0.72, 0.6) },
  /** đang chạy chu kỳ ngày đêm (chỉ Quảng trường) */
  active: false,
};
