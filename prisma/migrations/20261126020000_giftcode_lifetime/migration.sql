-- 26/11/2026: xu từ mã quà tặng nay tính vào "xu tích luỹ" (lifetimeEarned → danh hiệu, Bảng Vàng).
-- Cộng bù một lần phần xu mã quà học sinh đã nhận trước đây (tổng ròng theo khoá GIFTCODE:*, đã trừ thu hồi; chỉ XU, không tính ngọc).
UPDATE "PointWallet" AS w
SET "lifetimeEarned" = w."lifetimeEarned" + g.net,
    "updatedAt" = NOW()
FROM (
  SELECT "userId", SUM("amount") AS net
  FROM "PointLedger"
  WHERE "currency" = 'XU' AND "key" LIKE 'GIFTCODE:%'
  GROUP BY "userId"
  HAVING SUM("amount") > 0
) AS g
WHERE w."userId" = g."userId";
