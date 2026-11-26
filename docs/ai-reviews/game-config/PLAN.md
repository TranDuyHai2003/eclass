# Admin sửa giá đồ trang trí & mức xu các hoạt động (26/11/2026)

## Yêu cầu của thầy
1. Admin sửa giá **thú cưng, khung viền, bảng tên**: nhập **giá tiền thật (đ)** → tự đổi ra xu = đ ÷ 3,6, **làm tròn lên hàng trăm** (20.000đ → 5.555,6 → **5.600 xu**; 265 → 300).
2. Admin sửa **các hoạt động lấy xu** (nộp bài, đúng hạn, điểm cao, bứt phá, thi cuối khoá, bài tập về nhà, chuỗi tuần, giới hạn mỗi ngày, thầy thưởng tối đa).

## Hiện trạng
- Giá đồ: hằng số trong `lib/game/items.ts` (`item.price = {xu} | {gem}`), dùng cả server (`lib/game/inventory.ts` mua lẻ / mua bộ) lẫn client (ShopPage, DecorStudio).
- Mức xu: hằng `POINTS` trong `lib/points/config.ts`, dùng ở server (hooks, engine, manual, redemption, queries) và vài chỗ hiển thị client (EarnSection, TasksModal, HistoryModal `EARNING_RULES`, GuestLanding).

## Thiết kế
- Bảng mới `GameConfig { key @id, value Json, updatedById?, updatedAt }` (migration chỉ thêm bảng). 2 khoá: `itemPrices`, `earning`.
- `lib/game/game-config-shared.ts` (dùng được ở client):
  - `vndToXu(vnd) = ceil(vnd·10 / 3600) · 100` (số nguyên, không sai số dấu phẩy động).
  - `PRICE_EDITABLE`: món ô pet / frame / nameplate **có giá gốc** (không sửa món chỉ có từ rương, nhiệm vụ, miễn phí).
  - `EARNING_FIELDS`: danh sách trường sửa được + nhãn + giới hạn min/max.
  - `normalizeItemPrices`, `normalizeEarning`: kiểm tra dữ liệu (xu 0–1.000.000, KC 1–999, đ 1.000–10.000.000, mức xu 0–100.000, hệ số thi cuối 1–5…).
  - `applyGameConfig(cfg)`: áp đè lên `ITEM_BY_ID[*].price` và `POINTS` (giữ bản gốc để "Về mặc định"); idempotent theo chữ ký JSON.
- Server `lib/game/game-config.ts`: `loadGameConfig()` đọc DB, cache 30 giây, áp vào bộ nhớ. Gọi khi:
  khởi động (`instrumentation.ts`), đầu các trang tiệm / hồ sơ / trang chủ / quản lý quà, đầu `buyItem` / `buyBundle`, các hook cộng xu (onTestSubmitted, onHomeworkSubmitted…), thưởng tay; và ngay sau khi admin lưu.
- Client: trang truyền `gameConfig` xuống `ShopPage`, `DecorStudio`, `GuestLanding` → gọi `applyGameConfig` trước khi vẽ (server và client cùng giá → không lệch hydration). `EARNING_RULES` → hàm `earningRules()`.
- Giao diện (chỉ ADMIN, trong khu Quản lý của tiệm): 3 tab **Quà · Giá đồ trang trí · Hoạt động kiếm xu**.
  - Giá đồ: lưới món (ảnh, tên, giá hiện tại), ô "Giá tiền thật (đ)" → hiện "= 5.600 xu", hoặc chuyển sang Kim cương; "Về giá gốc"; "Lưu thay đổi" (chỉ gửi món đã đổi).
  - Hoạt động: form các mức xu (giá trị mặc định làm gợi ý), "Lưu", "Về mặc định".
- Server action `actions/game-config.ts`: `saveItemPrices`, `saveEarningConfig` — chỉ ADMIN (demoGuard), kiểm tra dữ liệu, ghi DB, áp ngay, `revalidatePath`.

## Không làm
- Không đổi giá quà thầy tạo (đã có ô Giá xu + Chi phí thật; tỉ lệ cũ ~2 xu/1đ khác ÷3,6) — hỏi thầy nếu muốn áp chung.
- Không cho bán món chỉ có từ rương / nhiệm vụ ẩn.

## Kiểm thử
- Unit: `vndToXu` (20.000 → 5.600; 26.500/… → làm tròn lên trăm; 3.600 → 1.000), normalize từ chối số âm / quá lớn / món không sửa được; `applyGameConfig` đổi giá + về mặc định; mua đồ trừ đúng giá mới (DB local); hook nộp bài cộng đúng mức xu mới.
- E2E: admin mở tab Giá đồ → nhập 20000 → thấy 5.600 xu → lưu → DB + thẻ tiệm hiện giá mới; tab Hoạt động → đổi nộp bài → lưu → mục Kiếm xu hiện số mới; dọn về mặc định.
