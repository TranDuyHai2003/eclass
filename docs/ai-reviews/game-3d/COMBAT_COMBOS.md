# Thế võ — chuỗi đòn, nhịp hoàn hảo, né hoàn hảo (27/11/2026)

## Vấn đề
- Đánh liên tục "không có gì xảy ra":
  - Trên máy tính, chuột trái chỉ đánh khi chuột đã bị khoá vào game (pointer lock). Nếu chưa khoá được, hoặc vừa nhấn Esc (Chrome từ chối khoá lại khoảng 1 giây), mọi cú bấm đều bị bỏ.
  - Bấm trong lúc đòn trước đang vung (thời gian hồi `cd` 340 ms) bị nuốt hẳn, không có hàng chờ lệnh.
  - Mọi nhát dùng chung một clip `Sword_Attack`, nên trông như đứng im.
- Nút tấn công trên điện thoại: giữ nút là tự bấm 120 ms một lần, nghĩa là chỉ cần giữ, không cần kỹ năng.
- Mọi vũ khí có đúng 1 kiểu đánh; E và Q dùng chung cho mọi vũ khí.

## Thiết kế (theo Genshin / Honkai Impact 3rd)
- **Điều khiển máy tính:**
  - Chuột trái: đánh thường. Giữ ≥ 0,38 s: đòn tụ lực.
  - Shift hoặc chuột phải: né. Riêng cung, chuột phải là ngắm.
  - E: kỹ năng riêng của vũ khí. Q: tuyệt kỹ. Space: nhảy. Chuột trái khi đang trên không: bổ nhào.
- **Điều khiển điện thoại:** nút đánh nhận cả nhấn và giữ; thêm nút né.
- **Chuỗi đòn riêng cho từng vũ khí** (3–5 nhát, đều là clip thật của UAL1 + UAL2):
  - Mỗi nhát có 4 phần: khởi động → **khung trúng** (thời điểm lấy từ động học thuận của clip, `clip_peaks.py`) → cửa sổ nối → thu thế.
  - Nhát chém được tính đúng lúc lưỡi vũ khí tới, kèm lao tới vài chục cm.
- **Nhịp hoàn hảo:**
  - Bấm nhát kế trong khoảng 60–260 ms ngay sau khung trúng (vũ khí loé sáng làm tín hiệu) thì được ×1,35 sát thương, nhát sau nhanh hơn và cộng 1 nhịp.
  - Từ 3 nhịp trở lên, nhát kết được cường hoá.
  - Bấm sớm: đòn được xếp hàng (tối đa 1), nhưng không tính nhịp.
  - Bấm từ 3 lần trở lên trong một nhát thì bị "loạn nhịp": mất chuỗi nhịp.
  - Bấm trễ hơn khi hết đòn 350 ms: chuỗi quay về nhát 1.
- **Né:**
  - Bất tử 280 ms, tốn 18 thể lực.
  - Chỉ huỷ được đòn ở pha thu thế, không huỷ được lúc đang khởi động: phải chọn đúng lúc.
  - **Né hoàn hảo** (né trong 220 ms trước khi đòn quái trúng): "Khúc xạ thời gian" 2,2 s, quái chậm còn 25%, nhát kế chắc chắn chí mạng.
- **Thể lực:** 100 điểm, hồi 30/s. Né tốn 18, tụ lực tốn 22.
- **HUD:** thanh thể lực; đếm combo + số nhịp; chữ đánh giá (Hoàn hảo / Loạn nhịp / Né hoàn hảo).

## Code
- `lib/world/combo.ts` (thuần, có test): bộ đòn, mốc thời gian của từng nhát, hàm chấm nhịp.
- `components/world/combat/combat.ts`: máy trạng thái, gồm `attackDown/Up`, `dodge`, `tickCombat`, thực thi hình dạng đòn đánh, Khúc xạ thời gian.
- `player/retarget.ts`: nạp thêm `anim/ual2.glb` (23 clip chiến đấu UAL2, CC0, đã lọc bằng `prune_anim.py`).
- `Avatar`: phát đúng clip, đúng điểm bắt đầu và tốc độ cho từng nhát.
