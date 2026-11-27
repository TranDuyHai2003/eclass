# Bizarre monsters, drawn spells and weird ecology: design + research for Math World (26/11/2026)

Scope: (1) monsters that obey a strange but real rule the player must **investigate before beating**, (2) **casting by drawing** where the drawn curve *is* the math, (3) flora, props and environment shaders. Mobile-first, three + R3F, cel-shaded.
Research and design only; no code changed. Builds on `COMBAT_VFX_RESEARCH.md` (A1–C3, reactions R1–R4, Aria spells), `WORLD_DESIGN.md` (bestiary, pillars) and `CEL_SHADING.md` (P1–P16). *(community)* marks fan wikis, blogs and personal sites.

## 0. What the code gives us (verified)
- `Enemy` = `{pos, home, vel, hp, yaw, hitAt, windup, atkAt, seed}`. One shared AI in `Enemies` `useFrame`: chase inside `aggro`, wind-up 450 ms, hit if `d < 1.9`, wander around `home`. Per-kind code exists only for **looks** (`EnemyView`: slime squash, wisp bob, mite jitter).
- `damageEnemy(e, dmg, from, push)` does not know **which weapon** hit, so no rule can react to the attack type. It also clears `windup` on every hit (gap A2).
- Weapon "strike shapes" we can exploit: Blade = arc (3-step combo), Bow = ballistic point, Staff = disc r 2.8, Lever = arc, damage ∝ distance, Pendulum/Spiral = orbiters with per-target re-hit, Coil = 4-hop chain (×0.62/hop), Prism = 3 piercing rays ±0.32 rad, Tangent Dash = segment, Integral Nova = disc r 7.
- Input: the left joystick captures its own pointer; camera drag listens on the canvas (touch: only `clientX > 40 %` of the width; mouse: **pointer lock**); HUD buttons `stopPropagation`.
- Props/wonders already in: `Ouroboros` (lemniscate), `Sunflowers` + Gemcrest feathers (phyllotaxis), Tesseract, Klein bottle, Lorenz, Poincaré disk, Black Hole (lensing). Water is one flat toon plane; the hub has a scrolling waterfall shader.

## 1. Rule-monster framework (one-time plumbing, ~1 day)
1. **Hooks per kind** in `ENEMY`: `think?(e, ctx)` replaces the default chase; `onHit?(e, hit) → multiplier` (0 = immune); `tell?(e, view)` drives the look. Add `e.s = new Float32Array(8)` scratch and `e.st` (state int) so hot paths don't allocate.
2. **`damageEnemy(e, dmg, from, push, src)`** where `src = {w: WeaponId | "dash" | "nova" | SpellId, strikes, dir, t}`. Every rule below needs this.
3. **Loud, informative failure**: an immune hit plays a *clink*, a deflect spark, and a **glyph** float (`÷?`, `≢ 0 mod 6`, `½`, `◇`). It never costs the player HP. Failure is the main way players discover rules.
4. **Field Notes** (inspired by Outer Wilds' rumor log [OW] *(community)*): the game logs observations automatically ("never moved diagonally", "hits halved: 8, 4, 2…"). Two clues show a hypothesis card. Exploiting the rule once stamps it **Understood**. That grants +1 **Insight** drop and only then reveals the formula on the bestiary card. The formula always comes after the experience, never before (pillar 1).
5. **Decal pool**: one `InstancedMesh` of ground quads plus one SDF shader with a per-instance `shape` attribute: circle, **diamond (L1)**, **square (L∞)**, **knight ring**, hyperbolic stripes, sector, grid patch. 1 draw call, ≤ 24 instances. It also hosts the A5 fill-to-edge telegraphs.
6. **Determinism**: all randomness from a seeded PRNG (mulberry32 of `e.seed`) so B1 shared hunts can replay the same AI. Each rule is a pure function, which lets `npm test` unit-test it.

## 2. Bizarre monsters (Priority 1)
Design rule: each monster has (a) a silhouette or decal tell, (b) a sound tell, (c) a failure that teaches. The counter always uses a weapon we already ship. Drops reuse `MatId`; new mats are marked **new**.

| Monster · idea | Rule it obeys | How the player discovers it | Counter (our kit) | Drops | `think`/`onHit` sketch |
|---|---|---|---|---|---|
| **Taxicab Rook** · L1 metric [TAXI] | Moves only along grid axes in 1.5 m steps (hop, pause 350 ms). Its slam hits the **L1 ball** \|dx\|+\|dz\| ≤ 3.2, a diamond. | Glowing grid lines under it. Diamond telegraph. Never cuts a corner, so diagonal chases feel slow. | Stand on a **diagonal**: the diamond only reaches 3.2/√2 ≈ 2.26 m there, and Blade (2.6 m) outranges it. Hits within ±20° of 45° crit ×1.5. Tangent Dash diagonally through it. | prime, **Metric Pin** (new) | Every 350 ms pick the axis with the larger \|d\|, target = snap(pos + axis·1.5). Lerp with a hop arc. Slam if \|dx\|+\|dz\| < 3.2. |
| **Knight Imp** · chess metric | Teleport-jumps (±1, ±2) cells. Attacks only the **8 knight squares** around it. | 8 ring decals flash before the strike. Players who hug it notice they never get hit. | Stand **orthogonally adjacent**: that square is 3 knight moves away. Hit from there with Blade or Lever. Prism's side rays cover its landing squares. | prime, Metric Pin | Choose the knight move that minimises L2 to the player. Every 0.9 s, jump with a 0.3 s parabola. Hurt if the player cell ∈ the knight set at land time. |
| **Zeno Tortoise** · convergent series [ZENO] | Within a combo window, hit *k* deals a·½ᵏ, so a chain totals < 2a. HP = 2.5a, so spam never kills it. A pause ≥ 1.2 s resets the series. | Float numbers visibly halve (16, 8, 4, 2…). Shell rings narrow. Field Notes log "hits halve". | Rhythm: one strong hit, wait, repeat. Lever at full arm, a Bow headshot, or Nova (big a). Teaches limits. | pi, **Shell Series** (new) | `onHit`: `k = now − e.s[0] < 1200 ? e.s[1] + 1 : 0`, return 0.5^k. Store k and the time. |
| **Prime Warden** · divisibility | A shield shows *n*. An attack whose *strikes* (Pendulum 2, Spiral 2, Prism 3) all land within 0.3 s **divides n** if they divide it. Prime n resists multi-strike and Nova and breaks only after **exactly p consecutive single strikes**; p + 1 resets. | Composite shields render as an a×b tile array, primes as one line. A multi-strike on a prime glows "÷?" and clinks. | Factor 12 = 3·2·2 → Prism, Spiral, Pendulum. For 7: count 7 Blade or Bow hits. Matches the Prime Shard lore. | prime ×2 | `onHit`: accumulate strikes per 0.3 s window, then `if (n % c === 0) n /= c`. Prime branch: count singles. |
| **Modulo Clock Sentinel** · modular arithmetic | An m-faced turret turns s faces per tick. The weak face visits only m/gcd(m, s) faces. It fires only from faces **outside** that orbit. | Faces numbered 0…m−1, an audible tick, the weak face glows. Standing at some faces it **never** opens. | Stand at a face in {0, s, 2s, …} mod m and strike on the tick. m = 6, s = 2 → faces 0, 2, 4. Later: s changes after each break. | pi, prime | `e.s[0] = (e.s[0] + s) % m` each tick. Weak if the player sector equals the current face. Fire from sectors not in the orbit set (precompute). |
| **Bell Crab** · resonance (bestiary) | Natural period T = 0.8 s. Hits within ±90 ms of the beat add amplitude, off-beat hits damp it. The shell cracks at amplitude 1. | The shell rings a pitch on each beat and a metronome ring pulses. Off-beat hits make a dull thud. | Hit on the beat. Pendulum Flail's period is tuned to T, so it resonates by itself. Ties to R3 Resonance. | **Phase Pearl** (new), pi | `onHit`: phase = ((t − t0) mod T)/T. amp += in-window ? 0.25 : −0.15. Return amp ≥ 1 ? 3 : 0.2. |
| **Interference Twins** · superposition | Two emitters; the ground intensity cos²(π·Δr/λ) hurts on bright fringes, and dark fringes are **hyperbolas** (constant Δr). Hitting one twin shifts its phase by π (the pattern flips). They take damage only if both are hit within 0.2 s; otherwise they heal. | Ground stripes curve as hyperbolas. One-twin hits flip bright and dark under your feet, which surprises the player. | Stand on a dark fringe. Hit both together: Staff disc over both, Prism rays, Coil chain. R1 anti-phase silence. | Phase Pearl, mobius | Decal shader gets both positions + λ. `onHit` stores the time per twin and applies shared HP only when both hits are < 200 ms apart. |
| **Derivative Stalker** · d/dt of distance | Reacts to your **radial velocity** d′ = (p − e)·v/\|p − e\|. If you approach, it backs off and counters. If you retreat, it lunges. Its guard drops while \|d′\| ≈ 0. | An arrow gauge over it shows d′ (green at 0). It flinches whenever you step straight at it. | **Circle-strafe** (tangent motion, d′ = 0), then Tangent Dash, which starts tangent. Spiral Disc hits while you orbit. | **Tangent Feather** (new), pi | `think`: compute d′ from player velocity. `e.vel += −k·d′·n̂`. `onHit`: \|d′\| < 0.6 ? 1.5 : 0.15. |
| **Brownian Mote Cloud** · random walk + temperature [BROWN] | 12 motes random-walk around a nucleus; the cloud radius grows ~√t. Each hit **heats** it (bigger steps). Cooling while you are calm makes it condense. Only the condensed nucleus takes damage. | Hitting makes it puff out ("hotter"). Standing still makes it shrink. A temperature tint goes from red to blue. | Patience: wait until it is cold and tight, then one big area hit (Staff, Nova). Spamming backfires. | fractal, **Entropy Ash** (new) | Instanced points. `step = σ(T)·gauss()`, T −= dt·0.3, T += 0.4 per hit. Vulnerable if T < 0.2. |
| **Maxwell's Demon** · entropy, Landauer [MAX][LAND] | Sorts hot and cold motes through a gate to power its shield. Each sorted mote fills its **memory** (bits). When memory is full it must **erase**: a 2 s heat puff during which it is vulnerable. | A bit bar visibly fills as your projectiles pass, then a steam puff and a glyph "kT ln 2". | Flood it with cheap things to sort: Bow volley, Prism rays, Pendulum passes. Then burst during the erase. | Entropy Ash, golden (rare) | `onHit`: bits += strikes, return 0 while bits < B. At B: `e.st = ERASE` for 2 s with multiplier 2, then bits = 0. |
| **Double-Pendulum Lasher** · chaos [DPEND] | Its arm is a real double pendulum (RK4) with the tip as hitbox. Motion is unpredictable but **bounded**: the tip stays within L₁ + L₂ and cannot flip over at low energy. | A tip trail ribbon reveals a bounded, never-repeating region. Ranged hits from outside never get punished. | Fight outside the radius with Bow or Prism. Hits on the elbow **drain energy**; below a threshold it becomes a regular small swing that is easy to time. | **Attractor Scale** (new), fractal | 2 angles + 2 velocities, RK4 at 120 Hz substeps (cheap). `onHit` on the elbow: ω ×= 0.7. |
| **Toroidal Wraith** · topology (torus) | Lives in a square tile with **wrap-around** edges. It, and any arrow that leaves the tile, re-enters from the opposite side. Its front is armored and its back is bare. | Ghost copies shimmer near the edges. A missed arrow comes back from the far side and hits *its* back. | Shoot **away** from it so the arrow wraps into its back. Bow and Prism work best. Ties into Torus Archipelago. | mobius, pi | Positions mod tile size. Projectiles in the tile get `x = wrap(x)`. `onHit`: dot(dir, facing) > 0 ? 2 : 0.1. |
| **Life Colony** · cellular automaton [LIFE] | A 12×12 B3/S23 grid that ticks every 0.6 s. Gliders hurt, still lifes don't. A **block** with one cell removed **regrows** (the empty cell has 3 neighbours). | Cells pulse on the tick. Single hits on a block "heal" next tick. Gliders walk diagonally. | Kill ≥ 2 cells of a cluster in one tick: Prism rays, Staff disc. Destroy the glider-gun core. Teaches emergence. | fractal, golden | `Uint8Array` grid, step on tick, instanced cubes. `onHit` maps the hit point to a cell and clears it. |
| **Bubble Centipede** · sorting [INV] | Segments carry heights. Its head is armored until the body is **sorted**. It sorts itself by bubble sort, one adjacent swap per 0.5 s. Hitting an **inverted joint** swaps that pair (helps); hitting a sorted joint swaps it back (hurts). | Inverted joints glow red. The number of red joints is the swaps left (inversions). | Strike only red joints (Prism hits 3, Blade arcs 1–2). Sorted → its head opens for 4 s. | prime, pi | Array of n heights. A swap animates two segments trading places. `onHit` picks the nearest joint. |
| **Greedy Ghoul** · graph search [RBG] | Each step moves to the neighbour cell that most reduces straight-line distance to you (greedy best-first). It **gets stuck** in U-shaped walls (local minimum). | It paces back and forth behind a wall even though a path exists. Variant **A\* Hound** never gets stuck: compare the two. | Lure it into a concave rock. It is helpless, so hit it with Lever or Bow. Teaches local minima. | Metric Pin | 8-neighbour argmin of distance on a coarse grid with `blocked()`. A\* variant: BFS ≤ 400 nodes every 1 s. |
| **Markov Jackal** · Markov chain [MARK] | 3 states (Hide → Strafe → Pounce) with fixed transition probabilities. It is **memoryless**: Pounce is always followed by Hide (p = 1). | Three state lamps orbit it and show the current state. Field Notes tally "after Pounce: Hide 6/6". | Punish the certain transition: after a Pounce, hit it as it turns to Hide (back exposed). | pi, **Chain Link** (new) | `e.st` = state. At each 1 s tick sample `P[e.st]` with the seeded RNG. |
| **Fourier Epicycle Serpent** · epicycles [3B1B] | Its head traces a closed curve = Σ of k circles (the body is the chain of epicycles). The head hurts and the body is immune. Each Staff hit **removes the highest harmonic**. | The curve is pre-drawn faintly on the ground. After hits it gets smoother. | Staff hits low-pass it until only the fundamental (a plain circle) remains. Then the path is predictable and the head can be ambushed. Ties to Fourier Choir. | Phase Pearl, golden | Head = Σ rₖ·(cos, sin)(kωt + φₖ). Remove the last term on a Staff hit. The chain reuses `MathCreatures` `Chain`. |
| **Kepler Comet-Kite** · angular momentum (bestiary) | Orbits a pillar on an ellipse: fast at perihelion, slow at aphelion (equal areas). Untouchable at speed. | Speed lines and a whoosh near the pillar. Hits at perihelion whiff. | Wait at **aphelion** and strike as it slows. Bow auto-aim leads it. | pi, golden | Kepler's equation solved by 3 Newton steps per frame. `onHit`: return speed > vₜₕ ? 0 : 1.3. |

**Existing three (no new art, just rules):**
- **Noise Slime** (signal averaging): 4 translucent jittering **decoys** surround the real slime. The true slime sits at the **mean** of the cloud, and decoys pop harmlessly. The tell: decoys jitter independently while the centroid is steady. The counter is aiming at the centroid: soft-aim targets the mean, or a Staff disc covers it. Sketch: decoy offsets = seeded noise; the slime is the only hittable one. (Teaches that averaging removes noise.)
- **Möbius Wisp** (non-orientable): its eye lies on a Möbius band. After one lap of its strafe orbit the eye is **mirrored** (left↔right), and it takes 2 laps to return. It is hittable only on the eye side, and its lunge comes from the opposite side. The tell: band shading flips after each lap. The counter: track laps and hit just after a flip, when the eye faces you. Sketch: `e.s[0]` = lap parity, which flips when its orbit angle wraps.
- **Sierpiński Mite** (self-similarity): on death it splits into **3 half-size mites** at the parent's corners. Each has ¼ of the parent's HP (area ratio), and depth is capped at 2. Total HP is a geometric sum, H(1 + ¾ + 9/16). The tell: corners glow before the split. The counter: an area hit right at the split (Staff, Coil chain). Sketch: `rollDrops` → `spawnEnemy("mite", corner)` with `scale` and `depth` in scratch.

## 3. Drawn spells (Priority 2)

### 3.1 Recognizer survey
| Recognizer | What it is | Pros for us | Cons for us |
|---|---|---|---|
| **$1** [D1] | Unistroke; resample 64 points, rotate to the "indicative angle", golden-section search ±45°, nearest template. ~100 LOC, New BSD. | Tiny, 1–3 templates per class. | Non-uniform scale to a square hurts 1-D strokes (lines, flat zigzags). Rotation invariance merges ∩/∪. |
| **Protractor** [PRO] | Li, CHI 2010: 16-point vectors, **closed-form** optimal rotation, cosine similarity. Optional **orientation-sensitive** mode. Offered as an option in the $1 JS demo. | Fastest, least memory, uniform scale (keeps aspect ratio), and can respect orientation and **direction** (CW ≠ CCW). | Unistroke only. |
| **$N** | Multistroke via stroke permutations. | Handles "+" and "π" glyphs. | Combinatorial cost. |
| **$P** [DP] | Point cloud, multistroke, order and direction invariant. | Robust to how people draw. | Loses **direction**: it cannot tell an inward spiral from an outward one. |
| **$Q** [DQ] | MobileHCI 2018: $P made 142× faster for low-resource devices, slightly more accurate. JS and C#, New BSD. | Best choice if we add multistroke runes later. | Same direction blindness as $P. |

**Recommendation: Protractor (orientation-sensitive) to classify, then an analytic fit of the chosen curve family to measure precision and read parameters.** Our spells are single strokes whose direction carries meaning, and the fit turns "how well you drew it" into "how strong it is". Keep $Q in reserve for multistroke runes (Gate Runes, π).

### 3.2 Input handling (coexists with joystick + camera)
- **Mobile**: a **Sigil** button sits in the right cluster. *Hold* it, then draw with the other thumb (two-thumb mode). Or *tap* it to toggle draw mode for 4 s and draw with the same thumb. While `useWorld.drawing` is true:
  - a full-screen `<canvas class="w-sigil">` (`touch-action:none`, z above the 3D view, below the HUD and joystick) takes pointer events;
  - Hub's camera `down` returns early when drawing;
  - the joystick still works because it captures its own `pointerId` and stops propagation;
  - the **first** new pointer on the overlay becomes the stroke (`strokeId`), and other pointers are ignored.
- **Desktop**: hold **right mouse** (or F) and stay in pointer lock. Integrate `movementX/Y` into a virtual cursor from screen centre and draw it. Leaving pointer lock would make the browser throttle re-locking [MDN-PL].
- **Sampling**: use `getCoalescedEvents()` when present; it is not Baseline and needs HTTPS [MDN-CE], so plain events are the fallback. Drop points < 2 CSS px apart, cap at 256 points and 2.5 s. Draw the trail as a fading polyline on the 2D canvas (no WebGL cost).
- **Time**: in solo play, a local slow-mo of 0.35 while drawing. None in shared hunts (A5 rule: no global slow in co-op).
- **Gates**: path length ≥ 12 % of min(w, h); otherwise the stroke counts as a tap or camera swipe.
- **Classify**: resample to 16 points, Protractor in orientation-sensitive mode. Accept if cosine ≥ 0.80 and the margin to the 2nd class ≥ 0.06; otherwise **fizzle** and flash the closest template as a ghost (a teaching moment). These are starting values to tune on logged strokes.
- **Templates**: generate them **from the math** (sampled functions, both draw directions), plus 2–3 playtest strokes per class. Classes: circle (CW/CCW), arc ∩, sine (≈2 periods), spiral (in/out), zigzag (3–6 peaks), ∞, line, V. That is ~20 templates, < 0.1 ms per query.
- **Precision = fit residual** (RMS / bbox diagonal): ≤ 0.03 **Perfect** ×1.5 (gold flash, chime) · ≤ 0.06 Good ×1.2 · ≤ 0.10 OK ×1.0 · otherwise ×0.6.
- **Fits** (all closed-form or tiny):
  - circle: Kåsa algebraic least squares (3×3 solve);
  - arc: PCA axis, then quadratic regression → vertex and width;
  - sine: zero crossings → ω, then linear least squares for A and φ;
  - spiral: polar about the centroid with unwrapped θ; fit ln r = a + bθ against r = a + bθ (log vs Archimedean); the sign of dθ gives CW or CCW;
  - zigzag: Ramer–Douglas–Peucker [RDP] → vertex count and segment-length spread;
  - ∞/Lissajous: one self-crossing near the centroid, and the ratio of x and y zero-crossing counts → a:b;
  - V: two RDP segments → opening angle.
- **Accessibility**: long-press Sigil opens a radial **shape wheel** (fixed OK ×1.0, no precision bonus) so drawing is never mandatory. Okami's Celestial Brush shows that drawn casting reads as magic to players [OKAMI] *(community)*.

### 3.3 Base shapes: the drawn curve is the spell
| Drawn | Spell | Parameters read from the fit |
|---|---|---|
| Arc ∩ | **Meteor Arc**: a meteor flies the drawn parabola, raycast from screen to ground | Apex height → flight time; the endpoint is the landing spot |
| Sine | **Wave**: a travelling ground wave along the stroke direction | A → width, λ → speed (ω = c·k) |
| Spiral | **Vortex**: inward pulls, outward repels | Turns → strength; log spiral = steady pull, Archimedean = long reach |
| Circle | **Shield** (feeds Pendulum-Shield aggro) | Radius → coverage; roundness → shield HP |
| ∞ / Lissajous | **Orbit**: satellites trace a:b around you | a:b → number of lobes = hits per cycle |
| Zigzag | **Lightning** (reuses Coil `bolt` FX) | Vertex count → hops; even spacing → less falloff |

### 3.4 Ten strange spells (cast by shape + context; Clarity cost from C1)
| Spell | Trigger | Mechanic · real idea | Cheap mobile VFX |
|---|---|---|---|
| **Kepler Meteors** | Ellipse drawn with an enemy inside | 3 rocks orbit the enemy as the focus. Vis-viva: they are fastest, and hit hardest, at periapsis [KEP] | Instanced rocks + existing arrow trail ribbons. Ellipse decal from the decal pool |
| **Event Horizon** | Tight inward spiral (≥ 2.5 turns) | Pull ∝ 1/r². Enemies inside r_s are frozen 2 s | Reuse the BlackHole wonder's lensing as one post uniform: UV offset ∝ r_E²/r, photon-ring additive quad |
| **Wormhole Pair** | Two circles in one stroke (figure-8 with unequal lobes) | Portal A ↔ B: enemies stepping in A exit at B (into water or cliffs); your arrows exit B behind the target | Two swirl discs (polar UV twist + fresnel rim), no render target |
| **Tidal Stretch** | Line through an enemy | Damage ∝ size × 2GM/r³ (gradient, not force), so **big enemies suffer more** [TIDAL] | Stretch the enemy body's scale along the radial axis + red/blue edge tint |
| **Gravitational Chirp** | Spiral drawn *faster* at the end | Two orbs spiral in; hit pulses speed up (chirp), then a merger burst [LIGO] | Two sprites + rising-pitch `tone()`, final Nova ring reuse |
| **Light Cone** | V opening forward | Enemies inside your future cone show a **ghost of their next 1 s** (AI rolled forward); outside it, nothing you do this second can reach them | Cone decal + 1 translucent clone per enemy (pooled) |
| **Delayed Ripple** | Sine, then a tap at a spot | The hit arrives at distance r after r/c (retarded wave). Two ripples timed to arrive together give ×2 (R1) | Expanding ring shader with a delay uniform; reuse the Staff ring |
| **Time Dilation** | Circle with a dot (tap in the centre) | Drawn trigger for the C1 **Lorentz Hourglass** (γ non-linear) | Greyscale + CA mask in the existing post pass |
| **Lorenz Swarm** | Fast ∞ | 48 particles integrate Lorenz (σ = 10, ρ = 28, β = 8/3) around the target; two casts never match [LOR] | CPU Euler on 48 points, instanced additive points, no trails on the low tier |
| **Doppler Lance** | Line while running | A moving source: enemies ahead take blue-shifted (×1.3) damage, behind red-shifted (×0.7) | Beam reuse; tint by sign of v·r̂; pitch shift in sfx |

## 4. Weird flora, props and environment (Priority 3)
**Flora and props** (bake once, instance, toon gradient):
- **L-system trees** [ABOP]: build in a worker at chunk load, then merge into 3–4 variants per biome as `InstancedMesh`. Rule depth 4–5, < 1.5 k tris each. Branch angle as a biome trait (Calculus Highlands: angle = local terrain slope).
- **Turing-pattern rocks and leopard moss**: Gray–Scott [SIMS] *(community)* on the GPU, ping-pong 128² for ~300 steps at spawn, then frozen to a texture. Coral f = .055, k = .062; mitosis f = .0367, k = .0649. On the low tier use a pre-baked PNG.
- **Game-of-Life moss** on boulders: a 64² GPU texture ticking at 4 Hz. Footsteps seed cells, so gliders crawl away from the player. It shares rules with the Life Colony monster.
- **Voronoi coral and crackled lava crust**: an F2 − F1 cellular shader for edges [IQ-VOR] *(community)*, and the same function for shatter decals.
- **Penrose crystal fields** (Hat Plaza neighbours): rhombs from de Bruijn's pentagrid [PEN] *(community)*, extruded into 5-fold glowing crystals. Floor tiles that never repeat.
- **Cheap extras**: Dragon-curve vines, Barnsley-fern points, Koch-frost decals, catenary rope bridges (cosh), Chladni sand on drum stones (standing waves; teaches the Bell Crab), Reuleaux-wheel carts (constant width), a **Gömböc** stone that always rights itself [GOM].

**Environment shaders** (one material each, no extra pass):
- **Flowing water**: a flow map with two phase-offset UV scrolls (Valve, Portal 2) [VLA], stepped toon specular, and a shoreline foam band from depth difference (the composer already has depth) [ROY] *(community)*. Coasts get 2 Gerstner waves in the vertex shader [GEMS].
- **Lava**: domain-warped fbm [IQ-WARP] *(community)* → 3-step cel ramp, emissive > 1 so bloom catches it, Voronoi crust edges, heat haze only on mid/high tiers.
- **Plasma**: a classic sum-of-sines plasma (a visible Fourier lesson) on a tokamak-torus prop with helical field lines.
- **Electricity**: midpoint-displacement arcs regenerated at 12–15 Hz (stepped anime timing, reusing `bolt`), plus baked Lichtenberg (DLA) scorch decals.
- **New wonders**: Galton Board (bell curve, Chance Bazaar), Foucault Pendulum, Hilbert Hotel door (portal to "one more room"), Mandelbrot tide pool (zoom shader), Gömböc shrine.

## 5. Prioritized build order
1. **Framework §1** (hooks, `src` on `damageEnemy`, deflect glyphs, scratch, seeded RNG) together with A2 poise. Unit tests for each rule as a pure function.
2. **Rules for the existing 3**: Noise Slime, Möbius Wisp, Sierpiński Mite. No art needed, and the rules become visible at once.
3. **Decal pool** (diamond, square, knight ring, stripes) and the **Field Notes** MVP (logged clues → Understood → Insight drop).
4. **Cheap-AI monsters**: Taxicab Rook, Knight Imp, Zeno Tortoise, Greedy Ghoul. They are procedural bodies built with `MathCreatures`; Blender GLBs come later.
5. **Sigil input + Protractor + fits + 6 base shapes** (§3.2–3.3), including the shape wheel. E2E: draw a synthetic stroke via pointer events and assert the spell.
6. **Wave and number monsters**: Bell Crab, Interference Twins, Epicycle Serpent, Prime Warden, Modulo Clock.
7. **Toon flow-map water**, L-system trees, Life moss.
8. **Strange spells**: Event Horizon, Kepler Meteors, Lorenz Swarm, Delayed Ripple first. They reuse existing FX.
9. **Remaining monsters**: Derivative Stalker, Brownian Cloud, Maxwell's Demon, Double-Pendulum Lasher, Toroidal Wraith, Life Colony, Bubble Centipede, Markov Jackal, Kepler Kite.
10. **Wonders**, Penrose and Turing props, lava and plasma.

Verify per step as in `CLAUDE.md`: `npx tsc --noEmit -p .`, eslint on touched files, `npm test` (rules, recognizer and fits as pure functions with fixed seeds), and `npm run test:e2e` for HUD and Sigil.

## Sources
- [D1] $1 Unistroke Recognizer (official project page; New BSD; Wobbrock, Wilson, Li, UIST 2007): https://depts.washington.edu/acelab/proj/dollar/index.html
- [DP] $P Point-Cloud Recognizer: https://depts.washington.edu/acelab/proj/dollar/pdollar.html · [DQ] $Q (Vatavu, Anthony, Wobbrock, MobileHCI 2018; "142× faster than $P"): https://depts.washington.edu/acelab/proj/dollar/qdollar.html
- [PRO] Y. Li, *Protractor: a fast and accurate gesture recognizer*, CHI 2010: https://dl.acm.org/doi/10.1145/1753326.1753654
- [MDN-CE] `getCoalescedEvents` (not Baseline, secure context): https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents · [MDN-PL] Pointer Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- [RDP] Ramer–Douglas–Peucker: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
- [OKAMI] *(community)* Celestial Brush: https://okami.fandom.com/wiki/Celestial_Brush · [OW] *(community)* Outer Wilds Ship Log: https://outerwilds.fandom.com/wiki/Ship_Log
- [TAXI] Taxicab geometry: https://en.wikipedia.org/wiki/Taxicab_geometry · Chebyshev distance: https://en.wikipedia.org/wiki/Chebyshev_distance
- [ZENO] https://en.wikipedia.org/wiki/Zeno%27s_paradoxes · [BROWN] https://en.wikipedia.org/wiki/Brownian_motion
- [MAX] Maxwell's demon: https://en.wikipedia.org/wiki/Maxwell%27s_demon · [LAND] Landauer's principle: https://en.wikipedia.org/wiki/Landauer%27s_principle
- [DPEND] *(community, educational)* myPhysicsLab double pendulum: https://www.myphysicslab.com/pendulum/double-pendulum-en.html
- [LIFE] *(community)* LifeWiki, Block: https://conwaylife.com/wiki/Block · [INV] Inversions: https://en.wikipedia.org/wiki/Inversion_(discrete_mathematics)
- [RBG] *(community)* Red Blob Games, A* and greedy best-first: https://www.redblobgames.com/pathfinding/a-star/introduction.html
- [MARK] *(community)* Setosa, Markov chains explained visually: https://setosa.io/ev/markov-chains/ · [3B1B] *(community, educational)* Fourier series: https://www.3blue1brown.com/lessons/fourier-series
- [KEP] Kepler's laws: https://en.wikipedia.org/wiki/Kepler%27s_laws_of_planetary_motion · [TIDAL] https://en.wikipedia.org/wiki/Tidal_force · [LOR] https://en.wikipedia.org/wiki/Lorenz_system
- [LIGO] LIGO, What are gravitational waves (official): https://www.ligo.caltech.edu/page/what-are-gw
- [ABOP] Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants* (free PDF): http://algorithmicbotany.org/papers/#abop
- [SIMS] *(community)* Karl Sims, Reaction-diffusion tutorial: https://www.karlsims.com/rd.html
- [IQ-VOR] *(community)* Inigo Quilez, Voronoi edges: https://iquilezles.org/articles/voronoilines/ · [IQ-WARP] domain warping: https://iquilezles.org/articles/warp/
- [PEN] *(community)* Preshing, Penrose tiling explained: https://preshing.com/20110831/penrose-tiling-explained/ · [GOM] Gömböc: https://en.wikipedia.org/wiki/G%C3%B6mb%C3%B6c
- [VLA] Vlachos, *Water Flow in Portal 2*, SIGGRAPH 2010 Advances course (official): https://advances.realtimerendering.com/s2010/index.html · [GEMS] GPU Gems ch. 1, Effective Water Simulation: https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
- [ROY] *(community)* Roystan, Toon water shader: https://roystan.net/articles/toon-water/
- Not fetched this session (from prior knowledge): Protractor paper body, LIGO, myPhysicsLab, Preshing, Roystan, GPU Gems, Vlachos. Fetched: $1, $Q, MDN `getCoalescedEvents`.
