# Review: question-split-ui — plan

> Reviewer: Gemini trên web (model **Neon**), 21/11/2026. Gói gửi đi: GEMINI.md + PLAN.md + `lib/pdf-question-anchors.ts`, `SolutionAnchorEditor.tsx`, `ResultReview.tsx`, `PdfRegionView.tsx`, `pdf-analysis-client.ts`, `eval-anchors.ts`.
> Dưới đây là phần tóm tắt các finding của Gemini, kèm kiểm chứng của Claude.

**Tóm tắt của Gemini:** Kế hoạch đi đúng hướng (đo bằng `eval-anchors.ts`, OCR ở phía giáo viên, giữ dữ liệu v1). Có ba vùng rủi ro lớn:
1. `after()` phân tích PDF và ghi DB phía server: có thể tràn RAM trên Heroku và ghi đè mốc thầy.
2. LIS chưa chặn theo ranh giới phần nên có thể ghép xuyên phần.
3. OCR dải trái 40% xén mất tiêu đề căn giữa; công cụ cắt tay chưa đặt được mốc "Lời giải".

| # | Finding | Mức | Claude kiểm chứng | Kế hoạch sau review |
|---|---|---|---|---|
| 1 | `after()` khi cả lớp mở kết quả cùng lúc: nhiều job tải và phân tích PDF song song (OOM), ghi trùng; job xong muộn ghi đè mốc thầy vừa lưu | HIGH | **Đúng**: không có khoá theo đề, ghi không có điều kiện | **Bỏ §1.4 (tự ghi phía server).** Mốc được lưu khi thầy bấm Lưu trong công cụ cắt tay, hoặc qua script hàng loạt (chạy có kiểm soát, chỉ ghi khi chưa có mốc) |
| 2 | LIS ghép xuyên phần (phần 1 câu 1–5 nối với câu 6–12 của phần 2); ngưỡng 60% quá lỏng với phần 4 câu | HIGH | **Đúng** | LIS chỉ chạy trong **một khối đợt đánh số liền nhau** dành cho phần đó (không vượt qua tiêu đề phần hoặc đợt đã gán cho phần khác). Phần ≤ 5 câu chỉ được thiếu tối đa 1; phần lớn hơn cần phủ ≥ 70% (nhãn số trần ≥ 85%). Thêm test cho đúng kịch bản Gemini nêu |
| 3 | OCR dải trái 40% xén mất tiêu đề căn giữa / dòng "Lời giải"; vẽ 1.5× hay rớt dấu; Node không có canvas | HIGH | **Đúng** | OCR **cả trang** ở 2×, so khớp **bỏ dấu** cho kết quả OCR. Script hàng loạt chạy qua **Chrome headless** (dùng chính công cụ cắt tay), không thêm canvas native |
| 4 | Công cụ cắt tay chưa chỉnh được mốc "Lời giải" (PDF ảnh → học sinh thấy luôn đáp án); bấm vào mốc và bấm vào nền dễ nhầm; tự sang câu sau theo `rows` thay vì `visibleRows`; thiếu Ctrl+S | MEDIUM | **Đúng** (`chainMode` dùng `rows`) | Thêm chế độ đặt mốc "Lời giải" (phím L); bấm vào mốc = chọn/kéo (có ngưỡng kéo), bấm vào nền = đặt mới; tự sang câu sau theo `visibleRows`; Ctrl+S để lưu |
| 5 | `sanitizeSolutionAnchors` sẽ xoá `algoVersion` / `method`; bộ nhớ đệm `pdf-analysis:v9` giữ kết quả phân tích cũ | MEDIUM | **Đúng** | Giữ hai trường này khi làm sạch dữ liệu; tăng khoá đệm lên v10, gắn với hằng `ANALYSIS_VERSION` |
| 6 | Việc nhỏ cho học sinh (câu chưa cắt, thanh dưới vỡ dòng) bị xếp muộn; kiểm thử toàn trang nên chạy sau khi làm lại giao diện | LOW | **Đúng** | Đổi thứ tự (xem PLAN.md §7) |
| Hỏi | `solutionAnchors` lưu ở đâu, có xung đột ghi không? | — | Cột Json trên bảng `Test` | Không còn ghi tự động (bỏ #1) nên không còn xung đột |
