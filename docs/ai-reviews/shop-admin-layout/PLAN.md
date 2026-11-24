# Tiệm quà: bố cục theo mẫu mới + quản lý quà ngay trong tiệm (admin) + làm đẹp thẻ quà / vé / rương

Yêu cầu của thầy (24/11/2026): "tham khảo bố cục (ảnh mẫu Gemini), cho quản lý quà ngay trong tiệm (chỉ admin) cấu hình đầy đủ,
cải thiện giao diện các quà, đặc biệt quà hiện vật, thẻ đặc quyền và rương (tham khảo game Adorable Home)".
Chỉ tham khảo phong cách (ấm, pastel, viền mực, đồ vật dễ thương); tranh / tên / giao diện là của mình, không chép game.

## A. Bố cục (theo ảnh mẫu)
- Thanh gỗ: Trang chủ · Túi Đồ (số món) · tiêu đề · ví xu · kim cương · **Nộp Bài** · **Thẻ Cào** · lịch sử · loa.
  (Bỏ "Menu" của mẫu — thầy đã bỏ menu tiệm.)
- Hàng hồ sơ: thẻ hồ sơ (ảnh + tên + khối + danh hiệu + thanh cấp + dải nút nhỏ: Đổi viền & bảng tên · Bảng Vàng Khối ·
  Danh hiệu · Hồ sơ [· Quản lý quà nếu admin]) + thẻ mèo linh vật **cạnh bên** (điện thoại: xếp dọc).
- Danh mục trái có biểu tượng từng mục; cuối danh mục nút xanh **Mở Đài Cầu Nguyện** (mở Hộp bí ẩn).
- Đầu lưới: khung tiêu đề (số món) + chip độ hiếm.
- Giữ nguyên data-testid cũ để E2E không vỡ.

## B. Quản lý quà trong tiệm (chỉ ADMIN)
- Trang /rewards với admin: tải thêm danh sách quà đầy đủ (cả quà đang ẩn) + danh sách lớp.
- Nút "Quản lý quà" bật chế độ quản lý: thẻ "+ Thêm quà" đầu lưới, mỗi thẻ quà có Sửa · Ẩn/Hiện · Xoá; nút "Thêm cả bộ quà mẫu".
- Hộp sửa quà (theme tiệm): biểu tượng, tên, mô tả, loại (Quà hiện vật / Thẻ đặc quyền), chỉ học sinh offline, giá xu,
  chi phí thật (đ), số lượng (trống = không giới hạn), giới hạn mỗi tháng, lớp áp dụng, bật/ẩn; thẻ xem trước trực tiếp.
- Dùng lại server action có sẵn (saveReward / archiveReward / addShopRewardTemplates — đã kiểm quyền ở server).
- Xoá cần bấm hai lần (không dùng confirm() của trình duyệt).

## C. Giao diện quà
- Quà hiện vật: khung ảnh như hộp quà (ruy băng chéo góc + nơ), nhãn "Nhận tại lớp", nhãn "Sắp hết" khi còn ≤ 3.
- Thẻ đặc quyền: khung ảnh như tấm vé (khuyết tròn hai bên, đường xé chấm, cuống vé "VÉ"), ghi giới hạn mỗi tháng.
- Rương: tia sáng xoay sau rương, bệ đỡ + bóng, rương bồng bềnh, lấp lánh, lắc nhẹ khi rê; dừng khi ngoài màn hình.

## Kiểm thử
- Unit: (không đổi logic server) — giữ nguyên.
- E2E: admin bật quản lý → thêm quà mới qua hộp sửa → thấy trong lưới → ẩn → sửa giá → xoá; học sinh không thấy nút quản lý;
  bố cục 320/390/1366 không tràn; các nút cũ (testid) vẫn hoạt động.
