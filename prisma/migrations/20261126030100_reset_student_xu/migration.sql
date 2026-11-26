-- Thầy yêu cầu 26/11/2026: "reset xu tất cả học sinh, hôm nay mới bắt đầu cộng xu".
-- Không xoá lịch sử: ghi dòng RESET âm để sổ vẫn khớp ví (số dư = tổng sổ = 0), rồi đưa xu tích luỹ về 0.
--  1) Mỗi khoá chống cộng trùng còn dương (HW:, HWREVIEW:, GIFTCODE:, TEST:…) → dòng RESET cùng khoá đưa về 0,
--     để sau này thu hồi khoá cũ không trừ xu âm vào số dư mới.
--  2) Phần còn lại của số dư → một dòng RESET không khoá.
--  3) Ví: balance = 0, lifetimeEarned = 0 (ngọc, đồ đã có, biệt danh nhiệm vụ giữ nguyên).
--  4) Ghi mốc GameConfig "xuEpoch" → Bảng Vàng tháng / thống kê tháng chỉ tính xu từ lúc reset.

INSERT INTO "PointLedger" ("id", "userId", "amount", "source", "key", "reason", "currency", "createdAt")
SELECT 'reset_' || md5(l."userId" || l."key"), l."userId", -SUM(l."amount"), 'RESET', l."key",
       'Reset xu — bắt đầu tính xu từ 26/11/2026', 'XU', NOW()
FROM "PointLedger" l
JOIN "User" u ON u."id" = l."userId" AND u."role" = 'STUDENT'
WHERE l."currency" = 'XU' AND l."key" IS NOT NULL
GROUP BY l."userId", l."key"
HAVING SUM(l."amount") > 0;

INSERT INTO "PointLedger" ("id", "userId", "amount", "source", "key", "reason", "currency", "createdAt")
SELECT 'reset_' || md5(w."userId" || ':balance'), w."userId", -t.total, 'RESET', NULL,
       'Reset xu — bắt đầu tính xu từ 26/11/2026', 'XU', NOW()
FROM "PointWallet" w
JOIN "User" u ON u."id" = w."userId" AND u."role" = 'STUDENT'
JOIN (SELECT "userId", SUM("amount") AS total FROM "PointLedger" WHERE "currency" = 'XU' GROUP BY "userId") t ON t."userId" = w."userId"
WHERE t.total <> 0;

UPDATE "PointWallet" w
SET "balance" = 0, "lifetimeEarned" = 0, "updatedAt" = NOW()
FROM "User" u
WHERE u."id" = w."userId" AND u."role" = 'STUDENT' AND (w."balance" <> 0 OR w."lifetimeEarned" <> 0);

INSERT INTO "GameConfig" ("key", "value", "updatedAt")
VALUES ('xuEpoch', to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();
