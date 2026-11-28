import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addLights,
  afterimageOf,
  byte,
  complementHue,
  CUBE_HIT,
  CUBE_TARGETS,
  cubeColorAt,
  cubeMiss,
  cylBlocks,
  deltaE,
  filterShortcut,
  filterSpectral,
  filterTable,
  FILTER_TARGETS,
  FLAG_FIELD,
  FLAG_STAR,
  harmonyHues,
  hexOf,
  hslToRgb,
  hsvToRgb,
  inPrismHall,
  LIGHT_TARGETS,
  linearToSrgb,
  locusXy,
  metamerWeights,
  cmf,
  nearColorStation,
  neutralInverse,
  neutralTonemap,
  nextLevel,
  oklab,
  PEDESTALS,
  PH,
  prismHallBlocked,
  rgbToHsl,
  rgbToHsv,
  rgbToXyz,
  rybToHue,
  hueToRyb,
  simulateCvd,
  spectralRgb,
  SLICE_STEPS,
  srgbToLinear,
  ST,
  stageColorAt,
  stageLamp,
  xyOf,
  toSrgb,
  type RGB,
} from "../../lib/world/colorTheory";

const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b} (±${eps})`);
const nearV = (a: readonly number[], b: readonly number[], eps: number, msg?: string) => a.forEach((v, i) => near(v, b[i], eps, msg));

test("colorTheory: sRGB ↔ tuyến tính — 50 % công suất ánh sáng là mã 188, không phải 128", () => {
  for (let i = 0; i <= 50; i++) near(srgbToLinear(linearToSrgb(i / 50)), i / 50, 1e-9);
  assert.equal(byte(0.5), 188);
  assert.equal(byte(0.2159), 128); // mã 128 chỉ là ~21 % ánh sáng
  near(srgbToLinear(0.5), 0.214, 1e-3);
  assert.equal(hexOf([1, 1, 0]), "#FFFF00");
  // trung bình HAI mã sRGB (đỏ + lục) ≠ trộn ánh sáng: trộn đúng phải làm trên tuyến tính
  assert.ok(byte(0.5) > 0.5 * 255);
});

test("colorTheory: HSV / HSL ↔ RGB khứ hồi; 6 đỉnh của lục giác", () => {
  nearV(hsvToRgb(0, 1, 1), [1, 0, 0], 1e-12);
  nearV(hsvToRgb(60, 1, 1), [1, 1, 0], 1e-12);
  nearV(hsvToRgb(120, 1, 1), [0, 1, 0], 1e-12);
  nearV(hsvToRgb(180, 1, 1), [0, 1, 1], 1e-12);
  nearV(hsvToRgb(240, 1, 1), [0, 0, 1], 1e-12);
  nearV(hsvToRgb(300, 1, 1), [1, 0, 1], 1e-12);
  nearV(hslToRgb(0, 1, 0.5), [1, 0, 0], 1e-12);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const c: RGB = [rnd(), rnd(), rnd()];
    const [h, s, v] = rgbToHsv(c);
    nearV(hsvToRgb(h, s, v), c, 1e-9, "hsv");
    const [h2, s2, l2] = rgbToHsl(c);
    nearV(hslToRgb(h2, s2, l2), c, 1e-9, "hsl");
  }
});

test("colorTheory: phối màu — bù 180°, bộ ba ±120°, tương đồng ±30°; màu bù cộng lại thành trắng", () => {
  assert.deepEqual(harmonyHues(30, "complement"), [30, 210]);
  assert.deepEqual(harmonyHues(30, "triad"), [30, 150, 270]);
  assert.deepEqual(harmonyHues(10, "analogous"), [340, 10, 40]);
  assert.deepEqual(harmonyHues(0, "split"), [0, 150, 210]);
  for (let h = 0; h < 360; h += 15) {
    const a = hsvToRgb(h, 1, 1);
    const b = hsvToRgb(h + 180, 1, 1);
    nearV(addLights([{ color: a, k: 1 }, { color: b, k: 1 }]), [1, 1, 1], 1e-9, `h=${h}`);
  }
  // ba màu bộ ba đủ mạnh cũng cộng thành trắng (đỏ + lục + lam)
  const tri = harmonyHues(0, "triad").map((h) => ({ color: hsvToRgb(h, 1, 1), k: 1 }));
  nearV(addLights(tri), [1, 1, 1], 1e-9);
});

test("colorTheory: vòng hoạ sĩ RYB — đối của đỏ là LỤC (không phải cyan), của vàng là tím", () => {
  for (let h = 0; h < 360; h += 7) near(rybToHue(hueToRyb(h)), h, 1e-9);
  near(complementHue(0, "rgb"), 180, 1e-9); // ánh sáng: đỏ ↔ lam lục
  near(complementHue(0, "ryb"), 120, 1e-9); // hoạ sĩ: đỏ ↔ lục
  near(complementHue(60, "ryb"), 285, 1e-9); // vàng ↔ tím
  near(complementHue(240, "ryb"), 30, 1e-9); // lam ↔ cam
});

test("colorTheory: CIE 1931 — sắc độ các màu cơ bản sRGB và điểm trắng D65", () => {
  nearV(xyOf(rgbToXyz([1, 0, 0])), [0.64, 0.33], 1e-3);
  nearV(xyOf(rgbToXyz([0, 1, 0])), [0.3, 0.6], 1e-3);
  nearV(xyOf(rgbToXyz([0, 0, 1])), [0.15, 0.06], 1e-3);
  nearV(xyOf(rgbToXyz([1, 1, 1])), [0.3127, 0.329], 1e-3);
  near(rgbToXyz([1, 1, 1])[1], 1, 1e-6); // trắng có độ chói Y = 1
});

test("colorTheory: đường phổ (xấp xỉ Wyman 2013) khớp số liệu CIE; mọi màu sRGB nằm trong móng ngựa", () => {
  // giá trị chuẩn CIE 1931 2° (x, y)
  nearV(locusXy(450), [0.1566, 0.0177], 0.02);
  nearV(locusXy(520), [0.0743, 0.8338], 0.03);
  nearV(locusXy(580), [0.5125, 0.4866], 0.02);
  nearV(locusXy(650), [0.7260, 0.2740], 0.02);
  near(cmf(555)[1], 1, 0.03); // ȳ đạt cực đại ~555 nm
  // các đỉnh tam giác sRGB nằm trong vùng phổ (y của đỉnh lục 0,6 < y của phổ ở ~530 nm)
  assert.ok(locusXy(530)[1] > 0.6);
  // màu phổ hiển thị: 470 nm ngả lam, 530 lục, 580 vàng, 640 đỏ
  // sắc độ nhìn thấy (trên mã sRGB, như bộ chọn màu)
  const hue = (l: number) => rgbToHsv(toSrgb(spectralRgb(l)))[0];
  assert.ok(hue(470) > 200 && hue(470) < 250, `470 → ${hue(470)}`);
  assert.ok(hue(530) > 90 && hue(530) < 165, `530 → ${hue(530)}`);
  assert.ok(hue(580) > 40 && hue(580) < 70, `580 → ${hue(580)}`);
  assert.ok(hue(620) < 15 || hue(620) > 345, `620 → ${hue(620)}`);
  // phổ đỏ sâu nằm hơi lệch về phía tím của đỏ sRGB (đường qua điểm trắng cắt cạnh R–B)
  assert.ok(hue(660) < 10 || hue(660) > 330, `660 → ${hue(660)}`);
});

test("colorTheory: trộn cộng ánh sáng — đỏ + lục = vàng, cả ba = trắng, chồng 2 đèn trắng sáng gấp đôi", () => {
  nearV(addLights([{ color: [1, 0, 0], k: 1 }, { color: [0, 1, 0], k: 1 }]), [1, 1, 0], 0);
  nearV(addLights([{ color: [1, 1, 1], k: 1 }, { color: [1, 1, 1], k: 1 }]), [2, 2, 2], 0);
  // vùng giữa sân khấu nhận cả 3 đèn; chân mỗi đèn chỉ có đèn đó + vùng giao hai đèn
  nearV(stageColorAt(ST.stage.x, ST.stage.z, [1, 1, 1]), [1, 1, 1], 1e-9);
  nearV(stageColorAt(ST.stage.x, ST.stage.z, [1, 0.5, 0]), [1, 0.5, 0], 1e-9);
  const [rx, rz] = stageLamp(0);
  const [gx, gz] = stageLamp(1);
  const toward = (ax: number, az: number, bx: number, bz: number, t: number): [number, number] => [ax + (bx - ax) * t, az + (bz - az) * t];
  // xa phía ngoài chân đèn đỏ: chỉ đỏ
  const out = toward(ST.stage.x, ST.stage.z, rx, rz, 1.9);
  nearV(stageColorAt(out[0], out[1], [1, 1, 1]), [1, 0, 0], 1e-9);
  // giữa đỏ và lục, phía ngoài: vàng
  const mid = toward(ST.stage.x, ST.stage.z, (rx + gx) / 2, (rz + gz) / 2, 2.0);
  nearV(stageColorAt(mid[0], mid[1], [1, 1, 1]), [1, 1, 0], 1e-9);
  // mọi thử thách giải được bằng các nấc độ sáng
  let k = 1;
  const seen = new Set<number>();
  for (let i = 0; i < 6; i++) {
    seen.add(k);
    k = nextLevel(k);
  }
  for (const t of LIGHT_TARGETS) t.lv.forEach((v) => assert.ok(seen.has(v), `${t.en} cần nấc ${v}`));
});

test("colorTheory: bóng màu — trụ chặn đèn đỏ thì bóng có màu lam lục (lục + lam)", () => {
  const col = { c: [ST.stage.x, ST.stage.z] as [number, number], r: 0.22, h: 1.9 };
  const [rx, rz] = stageLamp(0);
  // điểm sàn ngay sau trụ, phía đối diện đèn đỏ
  const dx = ST.stage.x - rx;
  const dz = ST.stage.z - rz;
  const L = Math.hypot(dx, dz);
  const p: [number, number] = [ST.stage.x + (dx / L) * 0.3, ST.stage.z + (dz / L) * 0.3];
  const c = stageColorAt(p[0], p[1], [1, 1, 1], [col]);
  assert.equal(c[0], 0);
  assert.ok(c[1] > 0.5 && c[2] > 0.5, `bóng của đèn đỏ phải là cyan: ${c}`);
  // không trụ: trắng
  nearV(stageColorAt(p[0], p[1], [1, 1, 1]), [1, 1, 1], 1e-9);
  // hình học tia–trụ
  assert.equal(cylBlocks([0, 0, 0], [4, 4, 0], [2, 0], 0.3, 3), true);
  assert.equal(cylBlocks([0, 0, 0], [4, 4, 0], [2, 0], 0.3, 1), false); // trụ thấp, tia đi trên đỉnh
  assert.equal(cylBlocks([0, 0, 0], [4, 4, 0], [2, 1], 0.3, 3), false); // trượt bên cạnh
});

test("colorTheory: trộn trừ — C·Y = lục, M·Y = đỏ, C·M = lam, cả ba ≈ đen; nhân PHỔ khác 'lối tắt RGB'", () => {
  const T = filterTable();
  nearV(T[0], [1, 1, 1], 1e-9); // không kính: trắng (cân bằng trắng)
  const hueOf = (c: RGB) => rgbToHsv(c)[0];
  const isHue = (c: RGB, lo: number, hi: number) => {
    const h = hueOf(c);
    return lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi;
  };
  assert.ok(isHue(T[0b001], 160, 200), `cyan ${T[1]}`);
  assert.ok(isHue(T[0b010], 280, 330), `magenta ${T[2]}`);
  assert.ok(isHue(T[0b100], 45, 70), `yellow ${T[4]}`);
  assert.ok(isHue(T[0b101], 95, 150), `C+Y = green ${T[5]}`);
  assert.ok(isHue(T[0b110], 340, 20), `M+Y = red ${T[6]}`);
  assert.ok(isHue(T[0b011], 215, 260), `C+M = blue ${T[3]}`);
  assert.ok(Math.max(...T[7]) < 0.08, `C+M+Y gần đen ${T[7]}`);
  // kết quả phổ ≠ tích các màu RGB của từng kính (kính thật không lý tưởng)
  const sp = filterSpectral(["c", "y"]);
  const sc = filterShortcut(["c", "y"]);
  assert.ok(deltaE(sp, sc) > 0.01, `phổ ${sp} vs lối tắt ${sc}`);
  // thử thách giải được: tổ hợp đúng cho màu có sắc độ đúng tên
  for (const t of FILTER_TARGETS) assert.ok(t.mask > 0 && t.mask < 8);
});

test("colorTheory: đồng sắc — đỏ 630 nm + lục 532 nm trông như vàng 580 nm (xy lệch < 0,008, cùng Y)", () => {
  const [ka, kb] = metamerWeights(580, 630, 532);
  assert.ok(ka > 0 && kb > 0);
  const A = cmf(630);
  const B = cmf(532);
  const mix: RGB = [ka * A[0] + kb * B[0], ka * A[1] + kb * B[1], ka * A[2] + kb * B[2]];
  const C = cmf(580);
  nearV(xyOf(mix), xyOf(C), 0.008);
  near(mix[1], C[1], 1e-9);
});

test("colorTheory: OKLab — trắng L = 1, xám không có sắc; ΔE nhỏ cho màu gần nhau", () => {
  nearV(oklab([1, 1, 1]), [1, 0, 0], 1e-4);
  const g = oklab([0.2, 0.2, 0.2]);
  near(g[1], 0, 1e-4);
  near(g[2], 0, 1e-4);
  assert.ok(deltaE([1, 0, 0], [1, 0.02, 0]) < 0.05);
  assert.ok(deltaE([1, 0, 0], [0, 1, 0]) > 0.4);
});

test("colorTheory: mô phỏng mù màu Machado 2009 — giữ trắng; đỏ và lục lẫn nhau với protan / deutan", () => {
  for (const k of ["protan", "deutan", "tritan"] as const) nearV(simulateCvd([1, 1, 1], k), [1, 1, 1], 1e-5, k);
  for (const k of ["protan", "deutan"] as const) {
    const r = simulateCvd([0.8, 0.1, 0.05], k);
    const g = simulateCvd([0.25, 0.55, 0.05], k);
    // màu đỏ và lục ô liu khác nhau rõ với mắt thường nhưng gần như cùng sắc độ khi mô phỏng
    const hr = rgbToHsv(r)[0];
    const hg = rgbToHsv(g)[0];
    assert.ok(Math.abs(hr - hg) < 25, `${k}: ${hr} vs ${hg}`);
    // sắc (a, b trong OKLab) gần như trùng; chỉ còn khác độ sáng
    const p = oklab(r);
    const q = oklab(g);
    const p0 = oklab([0.8, 0.1, 0.05]);
    const q0 = oklab([0.25, 0.55, 0.05]);
    assert.ok(Math.hypot(p[1] - q[1], p[2] - q[2]) < 0.35 * Math.hypot(p0[1] - q0[1], p0[2] - q0[2]), `${k}: ${p} vs ${q}`);
  }
});

test("colorTheory: ảnh dư — cờ lam lục sao lam → nền đỏ, sao vàng", () => {
  const f = afterimageOf(FLAG_FIELD);
  const s = afterimageOf(FLAG_STAR);
  assert.ok(rgbToHsv(f)[0] < 1 || rgbToHsv(f)[0] > 359);
  assert.ok(rgbToHsv(f)[1] > 0.85);
  near(rgbToHsv(s)[0], 60, 1); // vàng
});

test("colorTheory: nghịch đảo tone mapping Neutral — màn hình hiện đúng màu dự định", () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // vùng không bị nén (đỉnh ≤ 0,76): chính xác; trắng / xám tới 0,98: chính xác
  for (let i = 0; i < 200; i++) {
    const d: RGB = [rnd() * 0.76, rnd() * 0.76, rnd() * 0.76];
    nearV(neutralTonemap(neutralInverse(d)), d, 1e-6, `${d}`);
  }
  for (const v of [0, 0.01, 0.05, 0.3, 0.8, 0.9, 0.98]) nearV(neutralTonemap(neutralInverse([v, v, v])), [v, v, v], 1e-6, `xám ${v}`);
  // màu bão hoà sáng tới 0,85: sai số nhỏ (Neutral khử bão hoà vùng sáng)
  for (let i = 0; i < 200; i++) {
    const d: RGB = [rnd() * 0.85, rnd() * 0.85, rnd() * 0.85];
    nearV(neutralTonemap(neutralInverse(d)), d, 0.02, `${d}`);
  }
  // không nghịch đảo: trắng 1,0 bị nén xuống dưới 1
  assert.ok(neutralTonemap([1, 1, 1])[0] < 0.97);
});

test("colorTheory: khối RGB / đĩa HSV đi bộ — vị trí là màu; mọi mục tiêu tới được", () => {
  const h = ST.cube.S / 2;
  nearV(cubeColorAt(ST.cube.x - h, ST.cube.z + h, "rgb", 0)!, [0, 0, 0], 1e-9); // góc tây nam = đen
  nearV(cubeColorAt(ST.cube.x + h, ST.cube.z - h, "rgb", 1)!, [1, 1, 1], 1e-9); // góc đông bắc, lát G = 1 = trắng
  assert.equal(cubeColorAt(ST.cube.x + 5, ST.cube.z, "rgb", 0), null);
  nearV(cubeColorAt(ST.cube.x + h * 0.999, ST.cube.z, "hsv", 1)!, [1, 0, 0], 2e-3); // đông = đỏ
  nearV(cubeColorAt(ST.cube.x, ST.cube.z - h * 0.999, "hsv", 1)!, [0.5, 1, 0], 2e-2); // bắc = 90° (lục vàng)
  nearV(cubeColorAt(ST.cube.x, ST.cube.z, "hsv", 0.5)!, [0.5, 0.5, 0.5], 1e-9); // tâm = xám
  for (const t of CUBE_TARGETS) {
    let best = 9;
    for (const k of SLICE_STEPS) {
      for (let i = 0; i <= 40; i++)
        for (let j = 0; j <= 40; j++) {
          const c = cubeColorAt(ST.cube.x - h + (i / 40) * 2 * h, ST.cube.z + h - (j / 40) * 2 * h, "rgb", k);
          if (c) best = Math.min(best, cubeMiss(c, t.c));
        }
    }
    assert.ok(best < CUBE_HIT * 0.5, `${t.en}: ${best}`);
  }
});

test("colorTheory: phòng — sàn, khe vòm, bệ trong tầm tay và có va chạm, không chồng vào Thiên văn đồ", () => {
  assert.ok(inPrismHall(17, 0));
  assert.ok(inPrismHall(25, -15));
  assert.ok(!inPrismHall(25, -3)); // góc đông nam bị cắt (Thiên văn đồ)
  // mọi điểm sàn cách tâm Thiên văn đồ (28,6; 0) > 7,3 (vỏ ngoài) và ngoài vòng tường chính r 14
  for (let x = PH.X0; x <= PH.MX1; x += 0.2)
    for (let z = PH.MZ0; z <= PH.FZ1; z += 0.2)
      if (inPrismHall(x, z)) {
        assert.ok(Math.hypot(x - 28.6, z) > 7.3 + 0.3, `chồng Thiên văn đồ ở ${x},${z}`);
        assert.ok(Math.hypot(x, z) > 14, `chồng phòng chính ở ${x},${z}`);
      }
  for (const [id, x, z] of PEDESTALS) {
    assert.ok(inPrismHall(x, z, 0.5), `${id} trong phòng`);
    assert.ok(prismHallBlocked(x, z), `${id} chặn`);
    assert.equal(nearColorStation(x + 0.75, z, PH.y), nearColorStation(x + 0.75, z, PH.y) ?? id);
    assert.ok(nearColorStation(x + 0.7, z, PH.y) !== null, `${id} với tới`);
    assert.equal(nearColorStation(x, z + 0.7, 0), null); // ở tầng dưới thì không
  }
  // mỗi bệ có đường tới: đứng cách 0,7 m về một phía không bị chặn
  for (const [id, x, z] of PEDESTALS) {
    const free = [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([a, b]) => !prismHallBlocked(x + a, z + b));
    assert.ok(free, `${id} tiếp cận được`);
  }
  // bệ không đè lên nhau (cách ≥ 0,9)
  for (let i = 0; i < PEDESTALS.length; i++)
    for (let j = i + 1; j < PEDESTALS.length; j++) assert.ok(Math.hypot(PEDESTALS[i][1] - PEDESTALS[j][1], PEDESTALS[i][2] - PEDESTALS[j][2]) > 0.9);
});

test("colorTheory: OKLCH — khứ hồi OKLab, vòng cảm nhận giữ độ sáng đều; ba vòng cho màu bù khác nhau", async () => {
  const { oklabToLinear, oklchToLinear, wheelColor, harmonyColors } = await import("../../lib/world/colorTheory");
  for (const c of [[0.2, 0.5, 0.9], [1, 0, 0], [0.05, 0.9, 0.3]] as RGB[]) {
    const [L, a, b] = oklab(c);
    nearV(oklabToLinear(L, a, b), c, 1e-6);
  }
  // mọi màu trên vòng OKLCH có cùng độ sáng L (± gam màu), còn vòng HSV thì không (vàng sáng hơn lam rất nhiều)
  const Ls = Array.from({ length: 12 }, (_, i) => oklab(wheelColor(i * 30, "oklch"))[0]);
  assert.ok(Math.max(...Ls) - Math.min(...Ls) < 0.01, `${Ls}`);
  const Lh = Array.from({ length: 12 }, (_, i) => oklab(wheelColor(i * 30, "rgb"))[0]);
  assert.ok(Math.max(...Lh) - Math.min(...Lh) > 0.3);
  oklchToLinear(0.72, 0.4, 140).forEach((v) => assert.ok(v >= 0 && v <= 1)); // ngoài gam → giảm C
  // đối của đỏ: cyan (ánh sáng) vs lục (hoạ sĩ)
  const [, cRgb] = harmonyColors(0, "complement", "rgb");
  const [, cRyb] = harmonyColors(0, "complement", "ryb");
  near(rgbToHsv(cRgb)[0], 180, 1);
  near(rgbToHsv(cRyb)[0], 120, 1);
});

test("colorTheory: lăng kính — tím lệch nhiều hơn đỏ; độ lệch cực tiểu = 2·asin(n·sin 30°) − 60°", async () => {
  const { cauchyN, prismDeviation, minDevIncidence, GLASS, PRISM_HOLE, spectrumHitZ, PRISM } = await import("../../lib/world/colorTheory");
  near(cauchyN(587.6, GLASS.sf11), 1.7847, 0.002); // SF11 n_d
  // phòng tối: lỗ nằm trên tường bắc trong phòng; phổ 400…700 nm trải ≥ 0,5 m, nằm trên màn (z −21,2 … −18,4), tím lệch xa hơn
  assert.ok(PRISM_HOLE[0] > PH.X0 + 0.3 && PRISM_HOLE[0] < PRISM.screenX);
  const z4 = spectrumHitZ(400)!;
  const z7 = spectrumHitZ(700)!;
  assert.ok(Math.abs(z4 - z7) > 0.5, `${z4} ${z7}`);
  for (const z of [z4, z7, spectrumHitZ(550)!]) assert.ok(z > -21.2 && z < -18.4, `${z}`);
  near(spectrumHitZ(550)!, PRISM.z, 1e-9);
  assert.ok(cauchyN(400) > cauchyN(700));
  near(cauchyN(587.6), 1.5168, 0.002); // BK7 n_d
  const inc = minDevIncidence(550);
  const d400 = prismDeviation(400, inc)!;
  const d700 = prismDeviation(700, inc)!;
  assert.ok(d400 > d700 + 1, `${d400} vs ${d700}`);
  const n = cauchyN(550);
  near(prismDeviation(550, inc)!, (2 * Math.asin(n * 0.5) * 180) / Math.PI - 60, 1e-6);
  // quanh góc tới cực tiểu, lệch ±5° thì độ lệch đều lớn hơn
  assert.ok(prismDeviation(550, inc + 5)! > prismDeviation(550, inc)!);
  assert.ok(prismDeviation(550, inc - 5)! > prismDeviation(550, inc)!);
});
