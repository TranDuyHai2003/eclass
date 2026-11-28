/**
 * Uniform dùng chung của phòng điều khiển Siêu khối (tách riêng để đạo cụ trong phòng import không tạo vòng với TessRoom).
 */
import * as THREE from "three";

/** Đồng phục chia sẻ cho mọi shader của phòng (cập nhật 1 lần / khung) */
export const ROOM_U = {
  uT: { value: 0 },
  uTravel: { value: 0 }, // 0..1 cường độ du hành (lên rồi xuống)
  uIris: { value: 0 },
  uPlayer: { value: new THREE.Vector3() }, // toạ độ cục bộ của người chơi trong phòng
  uExposure: { value: 1.15 },
  uFloor: { value: 0.32 }, // sàn tối thiểu (bóng không đen kịt)
  uTint: { value: new THREE.Color(1, 1, 1) }, // nhuốm màu phòng khi du hành
  uScale: { value: 7.0 },
};

/**
 * Đạo cụ nướng theo chuẩn của sảnh (p97 ≈ 1,48, sàn 0,3) sáng hơn nhiều so với bản nướng của phòng (uScale 7) → bộ uniform
 * riêng: dùng chung phơi sáng / sàn / nhuốm màu du hành của phòng, chỉ khác hệ số.
 */
export const PROP_U = { uExposure: ROOM_U.uExposure, uFloor: ROOM_U.uFloor, uTint: ROOM_U.uTint, uScale: { value: 1.15 } };
