# Nhiệm vụ ẩn + biệt danh + bảng cấp mới (theo tài liệu "Biệt danh" của thầy, 24/11/2026)

Quyết định của thầy: (1) đổi cả tên và mốc xu cấp như tài liệu; (2) hoàn thành nhiệm vụ ẩn → biệt danh **tự đeo ngay**,
đổi lại được; (3) bảng "Nhiệm vụ ẩn" trong tiệm hiện ô **???** cho nhiệm vụ chưa mở (kèm gợi ý mơ hồ).

## Bảng cấp (xu tích luỹ, chỉ từ học — tiêu xu không tụt cấp)
| Lv | Mốc | Tên |
|---|---|---|
| 1 | 0 | 🐕 Chó rách hết tiền |
| 2 | 2.000 | 🥚 Trứng bắc thảo nghèo khó |
| 3 | 5.000 | 🍳 Trứng bắc thảo đủ ăn nhưng gầy tong teo |
| 4 | 9.000 | 💼 Trứng bắc thảo béo đã đi làm lương 5 triệu/tháng |
| 5 | 13.000 | 🪞 Soi gương lại thấy mình cũng hơi đẳng cấp 1 chút |
| 6 | 20.000 | 😎 Người đẳng cấp |
| 7 | 25.000 | 🌀 Trùng sinh tôi sở hữu hệ thống thần hào |
| 8 | 30.000 | 🚲 Thiếu Gia (nam) / Tiểu Thư Hào Môn (nữ) Giả Nghèo Đi Học Bằng Xe Đạp Điện Nhưng Ví Có 999 Tỷ Xu |
Món mở theo cấp (minLevel) giữ theo số cấp.

## Nhiệm vụ ẩn → biệt danh (danh hiệu ô `title`, nguồn QUEST, không bán / không vào rương)
| Biệt danh | Điều kiện | Thời hạn |
|---|---|---|
| ⏰ Chuyên Gia Nộp Bài Phút 89 | nộp bài kiểm tra trong 30 phút cuối trước hạn | vĩnh viễn |
| 🍀 Con Cưng Của Thần May Mắn | mở Hộp bí ẩn ra món Sử thi / Huyền thoại | vĩnh viễn |
| 🦉 Cú Đêm Tu Tiên Không Ngủ | nộp bài (kiểm tra / bài tập) 0h–3h sáng | vĩnh viễn |
| 🌅 Người Dậy Sớm Để Thành Công | nộp bài 5h–8h sáng | vĩnh viễn |
| 🐢 Chú Rùa Lạc Đường (Lần Đầu Vấp Ngã) | lần đầu nộp trễ hạn sau chuỗi 5 bài đúng hạn | vĩnh viễn |
| 🐉 Con Rồng Ngồi Trên Đống Vàng | tích trên 5.000 xu mà chưa từng tiêu xu (đổi quà / mua đồ / mở hộp) | vĩnh viễn |
| 🧻 Người Mở Đường Khăn Giấy Hoạt Hình | người đầu tiên trong lớp đổi quà "Túi giấy ăn nhỏ hoạt hình" | vĩnh viễn |
| 🚀 Trùng Sinh Lội Ngược Dòng | điểm bài kiểm tra tăng ≥ 2,5 so với bài trước | vĩnh viễn |
| 👹 Quái Vật Điểm 10 Không Cảm Xúc | đạt điểm 10 tròn (bản đầu: bỏ vế "cào trúng thẻ đặc biệt" — chưa có khái niệm thẻ đặc biệt) | vĩnh viễn |
| 😺 Con Sen Nghiện Mèo Hết Thuốc Chữa | vuốt ve mèo chủ tiệm ≥ 20 lần trong 1 ngày | 24 giờ |

## Kỹ thuật
- Migration nhỏ (chỉ thêm): `ItemSource` thêm `QUEST`; `UserItem.expiresAt` (null = vĩnh viễn). Món hết hạn không tính là sở hữu.
- `lib/game/quests.ts`: định nghĩa + `grantQuestInTx` (thêm món, tự đeo, thông báo) + bộ kiểm tra điều kiện.
- Chạy trong **giao dịch riêng sau khi cộng điểm** (lỗi nhiệm vụ không ảnh hưởng nộp bài / điểm).
- Gắn vào: nộp bài kiểm tra, nộp bài tập, mở hộp, đổi quà, vuốt ve mèo (client đếm, server cấp 24h, chống gọi dồn).
- Giao diện: chip biệt danh dưới tên ở tiệm; nút "🕵️ Nhiệm vụ ẩn x/10" mở bảng (đã mở: tên + cách đạt; chưa mở: ??? + gợi ý);
  hộp "Hoàn thành nhiệm vụ ẩn!" khi vào tiệm có biệt danh mới; thông báo chuông.

## Kiểm thử
Unit (DB local): từng điều kiện (giờ VN, 30 phút cuối, chuỗi 5 đúng hạn → trễ, tăng 2,5 điểm, điểm 10, chưa tiêu xu > 5.000,
người đầu tiên trong lớp, 24h hết hạn), cấp lại không trùng, tự đeo. Cập nhật test cấp. E2E: bảng nhiệm vụ ẩn hiện ???.
