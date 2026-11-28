# Nhạc nền "anime · thánh ca · Madoka" + bổ sung SFX — KẾ HOẠCH (28/11/2026)

Yêu cầu: "bổ sung sfx, nhạc nền nhỏ không lời cho phong cách anime, thánh ca, madoka".
Chỉ chạy cục bộ (không commit / push / deploy). Mọi giai điệu là sáng tác mới — chỉ học NGUYÊN TẮC (hợp xướng không lời,
organ, hộp nhạc, harpsichord, hoà âm điệu thức, cadence plagal "Amen"), không mô phỏng giai điệu có sẵn.

## 0. Hiện trạng (đã kiểm tra)
| Phần | Có gì | Thiếu |
|---|---|---|
| `components/world/audio/engine.ts` | 1 AudioContext, bus Nhạc (0,32·vol²) / Hiệu ứng (0,9·vol²), vang 3 đường trễ, limiter, VoicePool, ducking, công tắc chung `world.sfx`, `world.vol.music/sfx` | — |
| `musicDirector.ts` + `lib/world/music.ts` | nhạc **tạo sinh thời gian thực** (Composer Markov, kalimba / marimba / organ PeriodicWave…) cho hub, valley, expanse, impossible, paradox, babel, vault, torus, coast, bazaar | Mê cung Hoạ âm + phòng Học **không có nhạc**; âm sắc oscillator "điện tử", không có hợp xướng / dây / organ thật; tốn CPU (mỗi nốt vài oscillator + filter) |
| `combatLayer.ts` | trống + bass 112 BPM theo `MUSIC_KEY` | không khớp nhịp với nhạc vùng; không có lớp boss |
| `lib/world/sfx.ts` + `sfxKit.ts` | đòn theo nguyên tố, nhặt đồ, rương, levelUp, click, chime, fanfare (sóng vuông)… | không có: bước chân (chỉ `step()` khi nhảy / đào), té nước / bơi, hover UI, mở / đóng bảng, cổng dịch chuyển, boss xuất hiện, thua (gục), "Amen" hoàn thành nhiệm vụ; đặt / phá khối dùng `click` / `hit` chung |
| `AudioSettings.tsx` (menu ☰) | 2 thanh trượt Nhạc nền / Hiệu ứng, lưu localStorage | (đủ — giữ nguyên) |
| Mê cung Hoạ âm | `sirenSynth.ts` (SFX câu đố), `HARMONIC` 96 BPM (SirenDirector cập nhật mỗi khung từ `clock.elapsedTime`) | nhạc nền khoá nhịp 96 BPM |
| `studyAudio.ts` | mưa / lửa (AudioContext riêng) | nhạc rất nhỏ |
| `archive` | `lib/world/archiveLayout.ts` có, nhưng `SceneId` chưa có "archive" | — |

## 1. Hướng giải: nhạc RENDER SẴN (offline) + ghép câu trên lưới ô nhịp
Lý do: laptop Iris Xe nghẽn CPU — phát vài AudioBufferSourceNode gần như miễn phí so với tổng hợp hàng trăm oscillator;
âm sắc hợp xướng formant / organ / Karplus-Strong / vang nhà thờ convolution làm offline mới đẹp.

**Bộ render** `scripts/audio-render.py` (numpy + scipy, không sample / soundfont):
- Một "động cơ cộng hoạ âm có đường bao phổ": hợp xướng (formant a / o / u, 5 giọng / bè lệch ±8 cent, vibrato 5,3 Hz trễ,
  jitter, hơi thở), dây legato (răng cưa cộng + cộng hưởng thân đàn), organ (drawbar 8′ 4′ 2⅔′ 2′ + chiff + gió).
- Karplus-Strong bằng `scipy.signal.lfilter` (allpass chỉnh lẻ mẫu): harpsichord (2 dây 8′ + 4′), đàn hạc, pizzicato.
- Hộp nhạc (tine công-xôn: mode 1 · 5,4 · 2), celesta, chuông nhà thờ (hum 0,5 · prime 1 · tierce 1,19 · quint 1,5 · nominal 2…),
  sáo (sin + hơi thở + vibrato).
- Vang: IR tổng hợp stereo (nhiễu tắt dần, RT60 theo dải tần, phản xạ sớm) × `fftconvolve`; "hall" 2,2 s, "cathedral" 5,5 s, "far" (xa, lọc tối).
- Chuẩn hoá độ to (K-weighting BS.1770 đơn giản) về cùng mức, giới hạn đỉnh −1 dBFS.
- Xuất WAV trung gian vào `blender-src/audio-src/` (gitignore) → ffmpeg: **Opus 32 kbps** (`.ogg`) + **AAC 48 kbps** (`.m4a`, cho Safari cũ).
- Sinh manifest TS `lib/world/musicTracks.ts` (tempo, số ô nhịp, hợp âm từng ô → `MUSIC_KEY`, danh sách file).

**Cấu trúc một bản** (lặp dài không lộ):
- `bed`: tiến trình P ô nhịp (8) — phát lại mỗi P ô, đuôi vang chồng lên lần kế (file one-shot có đuôi, không cần nối vòng mẫu).
- `cells`: câu giai điệu S ô nhịp (4) viết cho từng khe (khe 0 = ô 1–4, khe 1 = ô 5–8), 2–3 biến thể / khe + xác suất nghỉ →
  bộ lập lịch chọn ngẫu nhiên (không lặp liền biến thể vừa chơi). 8 ô × (3 khả năng)² ⇒ chu kỳ cảm nhận vài phút.
- `alt` (lớp dọc, tuỳ bản): Siren `bedDis` (bất hoà) trộn theo `HARMONIC.dissonance`; `boss` trộn khi có boss.
- Stinger (bus Hiệu ứng): `amen` (IV–I, "ah → oo"), `bossReveal`, `victory`, `defeat`, `portal` — gộp một file sprite.

**Bảng bản nhạc**
| id | Cảnh | Nhịp | Màu |
|---|---|---|---|
| hubDay | hub (ngày) | 3/4, 84 | đồng quê anime: đàn hạc rải, celesta, dây legato, sáo, hợp xướng "oo" nhẹ — Rê trưởng |
| hubNight | hub (đêm) | 3/4, 66 | hộp nhạc, đàn hạc, hợp xướng "oo", dây — Si thứ (cùng tập nốt) |
| impossible | impossible | 4/4, 60 | thánh ca: organ + hợp xướng SATB, cadence plagal, chant đơn âm, chuông xa, vang nhà thờ 5,5 s — Mi Aeolian, Picardy |
| siren | siren | 4/4, **96** | Madoka-ish: hộp nhạc + harpsichord ostinato + hợp xướng + pizz, Đô thứ ↔ Đô trưởng; `bedDis` lệch dây / cắt dán; glitch 1 ô nhịp |
| boss | đấu boss (Vùng Kỳ quan) | 4/4, 112 | hợp xướng mạnh + dây spiccato + organ pedal + timpani — Rê thứ |
| sirenBoss | lớp dọc trong siren | 96 | hợp xướng + dây dồn dập cùng tiến trình siren |
| expDay / expNight | expanse | 4/4, 80 / 64 | yên bình: pizz + dây + sáo + đàn hạc / celesta + dây + "oo" + chuông xa |
| archive | archive (nếu có) | tự do ~50 | drone organ trầm + không khí + hợp xướng rất xa, thưa |
| study | study | 4/4, 70 | rất nhỏ: hộp nhạc + harmonium + dây mềm (ru) |

Vùng khác (valley, paradox, babel, vault, torus, coast, bazaar) giữ nhạc tạo sinh như cũ.

## 2. Thời gian chạy
- `lib/world/musicStems.ts` (THUẦN, test): `selectTrack(scene, {night, boss})`, bộ lập lịch câu `CellPlanner`
  (khe / biến thể / nghỉ, không lặp liền, tất định theo seed), lưới ô nhịp (`barTime`, `nextBarAt`), ánh xạ đồng hồ
  HARMONIC → AudioContext (`ClockAnchor`: EMA + nhảy khi lệch > 120 ms), đường crossfade (equal-power), trộn lớp theo tham số.
- `components/world/audio/stemPlayer.ts`: tải lười (fetch → `decodeAudioData` trên OfflineAudioContext 32 kHz để giảm ½ bộ nhớ),
  bộ nhớ đệm LRU 3 bản, tick 100 ms nhìn trước 1,2 s, mỗi lớp một GainNode; cập nhật `MUSIC_KEY` theo hợp âm ô nhịp đang phát
  (SFX có cao độ vẫn hợp với nhạc); Siren: lịch theo HARMONIC (bù `outputLatency`), lọc thông thấp theo `decomposition`,
  glitch xác suất ∝ `dissonance`.
- `musicDirector.ts`: cảnh có bản render → StemPlayer, còn lại → ZonePlayer cũ; đổi vùng crossfade 3 s ra / 3,5 s vào;
  ngày ↔ đêm, boss ↔ thường: chuyển ở ranh giới ô nhịp (2 s).
- `combatLayer.ts`: khoá vào lưới ô nhịp của bản đang phát; im khi bản boss đang chạy (bản boss đã có bộ gõ).
- Mức: bus nhạc giữ 0,32·vol², bản render chuẩn hoá ≈ −20 LUFS rồi nhân `level` từng bản (0,5–0,8) ⇒ "nhỏ"; ducking cũ giữ nguyên.
- Tắt / âm lượng nhạc 0 / tab ẩn: dừng bộ lập lịch, nhả nguồn (không tốn CPU).

## 3. SFX bổ sung
| Sự kiện | Cách móc | Âm |
|---|---|---|
| bước chân theo mặt (cỏ / đá / gỗ / giấy / cát / tuyết / khối voxel) | `foley.ts` đọc `player` + `motion` mỗi 50 ms (không sửa combat) | nhiễu lọc + "gót" ngắn, ngẫu nhiên ±, sải 0,75 / 1,05 m |
| té nước khi xuống nước, sải bơi, tiếp đất | `foley.ts` (chuyển trạng thái `motion.swimming`, `grounded`) | nhiễu + bong bóng |
| hover / mở bảng / đóng bảng (back) | `foley.ts`: uỷ quyền `pointerover` trên `.w-hud`, đăng ký `overlay` | celesta rất nhỏ, giới hạn 1 / 70 ms |
| đặt / phá khối theo vật liệu | `sfx.block(kind, id)` — 2 dòng ở `BlockInteractor.tsx` | gỗ / đá / đất / cát / thuỷ tinh / lá |
| cổng dịch chuyển | đăng ký `useTransit.travelTo` | stinger `portal` (đàn hạc lướt + "ah") |
| hoàn thành nhiệm vụ / thăng cấp | `kit.levelUp` → stinger `amen` (+ chuông cũ nếu chưa tải) | IV–I hợp xướng |
| boss xuất hiện | đăng ký `bossStore.useBossUi.on` + Siren `useBossUi.on` | `bossReveal` |
| thắng | `sfx.fanfare` → `victory` (fallback sóng vuông cũ) | hợp xướng + dây + chuông |
| gục (thua) | đăng ký `useCombat.downUntil` | `defeat` |
| strike() VFX | móc tuỳ chọn 2 dòng trong `StrikeFx.strike` → `strikeSound(shape, r)` ở cao trào | rất nhỏ, theo nhóm hình |

## 4. Kiểm thử
- `tests/world/musicStems.test.ts`: chọn bản theo cảnh / đêm / boss; planner không lặp liền + tỉ lệ nghỉ; lưới ô nhịp;
  ClockAnchor bám HARMONIC (trôi, nhảy); crossfade equal-power; manifest hợp lệ (file tồn tại, hợp âm đủ ô).
- `tests/world/foley.test.ts` (logic thuần `lib/world/foleyLogic.ts`): bộ đếm sải, mặt theo cảnh / khối.
- Trình duyệt: `/world/preview?p=b1`, `__go(scene)`, `__audio()` (bản, lớp, ô nhịp, bộ đệm); `__perf` CPU trước / sau.

## 5. Rủi ro
- Safari < 17 không giải mã Opus → tự chuyển `.m4a`.
- Bộ nhớ giải mã: ~15 MB / bản ở 32 kHz; LRU 3 bản.
- Trôi đồng hồ Siren: lịch theo từng câu (≤ 20 s), neo lại liên tục.
- Dung lượng: mục tiêu ≤ ~6 MB tổng (Opus + AAC).

## 6. Trạng thái (28/11/2026)
**Đã nối vào game**
- `components/world/audio/stemPlayer.ts`: tải lười theo bản (Opus → AAC dự phòng, giải mã 32 kHz, LRU 3 bản), ghép câu
  (`CellPlanner`), crossfade đổi vùng (3 s; vào bản boss 1,5 s), lớp dọc dissonance / boss, Mê cung khoá HARMONIC
  (`ClockAnchor`, bù outputLatency, chỉ lấy mẫu khi khung mới), decomposition → lọc thông thấp, dissonance → glitch,
  `MUSIC_KEY` theo hợp âm từng ô. Thiếu file / giải mã lỗi → bản đó đánh dấu lỗi, quay về nhạc tạo sinh cũ; không ném lỗi.
- `musicDirector.ts`: cảnh có bản render → StemPlayer (nhạc oscillator dừng), còn lại → ZonePlayer cũ. Tôn trọng thanh trượt Nhạc,
  công tắc chung, tab ẩn (dùng lại engine). `musicGrid()`; combatLayer im khi bản boss đang chạy.
- `ZoneMusic.tsx`: mỗi giây gửi night (hub / expanse), boss (bossStore.on, mode ≠ dead), fight (Mê cung: trong đấu trường).
- Stinger: amen ← `sfx.levelUp` (hoàn thành nhiệm vụ), victory ← `sfx.fanfare`, defeat ← `useCombat.downUntil`,
  bossReveal ← bossStore.on / vào đấu trường Mê cung, portal ← `useTransit.travelTo`. Dịch giọng về chủ âm đang phát, nhạc hạ 6 dB.
- SFX mới (`lib/world/sfx.ts` + `worldEvents.ts` + `lib/world/foleyLogic.ts`): bước chân theo mặt, tiếp đất, té nước, sải bơi,
  hover / mở / đóng bảng, `sfx.block` đặt / phá theo vật liệu (2 dòng ở BlockInteractor), `sfx.strike` rất nhỏ ở cao trào (1 dòng ở StrikeFx, bỏ qua muzzle).
- Test `tests/world/musicStems.test.ts` (8 test). Kiểm CDP headless: hub / impossible / siren / archive tải đủ file .ogg (0 lỗi),
  nhạc tạo sinh dừng, không lỗi JS.

**Còn lại**
- Đo CPU thật (headless SwiftShader 0,6 fps nên `__perf` vô nghĩa) — đo trên Chrome thật; nghe thử 15 phút, chỉnh `level` từng bản.
- combatLayer chưa khoá lưới nhịp của bản render (chỉ im khi boss).
- Dung lượng 9,4 MB (ngân sách đã nâng lên 50 MB).
