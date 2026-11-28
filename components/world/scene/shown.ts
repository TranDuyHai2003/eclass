import type * as THREE from "three";
/**
 * Đối tượng có thực sự hiện không (nó và MỌI tổ tiên visible). Nhánh bị ẩn bằng visible (vd. sân ↔ đại sảnh của Thế giới
 * Bất Khả, nội dung sau cửa stencil đang đóng) vẫn chạy useFrame — callback dùng hàm này để bỏ phần trình diễn (ma trận, buffer
 * động, tải lên GPU). Không làm đổi trạng thái bài toán: chỉ phần nhìn thấy được mới dừng.
 */
export function shown(o: THREE.Object3D | null | undefined): boolean {
  if (!o) return false;
  for (let c: THREE.Object3D | null = o; c; c = c.parent) if (!c.visible) return false;
  return true;
}
