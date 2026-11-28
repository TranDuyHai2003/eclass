# Màn trung gian & thanh tiến độ (Thế giới Toán 3D)

Yêu cầu: "bổ sung thêm các màn trung gian, progress bar thật đẹp và sáng tạo" — học từ bài rayshader 1.0
("đẹp chỉ là điều kiện tối thiểu"; tiến độ phải THẬT, theo GIAI ĐOẠN, không giả bằng đồng hồ, không 100 % trước khi thế giới sẵn sàng).

## 1. Mô hình tiến độ theo giai đoạn (`lib/world/loadProgress.ts`, thuần + test)
| Giai đoạn | Tín hiệu thật | Xong khi |
|---|---|---|
| `assets` tải tài nguyên | drei `useProgress` (số tệp từ lúc "lên dây") | loader rảnh ≥ 200 ms |
| `build` dựng thế giới | cảnh đã gắn (Suspense xong — `LoadProbe`); Vùng Kỳ quan: số chunk gần đã có lưới / số chunk gần cần | đủ chunk gần (hoặc quá 15 s) |
| `shaders` biên dịch shader | `PrewarmShaders` báo `compileAsync` + tải texture lên GPU xong | báo xong (hoặc quá 8 s) |
| `settle` ổn định | số khung liên tiếp có dt < 100 ms | 4 khung (hoặc quá 3 s) |

- Trọng số → giá trị mục tiêu đơn điệu (không lùi khi thêm tệp vào hàng đợi), chặn ≤ 98,5 % đến khi MỌI giai đoạn xong.
- Hiển thị: lò xo tắt dần tới hạn (critically damped), không vượt mục tiêu, không lùi.
- Quá thời gian của một giai đoạn (trừ tải tài nguyên) = coi như xong để không kẹt màn chờ; ghi nhận `timedOut`.

## 2. Thanh tiến độ "hội tụ" (rayshader)
Một canvas WebGL nhỏ (độ phân giải ~0,75×, ≤ 1 ms/khung): địa hình z = f(x, y) như được dò tia (path-trace):
nhiễu Monte Carlo ∝ 1/√N (N = 2^(12p) mẫu), vùng bên phải "mặt cắt" chưa dựng còn nhiễu nặng, mặt trời quét theo tiến độ.
Biến thể theo thế giới: Quảng trường = tổng Riemann (N hình chữ nhật), Vùng Kỳ quan = khối voxel chồng dần,
Mê cung Hoạ âm = chuỗi Fourier thêm hoạ âm thành sóng vuông, Sảnh Bất Khả = cầu thang Penrose, còn lại = địa hình có đường đồng mức.
Không WebGL → thanh CSS. Giảm chuyển động → không nhấp nháy nhiễu theo khung.

## 3. Màn trung gian
1. Lỗ sâu: nhãn "Đang du hành tới …" giữa đường hầm.
2. Nối liền: lỗ sâu → màn chờ (hiện ngay dưới đường hầm, không mờ dần lần hai, nền theo màu thế giới đích) → hội tụ → thẻ chương → chơi.
   Store `useTransit` (đang bay / màn chờ: idle | armed | shown) để các màn biết nhau.
3. Thẻ chương (`AreaTitle`): lần đầu tới thế giới trong phiên = thẻ lớn (hoạ tiết SVG tự vẽ nét, chủ đề toán, tên, phụ đề);
   các lần sau = dải tên gọn như cũ. Không chặn thao tác (pointer-events: none), bấm phím / chạm bất kỳ để bỏ qua.
4. Chết / hồi sinh, thắng boss: KHÔNG làm lần này (không có móc sạch cho người chơi; combat/* đang được agent khác sửa).

## Kiểm tra
tsc, eslint, test world (`tests/world/loadProgress.test.ts`), ảnh chụp desktop + điện thoại ngang (844×390).
