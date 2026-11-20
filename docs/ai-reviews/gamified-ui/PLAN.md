# Kế hoạch: Điểm thưởng kiểu game nhẹ và nâng cấp giao diện trang

> Tác giả: Claude Code · 20/11/2026 · Trạng thái: **đã review** (Gemini Neon, xem `GEMINI_PLAN_REVIEW.md`); đã chỉnh theo mục 11.
> Nền tảng đã có: Điểm thưởng giai đoạn 1 (commit `34c4514`) và bộ test (`8717374`). Xem `GEMINI.md` để biết các bất biến của hệ điểm.

## 1. Mục tiêu

Hiện trang đổi quà chỉ là danh sách, còn trang chủ chưa cho học sinh thấy mình đang tiến bộ ra sao.

Mục tiêu:
1. Trang đổi quà và trang chủ có không khí "na ná game": có cấp độ, thanh kinh nghiệm, quà có độ hiếm, phản hồi vui khi đổi quà. Vẫn **hiện đại, gọn, không quá game**.
2. Bố cục trang chủ học sinh trả lời ngay ba câu hỏi:
   - Mình đang ở đâu? (cấp độ, điểm, chuỗi tuần)
   - Học tiếp gì? (bài gần nhất, khoá học kèm tiến độ)
   - Sắp đổi được gì? (quà mục tiêu)
3. Không thay đổi logic tính điểm đã có test. Không thêm bảng DB.

## 2. Tham khảo bản Gemini: lấy gì, bỏ gì

| Ý tưởng từ Gemini | Quyết định | Lý do |
|---|---|---|
| Thanh trạng thái (xu, hạng, thanh kinh nghiệm) | **Lấy** | Học sinh thấy tiến bộ ngay |
| Hạng không mất khi tiêu điểm (tách số dư và tổng kinh nghiệm) | **Lấy** | Dùng `lifetimeEarned` đã có, không cần đổi DB |
| Thẻ quà theo độ hiếm (Phổ thông, Hiếm, Sử thi, Huyền thoại) | **Lấy**, tự suy ra từ giá | Thầy không phải chọn thêm |
| Nút 3D lún khi bấm, hiệu ứng nảy, pháo giấy khi đổi quà | **Lấy, ở mức nhẹ** | Có phản hồi tức thì, tắt khi người dùng bật "giảm chuyển động" |
| Linh vật đứng quầy có câu thoại | **Lấy bản nhỏ** (một con cú SVG, câu nhắc học) | Thân thiện, không chiếm chỗ |
| Quà đặc quyền 0 đồng (gia hạn nộp bài, hỏi riêng, chọn chỗ ngồi) | **Đã có** | Mẫu quà sẵn trong `lib/points/templates.ts` |
| Hai loại tiền (xu và ngọc) | **Không làm** | Thang điểm nhỏ, thêm loại tiền gây rối và khó cân bằng |
| Rương ngẫu nhiên (gacha) | **Không làm** (để thầy quyết sau) | Chi phí khó kiểm soát; "thử nhân phẩm" với học sinh dễ bị phụ huynh phản đối |
| Âm thanh | **Không làm** | Học sinh hay mở trên lớp hoặc ở nhà; dễ gây phiền |
| Viền hoạt hình đậm, phông vẽ tay | **Không làm** | Lệch với nhận diện hiện tại của trang |
| Đồ trang trí hồ sơ (khung ảnh đại diện, danh hiệu) | **Để giai đoạn sau** | Cần thêm "túi đồ" và hiển thị ở bảng xếp hạng |

## 3. Hệ thống thiết kế

Giữ nhận diện hiện tại: nền `#EBF3FF`, màu chính xanh `#2563EB`, phông Plus Jakarta Sans và Outfit. Bổ sung:

- **Màu theo vai trò:**
  - vàng hổ phách: điểm thưởng;
  - cam/hồng: chuỗi tuần;
  - tím: cấp cao;
  - xanh lục: hoàn thành.
- **Chiều sâu "đồ chơi" nhẹ:**
  - thẻ: `rounded-3xl`, viền 2px, bóng đặc dưới đáy `0 4px 0 <màu nhạt>`;
  - nút chính: `.btn-3d`, bóng đáy 4px, khi bấm `translate-y-[3px]` và bóng còn 1px.
- **Hoạ tiết chấm** nhẹ trên nền ảnh quà (`radial-gradient`), màu theo độ hiếm.
- **Chuyển động:**
  - `float` cho biểu tượng quà khi rê chuột;
  - `pop-in` khi mở hộp thoại;
  - pháo giấy khi đổi quà thành công (24 mảnh CSS, tự xoá sau 1,6 giây).
  - Tất cả tắt khi `prefers-reduced-motion: reduce`.
- **Tiện ích CSS mới** (trong `app/globals.css`): `.btn-3d`, `.btn-3d-amber`, `.btn-3d-blue`, `.btn-3d-white`, `.btn-3d-muted`, `.dots-bg`, `@keyframes float`, `pop-in` và `confetti-fall`.

## 4. Dữ liệu (không đổi schema)

| Thành phần | Nguồn | Ghi chú |
|---|---|---|
| Cấp độ | `lib/points/levels.ts` → `getLevel(lifetimeEarned)` | Đã viết và có test. 6 cấp: Tập sự 0 → Chăm chỉ 25 → Bền bỉ 60 → Xuất sắc 120 → Tinh anh 250 → Huyền thoại 500. Học chăm (~82 điểm/tháng) lên Xuất sắc sau 1–2 tháng, Huyền thoại sau khoảng 6 tháng. |
| Độ hiếm quà | `lib/points/rarity.ts` → `rarityOf(price)` | Đã viết và có test. Mốc ≤50 / ≤120 / ≤300 / lớn hơn. |
| Thẻ trang chủ | `getPointsCard()` trong `lib/points/queries.ts` | **Thêm** `lifetimeEarned`, `weekActivities`, `weekTarget`, `thisWeekCounted` |
| Bài gần nhất, số bài đã học | `getDashboardData()` (đã có) | `lastLesson` và `stats` đã truyền vào `Dashboard` nhưng chưa hiển thị |
| Tiến độ khoá học | `getDashboardData()` (đã có `progress`, `isEnrolled`) | `CourseCard` đã nhận `progress` nhưng Dashboard chưa truyền |
| Tên, ảnh học sinh trên trang `/rewards` | `session.user` | Truyền từ `app/rewards/page.tsx` |

## 5. Luồng tính năng (học sinh)

```
Học / làm bài ──► nhận điểm (thông báo "+N điểm" ở màn kết quả, đã có)
      │
      ▼
Trang chủ: thẻ chào
  • cấp độ + thanh kinh nghiệm (còn X điểm lên cấp)
  • ⭐ số dư · 🔥 chuỗi tuần (tuần này a/2 bài) · ✅ số bài đã học
  • "Bài gần nhất: <tên>" + nút 3D [Mở lại]; chưa học bài nào → [Bắt đầu học]
  • thẻ quà mục tiêu: thanh tiến độ "còn N điểm"   →  [Đổi quà]
      │
      ▼
/rewards (Tiệm quà)
  • Thanh trạng thái: ảnh + tên + cấp + thanh kinh nghiệm │ ⭐ số dư │ 🔥 chuỗi │ 🧊 thẻ giữ chuỗi
  • Linh vật cú + câu nhắc (bấm để đổi câu)
  • Lọc: Tất cả · Nhận tại lớp · Đặc quyền     Sắp xếp: giá ↑
  • Thẻ quà theo độ hiếm: nhãn độ hiếm, biểu tượng lớn, còn x món, giới hạn tháng,
      đủ điểm   → nút 3D "⭐ giá"  → hộp xác nhận → pháo giấy + "Chờ nhận quà"
      chưa đủ   → thanh "còn thiếu N" + nút ghim làm mục tiêu
  • Tab "Quà của tôi": các bước Đã đổi → Chờ trao → Đã nhận (hoặc Huỷ / Từ chối / Hết hạn)
  • Tab "Lịch sử điểm": dòng thời gian, biểu tượng theo nguồn điểm
  • Tab "Cách nhận điểm": thẻ quy tắc + bảng 6 cấp độ (đánh dấu cấp hiện tại)
```

**Giáo viên** (`/teacher/rewards`): chỉ chỉnh giao diện cho đồng bộ (thẻ quà có nhãn độ hiếm, nút 3D), giữ nguyên các luồng đã có.

## 6. Thay đổi theo từng phần

1. **`app/globals.css`**: thêm các tiện ích ở mục 3.
2. **Header** (`components/layout/Header.tsx`): chip điểm hiện thêm biểu tượng cấp (🌱/📘/…) cạnh ⭐ số dư. Lấy cả `lifetimeEarned` trong cùng truy vấn theo khoá chính, không thêm truy vấn.
3. **Thanh bên** (`components/home/HomeSidebar.tsx`):
   - mục đang chọn có nền xanh nhạt, vạch trái và biểu tượng nền xanh;
   - nhóm "Học tập" gồm Trang chủ, Khoá học, Bảng xếp hạng, Điểm thưởng;
   - các nhóm khác giữ nguyên.
4. **Trang chủ học sinh** (`components/home/dashboard/Dashboard.tsx`), theo thứ tự:
   1. `StudentHero`: lưới 3 cột trên máy tính (2 cột thẻ chào + 1 cột thẻ quà mục tiêu), xếp chồng trên điện thoại. Thay cho dải `PointsHomeCard` hiện tại.
   2. Banner đếm ngược kỳ thi (`HomePromo`): thu gọn chiều cao khoảng 30%.
   3. Khoá học: tiêu đề mới, thẻ khoá học hiện thanh tiến độ cho khoá đã ghi danh.
   - Khách và giáo viên: không có `StudentHero`, phần còn lại giữ như cũ.
5. **Thẻ khoá học** (`components/course/CourseCard.tsx`):
   - viền 2px, bóng đáy 4px, nổi lên khi rê chuột;
   - bớt chữ in hoa ở phần thân để dễ đọc;
   - khối tiến độ gọn hơn.
6. **`/rewards`** (`components/points/StudentRewards.tsx`): làm lại theo mục 5, thêm `RewardCard`, `PlayerHud`, `Mascot` và `Confetti` (`components/points/*`).
7. **`/teacher/rewards`**: thẻ quà dùng `rarityOf`, nút 3D.

## 7. Trường hợp biên và rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| **Lệch HTML server/client** (linh vật chọn câu ngẫu nhiên, pháo giấy ngẫu nhiên) | Câu đầu tiên cố định theo chỉ số 0; ngẫu nhiên chỉ sinh trong `useEffect` hoặc khi bấm |
| **Màn 320px**: thanh trạng thái quá nhiều chỉ số | Trên điện thoại các chỉ số xuống dòng thành lưới 3 ô nhỏ; giữ test E2E kiểm tra tràn ngang ở 320/390/768/1366 |
| **Độ tương phản** chữ trắng trên nền xanh/vàng | Chữ trên nền vàng dùng `amber-950`; kiểm tra lại bằng ảnh chụp |
| **Hiệu năng**: thêm hiệu ứng | Chỉ dùng transform/opacity; pháo giấy chỉ tạo khi đổi quà thành công; không thư viện mới (không framer-motion) |
| **Header thêm truy vấn** | Vẫn 1 truy vấn theo khoá chính (lấy thêm `lifetimeEarned`) |
| **Học sinh chưa duyệt / demo** | Thanh trạng thái vẫn hiện; nút đổi quà khoá và có ghi chú (logic đã có) |
| **Học sinh chưa có điểm nào** | Cấp 1 "Tập sự", thanh kinh nghiệm 0, câu nhắc "Nộp bài đầu tiên để nhận điểm nhé!" |
| **`lastLesson` là bài đã hoàn thành gần nhất**, không phải bài kế tiếp | Ghi nhãn "Bài gần nhất" thay vì "Bài tiếp theo"; tính bài kế tiếp để giai đoạn sau |
| **Test E2E** đang bám theo chữ và cấu trúc DOM cũ | Thêm `data-testid` cho thẻ quà, nút đổi, nút ghim; cập nhật `tests/e2e/points.e2e.mjs` |

## 8. Các giai đoạn

1. **Nền tảng:** cấp độ và độ hiếm kèm test (**đã xong, chưa commit**); thêm tiện ích CSS.
2. **`/rewards`:** thanh trạng thái, thẻ quà, lọc, xác nhận đổi quà, pháo giấy, các tab; cập nhật E2E.
3. **Trang chủ:** `StudentHero`, thu gọn banner, tiến độ trên thẻ khoá học, chip header, thanh bên.
4. **Trang của thầy:** đồng bộ giao diện.
5. **Kiểm tra:** `npm test`, `npm run test:e2e`, ảnh chụp 4 cỡ màn hình, tự rà lại code; sau đó `scripts/ai-review.sh diff gamified-ui <base>`.

Mỗi giai đoạn là một commit riêng để dễ quay lại.

## 9. Kiểm thử

- **Logic:** `tests/points/levels-rarity.test.ts` (đã có); thêm test cho `getPointsCard` mở rộng.
- **E2E:**
  - thêm bước lọc quà, kiểm tra nhãn độ hiếm và thuộc tính `data-celebrated` sau khi đổi quà;
  - kiểm tra trang chủ có thanh kinh nghiệm và khối "Bài gần nhất" / "Bắt đầu học";
  - giữ kiểm tra tràn ngang và lỗi JavaScript.
- **Thủ công:** ảnh chụp 320/390/768/1366 cho trang chủ, `/rewards` và `/teacher/rewards`.

## 10. Câu hỏi mở cho thầy (không chặn giai đoạn 1–4)

1. Có muốn rương ngẫu nhiên không? Nếu có, nên bảo đảm "không bao giờ trượt": mỗi lần mở chắc chắn ra ít nhất một món trị giá ≥ giá mở.
2. Có làm đồ trang trí hồ sơ không (khung ảnh, danh hiệu hiện ở bảng xếp hạng)?
3. Linh vật: cú (mặc định) hay con vật khác?

## 11. Chỉnh sau review (Gemini Neon, 20/11)

Chi tiết và lý do ở cuối `GEMINI_PLAN_REVIEW.md`.

1. **Bộ lọc quà:** chỉ hiện các lựa chọn có quà thực tế; nếu chỉ có một loại quà thì ẩn hẳn thanh lọc. Tránh trường hợp học sinh online bấm "Nhận tại lớp" mà thấy trống.
2. **Chip header:** biểu tượng cấp chỉ hiện ở màn ≥ 400px. Thay `getBalance` bằng `getHeaderPoints` (vẫn 1 truy vấn theo khoá chính). E2E đo thêm cỡ 360px.
3. **`getPointsCard`:** chạy các truy vấn song song bằng `Promise.all`.
4. **Thẻ khoá học:** `progress={course.isEnrolled ? course.progress : undefined}`.
5. **Khối bài gần nhất:**
   - có bài: "Bài gần nhất: <tên>" kèm nút [Mở lại];
   - chưa có bài nào: nút [Bắt đầu học] dẫn tới khoá học đầu tiên đã ghi danh, hoặc `/courses`.
6. **Pháo giấy:**
   - khung `data-testid="confetti"` luôn nằm trong DOM;
   - CSS tắt chuyển động khi người dùng bật giảm chuyển động;
   - E2E kiểm tra thuộc tính `data-celebrated` trên trang.
7. **Khi tắt Điểm thưởng** (`POINTS_ENABLED=off`): `StudentHero` vẫn hiện lời chào, bài gần nhất và số bài đã học; ẩn phần điểm, cấp, chuỗi và quà mục tiêu.
