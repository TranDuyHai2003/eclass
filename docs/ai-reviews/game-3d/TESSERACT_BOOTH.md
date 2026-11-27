# Tesseract Booth: art direction and build spec (26/11/2026)

> **Tóm tắt (VI).** Bốt cũ xấu vì dựng bằng hình khối three.js thô: tường một màu, khoảng 112 draw call chỉ cho các "roundel", không có bóng nướng và không có điểm nhấn. Bốt **giật** khi bước vào vì ngay lúc đó `ConsoleRoom` gắn thêm `ambientLight` và `pointLight`. Đổi số đèn làm đổi khoá chương trình (program key) của **mọi** vật liệu có chiếu sáng, kể cả MToon của nhân vật, nên tất cả phải biên dịch lại. `Universe` cũng gắn thêm một `pointLight` và shader mới, nên lúc đến đích lại giật lần nữa. Bản thiết kế mới gồm:
> - ngoại thất **nguyên bản "Hyperkiosk"**: ki-ốt Victoria-cyberpunk sơn mài tím than, viền đồng, neon cyan/magenta, trên nóc là **siêu khối 4D đang xoay**, cửa sổ bên hông dùng *interior mapping* để thấy "sâu hơn bên ngoài". Không dùng hộp cảnh sát xanh;
> - phòng điều khiển tròn Ø28 m, cao 20 m, có ban công hình móng ngựa, cầu kính trước cửa sổ Ø11 m nhìn ra vũ trụ, hai hành lang sang Thư viện Babel và Phòng Thiên văn;
> - bàn điều khiển **năm cạnh** (φ, Penrose) thay cho sáu cạnh; lõi "Hypercore" có vòng gyroscope;
> - đèn tường xếp theo **góc vàng 137,5°** thay cho roundel; sàn **lát Penrose** sáng lên dưới chân;
> - **số đèn cố định**, bóng nướng vào vertex color, `compileAsync` trước, đích đến dùng vật liệu không chiếu sáng;
> - hơn 30 "kỳ quan" toán / lý xếp theo tầng, chọn 8 cái làm trước.

Scope: research plus a buildable spec. No code was changed. The current code was read: `components/world/scene/Tesseract.tsx`, `Impossible.tsx`, `fx/glbToon.ts`, `fx/shaders.ts`, `lib/world/sfx.ts`, and `node_modules/three` r187. This doc builds on `CEL_SHADING.md` (ramps, Ink, Neutral tone mapping, the π light fix), `VFX_PIPELINE.md` (`FxMat`, ramps, erosion) and `TECH.md` (budgets).
Source tags: **[n]** = numbered source at the end. *(memory)* = my recollection of on-screen visuals, to verify against stills before modelling. *(community)* = fan or wiki material.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Exterior | **Hyperkiosk.** Victorian-cyber kiosk, 2.6 × 2.6 m plinth, 2.2 × 2.2 m chamfered body, arched sliding door, golden-rectangle side windows with an interior-mapped "impossible depth", neon sign band, and a **floating, 4-D-rotating tesseract lantern**. Body plum-indigo `#241E3A`, brass `#D4A65A`, neon cyan `#39F3FF` / magenta `#FF3FB4`. Total height 4.35 m. |
| Interior | Circular hall, Ø28 m, wall 12.5 m plus a 7.5 m dome (apex 20 m). **Three levels**: under-deck pit (−3 m), main floor, horseshoe mezzanine at +5 m. A glass **prow bridge** in front of the **Ø11 m great window**. Corridors to the **Library of Babel** (west) and the **Star-chart / Orrery room** (east), and an **Observatory nook** on the mezzanine. |
| Console / rotor | **Pentagonal** console (5-fold: φ, Penrose, dodecahedron), not hexagonal. The **Hypercore** is a glass column with nested dodecahedron, icosahedron and 4-D tesseract, a light column to the oculus, and **three gimbal rings** spinning at 1 : φ : φ². |
| "Roundels" | Replaced by **phyllotaxis apertures**: golden angle 137.508°, a helical lattice on the wall and a Vogel sunflower on the dome. About 600 instances in **2 draw calls**, programmable colour patterns. |
| Floor | **Penrose P3 tiling**, baked texture plus a tile-ID map. Tiles light up under the player. 1 draw call. |
| Look | Anime cel (2-tone coloured ramp, Ink lines) plus "hyper-real" cues: baked AO and contact shadows in vertex colours, matcap brass, HDR neon and bloom, fake light shafts, dust motes, baked floor reflections, interior atmospheric haze, and cyberpunk holograms (fresnel, scanline, flicker, chromatic split, glitch slices). |
| Stutter fix | **The light set is constant for the whole zone.** The booth adds no lights, ever. All lighting changes are uniform tweens. Everything (exterior, interior, rooms, all 5 destinations, travel FX) stays mounted and toggles `visible`. `gl.compileAsync()` runs at zone load. Destinations use unlit or custom-lit shaders. Acceptance test: `renderer.info.programs.length` does not change on entry or on travel. |
| Travel | **"The Fold"** (original, not a BBC "vworp"). A Shepard–Risset glissando, apertures sweeping in Hilbert-curve order, a dolly-zoom, warp streaks and a tesseract tunnel in the window, and an **iris shutter** that snaps closed for 0.35 s to hide the content swap, then opens on the new universe. |
| Build first | Penrose floor, phyllotaxis apertures, gimbal Hypercore, tesseract-with-handles hologram, Mandelbrot portal, pendulum wave, Galton board, quantum double slit. |

---

## 1. Audit: why the current booth is ugly and why it stutters

### 1.1 Ugly (from `Tesseract.tsx` / `Impossible.tsx`)
- **Primitive geometry.** The walls are a `cylinderGeometry` with flat `MeshToonMaterial #3a3f86`, `emissive #1c2050`. The window frame is a single torus, the door frame is a half torus, and the dome is a procedural star shader. Nothing has a bevel, so the rim light and Ink lines have no edges to catch, and the whole room reads as one value.
- **No value hierarchy.** The floor `#26306a`, walls `#3a3f86` and dome are all mid-dark blue, and nothing is clearly the brightest or darkest area. Anime backgrounds need a **focal brightest point** (the rotor), **mid-value architecture** and **dark accents**.
- **No grounding.** There is no AO, no contact shadow and no light pools, so objects float.
- **Roundels are expensive and cheap-looking.** There are 40 segments; the window gap (±40.7°) removes about 9 and the door gap about 3, leaving about 28 positions. With 2 rows and 2 meshes each, that is **≈ 112 draw calls** for flat discs and tori.
- **The window is just a hole.** It shows `Universe` geometry 70 m away with no frame depth, no glass, no reflections and no light coming *in* from it.
- **The exterior** `booth_ext` is a generic box (the GLB node), with no silhouette identity and nothing to promise "bigger inside".

### 1.2 Stutter: root causes (verified against three r187 source)
1. **Light-count change on entry.** `Booth` swaps `{!inside && <ConsoleRoom lite/>}` for `{inside && <ConsoleRoom/>}`, and the non-lite room mounts `<ambientLight>` and `<pointLight>`. `WebGLPrograms.getProgramCacheKey` pushes `numDirLights`, `numPointLights`, `numHemiLights`, … (`WebGLPrograms.js` L350–355, L488–492). A new light count means a **new program for every lit material in view**: toon walls, every `toonMaterial`, the court, the **VRM MToon of every avatar** (a lit `ShaderMaterial`), and `MeshStandardMaterial` gold. These compile synchronously on the next frame, which causes the hitch [T1][T2].
2. **`Universe` mounts on entry.** It brings new `ShaderMaterial`s (sun, dome, EXHIBIT "high" shaders) plus **another `pointLight`** inside `SolarSystem`.
3. **Travel causes a second hitch.** `dest` changes unmount `SolarSystem`, which removes its `pointLight` (light count changes again, so every lit material recompiles again), and mount `EXHIBIT[dest]("high")`, which compiles new shaders at the "snap" moment.
4. **Per-mount allocations.** `toonize()` in `useMemo` clones and creates materials per mount, `StencilPortal` clones every material on mount, and `MagicCircle` and `Label3D` (troika SDF text) are created on entry. This is smaller than (1), but it is GC churn.
5. **Not the cause, but a trap.** Toggling `light.visible` is just as bad as unmounting, because render collects lights with `traverseVisible`.

Useful r187 facts for the fix:
- `WebGLRenderer.compile()` collects **lights with `traverseVisible`** but **materials with `scene.traverse`** (`WebGLRenderer.js` ≈ L1412–1465). Hidden groups **do** get compiled, provided the light set at compile time is the final one.
- `compileAsync()` uses `KHR_parallel_shader_compile` and resolves when the programs are ready [T3].

---

## 2. Reference research

### 2.1 TARDIS console rooms by era (what to learn, not copy)

| Era | Designer | Form and scale | Console / column | Walls | Palette and light | Reads well | Fails |
|---|---|---|---|---|---|---|---|
| 2005–10 (9th/10th) | Edward Thomas | Organic "coral" room. **Six coral struts in a hexagon meet the column at the ceiling** [R4]. Set about **6.5 m tall inside** [R5]. Two floors and three tiers: ground, console deck, upper walkways on ramps [R6]. | Six panels round a central glass column; bright cyan highlights on the console [R3] | Hexagonal recesses instead of roundels [R3] | Golden-brown and amber, with cyan accents. **Switches to red when in danger** [R3]. | The radial struts give a strong silhouette and lead the eye to the column. The warm "grown" feeling. | Dark and gloomy [R7] |
| 2010–12 (11th) | Edward Thomas | **Four tiers**, the first permanent multi-level room [R7]. Copper / brass and glass-floored deck *(memory)*. | **Glass-blown rotor commissioned from a Bristol firm** [R7]. Whimsical gadgets (typewriter, monitor, phone). | Roundels | Warm orange and copper with cyan *(memory)* | "Shouted FUN"; verticality [R7] | Gadget clutter ("goofy") [R7] |
| 2012–17 (11th late / 12th) | Michael Pickwoad | Darker. **Eighteen cosmic-blue ribs sweep floor to roof.** Several staircases ("confusing yet magical"); an under-console level leading to the engine [R8]. LHC-inspired [R8]. | Six panels, two screens. **Contra-rotating rings at the roof**, each in 18 segments with glyphs [R8]. | Circular recesses *(memory)* | 2012: cold steel, blue [R7]. **2014 relight**: "swathed in darkness and reds", warmer light, plus bookshelves and blackboards [R9][R7]. | Proves that **relighting and set dressing alone** can transform a room | 2012 "cold steel… said Cybermen" [R7] |
| 2018–22 (13th) | Arwel Wyn Jones | **Hexagon walls with cog patterns, crystal pillars, six crystals round the console, a hexagonal cage frame.** Single level, the smallest modern room [R10]. | Console from scavenged parts, one lever, a spinning crystal [R7][R10] | Hexagons | Amber and teal crystal glow *(memory)* | Organic glow | Single level, no movement space, the crystals read as plastic [R7] |
| 2023– (14th/15th) | Phil Sims | **Vast, white, three levels**, built on the 50-ft Stage 6. "Impossible, logic-defying" structure; **doors open like a camera iris**; navigation, engine and "coffee" areas [R11][R12]. | Larger console, central column [R13] | **Triangular panels with roundels interlinked in the old hexagonal arrangement**; every roundel an **individually controlled, colour-changing LED** that can spell words [R11][R13] | White plus programmable colour | Grandeur, verticality, **lights as state storytelling** | (Bright white is now part of the BBC look, so we avoid it) |

**Design grammar extracted** (generic, uncopyrightable principles):
1. **A single vertical axis.** The central column links floor to ceiling, and the struts, ribs or cables converge on it. The eye always returns to the centre.
2. **The console is an altar.** It sits on a dais that is a few steps high, and the lighting is brightest there.
3. **Radial symmetry broken by one big feature** (the doors, a screen, a window). Pure symmetry looks like a set, while one asymmetry gives direction.
4. **Verticality.** The best-loved rooms have walkways and galleries (2010, 2012, 2023), while the single-level room (2018) is criticised.
5. **Practical light sources are part of the architecture.** Roundels, crystals and rotor glow are the light. State changes (red alert, colour programs) are storytelling.
6. **Relighting beats remodelling** (2012 → 2014).
7. **Too many gadgets reads as goofy.** Controls should be legible and few, and each must *do* something.

### 2.2 Legal and originality
- The BBC registered the **police box as a UK trade mark** (applied for in 1996). The Metropolitan Police opposed it and lost in **October 2002** [L1][L2][L3]. Coverage also mentions a later BBC filing for "POLICE PUBLIC CALL BOX" (unverified) [L4]. The claim that "the BBC bought it from the Met" is an urban legend [L5].
- **We must not use:** a blue police box, the "POLICE PUBLIC CALL BOX" sign, a box-top lamp in that form, the St John Ambulance badge, the word "TARDIS", the dematerialisation "vworp" sound or anything imitating it, Gallifreyan script, the 2023 white triangular roundel panels, or a hexagonal console with a glass column *as a combination*.
- **Generic and safe:** a booth or kiosk that is bigger inside (an old literary trope), circular rooms, a central column, a console, a window into space, wall lights.
- **Our differentiators:** a pentagonal console, phyllotaxis apertures, a Penrose floor, a tesseract lantern, Shepard-tone travel, our own math-rune script, and a cyber / Victorian / brass / neon palette.

### 2.3 Cyberpunk and anime VFX references → techniques

| Reference | What to take | Technique for us |
|---|---|---|
| **Cyberpunk 2077** (CDPR) | Cyberspace and braindance are built on **point-cloud rendering** [V1]. The marketing palette is **yellow / magenta / cyan** [V7]. Holo ads flicker, with RGB split and tearing. | `HoloMat` (§7.6): fresnel, scanlines, 24 Hz flicker, chromatic split and slice-glitch. A **point-cloud dissolve** for the exterior arrival (the mesh is sampled to points that swirl in). |
| **Blade Runner 2049** | **All light is artificial and moving**; heavy fog; **restrained saturation, with colour living in highlights**; one dominant hue per space; purple/magenta glow "like watercolour on wet canvas" [V3][V4]. | An interior grade with desaturated mid-tones and shadows and saturated emissives (LUT, `CEL_SHADING` P9); in-room haze (fog colour `#1A1638`); **moving light** as scrolling caustic "cookies" on the walls near the window. |
| **Edgerunners (Trigger)** | Bold complementary neon (yellow, magenta, blue), red violence accents, hard shapes [V7][V8] | Neon signage colours; hard-edged glow shapes with a soft bloom only as the secondary layer (as in `VFX_PIPELINE` §1.2) |
| **Zenless Zone Zero** | Neon urban **cassette futurism**: CRT TVs, VHS, comic panels, holographic skill FX [V9][V10] | CRT screens on the console (barrel distortion + RGB mask + scanline); comic-panel framing on arrival cards |
| **Honkai Star Rail**: Herta Station / Penacony | Clean white-gold sci-fi with cyan holo UI. Penacony is dream-hotel gold and purple, and its team worked on **optical illusions** (BTS video) [V11] *(details: memory)*. | Art-Nouveau brass ornament on the window frame and railings; purple-gold dusk palette; illusions as gameplay (Penrose stairs, Ames vestibule) |
| **Arknights: Endfield** | Industrial near-future, **"functionality over decoration"**, sharp panels, technical flourishes, readable UI [V5][V6] | Diegetic labels everywhere: stencil numbers on panels, tick rulers on the window ring, hazard chevrons on the under-deck pit, small label plates (EN/VI) on every interactable |
| **Ghost in the Shell (1995)** | Wireframe data terrains, layered translucent UI, thermoptic shimmer *(memory)* | Wireframe Schlegel diagrams and orbit lines as HUD rings; a refraction shimmer on the glass column during travel |
| **Madoka / Gekidan INU Curry** | Labyrinths of **collage, stop-motion, Slavic animation** influence, and **a made-up rune script** [V12] | During "The Fold", a 1-second **cut-paper collage layer**: Euclid plates, Escher-like stairs and Feynman-ish diagrams as flat billboards stepping at 12 fps. Our own **math-rune glyph set** for labels. |

### 2.4 "Bigger on the inside" in screen and game design
- **Doctor Who.** The first-entry companion reaction is a recurring trope [B1]. In *The Eleventh Hour* the camera **pans round the interior while Amy's smile turns to silent overwhelm** [B2]. The classic beat (*memory*): exterior wide → step in → **reverse angle wide, low, showing height** → the companion runs back out and **circles the box** → returns. The sequence is "promise, reveal, verify, accept".
- **Portal** (Valve) uses **stencil-buffer recursive portal views** instead of render textures (better AA and memory), with about 9 recursion levels and the last level filled with the previous frame [B3][B4]. → Our door portal and the Droste item.
- **Antichamber** uses portal links for impossible rooms; academic work on "impossible spaces" uses portals, stencil-masked visible rooms [B5][B6] or "show/hide overlapping rooms".
- **Superliminal**: forced perspective. Its scaling "was straightforward in Unity", and puzzles were designed for **epiphany moments** [B7].
- **Prey (2017)**: the Looking Glass display "records whole 3-D rooms", and breaking the apartment window reveals a lab, so **a window is a lie you can break** [B8].
- **Super Mario 64's endless stairs** use a Shepard scale [B9]. Audio sells an impossible space.
- **Interior mapping** (van Dongen 2008): a shader ray-casts against virtual floors and walls behind a window, so you see deep rooms with no geometry, as in the Spider-Man building windows [B10][B11]. → Our exterior side windows.

**Rules we adopt** (§9 gives the shot list):
1. **Promise first.** The small exterior must be measurable: human-scale door, a bench and lamp post nearby, a scale label.
2. **Compression → release.** A narrow, low, dim 3 m vestibule (2.6 m ceiling) opens into a 20 m-high bright hall.
3. **Reveal shot.** The camera cranes up and back over 2.5 s and the FOV widens. The first time per session this is a full cinematic, later visits get a 0.8 s mini version.
4. **Change light, sound and air.** Warm daylight changes to night-cyber; the dry exterior acoustic changes to a large reverb tail with a chord swell; inside, atmospheric haze turns the far wall bluer.
5. **Scale cues.** Repeated elements recede (apertures, columns); human-size props (chairs, books) sit next to colossal ones (gimbal rings, window); the window shows planets, which means infinite scale.
6. **Verify.** Prompt the student to step out and walk round the kiosk. A hologram tape measure reads: "Outside 2.2 m · Inside 28 m · Volume ≈ 850×".

---

## 3. Exterior: an original concept

### 3.1 Options

| | A. **Hyperkiosk** (Victorian-cyber kiosk + tesseract lantern) | B. Klein-bottle phone booth | C. Neon shrine-arcade kiosk (torii frame + arcade cabinet) |
|---|---|---|---|
| Read at 50 m | Strong: a cube with a glowing cube-in-cube floating above | Weak: a glass blob reads as a sculpture, not a doorway | Strong, but the torii reads "Japan" rather than "math" |
| Math identity | Tesseract (fits the zone and our rotor code); golden-rectangle windows | Non-orientable surface, very mathy | Weak (decorative) |
| Legal distance from the police box | High: plum-black lacquer, chamfered and arched, no sign or lamp of that form | Very high | High |
| Modelling cost | Low–medium: bevelled boxes, arches, brass trims | High: a smooth self-intersecting glass surface, transparency sorting | Medium |
| Runtime cost | Opaque toon plus a few glow meshes (≈ 9 draws) | Glass transparency, refraction, sorting problems | Fine |
| "Bigger inside" promise | **Interior-mapped side windows** show a deep hall, and the floating hypercube says "more dimensions" | The self-intersection hints at 4-D, but the door is ambiguous | None built in |
| Culture fit (VN students) | Neutral and global | Neutral | Possibly out of place |

**Pick A, the Hyperkiosk.** It has the most iconic silhouette per polygon. It extends the existing tesseract code and theme, gives clean legal distance, is cheap to render, and carries two built-in "bigger inside" teasers (interior mapping and the 4-D lantern). The Klein bottle moves **inside** as the fountain (§13 H6). Shrine accents are not used.

### 3.2 Hyperkiosk: exact proportions
Local frame: origin at the plinth centre on the ground; the door faces **+z** (matches `BOOTH` in `Impossible.tsx`, footprint 2.2 × 2.2, `DOOR_W = 1.5`).

```
            ◇  tesseract lantern (outer cube 0.80, inner 0.40)  ── y 3.55–4.35 (centre 3.95)
           ═══ halo ring Ø1.1 (glow)                            ── y 3.50
         ▁▂▃▄▃▂▁ stepped roof, 3 steps                          ── y 3.20–3.45
   ┌─────────────────┐ cornice + neon sign band (0.36 tall)      ── y 2.84–3.20, overhang 0.12
   │╲  ┌───────┐   ╱ │
   │ │ │ arched│   │ │ body 2.2 × 2.2, corners chamfered 0.18    ── y 0.24–2.84 (2.60)
   │ │ │ door  │   │ │ door opening 1.50 × 2.30 (arch rise 0.35)
   │ │ │       │   │ │ corner pillars 0.22 wide with a neon slot
   └─┴─┴───────┴───┴─┘
  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ plinth 2.6 × 2.6, two steps of 0.12       ── y 0–0.24
```

| Part | Dimensions (m) | Notes |
|---|---|---|
| Plinth | 2.60 × 2.60 × 0.24 (two 0.12 steps; the upper step 2.40 × 2.40) | Basalt, brass nosing 0.03, **glow inlay strip** 0.025 wide around the upper step |
| Body | 2.20 × 2.20 × 2.60 (y 0.24 → 2.84), corners **chamfered 0.18** (octagonal plan, unlike the police box's square posts) | Lacquer panels with 0.03 bevels |
| Corner pillars | 4 × chamfer faces 0.22 wide, full body height | Each has a **recessed neon slot** 0.04 × 2.2 (magenta), with brass caps top and bottom (0.08 tall) |
| Door (+z) | Opening 1.50 W × 2.30 H to the arch top; the arch is a semi-ellipse with 0.35 rise; frame 0.10 brass | Two **sliding leaves** (pocket into the walls), each 0.75 × 2.30 × 0.05. A brass **Schlegel-diagram emblem** (cube-in-cube line art, Ø0.42) splits across both leaves at y 1.55, with a cyan neon seam down the centre. |
| Side windows (±x, −z) | 3 faces × one arched window 1.20 W × 1.90 H, sill at y 0.70 | **Golden-rectangle mullions**: a square plus a golden rectangle recursively split (a φ-spiral grid), 0.025 brass. The glass uses **interior mapping** (§7.6) showing a deep cyber hall (virtual depth 30 m). |
| Cornice / sign band | 2.44 × 2.44 × 0.36 (overhang 0.12), y 2.84 → 3.20 | Front: neon sign **"TESSERACT"** in our own geometric display face, 0.20 cap height. Sides: "4-D" plus a small "SIÊU KHỐI". Back: a tick ruler and serial plate "HX-4". The sign is a glow mesh 0.02 in front of a dark backing. |
| Roof | Stepped pyramid, 3 steps: 2.30 → 1.70 → 1.10, each 0.08 tall (y 3.20 → 3.45) | Brass edges |
| Halo ring | Torus R 0.55, tube 0.02, y 3.50 | Glow cyan, rotates slowly |
| **Tesseract lantern** | Outer cube 0.80, inner 0.40, 8 frustum "cells" implied by 32 edges; centre y 3.95, hovering 0.30 above the roof | Edges as **tube meshes** (r 0.018) driven by a 4-D rotation in the vertex shader. Outer edges cyan, inner magenta, vertex nodes small brass spheres (r 0.035). |
| Ground light pool | Additive decal quad 5 × 5, y 0.005 | Radial cyan → transparent with a magenta tint near the door. Fakes the kiosk lighting the ground. |
| Cables | 3 cables Ø0.08 from the back wall at y 0.6 that curve into the ground (catenary), with 2 junction boxes 0.25³ | Cyberpunk grounding; the junction boxes have a small blinking glow LED |

Overall: **2.60 W × 2.60 D × 4.35 H**. A real police box is about 2.7 m tall × 1.37 m wide [L6]. Ours is wider, has an arched door, chamfered corners, no lamp and no sign of that kind, and a different colour family, so the silhouette and trade dress are clearly different.

### 3.3 Exterior palette (sRGB hex; toon albedo unless marked glow)

| Token | Hex | Use |
|---|---|---|
| `lacquer` | `#241E3A` | Body panels (plum-indigo, **not** police-box blue `~#003B6F`) |
| `lacquer_hi` | `#3A2E63` | Panel insets and bevel faces |
| `brass` | `#D4A65A` | Trims, mullions, emblem (matcap material, §5.0) |
| `brass_dark` | `#7A5326` | Brass in cavities (vertex-colour AO) |
| `basalt` | `#2E2A3A` | Plinth |
| `glow_cyan` | `#39F3FF` × 3.0 HDR | Door seam, inlay, lantern outer edges, halo |
| `glow_magenta` | `#FF3FB4` × 2.5 | Pillar slots, lantern inner cube |
| `glow_amber` | `#FFB347` × 2.0 | Sign letters (front), junction LEDs |
| `glass` | `#7FD8FF`, α 0.25 + interior map | Side windows |
| `cable` | `#16141F` | Cables |

Shadow side follows the zone's coloured toon ramp (purple shadow `0.56/0.55/0.74`), so lacquer shades to a deep violet, never to black.

---

## 4. Interior layout: the console room

### 4.1 Frame and key numbers
The local origin is at the **Hypercore centre on the main floor** (y = 0). Bearings: **0° = north = −z (the great window)**, 90° = east (+x), **180° = south = +z (the entry door)**, 270° = west. Keep the hall where the code puts it today: `ROOM = (BOOTH.x, BOOTH.z + BOOTH.d/2 − 1 − 14)`, wall radius 14 (collision `rc < 13.5` is already in `impBlocked`).

| Element | Value |
|---|---|
| Wall inner radius | **14.0 m** (Ø28) |
| Wall height | 12.5 m; then an **elliptical dome**, rise 7.5 m, **apex 20.0 m**; oculus Ø4.4 m at the apex |
| Volume | Cylinder π·14²·12.5 ≈ 7 700 m³, plus half-ellipsoid ⅔π·14²·7.5 ≈ 3 080 m³, for **≈ 10 800 m³**. The kiosk body is 2.2·2.2·2.6 ≈ 12.6 m³, so the ratio is **≈ 850×**. |
| Under-deck pit | Annulus r 4.4 → 6.2, floor at y −3.0, covered by a **glass grating** at y 0 (walkable) |
| Console dais | Circle r 4.4, top y 0.45 (3 steps × 0.15, treads 0.35) |
| Console | **Pentagon**, circumradius 1.70, desk top y 1.45 (1.0 above the dais, waist height for 1.6 m avatars), desk slope 18° outward |
| Hypercore glass column | r 0.55, y 1.45 → 4.60 (3.15 tall); brass collar y 4.60–5.20; **light column** r 0.9 → oculus |
| Gimbal rings | Three rings centred at y 4.2: R 2.0 / 2.6 / 3.2, tube 0.10 / 0.11 / 0.12 |
| Mezzanine | Floor y **5.00**, ring r 11.4 → 14.0 (2.6 wide), **horseshoe** spanning bearings **238° → 0° → 122°** (open over the entry). Railing at r 11.4, h 1.05. **10 slender columns** at r 11.6, bearings 18° + 36k (skipping those inside the stair arcs). |
| Window cut in mezzanine | The ring is cut for bearings −25°…+25° |
| **Prow bridge** | A glass-deck chord across the cut at y 5.00, about 1.8 wide, sagging 0.15 toward the window (the deck arcs to r ≈ 12.8 at bearing 0°), with brass edges and glass railings. Hero standing spot in front of the window. |
| **Great window** | Circular, **Ø11.0 m**, centre y **6.8** (spans y 1.3 → 12.3), set in the wall at bearing 0°, half-angle 23.1°. Sill at y 1.3 with a **window bench**. Frame: brass outer ring 0.45 deep, 0.35 face; 12 **iris blades** (§7.4); 24 Art-Nouveau ribs on the outer frame. |
| Grand stairs | Two curved stairs **hugging the wall** (inner r 11.6, outer 13.4, width 1.8): **East** from the foot at bearing 160° (y 0) rising counter-clockwise to land at 122° (y 5); **West** from 200° to 238°. 28 risers × 0.178, treads 0.30, arc ≈ 38°. |
| Entry vestibule | At bearing 180°: 3.0 deep (r 14 → 17 outside the cylinder), **1.8 wide × 2.6 high, dim** (compression). Inner portal arch 3.2 W × 4.2 H at r 14. |
| Corridors | **East** (bearing 90°, main floor) → Star-chart / Orrery room. **West** (270°, main floor) → Library of Babel. Arched openings 3.0 W × 3.6 H, corridors 3.0 wide × 18 long. **Mezzanine 90°** → Observatory nook. **Mezzanine 270°** → Escher landing (Penrose stairs). |
| Ribs | **10 ribs** at bearings 18° + 36k, rising from the mezzanine column caps up the wall (r 13.8) and over the dome to the oculus ring. Box section 0.35 × 0.25, with a cyan neon seam on the inner face. |
| Catenary cables | 10 bundles hanging between adjacent ribs below the dome (sag 1.2 m), y ≈ 12–13 |
| Turing tape | A ring band at the dome base, y 12.6, r 13.7, 0.5 tall, 256 cells (§13 A3) |
| Apertures (wall) | Upper wall band y 5.6 → 12.2 on r 13.85. **Helical phyllotaxis**: n = 0…N−1, θₙ = n·137.508°, yₙ = 5.6 + 6.6·n/N, N ≈ 260, skipping the window (±26°) and the rib lines (±1.5°). Aperture Ø0.80. |
| Apertures (dome) | **Vogel sunflower**: ρₙ = R_d·√(n/N_d), θₙ = n·137.508°, N_d = 377 (a Fibonacci number), projected onto the dome, skipping ρ < 2.6 (oculus) |

### 4.2 Plan view (top, not to scale)

```
                         0° N  GREAT WINDOW Ø11 (y 1.3–12.3)
                  ┌──────────────╲══════════════╱──────────────┐
          324° ●  │  pendulum     ╲ prow bridge ╱   Mandelbrot  │  ● 36°
     light clock  │  wave (mezz)   ╲  (y 5)    ╱  portal(mezz)│  Galton board
                  │                 ╲_________╱               │  (main floor wall)
   270° W ════════╡      ◯ Klein         ⬠ console            ╞════════ 90° E
   LIBRARY        │     fountain        (◎ Hypercore +        │  STAR-CHART /
   (corridor,     │     (r 8, 225°)      gimbal rings)        │  ORRERY room
   Hilbert's      │   ·· glass grating ring r 4.4–6.2 ··       │  (Hilbert-curve
   Hotel doors)   │          PENROSE FLOOR (lit tiles)        │   corridor)
   mezz 270°:     │                                           │  mezz 90°:
   Escher landing │ West stair 200°→238°   East stair 160°→122°│  Observatory nook
                  └───────────╲      VESTIBULE      ╱──────────┘
                               ╲ 1.8 w × 2.6 h ×3 ╱
                                    180° S  DOOR (→ kiosk)
```

### 4.3 Section (north–south)

```
 y20 ─────────────────── oculus ◯ (light column comes down) ───────────────
      dome: Vogel sunflower apertures, 10 ribs, catenary cables
 y12.6 ═ Turing tape ring ═════════════════════════════════════════════════
      wall: helical aperture band (y 5.6–12.2)
 y12.3  ╭─────╮                      │                                       
        │     │ great window Ø11     │ light column                         
 y5  ═══╡ prow ╞═══ mezzanine ═══     │  ○○○ gimbal rings (y 4.2, R 2–3.2) ═══ mezzanine
        │bridge│   pendulum wave     ║║║ glass Hypercore y1.45–4.6           
 y1.3   ╰─────╯ sill + bench        ⬠ console (top 1.45) on dais (0.45)       vestibule
 y0  ════════════ Penrose floor ═══ glass grating ═══ Penrose floor ═════════▶ door
 y-3            under-deck pit (cables, engine glow, Game of Life grating)
```

### 4.4 Rooms off the hall (each a separate GLB group, always mounted, `visible` toggled by trigger volumes)
1. **Library of Babel** (west). A chain of **hexagonal galleries** (Borges): hexagon side 4.0 m, height 5.0 m. Four walls of shelves (5 shelves × 32 books each) and two open walls leading on. A **central air shaft** Ø2.2 with a low railing, which houses the **Foucault pendulum** (12 m drop, the shaft continues above and below). The chain loops with the existing `LoopCorridor` teleport trick, so it is **infinite**. A Möbius conveyor carries books between the galleries.
2. **Star-chart / Orrery room** (east). A circular chamber Ø14, h 8, with a planetarium dome (star-chart shader with constellation lines) and a **brass orrery Ø6**. Wall stations: brachistochrone race and Fourier epicycles. The corridor floor shows the **Hilbert curve** light path.
3. **Observatory nook** (mezzanine 90°). A small round room Ø7 with a telescope pointing at a skylight, the **gravitational-lens sphere**, the **double slit**, and Schrödinger's box.
4. **Escher landing** (mezzanine 270°). The **Penrose staircase** loop (§13 H3). Plays a Shepard tone.
5. *Later:* the **Non-Euclidean triangle room** off the star-chart room (§13 H4) and the Ames vestibule variant (§13 A11).

---

## 5. Blender modelling breakdown

### 5.0 Conventions (extends `fx/glbToon.ts`)
- **Material name prefix → runtime material** (one shared instance per name, cached per GLB, **not** per mount):
  - `toon_*` (or no prefix): `MeshToonMaterial`, shared `GRADIENT`, `vertexColors: true` when `COLOR_0` exists (multiplies the albedo by the baked AO and shadow), plus rim via `toonMaterial`.
  - `glow_*`: unlit `MeshBasicMaterial`, `toneMapped:false`, colour × HDR factor taken from the material's emission strength in Blender (default 2.2).
  - `brass_*`: **`MeshMatcapMaterial`** with a painted anime-metal matcap (256²: 2-tone warm brass + a sharp white highlight band + a cool rim). Unlit, so it is independent of the light count; multiplied by `COLOR_0` for cavities. This is the "polished, hyper-real" metal without PBR.
  - `holo_*`: `HoloMat` (§7.6). `glass_*`: `GlassMat` (fresnel rim, additive, `depthWrite:false`). `neon_*`: glow plus a flicker group in `COLOR_0.a`.
  - `aper_*`, `penrose_*`, `ink_*`: special shaders (§7).
- **One palette texture** `booth_palette.png` (64×64, 8×8 colour swatches), plus UVs collapsed onto swatches, for all `toon_*` architecture. The whole static shell becomes **one material**, and after `gltf-transform join` it is **1–3 draw calls**. Colour changes are done by moving UVs or editing the swatch.
- **Bevel everything visible** (bevel modifier, 1–2 segments, 0.01–0.03 m, harden normals). Rim light and the Ink pass need edges.
- **Vertex colour bake.** Bake target "Color Attributes" with Cycles: **AO** (distance 1.5 m, 128 samples) and a **directional fake shadow** (bake *Diffuse, Direct only* from a sun lamp matching the interior key; see §6). Combine with a script: `COL = mix(shadowTint, 1, ao^0.8 · sh)`, with `shadowTint = (0.56, 0.55, 0.74)` (the toon ramp shadow, so painted and runtime shadows match). Store it as `Col` (exports as `COLOR_0`). Add loop cuts so vertex spacing is ≤ 1 m on walls and ≤ 0.3 m near contacts. Vertex-colour AO baking had bugs in Blender 3.1/3.2 and artifacts in 2.9x [K1][K2]; use 4.x and check corners.
- **Large flat floors** use a texture bake instead: the 2048² Penrose floor bake (§7.3).
- Export glTF with **Vertex Color = Active** (Blender 4.2+ exporter option; verify in the installed version), +Y up, apply modifiers. Then `gltf-transform optimize --compress meshopt --texture-compress ktx2`. Join static meshes by material; **keep animated nodes separate and named** (`--join false` on those collections), as `TECH.md` recommends.
- **Files:** `props/booth_ext.glb` (≤ 250 KB), `props/booth_room.glb` (≤ 1.6 MB), `props/booth_rooms.glb` (library, star room, nook; ≤ 1.2 MB). All are loaded with the zone, never on door entry.

### 5.1 Per-object table

| Object (node name) | Shape notes | Tris (high / low) | Materials | Vertex-colour bake | Animated |
|---|---|---|---|---|---|
| `kiosk_body` | §3.2, bevelled lacquer panels, chamfered corners, arched door frame, cornice, stepped roof | 3 800 / 1 200 | `toon_lacquer`, `toon_basalt`, `brass_trim` | AO + ground-contact darkening (bottom 0.4 m) + cornice shadow band | — |
| `kiosk_door_L/R` | Sliding leaves, emblem halves | 2 × 300 | `toon_lacquer`, `brass_trim`, `glow_cyan` (seam) | AO | slide ±0.78 m on x |
| `kiosk_windows` | 3 arched glass panes, φ-grid mullions | 600 | `glass_interior` (interior map), `brass_trim` | — | — |
| `kiosk_neon` | Pillar slots, sign letters, inlay | 900 | `neon_magenta`, `glow_amber`, `glow_cyan` | flicker group in α | flicker |
| `kiosk_lantern` | 32 edge tubes (6-sided, r 0.018), 16 nodes; edges carry a 4-D endpoint index pair in attributes so the **vertex shader** places them | 1 600 | `glow_cyan`, `glow_magenta`, `brass_node` | — | 4-D rotation (shader) |
| `kiosk_cables` | 3 catenary tubes + 2 boxes | 700 | `toon_cable`, `glow_led` | AO | — |
| `room_shell` | Wall cylinder (64 segs), dome, oculus ring, vestibule, corridor mouths; recessed panel lines on the lower wall (0–5 m) | 14 000 / 6 000 | `toon_palette` | AO + **vertical gradient** (lighter toward the window side, darker near the floor) + painted light pools under the apertures | — |
| `room_floor` | Disc r 14 with the grating ring cut out; Penrose bake texture | 2 500 | `penrose_floor` (§7.3) | baked into the texture | tile glow (shader) |
| `room_grating` | Annulus, grate pattern as an alpha-tested texture | 400 | `toon_grate` (alpha test) | — | — |
| `room_pit` | Under-deck: floor, cable trays, 6 engine coils glowing | 4 000 | `toon_palette`, `glow_engine` | AO strong | coil pulse |
| `dais` | 3 stepped rings with a brass nosing and glow step-lights | 1 800 | `toon_palette`, `brass_trim`, `glow_cyan` | AO | — |
| `console` | **Pentagon**: 5 sloped desks, each with a unique station (§8). Bevelled body with a skirt and kick-lights; ≈ 40 controls (levers, dials, keys, CRT) | 9 000 / 4 000 | `toon_palette`, `brass_ctrl`, `glow_*`, `holo_screen`, `crt_screen` | AO in all control cavities | levers, dials, keys |
| `core_glass` | Cylinder r 0.55 (32 segs) with brass bands every 0.6 m | 900 | `glass_core` | — | shimmer during travel |
| `core_inner` | Nested **dodecahedron** (wire tubes) + icosahedron (faceted glow) + the tesseract line set (existing code) | 2 400 | `glow_cyan`, `glow_amber`, line material | — | bob ± 0.35, spin, 4-D rotation |
| `core_collar` | Brass collar with 10 struts out to the light column | 1 200 | `brass_trim` | AO | — |
| `gimbal_1/2/3` | Three tori with flat bands, engraved tick rings, 2 pivot bosses each | 3 × 900 | `brass_ring`, `glow_tick` | AO at pivots | nested rotation (§8) |
| `light_column` | Open cylinder r 0.9, y 5.2 → 20 | 64 | `shaft_column` (§7.5) | — | scroll |
| `mezzanine` | Horseshoe deck, fascia with a neon line, railing (instanced posts), 10 columns | 9 000 / 4 000 | `toon_palette`, `brass_rail`, `glow_cyan` | AO under deck, column contact | — |
| `prow_bridge` | Glass deck plus brass frame and glass rails | 1 200 | `glass_deck`, `brass_rail` | — | step ripple (shader) |
| `stairs_E/W` | Curved stairs: 28 steps each (instanced), stringers, brass nosings, glow riser-lights | 2 × 3 500 | `toon_palette`, `brass_trim`, `glow_cyan` | AO | — |
| `window_frame` | Ø11 ring 0.45 deep, 24 Art-Nouveau ribs, tick ruler ring, 12 iris blades (separate nodes) | 6 000 | `brass_frame`, `glow_magenta`, `toon_blade` | AO | iris open/close |
| `window_glass` | Disc with a fresnel rim, subtle reflections of the room (baked), dust and scratches | 128 | `glass_window` | — | — |
| `ribs` | 10 box-section ribs with a cyan seam | 3 000 | `toon_palette`, `glow_cyan` | AO | — |
| `cables_dome` | 10 catenary bundles (3 tubes each) | 3 000 | `toon_cable` | — | sway (vertex shader) |
| `aperture` (one mesh, instanced) | Bezel ring 0.80 (16 segs, bevelled) + inner disc 0.62 | 48 + 16 per instance | `toon_bezel` (instanced, 1 draw) + `aper_glow` (instanced, 1 draw) | — | colour patterns (shader) |
| `turing_tape` | Ring band of 256 cells + head carriage | 2 000 | `aper_glow`-style instanced cells + `brass_head` | — | head moves |
| `props_set` | Chairs ×6, crates, tool cart, books, mugs, a coat stand (human-scale cues) | 6 000 | `toon_palette` | AO | — |
| `holo_cards` | 5 quads + 1 ring | 12 | `HoloMat` | — | orbit |

**Totals.** Hall plus exterior ≈ **95 k tris high / 45 k low**. Rooms ≈ 35 k more but only visible one at a time. Draw calls in the hall: **≈ 45 high / 30 low** (§10).

---

## 6. Lighting plan

### 6.1 The rule
**The zone has one fixed light set**: the global `<Lights/>` (hemisphere + directional key + optional directional back, whatever `CEL_SHADING` P3 leaves) plus the existing `ambientLight` in `Impossible`. **The booth adds no lights. Never mount, unmount or toggle `visible` on lights.** All changes are **uniform tweens** of `color`, `intensity` and `position`. The same applies to `scene.fog`: keep one `Fog` object and change its colour, near and far, and never switch `Fog` ↔ `FogExp2` or remove it, because the `fog` and `fogExp2` flags are part of the program key.

### 6.2 Light rig by state (all values tweened over 0.5 s; intensities include the π fix from `VFX_PIPELINE` §6.1 and need re-tuning on screen)

| Light | Outside (court) | **Inside: idle** | Travel (Fold) | Arrival tint (per destination) |
|---|---|---|---|---|
| Hemisphere sky / ground | existing | sky `#7C83FF`, ground `#2B1640`, 0.85 | sky `#C04BFF`, 0.6 | sky lerps 30% toward the destination colour |
| Key (directional) | sun | **From above the rotor, slightly toward the door**: dir (0.25, 1.0, 0.45) → lit faces point up and toward the entrance, the classic "altar top-light". `#FFE2BE`, 1.0 × π | dims to 40%, colour `#FF7AD9` | back to idle |
| Back / rim (directional, if kept) | existing | **From the window** (0, 0.35, −1): cyan rim `#6FE8FF`, 0.35. Motivated by the window, it rims every character and prop facing away from it. | `#FF3FB4`, 0.6, pulsing with the Shepard beat | destination colour (below) |
| Ambient (Impossible) | 0.25 | `#5A5AA0`, 0.15 | 0.1 | 0.15 |
| Fog | court | `#1A1638`, near 18, far 70 (inner haze turns the far wall bluer) | `#2A0F3F`, near 10, far 50 | `#1A1638` |

Destination window tints: Solar `#FFD68A`, Event Horizon `#FF9A4A` (with a teal fill), Lorenz `#B58CFF`, Hyperbolic Sky `#6FFFE0`, Tesseract `#FF5FD2`.

### 6.3 Where the "light" comes from (all faked; no point lights)
- **Rotor glow on the floor**: an additive **light-pool decal** (Ø9 radial gradient, cyan → amber) on the floor around the dais, plus the baked painted pool in the floor texture.
- **Aperture glow on the walls**: baked soft glows under each wall aperture (static pattern in the vertex colours) plus the instanced glow discs themselves. Bloom does the rest.
- **Window light**: 3 **light-shaft cards** (§7.5) slanting from the window into the room, plus the rim light above, plus a window-shaped light pool on the floor (an additive decal 10 × 6 m, stretched).
- **Contact shadows**: baked (vertex colours and floor texture). Moving characters get the existing blob shadow quad.
- **Moving light**: two "caustic cookie" quads on the north wall near the window (scrolling Voronoi caustics, additive, 0.15), so the light is never static (the Blade Runner lesson).

### 6.4 Palette (interior)

| Token | Hex | Role |
|---|---|---|
| `ink_navy` | `#141A33` | Darkest architecture, pit |
| `floor_a` / `floor_b` | `#23284F` / `#2E2660` | Penrose thick / thin rhombs |
| `wall_violet` | `#2A2452` | Wall mid-tone |
| `panel_hi` | `#4B3F86` | Bevel faces, panel insets |
| `gunmetal` | `#3B3F55` | Ribs, pipes, console body |
| `brass` | `#D8A75A` | Matcap brass (railings, rings, frame) |
| `neon_cyan` | `#3FF2FF` × 2–3 | Primary emissive |
| `neon_magenta` | `#FF3DA8` × 2–2.5 | Secondary emissive, travel |
| `amber` | `#FFB547` × 2 | Aperture core, warm accents |
| `core_white` | `#E8FFFF` × 4 | **Brightest point in the room** (the Hypercore) |
| `space` | `#05060F` → `#0B1030` | Window background |
| `alert` | `#FF3355` | Danger and error states only |

The value plan is: core ≫ window ≫ apertures > brass > walls > floor > pit. Saturation is low on architecture and high on emissives only (Blade Runner lesson).

---

## 7. VFX list (shader approaches)

All FX meshes live in the scene from zone load (hidden), and their materials are compiled by `compileAsync`. Post effects that are used at all **stay in the EffectPass permanently**, because adding or removing an effect recompiles the merged pass; we animate their parameters instead (e.g. `ChromaticAberration.offset = 0` at rest).

### 7.1 Idle
| FX | Approach | Cost |
|---|---|---|
| Hypercore breathing | Existing bob and spin; the core emissive scales `1 + 0.15·sin(t·1.2)`; light-column scroll speed 0.3 | 0 |
| Gimbal rings | Rotation rates 0.10 : 0.10·φ : 0.10·φ² rad/s (incommensurate, so the pattern never repeats) | 3 matrix updates |
| Aperture patterns | `aper_glow` shader: instance attributes `aIdx`, `aBearing`, `aY`, `aHilbert`; uniforms `uMode`, `uT`, `uPulse`, `uColA/B`. Idle mode: slow **parastichy waves** `sin(aIdx·φ·2π·k − t)` along the 8- and 13-spirals, amber core with cyan edges | 0 CPU |
| Light shafts | 3 additive cards from the window plus the oculus column; noise scroll; dust motes inside | ~4 draws |
| Dust motes | Instanced points (400) drifting in the shafts, wrapped in a box; size attenuated; only lit inside the shaft volume (analytic) | 1 draw |
| Data rain | 2 lower-wall panels: instanced glyph quads (§7.6) in columns, math glyph atlas | 2 draws |
| HUD rings | Thin ring meshes (one `InstancedMesh`, per-instance radius / speed / tick texture row) around the core and above the console | 1 draw |
| Cable sway | Vertex shader `offset = sin(t·0.7 + h·3) · 0.02 · sag(u)` | 0 |
| Caustic cookies | Scrolling Voronoi (procedural) on 2 additive wall quads | 2 draws |
| Floor tiles | The Penrose shader lights tiles near the player (§7.3) | 0 extra |
| Exterior lantern | 4-D rotation in the xw and yz planes; halo ring spin; neon flicker (group-based, rare) | 0 |

### 7.2 Door-open and entry
1. **Approach (< 6 m):** the lantern speeds up ×3; the door seam brightens; a holo sign "BIGGER ON THE INSIDE · LỚN HƠN Ở BÊN TRONG" types in (HoloMat, typewriter mask).
2. **Door slide (0.6 s, ease-out-back):** the leaves slide into the walls. A thin **light spill** comes from the door: an additive wedge decal on the ground plus a vertical quad in the door plane, cyan, growing with the opening.
3. **Stencil portal view** shows the interior's **lite proxy** (§10.4) and the window panorama.
4. **Threshold (crossing the door plane):** the light rig tweens (§6.2); the fog swaps over 0.4 s; a **one-frame white-cyan flash** at 25% opacity; the **reveal camera** (§9) starts.
5. **Compression → release:** the vestibule has no apertures and is dim; the hall opens up as the camera cranes.

### 7.3 Penrose floor (also the main "ground" look)
- **Bake (build script, Node or Python):** generate a P3 rhomb tiling by **de Bruijn pentagrid** or by deflation over a 30 m disc, with edge ≈ 0.9 m (≈ 850 tiles; the thick:thin count ratio → φ). Rasterise to:
  - `floor_albedo.ktx2` 2048² (1024² on low): rhomb fills `floor_a` / `floor_b`, brass seams, **painted AO and light pools**, and **baked reflections** of the static emissives (window, apertures, dais lights) as soft vertical streaks.
  - `floor_id.png` 1024², linear: **R** = per-tile random, **G** = distance to the tile edge, **B** = 1 for a thick rhomb, **A** = 0.
- **Shader** (toon with `onBeforeCompile`): `glow = ring(distance(tileCentre, uPlayer), uT)` for up to 4 ripple sources in a uniform ring buffer, plus a seam glow `smoothstep(0.03, 0, G)`. The added HDR is `uColA · glow · (0.6 + 0.4·R)`. A footstep adds a ripple source. One draw.

### 7.4 Travel: "The Fold" (original dematerialisation, 4.8 s, `TRAVEL_MS` 3400 → 4800)

| t (s) | Beat | Visual | Shader / implementation |
|---|---|---|---|
| 0.0–0.4 | **Lock** | The chosen holo card flies into the core; apertures sweep to magenta **in Hilbert-curve order** (`aHilbert < uSweep`) | Card position tween; `uMode = SWEEP` |
| 0.4–1.6 | **Spin-up** | Core spin ×4, bob amplitude ×2; gimbal rings accelerate and **tilt** (precession wobble); the light column brightens; camera shake builds 0.03 → 0.08; **dolly-zoom**: FOV +8° while the camera dollies in 0.6 m (space "stretches") | Uniform tweens; camera FOV via the existing camera rig |
| 1.6–3.0 | **Fold** | Window: stars stretch to streaks (existing) and the **tesseract tunnel** appears (rings of Schlegel-cube edges rushing past). Room key light dims to 40% violet. Apertures pulse with the Shepard beat. **Chromatic aberration** up to 0.004. A 1-second **cut-paper collage** layer: 6 flat billboards of math plates stepping at 12 fps in front of the window. The glass column **shimmers** (vertex wobble + fresnel boost). | Tunnel: an open cylinder r 30 × 300 m beyond the window, BackSide `TunnelMat` (below). CA via the always-present `ChromaticAberrationEffect`. Collage = `FxSprites` with 12 fps flipbook stepping. |
| 2.7–3.05 | **Iris snap** | The **12 iris blades close** (0.15 s), hold 0.05 s, **swap the destination** (visibility toggle only), then reopen (0.15 s) | Blade rotations; `dest` set while closed |
| 3.05–3.4 | **Arrival** | A white flash (2 frames, 40%); a **shockwave** ring from the window centre across the floor (Penrose ripple plus a floor ring decal); big shake 0.5 (existing); apertures **cascade** outward from the window to the destination colour | Floor ripple source at the window foot; `uMode = CASCADE` |
| 3.4–4.8 | **Settle** | The core decelerates with a spring overshoot; gimbals settle; a destination **title card** (HoloMat) fades in beside the prow bridge with the name and the `idea` text (`DESTS`); dust motes swirl outward | Spring easing |

`TunnelMat` (fragment, additive, `depthWrite:false`):
```glsl
uniform float uT, uK;            // uK: 0..1 travel envelope
varying vec2 vUv;                // u around, v along the tunnel
void main(){
  float ring  = smoothstep(.96, 1., fract(vUv.y*24. - uT*6.));          // edge rings rushing past
  float spoke = smoothstep(.985, 1., abs(cos(vUv.x*3.14159*8.)));       // 8 longitudinal edges
  float cube  = ring*0.8 + spoke*0.5*step(.5, fract(vUv.y*6. - uT*1.5)); // Schlegel-like cells
  vec3  c = mix(vec3(.25,.95,1.), vec3(1.,.25,.7), fract(vUv.y*2. - uT*.3));
  gl_FragColor = vec4(c * cube * 2.5 * uK, 1.);
}
```

**Exterior tell (seen from the court by other players, optional):** the kiosk "passes through 4-D". Its cross-section scales by **s = √(1 − (w/R)²)** as w goes 0 → R (a hypersphere crossing our 3-space, like a sphere crossing Flatland), combined with **horizontal slice discard**: `discard if fract((y - base)*9. + t*1.5) < uSlice`. Edges inside 0.02 of a cut glow cyan. On arrival it runs in reverse. The slice uses a **uniform-driven discard**, not clipping planes, because `numClippingPlanes` is in the program key.

### 7.5 Light shafts, column, glass, fake reflections
- **Window shafts:** 3 additive quads (6 × 14 m) hinged at the window, pitched 25° down into the room. `a = (1 - v)^1.5 · pow(1 - |2u - 1|, 2) · (0.6 + 0.4·noise(uv·3 + t·0.05))`. A **camera-distance fade** (`smoothstep(1.5, 4, distance(cam, plane))`) prevents hard intersections. `depthWrite:false`. This is `CEL_SHADING` P14 and the cone / frustum card technique [V13].
- **Oculus column:** an open cylinder with `a = pow(abs(dot(N, V)), 2.)` (bright core, soft edges) and scrolling streaks.
- **GlassMat:** `rim = pow(1 - |N·V|, 3)`; colour = tint·rim·1.5 + a baked env reflection (a 256² matcap of the room, rendered once in Blender) at 0.25. Additive. Cheap and readable on mobile.
- **Floor reflections:** baked into the floor texture for static emissives (§7.3), plus a **streak billboard** under the core (vertical, additive, stretched with the core intensity). **High tier only:** drei `MeshReflectorMaterial` at 256 px on the prow-bridge glass deck alone, not on the main floor.
- **Heat haze:** mid/high only, using `ShockWaveEffect` at arrival (already in postprocessing). No scene-copy refraction pass.

### 7.6 Holograms, console UI and interior mapping
**HoloMat** (one `ShaderMaterial`, additive, `depthWrite:false`, defines for options). Sources: the ektogamat holographic material, the Three.js Journey hologram lesson, and the glitch vertex offset from the HOLO.SYS write-up [V14][V15][V16].
```glsl
// vertex: optional slice glitch
float row = floor(position.y*12. + uT*30.);
float g = step(.86, hash(row + floor(uT*12.))) * uGlitch;
transformed.x += (hash(row) - .5) * .08 * g;
// fragment
float fres = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.5);
float scan = .7 + .3*step(.5, fract(vW.y*40. - uT*2.));                // world-space scanlines
float fl   = mix(1., .8 + .2*hash(floor(uT*24.)), uFlicker);            // 24 Hz flicker
vec2  o    = vec2(uChroma, 0.);
vec3  tex  = vec3(texture2D(uMap, vUv+o).r, texture2D(uMap, vUv).g, texture2D(uMap, vUv-o).b);
vec3  c    = mix(uColA, uColB, fres) * (tex + fres*.6) * scan * fl * uIntensity;
gl_FragColor = vec4(c, 1.);   // blending: ONE, ONE
```
- **Console hologram (in-world):** 5 destination cards (0.9 × 0.56, canvas texture rendered once with a generated illustration per destination plus the name) **orbit at r 1.4, y 2.4** above the console and billboard on Y. Hovering a choice in the DOM overlay highlights the matching card in-world. Selecting one plays the Lock beat. Also: a rotating **tesseract-with-handles** holo (§13 I1) and HUD rings.
- **DOM overlay** (accessible, phone-landscape tested): restyle `ConsoleOverlay` as a holo panel: skewed frame, cyan line art, gold title, destination preview image, an "idea" line, and keyboard / gamepad focus. Must follow the project's `!important` CSS rule (memory: preflight gotcha).
- **CRT screens** on the console: a barrel-distorted UV, RGB triad mask, scanlines and a slow roll bar; content is a canvas texture (oscilloscope Lissajous, star map).
- **Data rain:** instanced quads; atlas of 64 math glyphs (∫ ∑ ∂ π φ ∞ √ ≈ ≠ ∇ λ θ 0–9 and our runes) from SVG → PNG (as `VFX_PIPELINE` T10). Per column: `speed = 1 + hash(col)·2`, `glyph = floor(hash(col, floor(row - t·speed))·64)`, a bright head glyph, and a fading tail.
- **Interior mapping** (kiosk side windows) [B10][B11]: in tangent space, cast the view ray into a box of depth `uDepth = 30` behind the glass. Pick the nearest of the x, y and z planes, and sample a **cubemap of the real console room**, rendered once in Blender from the door position at 512² per face (KTX2). Add an inner-glass fresnel, a dirt texture, and a slow parallax-shifting holo sign. Looking in through the side window shows an impossibly deep hall. Cost: one cube fetch plus about 20 ALU on 3 small quads.

### 7.7 Arrival-specific window content (the "fake window to space")
- **Background:** one equirect panorama per destination (2048×1024 KTX2, ≈ 2.7 MB GPU each; 1024×512 on low), rendered in **Blender** (EEVEE procedural nebula + starfield + destination-specific dust) on a **BackSide sphere r 400** centred on the room, `MeshBasicMaterial`, `depthWrite:false`, `fog:false`. The walls and dome hide it everywhere except through the window, so no extra render pass is needed, and it gets natural parallax-free depth.
- **Hero object** at 60–150 m beyond the window (real parallax as you walk, which sells "real window"): Solar (sun shader + planets with **custom fake-lit toon** `PlanetMat`: `ndl = dot(N, normalize(uSunPos - wp))`, stepped by the ramp, **no three.js light**), black hole (existing lensing shader), Lorenz (line + particles), Poincaré disc, tesseract. **All five stay mounted**; only `visible` toggles while the iris is closed.
- **Low tier:** a pre-rendered 6-face cubemap per destination (static), plus the hero object at reduced detail.

---

## 8. Animation list

| # | Object | Motion | Timing / easing |
|---|---|---|---|
| A1 | Kiosk lantern | 4-D rotation xw at 0.35 rad/s + yz at 0.21; ×3 when the player is near | continuous; speed eased over 0.8 s |
| A2 | Kiosk halo | y-spin 0.4 rad/s | continuous |
| A3 | Kiosk door leaves | slide ±0.78 m | open 0.6 s ease-out-back; close 0.5 s ease-in-out, 1.5 s after the player leaves the door volume |
| A4 | Kiosk neon | random group flicker every 6–14 s, 3 blinks | stepped |
| A5 | Hypercore | bob y ± 0.35 at 1.2 rad/s; spin 0.5 rad/s; tesseract 4-D rotation; ×4 during travel | spring back to idle |
| A6 | Gimbal rings | ring 1 about local x, ring 2 about y (inside 1), ring 3 about z (inside 2); rates 1 : φ : φ²; at travel peak they tilt 20° (precession) | spring |
| A7 | Iris blades | 12 blades rotate about their pivots, 0 → 58° closed | 0.15 s ease-in, 0.05 hold, 0.15 s ease-out |
| A8 | Console travel lever | pull 0 → 70° with a ratchet (3 notches), spring-return after travel | 0.35 s; notches every 0.1 s |
| A9 | Console dials | 4-D coordinate dials spin to the destination values | 0.6 s ease-out |
| A10 | Console keys | press-in 0.01 m on interaction | 80 ms |
| A11 | Holo cards | orbit 0.25 rad/s, bob 0.03; on choice the card flies to the core | 0.4 s ease-in |
| A12 | Apertures | pattern modes: idle waves / Hilbert sweep / cascade / alert / destination tint | shader |
| A13 | Turing tape | head steps at 8 Hz idle and 60 Hz during travel; cell flips | stepped |
| A14 | Pendulum wave | analytic θₖ(t) = θ₀ cos(2πt/Tₖ) | 90 s cycle |
| A15 | Foucault pendulum | swing T = 6.95 s (L = 12 m); plane precesses at 15.04°·sin φ per hour × time-lapse factor | analytic |
| A16 | Galton balls | parabolic hops per peg row | 0.12 s per row |
| A17 | Light-shaft dust | drift and wrap | continuous |
| A18 | Cables | sway (shader) | continuous |
| A19 | Reveal camera | crane 1.6 → 6.0 m, pull back 4 m, FOV 50 → 62, look-at the core then the window | 2.5 s, ease-in-out sine; skippable |
| A20 | Travel camera | dolly-zoom + shake | per the Fold timeline |
| A21 | Floor ripple | ring radius r = 6·age, fade over 1.2 s | shader |
| A22 | Orrery | Kepler: solve M = E − e sin E (3 Newton iterations), T² ∝ a³ | time lever ×1…×10⁶ |
| A23 | Möbius conveyor | crates on a parametric path; UV scroll | 0.4 m/s |

---

## 9. "Bigger on the inside" shot list (first entry)

| Beat | Duration | Camera | Light | Sound |
|---|---|---|---|---|
| Promise | — | Free roam; the kiosk is framed by the court; a scale label floats at 2.2 m | Daylight | Court ambience, the kiosk's faint hum (55 Hz) |
| Threshold | 0.3 s | Camera follows the player in; at the plane it **stays low (1.4 m)** for 0.3 s | Vestibule dim; a cyan spill ahead | Exterior audio low-passes 8 k → 600 Hz; footsteps get a short slap echo |
| **Release** | 2.5 s | **Crane up to 6 m and back 4 m; FOV 50 → 62.** Look-at moves from the core (the brightest point) to the great window. The player avatar runs on its own to the dais edge. | The rig tweens to interior idle; the aperture wave runs once from the door to the window | **Chord swell** (Lydian, root A2) + a 3.5 s convolution reverb tail + the room tone fading in |
| Name | 1.5 s | Hold the wide shot; the title card "TESSERACT BOOTH · Bốt Siêu khối" in HoloMat | — | Soft holo chime |
| Hand back | — | Ease back to the follow camera over 0.6 s | — | — |
| **Verify** (prompt) | — | A quest chip: "Step outside and walk round the booth." The holo tape measure appears outside: **"Outside 2.2 m · Inside 28 m · Volume ≈ 850×"** | — | A playful "boing" on the measure |

Later entries: a 0.8 s mini crane and no title card.

---

## 10. Performance rules

### 10.1 Budgets (Impossible zone, hall view)
| | Low | Mid | High |
|---|---|---|---|
| Draw calls (hall) | ≤ 35 | ≤ 50 | ≤ 70 |
| Triangles in view | ≤ 60 k | ≤ 110 k | ≤ 160 k |
| Booth GPU textures | ≤ 12 MB | ≤ 20 MB | ≤ 32 MB |
| Transparent / additive layers in view | ≤ 6 | ≤ 10 | ≤ 14 |
| Shader programs added by the booth | ≤ 16 total (count once at load) | | |
| Frame time on entry and travel | **no frame > 33 ms** (desktop), > 50 ms (phone) | | |

### 10.2 Hard rules
1. **Constant light set.** No `<pointLight>`, `<spotLight>`, `<ambientLight>` or `<directionalLight>` anywhere in booth code. Delete those in `ConsoleRoom`, `SolarSystem` and `HallInterior`. Light changes are colour, intensity and position tweens only. Never toggle `light.visible`.
2. **Keep it mounted.** The exterior, interior, rooms, the 5 destinations, the tunnel and the collage all mount once with the zone. Use `visible` toggles (and `frustumCulled`) for state. The `inside` state flips visibility and collision only. No React mount or unmount on entry or travel.
3. **Precompile.** After the GLBs and textures load, with **every group temporarily visible** and the **final light set** in place: `await gl.compileAsync(scene, camera)` behind the zone loading screen, then restore visibility. Also `gl.initTexture(t)` for each KTX2 and panorama so uploads don't happen on first view. r187 compiles hidden objects anyway (`scene.traverse`), but texture upload happens on first draw, so do a one-frame warm render of the destinations behind the loading screen too.
4. **No program-key changes at runtime.** Don't toggle `fog`, `Fog` ↔ `FogExp2`, `material.map` null ↔ texture, `vertexColors`, `envMap`, `transparent` ↔ `alphaTest`, clipping-plane count, `toneMapped`, or `defines`. Use uniforms instead.
5. **Post-processing chain is fixed per tier.** Effects used in travel (CA, ShockWave) are always present with neutral parameters.
6. **Unlit destinations.** Window content uses `MeshBasicMaterial` or custom `ShaderMaterial` without `lights:true`.
7. **Instancing:** apertures (2 draws), stair steps, railing posts, books, Turing cells, pendulums, Galton balls, dust, glyphs, HUD rings.
8. **Merge static geometry by material** (`gltf-transform join`) plus the palette texture, so the shell is ≤ 3 draws.
9. **No allocations in `useFrame`** (as in `TECH.md`). Reuse vectors; pattern logic runs in shaders.
10. **Material instances are cached per GLB** (make `toonize` memoised at module level, keyed by the GLB URL). `StencilPortal` clones are created once at zone load, not on mount.
11. **Text:** pre-bake the title and sign textures. No troika text generation on entry.

### 10.3 Acceptance tests
- `renderer.info.programs.length` is the same **before entry, after entry, and after each of the 5 travels**. Add this as an e2e check via a debug hook on `/world/preview`.
- A Chrome Performance trace of walking through the door has no long task > 50 ms.
- `renderer.info.render.calls` in the hall's wide shot is within budget per tier.

### 10.4 Door portal and lite proxy
- Keep `StencilPortal` (the stencil approach Valve uses [B3]). Its content is a **lite proxy**: one merged mesh of the shell + console + core silhouette (≤ 8 k tris, same palette material, so no new program), the apertures `InstancedMesh` (shared), and the window panorama sphere. Interior detail is hidden behind the portal.
- `MeshPortalMaterial` (drei) renders to a texture, which costs an extra full scene pass [T4]. Prefer stencil.

---

## 11. SFX list (procedural WebAudio in `lib/world/sfx.ts`; no samples, no copyright)

| ID | Event | Synthesis | Notes |
|---|---|---|---|
| S1 `kioskHum` | near the kiosk (loop) | 55 Hz sine + 82.5 Hz (fifth) at −24 dB, 0.2 Hz AM | Gain by distance |
| S2 `doorSlide` | A3 | bandpass noise sweep 1.2 k → 300 Hz over 0.5 s + a low "clunk" (80 Hz sine, 60 ms) | |
| S3 `threshold` | crossing | a whoosh (noise 6 k → 400), a master low-pass sweep, a switch to a **convolution reverb** (generated impulse: exponential-decay noise, 3.5 s) | The reverb stays on inside |
| S4 `revealChord` | first entry | additive pad: A2–E3–A3–C♯4–D♯4 (Lydian ♯4), slow attack 0.8 s, 4 s | |
| S5 `roomTone` | inside (loop) | two detuned saws through a low-pass 400 Hz + a 0.08 Hz filter LFO, −28 dB; tiny random "aperture ticks" (2 kHz blips, 1 per 3 s) | |
| S6 `coreThump` | each core bob bottom | 50 Hz sine thump 120 ms, −20 dB | Speeds up during travel |
| S7 `consoleKey` / `dial` / `lever` | A8–A10 | click: a 3 kHz square at 15 ms; dial: a fast click train; lever: 3 ratchet clicks + a spring "twang" (sine 300 → 180 Hz) | |
| S8 `holoHover` / `holoSelect` | UI | sine blips on `PENTA`; select = two-note up-chime | Reuse `chime` |
| S9 **`foldRise`** | travel 0.4–3.0 s | **Shepard–Risset glissando**: 8 sine partials an octave apart, fᵢ = f₀·2^((i + t/T) mod 8), gain = exp(−(log₂fᵢ − c)²/(2σ²)), T = 2 s/octave [S1][S2] | Original "endless ascent". It replaces any "vworp". |
| S10 `foldPressure` | 1.6–3.0 s | low-passed noise rumble 60–200 Hz, rising | |
| S11 `irisSnap` | 2.7 s | metallic shutter: 12 tiny clicks over 150 ms + a band-noise "shhk" | |
| S12 `arrive` | 3.05 s | a bright bell (inharmonic partials 1, 2.76, 5.4) + a **reverse cymbal** (noise with a rising envelope, 0.6 s) **into** the hit + a 40 Hz sub drop | Replaces `shatter()` here |
| S13 `destChord` | settle | destination mode: Solar = major, Event Horizon = Phrygian drone, Lorenz = whole-tone, Hyperbolic = Lydian, Tesseract = augmented | |
| S14 `alert` | error / blocked | two-tone 880/660 Hz pulse | `alert` colour |
| S15 catalogue sounds | pendulums (soft ticks pitched by length), Galton pegs (pentatonic by row), Lissajous harp (pure ratio tones), Foucault pegs falling, page rustle (Library) | per item | |

Mix: master −6 dB headroom, ducking of the room tone during travel, and all loops stop when `sfx` is disabled.

---

## 12. Build order (step by step)

| Step | Work | Output | Done when |
|---|---|---|---|
| **0** | **Stutter fix, no new art**: remove booth lights; keep `ConsoleRoom`, `Universe` and all destinations mounted with `visible` toggles; tween the global rig; precompile; cache `toonize`; make `PlanetMat` unlit | Same visuals, no hitch | §10.3 programs count is constant; no long task on entry or travel |
| 1 | **Blender blockout** of the hall at the exact §4 dimensions (grey boxes); export; walk test at scale; tune the stairs, bridge and collision | `booth_room.glb` v0 | The reveal camera frames the core + window; stairs walkable; collision updated |
| 2 | **Hyperkiosk** model + palette + neon + lantern shader + door animation + ground light pool | `booth_ext.glb` | Reads at 50 m; legal checklist §2.2 passes |
| 3 | **Console (pentagon) + Hypercore + gimbals** hero modelling; brass matcap; vertex-colour bake | in `booth_room.glb` | The core is the brightest value in the room |
| 4 | **Shell detailing + bake**: ribs, mezzanine, window frame + iris, cables, props; palette texture; join | `booth_room.glb` v1 | ≤ 3 draws for the shell |
| 5 | **Apertures** (instanced, shader modes) + **Penrose floor** (bake script + shader) | 2 + 1 draws | Patterns and tile glow work on low tier |
| 6 | **Lighting pass**: rig values, light pools, shafts, dust, caustics, fog haze; screenshot A/B with `CEL_SHADING` P2/P3 | — | Value plan §6.4 holds in greyscale |
| 7 | **Window**: Blender panoramas ×5 + hero objects unlit + iris | KTX2 panoramas | All 5 compiled at load; travel swap invisible |
| 8 | **The Fold** timeline + tunnel + CA + collage + arrival cascade + title cards | — | No frame spikes; 4.8 s feels great |
| 9 | **Holograms**: HoloMat, console cards, DOM overlay restyle (phone landscape), CRTs, data rain, HUD rings | — | UI checked at 844×390 |
| 10 | **Interior mapping** cubemap (Blender) for the kiosk windows; lite proxy for the portal | — | Side windows show the deep hall |
| 11 | **SFX** S1–S14 | `sfx.ts` additions | Mix balanced; Shepard rise is convincing |
| 12 | **Build-first catalogue** (§13 ★): Penrose floor ✓(5), apertures ✓(5), gimbals ✓(3), tesseract handles, Mandelbrot portal, pendulum wave, Galton board, double slit | — | Each has an EN/VI card + interaction |
| 13 | **Rooms**: Library of Babel, Star-chart / Orrery, Observatory nook, Escher landing | `booth_rooms.glb` | Rooms precompiled; trigger volumes |
| 14 | Remaining catalogue items by tier | — | — |
| 15 | **Device pass**: mid Android + old iPhone; tier gating; e2e (programs count, draw calls) | — | Budgets §10.1 met |

Per `CLAUDE.md`: this file acts as the PLAN for the feature. Gemini review only if the user asks. Run `tsc`, `eslint`, `npm test`, and `npm run test:e2e` with `BASE_URL` after any UI change.

---

## 13. Mind-blow catalogue

Each item lists: **what the student sees** · **the concept** · **the interaction** · **the three.js sketch** · **cost** (dev days / runtime). Runtime cost: **S** ≤ 2 draws, negligible CPU; **M** 3–6 draws or a per-frame CPU loop; **L** an extra render pass or a large asset. ★ = **build first** (best wow per cost; 8 items).

### Tier H: hero moments (set pieces you remember)

**H1 ★ The Gimbal Hypercore**
- *Sees:* three colossal brass rings (Ø4–6.4 m) turning around the glass core, never repeating, then wobbling and precessing when the booth "folds".
- *Concept:* **gyroscopic precession** (Ω = τ / (I·ω)) and **gimbal lock**: when two rings align, one rotational freedom disappears, which is why 3-D games use **quaternions**.
- *Interact:* at the gyro station, "align ring 2" causes gimbal lock: the core wobbles, and a holo explains why Euler angles fail. A toggle switches to "quaternion mode" (smooth).
- *Sketch:* three nested `Object3D`s; rates 1 : φ : φ²; the lock demo animates ring 2 to 90°.
- *Cost:* 1 d · S (3 draws, 2.7 k tris).

**H2 ★ Mandelbrot Portal**
- *Sees:* a round portal (Ø3 m) on the mezzanine NE wall whose frame is the main cardioid, plunging endlessly into seahorse spirals.
- *Concept:* **z → z² + c** in the **complex numbers** (on the grade-12 VN curriculum), escape-time iteration, self-similarity, the boundary has Hausdorff dimension 2.
- *Interact:* step on the pad to steer the zoom target; a "Julia mode" morphs the Julia set as c follows your position.
- *Sketch:* a fragment shader on a disc, 96 iterations on low and 256 on high, smooth colouring through a 256 px palette ramp. fp32 runs out at about 10⁴–10⁵ magnification, so **loop the zoom** (zoom 10³ into a self-similar spiral, crossfade to the start). Optionally a 2-float emulation on high.
- *Cost:* 1 d · S (one disc; the fragment cost is capped by the disc's screen area).

**H3 Penrose Staircase (Escher landing)**
- *Sees:* a square stairwell where climbing four flights brings you back to the start, while the Shepard tone keeps rising.
- *Concept:* the **impossible object** (Penrose stairs, 1958); "height" is locally consistent but **globally inconsistent**; the **Shepard tone** is its audio twin.
- *Interact:* climb as long as you like; the counter reads "floors climbed: 37 · height gained: 0 m". A hidden way out: walk **down** (it echoes the Loop Corridor lesson).
- *Sketch:* four flights; after each lap, teleport the player down one lap's height (the same trick as `LoopCorridor`). The geometry is drawn twice, stacked, so the seam is never seen. S9 plays continuously.
- *Cost:* 1.5 d · S.

**H4 The Triangle with Three Right Angles (non-Euclidean room)**
- *Sees:* a triangular room with three doors. Walk A → B → C and you're back at A, having turned 270°, not 180°.
- *Concept:* **spherical geometry**, angle excess, and **Gauss–Bonnet** (area = excess × R²); the Earth's "triangle" from the North Pole to two equator points.
- *Interact:* walk the loop; a compass needle you carry rotates 90° per lap (**holonomy**).
- *Sketch:* three `StencilPortal` doorways with teleport transforms that rotate by 90° (the Antichamber-style portal links [B5]).
- *Cost:* 3 d · M–L (portal passes).

**H5 Library of Babel**
- *Sees:* endless hexagonal galleries of glowing books, an air shaft with a pendulum dropping into the void.
- *Concept:* **combinatorics**: Borges' library has every 410-page book (40 lines × 80 characters = 1 312 000 characters, 25 symbols), so **25^1 312 000 ≈ 10^1 834 097 books**; bijections and encoding.
- *Interact:* open any book to see a deterministic random page. **Search** your name and the library gives the hexagon, wall, shelf, volume and page where it appears (an invertible map, as libraryofbabel.info does [M1]).
- *Sketch:* one `InstancedMesh` of 640 books per hexagon; galleries loop via teleport. Page text = a seeded PRNG of the address. Search = encode the text as a base-29 big-int, then apply an invertible affine map mod 29^N to get the address.
- *Cost:* 3 d · S per hexagon.

**H6 Klein-Bottle Fountain**
- *Sees:* a 3-m glass Klein bottle on the main floor (225°, r 8). Glowing water runs down the outside, dives through its own neck and comes out of the base on the inside, with no inside and no outside.
- *Concept:* a **non-orientable closed surface**. It cannot be embedded in 3-D without self-intersection; in 4-D it can.
- *Interact:* drop an "ink bead"; it travels the surface and returns **mirror-flipped** (a hologram arrow shows the handedness).
- *Sketch:* parametric bottle immersion modelled in Blender; `GlassMat` + a "water" layer that is the same surface offset 0.01 with **UV scrolling along the u parameter** (flow) + foam at the neck. The bead follows the (u, v) path with the frame computed from the derivatives.
- *Cost:* 2 d · S–M (transparency: 2 sorted layers).

**H7 Hopf Fibration Sculpture**
- *Sees:* hanging between the core and the window, nested tori made of glowing circles, **every circle linked with every other exactly once**.
- *Concept:* the **Hopf map S³ → S²**: each point on a sphere corresponds to a whole circle in 4-D, made visible by stereographic projection. The same structure describes **qubit states** (the Bloch sphere).
- *Interact:* a small globe on a pedestal. Draw a latitude on it and the matching torus of fibres lights up; tap a point and its single fibre glows.
- *Sketch:* fibre over (a, b, c) ∈ S²: ξ(θ) = (1/√(2(1+c)))·((1+c)cos θ, a sin θ − b cos θ, a cos θ + b sin θ, (1+c) sin θ), then project (x₁, x₂, x₃)/(1 − x₄) [M2][M3]. 200 fibres × 64 segments in one `LineSegments` (or fat lines on high) with vertex colours by base point.
- *Cost:* 1.5 d · S (1 draw, 12.8 k segments).

**H8 Droste Booth (recursion)**
- *Sees:* on the console, a tiny model of the kiosk whose door shows this room, with an even tinier kiosk on its console, forever.
- *Concept:* **recursion and fixed points**; the **Droste effect**; Escher's *Print Gallery* (a conformal log-polar map) [M4].
- *Interact:* lean in and the camera zooms through the levels, which seem to never end.
- *Sketch:* render the hall from a mini camera into a 256² target every 2nd frame. The mini screen samples **the previous frame's target**, so recursion appears for free (video feedback; Portal's "copy the last frame" trick [B4]). Mid/high only; low uses a baked 8-frame flipbook.
- *Cost:* 1 d · L (an extra small pass).

### Tier A: ambient wonders (make the space feel colossal and alive)

**A1 ★ Phyllotaxis apertures.** *Sees:* hundreds of lights spiralling over the wall and dome like a sunflower. *Concept:* the **golden angle 137.508°**; **Fibonacci** parastichies (8, 13, 21); why an irrational rotation packs best. *Interact:* the console "pattern" key cycles modes; one mode lights the Fibonacci-numbered apertures only. *Sketch:* §4.1, §7.1, 2 instanced draws. *Cost:* 1 d · S.

**A2 ★ Penrose floor.** *Sees:* a gleaming floor of two diamond shapes that never repeats; tiles glow and ripple under every step. *Concept:* an **aperiodic tiling**, 5-fold symmetry, the thick:thin ratio → **φ**; a link to quasicrystals (Nobel Prize 2011) and the 2023 "hat" einstein tile. *Interact:* the walking ripple; a holo "find a repeat" challenge (there is none). *Sketch:* §7.3. *Cost:* 1.5 d · S.

**A3 Turing tape ring.** *Sees:* a ring of 256 light cells round the dome base, with a brass head clicking along and flipping cells. *Concept:* the **Turing machine**, the halting problem, and **Busy Beaver BB(5) = 47 176 870 steps**, proven in 2024 with a Coq proof [M5][M6]. *Interact:* load a program (binary counter, BB(4), BB(5)); the step counter shows that BB(5) at 60 steps/s would take about 9 days. *Sketch:* instanced cells with a per-instance colour updated on change only; the head is one mesh. *Cost:* 1 d · S.

**A4 ★ Pendulum wave.** *Sees:* 24 brass bobs hanging under the mezzanine NW edge, forming snakes, double helices and chaos, then realigning every 90 s. *Concept:* superposed frequencies, **beats**, aliasing. Design: bob k completes **Nₖ = 29 + k** swings per Γ = 90 s, so Tₖ = Γ/Nₖ and **Lₖ = g·Tₖ²/(4π²)**. k = 1 gives T = 3.00 s, L = 2.24 m; k = 24 gives T = 1.70 s, L = 0.72 m [M7]. *Interact:* a "release" lever restarts them all in phase. *Sketch:* analytic angles; an instanced bob plus instanced strings (as thin boxes). *Cost:* 0.5 d · S.

**A5 Foucault pendulum** (Library air shaft). *Sees:* a 12-m pendulum (T = 6.95 s) whose swing plane slowly turns and knocks over a ring of pegs. *Concept:* **Earth's rotation**; precession of 15.04°·sin φ per hour, so **Hà Nội (21.03° N) ≈ 5.4°/h** (a full turn in ≈ 67 h) and **TP.HCM (10.82° N) ≈ 2.8°/h**; 0 at the equator, 15°/h at the pole [M8]. *Interact:* a latitude dial and a time-lapse lever (×3600). *Sketch:* analytic plane angle; pegs are instanced with a tip animation. *Cost:* 0.5 d · S.

**A6 Brass Orrery** (Star-chart room). *Sees:* a 6-m orrery with planets sweeping out glowing **equal-area wedges**. *Concept:* **Kepler's laws** (ellipses; equal areas in equal times; T² ∝ a³); solving **Kepler's equation** M = E − e sin E. *Interact:* the time lever, and an eccentricity slider on a "student planet". *Sketch:* Newton iterations; wedge = a fan mesh updated each 0.5 s. *Cost:* 1.5 d (Blender model) · S.

**A7 Catenary cables and arches.** *Sees:* cables drooping between the ribs; the vestibule arch is an inverted chain curve. *Concept:* **y = a·cosh(x/a)** versus a parabola (Galileo got it wrong); Gaudí's hanging-chain models. *Interact:* a holo overlay compares cosh and parabola fits on one cable. *Sketch:* geometry generated from cosh at build time. *Cost:* 0.3 d · S.

**A8 Game of Life grating.** *Sees:* cells glowing under the glass grating ring, gliders crawling round the console. *Concept:* **cellular automata**, emergence, the Game of Life is Turing complete. *Interact:* your footsteps seed cells; a "glider gun" button. *Sketch:* a 128×16 polar grid, CPU update at 8 Hz into a `DataTexture` (2 k cells). *Cost:* 0.5 d · S.

**A9 Ulam-spiral dome mode.** *Sees:* one aperture pattern lights only the **primes** along an Ulam-style spiral, and diagonal streaks appear. *Concept:* the **prime distribution**, quadratic polynomials rich in primes (Euler's n² + n + 41). *Interact:* a console key. *Sketch:* an aperture pattern mode with a prime flag attribute. *Cost:* 0.2 d · S.

**A10 Möbius conveyor** (Library). *Sees:* a belt carrying books that come back upside down after one loop and upright after two. *Concept:* **non-orientability**; 720° to return (also related to the "plate trick" and spin ½). *Interact:* put a book on; count laps. *Sketch:* Möbius mesh with UV scroll; crates along the parametric path with a frame from the derivatives (the normal flips after one loop). *Cost:* 1 d · S.

**A11 Ames vestibule** (optional variant of the entry). *Sees:* from the door, the vestibule looks rectangular, but a friend walking across it **grows and shrinks**. *Concept:* **projective geometry**; perspective ambiguity is literally "bigger and smaller". *Interact:* a co-op photo spot with a peephole camera. *Sketch:* a trapezoidal room modelled for one viewpoint; the camera locks to the peephole. *Cost:* 1.5 d · S.

**A12 Gravitational-lens sphere** (Observatory nook). *Sees:* a black glass marble that bends the room behind it into an **Einstein ring**. *Concept:* **general relativity**, deflection α = 4GM/(c²b) (1.75″ at the Sun's limb; Eddington 1919). *Interact:* a mass slider grows the ring. *Sketch:* a sphere shader computing the deflected ray and sampling a **static cubemap of the nook** (baked once) plus the star panorama. *Cost:* 0.5 d · S.

### Tier I: small interactables (hands-on, 30–90 s each)

**I1 ★ Tesseract with handles** (console hologram). *Sees:* a 4-D cube; drag a handle and the inner cube turns inside-out through the outer one. *Concept:* 4-D rotations happen **in planes, not around axes**: six planes (xy, xz, xw, yz, yw, zw); projection from 4-D to 3-D. *Interact:* six handle rings; the w-plane handles do the impossible ones. *Sketch:* reuse `TimeRotor`'s projection code; handles are torus pickers; HoloMat lines. *Cost:* 0.5 d · S.

**I2 ★ Galton board** (main floor wall, 36°). *Sees:* a 4-m board of pegs; 400 glowing balls cascade and stack into a **bell curve**. *Concept:* **binomial → normal** (de Moivre–Laplace / CLT), Pascal's triangle. *Interact:* a drop button and a **tilt** lever (p ≠ ½ skews the bell). *Sketch:* no physics engine; each ball picks L/R per row with probability p and hops on parabolas; bins count; one `InstancedMesh`. *Cost:* 0.5 d · S.

**I3 ★ Quantum double slit** (main floor wall, 60°). *Sees:* single dots hit a screen one at a time, and slowly **interference fringes** emerge. Switch on the "which-path detector" and the fringes vanish. *Concept:* **wave–particle duality**; fringe spacing Δy = λL/d; I(y) ∝ cos²(πdy/(λL))·sinc²(πay/(λL)). *Interact:* a detector switch and a slit-gap slider. *Sketch:* rejection-sample y from I(y) and splat dots into a 256×64 accumulation `DataTexture`. *Cost:* 0.5 d · S.

**I4 Lissajous laser harp** (main floor, 300°). *Sees:* six beams; touching two draws a figure on the wall. 3:2 makes a pretzel, and you *hear* a perfect fifth. *Concept:* **frequency ratios** in music and in curves: x = sin(at + δ), y = sin(bt). *Interact:* touch the beams; a phase knob animates δ. *Sketch:* the curve is computed in the vertex shader from the vertex index (zero CPU); tones from S15. *Cost:* 0.5 d · S.

**I5 Light clock** (prow bridge rail). *Sees:* two photon clocks; the one riding the rail at speed ticks **slower**. *Concept:* **special relativity** via Pythagoras: γ = 1/√(1 − v²/c²). *Interact:* a v slider up to 0.99c; a twin-clock readout. *Sketch:* analytic photon zig-zag; a γ label. *Cost:* 0.5 d · S.

**I6 Schrödinger's box** (Observatory nook; kid-friendly: a **sleepy cat plush, "asleep / awake"**, never dead or alive). *Sees:* a box with both cats ghosted at 50% plus amplitude bars. *Concept:* superposition, **measurement**, probability = |amplitude|²; a Bloch-sphere dial. *Interact:* set amplitudes, open the box, and run 100 trials to build a histogram. *Sketch:* HoloMat ghosts; seeded RNG. *Cost:* 0.5 d · S.

**I7 Chladni plate** (console station 5). *Sees:* sand dancing into nodal patterns on a brass plate. *Concept:* **standing waves, eigenmodes** (the same maths as drums and orbitals): nodal lines of cos(nπx)cos(mπy) − cos(mπx)cos(nπy) (square-plate approximation). *Interact:* a frequency knob snaps to modes (m, n). *Sketch:* 3 k points; each moves along −∇|f| plus jitter; CPU at 30 Hz. *Cost:* 0.5 d · S–M.

**I8 Brachistochrone race** (Star-chart room). *Sees:* three balls on a straight ramp, a circular arc and a **cycloid**; the cycloid wins, even though it is longer. *Concept:* the **calculus of variations** (Bernoulli 1696); the tautochrone (any start height, same arrival time). *Interact:* drag the start heights. *Sketch:* integrate v = √(2g·Δy) along each curve's arclength. *Cost:* 0.5 d · S.

**I9 Fourier epicycles** (Star-chart wall). *Sees:* spinning circles on circles drawing a shape: the Math World logo, the map of Việt Nam, or your own doodle. *Concept:* **Fourier series / DFT**; any closed curve is a sum of rotations. *Interact:* draw on the DOM pad; a slider for the number of circles. *Sketch:* DFT on 256 points; N circles as one instanced ring set + a trail ribbon. *Cost:* 1 d · S.

**I10 Hilbert-curve corridor** (east corridor floor). *Sees:* a light path that folds into finer and finer turns as you walk, until it seems to fill the floor. *Concept:* the **space-filling curve**, a continuous map [0,1] → [0,1]²; locality (used in databases and GPU caches). *Interact:* walking advances the order 1 → 5 (32×32 = 1 024 cells). *Sketch:* the path is pre-rasterised per order into a `DataTexture` holding arclength; the floor shader reveals `s < progress`. *Cost:* 0.5 d · S.

**I11 Double pendulum twins** (Observatory nook). *Sees:* two double pendulums released 0.001 rad apart, identical at first, then totally different. *Concept:* **chaos**, sensitive dependence (it ties to the Lorenz destination). *Interact:* a release button and a "difference" slider. *Sketch:* RK4 at 240 Hz substeps. *Cost:* 0.5 d · S.

**I12 Hilbert's Hotel doors** (west corridor). *Sees:* doors numbered 1, 2, 3, …; a bus of infinitely many guests arrives; every guest moves n → 2n and all odd rooms free up. *Concept:* **countable infinity**, bijections, |ℕ| = |2ℕ|. *Interact:* "Bus arrives" plays the holo guest shuffle. *Sketch:* instanced holo silhouettes along the corridor (it looks infinite with fog). *Cost:* 1 d · S.

**I13 Zeno's door** (Observatory nook entrance, a playful gate). *Sees:* the door keeps backing away by half the remaining distance. *Concept:* the **convergent series** ½ + ¼ + … = 1; the paradox dissolves with limits. *Interact:* walking at constant speed, you arrive in exactly 2 s; the HUD shows the partial sums. *Sketch:* the door offset is driven by the player's distance. *Cost:* 0.3 d · S.

**I14 Infinity-mirror kaleidoscope** (Library ↔ hall junction). *Sees:* a corridor of mirrored triangles reflecting into an infinite crystal. *Concept:* **reflection groups**; the 17 wallpaper groups; the triangle groups that also generate the Poincaré destination. *Interact:* change the mirror angles (60°, 45°, 36° → different symmetries). *Sketch:* duplicated, mirrored instances of the corridor content, faded with depth (no real mirrors). *Cost:* 1 d · M.

### Build-first set (★) and why
| # | Item | Wow | Cost | Reason |
|---|---|---|---|---|
| 1 | A2 Penrose floor | Very high: it is the whole floor | 1.5 d · S | Replaces the ugliest surface; interactive for free |
| 2 | A1 Phyllotaxis apertures | High | 1 d · S | Replaces ≈ 112 roundel draw calls with 2; signature identity |
| 3 | H1 Gimbal Hypercore | Very high: the centrepiece | 1 d · S | The focal point of the room; quaternion lesson |
| 4 | I1 Tesseract handles | High | 0.5 d · S | Code exists; core "4-D" identity |
| 5 | H2 Mandelbrot portal | Very high | 1 d · S | One shader; complex numbers are on the curriculum |
| 6 | A4 Pendulum wave | High (mesmerising) | 0.5 d · S | Analytic; visible from everywhere |
| 7 | I2 Galton board | High | 0.5 d · S | CLT made physical; satisfying |
| 8 | I3 Double slit | Very high (truly mind-blowing) | 0.5 d · S | Tiny cost; the deepest idea per minute |

Next wave: H7 Hopf, H3 Penrose stairs, A5 Foucault, I5 light clock, I4 Lissajous harp, A3 Turing tape, then the rooms (H5 Library, A6 Orrery), then H4, H6, H8.

### Placement summary
Main floor: Hypercore + gimbals (centre), console + holo tesseract + Chladni (dais), Penrose floor, Game of Life grating, Klein fountain (225°, r 8), Galton (wall 36°), double slit (wall 60°), Lissajous harp (wall 300°). Mezzanine: Mandelbrot portal (wall 45°), pendulum wave (NW railing 300°–330°), prow bridge light clock (0°), Hopf sculpture (hanging, y 10, between the core and the window). Dome: apertures (Ulam mode), Turing tape, catenary cables. Rooms: Library (Babel, Foucault, Möbius, Hilbert's Hotel corridor, kaleidoscope junction), Star-chart (orrery, brachistochrone, Fourier, Hilbert corridor floor), Observatory nook (lens sphere, Schrödinger, double pendulum, Zeno's door), Escher landing (Penrose stairs), later the triangle room.

---

## 14. Asset sourcing notes
- **3-D:** all architecture, the console, kiosk and brass props are **Blender-made** via Blender MCP (memory: "no code-drawn art"). The Quaternius CC0 kit can supply small props (crates, chairs, books) and must be credited in `public/world/CREDITS.md`.
- **2-D:** destination card illustrations (5), title card art and the matcap paintings come from Codex image generation per the project pipeline; glyph atlases come from SVG → PNG scripts. Panoramas are Blender renders (image models don't tile equirects reliably).
- **Generated layouts** (phyllotaxis positions, Penrose tiling, Hilbert paths, Hopf fibres, catenaries) are **math-computed placement of Blender-made meshes** or baked textures, not primitive "code art".

---

## Sources

**TARDIS references**
- [R3] The Doctor Who Site, Series One TARDIS interior: https://thedoctorwhosite.co.uk/tardis/interior/series-1-interior/
- [R4] TARDIS wiki, control room (Rose), six coral pillars in a hexagon *(community)*: https://tardis.wiki/wiki/TARDIS_control_room_(Rose)
- [R5] Doctor Who Cuttings Archive, "Mr TARDIS" (6.5 m interior): https://cuttingsarchive.org/index.php/Mr_TARDIS
- [R6] SFX, "Total Control" (two floors, three tiers): https://www.pressreader.com/australia/sfx/20180912/282071982794478
- [R7] The Doctor Who Companion, "TARDIS console rooms then, now and soon": https://thedoctorwhocompanion.com/2019/04/28/tardis-console-rooms-then-now-and-soon/
- [R8] The Doctor Who Site, Series Seven interior (Pickwoad, 18 ribs, contra-rotating rings, LHC): https://thedoctorwhosite.co.uk/tardis/interior/series-7-interior/
- [R9] The Doctor Who Site, Series Eight interior: https://thedoctorwhosite.co.uk/?p=3009 ; Cuttings Archive "Take a deep breath…": https://cuttingsarchive.org/index.php/Take_a_deep_breath_for_dangerous_new_Doctor_Who
- [R10] TARDIS wiki, control room (The Ghost Monument) *(community)*: https://tardis.wiki/wiki/TARDIS_control_room_(The_Ghost_Monument) ; Gizmodo: https://gizmodo.com/take-an-up-close-look-at-doctor-whos-gorgeous-new-tardi-1829793686 ; Lovarzi blog: https://blog.lovarzi.co.uk/?p=4307
- [R11] SFX "Inside the spaceship" (Phil Sims, Stage 6, 50 ft, iris doors, triangular roundel panels): https://gb.readly.com/magazines/sfx/2023-12-29/658778713783360263b95c24
- [R12] Doctor Who TV, "impossible, logic-defying" interior: https://www.doctorwhotv.co.uk/the-new-tardis-interior-is-impossible-97993.htm
- [R13] Den of Geek, RTD on the new TARDIS (individually controlled LED roundels): https://www.denofgeek.com/tv/russell-t-davies-explains-what-inspired-the-new-tardis ; The Doctor Who Site, 60th interior: https://thedoctorwhosite.co.uk/tardis/interior/60th-anniversary-interior/

**Legal**
- [L1] The Scotsman, "The Doctor's trademark success story investigated": https://www.scotsman.com/business/the-doctors-trademark-success-story-investigated-2478045
- [L2] Hello! (Oct 2002), "Dr Who celebrates victory in TARDIS tussle": https://www.hellomagazine.com/celebrities/20021023624370/drwho/
- [L3] Stephen van Dulken, "Doctor Who and trade marks": https://stephenvandulken.blogspot.com/2013/11/doctor-who-and-trade-marks.html
- [L4] Slashdot, "TARDIS wars: the BBC strikes back" *(unverified)*: https://yro.slashdot.org/story/15/09/28/135249/tardis-wars-the-bbc-strikes-back
- [L5] Legends Revealed, did the BBC buy the trade mark? (no): https://legendsrevealed.com/entertainment/2013/05/15/did-the-bbc-buy-the-trademark-to-blue-police-boxes-from-the-metropolitan-police
- [L6] Bananas for Scale, police box ≈ 2.7 × 1.37 m: https://sean-reid.github.io/bananas-for-scale/thing/tardis-exterior/ ; Wikipedia, Police box: https://en.wikipedia.org/wiki/Police_box

**Visual and VFX references**
- [V1] Świerad et al., "The Tech and Art of Cyberspaces in Cyberpunk 2077", SIGGRAPH 2021: https://history.siggraph.org/?p=75737
- [V3] StudioBinder, Blade Runner 2049 cinematography: https://www.studiobinder.com/blog/blade-runner-2049-cinematography-analysis/
- [V4] Pixflow, recreating the 2049 look: https://pixflow.net/blog/analyzing-blade-runner-2049s-cinematography/ ; ASC: https://theasc.com/articles/blade-runner-2049-designing-the-future
- [V5] Game Developer, Endfield interview: https://www.gamedeveloper.com/press-release/arknights-endfield-reimagined-an-in-depth-interview-with-light-zhong-and-yifeng-huang
- [V6] Pocket Gamer, Endfield beta preview: https://www.pocketgamer.com/arknights-endfield/preview-beta-2-0
- [V7] PC Gamer, Edgerunners intro: https://pcgamer.com/heres-the-flashy-intro-to-netflixs-upcoming-cyberpunk-2077-anime
- [V8] AWN, "Edgerunners: a vibrant ode to retro anime": https://awn.com/animationworld/cyberpunk-edgerunners-vibrant-ode-retro-anime
- [V9] PC Gamer, ZZZ review: https://pcgamer.com/games/rpg/zenless-zone-zero-review
- [V10] PCGamesN, ZZZ review: https://www.pcgamesn.com/zenless-zone-zero/review
- [V11] Siliconera, Penacony behind-the-scenes video: https://www.siliconera.com/honkai-star-rail-penacony-video-shows-behind-the-scenes/
- [V12] Issuu zine, Witch's Labyrinths by Gekidan INU Curry: https://issuu.com/samika2023/docs/zine_magical/s/29261895
- [V13] Aki Aoki, fake volumetric light (extruded window volume): https://medium.com/@akidevcat/volumetric-lighting-in-unity-using-shader-graph-463864ba5462
- [V14] ektogamat, threejs holographic material: https://github.com/ektogamat/threejs-holographic-material
- [V15] Three.js Journey, Hologram shader lesson: https://www.threejs-journey.com/lessons/hologram-shader
- [V16] HOLO.SYS write-up (vertex glitch): https://dev.to/yasirawan4831/building-holosys-a-futuristic-3d-holographic-visualization-system-with-react-threejs-glsl-oea

**"Bigger on the inside" and impossible spaces**
- [B1] WhatCulture, meta Doctor Who moments: https://whatculture.com/tv/10-most-meta-doctor-who-moments-ever?page=4
- [B2] The Doctor Who Companion, a potted history of TARDIS introductions: https://thedoctorwhocompanion.com/2019/03/24/bigger-on-the-inside-a-potted-history-of-tardis-introductions/
- [B3] Game Developer, "Inside the making of Portal": https://gamedeveloper.com/game-platforms/exclusive-inside-the-making-of-i-portal-i-
- [B4] Rendering "Portal" (stencil recursion): https://torinmr.github.io/cs148 ; CS50 Games notes: https://cs50.harvard.edu/games/2018/notes/11
- [B5] GTS 2021 paper on impossible spaces (Antichamber portals): https://opus.bibliothek.uni-wuerzburg.de/files/24604/2021-GTS-Proceedings_05-paper.pdf
- [B6] University of Minnesota, stencil-buffer impossible spaces: https://conservancy.umn.edu/server/api/core/bitstreams/a568a570-5af2-4385-934d-0257bdb4fdf3/content
- [B7] Wikipedia, Superliminal: https://en.wikipedia.org/wiki/Superliminal
- [B8] Bullet Points Monthly, "Breaking out of Prey's glass box": https://bulletpointsmonthly.com/2017/05/11/breaking-out-of-preys-glass-box/
- [B9] Wikipedia, Shepard tone (Mario 64 stairs): https://en.wikipedia.org/wiki/Shepard_tone
- [B10] Game Developer / 80.lv, interior mapping (van Dongen): https://gamedeveloper.com/programming/interior-mapping-rendering-real-rooms-without-geometry
- [B11] Alan Zucconi, interior mapping: https://www.alanzucconi.com/?p=10105 ; UDK gem: https://docs.unrealengine.com/udk/Three/DevelopmentKitGemsInteriorMapping.html

**Tech**
- [T1] three.js forum, "Dynamically disable/enable lights at runtime": https://discourse.threejs.org/t/dynamically-disable-enable-lights-at-runtime/6545
- [T2] three.js forum, "Point lights and performance, revisited" (fixed light pool, recompiles, portals): https://discourse.threejs.org/t/point-lights-and-performance-revisited/49316 ; "Scene freezes when adding PointLight": https://discourse.threejs.org/t/scene-freezes-when-adding-dynamically-pointlight/28281
- [T3] three.js docs, `WebGLRenderer.compile` / `compileAsync`: https://threejs.org/docs/pages/WebGLRenderer.html ; plus `node_modules/three` r187 `WebGLRenderer.js` (compile ≈ L1400–1530) and `WebGLPrograms.js` (L350–355, L488–492)
- [T4] drei `MeshPortalMaterial`: https://drei.docs.pmnd.rs/portals/mesh-portal-material ; stencil portals in three.js: https://dev.to/viridia/creating-portals-in-three-js-2dbm
- [K1] Blender issue #95969 (vertex-colour bake broken in 3.1/3.2): https://projects.blender.org/blender/blender/issues/95969
- [K2] Blender issue #91856 (AO vertex-colour corner artifacts); Cycles baking manual: https://projects.blender.org/blender/blender/issues/91856 , https://docs.blender.org/manual/en/3.0/render/cycles/baking.html
- [S1] Wikipedia, Shepard tone: https://en.wikipedia.org/wiki/Shepard_tone
- [S2] Frane, AES 2024, Shepard–Risset mechanism: https://aes2.org/publications/elibrary-page/?id=22391 ; CCRMA ChucK example: https://ccrma.stanford.edu/courses/220b/code/chuck/shepard-1.ck

**Mind-blow catalogue**
- [M1] Library of Babel (online): https://libraryofbabel.info/
- [M2] D. W. Lyons, "An Elementary Introduction to the Hopf Fibration", Mathematics Magazine 76 (2003): https://nilesjohnson.net/hopf-articles/Lyons_Elem-intro-Hopf-fibration.pdf
- [M3] Niles Johnson, Hopf fibration visualisations: https://nilesjohnson.net/hopf.html
- [M4] de Smit & Lenstra, "The Mathematical Structure of Escher's Print Gallery", Notices AMS 50 (2003): https://www.ams.org/notices/200304/fea-escher.pdf
- [M5] bbchallenge, "BB(5) = 47,176,870" (2 Jul 2024): https://discuss.bbchallenge.org/t/july-2nd-2024-we-have-proved-bb-5-47-176-870/237
- [M6] arXiv 2509.12337, "Determination of the fifth Busy Beaver value": https://arxiv.org/abs/2509.12337 ; Scientific American: https://www.scientificamerican.com/article/new-math-breakthrough-reveals-the-fifth-busiest-beaver/
- [M7] Wikipedia, Pendulum wave: https://en.wikipedia.org/wiki/Pendulum_wave
- [M8] Wikipedia, Foucault pendulum: https://en.wikipedia.org/wiki/Foucault_pendulum
