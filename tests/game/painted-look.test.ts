/**
 * Nhân vật vẽ tay: đổi màu tóc/mắt vẫn giữ tranh mẫu, khuôn mặt chọn riêng (`face`) — logic thuần, không DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { FACES, FACE_IDS, PRESETS, currentFaceId, faceIndexOf, genderOf, paintedLook, presetIndexOf } from "@/lib/game/presets";
import { sanitizeAvatar } from "@/lib/game/avatar";
import { BODIES, HAIR_BACK, HAIR_HEADS, HEAD_ANCHOR, HEAD_CELLS_N } from "@/lib/game/painted-data";
import { ITEMS } from "@/lib/game/items";
import { FACE_PART_OPTIONS, SKIN_TONES, skinToneOf } from "@/lib/game/face-parts";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
const student = preset("preset-student").items;

describe("paintedLook — tô màu trên tranh mẫu", () => {
  test("trùng mẫu hoàn toàn → tranh gốc, không tô", () => {
    assert.deepEqual(paintedLook(student), { index: 0, base: 0, body: null, face: null, hairColor: null, eyes: null, acc: null });
    assert.equal(presetIndexOf(student), 0);
  });

  test("chỉ đổi màu tóc / màu mắt → vẫn là tranh Học sinh nam, tô lại màu (lỗi cũ: chuyển sang nhân vật SVG khác hẳn)", () => {
    const cfg = { ...student, hairColor: "hc-pink", eyes: "eye-blue" };
    assert.deepEqual(paintedLook(cfg), { index: 0, base: 0, body: null, face: null, hairColor: "hc-pink", eyes: "eye-blue", acc: null });
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

  test("đeo phụ kiện giữ nguyên đầu vẽ tay (kiểu tóc, mặt), phụ kiện vẽ chồng lên (lỗi cũ: đổi sang nhân vật SVG, mất kiểu tóc)", () => {
    const crown = paintedLook({ ...student, accessory: "acc-crown" });
    assert.deepEqual([crown?.index, crown?.acc], [0, "acc-crown"]);
    const bow = paintedLook({ ...student, hair: "hair-ponytail", accessory: "acc-bow" });
    assert.deepEqual([bow?.index, bow?.acc], [9, "acc-bow"]);
    for (const it of ITEMS.filter((i) => i.slot === "accessory")) {
      for (const hair of ["hair-short", "hair-bob", "hair-spiky", "hair-wavy"]) {
        assert.ok(paintedLook({ ...student, hair, accessory: it.id }), `${hair} + ${it.id} phải vẽ tay`);
      }
    }
    // kính / tai nghe trên Học sinh nam: không lấy đầu của mẫu Học giả / Game thủ (tóc + mặt khác)
    assert.equal(paintedLook({ ...student, accessory: "acc-glasses" })?.index, 0);
    assert.equal(paintedLook({ ...student, accessory: "acc-headphones", face: "preset-student" })?.index, 0);
    // đúng mẫu → tranh của mẫu (phụ kiện có sẵn trong tranh)
    assert.deepEqual([paintedLook(preset("preset-scholar").items)?.index, paintedLook(preset("preset-scholar").items)?.acc], [4, null]);
    assert.equal(paintedLook({ ...preset("preset-gamer").items, face: "preset-gamer", hairColor: "hc-pink" })?.index, 6);
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

describe("Bộ phận mặt phối riêng (mắt / miệng / trang điểm)", () => {
  test("có bộ phận → dán mặt của chính tranh làm nền (không đổi sang SVG), không còn là mẫu", () => {
    const look = paintedLook({ ...student, eyeShape: "heart", mouth: "cat" });
    assert.equal(look?.index, 0);
    assert.equal(look?.face, FACE_IDS.indexOf("preset-student"));
    assert.equal(presetIndexOf({ ...student, faceDeco: "star" }), -1);
    assert.equal(currentFaceId({ ...student, mouth: "grin" }), "preset-student");
    const knight = paintedLook({ ...preset("preset-knight").items, eyeShape: "heart" });
    assert.equal(knight?.face, null, "hiệp sĩ đội mũ giáp: không có mặt nền để phối");
  });

  test("sanitizeAvatar giữ id bộ phận hợp lệ, bỏ id lạ", () => {
    const out = sanitizeAvatar({ eyeShape: "cat", mouth: "tongue", faceDeco: "bandaid" }, "u", []);
    assert.deepEqual([out.eyeShape, out.mouth, out.faceDeco], ["cat", "tongue", "bandaid"]);
    assert.equal(sanitizeAvatar({ eyeShape: "preset-gamer" }, "u", []).eyeShape, undefined, "mắt của mẫu không còn là lựa chọn tự chỉnh");
    const bad = sanitizeAvatar({ eyeShape: "preset-astro", mouth: "<b>", faceDeco: 3 }, "u", []);
    assert.deepEqual([bad.eyeShape, bad.mouth, bad.faceDeco], [undefined, undefined, undefined]);
  });

  test("mỗi lựa chọn có tên, id không trùng; mặt trơn có trong public/studio", () => {
    assert.ok(Object.values(FACE_PART_OPTIONS).flat().every((o) => !o.id.startsWith("preset-")), "không lấy bộ phận của mẫu");
    for (const [k, opts] of Object.entries(FACE_PART_OPTIONS)) {
      assert.ok(opts.length >= 6, k);
      assert.equal(new Set(opts.map((o) => o.id)).size, opts.length, k);
      assert.ok(opts.every((o) => o.name.length > 2), k);
    }
    for (const f of ["faces-blank.webp", "faces-skin.webp", "faces-blank-skin.webp", "char-skin.webp", "char-bodies-skin.webp", "characters-skin.webp"]) {
      assert.ok(existsSync(path.join(process.cwd(), "public/studio", f)), f);
    }
    assert.ok(SKIN_TONES.every((t) => /^#[0-9a-f]{6}$/.test(t.v ?? "")), "màu da có mã màu");
  });

  test("màu da riêng + lông mày: lưu được, không còn là mẫu, giữ tranh (không dán mặt chỉ vì đổi da)", () => {
    const out = sanitizeAvatar({ skinTone: "tan", brows: "angry" }, "u", []);
    assert.deepEqual([out.skinTone, out.brows], ["tan", "angry"]);
    assert.deepEqual([sanitizeAvatar({ skinTone: "#000" }, "u", []).skinTone, sanitizeAvatar({ brows: "x" }, "u", []).brows], [undefined, undefined]);
    assert.equal(presetIndexOf({ ...student, skinTone: "brown" }), -1);
    assert.equal(presetIndexOf({ ...student, brows: "thin" }), -1);
    assert.equal(paintedLook({ ...student, skinTone: "brown", brows: "thin" })?.face, null, "đổi da / lông mày không cần dán mặt");
    assert.equal(skinToneOf("deep"), "#6f432a");
    assert.equal(skinToneOf(null), null);
  });
});

describe("Giới tính + kiểu tóc theo giới", () => {
  const hairs = ITEMS.filter((i) => i.slot === "hair");
  test("mỗi giới đúng 10 kiểu tóc, kiểu nào cũng có đầu vẽ tay", () => {
    for (const g of ["male", "female"] as const) {
      const list = hairs.filter((h) => h.gender === g);
      assert.equal(list.length, 10, `${g}: ${list.map((h) => h.id).join(",")}`);
      for (const h of list) {
        const look = paintedLook({ ...student, hair: h.id, outfit: "outfit-tee", gender: g });
        assert.ok(look && look.index in HEAD_ANCHOR, `${h.id} chưa có đầu vẽ tay`);
        assert.equal(PRESETS[look.base].id, g === "female" ? "preset-kimono" : "preset-student", `${h.id}: đầu nền đúng giới`);
      }
    }
    assert.ok(hairs.every((h) => h.gender), "món tóc nào cũng gắn giới");
  });

  test("kiểu tóc mới không vào bể rương (giữ tỉ lệ rương), có giá hoặc miễn phí", () => {
    const fresh = hairs.filter((h) => !["hair-short", "hair-bob", "hair-ponytail", "hair-spiky", "hair-twin", "hair-long", "hair-bun", "hair-mohawk"].includes(h.id));
    assert.equal(fresh.length, 12);
    assert.ok(fresh.every((h) => h.studio && !h.gachaOnly && (h.free || h.price)), "món tóc mới phải là món Trang trí (studio)");
  });

  test("genderOf: đã chọn → theo chọn; chưa chọn → suy từ kiểu tóc (nhân vật cũ không đổi)", () => {
    assert.equal(genderOf({ hair: "hair-short" }), "male");
    assert.equal(genderOf({ hair: "hair-ponytail" }), "female");
    assert.equal(genderOf({ hair: "hair-short", gender: "female" }), "female");
    assert.equal(genderOf({}), "male");
    assert.equal(faceIndexOf({ hair: "hair-pixie" }), FACE_IDS.indexOf("preset-kimono"));
    assert.equal(sanitizeAvatar({ gender: "female" }, "u", []).gender, "female");
    assert.equal(sanitizeAvatar({ gender: "x" }, "u", []).gender, undefined);
  });
});
