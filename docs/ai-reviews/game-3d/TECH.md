# Math World — Engineering notes (26/11/2026)

Nguồn: agent nghiên cứu kỹ thuật (đo trực tiếp asset trong repo) + đo FPS trên Chrome desktop.

## Hiện trạng đo được
- Desktop (Chrome, dpr 1,25): sảnh 60 fps; Vùng Kỳ quan 58–60 fps sau khi stream xong, khung tệ nhất ~106 ms lúc sinh chunk (đã chia 2 chunk/khung).
- VRM gốc: tới 4× 4096² + 5× 2048² texture → ~470 MB GPU/nhân vật (ước tính trần). **Đã xử lý**: `scripts/world-shrink-vrm.py` hạ mọi texture ≤1024² (giữ nguyên metadata VRM 0.x): 236 MB → 108 MB trên đĩa, GPU ~÷16.
- Morph target 56–410/nhân vật, 17–125 primitive (draw call) → cần xuất lại từ VRoid (giảm material/blendshape, atlas) khi có file nguồn.

## Ngân sách mục tiêu
Draw call ≤120 (low) / ≤250 (desktop) · tam giác 150–250k (low), nhân vật chính ≤30k, NPC ≤15k · texture GPU ≤150 MB (low) · không cấp phát trong `useFrame`.

## Đã áp dụng
- Mức chất lượng low/mid/high theo thiết bị + `PerformanceMonitor` (bỏ qua 8 s đầu mỗi cảnh).
- Không dùng shadow map; bóng mờ vẽ trong shader mặt đất / quad.
- Bloom chỉ cho vật HDR (ngưỡng 1.0) + SMAA + chỉnh màu; low tier tắt hậu kỳ.
- Bỏ mây volumetric (panorama vẽ tay thay thế); NPC VRM tắt ở low.
- Vùng Kỳ quan: chunk 32 m, bán kính 1/2/3 theo mức, 2 chunk/khung, cây = 2 InstancedMesh.

## Việc tiếp theo (ưu tiên)
1. Tắt `castShadow`/outline MToon cho NPC; cull theo khoảng cách ở gốc nhân vật; `vrm.update` 15–30 Hz cho NPC xa; `VRMUtils.deepDispose` khi rời zone; bỏ cache dùng chung một instance khi cần 2 NPC cùng file.
2. Xoá cấp phát trong `useFrame` (Hub: vector hướng đi / máy quay; Effects: tia).
3. `gl.compileAsync(scene, camera)` sau khi tải zone (tránh giật lần đầu); xử lý `webglcontextlost` (iOS).
4. Asset: gltf-transform `optimize --compress meshopt --texture-compress ktx2 --texture-size 1024` cho glTF tĩnh; animation giữ tên node (`--join false --flatten false`). VRM: chuyển VRM 1.0 + vrm-transform (prune morph targets, combine skins, KTX2) — kiểm tra MToon + KTX2 trên một nhân vật trước.
5. Asset nặng lên CDN (B2/R2), URL có hash + `Cache-Control: immutable`, service worker cache-first.
6. ECS khi > ~100 sinh vật mô phỏng hoặc khi có multiplayer: **koota** (pmndrs); bitECS chỉ cho mô phỏng headless > 10k thực thể.
7. Va chạm / nhân vật: BVHEcctrl (three-mesh-bvh, không WASM, có joystick) — bọc sau interface riêng (thư viện còn 0.0.x).
8. Giữ WebGLRenderer (WebGPU chỉ có từ iOS 26; shader tự viết phải viết lại bằng TSL).

## Multiplayer (giai đoạn sau)
- Giai đoạn 1 (bất đồng bộ): server actions + Postgres (bóng ma, bảng xếp hạng, phát hiện chung).
- Giai đoạn 2: **Colyseus** app riêng trên 1 dyno lớn (1 phòng = 1 kênh ~40 người), delta 10–15 Hz, nội suy snapshot ~200–300 ms, ping 20–25 s (Heroku cắt WebSocket im lặng 55 s), token ngắn hạn từ session Next; phòng **không bao giờ** cấp xu/XP — phần thưởng chỉ qua server action + DB. Phương án 2: Cloudflare Durable Objects.

## Rủi ro
Bộ nhớ iOS (kiểm tra trên iPhone cũ thật) · công cụ VRM 0.x mong manh · dung lượng slug Heroku (chuyển CDN) · thư viện trẻ (koota, BVHEcctrl).

Nguồn chính: R3F scaling/pitfalls docs · gltf-transform CLI & extensions · vrm-transform · Don McCurdy “web texture formats” · PlayCanvas optimization guidelines · koota · BVHEcctrl · Heroku routing/websockets/session affinity · Colyseus state/view/scalability · Gaffer on Games snapshot interpolation · Cloudflare Durable Objects WebSockets.
