# Review code: game-economy

> Gemini (Neon, gemini.google.com). Claude chép lại nguyên văn (bỏ dòng trích dẫn tên file) và thêm bảng "Claude kiểm chứng" sau mỗi giai đoạn.

---

## Giai đoạn 0 — diff `71c0971..e7107ec` (21/11/2026)

### Summary

Tổng thể thiết kế sổ hai loại tiền (XU/GEM), tách hạn nộp theo lớp (lib/deadline.ts), và bộ test unit/integration khá gọn và giữ đúng các bất biến khoá ví (lockWallet), idempotency (awardOnce/revokeKey). Tuy nhiên có 1 lỗi CRITICAL chắc chắn làm gãy prisma migrate deploy trên PostgreSQL do dùng regex lookbehind không được PostgreSQL hỗ trợ, cùng 1 rủi ro lớn về dữ liệu cũ trên production khi nhân thang điểm ×150. Cần sửa lỗi migration trước khi merge/deploy.

### Findings

#### [CRITICAL] Regex lookbehind (?<![0-9]) trong migration sẽ làm lỗi prisma migrate deploy trên PostgreSQL
- **Where:** prisma/migrations/20261121000000_game_economy/migration.sql:158-159
- **Scenario:** Khi release phase trên Heroku chạy prisma migrate deploy, PostgreSQL thực thi câu lệnh UPDATE "StudyClass" … substring("name" from '(?<![0-9])(1[0-2])(?![0-9])'). Engine regex POSIX ARE của PostgreSQL không hỗ trợ negative lookbehind (?<!...) → PostgreSQL lập tức báo lỗi ERROR: invalid regular expression: quantifier operand invalid và rollback toàn bộ migration.
- **Why it matters:** Không thể deploy lên production; release phase sẽ thất bại ngay khi chạy migration.
- **Minimal fix:** Bỏ lookbehind, dùng biên không phải chữ số (^|[^0-9]) và nhóm không bắt (?:...) cho substring:
  `UPDATE "StudyClass" SET "grade" = CAST(substring("name" from '(?:^|[^0-9])(1[0-2])(?:[^0-9]|$)') AS INTEGER) WHERE "grade" IS NULL AND "name" ~ '(^|[^0-9])(1[0-2])([^0-9]|$)';`

#### [HIGH] Migration chưa quy đổi ×150 cho dữ liệu Điểm thưởng / Quà hiện có trên production
- **Where:** prisma/migrations/20261121000000_game_economy/migration.sql (toàn file)
- **Scenario:** Nếu database production đã có dữ liệu PointWallet, PointLedger, Reward theo thang cũ (ví dụ: quà "Gói bim bim" giá 80, học sinh chăm có balance = 80, lifetimeEarned = 80). Sau khi deploy thang mới ×150: học sinh nộp 1 bài được 300 xu có thể đổi ngay 3 gói bim bim giá 80 cũ; học sinh cũ bị tụt danh hiệu về cấp 1 vì lifetimeEarned = 80 < 1500.
- **Why it matters:** Phá vỡ cân bằng kinh tế và danh hiệu của học sinh ngay sau khi deploy (nếu production đã có dữ liệu thật).
- **Minimal fix:** Nếu production đã có dữ liệu Điểm thưởng/Quà cũ, bổ sung câu UPDATE nhân 150 trong cùng migration cho PointLedger.amount (với currency = 'XU'), PointWallet.balance, PointWallet.lifetimeEarned, Reward.price và Redemption.cost để giữ nguyên bất biến balance = Σ amount. (Bỏ qua nếu production chưa có dữ liệu Điểm thưởng hoặc đã có script chuyển đổi riêng.)

#### [MEDIUM] Truy vấn hạn theo lớp trong submitTestAttempt nằm ngoài runPointsSafely
- **Where:** actions/test.ts:927-930
- **Scenario:** Học sinh bấm nộp bài → transaction chính lưu studentAttempt (completedAt, score) đã commit thành công. Ngay sau đó, prisma.testDeadline.findMany hoặc prisma.user.findUnique gặp lỗi kết nối DB tạm thời → submitTestAttempt ném exception chưa được bắt, màn hình học sinh báo lỗi nộp bài dù bài đã được lưu. Ngoài ra, khi POINTS_ENABLED=off, hai truy vấn này vẫn chạy thừa mỗi lần nộp bài.
- **Why it matters:** Vi phạm bất biến số 4 (GEMINI.md): lỗi ở phần tính điểm không bao giờ được làm hỏng việc nộp bài.
- **Minimal fix:** Chuyển việc truy vấn testDeadline và user.classId vào bên trong onTestSubmitted (trong runPointsSafely), hoặc bọc block Promise.all(...) + onTestSubmitted(...) trong try/catch riêng.

#### [LOW] revokeKey cho khoá XU không thuộc nguồn học tập sẽ trừ nhầm lifetimeEarned
- **Where:** lib/points/engine.ts:94 và lib/points/engine.ts:147-152
- **Scenario:** EARNING_SOURCES chứa "REVOKE", nhưng không chứa "GIFTCODE" hay "GACHA". Nếu ở các giai đoạn sau gọi revokeKey(tx, userId, key, reason, staffId, "XU") để thu hồi một mã quà tặng (GIFTCODE) bằng xu, writeEntry sẽ thấy source === "REVOKE" và trừ lifetimeEarned, dù lúc cộng GIFTCODE không hề tăng lifetimeEarned.
- **Why it matters:** Hiện tại chưa gây lỗi vì revokeKey mới chỉ dùng cho bài kiểm tra và bài tập về nhà, nhưng là bẫy tiềm ẩn cho các giai đoạn sau của game-economy.
- **Minimal fix:** Trong revokeKey, kiểm tra xem các dòng gốc của key có thuộc EARNING_SOURCES không (hoặc truyền thêm tham số tùy chọn affectsLifetime vào writeEntry) trước khi trừ lifetimeEarned.

### Questions for the author

Database production (eclass-vps) hiện đã có dữ liệu thật trong PointWallet / PointLedger / Reward chưa? Nếu có, việc nhân ×150 sẽ đưa vào migration này hay chạy qua script riêng trước khi deploy?

### Claude kiểm chứng (GĐ0)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Lookbehind làm gãy `migrate deploy` | **Sai về tiền đề, vẫn sửa.** PostgreSQL ARE hỗ trợ lookbehind từ 9.6; migration đã chạy thành công trên PostgreSQL local và đoán đúng khối cho 5 lớp. Nhưng regex đơn giản hơn không có hại và an toàn với mọi phiên bản. | Đổi sang `(?:^|[^0-9])(1[0-2])(?:[^0-9]|$)`; chạy thử lại câu UPDATE mới trên DB local (đúng khối); cập nhật checksum migration local. |
| 2 | Chưa quy đổi ×150 dữ liệu cũ | **Không áp dụng.** Production chưa có bảng Điểm thưởng (migration `20261119000000_add_reward_points` chưa deploy — xem memory/deploy), nên không có dữ liệu cần chuyển. Ghi chú vào PLAN mục 2.1 đã có sẵn. | Không sửa migration. Nếu deploy GĐ cũ trước rồi mới deploy đợt này, cần script ×150 — ghi vào mục "Trước khi deploy" của PLAN. |
| 3 | Truy vấn hạn ngoài `runPointsSafely` | **Đúng.** | Tra `TestDeadline` + `classId` bên trong `onTestSubmitted` (trong giao dịch điểm); `actions/test.ts` không truy vấn thêm. Test hồi quy: lớp có hạn riêng còn hạn → đúng hạn dù hạn chung đã qua. |
| 4 | `revokeKey` trừ nhầm `lifetimeEarned` | **Đúng** (bẫy cho GĐ sau). | `revokeKey` xem nguồn của dòng gốc; chỉ trừ `lifetimeEarned` nếu nguồn ∈ `EARNING_SOURCES`. Test: thu hồi `GIFTCODE` giữ nguyên danh hiệu, thu hồi `TEST_SUBMIT` thì trừ. |
| Q | Production có dữ liệu điểm chưa? | Chưa — tính năng Điểm thưởng chưa deploy lần nào. | — |

---

## Giai đoạn 1 — diff `e7107ec..e4e2e54` (21/11/2026)

### Summary

Nhìn chung code giai đoạn 1 được triển khai chắc chắn: các bất biến sổ–ví, khoá ví lockWallet, chống đua lượt cuối (updateMany có điều kiện usedCount < maxUses), chống nhập trùng hai tab, phân quyền server action, tách giftcode-shared.ts (không lọt Prisma vào client), và các sửa từ review GĐ0 (revokeKey giữ lifetimeEarned, tra TestDeadline trong runPointsSafely) đều đúng và có test bao phủ tốt. Rủi ro lớn nhất nằm ở xử lý múi giờ expiresAt khi thầy tạo lô mã quà tặng (sẽ lệch +7 tiếng trên Heroku chạy UTC) và nội suy chuỗi chưa escape vào document.write khi in thẻ.

### Findings

#### [HIGH] Lệch múi giờ +7 tiếng khi đặt hạn dùng (expiresAt) cho lô mã quà tặng trên production
- **Where:** components/points/GiftCodesTab.tsx:89, lib/game/giftcode.ts:40,65
- **Scenario:** Thầy ở Việt Nam (UTC+7) chọn hạn dùng 2026-11-22T18:00 trong `<input type="datetime-local">`. Giá trị gửi lên createGiftCodes là chuỗi không có múi giờ "2026-11-22T18:00". Trên Heroku (chạy UTC), new Date("2026-11-22T18:00") hiểu là 18:00 UTC = 01:00 sáng ngày 23/11 giờ Việt Nam (muộn hơn 7 tiếng). Tương tự, nếu thầy chọn mốc quá khứ gần (ví dụ 2 tiếng trước giờ VN), kiểm tra d.getTime() < Date.now() trên server UTC vẫn cho qua.
- **Why it matters:** Mã quà tặng hết hạn sai 7 tiếng so với giờ thầy chọn, vi phạm quy ước múi giờ Việt Nam (UTC+7) của hệ thống.
- **Minimal fix:** Trước khi gửi từ GiftCodesTab.tsx, chuyển expiresAt sang chuỗi ISO có múi giờ: expiresAt ? new Date(expiresAt).toISOString() : null (hoặc trên server trong lib/game/giftcode.ts, nếu chuỗi expiresAt khớp /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ thì gắn thêm +07:00 trước khi new Date(...)).

#### [MEDIUM] HTML injection / XSS khi in thẻ quà tặng bằng w.document.write
- **Where:** components/points/GiftCodesTab.tsx:39-57
- **Scenario:** Thầy (hoặc tài khoản TEACHER/ADMIN khác) nhập ghi chú lô mã có ký tự HTML như "Điểm < 10" hoặc `<img src=x onerror=...>`, sau đó bấm In thẻ / In. label (chứa note) được nối thẳng vào chuỗi HTML trong w.document.write(...) trên cửa sổ cùng origin.
- **Why it matters:** Dấu <, > làm vỡ bố cục thẻ in; nếu chứa thẻ HTML/script sẽ thực thi trực tiếp trong phiên đăng nhập của giáo viên/admin.
- **Minimal fix:** Thêm hàm escape HTML (&, <, >, ", ') và áp dụng cho label (và c) trước khi ghép vào chuỗi HTML trong printCodes.

#### [LOW] Nút "In thẻ" ở khung vừa tạo (justCreated) in sai nếu thầy sửa form trước khi bấm in
- **Where:** components/points/GiftCodesTab.tsx:26,34,116
- **Scenario:** Thầy tạo lô 10 mã × 3 ngọc (ghi chú "Điểm 10"), sau đó sửa ô amount thành 5 hoặc đổi currency/note để chuẩn bị tạo lô tiếp, rồi mới bấm In thẻ ở khung Vừa tạo 10 mã. Hàm printCodes đọc amount, currency, note hiện tại của form thay vì thông số của lô vừa tạo.
- **Why it matters:** Thẻ in ra ghi sai mệnh giá hoặc ghi chú so với dữ liệu thực tế lưu trong DB.
- **Minimal fix:** Lưu justCreated dạng { codes: string[]; label: string } | null ngay tại thời điểm create thành công và truyền justCreated.label vào printCodes.

#### [LOW] CountUp chưa tôn trọng prefers-reduced-motion
- **Where:** components/game/CoinBurst.tsx:69-83
- **Scenario:** Người dùng bật tùy chọn "Giảm chuyển động" (prefers-reduced-motion: reduce) trên thiết bị. CSS đã ẩn coin-fly, nhưng CountUp vẫn chạy requestAnimationFrame đếm số trong 800ms.
- **Why it matters:** Chưa đồng nhất về khả năng tiếp cận (accessibility) với các hiệu ứng còn lại.
- **Minimal fix:** Trong useEffect của CountUp, kiểm tra if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; } trước khi khởi chạy requestAnimationFrame.

### Questions for the author

Không có câu hỏi nào; ngữ cảnh trong diff đủ để kết luận.

### Claude kiểm chứng (GĐ1)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Hạn dùng lệch +7 giờ trên Heroku (UTC) | **Đúng.** Chuỗi `datetime-local` không có múi giờ bị server UTC hiểu sai. | Client gửi ISO (`new Date(v).toISOString()`); server thêm `parseVnDateTime` coi chuỗi không múi giờ là +07:00 (phòng gọi API trực tiếp). Test: `"2026-11-22T18:00"` → `11:00Z`. |
| 2 | XSS khi in thẻ qua `document.write` | **Đúng** (thầy/admin tự nhập, nhưng vẫn phải escape). | Hàm `esc` áp cho mã và nhãn. |
| 3 | Nút "In thẻ" lô vừa tạo đọc form hiện tại | **Đúng.** | `justCreated = { codes, label }` chụp lúc tạo xong. |
| 4 | `CountUp` bỏ qua "giảm chuyển động" | **Đúng.** | `matchMedia` → hiện số cuối ngay. |

---

## Giai đoạn 2–4 — diff `e4e2e54..317b9fa` (21/11/2026)

### Summary

Nhìn chung lõi tiền ảo (gacha, mua đồ, bất biến sổ–ví, lockWallet, trần ngày, trùng đồ) được viết chặt chẽ và có bộ test khá đầy đủ. Điểm rủi ro lớn nhất nằm ở cache Bảng Vàng dùng nhầm prisma thay vì prismaBase (có thể làm rò/lỗi phiên demo trong unstable_cache), API PATCH /api/tests/[testId] thiếu demoGuard và ghi dở dang khi lưu hạn nộp theo lớp. Ngoài ra có một số lỗi hiệu năng ở getMyRank và tràn bố cục ở màn hình 320px.

### Findings

#### [HIGH] unstable_cache của Bảng Vàng gọi prisma (đã mở rộng cho demo) thay vì prismaBase
- **Where:** lib/game/leaderboard.ts:2,35,44,78-85 và lib/game/inventory.ts:23-28
- **Scenario:** loadLeaderboard chạy bên trong unstable_cache (cache dùng chung 60 giây cho mọi người xem) nhưng lại truy vấn bằng prisma từ @/lib/prisma (client đã mở rộng để che dữ liệu tài khoản demo). Nếu người đầu tiên làm miss cache là tài khoản demo, hoặc nếu extension của prisma đọc session/cookie (auth()), Next.js sẽ ném lỗi dynamic usage trong unstable_cache hoặc lưu luôn tên đã bị che vào cache chung cho học sinh thật.
- **Why it matters:** Vi phạm cô lập cache/demo (chính lý do phải gọi maskUsersForDemo ngoài cache ở app/leaderboard/page.tsx:33), có thể làm hỏng trang Bảng Vàng hoặc trang chủ trên production.
- **Minimal fix:** Dùng prismaBase trong loadLeaderboard và cho phép truyền client (db = prisma) vào getAvatars(userIds, prismaBase) để toàn bộ truy vấn bên trong unstable_cache không phụ thuộc session người xem.

#### [MEDIUM] PATCH /api/tests/[testId] không chặn tài khoản demo (demoGuard)
- **Where:** app/api/tests/[testId]/route.ts:79-109
- **Scenario:** Một tài khoản có isDemo = true và role = "TEACHER" hoặc "ADMIN" gửi PATCH /api/tests/[testId] với body { deadlines: [...] }. Route chỉ kiểm tra session.user.role và requireTestAccess, không gọi demoGuard(), nên tài khoản demo ghi đè/xoá được hạn nộp của đề.
- **Why it matters:** Vi phạm quy ước isDemo là tài khoản chỉ đọc (read-only) ở mọi thao tác ghi.
- **Minimal fix:** Gọi const blocked = await demoGuard(); if (blocked) return new NextResponse(blocked.error, { status: 403 }); ngay đầu hàm PATCH (và nên kiểm tra tương tự ở DELETE).

#### [MEDIUM] applyTestDeadlines ghi từng dòng ngoài transaction, gây ghi dở dang khi có ngày không hợp lệ
- **Where:** lib/test-deadlines.ts:27-43
- **Scenario:** Gửi mảng [{ classId: clsA, dueDate: "2026-12-01T20:00" }, { classId: clsB, dueDate: "rác" }]. Vòng for đã upsert xong hạn của clsA vào DB rồi mới gặp clsB lỗi parseVnDateTime và trả { ok: false } (HTTP 400).
- **Why it matters:** API báo lỗi 400 khiến giao diện nghĩ lưu thất bại, nhưng DB thực tế đã bị thay đổi một phần.
- **Minimal fix:** Kiểm tra và parse toàn bộ dueDate trước khi ghi DB, sau đó bọc toàn bộ deleteMany/upsert trong prisma.$transaction.

#### [MEDIUM] getMyRank gọi loadLeaderboard(..., 10000) không cache và tải toàn bộ avatar/túi đồ của cả khối chỉ để lấy thứ hạng
- **Where:** lib/game/leaderboard.ts:101-106
- **Scenario:** Mỗi lần học sinh mở /leaderboard, getMyRank chạy loadLeaderboard(scope, period, 10000) ngoài cache: truy vấn toàn bộ user trong khối, groupBy sổ điểm (nếu kỳ tháng), rồi gọi getAvatars tải toàn bộ userAvatar và userItem của mọi học sinh trong khối chỉ để lấy { rank, total, xu } của 1 người và bỏ hết dữ liệu avatar.
- **Why it matters:** Gây dư truy vấn nặng mỗi lần tải /leaderboard, làm mất phần lớn lợi ích của việc cache Bảng Vàng.
- **Minimal fix:** Tách phần tính danh sách (userId, xu) đã sắp xếp ra khỏi bước gọi getAvatars, để getMyRank chỉ tính thứ hạng mà không truy vấn userAvatar/userItem.

#### [LOW] Tràn ngang trên màn hình 320px ở bục Top 3 Bảng Vàng và Popover hạn theo lớp
- **Where:** components/game/Leaderboard.tsx:75,84 và app/teacher/tests/_components/ClassDeadlinesClient.tsx:66
- **Scenario:** Ở màn hình 320px, bục Top 3 dùng grid-cols-3 (~88px mỗi cột sau padding/gap) nhưng Chibi ở hạng 1 đặt cứng size={96} (width="96"), dễ tràn khung cột trên điện thoại nhỏ. ClassDeadlinesClient đặt PopoverContent có w-[340px], lớn hơn chiều rộng 320px.
- **Why it matters:** Gây vỡ/tràn ngang giao diện ở ngưỡng 320–390px.
- **Minimal fix:** Thêm max-w-full h-auto vào className của Chibi trong bục Top 3, và đổi w-[340px] thành w-[min(340px,calc(100vw-1rem))] ở ClassDeadlinesClient.

#### [LOW] Nút mở rương đặt chiều cao cố định h-12 dễ bị cắt chữ khi xuống dòng ở 320px
- **Where:** components/game/GachaScene.tsx:145,155
- **Scenario:** Nút Mở Rương Xu (600 xu) · còn 3/3 hôm nay và Mở Rương Ngọc (3 ngọc) · không Phổ thông có h-12; ở 320px chữ xuống 2 dòng sẽ sát mép hoặc bị cắt dọc.
- **Why it matters:** Giảm khả năng đọc và bấm trên điện thoại nhỏ.
- **Minimal fix:** Đổi h-12 thành min-h-12 py-2.

#### [LOW] Thiếu kiểm tra isPointsEnabled() ở /leaderboard và thiếu test phân quyền cho updateClassGrade
- **Where:** app/leaderboard/page.tsx:13-15, actions/class.ts:92-106
- **Scenario:** Khi tắt tính năng Xu (isPointsEnabled() === false), HomeSidebar ẩn mục Bảng Vàng nhưng truy cập thẳng /leaderboard vẫn mở được (khác với /rewards/gacha và /profile/avatar đều trả notFound()). Ngoài ra, updateClassGrade chưa có unit test kiểm tra chặn STUDENT/TEACHER và kiểm tra biên grade.
- **Why it matters:** Không đồng nhất khi tắt cờ tính năng và thiếu lớp bảo vệ hồi quy cho action admin mới.
- **Minimal fix:** Thêm if (!isPointsEnabled()) notFound(); ở đầu LeaderboardPage và bổ sung test cho updateClassGrade.

### Questions for the author

lib/demo-privacy.ts (maskUsersForDemo) đọc trường id hay userId? File này không đính kèm trong gói review. Trong app/profile/[userId]/page.tsx:24, bạn truyền { id: raw.id, ... }, còn trong app/leaderboard/page.tsx:33 và app/page.tsx:41, bạn truyền LeaderboardRow[] vốn dùng trường userId (không có id). Nếu maskUsersForDemo dựa vào id để giữ nguyên tên chính chủ demo hoặc tạo bí danh xác định, việc truyền userId có thể làm sai lệch việc che tên demo.

### Claude kiểm chứng (GĐ2–4)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | `prisma` (extension demo) trong `unstable_cache` | **Một phần.** Extension tự trả dữ liệu gốc bên trong cache (`getDemoViewerId` bắt lỗi `headers()` → null, xem lib/demo-privacy.ts) nên không lộ/không ném lỗi. Nhưng quy ước dự án (`actions/ranking.ts`) là dùng `prismaBase` trong cache. | `rankedUsers`/`loadLeaderboard`/`getGrades` dùng `prismaBase`; `getAvatars(ids, client)` nhận client. |
| 2 | PATCH thiếu `demoGuard` | **Sai.** `middleware.ts:34` đã chặn mọi method ghi trên `/api/*` cho tài khoản demo (trả về trước khi vào route). | Không sửa. |
| 3 | `applyTestDeadlines` ghi dở dang | **Đúng.** | Parse toàn bộ trước, ghi trong `$transaction`; test: một dòng hỏng → DB không đổi. |
| 4 | `getMyRank` tải avatar cả khối | **Đúng.** | Tách `rankedUsers` (không avatar); `getMyRank` dùng hàm này; top N mới tải avatar. |
| 5 | Tràn 320px: Chibi 96px, popover 340px | **Đúng.** | `h-auto max-w-full`; `w-[min(340px,calc(100vw-1rem))]`. |
| 6 | Nút rương `h-12` cắt chữ | **Đúng.** | `min-h-12 py-2`. |
| 7 | `/leaderboard` thiếu `isPointsEnabled`; thiếu test `updateClassGrade` | **Đúng** phần cờ tính năng. Test `updateClassGrade` bỏ qua vì server action gọi `auth()` (không chạy được trong node:test; các action khác của dự án cũng không có unit test, phân quyền kiểm tra bằng `session.user.role !== "ADMIN"`). | Thêm `notFound()` khi tắt Xu. |
| Q | `maskUsersForDemo` dùng `id` hay `userId`? | **Đúng chỗ.** Hàm dựa vào `user.id` (giữ chính chủ demo, bí danh theo id); `LeaderboardRow` chỉ có `userId` → chính chủ demo cũng bị che và bí danh suy từ tên. | Map `id: userId` trước khi che ở `/leaderboard` và trang chủ. |

## Giai đoạn 5–6 (Tiệm Quà theo hai mockup Canvas) — diff `39910d0..6ecf611` (21/11/2026)

Gửi qua Gemini web (model Neon). Báo cáo tóm tắt; nguyên văn lấy bằng `innerText`.

### Summary

Bản làm lại Tiệm Quà giữ tốt các bất biến ví/sổ cái phía server, xử lý `prefers-reduced-motion` đầy đủ và tránh lệch HTML server/client cho thời tiết (localStorage đọc sau mount, vị trí hạt cố định) và banner thử thách tuần (tính ở server). Rủi ro nhất là luồng mở rương trong `useGachaPull`/`GachaModal` (chưa chặn bấm đúp ở mức hàm, nút hộp quà chưa khoá khi hết lượt ngày) và tiêu đề hộp thoại ở 320px.

### Findings

#### [MEDIUM] Chưa chặn bấm đúp trong `useGachaPull`; nút hình hộp quà không kiểm tra hết lượt ngày
- **Where:** components/game/useGachaPull.ts:47, components/shop/GachaModal.tsx:93
- **Scenario:** bấm đúp / bấm hộp rồi bấm nút trước khi React vẽ lại → `open()` không có cờ đồng bộ; hết 3 lượt (`g.left === 0`) thì nút `pray-xu` khoá nhưng hình hộp (`aria-label="Mở hộp"`) vẫn bấm được → lắc, phát âm thanh, gọi server rồi mới báo lỗi.
- **Minimal fix:** `useRef` khoá đầu `open()`; nút hộp `disabled={busy || !canEarn || (g.chest === "xu" && g.left === 0)}`.

#### [MEDIUM] Tiêu đề `ShopModal` dùng `whitespace-nowrap` có thể đè nút đóng ở 320px
- **Where:** components/shop/ShopModal.tsx:25-35
- **Minimal fix:** `max-w-[calc(100%-3.5rem)]` + `truncate`, giảm padding/cỡ chữ trên màn hẹp.

#### [LOW] `getMyRank` chạy tuần tự khi tải `/rewards`
- **Where:** app/rewards/page.tsx:38-42 — đưa vào `Promise.all` cùng các truy vấn khác.

#### [LOW] `role="tablist"` chứa phần tử không phải tab; điện thoại không có nút tắt âm thanh
- **Where:** components/shop/ShopPage.tsx:221, 277-286 — chỉ đặt `tablist` quanh 6 danh mục; thêm `SoundToggle` vào Menu.

#### Câu hỏi
Mua mèo/khung/nền/danh hiệu thì client `setAvatar` để hiện "Đang chọn 🐾" — `buyItem` phía server có lưu cấu hình trang bị không? Nếu không, tải lại sẽ mất.

### Claude kiểm chứng (GĐ5–6)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Bấm đúp / hộp quà khi hết lượt | **Đúng** (phần hộp quà là lỗi thật; bấm đúp thì React thường đã khoá nút sau sự kiện rời rạc, nhưng khoá đồng bộ vẫn cần cho bấm hộp + nút cùng lúc). | `inFlight` ref + kiểm tra hết lượt trong `open()`; dọn timer khi unmount; nút hộp khoá khi hết lượt. E2E: bấm `pray-xu` 2 lần + bấm hộp → đúng 1 `GachaPull`; hết 3/3 → hộp và nút đều `disabled`. |
| 2 | Tiêu đề đè nút đóng 320px | **Đúng** ("🌠 Đài Cầu Nguyện Hộp Bí Ẩn" ~300px > khung 288px). | `max-w-[calc(100%-3.5rem)]`, `truncate`, `px-3.5 text-sm sm:px-5 sm:text-[15px]`. E2E 320px: khung tiêu đề không giao nút đóng, không tràn. |
| 3 | `getMyRank` tuần tự | **Đúng.** | Chạy song song trong `Promise.all`. |
| 4 | `tablist` + loa trên điện thoại | **Đúng** (thanh gỗ ẩn loa dưới 640px, header site trên điện thoại cũng không có). | `<div role="tablist" className="contents">` chỉ bọc 6 danh mục; `SoundToggle` trong Menu Tiệm Quà. E2E kiểm tra cả hai. |
| Q | `buyItem` có lưu trang bị? | **Đúng là lỗi:** `buyItemInTx` chỉ thêm vào túi, không đổi `UserAvatar.config` → "Đang chọn" mất sau khi tải lại. | Sau khi mua ô pet/frame/background/title, gọi `saveAvatar` để lưu thật. E2E: mua mèo → `UserAvatar.config.pet` đúng, tải lại vẫn là mèo mới. |
