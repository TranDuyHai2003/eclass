/**
 * Thế giới Toán — tầng dữ liệu (DB local): phát câu không lộ đáp án, nộp đúng một lần, câu của người khác / hết hạn bị từ chối,
 * phát hiện chỉ ghi khi đúng + thuần hoá KC, khoá phát hiện theo thứ tự, FSRS + Elo cập nhật khi luyện, lỗi định dạng không tính lượt.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { generate } from "@/lib/world/generators";
import { getWorldState, recordPrediction, requestChallenge, submitChallenge, saveExplanation, CHALLENGE_TTL_MS } from "@/lib/world/service";
import type { Answer } from "@/lib/world/grading";
import { createFixture, disconnect } from "../helpers/fixtures";

const fx = createFixture();
after(async () => {
  await fx.cleanup();
  await disconnect();
});

/** Đáp án đúng của một câu đã phát (test đọc seed từ DB — server cũng làm vậy) */
async function rightAnswer(challengeId: string): Promise<Answer> {
  const ch = await prisma.worldChallenge.findUniqueOrThrow({ where: { id: challengeId } });
  const { key } = generate(ch.familyId, ch.seed);
  switch (key.kind) {
    case "MCQ":
      return { kind: "MCQ", choice: key.correct };
    case "TF4":
      return { kind: "TF4", marks: [...key.truth] };
    case "SHORT":
      return { kind: "SHORT", text: String(key.value) };
    case "ANCHOR":
      return { kind: "ANCHOR", xs: key.xs };
    case "MULTI":
      return { kind: "MULTI", choices: key.correct };
  }
}

async function confirm(userId: string, id: "D_STILLPOINT" | "D_SLOPE_SIGN" | "D_FLAT_NOT_PEAK") {
  const ch = await requestChallenge(userId, { mode: "discovery", discoveryId: id });
  return submitChallenge(userId, { challengeId: ch.challengeId, answer: await rightAnswer(ch.challengeId) });
}

describe("world service", () => {
  test("đề phát xuống không chứa đáp án", async () => {
    const u = await fx.user();
    const ch = await requestChallenge(u.id, { mode: "discovery", discoveryId: "D_STILLPOINT" });
    const json = JSON.stringify(ch);
    assert.ok(!/"key"|correct|truth|explanation|traps|"meta"/.test(json), json);
  });

  test("phát hiện bị khoá theo thứ tự", async () => {
    const u = await fx.user();
    await assert.rejects(requestChallenge(u.id, { mode: "discovery", discoveryId: "D_SLOPE_SIGN" }), /chưa mở/);
    await assert.rejects(requestChallenge(u.id, { mode: "review" }), /chưa thuần hoá/);
  });

  test("xác nhận đúng ⇒ phát hiện confirmed, KC thuần hoá, lộ tên định lý", async () => {
    const u = await fx.user();
    await recordPrediction(u.id, "D_STILLPOINT", "flat");
    const r = await confirm(u.id, "D_STILLPOINT");
    assert.equal(r.correct, true);
    assert.ok(r.discovery?.title);
    const st = await getWorldState(u.id);
    const d = st.discoveries.find((x) => x.id === "D_STILLPOINT")!;
    assert.equal(d.stage, "confirmed");
    assert.equal(d.prediction, "flat");
    assert.ok(d.title);
    assert.ok(st.discoveries.find((x) => x.id === "D_SLOPE_SIGN")!.unlocked);
    assert.ok(!st.discoveries.find((x) => x.id === "D_SLOPE_SIGN")!.title, "chưa phát hiện thì chưa lộ tên");
    assert.ok(st.creatures.filter((c) => c.state !== "wild").length >= 2);
    assert.ok(st.abilities.includes("anchor"));
  });

  test("sai ⇒ không ghi phát hiện", async () => {
    const u = await fx.user();
    const ch = await requestChallenge(u.id, { mode: "discovery", discoveryId: "D_STILLPOINT" });
    const r = await submitChallenge(u.id, { challengeId: ch.challengeId, answer: { kind: "ANCHOR", xs: [99] } });
    assert.equal(r.correct, false);
    assert.equal(r.discovery, undefined);
    assert.equal((await getWorldState(u.id)).discoveries[0].stage, null);
  });

  test("nộp hai lần / câu người khác / hết hạn bị từ chối", async () => {
    const a = await fx.user();
    const b = await fx.user();
    const ch = await requestChallenge(a.id, { mode: "discovery", discoveryId: "D_STILLPOINT" });
    const ans = await rightAnswer(ch.challengeId);
    await assert.rejects(submitChallenge(b.id, { challengeId: ch.challengeId, answer: ans }), /Không tìm thấy/);
    const both = await Promise.allSettled([
      submitChallenge(a.id, { challengeId: ch.challengeId, answer: ans }),
      submitChallenge(a.id, { challengeId: ch.challengeId, answer: ans }),
    ]);
    assert.equal(both.filter((x) => x.status === "fulfilled").length, 1, "chỉ một lần nộp thành công");
    const old = await requestChallenge(a.id, { mode: "discovery", discoveryId: "D_STILLPOINT" });
    await prisma.worldChallenge.update({ where: { id: old.challengeId }, data: { issuedAt: new Date(Date.now() - CHALLENGE_TTL_MS - 1000) } });
    await assert.rejects(submitChallenge(a.id, { challengeId: old.challengeId, answer: ans }), /hết hạn/);
  });

  test("luyện: FSRS + Elo cập nhật; lỗi định dạng không tính lượt", async () => {
    const u = await fx.user();
    await confirm(u.id, "D_STILLPOINT");
    const before = await prisma.worldKnowledge.findUniqueOrThrow({ where: { userId_kc: { userId: u.id, kc: "kc.extremum_value" } } });
    const ch = await requestChallenge(u.id, { mode: "practice", kc: "kc.extremum_value" });
    assert.equal(ch.prompt.format, "SHORT");
    await assert.rejects(submitChallenge(u.id, { challengeId: ch.challengeId, answer: { kind: "SHORT", text: "12345" } }), /4 ký tự/);
    const r = await submitChallenge(u.id, { challengeId: ch.challengeId, answer: await rightAnswer(ch.challengeId), confidence: 2, responseMs: 40000 });
    assert.equal(r.correct, true);
    assert.ok(r.creature);
    const after = await prisma.worldKnowledge.findUniqueOrThrow({ where: { userId_kc: { userId: u.id, kc: "kc.extremum_value" } } });
    assert.equal(after.reps, before.reps + 1);
    assert.ok(after.theta > before.theta);
    assert.ok(await prisma.worldItemStat.findUnique({ where: { familyId: (await prisma.worldChallenge.findUniqueOrThrow({ where: { id: ch.challengeId } })).familyId } }));
  });

  test("sai khi rất tự tin ⇒ ôn lại ngay", async () => {
    const u = await fx.user();
    await confirm(u.id, "D_STILLPOINT");
    const ch = await requestChallenge(u.id, { mode: "practice", kc: "kc.cubic_shape" });
    await submitChallenge(u.id, { challengeId: ch.challengeId, answer: { kind: "MCQ", choice: "B" }, confidence: 3 });
    const k = await prisma.worldKnowledge.findUniqueOrThrow({ where: { userId_kc: { userId: u.id, kc: "kc.cubic_shape" } } });
    assert.ok(k.dueAt! <= new Date());
    const rev = await requestChallenge(u.id, { mode: "review" });
    assert.ok(["kc.cubic_shape", "kc.extremum_value"].includes(rev.kc));
  });

  test("giải thích chỉ lưu sau khi xác nhận", async () => {
    const u = await fx.user();
    await assert.rejects(saveExplanation(u.id, "D_STILLPOINT", "vì tiếp tuyến nằm ngang"), /xác nhận/);
    await confirm(u.id, "D_STILLPOINT");
    await saveExplanation(u.id, "D_STILLPOINT", "vì tiếp tuyến nằm ngang");
    assert.equal((await getWorldState(u.id)).discoveries[0].stage, "explained");
  });
});
