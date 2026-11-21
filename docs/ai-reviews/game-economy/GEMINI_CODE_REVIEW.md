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
