# Gemini (web, model Neon) — góp ý giao diện các trang học sinh

Ngày 2026-11-21. Đầu vào: 7 ảnh chụp (trang học bài 1366/390, trang chủ 1366/390, khoá học, hồ sơ, xếp hạng) với tài khoản học sinh mẫu ở DB local.
Báo cáo là **dữ liệu tham khảo**; Claude kiểm chứng từng ý với code thật trước khi làm.

## Tóm tắt góp ý của Gemini

**Hệ thiết kế chung**
- Giữ #2563EB / #EBF3FF; thẻ trắng viền mảnh; chỉ dùng viền 2px + bóng đáy + nút 3D cho CTA chính và trạng thái đang chọn.
- Bỏ viết HOA toàn bộ (tiêu đề bài, tên chương, nhãn form) → sentence case; thang chữ 22–24 / 16–18 / 14–15 / 12px.
- Bỏ nút "Khoá học" lặp trên topbar (đã có ở sidebar).

**1. Trang học bài (ưu tiên 1)**
- Thảo luận chiếm cột phải, danh sách chương bị đẩy xuống dưới video → đổi chỗ: danh sách chương/bài ở cột phải (dính, cuộn riêng), thảo luận dưới bài học.
- Tiến độ 0% hiện 2 lần (đường dẫn + khối học phần) → giữ một chỗ.
- Thiếu nút Bài trước / Bài sau cạnh "Hoàn thành bài".
- Chương đang học bị đóng, không biết mình ở đâu; mỗi chương nên có tiến độ (1/5).
- Điện thoại: tên chương bị cắt cụt; cuộn quá dài → thanh 2 tab "Nội dung bài học · %" | "Thảo luận · n".
- Trạng thái nút hoàn thành: chưa xong = xanh đặc; đã xong = nền xanh lá nhạt, viền xanh lá.
- Badge "STAFF" nền đen → "Giáo viên" nền xanh nhạt.

**2. Trang chủ**: hai banner xanh đậm cạnh tranh nhau (chào + đếm ngược) → đếm ngược thành thẻ trắng; thẻ Tiệm quà trống nhiều → 1 hàng gọn; 1 khoá học lẻ trong lưới 3 cột → thẻ ngang khi chỉ có 1–2 khoá; nút "Bắt đầu học" nên là "Tiếp tục: <bài dang dở>".

**3. Danh sách khoá học**: trống 75% màn khi có 1 khoá → thẻ ngang lớn; thêm tab lọc (Tất cả / Đang học / Đã hoàn thành); thẻ thêm tiến độ.

**4. Hồ sơ**: lạm dụng chữ HOA; nút Đăng xuất sát nút Lưu; ô email trống trông như lỗi; đổi mật khẩu 3 ô một hàng chật → bố cục 4/8 cột, mắt ẩn/hiện trong từng ô.

**5. Bảng xếp hạng**: nền tối "RPG" lệch hệ thiết kế, tương phản thấp, chỉ số rối, streak lặp 2 lần, tên bài bị cắt → đưa về nền sáng đồng bộ.

**Thứ tự ưu tiên**: Học bài → Trang chủ → Xếp hạng → Khoá học → Hồ sơ.

## Claude kiểm chứng

| Góp ý | Kết luận | Đã làm / lý do |
|---|---|---|
| Danh sách chương nằm dưới video, thảo luận chiếm cột phải | Đúng (page.tsx: CourseSidebar ở cột trái, CommentSection ở cột phải xl) | Đổi chỗ: cột phải 380–420px dính theo màn hình, cuộn riêng; thảo luận dưới bài học. `CommentSection` trước đây render **2 lần** (bản điện thoại + bản máy tính) → giờ chỉ 1 lần |
| Tiến độ hiện 2 lần | Đúng | Bỏ thanh tiến độ ở đường dẫn; khối nội dung hiện "x/y bài · z%" |
| Thiếu Bài trước / Bài sau | Đúng | Thêm 2 nút theo thứ tự chương → bài |
| Chương đang học bị đóng mặc định | Đúng một phần | Chương đóng khi mới vào là **chủ ý của người dùng** (commit 9c0dc99) → giữ nguyên; thay vào đó chương chứa bài đang học được tô xanh + nhãn "Đang học", mỗi chương có "x/y bài", chương xong có dấu tích |
| Tên chương bị cắt trên điện thoại | Đúng (`line-clamp-1 uppercase`) | Bỏ chữ HOA, cho 2 dòng |
| Cuộn dài trên điện thoại | Đúng | Thanh 2 tab "Nội dung khoá học · %" / "Thảo luận · n" (chỉ < xl) |
| Nhãn "KIỂM TRA" trên bài video gây hiểu nhầm | Đúng một phần: bài loại QUIZ nhưng có video | Nhãn theo nội dung đang hiện: "Video bài giảng" / "Hướng dẫn bài tập" / "Bài kiểm tra" / "Tài liệu" |
| Trạng thái nút Hoàn thành | Hợp lý | Nút 3D xanh; đã xong = nền xanh lá nhạt, viền xanh lá, bấm lại để bỏ |
| Bỏ nút "Khoá học" trên topbar | Chưa làm | Topbar dùng chung mọi trang; sidebar trái không hiện trên điện thoại/tablet → cần xem kỹ trước khi bỏ |
| Bảng xếp hạng đưa về nền sáng | Chưa làm | Giao diện "thợ săn" là thiết kế riêng đã có từ trước → hỏi người dùng trước khi thay hẳn |
| Trang chủ, khoá học, hồ sơ | Đang làm theo thứ tự ưu tiên | Xem các commit tiếp theo |
