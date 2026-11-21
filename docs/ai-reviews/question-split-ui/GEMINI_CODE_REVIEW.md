# Gemini (web, model Neon) — review diff question-split-ui + giao diện học sinh

Ngày 2026-11-21. Đầu vào: `scripts/ai-review.sh diff question-split-ui 89a7bcf` (337 KB, gồm cả 3 commit giao diện học sinh a979eb7, 7808e18, ac70a9e).
Báo cáo là **dữ liệu**; mọi finding đã được Claude kiểm chứng với code thật.

## Tóm tắt báo cáo của Gemini

1. **[Cao]** `lib/pdf-question-anchors.ts` (bước 3b, khe giữa các phần khớp chính xác): đề 2 phần × 12 câu, phần 1 chỉ có nhãn 1–5, phần 2 có 1–11 → không phần nào khớp chính xác, cả hai rơi vào cùng một khe với khối [1..5], [1..11]. Vòng lặp tham lam cho phần 1 bỏ qua khối [1..5] (5/12 < 70%) và lấy khối [1..11] (11/12) → **lời giải phần 2 bị gán cho phần 1**, phần 2 trống. Test cũ không bắt được vì phần 2 trong test đủ 12/12 nhãn.
2. **[Trung bình]** `SolutionAnchorEditor.tsx`: `commit/undo/redo` sửa `undoRef/redoRef` bên trong hàm cập nhật của `setData` → StrictMode (dev) gọi 2 lần làm hỏng lịch sử; `undo/redo` khi stack rỗng vẫn `setDirty(true)`.
3. **[Trung bình]** `END_MARK_REGEX` khớp dòng "Đáp án:" đứng riêng → PDF trình bày "Câu 1 … / Đáp án: / Chọn A. Vì …" bị cắt cụt ngay trước lời giải.
4. **[Trung bình]** OCR không bị huỷ khi giáo viên rời trang → worker chạy ngầm hết các trang, vẫn bắn toast.
5. **[Thấp]** `redetect()` ghi `method` về "text" sau khi đã OCR.
6. **[Thấp]** `pdf-viewer.tsx`: kéo nhãn mốc bị kẹt nếu có `pointercancel`.
7. **[Thấp]** `HomePromo.tsx`: `new Date("2027-06-11T08:00:00")` thiếu múi giờ +07:00.

Câu hỏi: `actions/solution-anchors.ts` có gọi `sanitizeSolutionAnchors` và kiểm tra quyền + `demoGuard` không?

## Claude kiểm chứng

| # | Finding | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Ghép xuyên phần khi cả hai phần thiếu nhãn | **Đúng** — tái hiện được bằng unit test (trượt với code cũ) | Thay vòng lặp tham lam bằng `alignGapBlocks`: quy hoạch động ghép khối ↔ phần theo thứ tự; một phần được "nhận" khối của mình dù không đủ ngưỡng LIS (để phần trước không nhảy sang khối của phần sau), bỏ qua khối bị trừ điểm. Phần nhận khối thiếu nhãn được bước dự phòng ghép theo đúng số. Test hồi quy: "KHÔNG ghép xuyên phần khi cả hai phần đều thiếu nhãn" + "khối nhiễu ngắn trước khối thật vẫn bị bỏ qua". Eval 83 đề: 76,3% như cũ, 0 sai thứ tự |
| 2 | Hàm cập nhật state không thuần | **Đúng** (E2E không bắt được vì đẩy trùng rồi lấy trùng triệt tiêu nhau) | Gộp dữ liệu + lịch sử vào một state `{data, past, future}`, hàm cập nhật thuần; `undo/redo` không làm gì khi stack rỗng. E2E Ctrl+Z / Ctrl+Shift+Z vẫn đạt |
| 3 | "Đáp án:" bị coi là ranh giới | **Đúng** | Bỏ "đáp án" thường khỏi `END_MARK_REGEX`; chỉ nhận "ĐÁP ÁN" VIẾT HOA không có dấu ":" (tiêu đề cuối đề), giữ "BẢNG ĐÁP ÁN", "HẾT". Test: `isHeadingLine("Đáp án:")`/`("Đáp án")` = false; vùng câu có dòng "Đáp án:" không bị cắt |
| 4 | OCR không huỷ khi rời trang | **Đúng** | `useEffect` dọn dẹp gọi `abort()`; bỏ cập nhật state/toast sau khi đã rời trang |
| 5 | `redetect` ghi sai `method` | **Đúng** | Truyền `usedOcr ? "ocr" : "text"` |
| 6 | Kẹt kéo khi `pointercancel` | **Đúng** | Thêm `onPointerCancel` → huỷ kéo |
| 7 | Ngày thi thiếu múi giờ | **Đúng một phần**: đếm ngược chỉ tính ở trình duyệt (state ban đầu = 0), nên chỉ lệch với máy không ở giờ VN | Đổi sang `"2027-06-11T08:00:00+07:00"` |
| Hỏi | Quyền khi lưu mốc | Đã kiểm tra: `actions/solution-anchors.ts` có `demoGuard`, chỉ TEACHER/ADMIN, gọi `sanitizeSolutionAnchors` (giữ `algoVersion`, `method`) | Không cần sửa |
