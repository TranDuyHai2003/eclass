# Review: gamified-ui — diff (13c66ad..d236192)

> Reviewer: Gemini trên web (model **Neon**), 20/11/2026. Claude gửi qua trình duyệt kèm `review-input-diff.md`, gồm GEMINI.md, git diff và nội dung đầy đủ 12 file bị thay đổi. Bốn file lớn chỉ có trong diff: `StudentRewards.tsx`, `TeacherRewards.tsx`, `points.e2e.mjs`, `queries.test.ts`.
> Đây là nội dung Gemini trả lời, đã bỏ phần trích dẫn file thừa. Phần **Claude kiểm chứng** ở cuối.

## Summary

Phần giao diện game nhẹ cho trang chủ và trang Điểm thưởng nhìn chung giữ nguyên các bất biến về ví, sổ điểm và đổi quà. Code tránh được lệch HTML server/client (pháo giấy chạy trong `useEffect`, câu nhắc của Cú Học được tính cố định) và có hỗ trợ `prefers-reduced-motion`. Rủi ro nhất là bố cục tab "Quà của tôi" trên điện thoại hẹp (320–390px) khi có đơn đang chờ trao. Ngoài ra còn hai lỗi nhỏ: trạng thái bộ lọc quà và độ tương phản màu nút.

## Findings

### [HIGH] Thẻ đơn đổi quà ở tab "Quà của tôi" bị bóp nghẹt và vỡ dòng trên màn hình 320–390px
- **Where:** components/points/StudentRewards.tsx:244-273
- **Scenario:**
  - Học sinh mở `/rewards` trên điện thoại 320–390px, sang tab "Quà của tôi" khi có ít nhất một đơn đang chờ trao.
  - Mỗi đơn là một hàng ngang không xuống dòng (`flex items-center gap-3`), chứa bốn phần: ô biểu tượng (48px), khối nội dung ở giữa, nhãn "Chờ nhận quà" (~88px) và nút "Huỷ" (~42px).
  - Ở 320px, trừ ba khoảng cách 12px, khối nội dung chỉ còn khoảng 42px.
  - Bên trong khối đó còn có hàng ba bước "Đã đổi › Chờ trao › Đã nhận" cũng không xuống dòng, nên chữ bị ép gãy nhiều dòng hoặc tràn đè lên nhãn trạng thái.
- **Why it matters:** Học sinh dùng điện thoại nhỏ không đọc được tên quà và trạng thái trao quà.
- **Minimal fix:** Cho thẻ xuống dòng trên màn nhỏ (`flex-wrap sm:flex-nowrap`), hoặc gom nhãn trạng thái và nút "Huỷ" thành một nhóm riêng, xuống dòng dưới `sm`. Thêm `flex-wrap` cho hàng ba bước.

### [LOW] Bộ lọc loại quà có thể kẹt ở màn hình trống sau khi dữ liệu làm mới
- **Where:** components/points/StudentRewards.tsx:62-63, 192-214
- **Scenario:**
  1. Học sinh mở tab "Đổi quà" khi có cả quà PHYSICAL và VIRTUAL (`kinds.length === 2`), rồi bấm lọc "✨ Đặc quyền" (`kind = "VIRTUAL"`).
  2. Trong lúc đó giáo viên ẩn hoặc xoá món VIRTUAL cuối cùng. Học sinh ghim hoặc đổi quà khiến `router.refresh()` chạy, và `data.rewards` chỉ còn quà PHYSICAL.
  3. `kinds.length` giảm còn 1 nên thanh lọc bị ẩn, nhưng state `kind` vẫn là "VIRTUAL". Danh sách lọc ra rỗng, lưới quà trắng trơn và không có nút để quay về "Tất cả".
- **Why it matters:** Học sinh bị kẹt ở màn hình trống cho đến khi tải lại trang.
- **Minimal fix:** Tính `activeKind = kinds.length > 1 && (kind === "ALL" || kinds.includes(kind)) ? kind : "ALL"`, rồi dùng `activeKind` để lọc quà và cho `aria-pressed`.

### [LOW] Độ tương phản chữ trắng trên nút .btn-3d-green dưới ngưỡng WCAG AA
- **Where:** app/globals.css:364, components/points/TeacherRewards.tsx:200
- **Scenario:** Nút "Đã trao (N)" ở tab yêu cầu của giáo viên đổi từ `bg-emerald-600` sang `.btn-3d-green` (nền `#10b981`, chữ trắng). Tương phản giữa `#ffffff` và `#10b981` chỉ khoảng 2,54:1, dưới chuẩn 4,5:1 cho chữ nhỏ và cả 3:1 cho chữ lớn.
- **Why it matters:** Khó đọc khi màn hình tối hoặc với người thị lực kém.
- **Minimal fix:** Đổi nền `.btn-3d-green` sang màu đậm hơn như `#059669` (khi rê chuột dùng `#10b981`), hoặc dùng chữ tối `#022c22` để đạt tương phản ≥ 4,5:1.

## Questions for the author

1. `lib/points/levels.ts` và `lib/points/rarity.ts` không có trong diff. Nhờ xác nhận `getLevel(lifetimeEarned)` an toàn khi `lifetimeEarned < 0`, và nhãn độ hiếm đủ ngắn để không chạm nút ghim 📌 trên thẻ hai cột ở màn 320px.
2. `tests/e2e/points.e2e.mjs` bị cắt phần cuối do dung lượng. Vòng kiểm tra bố cục ở 320–390px đã đo tab "Quà của tôi" khi có đơn đang chờ chưa, hay mới đo tab "Đổi quà" mặc định?

---

## Claude kiểm chứng (20/11/2026)

| Finding | Kết luận | Đã làm |
|---|---|---|
| HIGH: hàng đơn đổi quà bị ép ở 320–390px | **Đúng**: 4 phần tử ngang, khối giữa còn khoảng 44px, hàng 3 bước không xuống dòng. E2E không bắt được vì lúc đo bố cục học sinh không có đơn nào đang chờ, và bài kiểm tra chỉ xét tràn ra khỏi trang | Thẻ mới: tên quà + nhãn trạng thái ở hàng trên (xuống dòng khi hẹp); hàng 3 bước + nút Huỷ ở dưới (`flex-wrap`). E2E đổi thêm một món trước khi đo bố cục để luôn có đơn đang chờ |
| LOW: bộ lọc kẹt ở lưới trống | **Đúng** | Thêm `resolveKindFilter()` (`lib/points/filters.ts`) kèm 3 test hồi quy; giao diện dùng `activeKind` |
| LOW: tương phản `.btn-3d-green` | **Đúng** (trắng trên `#10b981` ≈ 2,5:1) | Dùng nền `#047857` (≈ 5,5:1), khi rê chuột `#059669`. Gemini gợi ý `#059669` (≈ 3,8:1), vẫn dưới 4,5:1 cho chữ nhỏ nên chọn màu đậm hơn |
| Hỏi 1: `getLevel` với số âm; nhãn độ hiếm và nút ghim | Đã có test (`levels-rarity.test.ts`: âm, NaN, Infinity) | E2E đo bố cục ở 320px không thấy chồng lấn |
| Hỏi 2: E2E đã đo "Quà của tôi" khi có đơn chờ chưa | Chưa, đúng như Gemini nghi | Đã thêm (xem dòng HIGH) |

**Lỗi khác tìm thêm nhờ làm chặt bài kiểm tra bố cục** (đo phần tử có chữ bị cắt hoặc tràn khỏi khung, ở 320/360/390/414/768/1366px):
- **Thẻ quà mục tiêu, thẻ linh vật và thẻ chào tràn mép phải ở 320/360px.** Ô lưới không khai báo cột nên giãn theo dòng chữ dài. Đã thêm `grid-cols-1` / `minmax(0,1fr)` cho mọi lưới có cột ở màn lớn.
- **Tab "Thưởng điểm" của thầy tràn ở 320px** khi tên lớp dài, cùng nguyên nhân. Đã sửa.
- **Chữ "THATDEHOCTOAN" ở header tràn ra khỏi khung tại 360–414px** (đúng rủi ro Gemini nêu ở vòng review kế hoạch). Đã cho chữ thương hiệu chỉ hiện từ 640px; điện thoại chỉ còn biểu tượng logo.

Kết quả: `npm test` 106/106, `npm run test:e2e` 24/24 (6 cỡ màn hình).

---

# Review vòng 2: chỉnh giao diện (113ac45..c32d397)

> Reviewer: Gemini trên web (model **Neon**), 20/11/2026. Gói gửi đi: GEMINI.md + diff + các file bị thay đổi. Dưới đây là phần tóm tắt các finding của Gemini, kèm kiểm chứng của Claude.

**Tóm tắt của Gemini:** Đợt chỉnh gọn, không có lỗi bảo mật hay phân quyền, không có link lồng nhau, không gây lỗi hydration mới. Rủi ro nằm ở dữ liệu `getPointsCard` và cách `StudentHero` hiển thị trạng thái đổi quà.

| # | Finding của Gemini | Mức | Claude kiểm chứng | Đã làm |
|---|---|---|---|---|
| 1 | Quà gợi ý báo "Đổi được ngay ✓" cả khi **hết hàng** (hoặc đã **hết lượt tháng**) | MEDIUM | **Đúng**: `visibleRewardWhere` không lọc theo tồn kho, vì `/rewards` cố ý vẫn hiện "Hết quà" | Lấy tối đa 8 món còn hàng (`stock` null hoặc > 0), bỏ món đã hết lượt tháng, giữ 3 món đầu. Thêm test hồi quy |
| 2 | Quà mục tiêu ở trang chủ không lọc theo `visibleRewardWhere` (học sinh chuyển online hoặc đổi lớp) | MEDIUM | **Đúng**: lệch với `/rewards` | Truy vấn quà mục tiêu dùng `visibleRewardWhere(user)`. Thêm test (học sinh chuyển online, quà riêng lớp khác, so khớp với `/rewards`) |
| 3 | Chữ "Mục tiêu" màu `slate-400` trên nền trắng dưới chuẩn WCAG AA | LOW | **Đúng** (~2,6:1) | Đổi sang `slate-500` cho nhãn này và các chữ nhỏ tương tự trong thành phần mới (Tiệm quà, thẻ quà, Cú Học) |
| 4 | Chụp toàn trang (`cdp.mjs`) có thể truyền chiều cao số lẻ cho CDP và không khôi phục khung nhìn khi lỗi | LOW | **Đúng** | Làm tròn bằng `Math.ceil`; khôi phục khung nhìn trong `finally` |
| 5 | Test quà gợi ý có thể đạt mà không kiểm tra gì nếu DB có sẵn quà giá thấp | LOW | **Đúng** | Quà test giá 0, gắn lớp riêng cho từng test; kiểm tra chính xác thứ tự `[v2, v3, v4]` |
| Hỏi | `visibleRewardWhere` có cố ý giữ quà `stock = 0` không? | — | Có (để `/rewards` hiện "Hết quà") | Vì vậy lọc tồn kho riêng ở gợi ý trang chủ (#1) |

**Claude sửa thêm:** dòng "KỲ THI 2027" trên banner bị lệch trái ở điện thoại trong khi tiêu đề căn giữa. Đã căn giữa trên điện thoại, căn trái từ màn `lg`.

Kết quả: `npm test` 109/109, `npm run test:e2e` 24/24.
