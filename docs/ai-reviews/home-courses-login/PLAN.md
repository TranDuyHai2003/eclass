# Trang chủ (khách) · Khóa học · Đăng nhập theo artifact thiết kế (22/11/2026)

Nguồn: canvas https://claude.ai/artifact/2kcB8o96tqYyVMXqAtYDn5, artboard `Home`, `Courses`, `Login` (desktop 1440px, "đề xuất v1").
Cùng phong cách với GĐ9 Tiệm quà/Hồ sơ (`docs/ai-reviews/game-economy/PLAN.md` §12): nền #F6F5FB, chữ Be Vietnam Pro, tím #5B2BD6, thẻ trắng viền #ECE9F5.

Phiên khác (GĐ9) đang sửa `components/shop|profile|studio`, `app/rewards|profile`, `lib/game` và 2 khối CSS cuối `globals.css`. Kế hoạch này **không đụng** các chỗ đó.

## 1. Mục tiêu

| Trang | Ai thấy | Làm gì |
|---|---|---|
| `/` | Khách (chưa đăng nhập) | Thay `GuestHero` + lưới khoá bằng trang giới thiệu theo artboard `Home` |
| `/` | Đã đăng nhập | **Giữ nguyên** Dashboard học sinh/giáo viên (artboard không vẽ) |
| `/courses` | Mọi người | Bố cục mới theo artboard `Courses`: tiêu đề + số liệu, dải "Tiếp tục học", lọc theo khối, ô tìm, lưới thẻ khoá mới |
| `/login` | Khách | Hai cột: form bên trái, khối thương hiệu tím đậm bên phải |

## 2. Thành phần dùng chung

- **Phông:** gắn `beVietnam.variable` (`lib/fonts.ts`, đã có) lên khung ngoài của 3 trang; dùng `font-[family-name:var(--font-bvp)]`. Không dùng lớp `.studio` của GĐ9 (lớp đó có thể đổi).
- **Ảnh minh hoạ:** ảnh học sinh và mèo trong thư viện đêm của artifact (687×324) → `public/landing/hero.webp`. Dùng ở hero trang chủ và khối thương hiệu đăng nhập. Ảnh sprite quà của artifact **không dùng**, vì quà thật do thầy tạo.
- **`components/course/CourseTile.tsx` (mới):** thẻ khoá học theo artboard.
  - Bìa màu theo khối, số lớn ("10", "11", "12", "ƒ(x)").
  - Chip khối; chip PREMIUM khi `price > 0`.
  - Tiêu đề, "N bài học", tên danh mục, giáo viên, "Xem khóa học →".
  - Có tiến độ thì hiện thanh tiến độ mỏng.
  - Hover nhấc 3px.
  - Khoá có `thumbnail` (thầy đã tải ảnh bìa) thì dùng ảnh đó; chưa có ảnh thì bìa màu theo khối (đúng artboard). *(Đổi khi làm: dữ liệu thật đã có ảnh bìa cho 4/5 khoá.)*
  - `CourseCard` cũ giữ cho Dashboard.
- **`lib/course-grade.ts` (mới, hàm thuần):** suy ra nhóm khối của khoá: `"10" | "11" | "12" | "thi" | null`.
  1. Tiêu đề có "luyện thi / ôn thi / THPTQG…" → `thi`. Khoá luyện thi thật gắn lớp 12 nhưng thiết kế xếp riêng.
  2. Mọi lớp gắn khoá cùng một khối → khối đó.
  3. Tiêu đề có 10/11/12 đứng riêng (không dính chữ/số: loại "2026", "2K11") → khối đó.
  4. Không xác định → `null`, chỉ hiện ở tab "Tất cả".
  - Tab khối chỉ hiện khi có ≥ 2 nhóm khác nhau. Trên `/courses`, lọc ở server qua `?grade=` (tab là link, không cần JS).
- **Sidebar (`HomeSidebar`):** mục đang chọn đổi sang tím (#EDE7FD / chữ #4319A8), hover #F1EDFC, như artboard. Thay đổi này ảnh hưởng mọi trang có sidebar, khớp màu với GĐ9.
- **Header:** giữ nguyên, vì logo ảnh là nhận diện thương hiệu. Riêng nút khách đổi thành "Đăng nhập" (viền) + "Đăng ký học" (tím), theo artboard `Home`.
- **CSS:** chỉ thêm một khối mới ở **cuối** `globals.css` ("Trang chủ/Khoá học/Đăng nhập theo artifact"), không sửa khối khác.

## 3. Trang chủ khách (`components/home/landing/GuestLanding.tsx`, thay `GuestHero` trong `Dashboard` khi `!user`)

Không có sidebar, nội dung rộng tối đa 1200px, nền trắng.

1. **Hero** (nền #F6F3FF):
   - Chip "Học cùng thầy Đức"; H1 "Học toán THPT dễ hiểu, *có lộ trình*"; câu mô tả.
   - 3 dòng tính năng có icon. Dòng xu/quà chỉ hiện khi `pointsEnabled`, như `GuestHero` hiện tại.
   - Nút "Đăng ký học" → `/register` và "Xem lộ trình" → `#lo-trinh`.
   - Bên phải: ảnh minh hoạ, kèm 2 thẻ nổi minh hoạ tính năng:
     - "ĐỀ KIỂM TRA · Đã chấm · 8,5/10": ghi rõ là **ví dụ**, `aria-hidden` phần số;
     - "+X xu · Hoàn thành bài học": X lấy từ hằng số thật trong `lib/points`, ẩn khi tắt xu.
   - Dưới 900px: ảnh xuống dưới, 2 thẻ nổi xếp dưới ảnh (không chồng).
2. **Dải đếm ngược** (tím đậm #1E1745, nằm đè mép dưới hero 36px):
   - "Kỳ thi THPT 2027 · 11/06/2027" và 4 ô ngày/giờ/phút/giây. Dùng chung `EXAM_DATE` + `useCountdown` của `HomePromo`, xuất ra để dùng lại, không chép.
   - Số khoá học và số bài học là số thật.
3. **"Học mỗi tuần theo 3 bước":** 3 thẻ (thẻ 3 nền vàng). Ẩn thẻ 3 khi tắt xu.
4. **"Lộ trình học tập" `#lo-trinh`:**
   - Tab khối (Tất cả / Lớp 10 / 11 / 12 / Luyện thi). Chọn một tab thì các khoá không thuộc khối bị làm mờ (opacity .35), đúng artboard.
   - Lưới `CourseTile` theo thứ tự 10 → 11 → 12 → thi → không rõ, nhãn "Bước N" theo thứ tự nhóm.
   - Nút "Xem tất cả khóa học" → `/courses`.
5. **"Học chăm có quà thật"** (chỉ khi bật xu):
   - Mô tả và nút "Ghé Tiệm quà" → `/rewards`; khách bấm sẽ bị chuyển sang `/login`, chấp nhận được.
   - Bên phải 4 quà thật đang mở, lấy ở server: `Reward` có `isActive`, có `imageUrl`, và **không giới hạn lớp** (`classes: { none: {} }`), để không lộ quà riêng của lớp.
   - Không có quà có ảnh thì chỉ hiện chữ, không hiện lưới.
6. **Footer** (tím đậm): logo + chữ, liên kết Facebook / Messenger / Youtube / Discord (cùng URL với sidebar). Điều khoản/Chính sách giữ `#` như hiện tại.

Dữ liệu thêm cho khách: danh sách quà (một truy vấn, cache 60 giây) và `classes.grade` của khoá (thêm vào select của `getDashboardData`/`getCourses`).

## 4. Khóa học (`app/courses/page.tsx`)

Giữ sidebar và header chung.

1. Tiêu đề "Khóa học" + mô tả. Bên phải "**N** khóa học · **M** bài học".
2. **Dải "Tiếp tục học"** (tím đậm), chỉ hiện với học sinh có bài học gần nhất:
   - Hiện số khối, tên khoá, thanh tiến độ "x/y bài" và nút "Học tiếp" → `/watch/<bài gần nhất>`.
   - Bài gần nhất lấy bằng cùng cách `getDashboardData` đang tính `lastLesson` (tách hàm dùng chung nếu cần, không viết truy vấn thứ hai).
3. **Thanh lọc:**
   - Tab khối (segmented) lọc ở client, đồng bộ `?grade=`.
   - Ô "Tìm theo tên khóa học" dùng `?query=` sẵn có (submit form GET), giữ dòng "Tìm thấy N khóa học cho …".
4. **Lưới:**
   - `repeat(auto-fill, minmax(260px, 1fr))` với `CourseTile`.
   - Bỏ bố cục "1–2 khoá thẻ ngang", vì thẻ mới không cần.
   - Trạng thái rỗng làm gọn theo phong cách mới.
5. Xoá khối hero bị comment và `<style>` keyframes thừa trong file, vì file này được viết lại.

## 5. Đăng nhập (`app/login/page.tsx` + `components/auth/LoginForm.tsx`)

**Cột trái:**
- Logo (về `/`); "Chào mừng trở lại" và mô tả.
- Ô Email và ô Mật khẩu có icon, viền đổi tím khi focus. Ô mật khẩu có nút hiện/ẩn mật khẩu (`aria-pressed`, `aria-label` đổi theo).
- Nút "Đăng nhập" tím; dòng điều khoản; vạch ngăn; "Chưa có tài khoản? Đăng ký ngay".
- Logic `login()` giữ nguyên: toast lỗi, chuyển trang, `isPending`.

**Cột phải** (từ 960px; điện thoại ẩn hẳn):
- Thẻ tím đậm: ảnh minh hoạ, H2, 3 gạch đầu dòng (dòng xu ẩn khi tắt xu).
- Số liệu thật: số khoá, số bài, ngày thi.
- Số liệu lấy ở server bằng một truy vấn đếm, cache 300 giây.

**Không làm:**
- "Quên mật khẩu?": chưa có luồng đặt lại mật khẩu. Thêm link chết sẽ gây hiểu nhầm.
- "Ghi nhớ đăng nhập": phiên NextAuth vốn đã nhớ, ô tick không có tác dụng.

`/register` không đổi trong đợt này.

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| `getDashboardData`/`getCourses` thêm `classes.grade` làm nặng truy vấn | Chỉ select `grade`, quan hệ nhỏ (vài lớp/khoá) |
| Đoán khối từ tiêu đề sai | Ưu tiên `classes.grade`; sai thì khoá vẫn nằm ở "Tất cả"; có unit test cho các tiêu đề thật |
| Đổi màu sidebar ảnh hưởng trang khác | Chỉ đổi lớp màu mục active/hover; E2E site-audit chạy lại |
| E2E `lesson-page` dựa vào `[data-testid="guest-hero"]` | Trang mới giữ `data-testid="guest-hero"` ở hero; giữ link `/register` và `/login` trong hero |
| Lộ dữ liệu khi khách xem quà | Chỉ lấy tên, ảnh, giá của quà đang mở; quà không gắn người dùng |
| Đồng hồ đếm ngược lệch hydration | Dùng lại `useCountdown` sẵn có (đã xử lý render client) |

## 7. Giai đoạn

1. **GĐ1:** `lib/course-grade.ts` + unit test; `CourseTile`; trang `/courses` mới; sidebar tím.
2. **GĐ2:** trang chủ khách (`GuestLanding`, ảnh, footer, nút khách ở header).
3. **GĐ3:** trang đăng nhập.

Mỗi giai đoạn: một commit; `npx tsc --noEmit -p .`, eslint file đã sửa, `npm test`, `npm run test:e2e`. Không tự review Gemini (chỉ khi người dùng yêu cầu).

## 8. Test

- **Unit** `tests/home/course-grade.test.ts`:
  - đoán khối từ `classes.grade` (đồng nhất / lẫn khối);
  - đoán từ tiêu đề thật: "Lớp 10 – XPS 2K11", "Giai đoạn 2: Kiến thức nền tảng 12 (Nâng cao)", "Chuyên đề luyện thi THPTQG Toán NC 2026";
  - khoá không rõ khối → `null`;
  - thứ tự nhóm.
- **E2E mới** `tests/e2e/landing.e2e.mjs`, thêm vào `test:e2e`:
  - khách vào `/`: có hero, link `/register` và `/login`, dải đếm ngược, `#lo-trinh`; bấm tab "Lớp 12" thì khoá khác khối bị mờ;
  - `/courses`: lọc theo khối đổi số thẻ; tìm theo `?query=`; học sinh có tiến độ thấy "Tiếp tục học" trỏ đúng bài;
  - `/login`: nút hiện/ẩn đổi `type` ô mật khẩu; đăng nhập sai báo lỗi; đăng nhập đúng (người dùng thử có mật khẩu) về `/`;
  - không tràn ngang ở 390 / 768 / 1366 / 1920px (`layoutProblems`); chụp ảnh cả trang.
- Chạy lại `lesson-page.e2e.mjs` (dùng `guest-hero`) và `site-audit`.
