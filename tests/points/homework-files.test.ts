/**
 * Rà lỗ hổng 26/11/2026: nộp BTVN rỗng / URL bất kỳ để lấy +100 xu; xoá tệp người khác bằng URL; huỷ đơn sau khi đã nhận quà.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cleanHomeworkAttachments, homeworkKeyOf, MAX_HOMEWORK_FILES } from "@/lib/homework-files";
import { STUDENT_CANCEL_WINDOW_MS, studentCanCancel } from "@/lib/points/config";

const OK = "https://cdn.teacherduc.me/file/teacherduc-video-storage/images/ITcaQ3Z0EyMMyEE4jOjGc-homework-1781254194949-bai.jpg";
const OK_OLD = "https://cdn.teacherduc.me/images/n3WSIJWUpeBrC8Iw3HKFv-homework_1781254213106_3r.png";

describe("Tệp bài tập về nhà", () => {
  test("nhận đúng tệp BTVN trên CDN (cả dạng /file/<bucket>/ lẫn tên cũ có gạch dưới)", () => {
    assert.equal(homeworkKeyOf(OK), "images/ITcaQ3Z0EyMMyEE4jOjGc-homework-1781254194949-bai.jpg");
    assert.equal(homeworkKeyOf(OK_OLD), "images/n3WSIJWUpeBrC8Iw3HKFv-homework_1781254213106_3r.png");
    assert.ok(homeworkKeyOf("https://cdn.teacherduc.me/documents/abcdefghijklmnopqrstu-homework-1-bai.pdf"));
  });

  test("từ chối ảnh / tài liệu bài giảng, video, host lạ, http, đường dẫn ..", () => {
    for (const bad of [
      "https://cdn.teacherduc.me/images/ITcaQ3Z0EyMMyEE4jOjGc-anh-bia-khoa-hoc.jpg", // ảnh bài giảng của thầy
      "https://cdn.teacherduc.me/documents/ITcaQ3Z0EyMMyEE4jOjGc-de-thi.pdf",
      "https://cdn.teacherduc.me/videos/x/master.m3u8",
      "https://evil.example.com/images/ITcaQ3Z0EyMMyEE4jOjGc-homework-1.jpg",
      "http://cdn.teacherduc.me/images/ITcaQ3Z0EyMMyEE4jOjGc-homework-1.jpg",
      "https://cdn.teacherduc.me/images/../videos/ITcaQ3Z0EyMMyEE4jOjGc-homework-1.jpg",
      "https://cdn.teacherduc.me/images/ITcaQ3Z0EyMMyEE4jOjGc-homework-1.jpg?x=1",
      "",
      "not a url",
      42,
    ]) {
      assert.equal(homeworkKeyOf(bad), null, String(bad));
    }
  });

  test("nộp bài: phải có ít nhất 1 tệp hợp lệ; URL lạ bị từ chối; tệp cũ của chính mình vẫn giữ được; bỏ trùng", () => {
    assert.ok("error" in cleanHomeworkAttachments([]));
    assert.ok("error" in cleanHomeworkAttachments(null));
    assert.ok("error" in cleanHomeworkAttachments([{ name: "x", url: "https://cdn.teacherduc.me/images/ITcaQ3Z0EyMMyEE4jOjGc-anh-bia.jpg" }]));
    assert.ok("error" in cleanHomeworkAttachments(Array.from({ length: MAX_HOMEWORK_FILES + 1 }, () => ({ name: "a", url: OK }))));
    const legacy = "https://cdn.teacherduc.me/images/legacy-file.jpg";
    assert.ok("error" in cleanHomeworkAttachments([{ name: "a", url: legacy }]), "tệp lạ không có trong bài cũ → từ chối");
    const r = cleanHomeworkAttachments([{ name: "a", url: OK, size: 10 }, { name: "a2", url: OK }, { name: "b", url: legacy }], [legacy]);
    assert.ok("ok" in r);
    assert.deepEqual(r.ok.map((f) => f.url), [OK, legacy]);
    assert.equal(r.ok[0].size, 10);
  });
});

describe("Học sinh tự huỷ đơn đổi quà", () => {
  test(`chỉ trong ${STUDENT_CANCEL_WINDOW_MS / 3_600_000} giờ đầu`, () => {
    const now = Date.now();
    assert.equal(studentCanCancel(new Date(now - 60_000), now), true);
    assert.equal(studentCanCancel(new Date(now - STUDENT_CANCEL_WINDOW_MS - 1), now), false);
    assert.equal(studentCanCancel(new Date(now - 3 * 86_400_000).toISOString(), now), false);
  });
});
