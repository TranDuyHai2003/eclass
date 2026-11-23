/**
 * Nhân vật vẽ tay: đổi màu tóc/mắt vẫn giữ tranh mẫu, khuôn mặt chọn riêng (`face`) — logic thuần, không DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { FACES, FACE_IDS, PRESETS, faceIndexOf, paintedLook, presetIndexOf } from "@/lib/game/presets";
import { sanitizeAvatar } from "@/lib/game/avatar";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
const student = preset("preset-student").items;

describe("paintedLook — tô màu trên tranh mẫu", () => {
  test("trùng mẫu hoàn toàn → tranh gốc, không tô", () => {
    assert.deepEqual(paintedLook(student), { index: 0, hairColor: null, eyes: null });
    assert.equal(presetIndexOf(student), 0);
  });

  test("chỉ đổi màu tóc / màu mắt → vẫn là tranh Học sinh nam, tô lại màu (lỗi cũ: chuyển sang nhân vật SVG khác hẳn)", () => {
    const cfg = { ...student, hairColor: "hc-pink", eyes: "eye-blue" };
    assert.deepEqual(paintedLook(cfg), { index: 0, hairColor: "hc-pink", eyes: "eye-blue" });
    assert.equal(presetIndexOf(cfg), -1, "không còn trùng mẫu hoàn toàn → ô mẫu không báo Đang dùng");
  });

  test("đổi kiểu tóc / trang phục / phụ kiện khác mọi mẫu → không vẽ tranh", () => {
    assert.equal(paintedLook({ ...student, hair: "hair-long" }), null);
    assert.equal(paintedLook({ ...student, outfit: "outfit-ninja" }), null);
    assert.equal(paintedLook({ ...student, accessory: "acc-crown" }), null);
  });

  test("chọn mặt khác mặt của mẫu → không vẽ tranh mẫu; chọn đúng mặt mẫu → vẫn tranh", () => {
    assert.equal(paintedLook({ ...student, face: "preset-kimono" }), null);
    assert.equal(presetIndexOf({ ...student, face: "preset-kimono" }), -1);
    assert.equal(paintedLook({ ...student, face: "preset-student" })?.index, 0);
    assert.equal(presetIndexOf({ ...student, face: "preset-student" }), 0);
  });

  test("nhà du hành che kín mặt → mặt đã chọn không làm mất tranh", () => {
    const astro = { ...preset("preset-astro").items, face: "preset-gamer" };
    assert.equal(paintedLook(astro)?.index, PRESETS.findIndex((p) => p.id === "preset-astro"));
  });
});

describe("Khuôn mặt (face)", () => {
  test("mặt chỉ lấy từ mẫu có lộ mặt, ảnh mặt và mặt nạ tô màu có trong public/studio", () => {
    assert.ok(FACE_IDS.every((id) => PRESETS.some((p) => p.id === id)));
    assert.ok(!FACE_IDS.includes("preset-astro") && !FACE_IDS.includes("preset-knight"));
    for (const f of ["faces.webp", "faces-eyes.webp", "char-hair.webp", "char-eyes.webp"]) {
      assert.ok(existsSync(path.join(process.cwd(), "public/studio", f)), f);
    }
  });

  test("faceIndexOf: mặt đã chọn; chưa chọn thì theo kiểu tóc", () => {
    assert.equal(faceIndexOf({ face: "preset-catgirl", hair: "hair-short" }), FACE_IDS.indexOf("preset-catgirl"));
    assert.equal(faceIndexOf({ hair: "hair-short" }), 0);
    assert.equal(faceIndexOf({ hair: "hair-long" }), FACE_IDS.indexOf("preset-kimono"));
    assert.equal(faceIndexOf({ face: "khong-co", hair: "hair-spiky" }), 0);
  });

  test("sanitizeAvatar giữ mặt hợp lệ (miễn phí), bỏ mặt lạ / mặt của mẫu đội mũ kín", () => {
    assert.equal(sanitizeAvatar({ face: "preset-catgirl" }, "u", []).face, "preset-catgirl");
    assert.equal(sanitizeAvatar({ face: "preset-astro" }, "u", []).face, undefined);
    assert.equal(sanitizeAvatar({ face: "<script>" }, "u", []).face, undefined);
    assert.equal(sanitizeAvatar({ face: 7 }, "u", []).face, undefined);
    assert.equal(FACES.length, 6);
  });
});
