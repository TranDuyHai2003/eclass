/** Mốc reset xu (thầy reset toàn bộ 26/11/2026): kỳ tính xu tháng bắt đầu từ mốc nếu mốc muộn hơn đầu tháng */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { earningPeriodStart, getXuEpoch, resetXuEpochCache } from "@/lib/points/epoch";
import { getVietnamMonthStart } from "@/lib/ranking/history-engine";

const fakeDb = (value: unknown) => ({ gameConfig: { findUnique: async () => (value === undefined ? null : { value }) } }) as unknown as Parameters<typeof getXuEpoch>[0];

describe("Mốc reset xu", () => {
  test("mốc giữa tháng → kỳ tính từ mốc; mốc tháng trước / chưa có / hỏng → đầu tháng", async () => {
    const now = new Date("2026-11-27T10:00:00+07:00");
    const month = getVietnamMonthStart(now);
    resetXuEpochCache();
    assert.equal((await earningPeriodStart(fakeDb("2026-11-26T16:00:00.000Z"), now)).toISOString(), "2026-11-26T16:00:00.000Z");
    resetXuEpochCache();
    assert.equal((await earningPeriodStart(fakeDb("2026-10-02T00:00:00.000Z"), now)).getTime(), month.getTime());
    resetXuEpochCache();
    assert.equal((await earningPeriodStart(fakeDb(undefined), now)).getTime(), month.getTime());
    resetXuEpochCache();
    assert.equal((await earningPeriodStart(fakeDb("không phải ngày"), now)).getTime(), month.getTime());
    resetXuEpochCache();
  });
});
