# Thế giới Toán 3D — Nguồn asset

Tải ngày 26/11/2026. Mọi model đã kiểm tra điều kiện sử dụng trên trang gốc trước khi tải.

## Nhân vật VRM (VRoid Hub)

Điều kiện chung đã lọc: Avatar use: Allow · Corporate use: Allow · Individual commercial use: Allow · Redistribution: Allow · Alterations: Allow.

| File | Model | Tác giả | Trang | Ghi chú |
|---|---|---|---|---|
| sample-a.vrm | AvatarSample_A | VRoid Project (pixiv) | https://hub.vroid.com/en/characters/2843975675147313744/models/5644550979324015604 | Điều kiện mẫu VRoid: https://vroid.pixiv.help/hc/en-us/articles/4402394424089 — **không** dùng dữ liệu model để làm dịch vụ tạo nhân vật; không bán lại file |
| sample-b.vrm | AvatarSample_B | VRoid Project (pixiv) | https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889 | như trên |
| sample-c.vrm | AvatarSample_C | VRoid Project (pixiv) | https://hub.vroid.com/en/characters/1248981995540129234/models/8640547963669442173 | như trên |
| ki.vrm | 【Free model】Ki (fantasy1) | 白い白米 (siroihakumai) | https://hub.vroid.com/en/characters/5216127528712133624/models/4081662634067513921 | Không cần ghi công |
| savi.vrm | 【Free model】Savi (Fantasy Formal Attire) | 白い白米 (siroihakumai) | https://hub.vroid.com/en/characters/2429851961943508100/models/1927570257473516371 | Không cần ghi công |
| jitome.vrm | ジトメちゃん CLCT for FANTASY(白) | ヽ|・∵・|ゝ(Fantom) | https://hub.vroid.com/en/characters/2089525207077426323/models/6708179930080671423 | Không cần ghi công |
| adventurer.vrm | Fantasy Main Character Female | Armadillo | https://hub.vroid.com/en/characters/6567548141355851503/models/3145144149606728605 | **Bắt buộc ghi công** |
| virdira.vrm | Virdira — Japanese Fantasy Uniform Version | JM / Oliver Canticle | https://hub.vroid.com/en/characters/466078557998056693/models/1738581456487172286 | **Bắt buộc ghi công · CẤM cảnh bạo lực → chỉ dùng làm NPC** |
| cute-girl.vrm | Cute Girl | Mijuuri | https://hub.vroid.com/en/characters/6361440505033342561/models/8330639398849826207 | **Bắt buộc ghi công · CẤM cảnh bạo lực → chỉ dùng làm NPC** |
| school-girl.vrm | cutegirl | jarry | https://hub.vroid.com/en/characters/3993546852120799655/models/7867627244824616321 | Không cần ghi công |
| cute-cat.vrm | cute cat | bicola | https://hub.vroid.com/en/characters/6351665345049990781/models/8610319298605393799 | Không cần ghi công |
| fumiriya.vrm | さくらだ ふみりや | VRoid Project (pixiv) | https://hub.vroid.com/en/characters/6912965120285194650/models/2261505926203110716 | Không cần ghi công (tải 27/11/2026) |
| kokia.vrm | コキア | ufostar2000 | https://hub.vroid.com/en/characters/7729786199046614741/models/4996040738801171786 | Không cần ghi công |
| mono.vrm | モノ 学ラン ver | けしごむ | https://hub.vroid.com/en/characters/6645053625974925487/models/5963352016242798364 | Không cần ghi công · bản sửa từ model "ヴィータ" (trang gốc ghi nguồn) |
| hoodie.vrm | HairSample_Male_y9v1_cluster | yomox9 | https://hub.vroid.com/en/characters/8701005182131691721 | Không cần ghi công |
| boy02.vrm | boy_02 | piyachato | https://hub.vroid.com/en/characters/5374114432810839130/models/3378233792227722616 | Không cần ghi công |
| rougan.vrm | ビジネススタイル「老眼さん」 | アツコ☆DYNAMIX | https://hub.vroid.com/en/characters/2467048806988061923/models/7601051097876615060 | Không cần ghi công |
| tvhead.vrm | TV Head — Test/Sample ver. | MeowMilk | https://hub.vroid.com/en/characters/2393320909850776788/models/3896577222490477683 | Không cần ghi công |
| spacesuit.vrm | 【Free model】Ki — 宇宙服 耳あり | 白い白米 (siroihakumai) | https://hub.vroid.com/en/characters/5216127528712133624/models/4218848236721241281 | Không cần ghi công |
| kimono.vrm | 【Free model】Savi — kimono | 白い白米 (siroihakumai) | https://hub.vroid.com/en/characters/2429851961943508100/models/4900302589541755526 | Không cần ghi công |
| elf.vrm | エルフの女性 | りん | https://hub.vroid.com/en/characters/4899142276185426841/models/5586366413714245953 | **Bắt buộc ghi công** |

## Quaternius (CC0)
- `anim/ual.glb` — Universal Animation Library [Standard], https://quaternius.itch.io/universal-animation-library
- `anim/ual2.glb` — Universal Animation Library 2 [Standard] (CC0, tải 27/11/2026; chỉ giữ 23 clip chiến đấu), https://quaternius.itch.io/universal-animation-library-2
- `env/*` — Stylized Nature MegaKit [Standard], https://quaternius.itch.io/stylized-nature-megakit

## Tự tạo
- Vòng tròn phép, hộ thể, bầu trời, cỏ, linh hồn sinh vật: shader viết riêng (`components/world/fx/shaders.ts`).
- Âm thanh: tổng hợp WebAudio (`lib/world/sfx.ts`).
- Tranh 2D (`art/`): tạo bằng công cụ sinh ảnh theo brief thiết kế gốc.

## Triển khai
File `.vrm` và `.glb` lớn (≈ 230 MB) **không commit**; tải lên CDN rồi đặt `NEXT_PUBLIC_WORLD_ASSET_BASE` (vd `https://cdn…/world`).

## Weapons (`weapons/weapons.glb`)
- Base meshes for Vector Blade, Archimedes Lever and Fourier Staff: **Quaternius** — "Sword", "Doublesided Hammer", "Staff" (CC0, via poly.pizza). Recoloured, re-centred and extended in Blender.
- Parabola Bow, Pendulum Flail, Coulomb Coil, Golden Spiral Disc, Snell Prism: modelled for this project in Blender (procedural curves: parabola, helix, golden spiral).

## Item icons (`items/*.webp`)
- Original anime cel-shaded icons generated for this project with an image-generation model from our own brief; background removed and resized.

## Monsters & props (`monsters/monsters.glb`, `props/props.glb`)
- Noise Slime, Möbius Wisp, Sierpiński Mite, Ouroboros (∞ lemniscate) and the golden-angle Sunflower: modelled for this project in Blender (procedural: lemniscate curve, Möbius strip, Sierpiński triangles shrink-wrapped onto the shell, Fermat spiral seeds at 137.5°).

## Tesseract Booth & Impossible Halls
- `props/tess_room.glb` (console room, Cycles GI baked into vertex colours), `props/kiosk.glb` (Hyperkiosk exterior, baked AO), `props/penrose.glb` (Penrose triangle sculpture): modelled for this project with Blender scripts (original design; no third-party shapes or trademarks).
- `art/sky_impossible.webp` (twilight sky with impossible architecture) and `art/tex_impossible_floor.webp` (rhombic marble floor with gold inlay): generated for this project with an image-generation model from our own brief.
- `props/babel.glb`, `props/babel_lectern.glb` (Library of Babel unit and reading lectern), `props/hotel.glb` (Hilbert's Grand Hotel corridor segment), `props/cave.glb` (Plato's Cave), `props/monty.glb` + `props/monty_prizes.glb` (Three Doors game-show stage, chibi goats, toy car), `props/theseus.glb` (Greek galley with 24 separate hull planks), `props/maxwell.glb` (Maxwell's demon laboratory), `props/chinese_room.glb` (the Chinese Room), `props/paradox_void.glb` + `props/paradox_props.glb` + `props/paradox_wonders.glb` + `props/paradox_mega.glb` (Paradox Void islands, exhibits, impossible wonders, far-zone megastructures and asteroids), `props/imp_cosmos.glb` (Impossible Halls cosmic expansion: hanging court base, floating islands, trefoil knot, Sierpiński tetrahedron, Lorenz attractor, Fibonacci sunflower + nautilus, Hopf fibration), `props/court_rail.glb` (court balustrade), `props/star_whale.glb` (constellation whale): modelled for this project with Blender scripts; lighting baked with Cycles.
- `portraits/npc_librarian.webp`, `portraits/npc_concierge.webp`, `portraits/npc_plato.webp`, `portraits/npc_host.webp`, `portraits/npc_shipwright.webp`, `portraits/npc_demon.webp`, `portraits/npc_lan.webp`, `portraits/npc_zeno.webp`, `art/keyart_babel.webp` and the guidebook illustrations in `guide/*.webp`: generated for this project with an image-generation model from our own brief.
- Guidebook / reading-desk texts quoted from public-domain works: Nguyễn Du (Truyện Kiều), Nguyễn Đình Chiểu (Lục Vân Tiên), Euclid's Elements tr. T. L. Heath (1908), E. A. Abbott, Flatland (1884). The Library of Babel follows the premise of J. L. Borges' 1941 story; no text from the story is reproduced.
