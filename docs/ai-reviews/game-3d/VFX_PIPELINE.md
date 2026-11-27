# Anime real-time VFX pipeline for Math World (26/11/2026)

Scope: how anime-style games build combat VFX (Genshin, HSR, ZZZ, WuWa, Arknights: Endfield, Blue Protocol, GG Xrd/Strive, Madoka Exedra), turned into a pipeline for **our** stack (three r187, R3F 9, postprocessing 6.39 with Bloom threshold 1 + Neutral, WebGL2, mobile-first), plus colour and light harmony. Research only, no code changed.
Not repeated here: hit-stop, poise, impact frame, cut-ins, telegraphs (`COMBAT_VFX_RESEARCH.md` A1–C3), and cel shading, outlines, LUT and fog (`CEL_SHADING.md` P1–P16). *(community)* = forum, blog, fan or vendor analysis. HoYoverse, Kuro and Hypergryph have published **no VFX talks** that I could find (only rendering or engine talks), so the per-game claims come from footage analysis *(community)* plus the official Exedra, Riot, Blizzard and Arc System Works material.

## 0. Why ours looks "code-generated" (audit of the current code)
- **No textures in any effect.** Slash, ring, beam and bolt shaders are pure `smoothstep` math with one flat colour × 2.2–2.6 (`CombatScene.tsx`), so every edge is the same soft gradient. `Bursts` draws `PointsMaterial` **squares** (`Effects.tsx`), and `Beam` is a plain cylinder.
- **No colour ramp.** Each effect is one hue multiplied into HDR. Anime FX are 3–4 tones: a white-hot core, a saturated body and a **darker, hue-shifted edge**. On the **low tier there is no Bloom**, so `color × 2.6` just clips to a flat colour or flat white.
- **Linear fades** (`opacity = 1 - t`, `scale = k`) everywhere. Riot's guide says linear lifetime curves ruin the read [RIOT][RIOT-SUM].
- **Additive-only blending on a bright day sky** (hub sky ≈ #cfe3ff): additive pale colours vanish. Anime games mix **alpha-blended dark edges** with additive cores [KURIE-GI].
- **Gaps:** `addFx("spark")` (staff) has **no renderer**. Each `BurstPoints` allocates a geometry and material, and each `Beam` a cylinder, per spawn (GC churn on mobile). Hit stars render with `depthTest:false`.
- **Lighting is ~π too dark for toon props and characters** (see §6.1). The unlit ground looks brighter than everything standing on it, which is a big part of the "not harmonious" feeling.

## 1. The anime VFX visual grammar
1. **Shape language.** Crescents (slashes), spikes and shards (impacts, ice, crits), 4-point cross stars and glints (Genshin sparkles [KURIE-GI]), rings and shockwaves (casts, landings), long streaks (speed lines, sparks). Shapes are **hand-drawn, with mixed hard and soft edges, never photographic or noisy-procedural** [RIOT][ST-TEX]. Each element gets a **signature shape** as well as a colour, so it still reads in greyscale.
2. **Hard vs soft.** The primary read (slash body, spark, ring front) is **hard-edged with stepped alpha** (2–3 posterized levels, a cel look). Only secondary layers (glow halo, smoke, distortion) are soft. "Primary = high value, sharp silhouette, high opacity; secondary = lower value, blurred, low opacity" [RIOT-SUM].
3. **Colour ramp.** Each effect uses 3–4 stops: **white core → saturated body → darker, more saturated, hue-shifted edge** (cyan → blue, gold → orange, pink → magenta). Genshin's crosses even shift **pink → light-blue tips**, with glow from layered textures rather than Bloom alone [KURIE-GI]. Riot: avoid 0 % black and 100 % white in effect bodies, and keep the highest value spike for the impact core [RIOT-SUM]. A kamehameha-style breakdown builds the same look from banding plus a gradient map [KAME] *(community)*.
4. **Timing: anticipation → impact → dissipation.** The impact pops to **full value within the first ~25 % of the lifetime**, the dissipation is a longer eased erosion, and nothing is linear [RIOT-SUM]. The WuWa breakdown follows the same arc: anticipation glyph → pull-back → impact (darken, shake, distortion) → sustain → dissolve **into a dashed line** [WW-VFX]. Anime effects are also **held**: 1–2 frames of a full white shape, then sub-60 fps stepping (GG Xrd's limited animation [GG]; frame-by-frame FX workflow [OTZ]).
5. **Smear and afterimage.** Use a slash mesh instead of motion blur, stretched sparks (velocity-aligned), and 2–3 tinted, flat afterimages that fade by erosion, not opacity.
6. **The hit package**, every hit:
   - 1–2 frame hit flash on the target, then 4–8 stretched sparks (a fan opposite the hit direction);
   - a 1-frame star/cross "impact frame" at the contact point;
   - a ground or air ring shockwave on heavy hits only;
   - screen effects on big hits only (Exedra: B/W + chromatic aberration + radial blur at the moment of landing, "to maximise the impact" [EX-SP]). Exedra also **lands effects slightly off the enemy and lets the camera sell the hit** [EX-SP].
7. **Density and size rhythm.** One big shape, 3–5 medium, 10–20 small (a 1 : 4 : 15 rule of thumb). Lifetimes randomised widely (×1–2) so particles do not die together [KURIE-GI]. Scale must match power tier: a basic hit must not look like an ultimate [RIOT-SUM][RIOT-CL].
8. **Colour per element and per actor.** Keep one stable hue per element or weapon, reserve the **enemy-danger hue** (red) for telegraphs, and use the complementary colour only as a small desaturated accent [RIOT-SUM]. The Exedra team broke effects into elements and sent outsourcers **a colour-tone reference image with the storyboard** [EX-SP]. We should do the same per weapon (§6.4).

## 2. Shader techniques → one uber material `FxMat` (+ 3 batch types)
All of these fit into **one `ShaderMaterial` with defines**, so every effect is "mesh + textures + numbers", never new GLSL:
| Technique | How in `FxMat` | Source |
|---|---|---|
| **Alpha erosion / dissolve** | `a = smoothstep(e, e + soft, mask*noise)`; `e` rises with age (or per-instance). **Subtract, don't multiply**; erosion maps are **linear** (sRGB off) | [EROS][RTV-ER][D3] |
| **Two-texture motion** | `mask(uv) × noise(uv*k + pan*t)`: Diablo 3's two-channel multiply makes repetition invisible | [D3] |
| **UV panning** | `uPan.xy` (mask), `uPan.zw` (noise); slash: pan along the arc; beam: pan along the length | [ST-RIME] |
| **Polar UV** | `#define POLAR`: `uv = (atan(p.y,p.x)/2π, length(p))`; a vertical pan becomes a radial shockwave or vortex | [RTV-POL] |
| **Gradient map (ramp)** | `col = texture(uRamp, vec2(v, row)).rgb` with `v` = eroded greyscale. One 256×16 ramp atlas, 1 row per element | [KAME][ST-TEX] |
| **Stepped alpha** | `#define STEPS 3`: `a = floor(a*3+0.5)/3` (or two `step`s) = cel look; leave halos soft | [KAME] |
| **Fresnel** | `pow(1-abs(N·V), p)` for domes, shields and beam cylinders (rim bright, centre clear) | existing `shieldShader` |
| **Soft particles** | No depth pre-pass on mobile: an **analytic fade** by height above `ENV.ground(x,z)` (passed per instance) plus a camera-near fade. Depth-texture soft particles are high tier only | [SOFT] |
| **Distortion / heat haze** | Mid/high only: postprocessing **`ShockWaveEffect`** (already in our package) for nova and meteor. No scene-copy refraction pass | — |
| **Flipbooks** | `#define FLIP 4.` → 4×4 atlas, frame from age. Blend 2 frames on high; motion-vector blending only if smoke looks choppy (it costs ALU) | [MV][EROS-FB] |
| **Mesh particles + custom data** | `InstancedMesh` + `InstancedBufferAttribute aData` (age01, seed, erosionBias, rampRow): Unity's "custom vertex streams" equivalent | [UNITY-VFX] |
| **Ribbons** | A ring buffer of N points → camera-facing strip; `u` = age along the trail (stretch mode) or distance (tile mode) | [Q] |
| **Emissive HDR** | `rgb *= uIntensity` (core > 1 → Bloom). **Bake the white core and a soft halo into the texture** so the low tier (no Bloom) still glows | [KURIE-GI] |
| **Hybrid blend** | Premultiplied, `CustomBlending ONE, ONE_MINUS_SRC_ALPHA`; output `vec4(rgb*a, a*(1-uAdd))`. `uAdd=1` additive core, `0` alpha-blended dark edge, both in **one draw** | — |

Core fragment (illustrative, ~12 lines):
```glsl
vec2 uvM = POLAR_OR_UV(vUv) + uPan.xy*uTime;  float m = texture2D(uMask, uvM)[uMaskCh];
float n = texture2D(uNoise, vUv*uNoiseScale + uPan.zw*uTime).r;
float v = clamp(m - (1.0 - n)*uNoiseAmt, 0.0, 1.0);          // break-up by subtraction
float a = smoothstep(vAge*uErode, vAge*uErode + uSoft, v);   // erosion driven by age
#ifdef STEPS
 a = floor(a*STEPS + 0.5)/STEPS;
#endif
a *= vFade;                                                   // ground/camera soft fade
vec3 c = texture2D(uRamp, vec2(v, vRow)).rgb * uIntensity;    // low v = dark edge, high v = white core
gl_FragColor = vec4(c*a, a*(1.0 - uAdd));
```
Batches: **FxSprites** (instanced quads: billboard / stretched by velocity / flat on ground), **FxMeshes** (instanced Blender meshes: slash, ring, dome, beam, shard), **FxRibbons** (trails). There is one material per (batch × texture set), and age and colour row live in instance attributes, so all 16 effects below cost about **8–12 draw calls**.

## 3. Open-source libraries: what to adopt
| Library | Licence / version | Size | Fit for us |
|---|---|---|---|
| **three.quarks** + `quarks.r3f` [Q] | MIT, v0.18.0 (npm, Nov 2026), peer `three >=0.182`, 1.3k★ | ≈ 44 KB gzip (min ESM, measured) | Full system: billboard, stretched, mesh particles, trails, flipbooks with blending, sub-emitters, force fields, soft particles (WebGL needs a depth texture), a `BatchedRenderer`, and a visual editor (quarks.art) exporting JSON. **But** the particle fragment shader is fixed (`tint × map × flipbook`, plus soft): there is no ramp, erosion, polar or stepped alpha without overriding global `ShaderChunk`s. |
| **wawa-vfx** [WAWA] | MIT, v1.2.10 (Sep 2025), peers include **leva + zustand** | small | Instanced emitters, billboard, stretched and mesh modes, easings. A course project, with no ramp or erosion; the leva peer is unwanted in production. Study only. |
| **three-nebula** [NEB] | MIT, v13.3.0 | 1.7 MB unpacked | CPU sprite engine, old API lineage. Skip. |
| **drei `<Trail>` / `meshline`** | MIT, already installed | 0 | Fine for one quick trail, but it is a separate draw per trail and has no age-UV or erosion. Use for prototypes only. |
| **postprocessing `ShockWaveEffect`** | MIT, installed | 0 | Use for the nova and meteor distortion (mid/high tier). |

**Decision: write our own pooled `FxMat` system (≈ 600–900 lines: 1 material, 3 instanced batches, a tiny curve or easing lib, 1 spawn API that replaces `addFx`), and do not adopt three.quarks as the runtime now.**
- **The look *is* the shader.** Ramp + erosion + stepped alpha + hybrid blend is exactly what quarks' fixed fragment shader lacks. Patching its chunks would be global and would break on its updates.
- **We already have the pattern.** Pools, `fxs[]`, `timeScale()` hit-stop and `addShake` exist. Our effects are few and art-directed (≤ ~300 live particles), not thousands of emitter types.
- **Hit-stop and the 10 Hz relay** need deterministic, seedable spawns that we control.
- **Revisit quarks** if we later need many smoke, fire or sub-emitter effects. Adopt it then for those only, behind the same spawn API, with its editor as the authoring tool. Still read its trail and stretched-billboard vertex shaders as a reference.

## 4. Texture pack (`public/world/fx/tex/`, ≈ 3.5 MB of VRAM total, all linear unless noted)
Make greyscale **shapes**; all colour comes from ramps. Image-gen output gets a cleanup script: Python with PIL (threshold/levels, centre, pad, channel-pack). Tileable noise is **procedural** (image models don't tile reliably).
| # | File | Size / channels | Content | Make with |
|---|---|---|---|---|
| T1 | `noise_pack.png` | 256², RGBA | R fbm Perlin, G Voronoi F1 (cells), B streak noise (stretched 8:1, for slashes and beams), A fine grain. All **tileable** | numpy script or Blender bake of Noise / Voronoi textures |
| T2 | `ramps.png` | 256×16, RGB (sRGB) | 16 rows: one per weapon or element (§6.4) + hit white, crit gold, enemy red, heal green, dark void, rarity 3/4/5. Left = edge colour, right = white core; include 1–2 hard steps | script from the §6.4 hex table |
| T3 | `slash_mask.png` | 512×256, RGB | R crescent body (thick head, tapering tail, ragged inner edge), G arc gradient (0 tail → 1 head) for wipe and erosion, B thin bright leading-edge line | image-gen P1 + levels |
| T4 | `star_glint.png` | 256², RG | R 4-point cross star with a thin long axis, G soft round halo | image-gen P2 / SVG |
| T5 | `impact_burst.png` | 512², R | Spiky radial burst (8–12 uneven spikes), hard edge, a hollow centre ring | image-gen P3 |
| T6 | `ring_wave.png` | 512×64, RG | Polar strip: R band with a hard front edge and soft trailing edge, G broken dashes (for the "dashed line" dissolve) | script |
| T7 | `spark_streak.png` | 128×32, R | Needle streak, bright head, tapering tail | script (analytic) |
| T8 | `smoke_puff_4x4.png` | 512² (4×4 × 128), RG | Cel smoke puff: R body with **2 flat tones**, G erosion map. Grows, then breaks apart | Blender: displaced icosphere + Shader-to-RGB constant ramp, 16 ortho frames |
| T9 | `arc_strip.png` | 512×128 (4 rows), R | 4 jagged lightning variants with forks, white core and soft halo | image-gen P4 or a Blender Grease Pencil render |
| T10 | `glyph_ring.png` | 1024², RG | R math-glyph ring (∫ Σ π ∂ …), G tick and rune bands; replaces the runtime canvas | **SVG → PNG** script (image models garble glyphs) |
| T11 | `dust_debris_2x2.png` | 256², R | Rock chips and dust tufts, cel 2-tone | image-gen P5 |
| T12 | `beam_core.png` | 64×256, RG | R cross-profile (sharp core + soft falloff), G scrolling energy striations | script |
| T13 | `crater_decal.png` | 256², RGBA (sRGB) | Cracked ground decal, ink-lined, transparent centre glow mask in A | image-gen P6 |
| T14 | `flare_hex.png` | 128², R | Hex or diamond flare and lens ghost for loot and reveal | SVG |

Image-gen prompts (always append: *"pure white shape on pure black background, centered, no text, no gradient background, flat cel-shaded anime game VFX texture, high contrast, crisp edges, 1024x1024"*):
- **P1 slash:** "a single crescent sword-slash brush stroke, thick sharp leading edge tapering to a thin wispy tail, ragged dry-brush inner edge, Japanese anime fighting game effect, Guilty Gear style".
- **P2 star:** "four-pointed sparkle star, long thin vertical and horizontal spikes, short diagonals, tiny bright core, anime twinkle".
- **P3 burst:** "radial impact burst with 10 uneven sharp spikes, hollow centre, comic hit-spark, hard ink edges".
- **P4 arc:** "jagged lightning bolt strip running left to right with two small forks, thin bright core, anime electric effect, 4 different variants stacked vertically".
- **P5 debris:** "four small rock chips and dust tufts in a 2x2 grid, two flat tones, anime cel style".
- **P6 crater:** "top-down cracked ground crater decal, radial cracks, ink outlines, anime style" (colour allowed; keep alpha via levels).

## 5. Recipes for our effects
Timing in ms (scaled by `timeScale()`). Ease names follow easings.net. "Ramp" = a row of T2. All use `FxMat` unless noted.
| Effect | Mesh (Blender, `fxkit.glb`) | Textures | Shader params | Timing curve | Particles / extras |
|---|---|---|---|---|---|
| **Sword slash (3-hit)** | `fx_slash` re-UV'd: u along the arc 0→1, v inner→outer; 24 segments; hit 3 = wider, 220° arc | T3 + T1.B | R mask × streak noise, pan u +2/s, ramp row = weapon, STEPS 3; head mask G > 1-age×1.4 (wipe), then erosion | 0–40 sweep (outExpo), 40–90 hold full white core, 90–260 erode (inQuad). Hits 1/2/3 = 260/260/340; hit 3 gets 2 stacked layers (dark edge + additive core) | 3–5 sparks (T7, stretched) at the arc head on contact; hit 3: ground ring T6 r=1.2 |
| **Arrow trail + impact** | `fx_arrow` (opaque toon + HDR tip) | T7, T4, T5 | Ribbon 8 pts, u=age, width 0.12→0 (outQuad), ramp gold, additive core | Trail life 180; impact 0–30 star T4 at full size, 30–160 erode; burst T5 scale 0.4→1.0 outBack | 6 sparks along the reflected direction, 2 dust (T11) on ground hits |
| **Fourier ring wave** | Flat annulus, 64 segments, v radial | T6 + T1.R | POLAR, radius r(θ)=R+A·sin(12θ+φ) in the vertex shader (keeps today's idea), front hard, tail soft, STEPS 2 | 0–60 r 0→0.4R (outExpo), 60–420 → R (outCubic), erode from tail 300–520 | 8 T4 glints riding the crest; spark→ring sync on pulse |
| **Lever smash shockwave** | Ground annulus + **spike crown** (10 low-poly shards in a ring, instanced) | T6, T11, T13 | Ring: POLAR, uAdd 0.3 (dark edge visible on grass); spikes: toon, erode bottom-up | 0–50 spikes pop (outBack, overshoot 1.3), 50–200 hold, 200–450 sink + erode; ring 0–300 r 0→3.8 | 12 debris T11 (gravity), 2 dust puffs T8; shake along the swing dir |
| **Pendulum orbit trail** | `fx_orbital` bob + ribbon | T1.B, T4 | Ribbon 16 pts, u=age, width 0.25, ramp violet, pan noise along u, uAdd 0.6 | Continuous; per-hit glint 0–120 | 1 T4 glint every 120 ms dropped on the path (dashed residue) |
| **Chain lightning** | None (camera-facing quad strips per hop) | T9 (random row), T4 | Quad from→to, width 0.35; **re-pick row and flip every 50 ms** (12 fps boil), ramp electric, STEPS 2 | Per hop 0–30 white full, 30–200 erode; hops staggered 40 ms | Endpoint star T4 + 4 sparks per enemy; floor scorch decal 400 ms |
| **Golden spiral disc trail** | Disc model + ribbon following r=a·φ^(2θ/π) | T1.B, T7 | Ribbon 24 pts, u=distance (tile), ramp green-gold, width tapers to 0; gold glints | Lifetime 1500 = orbit; trail fades 250 after return | 1 spark every 2 frames at the rim; small ring on catch |
| **Prism beams** | Open cylinder (8 sides, UV u=around, v=length) ×3 + a small prism flash | T12 | Fresnel off, beam profile T12.R, striation pan v +6/s, ramps rose/cream/sky, uAdd 1 | 0–40 width 0→1.4 (outExpo), 40–120 hold, 120–340 width → 0.1 (inQuad) + erode | At the split point: T14 flare + 3 tiny rainbow glints; hit sparks along each beam |
| **Dash afterimage** | 3 pooled clones of the avatar SkinnedMeshes with one flat `FxMat` (fresnel rim, no texture) | T1.R | Pose frozen at spawn, ramp = weapon, alpha 0.6 → erode with noise, STEPS 2 | Spawn every 60 ms during the 240 ms dash; each lives 200 (outQuad) | Ground streak decal (stretched T7) + 4 dust puffs at the start |
| **Burst nova (Integral Nova)** | Dome (half icosphere, UV v=height) + ground annulus + 6 vertical light pillars | T6, T1, T4 | Dome: fresnel + erosion from top, uAdd 1; ring POLAR; `ShockWaveEffect` (mid/high) | Anticipation 0–150 inward-sucking glints; impact 150–190 full white dome + flash; 190–900 ring expands (outCubic), dome erodes | 24 sparks, 8 glints, global hit-stop (existing) |
| **Meteor** | `fx_meteor` (toon) + tail ribbon + ground target ring | T1, T7, T13, T8, T5 | Tail: ribbon 12 pts, ramp gold→orange, uAdd 0.7; target: ring filling to edge (A5 grammar) | Fall: telegraph ring 0→1 over the fall time; impact 0–30 white burst T5 r=3, 30–200 crater decal fades in, 200–1500 decal erodes | 6 smoke puffs T8, 16 debris, ShockWave, existing shake/hit-stop |
| **Black hole** | Core sphere (opaque #05020c) + `fx_disk` with spiral UV + photon ring | T1.R, T6 | Disk: POLAR, pan angle +1.5/s, radial erosion, ramp void (gold→orange→violet); **lensing**: mid/high = a `ShockWaveEffect`-style radial pull in post at the hole's screen position | Spawn 0–250 scale outBack; sustain; collapse 150 (inExpo) + white flash | Inward-spiralling T7 streaks (vel → centre), 20 max |
| **Hit spark / flash** | Enemy emissive flash (existing) | T5, T4, T7 | Burst T5 camera-facing, STEPS 2, ramp white/crit-gold; sparks stretched by velocity | Flash: 1 frame full white, 2 frames at 50 %, off (stepped, not a 140 ms linear fade); burst 0–30 full, 30–120 erode | 4–6 sparks (8 on crit) in a 60° cone opposite the hit dir, life 120–180, drag 8 |
| **Loot beam** | Open cylinder r=0.25, h=3.2, UV v=height | T12, T14 | Ramp = rarity row, v fade to top, striation pan; rarity 5: second wider, alpha-blended outer shell | Drop: 0–200 beam grows from the ground (outBack); idle pulse 1.2 s | 1 T4 glint rising every 400 ms; rarity 5: ring pulse on landing |
| **Level-up / new-weapon reveal** | Helix ribbon (2 strands) + vertical magic circle (existing, use T10) | T10, T4, T14 | Helix: ribbon u=age, rise 0→2.2 m; circle `uReveal`; HDR rarity ramp | 0–300 helix rises (outCubic), 300–380 white flash + star T4 (2 frames held), 380–1200 circle spins and erodes | 20 glints rising, DOM cut-in (C2) on top |
| **Monster death dissolve** | Monster mesh itself | T1.G (cells) | Patch the toon material: `erode = smoothstep(e, e+0.08, cells)`; a **burning edge** band `e…e+0.06` in ramp colour (HDR); stepped | 0–60 white flash, 60–520 erode bottom→top (bias by local y), body squash 0.9 | 10 glints + 4 T8 puffs at the end, then loot spawn |

## 6. Colour and light harmony
### 6.1 Findings for our setup (verified in `node_modules/three` r187)
- **The π factor.** `MeshToonMaterial` and MToon compute `irradiance × diffuse / π` (`BRDF_Lambert`), and `WebGLLights` passes `color × intensity` unscaled. With key #ffe2bd × 1.3, hemisphere #d6e6ff/#9a84b0 × 0.72 and the current ramp (lit 0.97, shadow 0.5/0.48/0.68):

  | Pixel | Albedo | Current lit | Current shadow | Proposed lit | Proposed shadow |
  |---|---|---|---|---|---|
  | Grass | #6bb85c | #51843c | #3d6433 | #68b057 | #528a4b |
  | White | #ffffff | #c5b8ad | #9a8d97 | #f8f4f3 | #c7c0d3 |

  Meanwhile `groundShader` and `grassShader` are **unlit** (full albedo), so characters and toon props sit visibly darker and muddier than the floor. Today's `HueSaturation +0.14` / contrast compensate, which over-saturates the shadows.
- **Bloom on the low tier is missing**, so emissive "glow" must be in the textures (§2). Neutral compresses only above ≈ 0.76 linear [KHR], so lit albedo should land just under that to match the model sheet (Madoka's goal: "land on the model sheet", using **light colour and multiply colour** [MDK][EX-SP]).

### 6.2 How these games pick palettes
- **Warm key vs cool sky.** Shadows lean blue/violet and are brighter and more saturated than real ones; the warm:cool area ratio is about **7:3 to 8:2**, not 1:1; deep black is almost absent; saturated pixels stay under about 10 % of the frame; sunny scenes are pushed brighter than real [ANIME-ENV] *(community)*.
- **Grading.** Genshin grades with a LUT and no ACES, and simulates artists' hue shifts in shaders [GEN-U]. WuWa uses curve-driven brightness per time of day so characters match the scene [WW1]. Exedra changes light colour per shot (footlight, rim, backlight) [EX-SP][MDK].
- **Saturation budget by discipline.** Environment low and muted, UI controlled, **VFX gets the highest saturation ceiling**. One dominant hue with a desaturated complement [RIOT-SUM].

### 6.3 Concrete values (A/B with fixed-camera screenshots before committing)
| Item | Now | Proposed | File |
|---|---|---|---|
| Key light | #ffe2bd × 1.3 | **#fff0dc × 2.4** (tune 2.2–2.6) | `scene/Environment.tsx` `Lights` |
| Hemisphere | #d6e6ff / #9a84b0 × 0.72 | **#bcd6ff / #a08cb8 × 1.1** | same |
| Back rim light | #b9d3ff × 0.18 | #b9d3ff × 0.3 (same ratio after the relight) or remove | same |
| Toon ramp (`toonGradient` default, linear) | shadow (0.5,0.48,0.68), lit (0.97,0.95,0.9), top (1,0.98,0.94) | shadow **(0.56,0.55,0.74)** ×2, lit **(1,0.99,0.97)** ×2, top (1,1,1) ⇒ shadow ≈ 0.6× lit, hue-shifted ~250° | `fx/shaders.ts` |
| Post | HueSat +0.14, contrast +0.07, vignette 0.35 | **+0.04, +0.03, 0.22** (then LUT, CEL P9) | `WorldClient.tsx` |
| Albedo ceiling | snow (0.96,0.97,1) | No large surface above sRGB ≈ 0.9: snow **(0.9,0.92,0.96)** | `lib/world/voxels.ts` |
| Fog | #cfdcf5 | Sample the panorama horizon row; hub **#d4e3f8**, Expanse **#d2def2** | `Environment.tsx`, `Expanse.tsx` |
| Impossible zone | ambient 0.6 + key 1.1 | Same π fix: ambient #d8d0ff × 1.0, key #ffe2b8 × 2.2 | `scene/Impossible.tsx` |
| Point lamps | 8 cd | Re-check after the relight (they are also /π) | `HubDecor.tsx` |

Re-check MToon faces after the change (`giEqualizationFactor` 0.95 already flattens GI). Keep **Bloom threshold 1**: with the ceiling above, lit diffuse stays ≤ ~0.95, so only FX and emissives bloom.

### 6.4 Palettes
- **Hub (floating plaza, day):**
  - sky zenith #4f9dff, mid #a9d4ff, horizon #e3eeff, sun-side haze #ffe9d6;
  - cloud lit #fbfcff, cloud shade #c8d0ec;
  - plaza stone #e8dcc6 / joints #a48f6e, grass #6bb85c / #3f8f4a;
  - gold trim #f2c46b (line #6b4b10), water and crystal #5fc4e6;
  - gate keys (keep): gold #ffd27a, violet #c39bff, pink #ff9ecb.
  - Ratio: warm stone and gold ≈ 70 %, cool sky and water ≈ 30 %.
- **Voxel Expanse** (top / side, sRGB): grass #6bb85c / dirt #946b4c, stone #9e9eb0 / #8c8ca0, sand #e6d69e / #dbc991, snow #e6ebf5 / #d2d8e8, wood #b88c5c / #8c6642, leaf #61a861 / #528f55. Accents only: crystal #8ce0ff, gold #ffd66b. Bake AO toward the ramp shadow tint (CEL P11).
- **VFX ramps** (edge → body → core; T2 rows):

  | Effect | Edge | Body | Core |
  |---|---|---|---|
  | Blade | #2a6dff | #8fe6ff | #ffffff |
  | Bow | #e0762a | #ffd27a | #fffbe8 |
  | Staff | #b0408f | #ff9ecb | #fff5fb |
  | Lever | #12957f | #6ff2d0 | #f4fffb |
  | Pendulum | #6a3fd0 | #c8a6ff | #fbf6ff |
  | Coil | #4b4dff | #9ec8ff | #ffffff (violet fringe #b48cff) |
  | Spiral | #1f9a6a | #7cf0a0 | #fffde6 (gold glints #ffd27a) |
  | Prism | rows #ff7a9c / #fff6c8 / #7ad8ff | — | white |
  | Hit | — | #ffffff | — |
  | Crit | #ff9a3c | #ffd27a | — |
  | Void / black hole | #a070ff | #ff8a3d | #ffd9a8 (core #05020c) |

  The dark edge is what separates FX from the pale sky.
- **UI and gameplay coordination:**
  - reserve **red 345–15°** for enemy danger: telegraph #ff3b30 with a dark outline #5a0b1e, HP fill #ff5d7a;
  - no player FX in that band (Staff pink stays lighter and bluer);
  - rarity colours #6fb6ff / #c08bff / #ffc94a reuse the same ramp rows for loot beams, reveal and UI frames;
  - damage numbers: white, crit #ffd27a with a dark outline.
- **Time of day (future), key / hemisphere sky:**
  - dawn #ffd2b0 × 1.8 / #b8c8ff × 0.9;
  - noon (above);
  - golden hour #ffb877 × 2.0 / #9fb4ff × 0.8, shadow ramp toward (0.55,0.5,0.8);
  - night #9fb6ff × 0.9 / #3a3f78 × 0.7, lamps and FX carry the warmth.
  - Blend via LUTs (CEL P9).

## 7. Mobile performance budget (60 fps target, 30 fps floor on low)
- **Fill rate and overdraw are the cost** on tile GPUs [ARM]. Budget: any pixel has ≤ 4 transparent FX layers. The sum of FX screen coverage is ≤ 1.5 × screen on low and ≤ 3 × on high. **No full-screen additive quads**: flashes go through the post uniform (V5/C2), not geometry.
- **Live particles:** low 150, mid 300, high 600 (hard cap in each pool; drop the oldest). Sparks ≤ 8 per hit; smoke ≤ 6 puffs alive per effect.
- **Draw calls:** FX ≤ 12 (one per batch × texture set, via instancing). Never allocate per spawn: replace `BurstPoints` and `Beam` with pooled instances.
- **Textures:** all FX ≤ 4 MB VRAM. 8-bit PNG, or KTX2/ETC1S for the larger atlases later; mipmaps on, no anisotropy except T10.
- **Shaders:** `precision mediump float` in the FX fragment. ≤ 3 texture fetches (mask, noise, ramp). STEPS and POLAR are compile-time defines, so there are no dynamic branches. A 4th fetch (flipbook blend) is high tier only.
- **Tier switches:**
  - low: no ShockWave, no flipbook blend, half spark counts, ribbons of 6 points, glow baked;
  - mid: + ShockWave on nova and meteor;
  - high: + lensing, depth soft particles, + flipbook blend.
- **Measure** with `renderer.info` (calls, triangles) in a debug overlay, and a stress scene (10 enemies, Nova + Meteor + chain), on one mid-range Android and one older iPhone (TECH.md).

## 8. Implementation order
| # | Step | Why first | Effort |
|---|---|---|---|
| **F0** | Relight (§6.3 lights, ramp, post), A/B screenshots | Biggest harmony win, ~1 h, no new code | 0.5 d |
| **F1** | `FxMat` + FxSprites/FxMeshes batches + spawn API + T1, T2, T4, T5, T7 | Everything else depends on it | 2 d |
| **F2** | Hit spark/flash package + replace `Bursts` squares | Seen on every hit; removes the ugliest piece | 0.5 d |
| **F3** | Sword slash (T3, re-UV'd `fx_slash`) | Main weapon | 1 d |
| **F4** | Death dissolve + loot beam | Every kill | 0.5 d |
| **F5** | FxRibbons: arrow, pendulum and spiral trails | 3 weapons | 1 d |
| **F6** | Rings: Fourier wave, lever shockwave, nova (+ ShockWave post) | Area attacks | 1 d |
| **F7** | Chain lightning (T9), prism beams (T12) | Rarity-5 weapons | 1 d |
| **F8** | Meteor, black hole, dash afterimage, level-up reveal (T8, T10, T13, T14) | Showpieces | 2 d |
| **F9** | Perf pass on devices, tier switches | Before deploy | 0.5 d |

Verification per step: `npx tsc --noEmit -p .`, eslint on the touched files, `npm test` (pure curve/spawn helpers), `npm run test:e2e` with the server running, plus fixed-camera screenshots of the hub and Expanse before and after, and the stress scene's `renderer.info`.

## Sources
- [RIOT] Riot Games, *League of Legends VFX Style Guide* (official, 2017): https://nexus.leagueoflegends.com/wp-content/uploads/2017/10/VFX_Styleguide_final_public_hidpjqwx7lqyx0pjj3ss.pdf · [RIOT-CL] *Clarity in League* (official): https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/ · [RIOT-SUM] *(community)* VFX Apprentice summary: https://www.vfxapprentice.com/blog/10-league-of-legends-vfx-design-tips
- [EX-SP] WFS/GREE, *Magia Exedra special-move direction*, CEDEC 2025 (official): https://speakerdeck.com/gree_tech/mo-fa-shao-nu-madokamagika-magia-exedra-nobi-sha-ji-yan-chu-woche-di-jie-pou-kiyarakutanomei-li-wozui-da-xian-nihuannijie-kerutamenokodawari · CGWORLD report (press): https://cgworld.jp/article/202508-cedec-madoka.html · [MDK] see `CEL_SHADING.md`
- [KURIE-GI] *(community)* Kurie, Genshin sparkle particle analysis: https://zenn.dev/kurie/articles/c06bdd7728db12 · [WW-VFX] *(community)* WuWa skill breakdown: https://zenn.dev/kurie/articles/62049e2d3808b4
- [D3] Julian Love, *The VFX of Diablo*, GDC 2013 (official): https://gdcvault.com/play/1017660 · *(vendor)* JangaFX, modernizing Diablo 3 VFX: https://jangafx.com/insights/diablo-3-vfx-experiments
- [ST-RIME] Simon Trümpler, *Stylized VFX in RiME* (Unreal Fest Europe 2018): https://simonschreibt.de/gat/stylized-vfx-in-rime/ · RealtimeVFX thread: https://realtimevfx.com/t/talk-video-stylized-vfx-in-rime/2503 · [ST-TEX] *How (not) to create Textures for VFX*, GDC/ADDON 2022: https://www.gdcvault.com/play/1027741 · https://simonschreibt.de/gat/how-not-to-create-textures-for-vfx/ · texture database: https://simonschreibt.notion.site/Textures-for-VFX-Database-2c72eccccfa84a0eae927d778ad746cc
- [EROS] *(community)* VFX doc, alpha erosion: https://vfxdoc.readthedocs.io/en/latest/shaders/alpha-erosion/ · [EROS-FB] flipbooks: https://vfxdoc.readthedocs.io/en/latest/textures/flipbooks/ · [RTV-ER] *(community)* RealtimeVFX erosion thread: https://realtimevfx.com/t/battlerite-erosion-ue4/4706 · [RTV-POL] radial UVs: https://realtimevfx.com/t/how-do-i-make-a-radial-uv-texture-coordinate-map/838
- [MV] *(community)* Motion vectors for flipbooks: https://realtimevfx.com/t/motion-vectors-for-animated-textures-how-do-you-generate-them/575 · https://80.lv/articles/vfx-of-star-citizen-working-on-explosions/
- [SOFT] NVIDIA, *Soft Particles* (2007): https://developer.download.nvidia.com/whitepapers/2007/SDK10/SoftParticles_hi.pdf · three.js forum: https://discourse.threejs.org/t/points-transparent-textures-depth-artifacts-soft-particles/5927
- [KAME] *(community)* 80.lv, anime beam with banding + gradient map: https://80.lv/articles/crafting-a-kamehameha-like-vfx-001agt/ · *(community)* stylized Zelda-like combat VFX: https://80.lv/articles/creating-stylized-combat-vfx-in-the-zelda-style/ · slash concepting: https://jasontomlee.itch.io/slashfx/devlog/555428/tutorial-1-how-to-concept-a-slash
- [OTZ] *(community)* 80.lv, frame-by-frame effects with OpenToonz: https://80.lv/articles/tutorial-frame-by-frame-effects-for-games-with-opentoonz
- [UNITY-VFX] Unity, advanced VFX e-book (official): https://unity.com/blog/games/create-spellbinding-visual-effects-with-advanced-vfx-guide · *(community)* Gabriel Aguiar tutorials (impact, meteor, electric orb): https://www.skillshare.com/en/classes/unity-vfx-graph-impact-effect/1753498420 · https://www.skillshare.com/en/classes/unity-vfx-graph-meteor-effect/645969489 · https://80.lv/articles/tutorial-creating-electric-orbs-in-unity
- [GG] Motomura, GDC 2015 (official): https://gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The · Guilty Gear Strive UE interview (official): https://www.unrealengine.com/developer-interviews/how-guilty-gear--strive--hits-an-ultra-combo-with-groundbreaking-visuals-and-gameplay
- Arknights: Endfield engine talk, Unite Seoul 2026 (press; no VFX detail): https://www.invenglobal.com/articles/24006/the-know-how-behind-arknights-endfield-seamlessly-implementing-fields-and-factories-with-unity · Blue Protocol CEDEC (see `CEL_SHADING.md` [BP]; no effects-specific talk found)
- [ANIME-ENV] *(community)* Yan Ru, *Anime Art Analysis: vibrant scenes in UE5*, 80.lv 2025: https://80.lv/articles/anime-art-analysis-how-to-create-vibrant-scenes-in-unreal-engine-5 · [GEN-U], [WW1], [KHR], [ARM]: see `CEL_SHADING.md`
- [Q] three.quarks (MIT): https://github.com/Alchemist0823/three.quarks · https://www.npmjs.com/package/three.quarks · [WAWA] wawa-vfx (MIT): https://github.com/wass08/wawa-vfx · [NEB] three-nebula (MIT): https://github.com/creativelifeform/three-nebula · drei Trail: https://github.com/pmndrs/drei · postprocessing `ShockWaveEffect`: https://github.com/pmndrs/postprocessing
