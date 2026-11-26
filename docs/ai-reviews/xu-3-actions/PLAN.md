# Cơ chế cộng xu mới: chỉ 3 hành động (26/11/2026)

Theo tài liệu của thầy (ảnh "Cơ chế cộng xu") + trả lời câu hỏi cùng ngày.

## Quyết định của thầy
1. **Nộp bài tập về nhà đúng hạn: +100 xu.** Thêm **hạn nộp BTVN theo lớp** (như hạn bài kiểm tra). Có hạn → nộp trước hạn +100, sau hạn 0; chưa đặt hạn → nộp là +100. Mỗi bài 1 lần.
2. **Giáo viên duyệt chữa bài** — danh sách theo **lớp + bài tập**, hiện **cả lớp** (kể cả chưa nộp online), ô tìm tên, mỗi học sinh 3 nút: **Chưa chữa 0 · Có chữa +280 · Chữa đủ, tốt +400**. Bấm lại nút khác → xu tự điều chỉnh (thu hồi mức cũ, cộng mức mới).
3. **Giftcode**: GV tự tạo code (có thể tự đặt chữ), web lưu các code đã tạo cho tới khi được dùng; dùng 1 lần — 1 tài khoản dùng là hết.
- **Tắt** mọi nguồn xu khác: nộp bài kiểm tra, đúng hạn bài kiểm tra, điểm cao, bứt phá, thi cuối khoá, chấm Đạt BTVN online, chuỗi tuần. **Giữ thưởng tay** của thầy. Xu học sinh đã có giữ nguyên.
- **Đổi tiền ra xu: ÷ 3,6, làm tròn lên trăm, áp cho mọi thứ** — quà hiện vật, thẻ đặc quyền, thú cưng, khung, bảng tên.

## Thiết kế
### Mức xu (lib/points/config.ts)
- Mặc định mới: `testSubmit/testSubmitLate/onTimeBonus/scoreTiers/breakthrough/finalTestSubmit/homeworkPass/streak.*` = 0; `homeworkSubmit` = 100 (chỉ khi đúng hạn); mới `homeworkReview = { partial: 280, full: 400 }`.
- `awardOnce` bỏ qua số xu ≤ 0 (không ghi dòng 0 xu).
- Tab "Hoạt động kiếm xu" của admin vẫn sửa được mọi mục (bật lại nguồn cũ nếu muốn) + 2 mục duyệt chữa.
- `earningRules()` chỉ liệt kê mục > 0; chữ "+300 xu nộp bài" ở Kiếm xu / Nộp bài / trang chủ khách đổi theo cơ chế mới.

### Hạn nộp BTVN
- Model `HomeworkDeadline { lessonId, classId, dueDate }` unique (lessonId, classId).
- `onHomeworkSubmitted`: lấy hạn của lớp học sinh; quá hạn → không cộng (vẫn tính hoạt động chuỗi tuần).

### Duyệt chữa bài
- Model `HomeworkReview { lessonId, userId, level: NONE|PARTIAL|FULL, reviewedById, updatedAt }` unique (lessonId, userId).
- `PointSource` thêm `HOMEWORK_REVIEW` (tính vào xu tích luỹ / danh hiệu; không tính vào giới hạn tự động mỗi ngày).
- Khoá sổ `HWREVIEW:<lessonId>`: đổi mức → `revokeKey` rồi cộng mức mới (một giao dịch, khoá ví).
- Trang `/teacher/homework/check` (giáo viên + admin): chọn lớp → chọn bài tập (bài có BTVN thuộc khoá học của lớp) → đặt/sửa hạn nộp cho lớp → danh sách học sinh (tên, đã nộp online lúc nào / đúng hạn / trễ), ô tìm tên (không dấu), 3 nút; bấm là lưu ngay (giao diện điện thoại, dùng trong giờ học).

### Giftcode
- Đã có: lô mã, mỗi mã N lượt (mặc định 1), mỗi tài khoản 1 lần, vô hiệu lô, in thẻ.
- Thêm: ô **"Mã tự đặt"** (tạo 1 mã với chữ thầy chọn, 4–16 ký tự, không trùng); danh sách **"Mã chưa dùng"** gom mọi lô (không giới hạn 30 lô); mặc định loại tiền **Xu**.

### Giá ÷ 3,6
- `RewardEditor`: nhập "Giá tiền thật (đ)" → giá xu tự tính = `vndToXu` (vẫn sửa tay được).
- Mẫu quà: quà hiện vật `price = vndToXu(costVnd)`; thẻ đặc quyền thêm giá trị quy đổi `vnd` (= giá xu cũ ÷ 2 theo tỉ lệ cũ) → `vndToXu`.
- Quà đang có trong DB: script `scripts/reprice-rewards.ts` (xem trước / --apply): có chi phí thật → `vndToXu(costVnd)`; không có → `vndToXu(ceil(giá cũ / 2))`. Production chạy bằng SQL cùng công thức lúc deploy.

## Kiểm thử
- Unit: nộp BTVN trước / sau hạn lớp / không hạn; duyệt chữa 0 → 280 → 400 → 0 (sổ + ví + xu tích luỹ khớp); nộp bài kiểm tra không còn cộng xu; mã tự đặt trùng / sai độ dài; giá mẫu ÷3,6.
- E2E: thầy đặt hạn + duyệt chữa trong trang mới (tìm tên, bấm 3 nút) → ví học sinh; tạo mã tự đặt → học sinh nhập → hết lượt.
