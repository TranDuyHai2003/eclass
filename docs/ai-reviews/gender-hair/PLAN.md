# Chọn Nam / Nữ + 10 kiểu tóc mỗi giới (tham khảo cách chọn nhân vật của game kiểu Gunny)

## Mục tiêu
Ở "Tùy chỉnh", học sinh chọn **Nam** hoặc **Nữ**; mỗi giới có 10 kiểu tóc vẽ tay (cùng nét tranh), danh sách Kiểu tóc lọc theo giới.

## Dữ liệu
- `AvatarConfig.gender`: `"male" | "female"` (miễn phí, không phải món). Chưa có → suy từ kiểu tóc đang dùng (tóc nữ → nữ, còn lại → nam)
  nên nhân vật cũ không đổi.
- `Item.gender` cho món tóc. Món tóc mới gắn `studio: true` (bán ở Hồ sơ & Trang trí, **không vào bể rương** → tỉ lệ rương giữ nguyên),
  vài kiểu miễn phí, còn lại giá xu theo độ hiếm.
- Mặc định nhân vật (`defaultAvatar`) không đổi (tóc ngắn của mẫu Học sinh nam).

| Nam (10) | Nữ (10) |
|---|---|
| Tóc ngắn, Tóc dựng, Mohawk (có sẵn) | Tóc bob, Đuôi ngựa, Hai bím, Tóc dài, Búi củ tỏi (có sẵn) |
| Đầu đinh, Rẽ ngôi lệch (miễn phí) | Tóc tém (miễn phí) |
| Vuốt ngược, Xoăn bồng, Tóc wolf, Dài lãng tử, Búi samurai | Hai đuôi cao, Đuôi lệch vai, Xoăn sóng dài, Búi đôi |

## Vẽ (scripts/studio/gen-face-assets.py + hair_paint.py)
- Kiểu thêm tóc lên đầu có sẵn: đầu tóc ngắn (nam) / tóc bob (nữ) + lớp tóc vẽ thêm (trước / sau lưng), như đuôi ngựa, tóc dựng.
- Kiểu phải đổi hẳn phần tóc (đầu đinh, vuốt ngược, rẽ ngôi, tóc tém): **đầu trọc** = tranh đã xoá tóc, lấp da trán/đỉnh đầu,
  rồi vẽ chỏm tóc + mái mới bằng `paint_lock` (toạ độ theo đơn vị mặt → dùng chung cho đầu nam và nữ).
- Mỗi kiểu là một ô mới trong char-heads / char-hairback (HAIR_HEADS), tô màu tóc / màu da / dán mặt như các ô khác.

## Giao diện
"Tùy chỉnh": hàng **Giới tính** (Nam / Nữ) trên cùng. Đổi giới → kiểu tóc chuyển về kiểu mặc định của giới đó nếu kiểu đang dùng
không thuộc giới, mặt nền theo đầu của kiểu tóc. Chọn kiểu tóc của giới kia (từ tiệm "Thử trên hồ sơ") → tự đổi giới.

## Kiểm thử
- Unit: mỗi giới đúng 10 kiểu tóc, mọi kiểu có đầu vẽ tay, kiểu mới không vào bể rương, sanitize `gender`, suy giới cho cấu hình cũ.
- E2E: chọn Nữ → chỉ thấy tóc nữ, chọn một kiểu mới → vẽ tay, lưu đúng DB.
