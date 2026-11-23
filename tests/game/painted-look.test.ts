/**
 * Nhân vật vẽ tay: đổi màu tóc/mắt vẫn giữ tranh mẫu, khuôn mặt chọn riêng (`face`) — logic thuần, không DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { FACES, FACE_IDS, PRESETS, currentFaceId, faceIndexOf, paintedLook, presetIndexOf } from "@/lib/game/presets";
import { sanitizeAvatar } from "@/lib/game/avatar";
import { BODIES, HAIR_BACK, HAIR_HEADS, HEAD_ANCHOR, HEAD_CELLS_N } from "@/lib/game/painted-data";
import { ITEMS } from "@/lib/game/items";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
const student = preset("preset-student").items;

describe("paintedLook — tô màu trên tranh mẫu", () => {
  test("trùng mẫu hoàn toàn → tranh gốc, không tô", () => {
    assert.deepEqual(paintedLook(student), { index: 0, base: 0, body: null, face: null, hairColor: null, eyes: null });
    assert.equal(presetIndexOf(student), 0);
  });

  test("chỉ đổi màu tóc / màu mắt → vẫn là tranh Học sinh nam, tô lại màu (lỗi cũ: chuyển sang nhân vật SVG khác hẳn)", () => {
    const cfg = { ...student, hairColor: "hc-pink", eyes: "eye-blue" };
    assert.deepEqual(paintedLook(cfg), { index: 0, base: 0, body: null, face: null, hairColor: "hc-pink", eyes: "eye-blue" });
    assert.equal(presetIndexOf(cfg), -1, "không còn trùng mẫu hoàn toàn → ô mẫu không báo Đang dùng");
  });

  test("thay trang phục → giữ đầu (mặt, tóc) của nhân vật, đổi thân (lỗi cũ: áo phông ra nhân vật SVG khác hẳn)", () => {
    const tee = paintedLook({ ...student, outfit: "outfit-tee", hairColor: "hc-black" });
    assert.equal(tee?.index, 0);
    assert.equal(BODIES[tee!.body!].outfit, "outfit-tee");
    assert.equal(tee?.hairColor, "hc-black");
    const kimonoGamer = paintedLook({ ...preset("preset-kimono").items, outfit: "outfit-gamer" });
    assert.equal(PRESETS[kimonoGamer!.index].id, "preset-kimono");
    assert.equal(BODIES[kimonoGamer!.body!].outfit, "outfit-gamer");
  });

  test("mọi trang phục đều có tranh: thân rời hoặc nguyên tranh (đồ liền mũ)", () => {
    for (const it of ITEMS.filter((i) => i.slot === "outfit")) {
      const look = paintedLook({ ...student, outfit: it.id });
      assert.ok(look, `${it.id} chưa có tranh`);
    }
    const cat = paintedLook({ ...student, outfit: "outfit-cathoodie" });
    assert.deepEqual([PRESETS[cat!.index].id, cat!.body], ["preset-catgirl", null], "hoodie tai mèo liền mũ → nguyên tranh");
  });

  test("phụ kiện không có đầu vẽ sẵn → nhân vật SVG (mặt vẫn vẽ tay)", () => {
    assert.equal(paintedLook({ ...student, accessory: "acc-crown" }), null);
    assert.equal(paintedLook({ ...student, hair: "hair-ponytail", accessory: "acc-bow" }), null);
  });

  test("mọi kiểu tóc đều có đầu vẽ tay (lỗi cũ: đuôi ngựa, hai bím, dài, búi, dựng, mohawk ra nhân vật SVG)", () => {
    for (const it of ITEMS.filter((i) => i.slot === "hair")) {
      const look = paintedLook({ ...student, hair: it.id, outfit: "outfit-hoodie", hairColor: "hc-pink", face: "preset-student" });
      assert.ok(look, `${it.id} chưa có tranh`);
      assert.ok(look.index in HEAD_ANCHOR && look.index < HEAD_CELLS_N, it.id);
      assert.equal(BODIES[look.body!].outfit, "outfit-hoodie");
      assert.equal(look.hairColor, "hc-pink", `${it.id}: tô màu tóc trên tranh`);
    }
    const cellOf = (hair: string) => Number(Object.entries(HAIR_HEADS).find(([, [h]]) => h === hair)![0]);
    for (const hair of ["hair-ponytail", "hair-twin", "hair-long", "hair-bun", "hair-spiky", "hair-mohawk"]) {
      assert.equal(paintedLook({ ...student, hair })?.index, cellOf(hair), hair);
    }
    assert.ok(["hair-ponytail", "hair-long", "hair-bun", "hair-spiky", "hair-mohawk"].every((h) => HAIR_BACK.includes(cellOf(h))), "tóc sau lưng vẽ trước thân");
    // tóc dựng / mohawk từ đầu Học sinh nam: giữ mặt + màu tóc gốc; tóc nữ từ đầu tóc bob (cô gái kimono)
    const spiky = paintedLook({ ...student, hair: "hair-spiky" })!;
    assert.deepEqual([PRESETS[spiky.base].id, spiky.face, spiky.hairColor], ["preset-student", null, null]);
    const pony = paintedLook({ ...student, hair: "hair-ponytail", face: "preset-student" })!;
    assert.equal(PRESETS[pony.base].id, "preset-kimono");
    assert.equal(pony.face, FACE_IDS.indexOf("preset-student"), "đổi sang đuôi ngựa vẫn giữ mặt học sinh");
  });

  test("tóc bob không cài hoa → đầu vẽ tóc bob trơn (ô 8), không ra nhân vật SVG (lỗi cũ: tóc bob xấu hơn tóc ngắn)", () => {
    const bob = paintedLook({ ...student, hair: "hair-bob", outfit: "outfit-hoodie", hairColor: "hc-blonde", face: "preset-student" });
    assert.equal(bob?.index, 8);
    assert.equal(PRESETS[bob!.base].id, "preset-kimono");
    assert.equal(BODIES[bob!.body!].outfit, "outfit-hoodie");
    assert.equal(bob?.face, FACE_IDS.indexOf("preset-student"), "giữ mặt học sinh trên tóc bob");
    assert.equal(bob?.hairColor, "hc-blonde");
    assert.equal(paintedLook({ ...preset("preset-kimono").items })?.index, 7, "cài hoa → nguyên tranh kimono");
  });

  test("currentFaceId: mặt đang hiện (để đổi tóc / áo vẫn giữ mặt)", () => {
    assert.equal(currentFaceId(student), "preset-student");
    assert.equal(currentFaceId({ ...student, face: "preset-gamer", outfit: "outfit-tee" }), "preset-gamer");
    assert.equal(currentFaceId(preset("preset-astro").items), null);
  });

  test("chọn mặt khác mặt của mẫu → dán mặt đó lên tranh (không đổi sang SVG); không còn là mẫu", () => {
    const look = paintedLook({ ...student, face: "preset-kimono", eyes: "eye-green" });
    assert.equal(look?.index, 0);
    assert.equal(look?.face, FACE_IDS.indexOf("preset-kimono"));
    assert.equal(look?.eyes, "eye-green", "mắt tô trên mặt đã dán");
    assert.equal(presetIndexOf({ ...student, face: "preset-kimono" }), -1);
    assert.equal(paintedLook({ ...preset("preset-astro").items, face: "preset-kimono" })?.face, null, "nhà du hành che kín mặt → không dán");
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
    for (const f of ["faces.webp", "faces-eyes.webp", "char-hair.webp", "char-eyes.webp", "char-heads.webp", "char-bodies.webp", "char-facemask.webp", "char-hairback.webp", "char-hairback-shade.webp"]) {
      assert.ok(existsSync(path.join(process.cwd(), "public/studio", f)), f);
    }
  });

  test("faceIndexOf: mặt đã chọn; chưa chọn thì theo kiểu tóc", () => {
    assert.equal(faceIndexOf({ face: "preset-catgirl", hair: "hair-short" }), FACE_IDS.indexOf("preset-catgirl"));
    assert.equal(faceIndexOf({ hair: "hair-short" }), 0);
    assert.equal(faceIndexOf({ hair: "hair-long" }), FACE_IDS.indexOf("preset-kimono"));
    assert.equal(faceIndexOf({ hair: "hair-twin" }), FACE_IDS.indexOf("preset-kimono"), "id món là hair-twin (lỗi cũ: hair-twintail)");
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
