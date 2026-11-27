# Combat, VFX, animation feel and spells: research and plan for Math World (26/11/2026)

Scope: how Madoka Magica Magia Exedra (Exedra) and Genshin Impact (plus HSR, ZZZ, Wuthering Waves) build party/co-op hunts, combat VFX, anime animation feel and casting, then a prioritized plan for **our** stack (three + R3F, mobile-first, 10 Hz WebSocket relay).
Research only, no code changed. Sources are at the end. *(community)* marks fan wikis, guides and reverse engineering; official = developer talks, interviews, store pages.
Cel shading and post are already planned in `CEL_SHADING.md` (P1–P16); this doc only adds combat-specific deltas.

## 0. What already exists (verified in code, not re-proposed)
- **Weapons** (`combat.ts`): Vector Blade (3-step arc combo), Parabola Bow (real ballistic arrows, auto-aim solves the launch angle), Fourier Staff (ring wave with a sin ripple). **Tangent Dash** (E, segment hit, i-frames = dash 240 ms + 120 ms), **Integral Nova** (Q, energy is a running sum of hits, 110 ms hit-stop, shake 0.7). Soft aim within 7 m, 18 % crits, float numbers, a 2.5 s guard after revive.
- **Enemies** (`CombatScene.tsx`): slime, wisp and mite with a 450 ms wind-up (red ring under the feet that grows), a 140 ms white hit flash, squash on slime, shrink-and-spin death. Fixed pools: 8 slashes, 8 rings, 1 dash streak, 12 arrows plus instanced trails.
- **Feel plumbing** (`store.ts`, `fx/Effects.tsx`): global `hitstop()` (timeScale 0.03), `addShake()` with a trauma² random jitter, and a `MagicCircle` shader (angular reveal, 4 fixed rings, ticks, 2 counter-rotating glyph rings from a canvas texture).
- **Gaps found**: (a) `damageEnemy` sets `e.windup = 0` on **every** hit, so there is no poise and any boss would be stun-locked; (b) damage and slash FX fire on the button press, not on the clip's contact frame; (c) every pose cross-fades in 0.25 s (Avatar.tsx), which is too soft for attacks; (d) shake has no direction; (e) enemies are **client-local** (`Math.random` spawns). The server relays only presence (`s` = x, y, z, yaw, pose, emote, expression, avatar) and voxel edits, so co-op players never see the same monster.

## 1. Findings

### 1.1 Party and co-op hunting loops
- **Exedra is turn-based** (party of ≤ 5 in a line, a turn-order bar, a shared special gauge). Its real-time lessons are systemic, not telegraphs [EX-WIKI]:
  - **Break gauge**: a white bar above HP. It is depleted by the Breaker role or by up to 3 enemy-specific weak elements. On break the enemy's next action is **delayed**, and each hit while broken **adds to a break bonus** (≈ +5 Attacker, +20 Breaker, +12 Buffer on a weakness, per hit; multi-hit skills count every hit). When the enemy's turn returns, the bonus and the gauge reset, so the payoff is "how many actions fit inside the window" [EX-BRK] *(community)*.
  - **Role-weighted targeting**: Defender high, Healer/Buffer/Debuffer medium, Attacker/Breaker low; area attacks ignore it [EX-ROLE] *(community)*. Six roles, six elements (Flame, Aqua, Forest, Light, Dark, Void) [EX-WIKI] *(community)*.
- **Genshin co-op**: up to 4 players share a 4-character cap. The host's world defines the state. Enemy HP scales to 150/200/250 % and ATK to 110/125/140 % for 2/3/4 players [GI-COOP] *(community)*. The single-player depth comes from **swapping characters to self-trigger reactions**, and co-op reuses the same system.
- **Elemental reactions**: an attack applies an element as an **aura with gauge units** (1U/2U/4U) that decays over time. A second element consumes the aura and triggers a reaction. An **internal cooldown (ICD)** limits how often one source can apply its element [GI-GAUGE][GI-ICD] *(community)*. This is the template for our "math reactions".
- **Stagger and break bars across the HoYo/Kuro games**: Genshin has a **hidden poise** bar, and attacks carry poise damage [GI-POISE] *(community)*. HSR has **visible Toughness** that only weakness types reduce, with an element-specific break effect [HSR] *(community)*. ZZZ has **Daze**: when full, the enemy is stunned, and a heavy hit starts a **Chain Attack** that tags in teammates [ZZZ-G] *(community)*. WuWa has a **Vibration Strength** bar that is drained by attacks and especially by **parries**; at zero the enemy is immobilized [WW] *(community)*. Common pattern: **a second bar that only the right verb drains, followed by a short vulnerable window**.
- **Shields**: Genshin elemental shields (e.g., Abyss Mages) melt fastest to a counter element and stun the enemy when they break *(community, general wiki knowledge)*. Exedra Defenders use %-cut shields versus flat barriers [EX-ROLE] *(community)*.
- **ZZZ design intent** (official interviews): "dodge + bullet time" was turned from defensive into offensive, the team focused on how heavy each hit feels, and taking damage prompts a switch attack [ZZZ-IV1][ZZZ-IV2]. Distinctly coloured flashes tell the player when to dodge or parry [ZZZ-IV1] *(press)*.

### 1.2 Combat VFX language
- **Hit-stop (hitlag)**: Genshin sword N1/N2 use 0.03 s, a claymore finisher 0.15 s, a bow headshot 0.12 s, plus **+0.06 s while the target's poise is unbroken**. It is not affected by attack speed [GI-FR] *(community)*. Hitlag freezes the attacker and the target, not the world, and it extends aura timers [GI-FR]. Sakurai's channel covers hit-stop as a core topic, including how the two sides freeze and shake differently [SAK] *(press coverage)*.
- **Exedra special attacks (official, CEDEC 2025)** [EX-CUT][EX-CG]:
  - The effect lands **slightly off the enemy**, and the camera angle sells the hit.
  - Enemy size is detected, and the ground position and framing are adjusted so large enemies fit.
  - Post stack: Bloom ("diffusion"), Gradation ("flare"), DoF, **2× chromatic aberration kept to the screen edges**, LUT, **radial blur**, vignette. **The impact frame goes black-and-white with CA and radial blur.**
  - VFX were authored in SPARK GEAR by breaking the visual into components with colour/mood references. Shots run 19.5:9 / 16:9 / 4:3 safe frames.
- **WuWa skill breakdown** [WW-VFX] *(community)*:
  - phases: anticipation glyph shrinking into particles → camera pull-back → impact (scene darkens, shake, full-screen distortion) → sustain (UV-scrolled aura, helix mesh) → dissolve (trail thins into a dashed line);
  - the palette follows the character's colours, and flashes **stretch into torn, anisotropic shapes**.
- **Elemental colour language** (Genshin): one stable hue per element, also used for UI icons and the enemy aura icon above the HP bar, so a reaction reads as "two colours meet then flash white".
- **Witch labyrinths (Gekidan Inu Curry)**: the duo design the witches/familiars with collages of mixed materials, paper animation with stop-motion techniques and puppetry, after Czech and Russian animation [INU][INU-W] *(community)*. Exedra's new story uses Inu Curry concepts, and press notes it recreates the Inu Curry-style barriers in 3D [EX-STEAM][EX-FAMI] *(press; not read in full)*. Readable traits for us: flat cut-out layers, visible paper texture, jerky stepped motion and handwritten runes.

### 1.3 Anime animation feel
- **Limited / keyframe-only**: Guilty Gear Xrd animates 3D characters with keyframes only (no in-betweens), like sprites or cels, for clarity [GG-W][GG]. Spider-Verse animated mostly **on twos (~12 fps)**, mixing ones and threes as needed [SV1][SV2] *(press)*.
- **3D lies**: Exedra **enlarges a hand** to match 2D perspective, hand-keys hair/skirt secondaries (no physics), staggers skirt motion, and built a **dedicated facial set** for special attacks. Showing the face is the top priority [EX-CG][EX-CUT].
- **Cancels and timing** (Genshin) [GI-FR] *(community)*:
  - most normal attacks can be cancelled by skill, burst, dash, jump or swap; a dash is ~20 frames and a jump ~30;
  - inputs register in 0–2 frames and the animation starts ~2 frames later; a swap costs ~90 ms plus latency, with no buffering during the swap;
  - burst animations grant i-frames.
- **Character swap as an attack**: WuWa (Intro/Outro skills) and ZZZ (switch/assist attacks after a knock-back) turn swapping into a damage and defence verb [ZZZ-G][ZZZ-IV2] *(community/press)*.

### 1.4 Cel/post look deltas (rest in `CEL_SHADING.md`)
- Genshin grades with a LUT and avoids ACES [GEN-U]. Exedra keeps ACES with shader pre-correction, a depth rim, a character self-shadow, perspective cancel, and per-shot light rigs (key, rim, fill; footlight for "fragile") tuned so that **faces carry no shadows** [MDK][EX-CG].
- Combat-relevant addition: Exedra's **impact frame** (B/W + CA + radial blur), applied for 2–3 frames, is cheap enough for us if it is merged into an existing pass (V5).

## 2. Spells & Incantations

### 2.1 How casting is staged
- **Madoka**:
  - each girl's magic is a **visible, countable construct**: Mami's ribbons turn into many muskets and restraints; Madoka's single bow fires up to 5 arrows or hundreds from a seal; Kyoko's chained spears move like snakes and she builds lattice barriers; Sayaka regenerates; Homura's shield is an hourglass that runs only while time is stopped, freezing everything except what she touches [PM-AB] *(community)*;
  - the scene goes greyscale during the time stop [PM-TT] *(community)*;
  - the Soul Gem is a power budget restored with Grief Seeds [PM-SG] *(community)*.
- **Fate/TYPE-MOON**: spell power scales with **incantation length**, from single-action through "one-line"/"five-line" up to "ten-count" arias and Reality Marble chants, and "high-speed incantation" shortens it [TM] *(community)*. So the chant is the **cost and the telegraph** at once.
- **Frieren**: a spell is a mental image of its effect, and Zoltraak became a standard spell once it was "deciphered" into the human system [FR] *(community; partly unverified)*. Understanding the structure is the power, which fits our pillar "the law is the mechanic".
- **Genshin catalysts**: the catalyst floats beside the caster and attacks are projectiles. Burst = camera cut, i-frames, elemental colour. Our `WeaponFamiliar` already floats.
- **Transformation sequences**: reusable bank footage that became a genre ritual [MG] *(press/academic)*. For us that means a **once-per-session** ~1.5 s, skippable cut-in.
- **Common staging grammar**:
  1. **Chant**: the character is planted, the voice rises, glyph text flows.
  2. **Circle build**: rings appear one by one from the inside out with overshoot, counter-rotating glyph bands, and a vertical "muzzle" circle in front.
  3. **Lock**: a 100–150 ms hold, white glint, sound cut-off.
  4. **Release**: flash, impact frame, shake toward the target.
  5. **Residue**: the circles shatter into glyph particles.
  - The camera pushes in low during the chant and pulls back on release. The UI shows the chant line (verse by verse) and a ring that counts layers.

### 2.2 Our casting model ("Aria")
- Hold the Staff button or a new **Cast** button to chant. Each **verse** (~350 ms, on a beat) adds one circle **layer** and one term to the on-screen expression. Release at any time to fire.
- Moving at more than 50 % speed or taking a hit **drops one layer**. Guard frames prevent this.
- On mobile, cap a chant at 4–6 verses (≤ 2.1 s), and show a layer ring on the button.
- **Sound = literal Fourier synthesis**: verse k adds an oscillator at k·f₀ (the `tone()` WebAudio helper in `lib/world/sfx.ts`), so the chant audibly builds a waveform.
- **Co-op "harmonize"**: a nearby ally who taps Cast on the beat adds a layer to *your* circle. These are **superposition** layers, relayed as a small `cast` event.
- **Clarity (Soul Gem)**: each layer clouds a gem icon on the HUD, and the gem clears over time or on kills. This is a budget, not punishment, and it replaces nothing in the energy system (Nova keeps using energy).

### 2.3 Eight spells (mechanic · real idea · cheap VFX · `MagicCircle` use)
| Spell | Mechanic | Idea it embodies | VFX recipe (mobile) | MagicCircle |
|---|---|---|---|---|
| **Zeno Aria** (Σ ½ᵏ) | Each verse adds a bolt worth a·½ᵏ. Total damage approaches 2a, so long chants have diminishing returns. | A convergent geometric series has a finite limit. | Nested rings whose radii halve. On release, all bolts merge into one beam (1 stretched additive quad). | `uLayers`: ring k at r = ½ᵏ. The glyph texture shows "½ ¼ ⅛ …". |
| **Harmonic Overload** (Σ 1/k) | Same aria, but the terms are 1/k. It never caps, yet grows like ln n, and each extra verse raises the interrupt risk. Pair it with Zeno so players feel convergence versus divergence. | The harmonic series diverges, but slowly. | A circle that keeps adding thinner rings. Rising pitch. | `uLayers` with no cap. Ring width ∝ 1/k. |
| **Fourier Choir** | Each verse adds harmonic sin(kθ)/k (odd k → square wave). The circle rim draws r(θ)=R+A·Σ. When the partial sum matches a shield's waveform (L² error < ε), the shield shatters. Gibbs overshoot stays visible. | Any periodic wave is a sum of sines. Square-wave synthesis and the Gibbs phenomenon. | The rim is displaced in the fragment shader (8 uniforms). The target shield shows its waveform on the same polar plot in red. | `uWave[8]` amplitudes plus `uTarget[8]` ghost curve. |
| **Symmetry Seal** (Dₙ) | Two swipe gestures, *rotate* (r) and *flip* (s), apply to the seal. Match the enemy's sigil orientation to bind it for 3 s. The seal's power grows with the group order 2n. r·s ≠ s·r, so order matters. | The dihedral group: composition and non-commutativity. | The star is analytic (polar fold `mod(θ, 2π/n)`), so no texture is needed. Mirror flips show a horizontal wipe. | `uSym = n`, `uFlip`, `uRot`. |
| **Ribbon Volley** (Mami-inspired) | Ribbons trace a rose r = cos(kθ). Muskets spawn on the petal tips and fire together. The player picks k: odd k gives k petals and k shots; even k gives 2k. | Parametric/polar curves and the petal rule. | A ribbon is a line strip that grows with t. Muskets come from an instanced pool of 16 with vertical muzzle circles. | Vertical circles (existing `vertical` prop) as muzzles, sized 0.4 m. |
| **Roots-of-Unity Sabers** (Sayaka-inspired) | Summon n sabers at angles 2πk/n and throw them all at once. Their knock-backs sum to **zero** (Σ zᵏ = 0), so the target is **pinned** (Equilibrium, R2). Throwing n−1 sabers leaves a net push of −z⁰. | The roots of zⁿ = 1 sum to zero. Vector balance. | n stretched-octahedron instances on a ring. Head-to-tail vector arrows flash on impact. | `uSym = n` ticks mark the angles. |
| **Lorentz Hourglass** (Homura-inspired) | A charge v/c ∈ [0, 0.99] grows per verse. Inside the bubble, enemy clocks run at √(1−v²/c²): almost no effect until ~0.8c, then a steep drop. The world inside turns greyscale. | The Lorentz factor is non-linear. Time dilation. | A greyscale and CA ring mask inside the radius (one uniform in the post pass). The hourglass sand is a 2-colour shader. | The circle's ring speed itself slows by γ. |
| **Halving Compass** | Find a hidden target among N cells. Each verse halves the candidate region, shown as a shrinking sector, and log₂N verses guarantee a lock-on. | Binary search. Logarithms. | The circle masks a sector of angle 2π/2ᵏ and fades the rest. | `uSector` (start, width). |

**`MagicCircle` extensions** (one shader, no new pass):
- `uLayers` (float; ring i pops in with an overshoot when `uLayers > i`), `uSym`, `uFlip`/`uRot`, `uWave[8]`/`uTarget[8]`, `uSector`, `uLock` (white glint), `uFill` (reuse as telegraph fill), and a per-spell glyph string through the existing `glyphRingTexture(glyphs)` parameter.
- **Pool 4 circle meshes and 1 material per spell type.** Today every `<MagicCircle>` builds its own `ShaderMaterial`.
- On low tier, keep at most 2 circles on screen at once, because additive quads cost fill-rate.

## 3. Prioritized implementation plan

| # | Item | Where | What, concretely | Cost | Effort |
|---|---|---|---|---|---|
| **A1** | **Hit-feel pass** | `combat.ts`, `CombatScene.tsx`, `Effects.tsx` | See the A1 bullets below the table. | ≈0 | 1 d |
| **A2** | **Poise + break bar ("Coherence")** | `combat.ts`, `CombatScene.tsx` | See the A2 bullets below the table. | ≈0 | 1 d |
| **A3** | **Animation feel** | `Avatar.tsx`, `retarget.ts` | See the A3 bullets below the table. | ≈0 (fewer mixer updates) | 1.5 d |
| **A4** | **Math reactions (local first)** | `combat.ts` | Tags with gauge, decay and ICD (§3.2). **Weapon swap = Intro attack**, a small hit from the incoming weapon with a 1 s swap cooldown (WuWa/Genshin), so solo players can self-react. | small | 1.5 d |
| **A5** | **Telegraph language** | `CombatScene.tsx` | See the A5 bullets below the table. | 1 quad/enemy | 0.5 d |
| **B1** | **Shared hunt protocol** | `realtime/server.mjs`, `net.ts` | §3.1. Boss state is authoritative on the server at 10 Hz. Hits are claims. Players resolve their own damage. | ~1 KB/s per hunt | 2–3 d |
| **B2** | **Boss: Fourier Siren** (already in the bestiary as co-op) | new `combat/boss.ts` (+ server mirror) | §3.3 | 1 boss mesh + decals | 3 d |
| **B3** | **Aggro & roles** | server | Threat = Σ damage × role weight + proximity, with hysteresis (switch only at > 1.3× the current target). Show a tether line from the boss to its target. A "Pendulum Shield" holder gets ×2.5 weight, like the Exedra Defender. AoE ignores threat. | ≈0 | 0.5 d |
| **C1** | **Aria casting + 8 spells** | `combat.ts`, `fx/shaders.ts`, `Hud.tsx` | §2.2–2.3, starting with Zeno/Harmonic (shared code) and the Symmetry Seal | small | 3–4 d |
| **C2** | **Burst cut-in** | `Hud.tsx` (DOM), `combat.ts` | See the C2 bullets below the table. | DOM only | 1 d |
| **C3** | **Labyrinth arena look** | new boss arena scene | See the C3 bullets below the table. | low | 2 d + art |

**A1 · Hit-feel pass**
- **Per-hit hit-stop on attacker and target only**: 30 ms light, 60 ms finisher, +40 ms if the target is unbroken, 120 ms on break. Do this with a local `freezeUntil` on the player mixer and the struck enemy. Keep global `hitstop()` for burst and break only.
- **Fire damage on the contact frame**: schedule it about 90–130 ms after the press, read once per clip as the hand-bone speed peak.
- **Shake**: replace the random jitter with a directional impulse along the hit direction, a critically damped spring, and a 2–3° FOV punch.
- **Hit-spark pool**: `InstancedMesh` of 64 stretched additive quads (4–6 streaks per hit, 120–180 ms life, HDR colour > 1 so bloom catches them).
- **Enemy squash on hit**: (1.2, 0.8, 1.2) → elastic back in 120 ms.

**A2 · Poise + break bar ("Coherence")**
- Stop clearing `windup` on every hit. Each hit subtracts poise, and the wind-up is interrupted only at 0 poise, which lets bosses act.
- Bosses get a visible white bar under HP. At 0 the boss is broken for 5–6 s, its action is delayed, and each hit adds a **ramping break bonus** (Exedra-style, +4 % per hit, reset on recovery).
- Reactions and the right weapon drain more: HSR/Exedra weakness gating.

**A3 · Animation feel**
- (1) **On-twos** for attack, cast and burst clips: step the mixer at 1/12 s (reuse the NPC `acc` throttle pattern) while locomotion stays at 60 fps.
- (2) **Anticipation curve**: start `Sword_Attack` ~30 % in, play the wind-up at 0.7× and the strike at 1.6× (piecewise `setEffectiveTimeScale`).
- (3) Cross-fade **0.06 s into attacks/hurt, 0.2 s back to idle**.
- (4) **Cancel windows**: per-clip [startup, active, recovery]. Dash or skill may cancel recovery. Keep a **150 ms input buffer**.
- (5) **Motion warp**: lunge 0.6–1.2 m toward the soft-aim target during startup.
- (6) **Dash afterimages**: 3 pooled single-colour clones of the avatar's skinned meshes, posed at the last frames.
- (7) **Weapon smear**: stretch `WeaponFamiliar` along velocity in the vertex shader.
- (8) VRM expressions: `angry`/`surprised` with an overshoot during the burst (Exedra's special-attack face set).

**A5 · Telegraph language**
- Replace the growing ring with a **fill-to-edge decal**: draw the outline at once, and when the fill reaches the edge, the hit lands. Use an outline with a dark border for bright ground and blink during the last 150 ms.
- Add a **glint sprite** at wind-up start. Yellow = dodge-able (a perfect dodge in the last 150 ms gives a *Tangent Window*: the next hit auto-crits and refunds 50 % of the skill cooldown). Red = must move.
- **Perfect dodge is a local buff, never a global slow** (co-op).

**C2 · Burst cut-in**
- Run 0.9 s at timeScale 0.05, **local player only**. Peers see a 300 ms glyph flash over the caster.
- Layer a diagonal band, the avatar thumbnail, CSS speed lines, then an **impact frame**: 2 frames of B/W + CA + radial blur (6 taps, mid/high tier) as a uniform in the existing Ink/composer pass.

**C3 · Labyrinth arena look**
- **Paper cut-out cards**: instanced alpha-tested quads with a baked white paper border and a 4 px offset drop shadow.
- **Boil**: cycle 3 UV variants at 8 fps, and step transforms at 12 fps.
- Handwritten formula runes and a paper-grain/halftone overlay in post. The arena only; the open world keeps the clean look.

### 3.1 What the server must relay (B1)
- **Scope**: ambient mobs stay client-local and cheap. Only a **hunt** (party of 2–4, matching RESEARCH.md) is shared.
- **Messages**:
  - `hunt.join {hunt}` → server `hunt {id, seed, boss, maxHp, maxBrk, members}`.
  - Boss state piggybacks on the existing 10 Hz `snap` as `b: [hp, brk, phase, x, z, yaw, state, targetId, tagBits]` (~60 B).
  - `tel {id, kind, at, dur, params}` is sent at least 600 ms before `at`, so every client draws the same telegraph despite RTT.
  - `hit {w, kind, x, z, dir, t}` is a client claim with **no damage number**. The server checks hunt membership, the per-weapon cooldown table, and distance from the sender's last `state` (≤ range + 1.5 m). It computes damage, crit (seeded RNG), poise, break and reactions, then broadcasts `hx {by, dmg, crit, r}` so every client plays the same sparks and numbers.
  - `cast {spell, layer}` relays co-op harmonize layers.
  - `down`/`revive {id}`: stand near a downed ally for 3 s to revive them.
- **Enemy attacks hitting players**: each client tests its **own** player against `tel` shapes at `at` (defender-favoured, so i-frames feel right under lag) and reports `hurt {tel}` only for threat and statistics.
- **Clock**: estimate the server offset from `snap.at` (keep the minimum of `at − recv` over 20 samples).
- **HP scaling**: Genshin-like ×(1 + 0.5·(n−1)).
- **Rewards**: unchanged. The realtime server never grants coins or XP. At defeat it may emit an HMAC-signed participation receipt (same signing scheme as the join token) that a web-app server action verifies.

### 3.2 Math reactions (A4; computed on the server for bosses, locally for mobs)
Tags carry gauge units (1 or 2) that decay over 6 s. ICD: each source may re-tag a target once per 0.5 s. A reaction consumes both tags.

| Reaction | Trigger | Effect | Real idea | VFX |
|---|---|---|---|---|
| **R1 Superposition** | Wave + Wave (two Staff rings overlapping on a target) | Phase difference Δφ comes from the cast times modulo the ring period. Amplitude 2·cos(Δφ/2): in phase → ×1.8 damage and ×2 break; anti-phase → **silence** (cancels the wind-up and strips the shield). | Interference | The existing ring shader draws an interference band where the rings overlap: one `cos(k·(r₁−r₂))` term. |
| **R2 Resultant** | Vector + Vector/Tangent (knock-backs from 2 hits within 0.6 s) | R = v₁ + v₂. If \|R\| > threshold → **Launch** (airborne, +break). If \|R\| ≈ 0 → **Equilibrium Pin** (rooted 1.5 s). | Vector addition, net force | Two arrows drawn head to tail, then the resultant flashes. |
| **R3 Resonance** | Wave tag, then rhythmic hits | A tagged enemy bobs with period T = 0.8 s (pulsing ring). Hits within ±90 ms of a peak count ×2 toward break and ramp up. Off-beat hits drain the ramp. In co-op, everyone's in-phase hits add up. | Driving a system at its natural frequency | A metronome ring on the enemy and a beat tick in sfx. |
| **R4 Riemann Sum** | Any tags + Integral Nova | Each tagged enemy grows a stack of bars, one per hit with height = damage. Nova adds the summed area × 0.5 as bonus. | Integral = accumulation | Instanced bars above the enemy that collapse into the Nova ring. |

### 3.3 Boss: Fourier Siren (B2)
- **Phase 1, Harmonic Shield**: 3 concentric harmonic rings (k = 1, 2, 3). Each ring blocks damage until R1 (in phase) or the Fourier Choir strips it.
- **Projection Ward**: the shield only absorbs the hit component along its facing n̂. The damage taken is |v − (v·n̂)n̂|, so flankers (the side players) deal full damage while the aggro holder stays in front.
- **Telegraphs**, all as fill-to-edge decals sent with `tel`:
  - **Standing Wave** (1.2 s): the ground shows |sin(kx)| bands. Stand on a node or take a hit. k rises per phase. Teaches nodes and antinodes.
  - **Beat Pulse** (2.5 s): two tones of close frequencies; damage pulses at |f₁−f₂|. The HUD draws the envelope, so dodge on its peaks. Teaches beats.
  - **Lissajous Chase**: an orb follows (sin at, sin bt) and the decal pre-draws the next 1 s of the curve.
  - **Glint Lunge**: a yellow glint means a perfect dodge is possible.
- **Break**: the Coherence bar (A2) drains fastest from R3 Resonance. When broken, the Siren "decoheres" (collapses into paper cut-outs) for 6 s with Exedra-style bonus ramping.
- **Phase 2 at 50 % HP**: harmonics k = 1–5, and the Standing Wave and Beat Pulse overlap.
- **Mobile budget**: 1 skinned or procedural mesh, ≤ 3 decal quads, 1 spark pool.

**Order:** A1 → A3(1–3) → A2 → A5 → A4 (solo value first) → C1 (Zeno/Harmonic, then Seal) → B1 → B3 → B2 → C2 → C3.
**Verification per step:** `npx tsc --noEmit -p .`, eslint on the touched files, `npm test` for the reaction maths (pure functions), and `npm run test:e2e` with the server running. Do one 2-client LAN hunt with an artificial 150 ms delay and check that telegraphs match on both screens.

## Sources
- [EX-CUT] WFS, *Magia Exedra special-attack direction*, CEDEC 2025 (official): https://speakerdeck.com/gree_tech/cedec2025-0723-2-1440
- [EX-CG] CGWORLD report on the CEDEC 2025 talk (press): https://cgworld.jp/article/202508-cedec-madoka.html
- [MDK] WFS, Magia Exedra 3D look development deck (official): https://speakerdeck.com/gree_tech/mo-fa-shao-nu-madokamagika-magia-exedra-noipnokiyarakutawomiao-kutameno3drutukukai-fa
- [EX-STEAM] Steam store page (official): https://store.steampowered.com/app/2987800/ · [EX-FAMI] Famitsu preview (press): https://www.famitsu.com/article/202503/35699
- [EX-WIKI] *(community)* Puella Magi Wiki, Magia Exedra gameplay: https://wiki.puella-magi.net/Magia_Exedra/Gameplay
- [EX-BRK] *(community)* Game8 JP, break gauge and bonus: https://game8.jp/madoka-exedra/676555 · [EX-ROLE] roles and targeting: https://game8.jp/madoka-exedra/675269
- [INU] *(community)* Sakugabooru blog, Gekidan Inu Curry: https://blog.sakugabooru.com/2019/09/16/gekidan-inu-curry/ · [INU-W] Wikipedia: https://en.wikipedia.org/wiki/Gekidan_Inu_Curry
- [GI-GAUGE] *(community)* KQM, Elemental Gauge Theory: https://library.keqingmains.com/evidence/combat-mechanics/elemental-effects/elemental-gauge-theory · [GI-ICD] https://library.keqingmains.com/combat-mechanics/internal-cooldown
- [GI-POISE] *(community)* KQM, Poise: https://library.keqingmains.com/combat-mechanics/poise · [GI-FR] Frames, hitlag and cancels: https://library.keqingmains.com/combat-mechanics/frames
- [GI-COOP] *(community)* Genshin Wiki, Co-Op Mode: https://genshin-impact.fandom.com/wiki/Co-Op_Mode
- [GEN-U] miHoYo, Genshin console rendering, Unity Dojo 2021 (official): https://www.docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi · GDC 2021 talk: https://gdcvault.com/play/1027538/-Genshin-Impact-Crafting-an
- [HSR] *(community)* HSR Wiki, Toughness: https://honkai-star-rail.fandom.com/wiki/Toughness
- [ZZZ-G] *(community)* GameSkinny, ZZZ combat basics (Daze, Chain, Quick Assist): https://www.gameskinny.com/tips/zenless-zone-zero-combat-basics-and-controls/
- [ZZZ-IV1] Zhenyu Li interview (press): https://videogames.si.com/features/zenless-zone-zero-zhenyu-li-interview · [ZZZ-IV2] Siliconera on the Famitsu interview: https://www.siliconera.com/how-zenless-zone-zero-combat-differs-from-honkai-impact-3rd/
- [WW] *(community)* Twinfinite, WuWa Vibration meter: https://twinfinite.net/guides/wuthering-waves-vibration-meter-explained/ · [WW-VFX] *(community)* VFX breakdown of a WuWa skill: https://zenn.dev/kurie/articles/62049e2d3808b4
- [SAK] Masahiro Sakurai on hit-stop (press coverage): https://www.pockettactics.com/masahiro-sakurai-youtuber · https://www.gonintendo.com/contents/13581-sakurai-s-latest-game-dev-video-features-8-hit-stop-techniques
- [GG] Motomura, GDC 2015 (official): https://gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The · [GG-W] GAME Watch report (press): https://game.watch.impress.co.jp/docs/news/20150307_691725.html
- [SV1] VFX Voice on Spider-Verse stepped animation (press): https://vfxvoice.com/?p=5908138 · [SV2] Cartoon Brew: https://www.cartoonbrew.com/feature-film/if-its-not-broke-break-it-sony-imageworks-renegade-approach-to-spider-man-into-the-spider-verse-167321.html
- [PM-AB] *(community)* Puella Magi Wiki, personal abilities: https://wiki.puella-magi.net/Magic/Personal_Abilities/Madoka_Magica_Girls · [PM-TT] *(community)* TV Tropes: https://www.tvtropes.org/pmwiki/pmwiki.php/Characters/PuellaMagiMadokaMagicaHomuraAkemi · [PM-SG] Wikipedia: https://en.wikipedia.org/wiki/Puella_Magi_Madoka_Magica
- [TM] *(community)* TYPE-MOON Wiki, Chants & Incantations: https://typemoon.fandom.com/wiki/Chants_%26_Incantations
- [FR] *(community)* Zoltraak overview: https://fictionhorizon.com/frieren-what-is-zoltraak-how-powerful-is-it/
- [MG] JSTOR Daily, the Sailor Moon transformation sequence (press/academic): https://daily.jstor.org/selling-toys-with-the-sailor-moon-transformation-sequence
