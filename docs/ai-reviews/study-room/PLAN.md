# Phòng "Học cùng nhau" (Study with me) — kế hoạch + nghiên cứu

## Nghiên cứu (Codex CLI có tìm web, 27/11/2026)
- Pomodoro / time-boxing: chưa có nhịp "tối ưu"; 25/5, Flowtime, nghỉ tự chọn cho kết quả tương đương (Biwer et al., BJEP doi:10.1111/bjep.12593; Smits et al. 2025, PubMed 40723645). → mặc định 25/5, thêm 15/3 (người mới) và 50/10 (học sâu).
- Mục tiêu cụ thể + tự kiểm cuối phiên có bằng chứng tốt nhất (meta-analysis theo dõi mục tiêu, PubMed 26479070; if–then planning ở trẻ em, doi:10.1111/BJOP.70065). → ô "mục tiêu phiên", hỏi "đã xong chưa?" khi hết khối học.
- Body doubling / co-presence: giúp bắt đầu, nhưng người thật ngồi cạnh có thể gây áp lực; video study-with-me ít áp lực hơn (Zajonc meta-analysis PubMed 6356198; CHI 2021 study-with-me). → hiện diện nhẹ: avatar ngồi + đếm người, không chat, không camera.
- Âm thanh: lời bài hát làm giảm đọc hiểu; nhiễu trắng/hồng chỉ giúp nhẹ nhóm khó tập trung (PMC11283987; doi:10.5334/joc.273). → âm nền mưa / lửa tự tạo, MẶC ĐỊNH TẮT, mức nhỏ.
- Nghỉ chủ động (vươn vai, đi lại), 20-20-20 chỉ nên là gợi ý (doi:10.1371/journal.pone.0272460). Ôn cách quãng 1·3·7 ngày.
- Sản phẩm: Focusmate (nói mục tiêu → làm → báo lại), Study Together/StudyStream (đồng hồ chung, phòng im lặng), Lofi Girl (cảnh ổn định), Forest (một hình ảnh tiến bộ yên tĩnh).
- Mobile: gộp hình theo vật liệu, instancing, CanvasTexture chỉ cập nhật khi đổi chữ, đóng băng chuyển động trang trí khi tập trung, âm thanh dùng bộ đệm lặp (không tổng hợp liên tục).

## Thiết kế
- Gác thư viện 14 × 13 m, hoàng hôn mưa ngoài hai cửa sổ cao; tường chính (bắc, đối diện cửa) có tấm "Lời thề" (bản đầy đủ người dùng gửi, nguyên văn); tường nam quanh cửa: 5 tấm "Ta sẽ vì chân lý mà đấu tranh!" (nguyên văn); tường đông / tây: 6 bảng danh ngôn (đã kiểm chứng nguồn) đổi theo giờ thực.
- 6 bàn × 2 ghế; F để ngồi (Sitting_Idle_Loop), bước đi / F để đứng.
- Đồng hồ chung theo giờ thực (25/5, mốc :00/:30) → đồng bộ cả phòng KHÔNG cần đổi giao thức; đồng hồ riêng tuỳ chọn.
- Chế độ tập trung: ẩn HUD, máy quay sát vai, mưa / lửa chậm lại, bảng danh ngôn đứng yên.
- Thống kê cục bộ (localStorage), gợi ý ôn lại.

## File
lib/world/studyRoom.ts · studyTimer.ts · studyStats.ts · studyQuotes.ts · tests/world/study.test.ts ·
components/world/scene/study/* · components/world/ui/StudyPanel.tsx
