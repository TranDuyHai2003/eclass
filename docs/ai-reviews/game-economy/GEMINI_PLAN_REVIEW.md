# Review: game-economy — plan

> Gemini (Neon, gemini.google.com) · 21/11/2026 · Claude chép lại nguyên văn (bỏ các dòng trích dẫn tên file), kèm phần "Claude kiểm chứng" ở cuối.

## Summary

Kế hoạch có cấu trúc rõ ràng, bám sát các bất biến cốt lõi của hệ điểm (lockWallet, updateMany có điều kiện, sổ cái append-only) và chia giai đoạn hợp lý. Tuy nhiên, cần xử lý 3 điểm rủi ro cao trước khi code: (1) thiếu thu hồi khoá ONTIME:{testId} và thiếu xử lý currency trong revokeKey dễ làm lệch bất biến sổ–ví; (2) thiết kế gacha còn cơ chế thúc đẩy tâm lý gỡ gạc với học sinh vị thành niên (NPC nhắc sắp chạm bảo hiểm pity = 4 và hạn mức 10 lượt/ngày tương đương nửa tháng học chăm); và (3) rủi ro lộ tên thật cho tài khoản demo hoặc hiển thị dữ liệu cũ khi dùng unstable_cache 60 giây cho Bảng Vàng và Hồ sơ.

## Findings

### [HIGH] Thiếu thu hồi ONTIME:{testId} và thiếu tham số currency trong revokeKey
- **Where:** PLAN.md (mục 4.1, 4.2) & lib/points/engine.ts:127-132
- **Scenario:**
  - Học sinh nộp bài đúng hạn → nhận +300 xu (TEST_SUBMIT) và +150 xu (ONTIME:{testId}). Sau đó giáo viên xoá lượt làm bài để học sinh làm lại. Nếu chỉ thu hồi các khoá cũ mà quên ONTIME:{testId}, học sinh vẫn giữ 150 xu từ lượt đã xoá (vi phạm bất biến 3).
  - Nếu sau này cần gọi revokeKey cho một khoá thuộc GEM (vd thu hồi GIFTCODE:{id}), revokeKey hiện tại gọi writeEntry không truyền currency → mặc định trừ vào XU thay vì GEM, làm sai lệch bất biến balance = Σ XU, gems = Σ GEM.
- **Why it matters:** Vi phạm trực tiếp bất biến 1 (sổ–ví khớp theo từng loại tiền) và bất biến 3 (revokeKey đưa tổng khoá về 0).
- **Minimal fix:**
  - Trong mục 4.2, bổ sung thu hồi ONTIME:{testId} tại luồng xoá lượt làm bài.
  - Trong engine.ts, cập nhật netForKey(tx, userId, key, currency = "XU") và revokeKey(..., currency = "XU") để lọc và ghi sổ đúng loại tiền.

### [HIGH] Rủi ro tâm lý cờ bạc với học sinh vị thành niên trong thiết kế Gacha
- **Where:** PLAN.md (mục 4.6, 4.8, 7)
- **Scenario:**
  - NPC kích thích quay tiếp: Mục 4.8 cho NPC Lucky Boy hiển thị câu thoại nhắc "rương sắp bảo hiểm (pity = 4)". Đây là mẫu thiết kế thúc đẩy tâm lý gỡ gạc (near-miss / sunk-cost) trực tiếp nhắm vào học sinh vị thành niên.
  - Hạn mức ngày quá lớn so với thu nhập: Mục 4.6 đặt trần 10 lượt/ngày (6.000 xu/ngày). Trong khi đó, học sinh chăm chỉ cả tháng chỉ kiếm ~12.000 xu (đủ 1 gói bim bim). Một học sinh có thể đốt sạch xu tích luỹ cả tháng chỉ trong 2 ngày (20 lượt quay), dẫn đến hụt hẫng hoặc phụ huynh phản ánh.
- **Why it matters:** Đụng trực tiếp rủi ro lớn nhất với đối tượng học sinh phổ thông và có thể khiến phụ huynh phản đối tính năng.
- **Minimal fix:**
  - Xoá điều kiện "rương sắp bảo hiểm (pity = 4)" khỏi danh sách ưu tiên câu thoại của NPC Lucky Boy (mục 4.8).
  - Giảm giới hạn quay Rương Xu xuống mức thấp hơn (vd 2–3 lượt/ngày, tương đương 1.200–1.800 xu/ngày) để học sinh không thể tiêu hết tiền cả tháng trong một buổi.

### [HIGH] Rủi ro lộ dữ liệu demo và dữ liệu cũ khi dùng unstable_cache 60 giây
- **Where:** PLAN.md (mục 4.7, 5, 6)
- **Scenario:**
  - Học sinh thật mở /leaderboard trước → unstable_cache lưu kết quả có tên thật. Trong 60 giây tiếp theo, tài khoản demo mở /leaderboard: nếu maskUsersForDemo chạy bên trong hàm được cache (hoặc ngược lại, demo mở trước làm cache lưu tên đã che cho học sinh thật), dữ liệu sẽ bị sai/lộ tên thật.
  - Học sinh mở /profile/[userId], sau đó vào /profile/avatar đổi nhân vật rồi quay lại /profile/[userId]. Nếu trang hồ sơ bị cache 60 giây mà không invalidate, học sinh thấy nhân vật cũ và tưởng lưu thất bại. Ngoài ra, nếu cache chung toàn bộ dữ liệu trang hồ sơ, khối "kết quả gần đây (chỉ chủ nhân)" có nguy cơ bị lộ cho người xem khác.
- **Why it matters:** Lộ danh tính học sinh cho tài khoản demo (vi phạm quy ước bảo mật của dự án) và gây trải nghiệm lỗi khi tuỳ chỉnh nhân vật.
- **Minimal fix:**
  - Với /leaderboard: unstable_cache chỉ cache dữ liệu gốc (không phụ thuộc người xem), sau đó luôn gọi maskUsersForDemo bên ngoài cache nếu session.user.isDemo.
  - Với /profile/[userId]: tách riêng truy vấn "kết quả gần đây" (không cache, chỉ chạy khi session.user.id === userId) và gọi revalidateTag(profile:${userId}) trong saveAvatar / buyItem.

### [MEDIUM] Thiếu ràng buộc phân quyền cho /profile/[userId] và PATCH /api/tests/[testId]
- **Where:** PLAN.md (mục 4.2, 5, 7)
- **Scenario:**
  - Học sinh đăng nhập rồi gõ trực tiếp /profile/<teacherId> hoặc /profile/<unapprovedStudentId>. Kế hoạch chưa nêu rõ có chặn xem hồ sơ của TEACHER/ADMIN hay tài khoản chưa duyệt/demo hay không, và chưa nêu rõ khách chưa đăng nhập có xem được không.
  - Ở PATCH /api/tests/[testId], nếu payload deadlines chứa classId không tồn tại hoặc không thuộc khoá học của đề, Prisma sẽ ném lỗi khoá ngoại (500) hoặc ghi rác vào TestDeadline.
- **Why it matters:** Lộ thông tin tài khoản không phải học sinh thật trên trang công khai nội bộ, và lỗi 500 không kiểm soát khi lưu hạn nộp.
- **Minimal fix:**
  - /profile/[userId]: yêu cầu đăng nhập; chỉ trả hồ sơ khi đích là STUDENT && isApproved && !isDemo (trừ khi chính chủ tự xem hồ sơ mình), còn lại trả notFound().
  - PATCH /api/tests/[testId]: lọc deadlines chỉ nhận các classId nằm trong danh sách lớp gắn với khoá học của đề.

### [MEDIUM] Nhân thang điểm ×150 sẽ làm lệch chuỗi hardcode trong config.ts và hỏng test cũ
- **Where:** PLAN.md (mục 2.1) & lib/points/config.ts:77, tests/points/rules.test.ts:15,29,72
- **Scenario:**
  - lib/points/config.ts:77 đang viết cứng { label: "Thầy thưởng", points: "+1 … +10" }. Khi nhân POINTS lên ×150, bảng quy tắc hiển thị cho học sinh sẽ vẫn ghi +1 … +10 trong khi mức thật là +1 … +1 500.
  - tests/points/rules.test.ts đang viết cứng các mốc [10, 3] (dòng 15), "+1 / +2 / +3" (dòng 29), và t.price <= 50 (dòng 72) — tất cả sẽ fail ngay khi nhân ×150.
- **Why it matters:** Hiển thị sai quy tắc cho học sinh và gãy bộ test ở GĐ0.
- **Minimal fix:** Sửa dòng 77 lib/points/config.ts dùng `+1 … +${POINTS.manual.maxPerGrant}` và cập nhật các mốc trong tests/points/rules.test.ts tính theo POINTS / hằng số mới trong cùng commit GĐ0.

### [MEDIUM] Rủi ro tràn giao diện 320–390px và lỗi hydration từ localStorage
- **Where:** PLAN.md (mục 4.3, 5)
- **Scenario:**
  - Tràn ngang ở 320px: Trên /rewards, HUD chứa đồng thời nhân vật + tên + danh hiệu dài (vd 🥬 Nghèo rớt mồng tơi) + thanh kinh nghiệm + chip Xu + chip Ngọc + nút loa; bên dưới có 5 tab. Ở màn 320px, bố cục 1 hàng sẽ bị ép chữ hoặc tràn ngang.
  - Hydration mismatch: Nút loa 🔊/🔇 đọc localStorage("sound") (mặc định bật). Nếu đọc trực tiếp trong lúc render component client, server render 🔊 còn client (đã tắt loa) render 🔇 → React báo lỗi hydration.
- **Why it matters:** Hỏng giao diện trên điện thoại nhỏ (học sinh chủ yếu dùng điện thoại) và gây lỗi hydration trong console/audit.
- **Minimal fix:**
  - Thiết kế HUD 2 dòng trên mobile (flex-wrap hoặc tách hàng thông tin nhân vật và hàng chip Xu/Ngọc/loa); thanh 5 tab dùng overflow-x-auto whitespace-nowrap.
  - Nút loa và logic pháo giấy lên danh hiệu chỉ đọc localStorage bên trong useEffect (render trạng thái mặc định khớp server ở lượt đầu).

### [LOW] Thiếu một số test case quan trọng ở các giai đoạn
- **Where:** PLAN.md (mục 8)
- **Scenario:** Bảng kế hoạch test chưa liệt kê:
  - GĐ0: test lifetimeEarned không tăng khi nhận tiền từ GIFTCODE, GACHA, REFUND; test revokeKey cho ONTIME:{testId}.
  - GĐ1: test giới hạn nhập sai mã quà (10 lần/10 phút) và chặn tài khoản demo/chưa duyệt.
  - GĐ2: test phân quyền /profile/[userId] (demo bị che tên, người khác không thấy kết quả gần đây).
  - GĐ3: test đồng thời (Promise.all 2 lượt mở rương cùng lúc khi số dư chỉ đủ 1 lượt, hoặc đang ở lượt thứ 10/10 trong ngày).
- **Why it matters:** Đây là các nhánh dễ phát sinh lỗi tiền ảo và phân quyền nhất nhưng dễ bị bỏ sót nếu không ghi rõ trong kế hoạch test.
- **Minimal fix:** Bổ sung 4 nhóm test case trên vào cột Test của GĐ0–GĐ3 trong PLAN.md.

## Questions for the author

1. Trong lib/points/reward-input.ts (không đính kèm trong file review), giới hạn tối đa của price hiện đang là bao nhiêu? Nếu đang đặt nhỏ (vd 10_000) thì khi nhân ×150, các món quà giá 12.000–45.000 xu sẽ bị normalizeRewardInput từ chối.
2. Trong lib/points/hooks.ts (không đính kèm), hàm thu hồi điểm khi xoá lượt làm bài hiện đang gọi revokeKey cho danh sách khoá nào? Cần xác nhận sẽ bổ sung ONTIME:{testId} vào danh sách đó.

---

## Claude kiểm chứng (21/11/2026)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Thiếu thu hồi `ONTIME` + `revokeKey` không theo tiền | **Đúng một phần.** `onAttemptDeleted` đã thu hồi `ONTIME:{testId}` ngay khi viết GĐ0 (trước khi nhận review). `netForKey`/`revokeKey` quả thật chỉ lọc theo `key`, với khoá GEM sẽ trừ nhầm XU. | `netForKey(…, currency = "XU")`, `awardOnce` truyền `currency`, `revokeKey(…, currency)`; test engine cho ngọc + thu hồi `ONTIME` (`tests/points/hooks.test.ts`). |
| 2 | Gacha: NPC nhắc pity, 10 lượt/ngày quá nhiều | **Đúng.** 10 lượt = 6 000 xu = nửa tháng học chăm. | PLAN 4.6: Rương Xu tối đa **3 lượt/ngày**, Rương Ngọc không trần ngày (ngọc chỉ thầy phát); PLAN 4.8: bỏ câu thoại về bảo hiểm. |
| 3 | `unstable_cache` + demo, hồ sơ cache nhầm phần riêng tư | **Đúng.** | PLAN 4.7/5: cache chỉ dữ liệu gốc, che tên demo ngoài cache; hồ sơ không cache phần riêng tư, `revalidateTag("profile:{id}")` khi lưu nhân vật / mua đồ. |
| 4 | Phân quyền `/profile/[userId]`, lọc `classId` khi PATCH hạn | **Đúng.** | PLAN 4.2 & 5: hồ sơ chỉ hiện với STUDENT đã duyệt, không demo (trừ chính chủ); `deadlines` chỉ nhận lớp gắn với khoá của đề, lớp lạ bị bỏ qua (400 nếu không còn dòng hợp lệ). |
| 5 | Chuỗi cứng `+1 … +10`, test cũ gãy | **Đúng**, đã làm trong cùng commit GĐ0. | `config.ts` dùng `POINTS.manual.maxPerGrant`; sửa `rules.test.ts`, `hooks.test.ts`, `levels-rarity.test.ts` theo hằng số. |
| 6 | HUD tràn 320 px, hydration `localStorage` | **Đúng** (GĐ1/2). | Ghi vào PLAN 5: HUD 2 hàng trên mobile, tab cuộn ngang; đọc `localStorage` trong `useEffect`. |
| 7 | Thiếu test case | **Đúng.** | Thêm vào bảng GĐ0–GĐ3 trong PLAN 8. |
| Q1 | `price` tối đa trong `reward-input.ts` | **Câu hỏi đúng chỗ.** `MAX_REWARD_PRICE` đang là 100 000: mẫu quà mới (≤ 60 000) vẫn qua, nhưng quà lớn thầy tự đặt (vd 1 000 điểm cũ = 150 000 xu) sẽ bị từ chối. | Nâng lên 1 000 000; test `price: 1e9` vẫn bị từ chối. |
| Q2 | Danh sách khoá thu hồi khi xoá lượt | `TEST`, `ONTIME`, `TESTSCORE`, `BREAK`. | Đã có. |

---

## Review kế hoạch GĐ7–8 (Hồ sơ & Trang trí) — Gemini web (Neon), 22/11/2026

Nguồn: `review-input-plan.md` (PLAN §11), gửi qua gemini.google.com. Dưới đây là phần tóm lược các finding của Gemini. Khi trích từ trang, công cụ cắt bớt văn bản nên không chép nguyên văn.

**Tóm tắt (Gemini):** kế hoạch bám kiến trúc sẵn có. Có 3 vùng rủi ro cao: `buyBundle` all-or-nothing; ~40 món mới làm loãng pool rương; SVG mới làm phình JS và có thể đụng id `<defs>`.

1. **[Cao] `buyBundle`:**
   - Có thể commit một phần, kẹt ở món gachaOnly hoặc khi trộn tiền.
   - itemIds trùng hoặc dài bất thường.
   - Lặp `lockWallet`/`isEligibleStudent`.
   - Tab thứ hai khi món đã mua xong.
   - Đề xuất: khoá ví một lần, khử trùng, chặn gachaOnly, kiểm cả xu lẫn ngọc, throw để rollback. Đã đủ món thì trả thành công, không ghi sổ.
2. **[Cao] Pool rương:** pool phình gần gấp đôi, làm loãng đồ gachaOnly và có thể làm loãng gói ngọc. Tab "Tất cả" của tiệm cũng phình theo. Đề xuất: cờ chọn lọc món vào rương.
3. **[Cao] Hiệu năng:**
   - Bundle /profile và các trang dùng Chibi có thể phình. Đề xuất: tách file và tải lười tab trang trí.
   - Id `<defs>` có thể trùng. Đề xuất: dùng `useId`.
   - Lưới chọn chỉ nên dùng ảnh tĩnh.
4. **[TB] Quyền riêng tư và quyền truy cập:**
   - Email và nút Đăng xuất có thể lọt sang /profile/[userId].
   - Chưa rõ demo và tài khoản chưa duyệt thấy gì.
   - Action phải kiểm `isPointsEnabled`/`demoGuard`.
5. **[TB] Bố cục 320px và trợ năng:**
   - Email dài.
   - Khung tròn đè lên chibi.
   - Trên điện thoại, cuộn xuống thì không thấy phần xem trước.
   - Tab nhiều tầng.
   - Nút 🗑 dễ hiểu nhầm.
   - Thiếu `prefers-reduced-motion`.
6. **[TB] Test thiếu:** mua đồng thời, itemIds trùng, gachaOnly, đã đủ món, tài khoản bị chặn, preset không có gachaOnly, cấu hình cũ không có effect, hồi quy rương.
7. **[Thấp]** `defaultAvatar` cần có `effect: null`.

**Câu hỏi của Gemini:**
- Trọng số gói tiền trong rương thế nào?
- Preset có chứa món ngọc hoặc gachaOnly không?
- Món mới có bán ở /rewards không?
- Demo và tài khoản chưa duyệt thấy gì?

### Claude kiểm chứng (GĐ7–8)

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | buyBundle | **Đúng một phần.** Throw trong `$transaction` đã rollback toàn bộ. Khi viết vẫn bổ sung đủ các chặn. | `buyBundleInTx`: khử trùng, tối đa 12 món; kiểm `isEligibleStudent` rồi `lockWallet` trước khi đọc món đã có; từ chối gachaOnly và slug lạ trước khi ghi; kiểm tổng xu và tổng ngọc; lỗi giữa chừng thì `BundleAbort` để rollback. Đã đủ món thì trả thành công, không ghi sổ. Action kiểm `isPointsEnabled`, `demoGuard`, bắt P2002. Vẫn gọi lại `buyItemInTx` cho từng món (khoá lại trong cùng tx, vô hại, ≤ 12 món) để dùng chung một đường ghi sổ. Test: thiếu tiền thì không món nào; xu + ngọc; 2 tab đồng thời; tài khoản bị chặn; mảng trùng; gachaOnly. |
| 2 | Pool rương loãng | **Đúng.** `poolFor` bốc đều trong một bậc gồm cả gói tiền. Thêm món có giá thì tỉ lệ ra 1 ngọc ở Rương Xu tụt từ 1/11 xuống khoảng 1/15. | Cờ `studio: true` cho 36 món có giá của GĐ8: không vào pool, không hiện ở "Tất cả"/Mèo Cún của "Tất cả" trong tiệm (vẫn bán ở Trang trí, Mèo Cún và Hồ sơ). Chỉ 6 món gachaOnly mới vào pool. Test: món `studio` không có trong pool; mọi món gachaOnly đều có; pool Huyền thoại Rương Xu ≤ 13. |
| 3 | Bundle và id `<defs>` | **Một phần.** Id gradient đã theo nội dung (hash cấu hình, id món), nên trùng id thì nội dung cũng giống hệt, không vỡ màu. `useId` không dùng được vì Chibi/Scene còn render trong Server Component. Tab ẩn được bỏ khỏi DOM, không chỉ `display:none`. | `DecorStudio` tải lười bằng `next/dynamic`: thầy/admin và khi tắt Xu không tải. Cảnh nền, khung, hiệu ứng nằm ở file riêng. Lưới hiệu ứng dùng hạt tĩnh (`EffectThumb`); chỉ banner chạy hoạt ảnh (transform/opacity, `top` cho hạt rơi). |
| 4 | Email/đăng xuất, demo | **Đúng** (yêu cầu thiết kế). | `ProfileBanner` không chứa email/đăng xuất. Hồ sơ công khai chỉ dùng cảnh và hiệu ứng; E2E kiểm không lộ email. Demo vẫn xem được studio nhưng Mua/Lưu bị khoá (có tooltip); tài khoản chưa duyệt chỉ khoá Mua. |
| 5 | 320px và trợ năng | **Đúng.** | Email `truncate`. Banner chừa lề trái cho ảnh tròn. Ô xem trước thu nhỏ `decor-mini-preview` trên điện thoại. Tab cuộn ngang ẩn thanh cuộn. 🗑 đổi thành ↺ có `aria-label` "Hoàn tác về bản đã lưu". `role=tablist`/`tab`, ô món là `button aria-pressed`. Hiệu ứng tắt khi reduced-motion (khung và thú cưng không có chuyển động). |
| 6 | Test thiếu | **Đúng.** | `tests/game/profile-decor.test.ts` (10 test) và E2E bước Hồ sơ & Trang trí (thử → mua → lưu → khoá vương miện → hoàn tác → tab cài đặt → chuyển hướng). |
| 7 | `effect: null` | **Đúng.** | Đã thêm; test cấu hình cũ không có khoá effect. |
| Q | Câu hỏi | — | Gói tiền dùng chung pool đều (xem #2). Preset không có món ngọc; 2 preset có món gachaOnly (Nhà du hành, Game thủ): UI báo "Có món từ rương", buyBundle từ chối trước khi ghi. Món mới vẫn bán ở /rewards (Trang trí, Mèo Cún), không vào "Tất cả". Demo và tài khoản chưa duyệt: xem câu #4. |
