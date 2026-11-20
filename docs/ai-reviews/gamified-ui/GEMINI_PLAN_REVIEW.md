# Review: gamified-ui — plan

> Reviewer: Gemini trên web (model **Neon**, gemini.google.com), 20/11/2026. Claude gửi qua trình duyệt kèm file `review-input-plan.md` (GEMINI.md + PLAN.md + 12 file mã nguồn liên quan).
> Đây là nội dung Gemini trả lời, đã bỏ phần trích dẫn file thừa. Phần **Claude kiểm chứng** ở cuối.

## Summary

Kế hoạch nhìn chung hợp lý và bám sát các bất biến của hệ điểm thưởng: không đổi schema DB, không đụng logic tính điểm và giao dịch đang có, xử lý tốt các rủi ro như lệch HTML server/client và `prefers-reduced-motion`. Tuy vậy còn vài điểm cần chốt trước khi code. Rủi ro nhất là bộ lọc quà trên `/rewards` chưa tính tới học sinh online, Header có thể tràn ngang ở màn 360–390px, và vài chi tiết dữ liệu/hiển thị trên trang chủ.

## Findings

### [HIGH] Bộ lọc "Nhận tại lớp" trên /rewards luôn rỗng với học sinh online
- **Where:** PLAN.md (mục 5); components/points/StudentRewards.tsx:118; lib/points/queries.ts:36
- **Scenario:** Học sinh online (`studentType !== "OFFLINE"`) mở `/rewards`. Hàm `visibleRewardWhere(user)` chỉ trả về quà VIRTUAL. Nếu thanh lọc "Tất cả · Nhận tại lớp · Đặc quyền" hiện cho mọi học sinh, học sinh online bấm "Nhận tại lớp" sẽ luôn thấy danh sách trống.
- **Why it matters:** Học sinh online dễ tưởng trang lỗi hoặc hết quà, và thanh lọc chiếm chỗ vô ích trên màn 320px.
- **Minimal fix:** Ẩn lựa chọn "Nhận tại lớp" (hoặc cả thanh lọc theo loại quà) khi `!data.isOffline`.

### [MEDIUM] Chip điểm thưởng trên Header có nguy cơ tràn ngang ở màn 360–390px
- **Where:** PLAN.md (mục 6.2); components/layout/Header.tsx:50-56, 86-94
- **Scenario:** Header hiện chỉ ẩn chữ "thatdehoctoan" ở màn dưới 360px (`max-[359px]:hidden`). Ở 360–390px, chữ logo vẫn hiện cùng nút menu, ảnh logo, chip điểm và ảnh đại diện. Thêm biểu tượng cấp cạnh ⭐ số dư làm chip rộng thêm khoảng 24–28px, dễ chật hoặc tràn trên máy 360–375px.
- **Why it matters:** Có thể vỡ thanh điều hướng trên các điện thoại phổ biến và làm trượt test E2E kiểm tra tràn ngang ở 390px.
- **Minimal fix:** Ẩn biểu tượng cấp trong chip ở màn dưới 400px, hoặc nâng ngưỡng ẩn chữ logo lên `max-[399px]:hidden`.

### [MEDIUM] Nguy cơ vỡ chỗ gọi getBalance() và tăng độ trễ getPointsCard()
- **Where:** PLAN.md (mục 4 và 6.2); lib/points/queries.ts:15-18, 86-101
- **Scenario:**
  - `getBalance()` đang trả về một số. Nếu sửa thẳng hàm này để trả thêm `lifetimeEarned`, mọi chỗ đang gọi `getBalance()` sẽ lỗi kiểu dữ liệu.
  - `getPointsCard()` cần thêm `weekActivities` (đếm `PointLedger` trong tuần). Nếu truy vấn đếm chạy nối tiếp sau `pointWallet.findUnique`, trang chủ tốn thêm một lượt gọi DB.
- **Why it matters:** Thay đổi gây lỗi ngoài ý muốn và làm trang chủ phản hồi chậm hơn.
- **Minimal fix:** Giữ nguyên `getBalance()` và thêm hàm riêng cho Header (ví dụ `getHeaderPoints`). Trong `getPointsCard()`, chạy `pointWallet.findUnique` và `pointLedger.count` song song bằng `Promise.all`.

### [MEDIUM] Truyền progress vào CourseCard có thể hiện nhầm thanh tiến độ cho khoá chưa ghi danh
- **Where:** PLAN.md (mục 4 và 6.4); components/home/dashboard/Dashboard.tsx:77; components/course/CourseCard.tsx:121
- **Scenario:** `CourseCard` vẽ khối "Tiến trình" mỗi khi `progress !== undefined`. Nếu Dashboard truyền thẳng `progress={course.progress}`, khoá chưa ghi danh (progress = 0) cũng hiện thanh 0%.
- **Why it matters:** Trái với mục 6.4 (chỉ khoá đã ghi danh mới có thanh tiến độ) và làm rối danh sách khoá học.
- **Minimal fix:** Truyền `progress={course.isEnrolled ? course.progress : undefined}` ở Dashboard.

### [LOW] Nhãn nút bài gần nhất chưa thống nhất, và thiếu trường hợp học sinh chưa học bài nào
- **Where:** PLAN.md (mục 5, 7 và 9)
- **Scenario:**
  - Mục 7 nói dùng nhãn "Bài gần nhất" vì `lastLesson` là bài đã hoàn thành gần nhất, nhưng mục 5 và 9 vẫn ghi nút là "Học tiếp".
  - Kế hoạch chưa nói hiển thị gì khi học sinh mới chưa hoàn thành bài nào (`lastLesson === null`).
- **Why it matters:** Dễ lệch giữa giao diện và kiểm tra E2E, hoặc hiện nút trống/lỗi với học sinh mới.
- **Minimal fix:** Thống nhất nhãn ở mục 5, 7, 9 và quy định rõ khi `lastLesson` là null (ẩn nút hoặc dẫn tới `/courses`).

### [LOW] Test E2E dễ chập chờn khi kiểm tra pháo giấy tự xoá sau 1,6 giây
- **Where:** PLAN.md (mục 3 và 9)
- **Scenario:** Pháo giấy tự xoá sau 1,6 giây và tắt khi bật giảm chuyển động. Trong Chrome headless, độ trễ sau `redeemReward` và `router.refresh()` có thể khiến 1,6 giây trôi qua trước khi test kịp kiểm tra. Nếu môi trường bật giảm chuyển động thì phần tử không được vẽ.
- **Why it matters:** Bộ test E2E thiếu ổn định.
- **Minimal fix:** Gắn `data-testid` cố định cho khung pháo giấy. Tắt chuyển động bằng CSS `@media (prefers-reduced-motion: reduce)` thay vì không vẽ phần tử. Kiểm tra ngay khi trạng thái thành công kích hoạt.

## Questions for the author

1. Khi tắt `isPointsEnabled()`, học sinh còn thấy thẻ chào `StudentHero` (lời chào, bài gần nhất, số liệu) không, hay ẩn toàn bộ như `PointsHomeCard` hiện tại?
2. Học sinh chưa duyệt hoặc tài khoản demo (`!data.canEarn`) bấm "Ghim làm mục tiêu" thì nút bị khoá hay vẫn cho bấm? Hiện chỉ nút đổi quà bị khoá.
3. `HomePromo.tsx` và trang `/teacher/rewards` không được đính kèm nên chưa rà được rủi ro bố cục 320px.

---

## Claude kiểm chứng (20/11/2026)

| Finding | Kết luận | Xử lý |
|---|---|---|
| HIGH: bộ lọc "Nhận tại lớp" rỗng với học sinh online | **Đúng** (`visibleRewardWhere` loại quà `offlineOnly` với học sinh online) | Chỉ hiện các lựa chọn lọc có quà thực tế; ẩn cả thanh lọc khi chỉ có một loại |
| MEDIUM: chip Header chật ở 360–390px | **Đúng một phần**: E2E hiện qua ở 390px, chưa đo 360px | Biểu tượng cấp chỉ hiện ở màn ≥ 400px (`min-[400px]:inline`); thêm cỡ 360px vào E2E |
| MEDIUM: getBalance / độ trễ getPointsCard | **Đúng một phần**: `getBalance` chỉ có Header gọi nên không vỡ chỗ khác; gợi ý chạy song song là hợp lý | Thay `getBalance` bằng `getHeaderPoints` (một truy vấn theo khoá chính); `getPointsCard` chạy song song bằng `Promise.all` |
| MEDIUM: thanh tiến độ cho khoá chưa ghi danh | **Đúng** (CourseCard vẽ khi `progress !== undefined`) | `progress={course.isEnrolled ? course.progress : undefined}` |
| LOW: nhãn "Học tiếp" và `lastLesson` null | **Đúng** | Nhãn thống nhất: "Bài gần nhất: <tên>" và nút "Mở lại". Khi null: nút "Bắt đầu học" dẫn tới khoá học đầu tiên đã ghi danh, hoặc `/courses` |
| LOW: pháo giấy làm E2E chập chờn | **Đúng** | Pháo giấy luôn nằm trong DOM với `data-testid="confetti"` và `data-active`; CSS tắt chuyển động khi giảm chuyển động; E2E kiểm tra thuộc tính `data-celebrated` trên trang thay vì phần tử tạm thời |
| Hỏi 1: tắt điểm thì có `StudentHero` không | Quyết định | Vẫn hiện lời chào, bài gần nhất và số bài đã học; ẩn phần điểm, cấp, chuỗi và quà mục tiêu |
| Hỏi 2: khoá nút ghim với `!canEarn` | **Không làm** | Ghim mục tiêu không tốn gì và giúp học sinh mới có mục tiêu ngay; tài khoản demo đã bị `demoGuard` chặn ở server |
| Hỏi 3: thiếu `HomePromo` / `/teacher/rewards` | Ghi nhận | E2E đã đo tràn ngang ở 320/360/390/768/1366 cho cả hai trang |
