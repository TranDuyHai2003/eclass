# Wonder Expanse: the voxel world pushed to the limit (26/11/2026)

Scope: world generation, math/physics blocks, voxel-native combat and creatures, mobile performance, and a build order for the infinite Minecraft-like realm (`/world`, realm `expanse`). This is research and design only; no code was changed.
It builds on `WORLD_DESIGN.md` (pillars, zones, bestiary), `TECH.md` (budgets, WebGL2 decision), `SPELLS_ECOLOGY.md` (rule-monster hooks, Life Colony, Greedy Ghoul, L-system/Penrose/Turing props) and `COMBAT_VFX_RESEARCH.md` (poise, Aria). Those items are referenced, not repeated.
Tags: *(community)* = blogs, wikis, personal sites, mods. *(prior)* = cited from prior knowledge and not re-fetched this session.

## 0. What the code does today (verified)
| Area | Current behaviour | Consequence |
|---|---|---|
| Terrain (`terrain.ts`) | 2D **value noise** fBm (4 octaves) + one ridged layer; flat spawn disc via `Math.hypot`; 3 biomes from one 2D fBm; `naturalAt` derives everything from `blockTop(x,z)` | Pure height field: no caves, overhangs, arches or floating land. Value noise shows grid-aligned blobs |
| Voxel store (`voxels.ts`) | `edits: Map<string,…>` keyed `"x,y,z"`; `blockAt` builds a string on **every** lookup; `columnRange` probes 30 keys per column | ~30 k string allocations per chunk before meshing even starts, plus 6 neighbour lookups per solid block. This is the main cause of the 106 ms streaming spike in `TECH.md` |
| Persistence | `setBlock` → `saveEdits()` JSON-stringifies up to 20 k edits into `localStorage` **on every click** | O(n) synchronous work per edit, and it grows with play |
| Meshing (`Expanse.tsx` `Chunk`) | Main thread, inside `useMemo`; face culling only (no greedy); non-indexed (6 verts/quad); `number[]` push → Float32 position + normal + colour = **216 B/quad**; one mesh per 32×32×full-height column | Editing one block re-meshes the whole column. The per-column `vary` tint makes every top face unique, so a greedy mesher could not merge it as-is |
| Streaming | `setChunks` with `filter`/`new Set` every frame; 2 chunks/frame; radius 1/2/3 → fog far ≈ 51/83/115 m | Allocations in `useFrame` (against the `TECH.md` rule); the horizon is tiny |
| Trees, water, mobs | Trees = instanced icosahedra (not blocks); water = one plane at `WATER_LEVEL`; `Enemies ground = blockTop` | Dug-out trees float; a pit dug below sea level stays dry; mobs ignore player builds and pits |
| `TOP_CACHE` | `Map<number,number>` with up to 400 k entries | Roughly 10–20 MB of JS heap (estimate) for data a 2 KB `Int16Array` per chunk would hold |
| Relay (`server.mjs`) | JSONL per realm; **all** edits sent on `joined`; per-block `edit` messages, 6/s token bucket, 16 m xz reach; block id hard-coded `0..9` | The join payload grows without bound (20 k edits ≈ 350 KB JSON). A "matrix transform" of 4 000 blocks would take 11 minutes at 6/s. The id cap breaks as soon as a block is added |

## 1. World generation to the limit

### 1.1 Noise kit (`lib/world/noise.ts`, pure, runs in workers and Node tests)
- **Gradient noise** (OpenSimplex2-style 2D/3D) replaces value noise; keep the existing integer hash.
- **fBm**: amplitude ½ per octave, decorrelated per-octave seeds [RBG-T][IQ-FBM].
- **Ridged** `1 − |n|`, with each octave weighted by the one before so only peaks get detail [RBG-T].
- **Domain warp**: `f(p + 4·r)`, `r = fbm2(p + 4·q)`, `q = fbm2(p)` [IQ-WARP]. Use one level for terrain (3 fBm calls) and two only for rare "Dream" regions.
- **Derivative-damped fBm**: divide each octave by `1 + |∇|²`, so slopes stay smooth and erosion-like without running a simulation [IQ-MORE].
- **Worley F1/F2**: `F1` gives cells, `F2 − F1` gives cracks and crystal seams [IQ-VOR].
- **Redistribution** `pow(e, k)` and **terraces** `round(e·n)/n` [RBG-T]. Terraces already look like voxels and read as contour lines.
- **Determinism rule for multiplayer**: ECMA-262 leaves `Math.sin/cos/exp/pow/hypot` *implementation-approximated*, and engines are known to differ in the last bits [ES-MATH] *(community)*. After `floor()`, one ulp can flip a block on a boundary. So the generator uses only `+ − × ÷`, `Math.sqrt`, `Math.floor` and `Math.imul`, plus our own polynomial `sin`/`exp` where a formula needs them.
  - Today `height()` calls `Math.hypot`; replace it with `Math.sqrt(x*x + z*z)`.
  - Add a golden-hash test: `npm test` hashes chunks (0,0), (37,−12) and (1000,1000) and compares the result with a committed value.
- **Generator versioning**: store `GEN_VERSION` with every realm's edit log. If terrain changes under old edits, player builds end up floating or buried. Either freeze the version per realm or start a fresh realm, and never silently regenerate.

### 1.2 Climate maps → biomes (Minecraft 1.18 model, scaled down)
- Minecraft 1.18+ uses three 2D noises for the terrain shape:
  - **continentalness** (ocean → coast → inland);
  - **erosion** (low = mountainous, high = flat);
  - **peaks & valleys**, `PV = 1 − |3|weirdness| − 2|`.
- **Splines** map these to a base height and a vertical "squash" factor. Temperature and humidity affect only the biome.
- A biome is the **nearest point** in that parameter space [MCW] *(community)* [HK1][HK2].
- Ours: C, E, PV → height spline; T, H → natural palette; and a sixth axis **W ("wonder")**, a low-frequency (≈ 1/600 m) noise. Where W > 0.62 the column belongs to a **math biome** (§1.4), which gives about 20–25 % of the land.
- **Blending** prevents cliffs at biome borders. Evaluate each biome's height function at the 4 corners of a 4×4 cell and blend by the biome weights (a smoothstep of the distance to the threshold). Minecraft resolves biomes on a 4-block grid for the same reason [MCW] *(prior)*.

### 1.3 Going 3D: density, caves, overhangs, floating land
- **Density function**: `d(x,y,z) = (base(x,z) − y)·squash + n3(x,y,z)·amp`; a block is solid where d > 0. This alone gives overhangs and arches [MCW].
- **Cheese caves**: `n3 < −0.55` (big chambers). **Spaghetti tunnels**: `|n3a| < w && |n3b| < w`, the intersection of two zero-sets, which forms tubes [MCW].
- **Floating islands**: a density band at y ≈ 48–80 with a cosine taper top and bottom (Luanti's floatlands work this way, between configurable Y limits) [LUA].
- **Cost control**: never evaluate 3D noise per block. Sample it on a coarse lattice (cells 4 wide × 8 tall) and interpolate trilinearly, which cuts noise calls by roughly 128×. Minecraft does the same with noise cells [MCW] *(prior)*.
- **Skip empty space**: give each 32³ **section** a cheap `min/max` density bound, then mark it `empty`, `full` or `mixed`; only mixed sections are generated and meshed.
- **Keep cubes.** Marching cubes [LAGUE] *(community)* would lose the "build with blocks" readability and the 1-block climbing rule. Use smooth SDFs only for wonders.

### 1.4 Math biomes: the terrain *is* the formula
Every math biome follows the pillars: walk it first; a shrine reveals the formula only after a discovery ("Understood", see `SPELLS_ECOLOGY.md` §1.4).

| Biome | Generator (per column unless 3D) | What the player feels or learns | Cost |
|---|---|---|---|
| **Function Plains** | Along a "graph axis" u, height = `A·f(u/s)` with f ∈ {sin, x², \|x\|, x³−3x, floor, 1/x clipped}; glowing axis blocks and tick plinths every 8 blocks | The cross-section is a readable graph. **The player can step up only 1 block**, so walkable ground is exactly where \|f′\| ≤ 1 and steep parts are walls. The derivative becomes a physical rule | 0.5 d |
| **Saddle Pass / Bowl Lakes** | `h = (x²−z²)/k` (hyperbolic paraboloid), paraboloid bowls `r²/k` that hold water, egg-crate `sin x·cos z` (poly sin) | Saddle points: uphill one way, downhill the other. Terraces show contour lines | 0.3 d |
| **Sierpiński Badlands** | Terrace height from `(x & z) === 0` (Pascal's triangle mod 2), plus `popcount(x ^ z)` mesas | A fractal from one bitwise AND. The same pattern reappears as the Rule 90 wall (§2) | 0.2 d |
| **Fractal Highlands** | Smooth escape-time iteration of Mandelbrot or Julia (`z² + c`, ≤ 48 iterations, smooth count [IQ-MSET]); c drifts with a slow noise, so every valley is a different Julia set; the main cardioid is a plateau lake | Coastlines that never get simpler as you zoom. Pure `+ − ×`, so it is deterministic by construction. Cache per chunk heightmap | 0.5 d |
| **Voronoi Steppe** | Worley F1 cells as mesas (one height and colour per cell), F2−F1 cracks as 1-block gullies, a crystal on each seed | "The nearest seed owns you": borders are perpendicular bisectors | 0.3 d |
| **Lattice Caverns** (3D, underground) | Gyroid `sin x cos y + sin y cos z + sin z cos x ≈ 0` (poly sin), Schwarz P and a BCC strut lattice, under the Fractal Highlands | Triply periodic minimal surfaces: two interleaved labyrinths that never meet [GYR] | 1 d (needs sections) |
| **Möbius River** | A closed loop curve (SDF to a seeded polyline) carved as a river; banks coloured red (left) and blue (right); the colours **swap at a seam**, so after one lap left and right are exchanged | Non-orientability. An L-shaped "chiral key" carried once around becomes its mirror image and opens mirror doors | 1 d |
| **Penrose Crystal Fields** | de Bruijn pentagrid → rhomb id per column; thick rhombs become tall crystals, thin ones short | Never repeats; the ratio of thick to thin rhombs tends to φ. The voxel version of the `SPELLS_ECOLOGY` prop | 0.7 d |
| **Graph Forest** | Poisson-disc trees [BRID] *(prior)* joined by catenary rope bridges along the **minimum spanning tree** plus a few extra edges; one grove is the Königsberg layout | Crossing every bridge exactly once lights them, and the Königsberg grove proves impossible (odd degrees) | 1 d |
| **Phyllotaxis Isles** (floating) | Islands at angle n·137.508°, radius c·√n | From above, the sky is a sunflower. Jump pads chain the isles | 0.5 d |

### 1.5 Structures: grammars, L-systems, WFC
- **Placement**: use a region grid (e.g. 192 m) with a seeded jitter per region. Each structure has a bounding box, and a chunk asks "which structures in the 3×3 neighbouring regions overlap me?" and writes only its clipped part. This is Minecraft's `structure_starts` / `structure_references` split [MCW]. It is O(1), works across chunk borders, and stays deterministic.
- **Voxel L-system trees**: run the turtle with a bracket stack and write wood and leaf *blocks* (not instanced icosahedra), so trees can be mined, get AO and merge greedily. Use one rule set per biome; Graph Forest trees are literal binary trees of depth 5 [ABOP].
- **Shape-grammar ruins**: CGA-style split rules (`Tower → Floor* Roof`, `Floor → Wall Window Wall`) [CGA] *(prior)*. A "Recursion Spire" visibly repeats its own rule at ½ scale.
- **WFC labyrinths**: the simple tiled model over 12×12×3 tiles in a worker with seeded order and restart on contradiction [WFC]. Optionally play the **collapse as an animation**, so the player watches entropy drop the way a Sudoku fills in.
- **Mazes by algorithm**: DFS (long corridors), Prim (many short dead ends) and Wilson (uniform spanning tree) side by side in a "Maze Temple" [BUCK] *(community, prior)*. Each algorithm's bias is visible from the roof.

## 2. Math/physics blocks and mechanics
**Simulation model**:
- Block entities tick at 10 Hz in a worker, over an **active set** only.
- All state is a pure function of (blocks, inputs, tick), so co-op clients run **deterministic lockstep**. The relay forwards only inputs (`lever x,y,z on @tick`), and every 5 s each client exchanges a hash of its active set.
- `snap.at` already carries server time, which gives a shared tick and a shared storm schedule.

| Block / mechanic | Rule (simulation) | Idea it teaches | Sketch |
|---|---|---|---|
| **Logic wire + gates** (NOT, AND, OR, XOR, NAND, lever, lamp, clock, delay) | Union-find groups wire blocks into nets; gates are nodes in an event-driven simulation with 1 tick per gate | Boolean algebra, NAND universality, binary. Build a half adder, then a 4-bit adder that lights a 7-segment display | 2.5 d |
| **Ohm circuits** (cell, resistor blocks: copper 0.1 Ω, iron 1 Ω, graphite 10 Ω; bulb) | **Nodal analysis**: build the conductance matrix G and solve Gv = i with Gaussian elimination (≤ 64 nodes) [NODAL]; brightness ∝ P = I²R; a short circuit makes copper glow and melt into slag | V = IR, series vs parallel, and solving Ax = b as a real use of linear algebra | 2 d |
| **Lightning + rods + Faraday cage** | See §2.1 | Electrostatics: charge on the outside, E = 0 inside a closed conductor | 2 d |
| **Optics** (laser, 45° mirror, glass, prism, lens, sensor) | Beam = voxel DDA (reuse `raycastVoxel`); mirrors reflect; glass applies Snell `n₁ sin θ₁ = n₂ sin θ₂` with **total internal reflection** in "fibre" glass; a prism splits the beam by colour (n varies with colour); a lens focuses parallel beams onto the block at distance f, which ignites leaves | Reflection, refraction, focal length, dispersion | 2 d |
| **Gears and levers** | Gear trains with ratio n₁/n₂ (speed ↓, torque ↑); seesaw lifts balance Σ r·F; a crank gate needs enough torque | Torque, mechanical advantage, ratios | 1.5 d |
| **Matrix Forge** | Select a region (≤ 16³) and dial a 3×3 integer matrix (entries −2…2), with a ghost preview. Write with the **inverse map** `x = A⁻¹y` so scaling leaves no holes; when det = 0, map forward | det = volume change (the block count changes ×\|det\|); det < 0 mirrors (chirality, links to the Möbius key); det = 0 **flattens the build into a wall** (dramatic); **eigen-axes** glow as rods that do not turn; two forges in a row show AB ≠ BA [3B1B-LA] *(community)* | 1.5 d |
| **Basis treasure maps** | Clues say "3·u + 2·v from the Lorenz wonder", where u and v are crystal arrows placed in the world (not unit or axis-aligned) | Linear combination, change of basis | 0.5 d |
| **Wind and current fields** | F(p) = Σ sources, sinks and vortices; instanced arrow particles; gliding players and loose sand get pushed | Vector fields, superposition, divergence vs curl | 1 d |
| **Falling sand and water levels** | Sand and gravel fall, water spreads with levels 0–7, lava + water → stone; update bottom-up, chunk-local [NOITA] | Cellular automata, conservation (water volume is conserved) | 2 d |
| **Buoyancy** | A block whose density is lower than the fluid's floats up when placed in water (table: wood 0.6, ice 0.92, stone 2.6) | Archimedes | 0.3 d (on top of the CA) |
| **Life Garden and Rule 30/90 walls** | A B3/S23 layer on "life moss" blocks at 2 Hz; an emitter row builds a 1D CA wall one row per tick upward [R30] | Emergence. Rule 30 gives chaos from a 3-cell rule; Rule 90 draws the same Sierpiński triangle as the Badlands | 1 d |
| **Symmetry Totem** | Every block placed within r = 12 is copied by the group orbit: Cₙ, Dₙ, or the cube group (48 elements) | Group orbits; \|G\| = number of copies; rotation vs reflection | 1 d |
| **Dice block, Galton board, Buffon floor** | A seeded die whose community tally is a histogram shared via the relay; a Galton peg kit fed by falling sand piles into a bell curve [GALTON]; dropping sticks on plank floors estimates π, server-wide | Probability, binomial → normal, Monte Carlo | 1.5 d |
| **Minecart energy coaster** | Cart on a 1D rail spline with `v = √(2g(h₀ − h))` minus friction; on-screen KE/PE bars; it **cannot pass a hill higher than its start** unless a booster adds energy; a loop needs h ≥ 2.5R; a brachistochrone race lane (cycloid, straight, circle) [BRACH] | Energy conservation; the cycloid wins | 2 d |

### 2.1 Lightning, rods and the Faraday cage (the user's request)
1. **Storm schedule**: `hash(floor(serverTime / 8 min))` decides storm cells, so every client sees the same storm with no new server logic. Charge builds visibly as cloud glyphs.
2. **Strike target**: choose among the column tops under the cell, weighted by height × conductivity (copper, iron, gold, water).
   - Rods use the **rolling-sphere** rule from lightning-protection practice: the sphere radius is 20/30/45/60 m by protection class (IEC 62305), and anything a rolling sphere cannot touch is protected [IEC] *(vendor, prior)*.
   - In-game r = 12 blocks. Show the sphere as a ghost while a rod is placed, so players *see* the protected zone.
3. **Path visual**: midpoint displacement biased toward the target, with 2–3 branches, redrawn at 12–15 Hz (reuses `bolt`).
   - A **Lightning Lab** wonder runs the real **dielectric breakdown model** [DBM]: grow on a 48×48 grid, solve Laplace with about 20 Jacobi sweeps per step, and add sites with probability ∝ field^η.
   - The result shows the ~1.7 fractal dimension, the same branching as Lichtenberg figures.
4. **Consequences**:
   - A strike on sand turns it into **fulgurite glass** [FULG].
   - Current runs through connected conductor blocks to the ground, hurting anyone touching them.
   - Standing in water during a storm hurts.
   - A charged mob next to a struck rod gets chained.
5. **Faraday cage test**: 6-connected flood fill through **non-conductor** cells from the player's head, inside a 12³ box (≤ 1 728 cells, < 0.1 ms).
   - If the fill never reaches the box boundary, the player is enclosed and **immune**, even when the cage itself is struck. The cage glows on its *outside* only.
   - Copper **grate** blocks (see-through) count as conductors, because lightning is quasi-static.
   - Follow-up: *Signal Wisps* track you by "radio" with an in-game λ = 4 blocks. A grate cage blocks them unless some opening is ≥ λ/2, which teaches aperture vs wavelength.

## 3. Combat and creatures native to the voxel world
- **Block-aware movement**:
  - Mobs use `surfaceAt` (respects edits) instead of `blockTop`.
  - Walkable cell = solid below + 2 air; step up ≤ 1; drop ≤ 3.
  - One **flow field** (BFS/Dijkstra from the player over a 48×48 window, recomputed at 2 Hz in the worker) steers every chaser at once, instead of one A* per mob [FLOW] *(community)*.
  - The Greedy Ghoul / A* Hound pair from `SPELLS_ECOLOGY.md` sits on top of this.
- **Digging and building creatures** (each obeys a visible rule):
  - **Perlin Worm**: digs spaghetti tunnels by steering along a noise field (pre-1.18 Minecraft caves used "Perlin worms" *(prior)*); its digging is charged to the destruction budget.
  - **Langton's Ant**: flips floor blocks between two colours. After ~10 000 chaotic steps it always builds a "highway" with a 104-step period [LANG]. At 50 steps/s that takes 3.3 minutes; players learn to wait for order to emerge.
  - **Termite Builders**: stigmergy; they drop a carried block where neighbours already hold more blocks, and pillars and arches emerge.
  - **Fire Sprite**: ignites leaves. Fire spreads to each neighbour with probability p, so forests denser than the site-percolation threshold (≈ 0.593 on a square lattice) burn through, and sparser ones do not [PERC]. The Graph Forest gets firebreak puzzles.
- **Voxel bosses you dismantle**: the body is a voxel model (≤ 32³, ~2 k blocks), meshed with the chunk mesher, one mesh per limb.
  - **Bridge Colossus**: limbs connect to the core through a few **articulation points** (Tarjan [ARTIC]). Field Notes highlight them after two failed hits. Breaking one detaches the limb, which falls as debris. Teaches graph connectivity and minimum cuts.
  - **Menger Golem**: a level-2 Menger sponge. Each kill splits it into 20 smaller golems; volume shrinks by (20/27)ⁿ while surface grows.
  - **Matrix Golem**: each phase applies a shear or rotation to its whole body; only the core on the eigenvector axis keeps its direction and stays hittable.
  - **Storm Warden**: calls lightning on the highest conductor. Players build rods to redirect strikes into its copper armour and hide in cages (§2.1).
- **Weapons and spells vs terrain** (destruction budgets):

| Source | Terrain effect | Budget |
|---|---|---|
| Ballistic Meteor | Crater radius from the drawn-arc fit (r 1.5–3) | ≤ 113 blocks |
| Event Horizon | Lifts only *loose* blocks (sand, gravel, leaves) into the vortex, which drop as falling sand | ≤ 24 |
| Step-Function Bolt / Coil | Vitrifies sand, ignites leaves, chains along conductor blocks and water | ≤ 8 |
| Superposition Wave | Knocks loose blocks one cell along its direction | ≤ 16 |
| Bow / Prism | Arrows stick in blocks; prism rays refract through glass blocks | 0 |

  - Each player gets 60 blocks per 10 s. Spawn and wonders (24 m) and claimed builds are protected.
  - Combat edits are **ephemeral**: they heal back to the generator after 10 minutes unless someone builds on them. That keeps the realm clean and storage bounded.
  - **Unsupported player-placed structures**: a bounded flood fill (≤ 4 096 blocks) checks for a path to natural terrain. A disconnected piece becomes one falling rigid mesh, then re-voxelizes where it lands. Natural terrain counts as anchored.

## 4. Performance engineering for mobile
1. **Data layout**:
   - Sections are 32³ `Uint8Array` (32 KB; `Uint16Array` past 255 ids). Uniform sections are stored as a flag.
   - Edits are a `Map<number, Uint8Array>` per section with numeric keys (no strings).
   - Heightmap is a `Int16Array(1024)` per chunk instead of `TOP_CACHE`.
   - Store edits with **palette compression**, as Minecraft does [MC-CF] *(community)*.
   - Budget: radius 3 → 49 columns × ~4 live sections × 32 KB ≈ 6.3 MB.
2. **Workers**:
   - Use a pool of `min(2, cores−1)` workers on mobile and 3 on desktop, created with `new Worker(new URL("./voxel.worker.ts", import.meta.url))`.
   - Workers generate voxels and meshes and return **transferable** `ArrayBuffer`s with zero copy [MDN-TR].
   - The job queue is ordered by distance (in-frustum first); stale jobs are cancelled when the player moves.
   - Avoid `SharedArrayBuffer`: it needs COOP/COEP isolation, which would break embeds. Divine Voxel Engine shows the multi-worker layout (world, mesh, light threads) [DVE] *(community)*.
3. **Greedy meshing**:
   - Culling gives about 8×, and greedy about 64× more, on a solid 8³ volume, but only ≈ 1.3× fewer quads on the article's bumpy noise sample [0FPS-M] *(community)*. Our flat cel terrain and math biomes (terraces, mesas, plains) are the good case.
   - With CHUNK = 32, **binary greedy meshing** maps exactly to `Uint32` column masks, culling 32 faces per AND. The C++ original meshes a 62³ chunk in 50–200 µs [BGM] *(community)*; expect roughly 1–2 ms per section in JS.
   - Merge only when id, AO and light match.
   - **Move the `vary` tint into the fragment shader** (hash of `floor(worldPos)`), so the look stays and merging works.
4. **Vertex format**:
   - Step 1 (no shader work): indexed quads; `Int16` positions relative to the chunk origin; `Int8` normals; `Uint8` normalized colour with AO baked in. That is 16 B/vertex, **64 B/quad instead of 216**.
   - Step 2: pack each vertex into one `uint32` (x, y, z 6 bits each, normal 3, AO 2, block 8) and decode in `onBeforeCompile` of `MeshToonMaterial`. Put the emissive flag in the vertex too, so the glow mesh and its extra draw call go away.
5. **Voxel AO**:
   - Per vertex, `ao = side1 && side2 ? 0 : 3 − (side1 + side2 + corner)`, and flip the quad diagonal when `a00 + a11 > a01 + a10` [0FPS-AO] *(community)*.
   - For the anime look, quantize AO to **2 cel bands**.
   - Add a cheap sky-light term (blocks under an overhang are darker) so caves read as caves.
6. **Far terrain**:
   - Beyond the voxel radius, draw one **clipmap ring** (≈ 128×128 vertices, 4–8 m spacing, heights from the same `height()` in a worker), with the same toon material, fog and a skirt.
   - The horizon goes from 51 m to 500 m+ for ~1 draw call and ~30 k triangles. The Distant Horizons mod does this for Minecraft with LOD chunks [DH] *(community, prior)*.
   - Add **wonder beacons**: light pillars visible from far away, which pull exploration.
7. **Culling and draw calls**:
   - Bound each section with a box. Beyond the frustum, use cave-occlusion culling (a face-to-face visibility graph per section plus BFS; 50–99 % culled underground) once caves exist [TOMCC] *(community)*.
   - Keep ≤ 120 draws on low: either one merged geometry per column, or `BatchedMesh` (one material, per-object frustum culling) [THREE-BM].
8. **Foliage and water**:
   - Grass tufts are instanced cross-quads within 24 m, alpha-tested.
   - Water becomes blocks with levels, drawn as one transparent pass of top faces and sides that touch air; the flat plane stays only as the far ocean.
9. **Network and persistence**:
   - **Subscribe per chunk**: the client asks for a chunk's edits when it streams in, instead of all edits on join. The server stores one file or row per chunk.
   - Use binary frames: `[sectionKey varint][localIndex u16][id u8]` ≈ 6 B per edit, batched at 10 Hz with presence.
   - **Macro edits** (`crater`, `matrix`, `fill`, `symmetry`) travel as one op that both sides expand deterministically. The server validates the expanded count against the budget.
   - Locally, save to IndexedDB per section with a 2 s debounce.
   - Share `BLOCKS.length` with the server in place of the hard-coded `id > 9`.
10. **WebGL2 vs WebGPU**:
    - Stay on WebGL2 (`TECH.md`: WebGPU ships only from iOS 26, and our GLSL would need a TSL rewrite).
    - WebGPU would later allow compute-shader generation and meshing, vertex pulling from storage buffers and indirect draws.
    - The packed `uint32` vertex from item 4 is already the right input for that, so nothing is wasted. Revisit when ≥ 80 % of sessions report WebGPU.

## 5. Prioritized plan (most wonder per day; verify each step per `CLAUDE.md`)
| # | Item | Files | Cost | Why now |
|---|---|---|---|---|
| 1 | Numeric voxel store, sections, chunk heightmaps, debounced IndexedDB save, no per-frame allocations in streaming | `lib/world/voxels.ts`, `terrain.ts`, `Expanse.tsx` | 1 d | Removes the main cause of the 106 ms spikes; everything else depends on it |
| 2 | Worker generation + binary greedy mesher + AO + compact vertices | new `lib/world/mesher.ts` (pure, unit-tested), `components/world/scene/voxel.worker.ts`, `Expanse.tsx` | 2 d | ~3–6× less geometry, no main-thread meshing, and room for a larger radius |
| 3 | Far-terrain clipmap + wonder beacons | `Expanse.tsx`, new `scene/FarTerrain.tsx` | 1 d | **The biggest visual jump per day**: a 500 m horizon |
| 4 | Noise kit + climate spline + W axis + blending + determinism rules + golden-hash tests | new `lib/world/noise.ts`, `terrain.ts`, `tests/world/terrain.test.ts` | 1.5 d | Real mountains, coasts and plains |
| 5 | Math biomes batch 1: Function Plains, Saddle/Bowl, Sierpiński Badlands, Fractal Highlands, Voronoi Steppe | `terrain.ts` (+ new `lib/world/biomes.ts`), `i18n.ts` shrine text | 2 d | The core identity: terrain that *is* math |
| 6 | Matrix Forge (macro edit) + Symmetry Totem | new `lib/world/transforms.ts`, `components/world/ui/` dial, `server.mjs` macro op | 2.5 d | Highest "whoa" per day; linear algebra in the player's hands |
| 7 | Lightning + rods + Faraday cage + fulgurite | new `lib/world/storm.ts`, `fx/Effects.tsx`, `voxels.ts` (copper, grate, glass) | 2 d | Explicit user request; the cage test is about 40 lines |
| 8 | 3D density: caves, overhangs, Phyllotaxis Isles; section culling | `terrain.ts`, worker | 2 d | Exploration depth; needs items 1–2 |
| 9 | Structures framework + voxel L-trees + WFC labyrinth + Graph Forest | new `lib/world/structures.ts` | 2.5 d | Places worth travelling to |
| 10 | Falling sand / water CA + buoyancy + Galton/dice | worker tick, `voxels.ts` | 2.5 d | The world starts to *behave* |
| 11 | Voxel-aware mobs (surfaceAt, flow field) + Langton Ant + Perlin Worm + fire percolation | `combat/CombatScene.tsx`, `combat.ts` | 2 d | Creatures that read and change the terrain |
| 12 | Destruction budgets, ephemeral craters, falling debris; spells write terrain | `combat/spells.ts`, `voxels.ts`, `server.mjs` | 1.5 d | Spells feel powerful without griefing |
| 13 | Per-chunk edit subscription + binary edits + generator version | `server.mjs`, `net.ts` | 2 d | Required before many players build at once |
| 14 | Logic gates → Ohm circuits → optics → gears → coaster | new `lib/world/circuits.ts`, `optics.ts`, `rail.ts` | 8–10 d | Deep, long-tail builder content |
| 15 | Bridge Colossus, Menger / Matrix Golems, Storm Warden | `combat/` | 3 d each | Boss layer; builds on the rule hooks from `SPELLS_ECOLOGY` §1 |

Tests: every generator, mesher, CA, transform and storm rule is a pure function with fixed seeds in `npm test`. E2E: break and place a block, check that the chunk re-meshes within 2 frames, and assert that the Matrix Forge preview shows the expected block count (|det| × n).

## Sources
- [HK1] Henrik Kniberg, *Reinventing Minecraft world generation*, Jfokus (talk): https://www.youtube.com/watch?v=ob3VwY4JyzE · [HK2] Kniberg, *Minecraft terrain generation in a nutshell*: https://www.youtube.com/watch?v=CSa5O6knuwI
- [MCW] *(community)* Minecraft Wiki, World generation (density, noise router, climate parameters, caves, aquifers, stages): https://minecraft.wiki/w/World_generation · [MC-CF] *(community)* Chunk format: https://minecraft.wiki/w/Chunk_format
- [RBG-T] *(community)* Red Blob Games, Making maps with noise: https://www.redblobgames.com/maps/terrain-from-noise/ · [FLOW] *(community)* Red Blob Games, flow-field pathfinding: https://www.redblobgames.com/pathfinding/tower-defense/
- [IQ-WARP] *(community)* Inigo Quilez, Domain warping: https://iquilezles.org/articles/warp/ · [IQ-FBM] fBm: https://iquilezles.org/articles/fbm/ · [IQ-MORE] noise derivatives: https://iquilezles.org/articles/morenoise/ · [IQ-VOR] Voronoi edges: https://iquilezles.org/articles/voronoilines/ · [IQ-MSET] smooth iteration count: https://iquilezles.org/articles/msetsmooth/
- [LAGUE] *(community)* Sebastian Lague, *Coding Adventure: Marching Cubes*: https://www.youtube.com/watch?v=M3iI2l0ltbE
- [LUA] Luanti (Minetest) map generator docs, incl. floatlands: https://docs.luanti.org/for-creators/mapgen/
- [VEL] Veloren book, Worldgen: https://book.veloren.net/internals/worldgen/worldgen.html · erosion and rivers devblog: https://veloren.net/devblog-43 (receiver graph, Planchon–Darboux drainage; reference for a future river pass)
- [0FPS-M] *(community)* Mikola Lysenko, Meshing in a Minecraft game: https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/ · [0FPS-AO] Ambient occlusion for Minecraft-like worlds: https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
- [BGM] *(community)* Binary greedy meshing (C++): https://github.com/cgerikj/binary-greedy-meshing
- [DVE] *(community)* Divine Voxel Engine (multi-threaded TypeScript voxel engine): https://github.com/Divine-Star-Software/DivineVoxelEngine · author write-up: https://dev.to/lucasdamianjohnson/how-i-made-multi-threaded-voxel-engine-in-typescript-1e8f
- [TOMCC] *(community)* T. Checchi, The Advanced Cave Culling Algorithm (Minecraft PE): https://tomcc.github.io/2014/08/31/visibility-1.html · part 2: https://tomcc.github.io/2014/08/31/visibility-2.html
- [THREE-BM] three.js BatchedMesh: https://threejs.org/docs/pages/BatchedMesh.html · three.js manual, Voxel geometry: https://threejs.org/manual/#en/voxel-geometry *(prior)* · [MDN-TR] Transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- [DH] *(community, prior)* Distant Horizons (LOD mod): https://modrinth.com/mod/distanthorizons
- [ES-MATH] *(community)* es-discuss, accuracy of special functions: https://esdiscuss.org/topic/es6-accuracy-of-special-functions · cross-engine divergence report: https://codeberg.org/perplexdotgg/bounce/issues/8
- [WFC] M. Gumin, WaveFunctionCollapse: https://github.com/mxgmn/WaveFunctionCollapse · [BUCK] *(community, prior)* J. Buck, Maze algorithms recap: https://weblog.jamisbuck.org/2011/2/7/maze-generation-algorithm-recap
- [CGA] *(prior)* Müller, Wonka, Haegler, Ulmer, Van Gool, *Procedural Modeling of Buildings*, SIGGRAPH 2006: https://doi.org/10.1145/1141911.1141931 · [ABOP] see `SPELLS_ECOLOGY.md` · [BRID] *(prior)* Bridson, *Fast Poisson Disk Sampling in Arbitrary Dimensions*, SIGGRAPH 2007 sketch: https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf
- [NOITA] P. Purho, *Exploring the Tech and Design of Noita*, GDC 2019: https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design
- [DBM] Niemeyer, Pietronero, Wiesmann, *Fractal Dimension of Dielectric Breakdown*, PRL 52, 1033 (1984): https://doi.org/10.1103/PhysRevLett.52.1033 · [IEC] *(vendor)* rolling sphere method (IEC 62305 radii): https://www.obo.global/industry-solutions/photovoltaic-systems/rolling-sphere-method/ · Faraday cage: https://en.wikipedia.org/wiki/Faraday_cage · [FULG] https://en.wikipedia.org/wiki/Fulgurite
- [LANG] Langton's ant: https://en.wikipedia.org/wiki/Langton%27s_ant · Boon, *How fast does Langton's ant move?*: https://arxiv.org/abs/cond-mat/0004331 · [PERC] Percolation threshold: https://en.wikipedia.org/wiki/Percolation_threshold · [R30] Rule 30: https://en.wikipedia.org/wiki/Rule_30 · Rule 90: https://en.wikipedia.org/wiki/Rule_90
- [ARTIC] Biconnected components / articulation points: https://en.wikipedia.org/wiki/Biconnected_component · [NODAL] Nodal analysis: https://en.wikipedia.org/wiki/Nodal_analysis · [GYR] Gyroid: https://en.wikipedia.org/wiki/Gyroid · [GALTON] Galton board: https://en.wikipedia.org/wiki/Galton_board · [BRACH] Brachistochrone: https://en.wikipedia.org/wiki/Brachistochrone_curve · [3B1B-LA] *(community, educational)* 3Blue1Brown, The determinant: https://www.3blue1brown.com/lessons/determinant
- Fetched or searched this session: HK1/HK2 titles, MCW World generation, RBG-T, IQ-WARP, 0FPS-M, 0FPS-AO, BGM, DVE, TOMCC, THREE-BM, LUA, VEL, WFC, NOITA, DBM, IEC, LANG, ES-MATH. All others are *(prior)*, or are general reference pages.
