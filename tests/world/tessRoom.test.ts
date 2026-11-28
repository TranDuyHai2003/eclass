import { test } from "node:test";
import assert from "node:assert/strict";
import { apertures, bearing, clampCamera, dirOf, insideRoomVolume, ORR, roomBlocked, roomGround, roomNav, stairHeight, TR, updateRoomNav } from "../../lib/world/tessRoom";
import { ESC, LAP_H } from "../../lib/world/penroseStair";

const at = (b: number, r: number): [number, number] => {
  const [x, z] = dirOf(b);
  return [x * r, z * r];
};

test("tessRoom: phương vị 0° = −z (cửa sổ), 90° = +x, 180° = +z (cửa vào)", () => {
  assert.equal(Math.round(bearing(0, -5)), 0);
  assert.equal(Math.round(bearing(5, 0)), 90);
  assert.equal(Math.round(bearing(0, 5)), 180);
  assert.equal(Math.round(bearing(-5, 0)), 270);
});

test("tessRoom: bệ 3 bậc và cầu thang lên dần tới tầng lửng 5 m", () => {
  assert.equal(roomGround(0, 3, 0), 0.45);
  assert.equal(roomGround(...at(30, 4.2), 0), 0.15);
  // Cầu thang đông: chân 160°, đỉnh 122°
  const foot = stairHeight(...at(159.5, 12.5));
  const top = stairHeight(...at(122.2, 12.5));
  assert.ok(foot !== null && foot < 0.4);
  assert.equal(top, TR.ZM);
  // Đứng dưới đất không "dịch chuyển" lên bậc cao (chỉ bước lên ≤ 0,55 m)
  assert.equal(roomGround(...at(130, 12.5), 0), 0);
  // Đã ở tầng lửng thì đứng được trên sàn tầng lửng
  assert.equal(roomGround(...at(60, 12.5), 5), 5);
  assert.equal(roomGround(...at(60, 12.5), 0), 0);
});

test("tessRoom: va chạm — bàn điều khiển, tường, lối tiền sảnh, gầm cầu thang", () => {
  roomNav.elevated = false;
  assert.equal(roomBlocked(0, 1.5, 0.45), true); // bàn điều khiển
  assert.equal(roomBlocked(0, 8, 0), false); // sàn trống
  assert.equal(roomBlocked(...at(60, 13.8), 0), true); // tường
  assert.equal(roomBlocked(0, 15.5, 0), false); // tiền sảnh (cửa vào ở +z)
  assert.equal(roomBlocked(1.5, 15.5, 0), true); // ngoài bề rộng tiền sảnh
  assert.equal(roomBlocked(...at(90, 18), 0), false); // hành lang đông
  assert.equal(roomBlocked(...at(150, 12.5), 0), true); // gầm cầu thang chỗ thấp (bậc ~1,4 m)
});

test("tessRoom: trên tầng lửng thì lan can chặn, không rơi xuống", () => {
  updateRoomNav(...at(60, 12.6), 5);
  assert.equal(roomNav.elevated, true);
  assert.equal(roomBlocked(...at(60, 10.8), 5), true); // vượt lan can
  assert.equal(roomBlocked(...at(64, 12.6), 5), false); // đi dọc tầng lửng
  assert.equal(roomBlocked(...at(0, 13.4), 5), false); // cầu kính trước cửa sổ
  updateRoomNav(0, 8, 0);
  assert.equal(roomNav.elevated, false);
});

test("tessRoom: máy quay bị kéo vào trong phòng khi lùi ra sau tường", () => {
  const cam = { x: 0, y: 2, z: 20 };
  const changed = clampCamera(cam, { x: 4, y: 1.5, z: 9 });
  assert.equal(changed, true);
  assert.ok(insideRoomVolume(cam.x, cam.y, cam.z));
});

test("tessRoom: lỗ sáng góc vàng tránh cửa sổ, có cả tường lẫn mái", () => {
  const a = apertures();
  const wall = a.filter((p) => !p.dome);
  const dome = a.filter((p) => p.dome);
  assert.ok(wall.length > 120 && dome.length > 250);
  for (const p of wall) {
    const b = bearing(p.x, p.z);
    const s = Math.abs(((b + 540) % 360) - 180) * (Math.PI / 180) * TR.R;
    assert.ok(Math.hypot(s, p.y - TR.WIN.y) > TR.WIN.r);
  }
});

test("tessRoom: hành lang đông đi thẳng vào phòng Thiên văn đồ; lệch trục thì tường chặn", () => {
  roomNav.elevated = false;
  for (let x = 4.5; x < ORR.cx - ORR.rail - 0.4; x += 0.25) assert.equal(roomBlocked(x, 0.4, 0), false, `x=${x}`);
  assert.equal(roomBlocked(13.0, 3, 0), false); // sàn phòng chính, cạnh miệng hành lang
  assert.equal(roomBlocked(13.8, 3, 0), true); // tường phòng chính (ngoài bề rộng hành lang)
  assert.equal(roomBlocked(18, 1.4, 0), true); // vách hành lang
  assert.equal(roomBlocked(ORR.cx, 0, 0), true); // máy Thiên văn đồ (sau lan can)
  assert.equal(roomBlocked(ORR.cx, 5, 0), false); // đi vòng quanh máy
  assert.equal(roomBlocked(ORR.cx, 6.8, 0), true); // tường phòng Thiên văn đồ
  assert.equal(roomBlocked(ORR.cx + ORR.lever[0], ORR.lever[1], 0), true); // bệ cần gạt
  assert.equal(roomGround(ORR.cx, 5, 0), 0);
  // máy quay trong phòng / hành lang hợp lệ, ngoài tường phòng thì không
  assert.ok(insideRoomVolume(ORR.cx - 2, 2.5, 4));
  assert.ok(insideRoomVolume(18, 2, 0));
  assert.ok(!insideRoomVolume(ORR.cx, 2, 7.5));
  // đi từ phòng chính ra (giữa sàn → hành lang → phòng) không có bước nào bị chặn hay tụt độ cao
  let blocked = 0;
  for (let x = 5; x <= 23; x += 0.1) if (roomBlocked(x, 0, 0) || roomGround(x, 0, 0) !== 0) blocked++;
  assert.equal(blocked, 0);
});

test("tessRoom: tầng lửng 270° → hành lang Escher → cửa giếng thang Penrose; lên được, rơi không được", () => {
  // trên tầng lửng tây, đi về phía vòm 270°
  updateRoomNav(-12.6, 0, 5);
  assert.equal(roomNav.elevated, true);
  for (let x = -12.6; x > ESC.X1 - 1.5; x -= 0.1) {
    assert.equal(roomBlocked(x, 0, 5), false, `x=${x}`);
    assert.equal(roomGround(x, 0, 5), 5, `x=${x}`);
  }
  assert.equal(roomBlocked(-18, 1.0, 5), true); // vách hành lang
  // hành lang tầng trên không làm sàn hành lang thư viện bên dưới cao lên
  assert.equal(roomGround(-18, 0, 0), 0);
  updateRoomNav(-18, 0, 0);
  assert.equal(roomNav.elevated, false);
  // trong giếng: giếng giữa + tường chặn, lối đi thì không
  updateRoomNav(ESC.X1 - 1, ESC.Z0 + 1, ESC.y0);
  assert.equal(roomNav.elevated, true);
  assert.equal(roomBlocked((ESC.X0 + ESC.X1) / 2, (ESC.Z0 + ESC.Z1) / 2, 6), true);
  assert.equal(roomBlocked(ESC.X1 - 1, 3, 6), false);
  assert.equal(roomBlocked(ESC.X1 - 0.1, 3, 6), true);
  assert.equal(roomBlocked(ESC.X0 + 1, ESC.Z1 - 0.1, 8), true);
  // cửa thành tường → không ra được
  roomNav.escherSealed = true;
  assert.equal(roomBlocked(ESC.X1 - 0.1, 0, 5), true);
  assert.equal(roomBlocked(ESC.X1 + 0.1, 0, 5), true);
  roomNav.escherSealed = false;
  assert.equal(roomBlocked(ESC.X1 - 0.1, 0, 5), false);
  // cửa rộng hết chiếu nghỉ: đứng sát tường bắc (z = −0,69, mép đi được của chiếu nghỉ) vẫn bước ra được (lỗi thấy trên trình duyệt)
  for (let x = ESC.X1 - 0.6; x < ESC.X1 + 0.6; x += 0.05) assert.equal(roomBlocked(x, -0.69, 5), false, `x=${x}`);
  // máy quay: trong giếng giữa ở mọi độ cao; trên lối đi thì giữa mặt bậc và tấm sàn vòng trên
  assert.ok(insideRoomVolume((ESC.X0 + ESC.X1) / 2, 30, 2));
  assert.ok(insideRoomVolume(ESC.X1 - 1, ESC.y0 + 2, 0));
  assert.ok(!insideRoomVolume(ESC.X1 - 1, ESC.y0 + LAP_H - 0.2, 0));
  assert.ok(insideRoomVolume(-18, 6.5, 0)); // hành lang Escher
  const cam = { x: -16, y: 7, z: 4 };
  clampCamera(cam, { x: -18, y: 6.5, z: 0 });
  assert.ok(insideRoomVolume(cam.x, cam.y, cam.z));
  updateRoomNav(0, 8, 0);
});

test("tessRoom: tầng lửng 90° → vòm → Phòng Lăng kính (lý thuyết màu); sàn y 5, tường / bệ chặn, máy quay trong phòng", async () => {
  const { PH, PEDESTALS, ST } = await import("../../lib/world/colorTheory");
  // đi thẳng từ tầng lửng (x 12,5) qua vòm vào cổ phòng rồi xuống sảnh chính — không bị chặn
  updateRoomNav(12.5, 0, 5);
  assert.equal(roomNav.elevated, true);
  for (let x = 12.5; x < 17.5; x += 0.1) {
    updateRoomNav(x, 0, 5);
    assert.equal(roomNav.elevated, true, `x=${x}`);
    assert.equal(roomBlocked(x, 0, 5), false, `x=${x}`);
    assert.equal(roomGround(x, 0, 5), 5);
  }
  for (let z = 0; z > -9.6; z -= 0.1) assert.equal(roomBlocked(17.5, z, 5), false, `z=${z}`);
  for (let z = 0; z > -18; z -= 0.1) assert.equal(roomBlocked(15.4, z, 5), false, `x=15,4 z=${z}`);
  // lệch khỏi vòm thì vướng tường; tường ngoài phòng chặn; bệ chặn
  updateRoomNav(14.2, 1.15, 5);
  assert.equal(roomBlocked(14.2, 1.15, 5), true);
  updateRoomNav(17, -5, 5);
  assert.equal(roomBlocked(PH.MX1 + 0.1, -12, 5), true);
  assert.equal(roomBlocked(22, -3, 5), true); // góc cắt chừa Thiên văn đồ
  const [, px, pz] = PEDESTALS[0];
  assert.equal(roomBlocked(px, pz, 5), true);
  assert.equal(roomBlocked(ST.stage.x, ST.stage.z, 5), true); // trụ trắng giữa sân khấu
  // tầng dưới: hành lang đông vẫn như cũ, sàn phòng màu không "kéo" người chơi lên
  updateRoomNav(18, 0, 0);
  assert.equal(roomNav.elevated, false);
  assert.equal(roomGround(18, 0, 0), 0);
  assert.equal(roomBlocked(18, 0, 0), false);
  // máy quay
  assert.ok(insideRoomVolume(20, 7, -14));
  assert.ok(insideRoomVolume(14.2, 6.5, 0)); // khe vòm
  assert.ok(!insideRoomVolume(20, 11, -14)); // trên trần
  assert.ok(!insideRoomVolume(14.2, 6.5, 2)); // trong tường bên vòm
  const cam = { x: 13.5, y: 9.5, z: 4 };
  clampCamera(cam, { x: 16, y: 6.6, z: 0 });
  assert.ok(insideRoomVolume(cam.x, cam.y, cam.z));
  updateRoomNav(0, 8, 0);
});
