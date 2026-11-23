# Tùy chỉnh khuôn mặt từng bộ phận (tham khảo cách phối mặt của game kiểu Gunny)

## Mục tiêu
Ngoài "Khuôn mặt" (6 mặt vẽ tay của mẫu), học sinh phối **từng bộ phận**: Mắt, Miệng, Trang điểm/sticker,
như ô "mặt/biểu cảm" trong game nhập vai. Giữ nét vẽ tay, không đổi sang nhân vật SVG.

## Dữ liệu
- `AvatarConfig` thêm 3 trường miễn phí (giống `face`, không phải món, không DB mới):
  `eyeShape`, `mouth`, `faceDeco` — id trong `lib/game/face-parts.ts`; `null` = bộ phận của khuôn mặt nền.
- `sanitizeAvatar` chỉ giữ id hợp lệ. `presetIndexOf` coi cấu hình có bộ phận riêng là "tự chỉnh" (-1).
- Chọn mẫu → xoá bộ phận riêng.

## Lựa chọn
- Mắt: mắt vẽ tay của 6 mẫu + cười (^^), nhắm, nháy mắt, long lanh, trái tim, xoáy (choáng), quyết tâm.
- Miệng: cười tươi, ngạc nhiên, lè lưỡi, miệng mèo, răng khểnh, phụng phịu, cười nhếch.
- Trang điểm: má hồng, ngượng, tàn nhang, sticker sao, sticker tim, băng cá nhân, ria mèo, giọt mồ hôi.

## Vẽ
- `scripts/studio/gen-face-assets.py` sinh `faces-blank.webp`: 6 mặt đã xoá mắt + miệng (lấp màu da bằng nội suy điều hoà).
- Có bộ phận riêng → mặt = mặt trơn của khuôn mặt nền + mắt (ảnh mắt của mặt nguồn qua mặt nạ elip mờ, hoặc nét vẽ SVG)
  + miệng (miệng gốc qua mặt nạ hoặc nét SVG) + trang điểm (SVG). Cùng hệ toạ độ mặt (68×46 đơn vị, mắt ở 45.5/74.5, 61).
- Đầu vẽ tay chưa chọn mặt riêng mà có bộ phận → dán mặt của chính tranh đó làm nền. Hiệp sĩ / nhà du hành (mũ kín,
  không có trong FACES) bỏ qua bộ phận.
- Nhân vật SVG dự phòng (phụ kiện ngoài mẫu) dùng cùng thành phần mặt.

## Giao diện
Mục "Khuôn mặt" ở Tùy chỉnh thêm 3 hàng nút tròn (Mắt / Miệng / Trang điểm), mỗi nút xem trước bộ phận trên mặt đang dùng,
nút đầu "Mặc định"/"Không". Miễn phí.

## Kiểm thử
- Unit: sanitize, presetIndexOf, paintedLook dán mặt nền khi có bộ phận, mọi id có tên.
- E2E: chọn mắt trái tim + miệng mèo + sticker sao → nhân vật vẫn vẽ tay có `[data-eyeshape]`, lưu đúng DB.
