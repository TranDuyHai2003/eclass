# Anime cel shading: state of the art and a plan for Math World (26/11/2026)

Scope: real-time anime/manga shading as shipped in Guilty Gear Xrd, Genshin Impact, Honkai: Star Rail (HSR),
Zenless Zone Zero (ZZZ), Blue Archive, Blue Protocol, Wuthering Waves, Madoka Magia Exedra, and the public
toon shaders (Unity Toon Shader / UTS2, lilToon, MToon). Then a prioritized plan for **our** stack
(three r187, R3F 9, drei 10, postprocessing 6.39, three-vrm 3.6, WebGL2, mid-range phones).
Research only: no code was changed. Sources are at the end; claims backed only by community reverse-engineering
are marked *(community)*. I found no official rendering talk for HSR, ZZZ or Blue Archive, so those games are
covered only through community recreations and what they have in common with Genshin.

---

## 0. Audit: what our code does today (verified in the repo and in `node_modules`)

| Area | Current state | Finding |
|---|---|---|
| Tone mapping (`WorldClient.tsx`) | `gl.toneMapping = ACESFilmic`, exposure 0.78 in `onCreated` | **Has no effect.** `@react-three/postprocessing` 3.2.2's `EffectComposer` forces `gl.toneMapping = NoToneMapping` (a `toneMappingGuard` in `dist/index.js`), and three also skips tone mapping when it renders into a render target. Both quality tiers mount a composer, so every tier outputs **linear HDR clipped to sRGB**, and the exposure setting is ignored. The current look was tuned without any tone curve. |
| Composer buffer | default `frameBufferType = HalfFloatType`, `multisampling={0}` | Good for Bloom on mid/high. On **low** there is no bloom, so the 8 B/px half-float buffer only costs bandwidth. |
| VRM face (`Avatar.tsx` `loadVrm`) | forces `shadingToonyFactor 0.98`, `shadingShiftFactor -0.05` on **every** MToon material | VRoid ships the face (`*_Face_00_SKIN`, `*_FACE`) with `_ShadeShift -0.8`. three-vrm converts that to a shading shift of about **+0.71**, which keeps the face almost always lit, the classic anime face rule. Our loop overwrites it, so the face now gets hard shadows on the nose and eye sockets. Body defaults convert to about -0.05 / 0.95, so the body override is nearly a no-op. |
| VRM outline | inverted hull (MToon `OUTLINE`), `worldCoordinates`, width refit every frame by `fitOutline` (1.6 px), colour (0.16, 0.10, 0.14), `outlineLightingMixFactor 0.15` | The constant pixel width is correct (it matches GG Xrd). The MToon outline shader computes `outlineColor * mix(1, litColor, mix)`, so **coloured lines are one parameter away** (see P4). The hull pushes along the authored normals, which split at UV and material seams, so lines can gap at the neck, cuffs and hair cards. |
| Lights (`Environment.tsx`) | hemisphere 0.5, key directional light 1.05 (warm), back directional light 0.7 (cool) | MToon and MeshToon run their toon step **once per directional light** and add the results. The back light adds a second terminator plus a flat `shadeColor` fill on every character and toon surface, which washes out the two-tone look. It also costs one extra light-loop iteration per lit fragment. |
| Environment toon | `MeshToonMaterial` with a 5-texel coloured ramp (purple shadow, warm lit), patched to read `.rgb`; `toonMaterial` adds a fresnel rim | This matches the industry practice of tinted shadows rather than black. Keep it. |
| Ink (`Ink.tsx`) | Laplacian of 1/z, 5 depth taps, coloured line (a darker shade of the colour beneath), distance fade | This is a good mobile choice. Characters get **both** the hull line and the Ink line, which can produce roughly 3 px doubled silhouettes. |
| Post | Ink, Bloom (threshold 1.0, mipmapBlur), SMAA, HueSaturation, BrightnessContrast, Vignette | The HDR-only bloom threshold matches the anime look (only emissive things glow). Hue and contrast are graded in linear space. |
| Fog | linear `Fog #cfdcf5` attached by both `Lights` and `Expanse` | Constant colour with no height falloff. The ground and grass `ShaderMaterial`s have no fog chunks, so they never fog. |

## 1. Findings by topic

### 1.1 Face shading
- **GG Xrd (GDC 2015):** faces are kept evenly lit. The team hand-edits vertex normals (for example spherical normals on the face) so shading reads like a drawing rather than computed lighting. Artist-placed shading beats physically correct shading. [GG1][GG2][GG3]
- **Genshin (community, widely replicated):** the face does not use N·L at all. A grayscale **face shadow threshold map** (built from several hand-drawn shadow shapes and interpolated with an SDF) stores, for each texel, the light angle at which that texel turns dark. The shader computes `FdotL` and `RdotL` from the **head bone's forward and right vectors** projected onto the XZ plane, flips the map's U by the sign of `RdotL`, and uses `lit = step((1 - FdotL) / 2, map)`. The shadow edge therefore sweeps across the cheek in a designed shape (nose and lip notches) and never flickers. [SDF1][SDF2] Hi-Fi Rush (GDC 2024) also lists a dedicated face-shadow path. [HFR]
- **Madoka Exedra (CEDEC 2025):** "perspective cancel" flattens head vertices along the camera depth axis so the face silhouette doesn't distort with FOV. [MDK]
- **Without custom textures (our VRoid case), from cheapest to best:**
  1. Keep the face mostly lit (VRoid's own +0.71 shift). This is what GG and most gacha games do for small on-screen faces.
  2. **Spherized normals:** at load, lerp each face or hair vertex normal toward `normalize(pos - headCenter)` (an ellipsoid is better: scale the axes by the head's width, height and depth). The shading becomes one clean blob that follows the light.
  3. **Procedural threshold map:** compute the Genshin formula analytically. Use `x` = the fragment's position along the head-right axis (−1…1) and `s = 0.5 + 0.5·x·sign(RdotL)` (add a small bump near the nose), then `lit = smoothstep(t-ε, t+ε, s)` with `t = (1 - FdotL)/2`. Front light lights the whole face, side light splits it at the nose, and back light darkens the whole face. It costs about 15 ALU, on face pixels only.
  4. **One real SDF map:** VRoid faces share a UV template, so one 512² R8 threshold map could serve every avatar. This needs checking against our 11 `.vrm` files first.

### 1.2 Ramps, ILM maps, shadow tint, specular, rim, stockings and metal
- **ILM / light map:** GG Xrd paints per-texel shading offsets (an "ILM" channel that shifts the shading threshold so areas such as under the bangs or in creases are always shadowed) plus vertex-colour AO. [GG1] Genshin-style shaders split a "light map" into a specular mask, AO/threshold, a specular-shape threshold and a **material ID that picks a ramp row**. The ramp texture holds day and night rows per material, with hue-shifted shadows. *(community)* [SDF1][TC] MToon's equivalent is `shadingShiftTexture` (R channel). [MT]
- **Shadow tint:** a shadow-colour map is multiplied onto the base colour so shadows shift hue rather than going grey. The "overflow colour" technique adds a saturated band at the terminator. [TC] UTS2 uses base / 1st shade / 2nd shade colours with a shading-grade map. lilToon has 1st, 2nd and 3rd shadow layers with border and blur. [UTS][LIL]
- **Hair highlight ("angel ring"):** UTS projects a ring texture in a camera-fixed space using UV2. [UTS-AR] Madoka uses screen-space mapping driven by the **head bone**, so the highlight arcs with camera pitch and hides when the head turns away. [MDK] Genshin-likes use NoH plus a texture that controls highlight shape. Newer games use Kajiya-Kay anisotropy. [TC]
- **Rim:** Genshin, HSR and Madoka use a **screen-space depth rim**. They sample the depth buffer at an offset along the screen-projected light direction, and if the neighbour is much farther away (a silhouette) they add a constant-width rim. Madoka documents this explicitly, and it needs a depth buffer, which we already have. [MDK] *(Genshin and HSR: community)* [SR]
- **Self-shadow:** Madoka renders a **character-only shadow map** for crisp self-shadowing. [MDK] HSR recreations do per-object shadows. [SR]
- **Stockings:** fresnel blend `mix(skin, fabricDark, pow(1 - N·V, k))` with a denier mask *(community)*. None of our VRoid assets use it, so skip.
- **Metal:** a matcap (MToon `matcapTexture`, lilToon MatCap). Genshin-likes put metal through a matcap selected by the light-map material ID. [TC][MT]

### 1.3 Outlines
- **Inverted hull is the standard** (GG Xrd, Genshin-likes, UTS, lilToon, MToon). GG details: [GG3]
  - vertex-colour **alpha scales width** (0 closes gaps in valleys, sleeves and the nose bridge);
  - vertex-colour **B pushes the hull back in Z** to hide inner lines while keeping the silhouette;
  - a **second, smoothed normal set stored in the tangent slot** (tangents skin with bones; vertex colours don't) avoids broken hulls at hard edges;
  - width ∝ camera distance × tan(FOV/2) for a constant screen width. The tangent of FOV/2 is `1/P[1][1]` from the projection matrix.
- MToon 1.0 has `outlineWidthMode = screenCoordinates` (the width is a fraction of screen height). three-vrm implements it per vertex (`outlineOffset *= viewZ / P[1][1]`), which makes it scale-invariant and frame-free. [MT]
- **Coloured lines:** anime lines are a dark, saturated version of the local colour, not black. GG and Genshin-likes vary line colour per material. Our Ink effect already does this for the environment.
- **Screen-space (depth or normal edge) lines** are used for environments (Hi-Fi Rush's deferred toon pipeline, Blue Protocol's post-processing work on UE4). [HFR][BP] They are cheap on mobile if merged into one pass.
- **Mobile:** a hull costs one extra draw per outlined primitive and re-skins the mesh in the vertex shader. That is fine for 1–4 hero characters, so drop outlines for distant NPCs (already planned in TECH.md). Avoid Sobel on normals, which needs a normal pass and adds bandwidth.

### 1.4 Environment and grading
- **Tone mapping:** Genshin's console talk says miHoYo **did not use ACES** (RRT+ODT) because it "doesn't fit the game's style". It grades with a LUT (tone curve baked in) and simulates the hue shifts that artists rely on inside the shader. [GEN-U] Madoka keeps ACES but **pre-corrects colours in the shader** to land on the model sheet. [MDK] Khronos **PBR Neutral** preserves hue for all inputs and reproduces base colours exactly up to about 0.8, compressing only above that [KHR]. That is the right property for flat anime albedo. AgX deliberately desaturates and flattens, and ACES shifts skin toward orange and blues toward purple. In postprocessing, `ToneMappingEffect` supports NEUTRAL, AGX and ACES_FILMIC (three ≥ r162 for Neutral). [THREE-TM]
- **Bloom:** threshold set so only HDR emissives bloom (what we do). Anime games bloom generously on sky and emissives, not on lit albedo.
- **Fog and atmosphere:** Genshin uses volumetric fog on console (under 1 ms on PS4) and half-resolution ray-marched god rays. [GEN-U] On mobile, ship height fog, a horizon colour matched to the sky, and sun-direction in-scatter tint as **analytic in-material fog**, with light shafts as additive cards.
- **Wuthering Waves:** curve-driven daily brightness changes so characters match the 3D lighting, gradients as the core of the anime look, and custom light and shadow components for lighting artists. It uses deferred shading even on mobile. [WW1][WW2]
- **Blue Protocol (UE4, deferred PBR):** cel look built inside the BasePass/PostProcess limits, with lightweight city rendering (CEDEC 2020/2021). [BP]
- **Foliage and grass:** point grass normals up (or blend from terrain normal at the root to authored normals at the tip) so blades shade like the ground. Transfer hemisphere normals onto canopy cards for blob shading. [GRASS]
- **Voxel worlds:** per-vertex AO baked from neighbour occupancy (with a quad-diagonal flip) gives large readability gains for free. [AO]

### 1.5 Mobile tricks these games use
- **Two pipelines:** Genshin keeps a separate mobile rendering pipeline. Mobile is the lead platform and console follows, and every feature is costed for both. [GEN-U]
- **Bandwidth is the budget on tile GPUs:** few full-screen passes, effects merged into one pass, 8-bit targets where HDR isn't needed, no MSAA on offscreen targets, and post-processing (bloom) at reduced resolution. [ARM]
- **Character cost:** outlines and self-shadow only on hero characters, distant NPCs updated at a lower rate, and a 30 fps cap on phones.
- **Precomputed stylization over runtime:** baked AO, painted threshold maps, ramps and LUTs instead of SSAO or volumetrics.

---

## 2. Prioritized plan for our files

Costs are on a mid-range phone at low/mid tier. "≈0" means a few ALU in a pass that already runs.

| # | Change | File | How | Mobile cost | Effort |
|---|---|---|---|---|---|
| **P1** | **Stop overriding face materials** | `player/Avatar.tsx` (`loadVrm`) | Skip the `shadingToony`/`shadingShift` and rim overrides when `m.name` matches `/_FACE|Face_00_SKIN|_EYE/`, keeping VRoid's ≈+0.71 shift. Keep the body override. | 0 | 10 min |
| **P2** | **Make tone mapping real and explicit** | `WorldClient.tsx` | Delete the dead `ACESFilmic`/`exposure` lines. Add `<ToneMapping mode={ToneMappingMode.NEUTRAL} />` (imported from `postprocessing`) as the **last** effect in both composers. It merges into the existing EffectPass. Neutral is near-identity below about 0.76 (a slight toe in the darks), so today's colours are kept and HDR emissives roll off instead of clipping. A/B screenshots: none / Neutral / AgX. Don't use ACES. | ≈0 | 30 min |
| **P3** | **One key light for shading** | `scene/Environment.tsx` (`Lights`) | Remove the cool back directional light (or drop it to ≤0.2). Let the existing rims carry the cool edge: `toonMaterial` rim, MToon parametric rim, and P8. Optionally tint the hemisphere ground colour more purple to keep the shadow-side mood. | **saves** one light-loop iteration per fragment | 15 min |
| **P4** | **Coloured character lines** | `player/Avatar.tsx` | Set `outlineLightingMixFactor` to 0.15 → ~0.85 and `outlineColorFactor` to ~(0.40, 0.33, 0.40). The MToon outline already computes `outlineColor * mix(1, litColor, k)`, so skin lines turn red-brown and hair lines turn dark hair-hue. | 0 | 10 min |
| **P5** | **Smoothed-normal hull and screen-space width** | `player/Avatar.tsx` | At load, weld vertices by position (hash to 1e-4), average their normals, and store them as attribute `outlineNormal`. In the outline materials' `onBeforeCompile`, after `skinbase_vertex`, compute `vec3 oN = normalize((skinMatrix * vec4(outlineNormal,0.)).xyz)` and use it in the `outlineOffset` line. Optionally switch to `outlineWidthMode = "screenCoordinates"` with `outlineWidthFactor = 3.2 / canvasCssHeight` (MToon offset ⇒ NDC offset = factor), updated on resize. This removes the per-frame `fitOutline` loop; keep a far clamp only if NPC lines look heavy. Morph targets won't move `outlineNormal`, which is acceptable for small expressions. | +12 B/vertex memory; 0 per frame | 0.5–1 day |
| **P6** | **Procedural face terminator** | `player/Avatar.tsx` | On face-skin materials, add uniforms with the head bone's forward, right and position in **view space** (updated in `useFrame`). In the fragment shader, compute `FdotL`/`RdotL` against `directionalLights[0].direction` (XZ-projected), apply the §1.1(3) formula, and feed the result in place of `dotNL` in MToon's `getShading`. Tint the shadow with `shadeColor`. Later, swap the analytic `s` for a shared 512² SDF map if the VRoid face UVs prove identical across avatars. | ~15 ALU on face pixels only | 1 day (+1 for the SDF map) |
| **P7** | **Hair: spherized normals and angel ring** | `player/Avatar.tsx` | (a) At load, for `_HAIR` meshes, lerp normals 50% toward the head-centre ellipsoid (computed from the head bone bind pose) for clean block shadows. (b) Generate a 256² canvas **matcap** with a thin bright band around view-normal y ≈ 0.35–0.5 and assign it as `matcapTexture` on hair materials with `matcapFactor` ≈ 0.3 × hair tint. VRoid hair already enables a matcap (`_SphereAdd`), so this adds no shader variant. | 1 texture fetch on hair pixels (already present) | 0.5 day |
| **P8** | **Screen-space depth rim** | `fx/Ink.tsx` | Add uniform `uLight2D` (the key light direction projected to the screen, set each frame) and **one more depth tap** at `uv + uLight2D·(outlinePx + rimPx)·texel`. If the neighbour's 1/z is much smaller (a silhouette) and the pixel is closer than ~25 m, add `keyColor·0.35`. This gives a constant-width rim on characters and props, as in Genshin, HSR and Madoka, and reuses the depth texture the composer already provides. | +1 depth tap in the merged pass | 0.5 day |
| **P9** | **LUT grading per zone** | `WorldClient.tsx` | Replace `HueSaturation` + `BrightnessContrast` with postprocessing `LUT3DEffect` (32³ strip PNG, ~30 KB). Author it from screenshots (hub warm, Expanse cool, Impossible desaturated) and blend LUTs for time of day. This matches Genshin's "grade in a LUT" practice. | ≈0 (one 3D fetch replaces ALU) | 0.5 day + art |
| **P10** | **Low-tier bandwidth** | `WorldClient.tsx` | For the low composer: `frameBufferType={THREE.UnsignedByteType}`. postprocessing marks 8-bit buffers sRGB when `outputColorSpace` is sRGB, so there's no banding. On mid, try `<Bloom levels={5} />` or a lower `resolutionScale`. | **halves** composer bandwidth on low | 15 min + device test |
| **P11** | **Voxel AO baked into vertex colours** | `scene/Expanse.tsx` (`Chunk`) | Per face vertex, use `ao = (side1 && side2) ? 0 : 3 - (side1+side2+corner)` and flip the quad diagonal by AO sum. Lerp the vertex colour toward the ramp's shadow tint (0.5, 0.48, 0.68), not black. | CPU only at chunk build | 0.5 day |
| **P12** | **Height fog and horizon match** | `fx/shaders.ts` (ShaderChunk patch, like the gradient patch) | Patch `fog_vertex`/`fog_fragment`. Pass the world Y; use `fogFactor *= exp(-max(0., y - uFogBase) * uFogFalloff)` and `fogColor = mix(fogColor, sunTint, pow(max(dot(viewDir, sunDir), 0.), 8.))`. Take `#cfdcf5` from the sky panorama's horizon row. Add fog chunks to `groundShader`/`grassShader`. Keep one `<fog>` owner (today both `Lights` and `Expanse` attach one). | a few ALU per fragment | 0.5 day |
| **P13** | **Coexistence of Ink and hull on characters** | `fx/Ink.tsx` / `Avatar.tsx` | Check whether the hull line and the Ink line double up (about 3 px). If they do, keep the hull (it is coloured and has a stable width) and fade Ink on characters by giving them a slightly different near/far band, or thin the hull to ~1.2 px. Don't add a mask pass. | 0 | 1–2 h |
| P14 | Light shafts | `scene/HubDecor.tsx` / `Environment.tsx` | Additive billboard cone cards with a soft edge and scrolling noise, depth-faded. **Not** the GodRays post pass. | small overdraw | 0.5 day |
| P15 | Character-only self-shadow (**high tier only**) | `Environment.tsx` + `Avatar.tsx` | A 512² shadow map whose camera is fitted to the player's bounding sphere, with only the player casting and receiving. MToon already multiplies shading by shadow. | one extra character depth draw plus PCF taps; desktop only | 1 day |
| P16 | Perspective cancel for close-ups | `Avatar.tsx` | Madoka-style flattening of head vertices along view Z, applied only in dialogue or character-overlay cameras. | ≈0 | 0.5 day |

**Suggested order:** P1 → P2 → P3 → P4 (about an hour in total, the biggest visual return), then P10 → P11 → P8 → P7 → P6 → P5, then P9, P12, P13 and the rest. After P2 and P3, re-tune the light intensities and `HueSaturation` once with side-by-side screenshots, because the scene has been graded without a tone curve so far.

**Don't:** use SSAO/N8AO, the GodRays post pass, volumetric clouds, MSAA on the composer, Sobel on normals (needs a normal pass), ACES for character colours, or per-character shadow maps on phones.

**Verification for each step:** `npx tsc --noEmit -p .`, `npx eslint` on the touched files, and `npm run test:e2e` (visual) with the server running. Compare fixed-camera screenshots of the hub, Expanse and the character overlay before and after. Measure FPS on one real mid-range Android phone and one older iPhone, per TECH.md.

---

## Sources
- [GG1] Motomura, *GuiltyGearXrd's Art Style: The X Factor Between 2D and 3D*, GDC 2015: https://gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The · handout: https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf
- [GG2] Game Developer write-up of the GDC 2015 talk: https://gamedeveloper.com/art/see-i-guilty-gear-xrd-i-s-striking-2d-3d-art-deconstructed-at-gdc-2015
- [GG3] Arc System Works Academy, *Guilty Gear Toon Line Control Techniques* (ENG): https://docswell.com/s/ASW_Academy/5LVY67-GG-Toonline-Eng
- [GEN] *Genshin Impact: Crafting an Anime-Style Open World*, GDC 2021: https://gdcvault.com/play/1027538/-Genshin-Impact-Crafting-an
- [GEN-U] Zhenzhong Yi (miHoYo), Genshin console rendering (Unite Seoul 2020 / Unity Dojo 2021): https://www.docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi
- [SDF1] *(community)* URP Simple Genshin Shaders (face map sampling with FdotL/RdotL): https://github.com/NoiRC256/URPSimpleGenshinShaders
- [SDF2] *(community)* Stylized face shadow workflow: https://sydianandrewchen.github.io/projects/3-stylized-facial-shadow-workflow
- [TC] *(community)* Stylized character rendering notes (face maps, shadow colour, overflow band, hair specular, outlines): https://tianc377.github.io/posts/StylizedCharacterRendering
- [SR] *(community)* StarRailNPRShader (HSR-style URP): https://github.com/stalomeow/StarRailNPRShader
- [MDK] WFS, *Magia Exedra* 3D look development, CEDEC 2025: https://speakerdeck.com/gree_tech/mo-fa-shao-nu-madokamagika-magia-exedra-noipnokiyarakutawomiao-kutameno3drutukukai-fa · https://cgworld.jp/article/202508-cedec-madoka.html
- [BP] Blue Protocol, CEDEC 2020/2021: https://cgworld.jp/feature/202011-cedec2020-bluep-2.html · https://www.gamebusiness.jp/article/2021/09/13/19051.html · https://game.watch.impress.co.jp/docs/news/1275034.html
- [WW1] Unreal Engine interview, Wuthering Waves: https://www.unrealengine.com/developer-interviews/exploring-the-post-apocalyptic-charm-of-asg-open-worlds-in-wuthering-waves
- [WW2] AUTOMATON technical column on Wuthering Waves: https://automaton-media.com/en/column/even-from-a-developers-perspective-wuthering-waves-use-of-unreal-engine-is-borderline-perverse-a-ue4-game-decked-out-in-custom-technology/
- [HFR] Tango Gameworks, *3D Toon Rendering in Hi-Fi RUSH*, GDC 2024: https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi
- [UTS] Unity Toon Shader manual: https://docs.unity3d.com/Packages/com.unity.toonshader@0.9/manual/index.html · [UTS-AR] Angel Ring: https://docs.unity3d.com/Packages/com.unity.toonshader@0.9/manual/AngelRing.html
- [LIL] lilToon: https://github.com/lilxyzw/lilToon (docs: https://lilxyzw.github.io/lilToon/)
- [MT] VRMC_materials_mtoon-1.0 spec: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_materials_mtoon-1.0/README.md
- [KHR] Khronos PBR Neutral: https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md
- [THREE-TM] three.js forum, *Tone Mapping Overview*: https://discourse.threejs.org/t/tone-mapping-overview/75204 · postprocessing ToneMappingMode: https://pmndrs.github.io/postprocessing/public/docs/file/src/enums/ToneMappingMode.js.html
- [AO] 0fps, *Ambient occlusion for Minecraft-like worlds*: https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
- [GRASS] Grass normals matching terrain (UE forum): https://forums.unrealengine.com/t/grass-lighting/152158
- [ARM] Arm Mali GPU Best Practices Developer Guide: https://developer.arm.com/documentation/101897/latest/
