# Âm thanh & nhạc nền — A1 / T14 (27/11/2026)

Toàn bộ âm thanh tạo bằng WebAudio lúc chạy: không file nhạc, không AudioWorklet (chạy được iOS Safari, Chromebook yếu).
Nghiên cứu bằng Codex CLI (`codex --search exec`, có nguồn); bản đầy đủ lưu ở scratchpad phiên, dưới đây là các điểm chính đã áp dụng.

## 1. Bài học từ nhạc game thích ứng

| Game | Kỹ thuật | Áp dụng ở đây |
|---|---|---|
| Journey (Austin Wintory) | một động cơ đại diện người chơi, đổi câu ở ranh giới cadence (horizontal re-sequencing) | `Composer`: động cơ A → A′ → B → A″, cadence vào âm hợp âm |
| Genshin Impact (HOYO-MiX) | mỗi vùng một bảng màu; ngày / đêm giữ động cơ, đổi phối khí & mật độ | Quảng trường: ngày Rê trưởng ngũ cung (kalimba, pad ấm) ↔ đêm Si thứ ngũ cung (hộp nhạc, pad không khí, dế) — cùng tập nốt nên đổi không vấp |
| No Man's Sky (Pulse, 65daysofstatic) | sinh từ chất liệu có tác giả: rút thăm có trọng số ở ranh giới câu, Markov trong câu | Markov theo bước (ưu tiên ±1, ±2), đồ thị hợp âm chức năng, luật cadence |
| Tetris Effect | hành động người chơi hoà vào bản nhạc | âm có cao độ (nhặt đồ, rương, thăng cấp, khoá phép, glint chí mạng) lấy nốt từ hợp âm đang chơi |
| Sky: Children of the Light | chỉnh cao độ hiệu ứng theo khoá nhạc lúc chạy | `MUSIC_KEY` (sfxKit) do bộ điều phối nhạc cập nhật mỗi câu |
| Brian Eno (Music for Airports) | các vòng lặp dài lệch nhau, tổ hợp không lặp | 3 dòng "chuông xa" chu kỳ 23 / 29 / 37 s (`enoOnsets`) |
| Proteus | cảnh quan điều khiển mật độ | (chưa làm — xem "Còn lại") |

## 2. Luật để nhạc nghe lâu không mệt
- 60–80 BPM, 1–3 lớp, **4–10 nốt nổi / 10 s** (đo bằng test: Quảng trường ngày 5,5; đêm 3,8; Babel 8,7; Hư Không 0,9).
- Lặng 40–60 % ô giai điệu; câu "nghỉ" (giai điệu lặng) sau mỗi vòng; câu "im hẳn" (cả nền tắt) ~mỗi 1–2 phút.
- Mỗi lần trở lại động cơ chỉ đổi MỘT đặc điểm (chuyển bậc, đảo, ngược, giãn, láy, thưa, lệch phách); 2 vòng sinh động cơ mới.
- Crossfade đổi vùng 3–6 s (ở đây: cũ tắt 3 s, mới vào sau 0,8 s, lên 3,5 s).
- Mức: master ~−24 LUFS, nhạc thấp hơn hiệu ứng ~10 dB (bus nhạc 0,32 × vol², hiệu ứng 0,9 × vol²), limiter cuối.

## 3. Bản sắc từng vùng (`lib/world/music.ts` ZONES)
| Vùng | Ý toán / lý | Âm |
|---|---|---|
| Quảng trường | ngũ cung ấm, giờ thật ngày ↔ đêm (`DAY.night` hoặc giờ VN) | kalimba / hộp nhạc, pad, bass, dế ban đêm |
| Thung lũng Hàm số | Lydian sáng | marimba |
| Expanse | thiên nhiên | sáo (rung + hơi thở), chim, gió nền (LFO 0,05 Hz) |
| Bất Khả | cầu thang Escher / Penrose: **hợp âm Shepard** — mỗi hợp âm lên một cung nguyên, các thành phần trượt lên 2 nửa cung suốt hợp âm, phổ chuông log-tần (đỉnh ~620 Hz) nên "lên mãi" | thang toàn cung, thuỷ tinh |
| Hư Không / Paradox | **chuỗi hoạ âm** n·f₀ (n = 6…16, có hoạ âm 7, 11, 13 lệch 12-TET), drone chủ âm + quãng năm lệch nhẹ (phách 0,1–0,3 Hz) + "gió vũ trụ" | chuông đúc |
| Thư viện Babel | **dãy số → bậc thang**: π, Fibonacci mod 7 (chu kỳ Pisano 16), số nguyên tố, Collatz(27), Recamán; lament bass đi xuống | harpsichord (PeriodicWave dây gảy ở 1/7: hoạ âm bội 7 khuyết), giọt nước |
| Hầm Bổ đề (vault, sắp có) | Aeolian trầm | chuông, organ |
| Mê cung Hoạ âm / phòng Học | đã có âm riêng | không nhạc nền |

## 4. WebAudio hiệu năng
- MỘT AudioContext (`components/world/audio/engine.ts`), Mê cung Hoạ âm cũng dùng chung và nối vào bus Hiệu ứng.
- Lập lịch theo đồng hồ audio: tick 50 ms, nhìn trước 0,25 s; soạn trước 1,5 s; tab ẩn → `suspend`, hiện lại → bỏ sự kiện quá hạn, neo lại mốc.
- Một bộ đệm nhiễu 2 s phát từ vị trí ngẫu nhiên (trước đây mỗi tiếng nhiễu tạo bộ đệm mới); PeriodicWave lưu sẵn; mọi nút `disconnect` khi `onended`.
- Vang chung: 3 đường trễ hồi tiếp 89 / 119 / 143 ms, hệ số 0,44–0,5, lọc thông thấp 3,2 kHz trong vòng (không ConvolverNode).
- Chỉ tạo / resume ngữ cảnh trong sự kiện người dùng (pointerdown / keydown / touchend); công tắc chung tắt → master về 0 rồi `suspend`; âm lượng nhạc 0 → dừng hẳn bộ lập lịch.

## 5. SFX chiến đấu "đã tai" (`components/world/audio/sfxKit.ts`, `lib/world/musicVoices.ts`)
- Lớp: transient 5–15 ms (nhiễu lọc dải 2–7 kHz) + body 40–200 ms (dao động trượt tần / mode kim loại, thuỷ tinh) + tail 100–500 ms (vang + lớp nguyên tố).
- Chí mạng: glint hợp âm sau 20 ms, thấp hơn ~6 dB; sub 62 → 34 Hz; duck nhạc.
- Biến thiên: thân ±45 cent, tâm lọc ±12 %, âm lượng ±1,5 dB, vị trí nhiễu ngẫu nhiên.
- Nguyên tố: kiếm = thép, cung = gió, trượng = sóng, đòn bẩy = đất, con lắc = thời gian (tích tắc), cuộn cảm = sét, xoắn = thiên nhiên, lăng kính = ánh sáng; phép: vòng = băng (khiên pha lê), zigzag = sét, xoắn = hư không (hút), parabol = lửa, sin = sóng.
- Giới hạn giọng theo nhóm (hit 6, swing 3, spell 4, impact 3, move 3, ui 3, ambient 4; tổng hiệu ứng 20; nhạc 12), cướp giọng cũ nhất / ưu tiên thấp, tắt nhanh 6 ms; gộp đòn trùng trong 35 ms (1/√k, tối đa 3).
- Ducking nhạc: 3–5 dB, attack 8 ms, giữ 40 ms, nhả 200 ms, kẹp 6 dB.
- Đồng bộ khung hình: âm gọi ĐÚNG chỗ VFX (damageEnemy cạnh `emitHit`, castSpell cạnh `addFx`, meteorImpact / lỗ đen sập / tuyệt kỹ cạnh `emitBurst` / `burst`), khựng hình chỉ dừng hình, âm vẫn chạy.

## 6. Còn lại
- Lớp nhạc chiến đấu (vertical layering: bass xung + bộ gõ vào ở phách kế khi có quái, rút sau 3 s yên).
- Proteus: mật độ / lớp theo vị trí (gần đài phun, cây, mốc toán học) + vị trí 3D (PannerNode) cho đòn ở xa.
- Đo LUFS thực tế trên iPhone / Chromebook, nghe 30 phút để chỉnh mức từng vùng.
- Âm báo trước đòn quái (sound tell — SPELLS_ECOLOGY) và Doppler Lance.
