# Test

Chỉ chạy với **DB local**: script tự dừng nếu `CUSTOM_DATABASE_URL` không trỏ tới `localhost`. Mọi dữ liệu thử đều tự xoá sau khi chạy.

## Test logic — `npm test`

Dùng test runner có sẵn của Node (`node:test`) cùng `ts-node`, không cần cài thêm gì. Chạy mất khoảng 2 giây.

| File | Kiểm tra |
|---|---|
| `points/rules.test.ts` | Thang điểm, cân bằng điểm (học chăm cả tháng ≈ 1 gói bim bim), chuẩn hoá form quà, kiểm tra thưởng tay, mốc ngày giờ Việt Nam |
| `points/engine.test.ts` | Cộng một lần theo khoá, thu hồi, giới hạn ngày, chạy đồng thời, ví luôn khớp sổ, lỗi không làm hỏng việc nộp bài, `POINTS_ENABLED=off` |
| `points/hooks.test.ts` | Nộp bài đúng hạn và sau hạn, làm ít câu, bứt phá, tự luận chờ chấm hoặc bỏ trống, thi cuối khoá, xoá lượt làm, bài tập về nhà |
| `points/streak.test.ts` | Chuỗi tuần, thẻ giữ chuỗi, mốc thưởng, kỷ lục |
| `points/redemption.test.ts` | Ai thấy và đổi được quà nào, số dư, kho, giới hạn tháng, bấm đồng thời, huỷ / từ chối / trao / hết hạn |
| `points/manual.test.ts` | Thầy thưởng và trừ điểm, giới hạn ngày, bỏ qua tài khoản không hợp lệ |
| `anchors/matching.test.ts` | Bộ ghép nhãn câu ↔ câu hỏi: dãy số tăng dài nhất, nhãn khuyết/lạc, số trần, không ghép xuyên phần, Đúng/Sai 4 câu/nhãn, tiêu đề Phần I/II |
| `points/queries.test.ts` | Dữ liệu trang Điểm thưởng, dải điểm trang chủ, màn kết quả, trang quản lý của thầy |
| `home/course-grade.test.ts` | Nhóm khối của khoá học (Lớp 10/11/12/Luyện thi) từ tiêu đề và lớp gắn khoá, thứ tự và bìa thẻ |

## Test giao diện — `npm run test:e2e`

Gồm bốn script: `points.e2e.mjs` (Điểm thưởng), `anchor-editor.e2e.mjs` (công cụ cắt lời giải từng câu: bấm đặt mốc, Shift/Alt + bấm, kéo mốc, hoàn tác, Ctrl+S lưu, điện thoại) `lesson-page.e2e.mjs` (trang học bài: danh sách bài cột phải, Bài trước/Bài sau, hoàn thành bài, 2 tab trên điện thoại, 390–1920px) và `landing.e2e.mjs` (Khóa học: lọc theo khối, tìm, Tiếp tục học; trang chủ khách: hero, đếm ngược, lộ trình làm mờ theo khối; 390–1920px).

`npm run test:audit` (cũng cần server đang chạy): rà toàn trang theo vai trò khách / học sinh / giáo viên / admin ở 390 · 768 · 1366 · 1920px — mã HTTP, lỗi JavaScript, ảnh hỏng, tràn ngang / chữ bị cắt / thừa khoảng trống. Chỉ đọc, không mở trang làm bài. Tuỳ chọn `--only teacher`, `--widths 390,1366`.

Chạy trên Chrome headless với server thật:

```bash
npm run build && npm start               # hoặc npm run dev (cổng 3000)
BASE_URL=http://localhost:3000 npm run test:e2e
```

Script đi qua toàn bộ luồng:
- Thầy thêm quà, thưởng điểm (kể cả khi vượt giới hạn), từ chối và trao quà.
- Học sinh xem thông báo điểm ở màn kết quả, chip điểm trên header, ghim quà mục tiêu, đổi và huỷ quà.

Script cũng kiểm tra:
- **Bố cục** ở các bề rộng 320 / 390 / 768 / 1366px: không tràn ngang, chip điểm không đè logo.
- **Lỗi JavaScript** trên trình duyệt.

Có thể đặt thêm:
- `CHROME_PATH`: đường dẫn tới Chrome, nếu không tự tìm thấy.
- `E2E_SHOTS`: thư mục lưu ảnh chụp.

## Đo chất lượng cắt câu tự động

```bash
node --no-experimental-strip-types -r ./tests/setup/register.cjs tests/tools/eval-anchors.ts [--json out.json]
```
Chạy bộ cắt câu trên mọi đề có PDF lời giải trong DB local, rồi báo tỉ lệ câu cắt được, các vùng bất thường và danh sách đề tệ nhất. Chạy trước và sau mỗi lần sửa thuật toán để chắc không đề nào bị giảm.

## Đo JS tải lần đầu

`BASE_URL=http://localhost:3057 node tests/tools/measure-js.mjs` — chạy trên bản build (`next build && next start -p 3057`), in tổng KB (raw/gzip) các `<script>` của từng trang; tự tạo và xoá một học sinh thử (DB local).
