# Nghe thử nhạc nền render sẵn

Bản nghe thử ~1 phút (mô phỏng bộ ghép câu lúc chạy), mở bằng trình phát bất kỳ / kéo vào Chrome:
`blender-src/audio-src/preview/<id>_demo.ogg` (máy local, gitignore). Tạo lại: `python scripts/audio-render.py`.

| File | Mô tả |
|---|---|
| hubDay_demo.ogg | Quảng trường ngày — Rê trưởng 3/4, đàn hạc rải, dây, "oo" nhẹ, sáo / celesta |
| hubNight_demo.ogg | Quảng trường đêm — Si thứ 3/4, đàn hạc chậm, hộp nhạc, "oo" rất nhỏ |
| impossible_demo.ogg | Thế giới Bất Khả — organ + hợp xướng SATB, chant đơn âm, chuông xa, plagal iv→I Picardy, vang nhà thờ |
| siren_demo.ogg | Mê cung Hoạ âm — 96 BPM, harpsichord + hộp nhạc + hợp xướng; bất hoà tăng dần, lớp boss, glitch cắt dán |
| boss_demo.ogg | Đấu boss — Rê thứ 112 BPM, dây spiccato, timpani, hợp xướng "ah" |
| expDay_demo.ogg / expNight_demo.ogg | Vùng Mở rộng ngày (Sol trưởng, pizz + đàn hạc + sáo) / đêm (Mi thứ, celesta + hộp nhạc) |
| archive_demo.ogg | Kho Lưu trữ — drone organ trầm, không khí, hợp xướng rất xa |
| study_demo.ogg | Phòng Học — harmonium + đàn hạc mềm + hộp nhạc, rất nhỏ |

Stem thật (Opus / AAC): `public/world/audio/<id>_<bed|c0a|c0b|c1a|c1b|dis|boss|g0..g2>.ogg|.m4a`; stinger: `stingers.ogg` (offset trong `lib/world/musicTracks.ts`).
