/**
 * Chỗ đặt mặt trong các khung vẽ bằng SVG (components/profile/FrameRing.tsx): [bán kính, lệch ngang, lệch dọc] theo cạnh ô.
 * Đo 28/11/2026: vẽ riêng từng khung trên nền trong suốt (480px), bán kính lớn nhất quanh tâm mà ≥ 92% chu vi chưa chạm
 * nét khung, +0,01 để viền khung phủ nhẹ mép mặt (không hở khe trắng). Khung tranh vẽ tay dùng CUT_FRAME_FACE (lib/game/cut-art.ts).
 * Thêm / sửa khung SVG → đo lại theo cách trên rồi cập nhật bảng này (tests/game/frame-face.test.ts kiểm đủ khung).
 */
export const SVG_FRAME_FACE: Record<string, [number, number, number]> = {
  "frame-blue": [0.313, 0, 0],
  "frame-butterfly": [0.328, 0, 0],
  "frame-challenger": [0.317, 0, 0],
  "frame-diamond": [0.328, 0, 0],
  "frame-fairy": [0.328, 0, 0],
  "frame-galaxy": [0.328, 0, 0],
  "frame-gold": [0.318, 0, 0],
  "frame-leaf": [0.328, 0, 0],
  "frame-master": [0.303, 0, 0],
  "frame-phoenix": [0.31, 0, 0],
  "frame-rainbow": [0.32, 0, 0],
  "frame-rose": [0.323, 0, 0],
};
