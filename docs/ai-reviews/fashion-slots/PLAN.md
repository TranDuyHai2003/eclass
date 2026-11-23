# Tủ đồ kiểu game nhập vai: nhiều ô phụ kiện + thẻ kiểu tóc có ảnh (tham khảo cách tổ chức của Gunny)

Chỉ tham khảo **cách tổ chức và cách chọn** (ô trang bị, tab, thẻ món); tranh, tên món, giao diện vẫn là của mình.

## Tìm hiểu (23/11/2026)
Nguồn: ảnh cửa hàng thầy gửi; [Gunny PC — Thời trang](https://gunnypc.vnggames.com/gioi-thieu-2020/gioi-thieu-28/thoi-trang.html);
[Gunny PC — Phụ kiện thời trang](https://gunnypc.vnggames.com/tin-tuc-2020/hang-ngay/huong-dan-phu-kien-thoi-trang-gunnypc.html);
[Kenh14 — Gunny Origin](https://kenh14.vn/chiem-nguong-nhung-bo-thoi-trang-xinh-lung-linh-ma-chi-gunny-origin-moi-co-20220401221249654.chn).

- Nhân vật có **nhiều ô thời trang riêng**, đeo cùng lúc: nón, tóc, áo, bộ (set), mắt kính, mặt, mắt, cánh (Gunny Origin: 9 ô).
  Gunny PC chia hai nhóm: *Trang phục* (áo, nón, mắt kính, trang sức, set quần áo) và *Làm đẹp* (tóc, cánh, mắt, mặt nạ).
- Đồ **theo giới**: nam / nữ có tóc, áo, nón, kính khác nhau.
- **Set quần áo** mặc đè: chỉ hiện hình của set, che trang phục đang mặc.
- Cửa hàng (ảnh): tab **Nam / Nữ**, tab danh mục (**Tóc · Cánh · Mắt · Mặt nạ**), lưới thẻ 2 cột: ảnh món trên **đầu trơn không mặt**,
  tên, giá, nút **Chọn**, nhãn **Mới / Hot**, phân trang (1/7).
- Có **rương thời trang**, **lưu 3 kiểu phối đồ**, **bộ sưu tập** (đủ món một bộ được thưởng). Các trang không nói gì về
  thử đồ, giá cụ thể, đồ có hạn.

## So với web hiện tại
| Gunny | Mình đang có | Thiếu |
|---|---|---|
| Ô nón, kính, mặt nạ, cánh, trang sức riêng | 1 ô "Phụ kiện" (đeo 1 món) | đeo nón + kính + cánh cùng lúc |
| Cánh | — | chưa có |
| Mặt nạ | sticker trang điểm (1 lựa chọn) | mặt nạ che mắt / nửa mặt |
| Thẻ tóc có ảnh, Mới/Hot, giá, Chọn | nút chữ (chip) | thẻ có ảnh tóc |
| Nam / Nữ | có (89b494c) | — |
| Lưu 3 kiểu phối | — | chưa có |

## Đề xuất (chia giai đoạn)
1. **Thẻ kiểu tóc có ảnh** ở Tùy chỉnh: lưới thẻ, ảnh = đầu vẽ tay của kiểu tóc (mặt mờ / đầu trơn), tên, giá / "Đã có",
   nhãn **Mới** (12 kiểu 23/11) và **Hot** (dùng nhiều nhất trong lớp, đếm từ UserAvatar), phân trang theo giới.
2. **Tách ô phụ kiện**: `hat` (nón, mũ, vương miện, bờm tai mèo, nơ, kẹp hoa), `glasses` (kính), `wings` (cánh), giữ
   `accessory` cũ → chuyển dữ liệu: món cũ tự vào đúng ô mới (không mất đồ). Nón che đỉnh tóc (vẽ trên tóc).
3. **Cánh** (mới): 6 kiểu (thiên thần, ác quỷ, bướm, rồng, tiên, máy) vẽ sau lưng (lớp tóc sau), bán bằng xu / rương.
4. **Mặt nạ** (mới): 5 kiểu (mặt nạ mắt dạ hội, mặt nạ mèo, kính phi công, khẩu trang, mặt nạ ninja) vẽ trên mặt.
5. (tuỳ chọn) **Lưu 3 kiểu phối đồ** — nút Kiểu 1·2·3 ở Hồ sơ & Trang trí.

Mỗi giai đoạn: unit test + E2E, không đụng tỉ lệ rương cũ (món mới gắn `studio` trừ khi thầy muốn cho vào rương).
