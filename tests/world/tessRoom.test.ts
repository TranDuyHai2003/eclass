import { test } from "node:test";
import assert from "node:assert/strict";
import { apertures, bearing, clampCamera, dirOf, insideRoomVolume, roomBlocked, roomGround, roomNav, stairHeight, TR, updateRoomNav } from "../../lib/world/tessRoom";

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
