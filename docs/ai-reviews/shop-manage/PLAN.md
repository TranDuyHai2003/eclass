# Quản lý tiệm trong Tiệm quà + mã quà tính xu tích luỹ + rà lỗ hổng xu (26/11/2026)

## Thầy yêu cầu
1. "Cho hết phần quản lý quà vào tiệm quà, thiết kế hợp lý, dễ chỉnh sửa cho giáo viên."
2. "Phần cộng xu từ giftcode đang không được cộng xu tích luỹ — fix."
3. "Xem lại luật, cách lấy xu, đảm bảo không có lỗ hổng hack xu nào."

## 1. Khu "Quản lý tiệm" (thay trang /teacher/rewards)
- `/rewards` nạp thêm dữ liệu quản lý cho **giáo viên + admin** (trước chỉ admin, giáo viên dùng trang riêng giao diện khác).
- Nút "🛠️ Quản lý tiệm" (dải tím trên cùng + hàng nút hồ sơ) bật khu quản lý **thay chỗ lưới quà**; "👀 Xem tiệm như học sinh" để quay lại xem kết quả.
- Mục (giữ trên địa chỉ `?manage=…`, tải lại / gửi link vẫn mở đúng mục):
  | Mục | Ai | Nội dung |
  |---|---|---|
  | 📬 Đơn đổi quà (số đơn chờ) | GV + admin | lọc lớp, chọn nhiều → Đã trao, Trao từng đơn, Từ chối (bắt buộc lý do, gợi ý nhanh, hoàn xu), Excel, lịch sử |
  | 🎁 Quà & thẻ | GV + admin | thẻ quà có ảnh, thêm / sửa (ảnh, tiền thật → xu), ẩn / hiện, xoá 2 bước, thêm nhanh từ mẫu, thêm cả bộ |
  | 🪙 Thưởng xu | GV + admin | lớp → tìm tên không dấu → tick → mức + lý do |
  | 🎟️ Mã quà tặng | GV + admin | mã tự đặt / ngẫu nhiên, xu hoặc ngọc, in thẻ, mã chưa dùng, vô hiệu lô (bấm 2 lần, bỏ `confirm()`) |
  | 📊 Thống kê | GV + admin | xu nhận / đã dùng, quà đã trao, chi phí, top tháng |
  | 🏷️ Giá đồ trang trí, ⚙️ Mức xu | chỉ admin | như cũ (server action vẫn chỉ ADMIN) |
- Nút "✍️ Duyệt chữa bài" sang `/teacher/homework/check`.
- `/teacher/rewards` → `redirect('/rewards?manage=…')`; link thanh bên "Quà & Xu" → `/rewards?manage=1`.
- Phong cách Adorable Home của tiệm (`components/shop/ah/manage/*`); xoá `components/points/TeacherRewards.tsx`, `GiftCodesTab.tsx`.

## 2. Mã quà xu → xu tích luỹ
- `GIFTCODE` vào `EARNING_SOURCES` (ngọc không bao giờ tính — `writeEntry` nhánh GEM thoát trước).
- Migration `20261126020000_giftcode_lifetime`: cộng bù tổng ròng các khoá `GIFTCODE:*` (XU) vào `lifetimeEarned`. Prod 26/11: 1 học sinh, 20.300 xu.
- Thống kê tháng của thầy dùng chung `EARNING_SOURCES` + chỉ XU (trước liệt kê tay, thiếu duyệt chữa bài / mã quà, lẫn ngọc).

## 3. Rà lỗ hổng (agent đọc code + Claude kiểm chứng)
| Lỗ hổng | Kết luận | Sửa |
|---|---|---|
| `submitHomework` nhận bài bất kỳ, tệp rỗng / URL bất kỳ → +100 xu mỗi bài (tới trần ngày 4.500) | Đúng (prod chưa bị khai thác: 0 dòng HOMEWORK_SUBMIT) | bài phải `hasHomework`, thuộc khoá học sinh được học, ≥1 tệp BTVN thật (`lib/homework-files.ts`, khớp 100% 7.156 tệp prod); thầy xoá bài nộp → thu hồi +100 |
| `deleteDraftFile` / nộp đè xoá được tệp bất kỳ trong bucket (ảnh, tài liệu bài giảng, bài bạn khác) | Đúng | chỉ xoá khoá BTVN không nằm trong bài nộp của người khác |
| Rương Xu lãi khi đủ bộ sưu tập (~688 xu / lượt 600) | Đúng (mô phỏng) | hoàn trùng 100/300/900/2400 → ~426 xu/lượt; test chặn |
| Huỷ đơn sau khi đã nhận quà trên lớp | Đúng | học sinh chỉ tự huỷ trong 2 giờ đầu; sau đó báo thầy |
| Dò mã tự đặt | Một phần | thêm trần 30 lần sai / 24 giờ |
| Học sinh online mua đồ trang trí qua action | Không phải lỗi: trang Hồ sơ cố ý bán đồ trang trí cho mọi học sinh; chỉ tiêu xu | — |
| GV tạo mã xu lớn vượt trần thưởng tay | Quyền của thầy (người tin cậy); prod có dùng mã lớn | ghi chú, không đổi |
| GameConfig prod còn mức xu cũ | Không: bảng trống | — |
| Câu thoại mèo hứa "+300 xu", "+150 xu" | Đúng (lỗi chữ) | theo mức hiện hành |

## Kiểm tra
`tsc`, `eslint`, `npm test` (DB local), e2e `points` / `anchor` / `lesson` / `landing` + site-audit trên bản build production ở mirror cổng 3056.
