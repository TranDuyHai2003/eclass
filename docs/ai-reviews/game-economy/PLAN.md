# Kế hoạch: Xu & Ngọc, mã quà tặng, nhân vật chibi, gacha, bảng vàng theo khối, hạn nộp theo lớp

> Tác giả: Claude Code · 21/11/2026 · Trạng thái: **đã review** (Gemini Neon, xem `GEMINI_PLAN_REVIEW.md`); đã chỉnh theo 7 finding (đánh dấu *[review]*).
> Nguồn: `docs/ai-reviews/Ý tưởng làm web.docx` (7 ảnh mẫu) + ghi chú của thầy. Nền tảng: Điểm thưởng GĐ1 (`34c4514`), giao diện game nhẹ (`043f14c`), trang chủ (`71c0971`). Các bất biến của hệ điểm ở `GEMINI.md`.

## 1. Mục tiêu và phạm vi

Bản **demo** bắt đúng phong cách tài liệu (thẻ viền đậm, nút 3D lấp lánh, màu kẹo, nhiều hiệu ứng, có âm thanh) nhưng **logic phải chắc** (tiền ảo, kho, mã quà, ngẫu nhiên) và **tải trang không chậm đi**.

| # | Ý tưởng trong tài liệu | Làm gì |
|---|---|---|
| 1 | Hạng / cấp, danh hiệu theo cột mốc (chó rách, người nghèo, phú ông phú bà…) | Thang danh hiệu mới theo tổng xu đã kiếm (mục 4.3) |
| 2 | Chia "server" theo khối 10/11/12, hiện tiền tích luỹ từng người | Lớp có trường `grade`; trang **Bảng Vàng** `/leaderboard` theo khối, top 3 hiện nhân vật + khung |
| 3 | Cửa hàng: số còn lại, giá, độ hiếm, bắt mắt | Làm lại tiệm theo ảnh mẫu: tab Tất cả · Quà hiện vật · Thẻ đặc quyền · Trang trí hồ sơ · Rương bí ẩn |
| 4 | Nhập mã quà tặng (thẻ cào thầy phát khi được điểm 10) | `GiftCode`: thầy tạo lô mã, học sinh nhập → nhận **Ngọc** |
| 5 | Hiện cộng xu khi nộp bài, nộp ảnh bài chữa | Mưa xu bay về ví + số đếm tăng + âm thanh ở màn kết quả và sau khi nộp bài tập ảnh |
| 6 | Nhân vật riêng / trang trí hồ sơ, đổi đồ bằng tiền | Nhân vật **chibi SVG** tuỳ chỉnh (da, tóc, màu tóc, mắt, trang phục, phụ kiện, khung, nền, danh hiệu); đồ mua bằng xu/ngọc hoặc trúng gacha |
| 7 | Gacha, ghi rõ tỉ lệ | Rương Xu và Rương Ngọc; bảng tỉ lệ; bảo hiểm lần 5; trùng đồ trả xu; **chỉ đồ ảo** |
| 8 | NPC "Lucky Boy" nhắc học | NPC chibi với câu thoại tính sẵn ở server (bài sắp hạn, chuỗi tuần, xu chưa tiêu…) |
| 9 | Mỗi học sinh một trang hồ sơ | `/profile/[userId]`: nhân vật, danh hiệu, cấp, xu tích luỹ, thành tích; chủ nhân có nút "Tuỳ chỉnh nhân vật" |
| 10 | Hạn nộp theo lớp; không đặt = không hạn; đúng hạn cộng điểm | `TestDeadline` (đề × lớp); `ON_TIME` +150 xu khi có hạn và nộp kịp |
| 11 | Âm thanh, nút lấp lánh, hiệu ứng | Âm thanh tổng hợp bằng Web Audio (không tải file), nút `.btn-shine`, mưa xu, lật thẻ, rung rương, tia sáng |

**Quyết định của thầy (21/11):** nhân toàn thang điểm **×150** (nộp bài 300 xu); gacha **chỉ đồ ảo**; Ngọc **chỉ từ mã thầy phát** (và rơi hiếm từ rương), không mua được bằng xu.

**Không làm trong đợt này:** đổi ngọc ↔ xu; quà thật trong gacha; chat/tặng đồ giữa học sinh; mua xu bằng tiền thật.

## 2. Tiền tệ

| | Xu (`PointWallet.balance`) | Ngọc (`PointWallet.gems`, mới) |
|---|---|---|
| Nguồn | Học: nộp bài, điểm cao, đúng hạn, bứt phá, bài tập về nhà, chuỗi tuần, thầy thưởng; trả lại khi trùng đồ gacha; hoàn khi huỷ quà | Mã quà tặng; rơi từ rương (hiếm) |
| Tiêu | Quà thật (đã có), đồ trang trí, Rương Xu | Đồ Huyền thoại, Rương Ngọc |
| Hạng/cấp | `lifetimeEarned` chỉ cộng từ các nguồn **học** (không cộng từ gacha, mã quà, hoàn tiền) | Không ảnh hưởng hạng |

Tên hiển thị: "Điểm thưởng" → **"Xu"** (`POINTS_LABEL`), đơn vị "xu"; Ngọc là "ngọc". Tên bảng/cột DB giữ nguyên.

### 2.1 Thang xu mới (`lib/points/config.ts`, nhân 150)

| Nguồn | Cũ | Mới |
|---|---|---|
| Nộp bài / nộp sau hạn | 2 / 1 | **300 / 150** |
| **Đúng hạn** (mới, chỉ khi đề có hạn hiệu lực) | – | **+150** |
| Điểm cao ≥7 / ≥8,5 / =10 | 1 / 2 / 3 | 150 / 300 / 450 |
| Bứt phá | 1 | 150 |
| Thi cuối khoá (nộp, hệ số điểm cao) | 5, ×2 | 750, ×2 |
| Bài tập về nhà nộp / đạt | 1 / 1 | 150 / 150 |
| Giới hạn tự động mỗi ngày | 30 | 4 500 |
| Chuỗi tuần 2/4/8/12, sau 12 mỗi 4 tuần | 2/4/8/12, 12 | 300/600/1 200/1 800, 1 800 |
| Thầy thưởng tay: mỗi lần / mỗi ngày | 10 / 10 | 1 500 / 1 500 |
| Mốc độ hiếm quà (≤) | 50 / 120 / 300 | 7 500 / 18 000 / 45 000 |
| Mẫu quà (`templates.ts`) | ×1 | ×150 (bim bim 12 000) |

Chưa deploy Điểm thưởng lên production → **không cần chuyển đổi dữ liệu cũ**. Test cân bằng (`tests/points/rules.test.ts`) giữ nguyên ý nghĩa: chăm cả tháng ≈ 1 gói bim bim.

Bài có hạn, nộp đúng hạn, điểm 10, bứt phá: 300 + 150 + 450 + 150 = **1 050 xu** (≈ 300 × 3,5).

## 3. Dữ liệu (một migration `20261121000000_game_economy`)

```prisma
enum Currency { XU GEM }
enum PointSource { … cũ …, ON_TIME, GIFTCODE, GACHA, ITEM }   // thêm 4 giá trị

model PointLedger { …; currency Currency @default(XU) }         // bất biến: balance = Σ XU, gems = Σ GEM
model PointWallet { …; gems Int @default(0); gachaPity Int @default(0) }

model StudyClass  { …; grade Int? }                              // 10 / 11 / 12; migration tự đoán từ tên lớp (regex 1[0-2])

model TestDeadline {                                             // hạn riêng theo lớp; không có dòng → dùng Test.dueDate → không có = không hạn
  id String @id @default(cuid()); testId String; classId String; dueDate DateTime
  test Test @relation(onDelete: Cascade); studyClass StudyClass @relation(onDelete: Cascade)
  @@unique([testId, classId])
}

model GiftCode {                                                 // thẻ cào
  id String @id @default(cuid()); code String @unique            // 8 ký tự A-Z2-9 không nhầm (bỏ O/0/I/1)
  currency Currency @default(GEM); amount Int
  maxUses Int @default(1); usedCount Int @default(0)             // thẻ cào cá nhân = 1; mã cả lớp = N
  expiresAt DateTime?; classId String?; note String?; batchId String?
  isActive Boolean @default(true); createdById String; createdAt DateTime
  uses GiftCodeUse[]
  @@index([batchId]) @@index([createdById, createdAt])
}
model GiftCodeUse { id; giftCodeId; userId; createdAt; @@unique([giftCodeId, userId]) @@index([userId]) }

model UserItem   { id; userId; itemId String; source ItemSource (SHOP|GACHA|GIFT); createdAt; @@unique([userId, itemId]) }
model UserAvatar { userId @id; config Json; updatedAt }          // { skin, hair, hairColor, eyes, outfit, accessory?, frame?, background?, title? } = id món đồ
model GachaPull  { id; userId; chest String; currency; cost Int; outcome Json; pityBefore Int; createdAt; @@index([userId, createdAt]) }
```

Danh mục đồ (`lib/game/items.ts`) và rương (`lib/game/gacha.ts`) là **hằng số trong code**, không lưu DB: mã `itemId` là slug ổn định (vd `hair-ponytail`, `frame-rainbow`). Đồ bị bỏ khỏi danh mục vẫn nằm trong `UserItem` nhưng không hiện (ghi chú trong code: chỉ **thêm**, không đổi slug).

Khoá chống trùng trong sổ: `ONTIME:{testId}`, `GIFTCODE:{codeId}`, `ITEM:{itemId}`, `GACHA:{pullId}` (dòng tiêu) và `GACHAWIN:{pullId}` (dòng trúng xu/ngọc).

## 4. Logic lõi

### 4.1 Engine hai loại tiền (`lib/points/engine.ts`)
- `writeEntry(tx, { …, currency })`: cộng vào `balance` (XU) hoặc `gems` (GEM); `lifetimeEarned` chỉ tăng khi `currency = XU` và `source ∈ EARNING_SOURCES` (danh sách tường minh: TEST_SUBMIT, TEST_SCORE, ON_TIME, BREAKTHROUGH, FINAL_TEST, HOMEWORK_SUBMIT, HOMEWORK_PASS, STREAK, MANUAL, REVOKE). GACHA/ITEM/GIFTCODE/REDEEM/REFUND không đụng `lifetimeEarned`.
- `lockWallet` trả thêm `gems`, `gachaPity`. Mọi thao tác tiêu tiền: khoá ví → kiểm tra số dư → ghi sổ → tạo bản ghi liên quan, **cùng giao dịch**.
- `awardOnce` nhận `currency` (mặc định XU); `AUTO_CAPPED_SOURCES` thêm `ON_TIME`.
- *[review]* `netForKey`/`revokeKey` lọc và ghi theo đúng `currency` của khoá (một khoá chỉ thuộc một loại tiền); xoá lượt làm bài thu hồi cả `ONTIME:{testId}`.

### 4.2 Hạn nộp theo lớp (`lib/deadline.ts`)
- `effectiveDueDate({ dueDate, deadlines }, classId)` = hạn của lớp học sinh ?? `Test.dueDate` ?? null. Thuần, có test.
- `onTestSubmitted` nhận `dueDate` **hiệu lực** (actions/test.ts lấy `test.deadlines` theo `user.classId`). Có hạn và `now ≤ hạn` → +300 nộp bài **và** +150 `ON_TIME`; sau hạn → 150; không hạn → 300, không có ON_TIME.
- Bài kiểm tra cuối khoá: giữ như cũ (không đúng hạn/sau hạn).
- Nơi hiển thị hạn phải dùng hạn hiệu lực: trang chủ "Bài cần làm" (`lib/home/student-home.ts` nhận `classId`), trang bài học, trang kết quả. Giáo viên: `/teacher/tests` thêm nút "Hạn theo lớp" → popover liệt kê các lớp gắn khoá (`Course.classes`) với ô ngày giờ riêng; `Test.dueDate` là "hạn chung". Học sinh chưa xếp lớp dùng hạn chung.
- API: `PATCH /api/tests/[testId]` nhận `deadlines: { classId, dueDate | null }[]` (null = xoá dòng); kiểm tra quyền thầy như hiện tại. *[review]* Chỉ nhận `classId` thuộc các lớp gắn với khoá học của đề; lớp lạ bị bỏ qua, không có dòng hợp lệ → 400.

### 4.3 Danh hiệu = cấp (`lib/points/levels.ts`)
Thang mới theo `lifetimeEarned` (xu), 8 bậc, tên hài theo ý thầy (có thể đổi tên tại một chỗ):

| Mốc xu | Danh hiệu | Mốc xu | Danh hiệu |
|---|---|---|---|
| 0 | 🐕 Chó rách | 18 000 | 🌾 Phú nông |
| 1 500 | 🥬 Nghèo rớt mồng tơi | 37 500 | 🎩 Phú ông · Phú bà |
| 4 500 | 🪙 Người nghèo | 75 000 | 💎 Đại gia |
| 9 000 | 🧺 Tiểu thương | 150 000 | 👑 Tỷ phú |

Học chăm (~12 000 xu/tháng) lên Phú nông sau ~1,5 tháng, Đại gia sau một học kỳ. Danh hiệu hiện trên header, hồ sơ, bảng vàng. Đổi danh hiệu → âm thanh "lên cấp" + pháo giấy một lần (ghi `localStorage` mốc đã chúc mừng).

### 4.4 Mã quà tặng (`lib/game/giftcode.ts`)
- Thầy tạo lô: số lượng N (1–200), loại tiền, số lượng, mỗi mã dùng 1 lần (thẻ cào) hoặc M lần (mã cả lớp), hạn, lớp (tuỳ chọn), ghi chú. Sinh mã bằng `crypto.randomInt`, bảng chữ 32 ký tự, 8 ký tự → kiểm tra trùng trước khi tạo. Có nút "In danh sách" (trang in đơn giản) và "Vô hiệu".
- Học sinh nhập mã (ô nhập trên tiệm, chuẩn hoá chữ hoa, bỏ khoảng trắng/gạch): trong giao dịch — `lockWallet` → tìm mã `isActive`, chưa hết hạn, đúng lớp (nếu đặt) → `create GiftCodeUse` (unique chặn nhập lại) → `updateMany where id = ? AND usedCount < maxUses` tăng `usedCount`, `count = 0` → lỗi "Mã đã hết lượt" (giao dịch rollback) → `awardOnce` khoá `GIFTCODE:{id}`.
- Chống dò mã: giới hạn 10 lần nhập sai / 10 phút / học sinh (đếm trong bộ nhớ theo userId, đủ cho demo; ghi chú nâng cấp sang DB nếu cần). Lỗi trả chung chung "Mã không hợp lệ hoặc đã dùng".
- Chỉ học sinh đủ điều kiện (`isEligibleStudent`) mới nhập được; demo bị `demoGuard`.

### 4.5 Nhân vật và đồ (`lib/game/items.ts`, `lib/game/avatar.ts`)
- Ô trang bị: `skin` (4 màu, miễn phí), `hair` (kiểu), `hairColor`, `eyes` (màu), `outfit`, `accessory`, `frame`, `background`, `title`. Mỗi ô có ít nhất 2–3 món **miễn phí** để ai cũng tuỳ chỉnh được ngay; đồ hiếm hơn mua bằng xu, Huyền thoại bằng ngọc hoặc chỉ từ rương.
- `defaultAvatar(userId)`: mặc định suy từ hash id (tóc/màu khác nhau giữa các bạn) → ai chưa chỉnh vẫn có nhân vật riêng.
- Mua (`buyItemInTx`): học sinh hợp lệ → khoá ví → món tồn tại trong danh mục và **bán** (có giá) → chưa sở hữu → đủ tiền → ghi sổ `ITEM:{itemId}` (âm) → `create UserItem` (unique chặn mua trùng).
- Trang bị (`saveAvatar`): kiểm tra từng ô: món đúng ô, miễn phí hoặc có trong `UserItem`; lưu `UserAvatar.config`. Không tốn tiền.
- Vẽ: `components/avatar/Chibi.tsx` — SVG thuần theo tham số (đường nét định nghĩa sẵn trong `items.ts`), kích thước 64–240 px, không ảnh ngoài → không tốn request, không lệch HTML server/client.

### 4.6 Gacha (`lib/game/gacha.ts`)
- Hai rương: **Rương Xu** 600 xu/lượt (Phổ thông 60 % · Hiếm 28 % · Sử thi 10 % · Huyền thoại 2 %) và **Rương Ngọc** 3 ngọc/lượt (Hiếm 55 % · Sử thi 35 % · Huyền thoại 10 %). Bảng tỉ lệ hiện trong hộp "Tỉ lệ rơi quà"; số liệu là hằng số và test kiểm tra tổng = 100 %.
- Bể quà mỗi bậc: đồ trang trí bậc đó + "gói xu" (Phổ thông 150–300 xu, Hiếm 600) + "ngọc" (Huyền thoại của Rương Xu có 1 ngọc). Trùng đồ → trả xu theo bậc (150 / 450 / 1 500 / 4 500) và ghi rõ "trùng, nhận lại xu".
- **Bảo hiểm:** `gachaPity` đếm số lượt Rương Xu liên tiếp chưa ra Sử thi+; lượt thứ 5 ép ≥ Sử thi, về 0 khi trúng. Rương Ngọc không dùng bộ đếm.
- Quay ở **server** (`crypto.randomInt`) trong giao dịch: khoá ví → đủ tiền → ghi sổ tiêu (`GACHA:{pullId}`) → tính kết quả → `create GachaPull` + `UserItem` hoặc ghi sổ trúng (`GACHAWIN:{pullId}`) → cập nhật `gachaPity`. Trả về kết quả; client chỉ **diễn** (rung rương → tia sáng → lật thẻ theo màu bậc → âm thanh theo bậc).
- Bảo vệ học sinh *[review]*: Rương Xu tối đa **3 lượt/ngày** (1 800 xu ≈ 1,5 ngày học chăm; đếm `GachaPull` từ 00:00 VN), Rương Ngọc không trần ngày vì ngọc chỉ do thầy phát; tắt toàn bộ bằng `GACHA_ENABLED=off`; không có "quay 10"; không có câu thoại/nhắc nhở nào thúc quay thêm. Màn hình luôn hiện số dư trước/sau.

### 4.7 Bảng Vàng theo khối (`lib/game/leaderboard.ts`)
- Tab: Khối 10 · 11 · 12 (lớp có `grade`) + "Lớp tôi"; kỳ: Tích luỹ (`lifetimeEarned`) và Tháng này (Σ sổ nguồn học trong tháng VN). Chỉ học sinh thật đã duyệt, không demo.
- Top 3 bục: nhân vật chibi + khung + danh hiệu; danh sách 4–30: hàng gọn; dòng "Bạn" ghim dưới nếu ngoài top. `unstable_cache` 60 giây theo (grade, kỳ) **chỉ cho dữ liệu gốc không phụ thuộc người xem**; render nhân vật từ `UserAvatar.config` (1 truy vấn `findMany in`).
- *[review]* Người xem là demo: `maskUsersForDemo` chạy **ngoài** cache, sau khi lấy dữ liệu; dòng "Bạn" cũng tính ngoài cache.

### 4.8 NPC Lucky Boy (`lib/game/npc.ts`, `components/game/Npc.tsx`)
Câu thoại tính ở server theo thứ tự ưu tiên: bài quá hạn → bài hạn ≤ 2 ngày → tuần này chưa đủ 2 bài → sắp lên danh hiệu (≤ 1 000 xu) → đủ xu mua món mục tiêu → câu chung. *[review]* NPC **không bao giờ** nhắc về rương/bảo hiểm (tránh thúc quay). Bấm NPC đổi câu kế tiếp (không ngẫu nhiên). Thay con cú hiện tại bằng Lucky Boy để chỉ có **một** linh vật.

## 5. Giao diện

**Nhận diện:** giữ nền `#EBF3FF`, Plus Jakarta Sans; thẻ `rounded-3xl` viền 2px bóng đáy; nút `.btn-3d`. Thêm:
- `.btn-shine`: vệt sáng chéo chạy qua mỗi 3 giây (gradient + `translateX`), `.sparkle` 3 ngôi sao nhỏ nhấp nháy ở góc nút chính (Đổi ngay, Mở rương, Nhập code).
- `CoinBurst`: 12–18 đồng xu SVG bay theo đường cong từ điểm bấm về chip ví trên header (`transform` thuần), chip ví nảy, số đếm tăng (`CountUp`).
- Gacha: rương lắc (`@keyframes shake`), tia sáng xoay (`conic-gradient` + `rotate`), thẻ lật (`rotateY`), viền phát sáng theo bậc.
- Tất cả tắt khi `prefers-reduced-motion`.

**Âm thanh** (`lib/sound.ts`): tổng hợp bằng Web Audio (oscillator + envelope), 7 tiếng ngắn: bấm, xu, thành công, lên danh hiệu, rương lắc (tick), mở rương theo bậc, lỗi. Âm lượng 0,15. `AudioContext` tạo sau cử chỉ đầu tiên (chính sách trình duyệt). Nút loa 🔊/🔇 trên tiệm, hồ sơ, gacha và header học sinh; lưu `localStorage("sound")`; mặc định **bật** theo ý thầy. Không có file âm thanh → không thêm request. *[review]* Mọi giá trị `localStorage` (loa, mốc danh hiệu đã chúc mừng) chỉ đọc trong `useEffect`; lượt render đầu dùng mặc định để khớp HTML server.

**Trang:**
- `/rewards` (Tiệm): HUD (nhân vật nhỏ + tên + danh hiệu + thanh kinh nghiệm · chip Xu · chip Ngọc · loa; *[review]* trên mobile tách 2 hàng, tên/danh hiệu `truncate`; thanh tab `overflow-x-auto whitespace-nowrap`) → hàng nút: Nộp bài (+300 xu, về trang chủ) · Nhập code · Túi đồ → tab Tất cả / Quà hiện vật / Thẻ đặc quyền / Trang trí hồ sơ / Rương bí ẩn → lưới thẻ theo độ hiếm (giá xu hoặc ngọc, còn x món, Vĩnh viễn) → NPC.
- `/rewards/gacha` (tách trang, `next/dynamic` cho cảnh rương): tiêu đề, nút "Tỉ lệ rơi quà", rương, thanh bảo hiểm x/5, hai nút mở, lịch sử 10 lượt gần nhất.
- `/profile/[userId]`: nhân vật lớn + khung + nền, tên, lớp, danh hiệu, thanh kinh nghiệm, xu tích luỹ, hạng trong khối, 4 huy hiệu (bài đã nộp, điểm 10, chuỗi tuần tốt nhất, đồ sở hữu), kết quả gần đây (chỉ chủ nhân). Chủ nhân: nút "Tuỳ chỉnh nhân vật" mở `/profile/avatar` (trình chỉnh: xem trước trực tiếp, chọn theo ô, món chưa có hiện giá/khoá). *[review]* Phải đăng nhập; chỉ hiện hồ sơ của STUDENT đã duyệt, không demo (trừ chính chủ xem mình), còn lại `notFound()`. Phần công khai cache theo tag `profile:{userId}` (làm mới khi lưu nhân vật/mua đồ); phần riêng tư (kết quả gần đây) không cache, chỉ truy vấn khi `session.user.id === userId`; người xem demo thấy tên đã che.
- `/leaderboard` (Bảng Vàng) như 4.7; thanh bên thêm mục "Bảng Vàng".
- Trang chủ học sinh: HUD gọn trên `StudentHero` (nhân vật + xu + ngọc), NPC thay vị trí thẻ "Tiệm quà" gợi ý khi có việc cần nhắc, khối "Bảng Vàng tuần" top 3 khối mình.
- Màn kết quả bài: mưa xu + đếm số thay cho toast nhỏ hiện tại (giữ logic chỉ hiện lần đầu).
- Thầy: `/teacher/rewards` thêm tab **Mã quà tặng**; `/teacher/tests` thêm hạn theo lớp; `/admin/classes` thêm cột Khối.

## 6. Hiệu năng (yêu cầu "nhiều tính năng nhưng tải nhanh")

- **Không thêm thư viện** (không framer-motion, howler, lottie). Nhân vật và biểu tượng là SVG nội tuyến; âm thanh tổng hợp.
- Phần nặng tải lười: `AvatarEditor`, `GachaScene`, `GiftCodeDialog`, `CoinBurst` (`next/dynamic`, `ssr: false` chỉ với cảnh gacha). Trang chủ chỉ nhận thêm 1 truy vấn (`UserAvatar`) gộp vào `Promise.all` hiện có; header vẫn 1 truy vấn theo khoá chính (lấy thêm `gems`).
- Danh mục đồ là hằng số nhỏ (~15 KB); trang nào không cần thì không import (tách `items.ts` / `items-svg.ts`).
- Bảng Vàng và hồ sơ: `unstable_cache` 60 giây; truy vấn có `select` và `take`.
- Hiệu ứng chỉ `transform`/`opacity`; không `box-shadow` động; `will-change` chỉ khi đang chạy.
- Đo: `next build` so kích thước First Load JS của `/`, `/rewards`, `/profile` trước/sau (ghi vào báo cáo); `npm run test:audit` thêm trang mới; mục tiêu First Load JS trang mới ≤ trang `/rewards` hiện tại + 30 KB.

## 7. Rủi ro và cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Gacha với học sinh vị thành niên → phụ huynh phản đối | Chỉ đồ ảo; tỉ lệ công khai; Rương Xu 3 lượt/ngày; NPC không nhắc rương; công tắc tắt; không mua xu bằng tiền thật |
| Hai tab nhập cùng mã / hai bạn dùng mã cuối cùng | `GiftCodeUse` unique + `updateMany … usedCount < maxUses` trong giao dịch; thiếu dòng nào → rollback |
| Bấm "Mở rương" hai lần | `lockWallet` tuần tự; ví thiếu tiền lượt 2 → lỗi, không trừ âm; client khoá nút khi `pending` |
| Quay ở client bị sửa kết quả | Kết quả tính ở server, client chỉ diễn; `outcome` lưu trong `GachaPull` |
| Trùng đồ hoàn xu làm tăng hạng | Hoàn xu từ gacha không vào `lifetimeEarned` |
| Nhân ×150 làm sai test / mẫu quà | Sửa mọi hằng số cùng một commit; `rules.test.ts` kiểm tra lại tỉ lệ bim bim/tháng |
| Hạn theo lớp: học sinh đổi lớp sau khi nộp | Tính hạn **tại thời điểm nộp**; sổ ghi lý do "đúng hạn (lớp X)" |
| Đề có hạn chung nhưng lớp không đặt | Dùng hạn chung — đúng ý "không đặt hạn thì không hạn" áp cho **cả hai** đều trống |
| Lệch HTML server/client | Ngẫu nhiên chỉ trong `useEffect`/server; NPC câu đầu cố định; nhân vật mặc định suy từ hash id (xác định) |
| Âm thanh gây phiền trên lớp | Nút tắt ở mọi trang có âm thanh; nhớ lựa chọn; chỉ phát sau cử chỉ |
| `UserAvatar.config` chứa món không hợp lệ (API cũ/đồ bị gỡ) | Khi vẽ: món không hợp lệ → món mặc định của ô |
| Demo xem hồ sơ bạn khác | Che tên như bảng xếp hạng; demo không ghi được gì |
| Tài khoản chưa duyệt | Xem được nhân vật mặc định, không mua/quay/nhập mã (thông báo rõ) |

## 8. Các giai đoạn (mỗi giai đoạn một commit, review diff sau mỗi giai đoạn)

| GĐ | Nội dung | Test |
|---|---|---|
| 0 | Schema + migration; config ×150, nhãn "Xu"; engine hai tiền; danh hiệu mới; `effectiveDueDate` + `ON_TIME`; hạn hiệu lực ở trang chủ/bài học | `rules`, `hooks` (đúng hạn/sau hạn/không hạn/hạn lớp; xoá lượt thu hồi cả `ONTIME`), `engine` (gems = Σ GEM; `lifetimeEarned` không tăng từ GIFTCODE/GACHA/REFUND/ITEM; thu hồi khoá ngọc), `levels`, `deadline` |
| 1 | Mã quà tặng (thầy tạo lô, in; học sinh nhập); âm thanh; mưa xu ở màn kết quả; `.btn-shine`; header xu + ngọc + loa | `giftcode` (hết lượt, nhập lại, hết hạn, sai lớp, đồng thời; giới hạn 10 lần sai/10 phút; demo và chưa duyệt bị chặn); E2E nhập mã |
| 2 | Chibi + danh mục đồ + túi đồ + trình chỉnh + hồ sơ `/profile/[userId]` + tab Trang trí trong tiệm + mua đồ | `items` (mua trùng, thiếu tiền, ngọc, ô sai), `avatar` (config hợp lệ/mặc định), `profile` (demo bị che tên; người khác không thấy kết quả gần đây; hồ sơ thầy/chưa duyệt → 404); E2E chỉnh nhân vật 390/1366 |
| 3 | Gacha: bể quà, tỉ lệ, bảo hiểm, trùng → xu, giới hạn ngày, cảnh mở rương | `gacha` (tổng tỉ lệ, mô phỏng 20 000 lượt với RNG giả, bảo hiểm lần 5, trùng, bất biến sổ–ví, 3/ngày; đồng thời: 2 lượt cùng lúc khi chỉ đủ tiền 1 lượt hoặc đang ở lượt 3/3 → chỉ 1 thành công); E2E mở rương |
| 4 | Bảng Vàng theo khối; NPC Lucky Boy; trang chủ (HUD, NPC, top 3); thầy: hạn theo lớp UI, tab mã quà; admin: khối | `leaderboard` (lọc khối, demo, kỳ tháng); E2E trang chủ/bảng vàng; `npm run test:audit`; đo bundle |

Sau GĐ4: rà lại toàn bộ, Gemini review diff tổng, rồi chờ thầy duyệt deploy (buổi tối; kèm migration Điểm thưởng còn chưa deploy).

## 8b. Trước khi deploy (ghi chú vận hành)

- Production **chưa** có bảng Điểm thưởng (`20261119000000_add_reward_points` chưa deploy) → migration `20261121000000_game_economy` chạy nối tiếp, không cần quy đổi dữ liệu ×150 (câu hỏi review GĐ0).
- Sau deploy: admin vào **Quản lý lớp học** kiểm tra cột **Khối** (migration tự đoán từ tên lớp, vd "12A" → 12).
- Biến môi trường tuỳ chọn: `POINTS_ENABLED=off` tắt toàn bộ Xu; `GACHA_ENABLED=off` chỉ tắt rương.
- Khởi động lại dev server sau khi kéo code (Prisma client mới).

## 9. Câu hỏi còn mở (không chặn, mặc định như ghi)

1. Tên danh hiệu (4.3) — thầy đổi tuỳ ý trước khi deploy.
2. Giá rương và tỉ lệ (4.6) — chỉnh một chỗ trong `lib/game/gacha.ts`.
3. Có cho học sinh online xem bảng vàng toàn trường (mọi khối) không? Mặc định: chỉ các tab khối + lớp mình.

## 10. GĐ6 — Tiệm Quà theo mockup Gemini Canvas thứ hai (21/11/2026)

Nguồn: https://gemini.google.com/share/5efaee92ce10 (thầy yêu cầu "đầy đủ các tab, hiệu ứng, tính năng, đẹp hơn nữa"). Chỉ đổi giao diện; logic xu/ngọc/rương giữ nguyên, rương vẫn gọi `openChest` (kết quả do server quyết).

| Phần | Mockup | Làm |
|---|---|---|
| Menu Tiệm Quà | Nút cửa hàng mở menu: thời tiết Nắng/Mưa/Tuyết + 8 lối tắt | `ShopMenuModal`; thời tiết lưu localStorage (đọc trong effect), lớp hiệu ứng `pointer-events:none`, tắt khi `prefers-reduced-motion`; lối tắt: Cửa hàng, Bài tập, Hộp bí ẩn, Bảng vàng, Thẻ cào, Túi đồ, Danh hiệu, Nhân vật (thay "Giáo viên": học sinh không phát mã; thầy phát mã ở /teacher/rewards) |
| Hộp Bí Ẩn | Khối tím "Đài Cầu Nguyện" 2 hộp, chấm bảo hiểm, chip cực phẩm; hộp thoại cầu nguyện + "CHÚC MỪNG!" | `GachaPanel` trong danh mục Hộp bí ẩn + `GachaModal` (tải lười) mở rương ngay trong tiệm; trang `/rewards/gacha` giữ để xem lịch sử |
| Danh hiệu | Hộp thoại "Hệ Thống Danh Hiệu" (Đã mở / Chưa đạt) | `TitlesModal`, mở từ huy hiệu cấp ở HUD và menu |
| Bảng Vàng | Banner "Sự kiện tuần" | Banner thật: thử thách chuỗi tuần (hoạt động tuần này / mục tiêu, còn N ngày — tính ở server) |
| Nộp bài | Mục "Đã duyệt" | Thêm các bài đã nộp gần đây (điểm) |
| Thẻ sản phẩm | Hình vẽ riêng từng quà, sao lấp lánh ở thẻ hiếm | `RewardArt` (SVG theo từ khoá tên quà, mặc định emoji); sao góc thẻ Sử thi/Huyền thoại |
| Gọn lưới | "Tất cả" ~13 món | "Tất cả" bỏ đồ chỉ-từ-rương; Trang trí có chip lọc theo ô (Tóc, Màu tóc, Mắt, Trang phục, Phụ kiện, Khung, Nền, Danh hiệu) |

Không làm: "Góc Giáo Viên" trong tiệm học sinh (thầy không vào /rewards; phát mã đã có ở tab Mã quà tặng), "Reset demo".
Test: E2E tiệm cập nhật (menu, thời tiết, danh hiệu, mở rương trong tiệm), audit 4 bề rộng, đo JS tải lần đầu /rewards.
