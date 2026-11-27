# Co-op puzzle dungeon for 3–4 players: "The Lemma Vaults" (research + design, 26/11/2026)

Scope: a co-op **puzzle** dungeon for 3–4 players (with 2-player and solo-with-companion fallbacks) for Math World (three.js / R3F, anime cel-shaded, mobile-first). Every chamber is built on a real idea from maths, physics or CS. Players should learn the idea by playing, never by doing textbook exercises.
This is research and design only; no code was changed. It builds on `WORLD_DESIGN.md` (pillars: guess-then-see, the law is the mechanic, reward with surprise), `RESEARCH.md` §5 (social rules and safety for under-18s), `COMBAT_VFX_RESEARCH.md` §3.1 (hunt protocol), `SPELLS_ECOLOGY.md` (Field Notes, loud failure) and `PLAN.md` (work queue).
*(community)* marks fan wikis, blogs, YouTube-channel transcripts and personal sites. *(prior)* marks background knowledge that was not re-fetched in this session.

---

## 0. TL;DR

- **Name: The Lemma Vaults** (vi: *Hầm Bổ đề*). A lemma is a small theorem that a bigger proof stands on. Each chamber restores one lemma, and the finale puts them back together into a shattered Theorem. "Labyrinth of Theorems" collides with two names we already use: the Siren arena is the "Labyrinth of Harmonics", and the planned continent is the "Algorithm Labyrinth". The lore line is: *a proof needs more than one mind* (proofs are checked by other people), so **the vaults only open to many hands**.
- **Run shape (~15–20 min, which matches the session length in `RESEARCH.md`)**: Threshold (tutorial, 90 s) → **3 chambers** from a pool of 9, one per wing, rotated weekly → **Theorem Engine** finale (combines the 3 chambers' mechanics) → rewards through a signed receipt. The realtime server never grants rewards.
- **MVP (one complete run):** Threshold + **I. Bridges of Königsberg** (Euler, graph theory) + **II. Archimedes' Balance** (Noether, torque and conservation) + **V. The Fourier Choir** (Ada, harmonic synthesis with a Conductor who sees the spectrum) + a reduced finale. These three use three different verbs: walk a path, be a weight and plunge, turn a dial with split information.
- **Rules that come from the research** (§2): (1) one player must not be able to solve a chamber alone (Valve's rule for Portal 2). (2) Split **information or control** between players, never understanding, which defeats quarterbacking. (3) Keep inputs simple and deliberate, so failure comes from the idea or the teamwork and not from dexterity (KTANE). (4) Players communicate with **pings, quick-chat and a shared countdown**, with no voice and no free text (Portal 2's "here" problem, Apex pings, Sky, `RESEARCH.md` §5.4). (5) There is no timer on thinking: plan first, then execute in sync (Portal 2 co-op). (6) **Scale the puzzle itself with N**, not only HP. The best case is when the theorem itself says how many players are needed (Königsberg: N walkers ⇔ 2N odd islands; Garden: N colours ⇔ chromatic number N). (7) Hints are automatic and stage-aware, but the team chooses when to hear them, and they escalate over 3 levels. A puzzle that needs a hint ≥ 50 % of the time gets redesigned.
- **Companions:** the Echoes (Euler/Noether/Turing/Ada) fill empty seats. They obey **the same pings humans use** (like the radial-menu space pet in Lovers in a Dangerous Spacetime). They never know the solution, so a solo player still has to solve and direct.
- **Network:** add **party rooms** of at most 4 (code-joined, separate from the 40-player realm rooms) with **seats keyed by user id**, not by socket id. Puzzle state is server-authoritative and written as pure TS modules (the same pattern as `lib/world/boss.ts` → `realtime/boss.mjs`). Occupancy is computed from the positions the server already receives at 10 Hz. Actions are small validated claims. **Prerequisite bug:** `net.ts` reconnects with the original 10-minute token, so any reconnect after 10 minutes fails auth forever (§10.7).
- **Effort:** comms kit + vault framework ≈ 8–10 days; MVP chambers ≈ 3–4 days each; finale-lite + rewards ≈ 2–3 days; playtest and tuning ≈ 3 days. **MVP ≈ 25–30 ideal dev-days.**

---

## 1. What we already have (verified in code) and the gaps

| Area | Verified fact | Consequence for the dungeon |
|---|---|---|
| Realtime server (`realtime/server.mjs`) | Rooms are `realm#channel`, up to 40 per room (`pickRoom`). `REALMS` = hub/valley/expanse/impossible/siren. `ws.id` is a fresh random id **per connection**, and `ws.user.uid` is the stable user id. A 10 Hz `snap` carries `[id,x,y,z,yaw,pose,emote,expr,name,avatar]` plus `b` (boss) when present. Token-bucket rate limits exist (`hitBudget`, `editBudget`). Position sanity check: \|x\|,\|z\| ≤ 1e5, \|y\| ≤ 500. | We need a new **party room** type of at most 4 players, joined by code, with **seats keyed by uid** so a reconnect gets its seat back. Positions are already on the server, so **plate occupancy can be computed server-side** with no new client messages. The `b` piggyback pattern extends naturally to a `v` (vault) field. |
| Boss authority pattern | `lib/world/boss.ts` is pure and tested (`tests/world/boss.test.ts`). `realtime/boss.mjs` carries an "auto-generated, don't hand-edit" header, but **no generator script exists in `scripts/`**. Solo play simulates the boss locally (`Siren.tsx`: `netBoss.data && netStatus()==="online"`, otherwise the local sim runs). | Reuse the pattern: `lib/world/vault/*.ts` pure → generated `realtime/vault/*.mjs`. **Add the generator script plus a sync test** (hash or diff) before writing more mirrored logic. Solo play uses the same modules locally. |
| Client net (`components/world/net.ts`) | Reconnects with backoff 1→30 s and **reuses `cfg.token`**. The token comes once from `rawApi.realtime()` (`WorldClient.tsx`), and its TTL is **10 min** (`lib/world/rt-token.ts`). The server closes with 4001 on auth failure. | **Bug:** after 10 minutes, every reconnect fails auth forever. A dungeon run is 15–20 minutes, so token refresh on reconnect is a hard prerequisite (§10.7). |
| Player motion (`scene/Hub.tsx` `Player`, `combat/combat.ts`) | Walk 4 m/s, run 7 m/s, glide 7.5 m/s. Jump `vy = 7.4`, gravity 22 (40 while plunging). Glide opens with a mid-air jump when ≥ 0.9 m above ground, falls ≤ 1.8 m/s, and updrafts lift it (`updrafts[]`). Dash is 22 m/s for 240 ms. Plunge impact: `plungeImpact(at, fall)` deals damage and radius ∝ fall height. Collision goes through `blocked(x,z,y)`, height through `ground(x,z,y)`, plus `clampR`. | Glide and updrafts make **choosing a start position from an overlook** natural (Königsberg). Plunge gives **fall height ⇒ impulse** for free (Balance catapult). `ground()` can follow a tilting beam if it reads the server's beam angle. |
| Weapons and spells | Parabola Bow: arrows fly a real ballistic arc (`GRAVITY = 9.8`) and aimed shots compensate for gravity. Archimedes Lever: damage ∝ arm length. Snell Prism. Drawn sigils (`lib/world/sigil.ts`): circle, zigzag, spiral, parabola, sine, scored by fit precision. | A **manual "puzzle bow"** mode can reuse the projectile code (Galileo's Gallery). The sigils can serve as keys in the finale. |
| Impossible Halls (`scene/Impossible.tsx`) | `StencilPortal` (stencil mask + depth reset, one pass). The bigger-on-the-inside Booth swaps `SPACE` when the player crosses the door. The Loop Corridor wraps with `p.z += period`. | The **Cartographer's Booth** chamber (asymmetric information) reuses the Booth and the portal almost unchanged. |
| Audio (`lib/world/sfx.ts`) | All sound is WebAudio synthesis, with no files. | The Fourier Choir can play the **real sum of harmonics** through `createPeriodicWave(real, imag)`, so players *hear* how close they are. |
| UI | The `nearby` interaction system (`kind: portal/museum/creature/…`), the emote overlay and the SVG `MiniGraph` exist. **There is no ping system and no quick-chat.** | The comms kit (§4) is new work, and it also helps the Siren hunt. |
| Story (`lib/world/story.ts`) | NPCs `euler`, `noether`, `turing`, `ada` have portraits. Objective types are `talk/kill/cast/enter/collect`. Chapter I ends with Noether foreshadowing the Siren. | Add a `vault` objective type and use the Echoes as chamber guides (§7.2). |

---

## 2. Research: what makes co-op puzzles great

### 2.1 Game by game

**Portal 2 co-op (Valve).**
- **The rule:** "if you have a co-op puzzle that one person can do on his own, it doesn't pass muster as a co-op." The designers said it took them a while to get their heads around this [P2-GD][P2-PCG].
- **The "here" problem:** early playtesters spent "five minutes trying to explain" to their partner where "here" was. Valve solved it with environment tagging: glyph pings for basic actions [P2-GD]. Reporters describe the ping as highlighting a button to press or a spot for a portal, alongside timers and joint gestures [P2-GS] *(community wiki coverage agrees)*.
- **Pacing:** Valve found that players enjoy making a plan and executing it, and **avoided timed puzzles in co-op**. They also found that mistakes can be more fun than getting it right straight away [P2-PCG search summary].
- **Takeaways for us:** (a) every chamber needs a "can't be soloed" proof; (b) pointing beats describing; (c) no clock on thinking, and timing only in a deliberate "execute together" moment.

**Keep Talking and Nobody Explodes (Steel Crate).**
- **The fun lives "between players".** Information is split: the defuser sees the bomb, and the experts hold the manual ("It starts with balance") [KTANE-GD][KTANE-GDC].
- **"The rules have to be totally unambiguous."** Capital O was removed from serial numbers because it read as zero. "The second wire" was ambiguous, and players never reported it; designers had to watch for it.
- **Failure should feel like a teamwork failure, not an execution failure,** hence "simple and deliberate inputs".
- **Hidden pacing:** the game adds events when players are doing well, so close finishes happen without "accelerating a death spiral".
- **Takeaways for us:** split information and control *symmetrically* so each side has something to trade. Keep labels unambiguous; this applies to our **party codes and glyphs** too (no O/0, I/1). Keep inputs dexterity-free.

**It Takes Two / Split Fiction (Hazelight).**
- **Asymmetry is mandatory, and each player's ability must enable the other's.** In the *Tree* level, the sap gun and the match gun only work together. "Finding two mechanics is easy. Making them equally fun is harder" [HZ-80].
- When one role was "a bit unengaged", they **re-tuned the world**: enemies now target the match player.
- Partners run ahead and strand each other, so build puzzles that need both players and prevent backtracking.
- Co-op players often *don't* talk, so design must prompt communication and environment-reading.
- Playtest question: are players "subconsciously solving puzzles without knowing what they did for one another?" [HZ-80].
- Per Stenbeck: keep both players making "valuable decisions" and create moments to "help each other through tricky situations" [HZ-PS] *(community)*.
- A GDC session on Split Fiction's final level describes finding "the ingredients to make satisfying co-op puzzles" [HZ-GDC]. Only the abstract was available.

**The Witness (Jonathan Blow).** "The clearer and simpler the puzzle is, the more beautiful and strong that feeling of epiphany can be." The world is deliberately low-noise: nothing gets a spotlight unless the designer intends it, and puzzles mirror real phenomena "but simpler" [TW-GD]. A good puzzle starts from a situation, and the designer asks what is *true* about it [TW-IC]. **Takeaway:** each chamber is one truth, staged in a clean space with no decorative noise competing for attention.

**Baba Is You (Arvi Teikari).** He designs levels by **starting from the intended solution and working backwards, adding restrictions**. He cut levels whose setup needed too many supporting rules, because those levels broke in unintended ways. A sole designer becomes blind to difficulty [BABA-RB][BABA-GDC]. **Takeaway:** author each stage from its "aha" backwards, keep the rule set minimal, and test with fresh players.

**Lovers in a Dangerous Spacetime (Asteroid Base).** Locking power-ups to one player's colour confused people, so they let players "gravitate to the roles they want to play". The **solo AI pet, driven through a radial menu, became the test of whether the co-op rules made sense**. If an expert can command a partner clearly, newcomers survive too [LOV-GD]. **Takeaway:** the companion Echoes use the same ping language as humans, so solo mode teaches co-op communication.

**Overcooked (Ghost Town Games).** Kitchens are built to force talk. Players fall into routines and stop communicating, so the game **breaks routines** with wait timers and kitchens that change mid-level. Asymmetric co-op forces communication and lets mixed-skill groups play together, but a fixed split of roles becomes predictable [OC-GMTK] *(community)*. A developer said changing levels stop players repeating the same task [OC-PLAY]. **Takeaway:** each chamber's stage 2 **changes the situation**: roles rotate and the rule twists.

**Sky: Children of the Light (thatgamecompany).** Social play is "any activity performed near other players, which encourages simulating the thoughts and feelings of others". Hand-holding lets one player guide another. Strict linear goals discouraged interaction, so they moved to a tree of paths and secrets. Friction and downtime create mingling. Rituals and gifting deepen bonds [SKY-GD]. Communication starts wordless (emotes, actions, gifts) [SKY-search]. **Takeaway:** give rest moments between chambers (a short safe "breathing room" with emotes) and a **lead-by-hand** helper for lost players.

**Apex Legends ping (Respawn).** Respawn playtested for a month with **mics muted and random names**. One button pings, the call is context-sensitive with a voice line, and a wheel gives specific pings [APEX-GD]. It removes the need for a microphone and was designed to reduce toxicity [APEX-GR]. **Takeaway:** our dungeon must be fully solvable with pings, and we playtest it with mics muted.

**Genshin Impact co-op.** Enemy HP scales 100 %, 150 %, 200 %, 250 % from 1 to 4 players, and ATK scales 100–140 %. Story quests pause in co-op [GI-WIKI] *(community)*. Critics call the co-op "too restrictive to really be of much use" [GI-PCG]. **Takeaway:** scaling numbers alone doesn't make co-op. Genshin domains are combat rooms with no interdependence. We scale the **structure** of the puzzle.

**Pico Park.** It supports 2–8 players and every level requires cooperation; according to the Nintendo listing, levels **adjust to the player count** [PICO]. **Takeaway:** parameterise every stage by N.

**Magic Maze (Kasper Lapp).** Any player may move any pawn, but **only in the directions on their own action tile**. Play is mostly **silent**; a "Do Something!" pawn is a non-verbal nudge; tiles rotate when the timer flips [MM] (search summary; the rulebook was not opened). **Takeaway:** split *agency* (each player owns one verb or parameter) and provide a **non-verbal nudge** (our `act` ping).

**Spaceteam (Henry Smith).** Each phone shows commands that only *another* player can carry out. Shouting emerged and was not designed [ST-GD]. **Takeaway:** phones are fine for asymmetric panels, but we do *not* want shouting chaos for 13–18-year-olds in shared classrooms. Keep the asymmetry and drop the time pressure.

**We Were Here (Total Mayhem Games).** They prototyped with people **locked in separate rooms with walkie-talkies**. Their test: "every puzzle should be related in some way to communication". If it doesn't get players "talking, whispering, laughing or yelling", it's cut. Getting stuck should mean "they're not cooperating or communicating well", not that the puzzle is unclear. Puzzles should interest veterans and newcomers alike [WWH-XB][WWH-GD]. **Takeaway:** paper-prototype every chamber with two people who can't see each other's screens.

**Super Mario Galaxy "Co-Star" (Nintendo).** Player 2 holds a pointer and helps with almost no risk; it was designed around a parent helping a child [MG-IWATA]. Support roles work when they "take time but less skill and benefit the main mission"; different points of view (map tagging) suit helpers [COOP-AGE] *(community)*. Critics found it shallow when the helper's choices don't matter. **Takeaway:** every chamber has a **low-dexterity, high-meaning** role, such as the Conductor or the spotter. Low execution must still mean real decisions.

**The quarterback problem (co-op board games).** Matt Leacock (Pandemic) lists **hidden information** first among his fixes. The more information each player lacks, the harder it is to quarterback [QB-MM][QB-JG] *(community)*. **Takeaway:** keep some information local (fog radius, private dials, a spectrum only one player sees), so no single player can solve the room for everyone else.

**Escape-room design.**
- Puzzles should be fair, fully clued, single-answer and **self-validating**. There are **no destroyable states**, feedback is clear, rules are consistent, a puzzle takes ≤ 5 min for someone who knows it, and "your puzzles will be too hard, so beta test" [ER-12] *(community)*.
- Hints: let teams control the timing, never repeat what they know, and avoid hints arriving just as they solve. **If a team needs the same hint half the time or more, the puzzle needs refinement.** Automated hints need machine-readable checkpoints [ER-HINT] *(community)*.
- Nicholson calls a player's moment of unique contribution a **"hero moment"** and considers it essential. Ask "why would a player do this?" [ER-NIC search summary]. Avoid strictly linear flows [ER-CTU].
- **Red herrings:** the sources here don't resolve this. The fairness rules above argue against them. Our stance (§3, P12): no red herrings; use **misconception bait** instead, meaning a tempting wrong hypothesis that the world visibly disproves.

**Puzzle dependency charts (Ron Gilbert).** Flowcharts help you *solve* a game; dependency charts help you *design* one. Maniac Mansion's dead ends and bottlenecks came from not having one [PDC]. **Takeaway:** §7.4 charts the run.

**Learning science.** Productive failure (problem solving *before* instruction) beat instruction-first in a meta-analysis of 53 studies: g = 0.36, and 0.87 after publication-bias correction, with effects larger when fidelity was higher [PF]. This supports our "formula after the experience" rule (`WORLD_DESIGN.md` pillar 1, the Field Notes in `SPELLS_ECOLOGY.md`). Jigsaw-style group work needs mastery gates (`RESEARCH.md` §5.2).

### 2.2 Synthesis: 14 principles we commit to

| # | Principle | From | How we check it |
|---|---|---|---|
| P1 | **Interdependence by construction**: every stage needs ≥ N distinct simultaneous or complementary contributions | Portal 2 | Ask "can one human finish this stage with infinite time?" in co-op mode, and the answer must be no. Solo mode replaces humans with companions that the player must direct. |
| P2 | **Split control or information, not understanding**: everyone sees the *outcome*, nobody sees *everything* | KTANE, Magic Maze, Leacock | Each chamber has an "info/agency split" row (§8). |
| P3 | **Simple, deliberate inputs**: stand, hold, turn a detented dial, ring, plunge | KTANE | No input needs < 200 ms precision except inside an explicit countdown window ≥ 250 ms. |
| P4 | **Unambiguous, self-validating, immediate feedback** | KTANE, escape rooms | Live readouts (tilt, error %, lit bridges). Success is visible *before* the door opens. |
| P5 | **No destroyable states**: personal rewind plus a majority team reset | Escape rooms | Every stage can always be reset to its start in ≤ 3 s. |
| P6 | **Point, don't describe**: pings, value pings, countdown | Portal 2, Apex | The whole dungeon passes a mute-mic playtest. |
| P7 | **Plan, then execute**: no clock on thinking, sync windows only on demand | Portal 2 | No global timers. Countdowns are player-started. |
| P8 | **Scale structure with N** | Pico Park vs Genshin | Each stage has an N-table: 2/3/4 and solo. N is locked at stage start. |
| P9 | **Every role has a hero moment and a valuable decision** | Nicholson, Hazelight, Co-Star | No player idles more than 30 s in any stage (telemetry). |
| P10 | **Break routines**: stage 2 twists the rule and rotates roles | Overcooked | Roles rotate every stage. |
| P11 | **Experience first, name later** | Productive failure, Witness | The formula or Codex page appears only after the aha. |
| P12 | **Misconception bait, no red herrings** | Escape rooms, our misconception codes | Each stage names one bait (§8). |
| P13 | **Hints: automatic, timed by the team, 3 levels, never repeating known info** | Escape-room hint practice | Hint rate ≥ 50 % on a stage means redesign. |
| P14 | **Author backwards from the aha; test with fresh, muted players** | Baba Is You, Apex, We Were Here | A paper prototype exists before code, and a two-room walkie test before polish. |

---

## 3. Pillars for the Lemma Vaults

1. **The theorem decides the team.** Wherever possible, *the mathematics itself says why exactly N players are needed*. Königsberg needs N walkers for 2N odd islands, the Garden needs N colours for chromatic number N, and the Foundry needs N bits for N inputs. When players realise "that's why there are four of us", the realisation is itself the lesson.
2. **Bodies are variables.** Your position is a weight, a colour, a bit or a mirror. Mobile players need no complex UI: walking *is* the input. Dials appear only when a stage truly needs a continuous parameter.
3. **Guess, commit, then the world runs the real law.** We keep our existing pillar. Every success and failure is a real simulation (torque, Euler trails, Fourier sums, ray optics), never a scripted check.
4. **Failure is funny and cheap.** Bridges fold into paper cut-outs, beams tip players into soft hay, wrong transforms make the ingot do a silly dance. Personal rewind takes 1 s. Nobody's mistake is shown by name (`RESEARCH.md` §5.4).
5. **Quiet minds, loud world.** No voice and no free text. Communication goes through the space itself (where you stand), pings, quick-chat and emotes. The environment is clean in the way The Witness is clean: the only glowing things are the things that matter.

---

## 4. The communication kit (mobile-first, no voice, no free text)

It is designed once and used everywhere: dungeon, Siren hunt and hub.

### 4.1 Ping
- **Gesture:**
  - Touch: **long-press 350 ms without moving more than 8 px** on the 3D view. A drag still moves the camera; the right 60 % of the screen is already the camera-drag zone.
  - Mouse: middle-click, or `Z` while aiming at a point.
  - Release immediately for a **contextual ping**, or slide to open a **radial wheel** (6 slots).
- **Contextual default** (Apex-style), based on what is under the finger:

| Target | Default ping | Wheel alternatives |
|---|---|---|
| Plate / island / notch / slot | **"Stand here"** (marker with the target seat's glyph if dropped on a player's portrait) | "I'll take this" (mine), "Avoid" |
| Station (dial, pipe, mirror, hammer) | **"Use this"** | **value pings**: `+` more · `−` less · `0` zero · `↺`/`↻` rotate |
| Bridge / wire / beam | **"Go this way"** | "Not this one" |
| A player | **"You!"** (nudge, like Magic Maze's "Do Something!") | "Follow me", "Wait" |
| Empty ground | **"Here"** | "Look", "Regroup" |

- **Rendering:** a world marker in the pinger's **seat colour + seat glyph** (● ▲ ■ ◆, colour-blind safe). An edge-of-screen arrow shows when the marker is off-screen. A short spatialised blip plays, and an optional Echo voice line (text bubble) appears.
- **Ack:** tapping a ping you can see answers 👍. The pinger sees a check on their marker.
- **Limits:** each player has ≤ 3 live pings, lasting 4 s, with at most 1 every 0.5 s (token bucket, server-side). The server relays pings to party members only.
- **Companions obey pings:** "Stand here" makes the Echo walk there, "Use this + value" makes the Echo nudge the dial one detent, and "Go this way" makes the Echo walk the bridge (§5.4).

### 4.2 Quick-chat ("Math Talk" phrases, localized en/vi)
There is a HUD button with 2 radial pages of 6 phrases. Phrases are IDs; the server relays the ID, never text.
- Page 1 (coordination): **Ready!** · **On 3!** (starts a countdown, §4.3) · **Wait for me** · **I'll do it** · **Your turn** · **Undo / rewind**
- Page 2 (thinking): **Try the other order** · **Count them!** · **More / Less** · **I think it's balanced** · **Nice!** · **Thanks!**
- Each chamber adds 2 contextual phrases, e.g. Balance: "Move out" and "Move in"; Fourier: "Too loud" and "Flip it". These are pre-written, so they can't carry personal data, which satisfies `RESEARCH.md` §5.4.

### 4.3 Shared countdown ("On 3!")
Any player can start it. The server broadcasts `count {at: serverNow + 3000, by: seat}`, and every client shows the **same** 3-2-1-GO ring above every head, with ticks played on server time (clock offset as in `COMBAT_VFX_RESEARCH.md` §3.1). Only one countdown is active at a time. This is the only sanctioned "timing" tool, used for simultaneous presses, the catapult double plunge and time-on-target. It turns P7 (plan, then execute) into a button.

### 4.4 Emotes, hand-holding and the overlook
- The existing emotes stay, and they are the celebration channel.
- **Lead by hand** (Sky): stand next to a teammate and tap "Lead" on their portrait. They can accept, and then they **follow you automatically** for up to 20 s or until they move the joystick. This helps lost and younger players.
- **Overlook balconies:** every chamber has a high balcony with a top-down view that can't be used to act, so planning has a place. Players glide down to execute.

### 4.5 Station panel (mobile)
When you stand at a station, a compact panel appears in the **bottom-right thumb zone**:
- a **detented dial** (snap points shown; haptic tick when the browser supports `vibrate`),
- or **rotate ◀ ▶** buttons with an optional fine mode,
- or a single big **action** button (ring, brace).

The joystick stays usable, and walking away closes the panel. On desktop, `Q`/`E` or the mouse wheel turn the dial.

---

## 5. Party, scaling, roles, drop-in / drop-out, companions

### 5.1 Party formation
- **Party code:** 4 characters from an unambiguous alphabet (`ACDEFHJKMNPRTUVWXY3479`: no O/0, I/1, S/5, B/8, Z/2 — the KTANE lesson). Friends type it, or tap "Invite" in the hub to show it.
- **Quick join:** it matches only **same class or friends** first, and strangers only if the user opts in. With strangers the game is ping-only, as everywhere in the dungeon (`RESEARCH.md` §5.3–5.4). This needs a `cls` claim in the realtime token (it is not there today; see §10.8).
- **Ready check** at the Threshold: the run starts when all humans are ready. Empty seats are offered to companions with one tap ("Fill with Echoes").

### 5.2 Scaling rules
- **N = humans + companions**, clamped 2–4. A solo player always has ≥ 1 companion; by default solo uses **N = 2** (one companion), and the player can opt into N = 3 for more challenge.
- **N is locked when a stage starts.** If someone joins or leaves mid-stage, the stage keeps its N: a leaver's seat is taken over by a companion, and a joiner waits in the breathing room (spectator view plus pings) until the next stage. Without this lock, stages could become unsolvable.
- Each chamber has an N-table (§8). It changes **the puzzle**: graph, map, stone mass, pipes, mirrors. It never changes only numbers.

### 5.3 Roles and rotation
- Roles are per stage. **They rotate by seat index each stage** (P10), so the Conductor in stage 2 is a piper in stage 3. Players may swap roles freely by walking to another station, because Lovers found that letting players gravitate works. Rotation is a default, not a lock.
- Every chamber lists its roles with their **hero moment** (P9).

### 5.4 Companions ("Echoes")
- **What they are:** an Echo is a translucent, glowing spirit with the Echo's portrait colour (Euler gold, Noether pink, Turing cyan, Ada amber). Echoes are cheap, so no VRM is needed: use a stylised capsule-and-robe mesh with a toon shader and a halo.
- **Brain:** a tiny state machine `idle → goTo(target) → hold → act(value)`. It uses straight-line steering plus chamber nav graphs (bridges, beam lanes). It runs **on the server** in online parties, as part of the vault tick, and locally in solo play.
- **It never solves:** it has no knowledge of the target and only executes pings. A companion's **position counts exactly like a player's** for occupancy and weight.
- **Personality lines** (short, never hints unless asked): "Where shall I stand?", "Turning… a little more?" They give feedback without answers.
- Companions also fill **disconnect grace** (holding a seat 120 s) and **AFK** seats (after 90 s of no input, the seat's companion takes over until the player moves).

### 5.5 Mixed skill and accessibility
- **Low-dexterity, high-meaning roles** exist in every chamber: Conductor, spotter, lantern-holder, overlook planner.
- Falling never fails: you respawn instantly on the last safe tile.
- Dials snap to detents. Brace mode makes mirror aiming easy. There is no fast-reaction requirement outside countdown windows.
- Colour-blind safety: colours are always paired with glyphs. Sounds are always paired with visuals. There is a reduced-motion option (no camera shake).

---

## 6. Hint system (team-timed, automated, 3 levels)

- **Machine-readable checkpoints:** every stage exports `progress(st) → 0..1` and `attempts(st)`. The server tracks `stuckMs` (time since progress last increased) and failed attempts.
- **L1 "Observe" (Echo's question):** auto-*offered*, never auto-played, when `stuckMs > 90 s` or `attempts ≥ 3`. A glowing Echo icon appears and any player taps it to hear the question (e.g. "Count the bridges that touch each island.").
- **L2 "Strategy" and L3 "Partial reveal":** these need a request. Tapping "Ask the Echo" shows everyone a 5 s banner, "Seat ▲ asks for a hint — [Not yet]". If nobody taps *Not yet*, the hint plays. This respects players who want to keep thinking, and it doesn't depend on a single player's patience.
- **Never repeat known info:** if the team's state already shows what the hint says (e.g. they already started from odd islands), the hint text is skipped and the next level is offered.
- **No shame:** hints only affect a cosmetic "Unaided ✦" mark on the team's run card. There is no per-player attribution.
- **Tuning metric:** per stage, record the share of runs reaching L2 and L3. ≥ 50 % at L2 means the stage gets redesigned (escape-room rule of thumb, P13).
- **After the aha** (stage clear), the Echo gives a 1–2 sentence "why", and the **Codex lemma page** unlocks. That page is the first time the formula is shown (P11).

---

## 7. The dungeon

### 7.1 Where it is
There is a new gate in the hub: the **Vault Door**, a round stone door with four keyholes shaped ● ▲ ■ ◆. It only opens when 2+ players (or 1 player plus Echoes) stand on its four sigils, which teaches the core rule in the hub itself. The realm id is `vault`. Each chamber is its **own small scene**, streamed in and disposed when you leave, to respect the iOS memory ceiling and draw-call budget (`TECH.md`).

### 7.2 Lore
*"Before the Shattering, every Theorem rested on lemmas kept in vaults beneath the Plaza. A lemma was proven only when more than one mind checked it — that is what made it true for everyone. When the Theorems broke, the vaults sealed themselves with their own lemmas. They open only to many hands."*

Echo guides by wing:
- **Euler — the Wing of Connections:** Königsberg, Four-Color Garden, Cartographer's Booth.
- **Noether — the Wing of Symmetry:** Archimedes' Balance, Mirror Observatory, Forge of Order.
  - Noether's theorem says symmetry ⇒ conservation. The catapult conserves angular momentum, mirror reflection is a symmetry, and transformations form *groups*, the algebra Noether shaped.
- **Ada and Turing — the Wing of Machines:** Fourier Choir (Ada), Latch Foundry (Turing), Galileo's Gallery.
  - Ada, 1843 *(prior)*: she suggested the Analytical Engine "might compose elaborate and scientific pieces of music", which suits a choir of harmonics.

Chapter II tie-in: each fully restored Theorem gives the **Fourier Siren** a weakness. For example, after the "Theorem of Harmonics" run the Siren's Twin-Node shield window is longer by 0.5 s. The bonus is optional and never required.

### 7.3 Run structure and rotation
```
Hub Vault Door → THRESHOLD (90 s tutorial) → Breathing room
  → Chamber A (Euler wing)    ~5 min → Breathing room (checkpoint)
  → Chamber B (Noether wing)  ~5 min → Breathing room (checkpoint)
  → Chamber C (Machines wing) ~5 min → THEOREM ENGINE finale ~3 min → Rewards
```
- **Weekly rotation:** one chamber per wing (3 × 3 = 27 combinations), with the same set for everyone that week. This builds shared talk ("did you beat the Choir?"), the community effect of the "Vault of the Week". The **MVP ships one fixed combination**: Königsberg + Balance + Fourier.
- **Breathing rooms** (Sky's downtime): a 20 m safe alcove with the Echo, a bench, emotes, a scoreboard-free "Moments" card for the last chamber (§7.6), and the door to the next chamber. The door opens on a ready check. This is also where joiners enter.
- **Difficulty curve:** inside a chamber, **Teach → Twist → Combine** (3 stages). This is the 4-beat kishōtenketsu structure often described for Nintendo level design, compressed to three beats *(prior)*. Across the run, chamber A is the most concrete (walk, stand) and chamber C the most abstract (spectrum, order). The finale needs no new idea.

### 7.4 Puzzle dependency chart (MVP run)
```
                     ┌─ each seat: personal mini-graph (parallel) ─┐
THRESHOLD ──► KÖNIGSBERG S1 ───────────────────────────────────────┘──► S2 Königsberg/Kaliningrad (pairs in parallel)
                                                                        └──► S3 Grand graph (all N walkers) ──► Lemma I
Lemma I ──► BALANCE S1 Level the scale ──► S2 Cross together (stone pusher + walkers)
                                       └──► S3 Catapult (plungers + launched) ──► Lemma II
Lemma II ──► FOURIER S1 Tune (all pipes) ──► S2 Odd ones (square, Gibbs)
                                         └──► S3 Conductor (spectrum ↔ pipers) ──► Lemma III
Lemma I+II+III ──► THEOREM ENGINE (3 coupled conditions held 3 s) ──► Theorem restored
```
There are no dead ends: every stage can be reset, and no item can be lost. Parallelism happens inside stages: S1s are personal or paired so nobody waits, which follows the "avoid strict linearity" advice.

### 7.5 Checkpoints and persistence
- A checkpoint is saved at every stage clear. Party runs live in server memory with `run.lastActive`. If every human disconnects, the run is kept for **30 min** and the party code rejoins it. Optionally, append stage clears to `data/vault-runs.jsonl` (the same pattern as voxel edits) so a server restart can restore checkpoints.
- Solo runs checkpoint in localStorage.

### 7.6 Rewards (respecting the coin rule)
- **Real coins: none.** Per `RESEARCH.md` §6 and the teacher's rule, real coins only come from the 3 approved actions.
- **Per chamber, first clear per week:**
  - its **Codex lemma page** + **Field Note "Understood" stamp** (the system in `SPELLS_ECOLOGY.md`);
  - materials from the existing `MatId`s: Königsberg → `prime`, Balance → `golden`, Fourier → `pi`, Garden → `fractal`, Mirror → `mobius`, …;
  - one cosmetic from that chamber: thread colour, mirror skin, pipe glow, ingot rune.
- **Run clear:** a **Theorem Fragment** (a collectible; 3 fragments restore a Theorem in the Plaza museum, which visibly changes the hub) + the optional Siren weakness.
- **Team-equal:** everyone gets the same rewards whatever their role or hint use. There is no MVP-of-the-match screen.
- **"Moments" card:** one positive line per player, auto-picked from events, e.g. "▲ closed the last bridge", "■ held the Conductor's baton for the square wave". It names hero moments only, never errors.
- **Delivery:** the realtime server emits a **signed receipt**, and a web server action verifies it (§10.9).

---

## 8. The chambers

Each chamber is written from its aha backwards (P14). Format: **Idea · Fantasy · Layout · Rules · Stages · N-table and roles · Info/agency split · Sync & server state · Failure & feedback · Aha · Misconception bait · Hint ladder · Difficulty · VFX/SFX · Build · Effort.**

> Chamber index (★ = MVP)
> I ★ Bridges of Königsberg (Euler) · II ★ Archimedes' Balance (Noether) · III Four-Color Garden (Euler) · IV Latch Foundry (Turing) · V ★ Fourier Choir (Ada) · VI Mirror Observatory (Noether) · VII Forge of Order (Noether) · VIII Galileo's Gallery (Machines/Ada) · IX Cartographer's Booth (Euler)

### 8.0 The Threshold (tutorial, all runs)
- **Layout:** a round antechamber 16 m across. N glowing seat sigils are on the floor, there are two far-apart bell-ropes, and a **hidden plate** is visible only to seat ● ("lantern-bearer").
- **Beats:**
  1. Everyone stands on a sigil → door 1 opens. This teaches "everyone matters".
  2. Two bell-ropes 14 m apart must be pulled within 0.4 s of each other. The prompt suggests "On 3!", which teaches the countdown.
  3. The hidden plate: only the lantern-bearer sees it, so they **ping** it → someone else stands on it. This teaches pings and asymmetric info.
- **Effort:** 1 day on top of the framework.

---

### 8.1 ★ Chamber I: The Bridges of Königsberg (Euler)

**Idea.** Euler (1736) *(prior)*: you can walk every bridge exactly once in one walk iff at most two land masses touch an odd number of bridges, and the walk must start and end on those odd ones. The co-op generalisation is a classic theorem: **a connected graph with 2k odd vertices can be covered by k edge-disjoint trails, and no fewer.** So the number of odd islands tells you **how many walkers you need and where each must start**.

**Fantasy.** A night city of floating islands over a sea of fog ("unproven space"). Each player carries an **Ariadne thread** that lights every bridge it crosses. A lit bridge is *spent* and can't be crossed again.

**Layout.**
- An **Overlook** balcony 10 m above with a top-down view.
- Islands are 6–10 m wide toon discs with Quaternius-style houses (procedural). Bridges are 5–8 m arched planks; crossing bridges arc at different heights so they never visually merge.
- Each island has an **updraft** back to the Overlook (the existing `Updrafts` prop).

**Rules.**
1. You **glide down from the Overlook** onto any island. The first island you land on is your **thread start**.
2. Crossing a bridge end to end lights it in your seat colour and glyph and appends it to your trail. Turning back mid-bridge does nothing.
3. A lit bridge has a soft barrier for everyone. Walking into it shows "spent".
4. **Stuck:** if your island has no unlit bridges, your thread knots. You can **rewind** (hold 1 s): your bridges go dark and you return to the Overlook.
5. The stage clears when **all bridges are lit**.
6. **Team reset:** a majority holds the reset bell on the Overlook for 1.5 s.

**Stages.**

| Stage | Graph | Purpose |
|---|---|---|
| S1 Teach: "Your own little town" (parallel) | Each seat gets a private 4-island, 5-bridge graph with **2 odd islands**. | Everyone learns alone and in parallel that the start matters. Most first tries fail when they start on an even island. |
| S2 Twist: "Two cities" | **N = 4:** two copies of **Königsberg 1736** (4 islands, 7 bridges, degrees 5/3/3/3), one per pair. **N = 3:** Königsberg (2 walkers) + "**Kaliningrad today**" *(prior: after WWII losses and replacements an Euler walk became possible, with 2 odd islands)* for 1 walker. **N = 2:** Königsberg with both walkers. | The famous impossibility for 1 walker, and the reveal that **2 walkers can do it**, starting on odd islands. |
| S3 Combine: "The Grand Graph" | A graph with **exactly 2N odd islands**. **N = 4:** an 8-island ring + a hub island joined to all 8 → ring islands have degree 3 (odd), hub degree 8 (even) → 4 trails. **N = 3:** a 6-island ring + 3 long "chord" bridges i↔i+3 (the K₃,₃ "utility graph"; chords arch at 3 heights) → 6 odd → 3 trails. **N = 2:** a 4-odd graph different from S2. | Everyone must walk, everyone must start on an odd island, and the bridges must be **partitioned** between walkers. Planning on the Overlook pays off. |

**N-table and roles.** Everyone is a walker. Roles differ by start island and by the share of bridges taken.
- Solo: you + 1 Echo (N = 2). You command the Echo with "Go this way" pings on bridges, a direct test of planning.
- Hero moment: whoever lights the last bridge, but every trail is necessary by the theorem, and the Moments card says so ("all 4 threads were needed — Euler's count").

**Info/agency split.** Agency is split: you can only extend *your* thread. Information is mostly shared from the Overlook. On islands, fog limits view to about 12 m, so walkers report with pings.

**Sync & server state.**
- **Occupancy:** island membership comes from `ws.state` positions (point-in-circle or polygon). Bridge zones are capsules.
- **Crossing detection:** `onBridge(e, from u)` → arrives at `v` ⇒ crossing. At 7 m/s × 0.1 s = 0.7 m per tick, and bridges are ≥ 5 m, so 10 Hz is enough.
- **State:**
```json
{ "g": "grand4", "lit": [[0, 2], [5, 1]], "trail": { "0": { "start": 3, "at": 4, "edges": [0, 7] } },
  "stuck": [2], "clear": false }
```
- **Messages:** none new for walking (positions suffice). `act {k:"rewind"}`, `act {k:"reset", hold:true|false}`.

**Failure & feedback.**
- A spent bridge shimmers with a paper-fold animation and a soft "clunk".
- When you're stuck, your thread **ties a glowing knot** at your feet and the Echo says "No unspent bridges from here."
- A rewind plays the thread re-winding backwards, which is funny and quick.

**Aha.** "We start on the odd islands — and that's why there are four of us." On S3 clear, the Echo reveals the count: "8 odd islands → 8 / 2 = 4 threads. Not one fewer."

**Misconception bait.** *"More walkers is always easier."* In S2, the pair whose second walker starts on an even island gets stuck and learns that the start matters, not the head-count.

**Hint ladder.**
- L1: "Count the bridges touching each island."
- L2: "A thread passing *through* an island uses two bridges there. Where must threads begin or end?"
- L3: odd islands glow, and for S3 one start marker per seat appears.

**Difficulty.** S1 ★ · S2 ★★ · S3 ★★★. A first-time team takes about 5–6 min.

**VFX/SFX.**
- Threads are ribbon trails (the planned V1 trail ribbon) and stay visible on lit bridges.
- Crossing plays a pentatonic note per seat, and a completed partition plays a chord.
- Spent bridges fold into paper cut-outs (the C3 paper look from the Siren arena).
- The fog plane is a scrolling-noise toon shader.

**Build.**
- **Scene:** `components/world/vault/chambers/Konigsberg.tsx`.
  - Islands and bridges are built from a `GraphDef {islands:[{x,z,r}], bridges:[{a,b,ctrl,height}]}`. Bridges are an `InstancedMesh` of plank segments along a quadratic Bézier.
  - `ground(x,z,y)` = island height inside an island, the bridge curve height inside a bridge capsule, otherwise fall → respawn on the last island.
  - `blocked` = spent-bridge entry caps.
- **Pure logic:** `lib/world/vault/konigsberg.ts`: `graphs(N)`, `oddVertices`, `minTrails = max(1, odd/2)`, `step(st, positions)` → crossings, `isStuck`, `clear`. Tests cover the Königsberg degrees, `minTrails` on all S3 graphs = N, crossing detection with jittery samples, and rewinds.
- **State machine:** `intro → plan (Overlook) → play → (stuck…) → clear → reveal`.

**Effort.** 3.5 days (logic + tests 1, scene 1.5, VFX and polish 1).

---

### 8.2 ★ Chamber II: Archimedes' Balance (Noether)

**Idea.**
- **Torque** τ = m·g·d, and **equilibrium** Σ mᵢdᵢ = 0: a small weight far out balances a big one close in.
- **Centre of mass:** a level beam means the system's centre of mass sits over the pivot.
- **Angular momentum is conserved** in the catapult collision. This is Noether's theorem: rotational symmetry ⇒ conserved angular momentum. The consequence is **you can't get more height out than you put in**, and the arm ratio sets the trade-off.

**Fantasy.** A gold-and-stone weighing hall. A giant scale-bridge spans a chasm to the exit, and a seesaw catapult sits under a tall updraft tower.

**Layout.**
- **Scale-bridge:** a 16 m beam on a central fulcrum, with numbered **notches** at 1–7 m on each side (glowing discs). The heavy **Lemma Stone** sits on a rail on the right side.
- **Catapult:** a 6 m beam with **3 fulcrum sockets**, an updraft tower 10 m tall beside the short end, and switch ledges at 4.5 m and 9 m.

**Rules (physics, honest and readable).**
- Every player and companion has mass 1 (shown as "1" above the head while in the hall). The stone has mass M.
- **Tilt is proportional to net torque, like a real balance whose centre of mass sits below the pivot:** θ_eq = atan(Στ / K), and the beam eases to θ_eq with a critically damped spring (≈ 0.6 s). It is **level when |Στ| < 0.5**.
- Players on a tilted beam slide downhill when |θ| > 6° (a soft slide, never a death).
- The catapult models a **perfectly inelastic collision about the pivot.** Point masses sit on a light beam, and the launched player has mass m₂ at arm d₂. Plungers of total mass m₁ land at speed v₁ at arm d₁:

  `v₂ = m₁·v₁·d₁·d₂ / (m₁·d₁² + m₂·d₂²)`  (angular momentum before = after)

  - One plunger at d₁ = d₂ gives v₂ = v₁/2, so the launch height is ≈ ¼ of the fall height under equal gravity. The game uses plunge gravity 40 and normal gravity 22: from a 10 m plunge, v₁² = 800 → v₂² = 200 → **h₂ ≈ 4.5 m**.
  - Two plungers landing together (m₁ = 2) at the best ratio d₂/d₁ = √2 give v₂ ≈ 0.707·v₁ → **h₂ ≈ 9 m**.
  - "Together" means both impacts within **250 ms**. A second impact after the launch is wasted.
  - Use the *same* g in every on-screen energy readout, and document the game constants.

**Stages.**

| Stage | Setup | Purpose |
|---|---|---|
| S1 Teach: "Level the scale" | The stone is fixed at the right. Its torque M·D is chosen so **all N are needed**: 7(N−1) < M·D ≤ 7N. Examples: N = 4: M = 5 at 5 m (τ = 25, e.g. notches 7, 6, 6, 6). N = 3: M = 3 at 6 m (18). N = 2: M = 2 at 6 m (12). Stand on notches; level for 2 s → the gate *latches* open. | Moment balance. A small weight far out equals a big one near. |
| S2 Twist: "Cross together" | The exit is past the **right** end. Everyone must end on the right ledge while the beam stays level (\|θ\| < 6°). The stone **slides along its rail when hit** (any attack pushes it 1 notch away from the attacker; the Vector Blade's idea finally does something). As the group walks right, someone must push the stone left in step, keeping M·x_stone + Σxᵢ ≈ 0. M is chosen so this is feasible only with the stone fully left (N = 4: M = 4; all four at +7 → stone at −7). | Centre of mass as a choreography. A continuous co-op dance with a clear readout. |
| S3 Combine: "The catapult" | Switch A (4.5 m) needs 1 plunger. Switch B (9 m) needs **2 plungers landing together** (countdown), with the fulcrum in the **far socket** (d₂/d₁ ≈ √2). Both switches must be pressed to open the vault. N = 4: 2 plungers + 1 launched + 1 socket operator / spotter. N = 3: 2 plungers + 1 launched (they set the socket first). N = 2 or solo: the Echo plunges with you, triggered by your countdown. | Conservation: height out < height in. Two bodies carry more momentum. Arm ratio trades force for speed. |

**N-table and roles.**
- S1: everyone is a weight.
- S2: walkers + **stone pusher** (rotates).
- S3: plungers, the **launched** player (hero moment: flying), and the socket operator, whose hero moment is choosing the ratio that works.

**Info/agency split.** Agency is split: each body is one weight, and only the pusher moves the stone. Information is shared through the tilt gauge, though each player only reads their own arm length from their notch number. The S3 "best socket" is discovered by trying, with a launch-height readout after each attempt.

**Sync & server state.**
- **Server:** `onBeam(pos)`, which projects onto the beam axis → arm x. Στ = Σ x (masses = 1) + M·x_stone. θ is integrated server-side at 10 Hz. For catapult impacts, the server receives `act {k:"plunge", vy}` claims from the plunging client at landing. It validates them: the plunger is on the beam's short end within 1.2 m, `vy` ≤ √(2·40·towerTop) + 1, and the plunge started from the tower updraft zone in the last 3 s. Impacts are grouped within 250 ms. The server computes v₂ and broadcasts `ev {k:"launch", seat, v}`. **The launched client applies v as `motion.vy`** (an authoritative impulse; positions stay client-driven).
- **Client:** `ground()` for beam tiles uses the latest server θ plus local interpolation, so players ride the tilt smoothly.
- **State:**
```json
{ "theta": -0.031, "tau": 0.4, "level": true, "holdMs": 1300, "stone": -4.0,
  "socket": 2, "switches": [true, false], "lastLaunch": { "seat": 1, "h": 4.4 } }
```
- **Messages:** `act {k:"push", dir}` (validated: the attacker is within 2 m of the stone and the attack cooldown has passed), `act {k:"socket", i}`, `act {k:"plunge", vy}`.

**Failure & feedback.**
- A big tilt-meter arc over the fulcrum shows Στ as a needle, with a "LEVEL" glow.
- Tipped players slide into soft hay with a comic "boing".
- A short launch lands on a puffy cloud cushion, with a height marker and a "4.4 m / need 9 m" chalk note.

**Aha.**
- S1: "the farthest notch counts most."
- S2: "when we move right, the stone must go left."
- S3: "it never throws higher than we fell — but two of us at once, from the far socket…"

**Misconception bait.**
- *"Only weight matters"* (`M_TORQUE_MASS_ONLY`): everyone huddles near the centre and the beam stays tipped.
- *"A lever creates energy"*: the first single-plunger launch at the 9 m switch obviously falls short.

**Hint ladder.**
- S1: L1 "Which notch tips it most?" · L2 "Each notch number is how hard that spot pushes." · L3 the notch sum is shown live (Σd = 25?).
- S3: L1 "Was the launch higher or lower than your jump-off?" · L2 "Two at once." · L3 highlight the far socket.

**Difficulty.** S1 ★ · S2 ★★ · S3 ★★. Physical comedy carries it.

**VFX/SFX.**
- Gold beam and brass notches. The tilt needle swings with a ratchet sound.
- The level state plays a chord and the beam's runes light up.
- Catapult launch: a whoosh, dash afterimages on the launched player, and the plunge crater FX at impact (existing `crater`).

**Build.**
- `vault/chambers/Balance.tsx`: beam meshes, the notch instanced discs, the stone, the catapult beam, a tower with `Updrafts`, and the switch ledges.
- `lib/world/vault/balance.ts`: `torque`, `tiltStep`, `onBeam`, `catapultV(m1, v1, d1, d2, m2)`, `groupImpacts(…, 250)`. Tests check symmetric arrangements give θ → 0, the formula limits (v₂ ≤ v₁ for equal masses), and that grouping works.

**Effort.** 4 days (beam riding + server tilt 1.5, catapult 1, scene 1, tests and polish 0.5).

---

### 8.3 Chamber III: The Four-Color Garden (Euler)

**Idea.** **Graph colouring.** Neighbouring regions must differ, and a team must learn three things:
- **An odd ring needs 3 colours, while an even ring needs only 2.**
- **A wheel with an odd rim needs 4.**
- **No flat map ever needs more than 4** (the Four Colour Theorem, Appel & Haken 1976, among the first major proofs that relied on a computer *(prior)*; that is the Turing tie).

**Fantasy.** A moonlit walled garden of flowerbeds bordered by low hedges. Each player is a **lantern colour** (seat glyph + colour), and beds bloom in the colour of whoever tends them.

**Rules.**
- Stand in a bed for 0.8 s and it **blooms in your colour**. Re-blooming is always allowed (no destroyable states).
- If two **adjacent** beds share a colour, their shared hedge **sparks**, and after 2 s both beds wilt to grey (visible conflict, not instant erasure).
- The stage clears when **all beds bloom with no conflicts, held for 2 s**.
- **Fog of hedges:** a hedge border only shows its glow within your **8 m lantern radius**, so adjacency knowledge is local. The Overlook shows the shapes of the beds but **not the hedges** (shapes can look adjacent and not be), so walkers must report "these two touch".

**Stages (structured so the chromatic number equals the needed seats).**

| Stage | N = 4 | N = 3 | N = 2 / solo | Purpose |
|---|---|---|---|---|
| S1 Teach | Two **even rings** of 6 beds, one per pair, coloured by the pair. | One even ring (2 seats) + one 4-bed tree for the third seat. | One even ring. | Colouring rule; alternate around a ring. |
| S2 Twist | One **odd ring of 5** and an "only 2 lanterns" rule: impossible. The 3rd lantern is granted after the first failure. | Same. | Odd ring; the Echo's lantern joins. | **Odd cycles need 3.** |
| S3 Combine | A **wheel with an odd rim** (hub + 5 rim beds) embedded in a 12-bed map (χ = 4) → all 4 lanterns are needed. | A forced triangulated strip map (χ = 3, colouring forced up to permutation) → careful propagation. | A χ = 3 map with the Echo lantern. | **Some maps need 4 — and never 5.** |

Hard mode (later): **Kempe chain**. A full 4-colour map has one grey bed whose 4 neighbours use all 4 colours. Players must swap two colours along a chain to free one, which is the actual 1879 proof idea *(prior)*.

**Info/agency split.** Agency: you can only paint *your* colour. Information: hedges are only visible locally. This keeps any single player from quarterbacking.

**Sync & server state.** Positions give bed membership with a dwell timer. State: `{"bed": [seat|-1 …], "conflict": [[i,j]…], "holdMs"}`. No new messages.

**Failure & feedback.** Sparking hedges, grey wilting, and a soft "dissonant chord" between the two colours' notes. When the stage clears, the whole garden blooms in a wave.

**Aha.** "The ring of five can't alternate!" and "the middle bed touches all five around it — that's the fourth colour."

**Misconception bait.** *Greedy colouring*: painting the nearest bed whatever colour is free produces a dead end on S3.

**Hint ladder.**
- L1 "Walk around the ring: which colour comes next each time?"
- L2 "Start with the bed that touches the most."
- L3 the highest-degree bed glows and its degree is shown.

**Difficulty.** ★ / ★★ / ★★★.

**VFX/SFX.** Instanced flower cards (paper style), hedge glow lines, petals. Each colour is a note, so adjacent beds play a harmony, and a conflict plays a minor second.

**Build.** Beds are hand-authored 2D polygons (later: Voronoi-generated with an adjacency check). `lib/world/vault/garden.ts`: `adjacency`, `conflicts`, `chromaticLowerBound` (for tests), `maps(N)`. Tests assert that each S3 map has χ = N, using a backtracking colourer (n ≤ 12 beds), not brute force over all 4ⁿ colourings.

**Effort.** 3 days.

---

### 8.4 Chamber IV: The Latch Foundry (Turing)

**Idea.**
- **Logic gates** (AND, XOR) and truth tables.
- **Memory is feedback:** an **SR latch** made of two cross-coupled NOR gates keeps a bit after you let go. S = R = 1 is the *forbidden* state, which is honest.
- **Systematic search:** test a black box in **Gray-code** order so only one person moves per test.

**Fantasy.** A brass-and-cyan foundry. Glowing wires run on the floor from **input plates** (A, B, C, D) through big readable gate glyphs to lamps that power doors and bridge segments.

**Rules.** Standing on a plate means 1. Wires animate pulses whenever their value changes. Gates evaluate instantly, and latches update on a 0.15 s clock tick so the feedback is visible.

**Stages.**

| Stage | Setup | Purpose |
|---|---|---|
| S1 Teach: "Doors" | Door 1 = A AND B. Door 2 = A XOR B (exactly one stands, so someone stays behind… and gets left out). | Gates, and the "someone must stay" problem. |
| S2 Twist: "Remember me" | The exit bridge has N segments, segment *i* lit by latch Qᵢ. Each latch has an **S plate** (set) and an **R plate** (reset). Some R plates sit *on the path* (walk around them, or glide over). Some S plates are beyond earlier segments, so the dependency order matters. Set every latch, then **everyone** crosses. | Feedback = memory. Sequencing. Hazards. |
| S3 Combine: "The black box" | A sealed box with N inputs (players on plates) drives the vault lock. Only one input pattern of 2ᴺ opens it. Each test costs a 2 s "evaluate" chime. | Systematic exploration, Gray code (only one person moves per step), hypothesis testing. |

**N-table.**
- S2 has N latches.
- S3: N = 4 → 4 bits (16 patterns); N = 3 → 3 bits; N = 2 → 2 bits + the Echo.
- Hero moments: the last latch set, and the lucky bit-flip.

**Info/agency split.** Each player is one bit (agency). In S3, the box shows a **partial output** (a 2-bit lamp) only to the player standing at the "probe" console. They must relay it, which is information.

**Sync & server state.** Positions → inputs. The server evaluates the circuit DAG + latches each tick. State: `{"in":[0,1,1,0], "q":[1,0,1], "forbidden": false, "tests": 7}`.

**Failure & feedback.** Stepping on an R plate makes that bridge segment flicker out with a sad "power-down" whine. S = R = 1 makes the latch lamp **flicker between states** with a glitch effect, and the Echo says "Both? Even a machine can't remember that."

**Aha.** "The bit stays on after I leave!" (memory), and "change only one person at a time."

**Misconception bait.** "XOR = OR". Two players on the XOR door both stand, and it closes.

**Hint ladder.**
- S2: L1 "What happened to the lamp when you stepped off S?" · L2 "Set first, then cross." · L3 the order of latches is shown.
- S3: L1 "Write down what you tried." (A tried-patterns list appears on the console.) · L2 "Change only one bit each test." · L3 a Gray-code path is drawn on the plates.

**Difficulty.** ★ / ★★ / ★★.

**Build.** `lib/world/vault/logic.ts`: gate eval, latch step, Gray code. The scene is cheap (floor decals + glyph boards). Tests cover truth tables, latch hold and reset, the forbidden state, and that the Gray sequence changes one bit per step.

**Effort.** 3 days.

---

### 8.5 ★ Chamber V: The Fourier Choir (Ada)

**Idea.**
- **Any periodic wave is a sum of sines** (Fourier).
- A **square wave contains only odd harmonics** (1, 1/3, 1/5, …), and the corners always **overshoot by about 9 %** (the Gibbs phenomenon), a surprising truth.
- **Waveform ↔ spectrum** are two views of one thing.
- (Hard-mode discovery) **orthogonality**: with pure sines, each pipe can be tuned *on its own*.

**Fantasy.** A cathedral-like well of paper-cut organ pipes. A paper **songbird** is trapped in the centre and sings only when its true call (the target wave) is sung back to it.

**Layout.**
- The central **Choir Well** (Ø 14 m) shows a large 3D ribbon of one period: the **target** as a gold ghost and the **team's sum** as a cyan line, side by side and overlaid.
- **N pipe alcoves** sit around it, each with a pedestal; each piper's own sine wave glows in their colour on their pipe.
- A **Conductor's podium** (S3) faces the well.

**Rules.**
- Stand on your pedestal → the station panel shows an **amplitude dial**, from −1 to +1, with detents at 0, ±1/4, ±1/3, ±1/2, ±1 and fine steps of 1/12.
- The sum is played as **real audio**: `createPeriodicWave(real=0, imag=a_k)` at a base of ~196 Hz, quiet, with a mute toggle. The timbre literally moves toward the target (square sounds hollow and clarinet-like; saw sounds bright and brassy).
- **Error** is computed in coefficient space, which is exact because the sines are orthogonal:
  `err = √Σ_{k≤K}(a_k − t_k)² / √Σ_{k≤K} t_k²`
  (the target's harmonics above the available pipes are excluded, so a perfect score is reachable).
- The stage clears at **err ≤ 0.10 held for 2 s**: the bird sings and the door opens.

**Stages.**

| Stage | Pipes (by N) | Target (normalised so harmonic 1 = 1) | Purpose |
|---|---|---|---|
| S1 Teach: "Tune" | k = 1..N | A simple mixture, e.g. (1, 1/2, 0, −1/3). | Each pipe is one ingredient, and the sum is what the bird hears. |
| S2 Twist: "The odd ones" | **k = 1, 3, 5, 7** (N = 4) · 1, 3, 5 (N = 3) · 1, 3 (N = 2) | **Square wave:** 1, 1/3, 1/5, 1/7. | Pipes are relabelled with odd k, the "why only odd?" moment. Gibbs: even when perfect, the corners overshoot (the Echo comments). |
| S3 Combine: "The Conductor" | N = 4: **Conductor** + pipers k = 1, 2, 3. N = 3: pipers 1, 2, 3, no conductor. N = 2: two pipers on 2 pipes each, plus a podium either can visit. | **Sawtooth:** 1, −1/2, 1/3 (alternating signs). | **Info split:** only the Conductor's podium shows the target's **spectrum** (signed bars, using `MiniGraph`-style SVG). Pipers see only waveforms. The Conductor has no dial and uses value pings (`+`, `−`, `0`, "flip it"). |
| Coda (optional): "The Siren's cry" | as S3 | The Siren's signature wave (mixed signs). | Lore tie: restoring this weakens the Siren. |

**N-table and roles.**
- Pipers (agency). The Conductor (information; hero moment: "flip the second one!").
- Solo: you are the Conductor + 1 piper; the Echo pipes the rest and obeys your value pings, which is very Lovers-like.

**Info/agency split.** S1–S2 split agency (each pipe has one owner). S3 adds an information split, which is the KTANE pattern inside the chamber.

**Sync & server state.**
- **Messages:** `act {k:"dial", v}`, rate-limited to 20/s per player, clamped to [−1, 1] and snapped server-side. **It is only accepted if the sender stands on that pipe's pedestal** (server position check).
- **State:** `{"pipes":[1,3,5,7], "amp":[0.98,0.34,0.2,0.14], "err":0.06, "holdMs":1200, "conductor": 3}`.
- Dial changes broadcast immediately (a small delta) rather than waiting for the next snap, to keep the audio responsive. Clients predict their own dial locally.

**Failure & feedback.** The bird's paper wings flutter more as err shrinks. Error-meter bands are red → amber → gold. The audio is mostly honest feedback: with the wrong sign, you hear a different timbre.

**Aha.** "Square = only odd pipes", and in S3, "the bars ARE the wave".

**Misconception bait.**
- *"More harmonics are always better"*: in S2 the even pipes don't exist, and in S1 a pipe whose target is 0 must be *silent*.
- *"Turn everything up"*: louder isn't closer.

**Hint ladder.**
- S2: L1 "Listen — does it get closer when this pipe is quieter?" · L2 "Each odd pipe gets 1 / its number." · L3 one pipe's target amplitude is revealed.
- S3 (N = 3, no conductor): L3 shows the spectrum to everyone for 10 s.

**Difficulty.** ★ / ★★ / ★★★.

**VFX/SFX.**
- Ribbon lines (`THREE.Line` with 128 points, recomputed only when an amplitude changes). Pipes pulse at their harmonic frequency (visually 1/2/3/… beats).
- Clearing a stage makes the bird unfold into a flock of paper birds (instanced quads).
- Audio: one `OscillatorNode` with a `PeriodicWave` rebuilt on change (cheap), plus a gain envelope to avoid clicks.

**Build.**
- `vault/chambers/Choir.tsx`, `ui/StationPanel.tsx` (shared dial), `ui/Spectrum.tsx` (SVG).
- `lib/world/vault/fourier.ts`: `targets` (square, saw, triangle with normalised coefficients), `err`, `snap`, and `sample(x)` for the ribbon.
- **Tests:** the err formula against numeric L2 integration (they must agree), the snap table, and that the 4-term square partial sum peaks above π/4, the square's height when harmonic 1 = 1 (so the Echo's Gibbs comment is true).

**Effort.** 4 days (dial and station panel 1, audio 0.5, scene and ribbons 1.5, logic and tests 1).

---

### 8.6 Chamber VI: The Mirror Observatory (Noether)

**Idea.**
- **Law of reflection** (angle in = angle out), and a periscope chain.
- **Corner reflector:** two mirrors at exactly 90° send light back parallel to where it came from, *whatever* the incoming angle. Apollo astronauts left retroreflectors on the Moon for exactly this reason *(prior)*.
- **Snell's law** n₁ sin θ₁ = n₂ sin θ₂ and **total internal reflection** above the critical angle (glass → air ≈ 41.8°, water → air ≈ 48.8°), which is how optical fibres trap light. This ties in the Snell Prism weapon.

**Fantasy.** A dark star-dome. A **sun-crystal** emits a beam at chest height (1.3 m), and **Lens Locks** need the beam. In the observatory every player holds a **mirror ward**, a flat round mirror shield in front of them, a reskin of the existing `Shield` FX.

**Rules.**
- The beam is traced in the horizontal plane. It reflects off a player's mirror if it hits the 1.2 m mirror segment in front of them; the mirror normal is the player's facing (yaw).
- **Brace** (station-panel button): you're rooted, the joystick or ◀ ▶ rotate the mirror in 2.5° steps, and a protractor overlay shows the incident and reflected angles.
- The beam reaching a lock for 2 s opens it.
- Water pools and glass blocks refract the beam (2D Snell). Above the critical angle the beam reflects internally.

**Stages.**

| Stage | Setup | Purpose |
|---|---|---|
| S1 Teach | N parallel lanes, one per seat. Each person bounces their own lane's beam into their own lock (parallel, no waiting). | The reflection law. The protractor shows θᵢ = θᵣ after the first success. |
| S2 Twist: "Periscope" | One beam must snake around pillars to a lock: **N−1 bounces** (N = 4: 3 mirrors + a 4th player who moves the "aperture" gate). The upstream mirror sets the downstream aim, so order matters. | Chained reasoning and turn-taking communication ("hold still while I aim"). |
| S3 Combine: "Send the light home" | The sun-crystal **swings slowly** on a 40° arc, and the lock is **on the crystal itself**. Only a 90° mirror pair returns the beam robustly. The others guide the beam through a **glass fibre bar** (TIR) to reach the pair. N = 2: just the corner pair. | The corner-reflector aha, plus TIR. |

**Info/agency split.** Each mirror is one player. Only the person braced sees their protractor (local information), and the beam is visible to all.

**Sync & server state.** The server traces the beam at 10 Hz from positions + yaws (≤ 12 segments, 2D, deterministic) and broadcasts the path points (≤ 13 × 2 floats). Each client also traces locally with its own fresh yaw, for responsive aiming. Only the server's trace counts for locks.
**Messages:** `act {k:"brace", on}`. Yaw already flows in `s`. While braced, the server ignores the position wobble threshold.

**Failure & feedback.** A beam ending on a wall leaves a scorch-glow spot that shows "how far off". Locks hum louder as the beam approaches.

**Aha.** "At 90° it always comes back — even while the crystal swings!"

**Misconception bait.** *Aim where it looks* (`M_AIM_AT_APPARENT`): the lock under the water appears shifted.

**Hint ladder.** L1 "Watch the angle on both sides of your mirror." · L2 "What if two mirrors face each other at a right angle?" · L3 a 90° ghost guide appears between two seats.

**Difficulty.** ★ / ★★★ / ★★★.

**Build.** `lib/world/vault/optics.ts`: `trace(segments, mirrors, media)`, `snell`, `tir`. Tests: θᵢ = θᵣ; the corner pair returns any input angle; the TIR threshold; the max-bounce cap. The scene needs an emissive beam with bloom (`Beam` FX exists), the mirror ward mesh and a dome.

**Effort.** 4.5 days (the brace control and the tracer are the risk).

---

### 8.7 Chamber VII: The Forge of Order (Noether)

**Idea.**
- **Composition of linear transformations:** **order matters (AB ≠ BA)**. Concretely, rotate 90° then mirror across x gives a reflection across y = x, while mirror then rotate gives a reflection across y = −x.
- **Inverses reverse the order** ("socks and shoes": (AB)⁻¹ = B⁻¹A⁻¹).
- The **determinant is the area scale factor and orientation**, and det 0 destroys information.

**Fantasy.** A forge with a glowing 9×9 m grid floor and axes. An **ingot rune** shaped like the letter **F** (no symmetry, so every orientation looks different) sits at the origin, and a **target outline** glows elsewhere. Each player holds a **Transform Rune**:

| Rune | Matrix | det |
|---|---|---|
| R (rotate 90°) | [[0,−1],[1,0]] | 1 |
| M (mirror across x) | [[1,0],[0,−1]] | −1 (the F turns "inside-out": its colour flips) |
| S (shear) | [[1,1],[0,1]] | 1 |
| D (double x) | [[2,0],[0,1]] | 2 |
| P (project to x) | [[1,0],[0,0]] | 0 |

**Rules.**
- N **anvil slots** sit in a row. Players stand on slots; the slot order is the application order (slot 1 first).
- Anyone rings the hammer (countdown optional), and the ingot **animates through each transform in turn**: a smooth matrix lerp per step, ~0.8 s each.
- Matching the target outline locks the ingot (a key fragment). A mismatch shows the result outline beside the target, then resets.
- Each player can preview their rune on a personal mini-F in the HUD.

**Stages.**

| Stage | Setup | Purpose |
|---|---|---|
| S1 Teach | Pairs at two forges (N = 4) or one forge (N = 2–3) with runes R and M. The target needs a specific order. | RM ≠ MR. |
| S2 Twist | N runes, one target. | Reasoning instead of brute force: each ring costs about 4 s of animation, and N! = 24 orders for 4 is too many to brute-force happily. |
| S3 Combine: "Unforge" | The ingot arrives pre-forged by a shown sequence (glyphs), and the target is the original F. Each rune card can be **flipped to its inverse** (tap). | Inverses in reverse order. Bonus trap: one rune is **P**. Once applied, the ingot is flat and nothing can restore it, so P must go last or not at all. The area meter shows the dets. |

**Info/agency split.** Each rune belongs to one player, and the previews are private. The composition is only visible on the forge, so the team must talk about order.

**Sync.** Slot occupancy comes from positions. `act {k:"ring"}` (debounced 1 s; ignored while animating) and `act {k:"invert"}` (only by the rune holder). State: `{"slots":[2,0,3,1], "inv":[0,1,0,0], "anim":{"at":…}, "ok":false}`. The ring timestamp is shared, so every client animates in sync.

**Aha.** "Mirror-then-turn is a different mirror!" and "to undo, go backwards."

**Misconception bait.** `M_ORDER_IRRELEVANT`: the first ring with the "natural" reading order fails.

**Hints.** L1 "Watch which way the F faces after each strike." · L2 "Undo the last thing first." · L3 the first slot is revealed.

**Difficulty.** ★★ / ★★ / ★★★.

**Build.** It's trivial in three: the ingot group's `matrix` is set from a lerped mat3 embedded in a mat4. `lib/world/vault/forge.ts` (mat2 ops, det, compose, equality up to ε). Tests check RM vs MR, inverse order, and that P's det = 0 makes the composition non-invertible. This also delivers the PLAN.md W3 "Matrix Forge" idea.

**Effort.** 3 days.

---

### 8.8 Chamber VIII: Galileo's Gallery (projectiles; uses the Parabola Bow)

**Idea.**
- **Range** R = v² sin 2θ / g: complementary angles θ and 90° − θ land at the **same spot**, and 45° goes farthest.
- **Time of flight** T = 2v sin θ / g depends only on the vertical speed, so **high arcs take longer**.
- **Time on target:** two shots fired at different moments can land together, the artillery technique called "multiple rounds simultaneous impact" *(prior)*.
- Bracketing = binary search.

**Fantasy.** A long gallery split by a **curtain wall**. **Archers** stand on one side and can't see the bells. **Spotters** stand on a balcony on the bell side.

**Rules.**
- In the gallery the **puzzle bow** is manual: launch speed is fixed (v ≈ 17.1 m/s with g = 9.8 → 45° range ≈ 30 m), and you set the **elevation** with a dial (5°–85°, 5° detents).
- **There is no arc preview** (guess-then-see).
- Arrows are simulated analytically. The spotter sees landing marks and bells. The archer sees only a "thunk" sound.

**Stages.**

| Stage | Setup | Purpose |
|---|---|---|
| S1 Teach: "Bracket" | One bell at an unknown range. The spotter says "short / long" (value pings). | Bracketing, which is binary search. |
| S2 Twist: "Two roads to one bell" | Bell A is behind a low arch (only a low arc reaches it), and bell B is at the **same range** behind a tall pillar (only a high arc). Example: 30° and 60° both land at ≈ 26 m. A far bell is reachable only at 45°. | Complementary angles and maximum range. |
| S3 Combine: "Time on target" | Bells A and B must ring **within 0.3 s** to form a chord. High (60°) flight T ≈ 3.0 s, low (30°) T ≈ 1.75 s, so **the high arc must fire ≈ 1.3 s earlier**. The countdown helps; finding the offset is the puzzle. The spotter sees "Δ 1.2 s — high late". | Time of flight depends on the vertical speed. |

**N-table.**
- N = 4: 2 archers, 1 spotter, 1 "quartermaster" who reads the gallery's angle-table plaque, unlocked after S2 as a reward (honest *after-the-aha* info).
- N = 3: 2 archers + spotter.
- N = 2 / solo: archer + spotter swap. For S3, a single archer fires high then low quickly (MRSI). The Echo spots, but *only* reports short / long and the Δ number; no advice.

**Sync.** `act {k:"fire", deg}` → the server computes impact time and position in closed form and broadcasts `ev {k:"arrow", seat, deg, at}`. Clients render identical arcs from the server time `at`. Bells are scored server-side.

**Aha.** "30 and 60 land in the same place!" and "the high one has to go first."

**Misconception bait.** "Steeper = farther".

**Hints.** S3: L1 "Which arrow was in the air longer?" · L2 "Fire the slow one first." · L3 the Δ seconds are shown as a countdown offset suggestion.

**Build.** Reuse the `projectiles` rendering and add the angle dial to `StationPanel`. `lib/world/vault/ballistics.ts` (R, T, hit test). Tests check R(θ) = R(90 − θ) and the T values.

**Effort.** 3 days.

---

### 8.9 Chamber IX: The Cartographer's Booth (asymmetric information + Impossible Halls tech)

**Idea.**
- **Frames of reference and coordinates:** "my left is not your left", so agree on absolute directions.
- **Similarity and scale:** a 1:10 model, where lengths scale ×10 and areas ×100.
- The **map is a transformation** of the territory: rotated and mirrored.

**Fantasy.** A hedge maze with **invisible walls** (they shimmer only within 1 m) and pit traps. One player enters the **bigger-on-the-inside Booth** (the existing `Booth` + `StencilPortal`) and finds a vast hall holding a **1:10 scale model** of the maze, with visible walls and live markers for the runners. **The model is rotated 90° and mirrored** relative to the maze, because the booth's door faces another way.

**Rules.**
- **Compass beacons** (coloured pillars N/E/S/W) stand in the real maze *and* in the model. Players discover that only those are reliable.
- **Pings on the model appear at the matching real location** (the server applies the similarity transform), and runners' pings appear in the model.
- Runners collect 3 **lemma shards**. Some need **two runners on twin plates at the same time** (countdown), where only the Cartographer sees both plates.

**Stages.** S1: guide one runner to a shard ("left/right" fails, so the team learns to use beacons). S2: twin plates. S3: **swap Cartographer** (rotation, P10) on a different maze with a different rotation, so the frame has to be re-learned.

**N-table.** One Cartographer + N−1 runners. With N = 2 it's one each, swapping per shard. Solo: you are the Cartographer and you command the Echo runner with pings, a natural fit.

**Build.** Reuse `Booth`/`StencilPortal` from `Impossible.tsx`. The model is an instanced, scaled copy of the maze walls. `lib/world/vault/carto.ts`: `toModel`/`toWorld` similarity transforms (rotation + mirror + scale) with tests (round trip, handedness flip).

**Effort.** 4 days.

---

### 8.10 Backlog sketches (not in v1)
- **Interference Hall:** two wave sources controlled by players (positions on rails). The door opens at a constructive point, and a "watcher eye" is blinded at a destructive point (path difference λ/2). This reuses the Interference Twins' cos² fringe maths.
- **Torus Gallery:** a room glued into a torus, rendered as 3×3 copies like the Loop Corridor. A plate pair can only be pressed "across the wrap". Shoot through one wall to hit your partner's back.
- **Halving Doors:** 64 doors, one treasure. With k probes per round (k = players), the space shrinks by (k + 1) per round, a (k + 1)-ary search. The aha: more people ≠ halving faster unless you split wisely.
- **Sorting Network:** players are values (their glyph numbers) in lanes. Comparator gates on the floor swap two players if they are out of order, and the right sequence of gates (odd–even transposition) sorts any arrangement.
- **Möbius Walk:** walking around a Möbius ring returns you mirrored, so the plate glyphs read reversed only for you, and the team must reconcile handedness.

---

## 9. Finale: The Theorem Engine

- **Concept:** the shattered Theorem is a 12 m fractured icosahedron above three **lemma sockets**, one per chamber of the run. Each chamber module exports a small **finale micro-module** reusing its mechanic. The finale **couples** them: all three conditions must hold **together for 3 s**. No new idea is introduced; this is the "everyone does their part at once" moment.
- **MVP coupling** (Königsberg + Balance + Fourier):
  1. **Bridge circuit:** a 3-bridge mini-graph with 2 odd islands, so one walker lights it.
  2. **Balance:** the beam must be level, and **the bridge circuit runs across the beam**, so the walker is a moving weight and the beam team must compensate live.
  3. **Choir:** one pipe pair tunes a 2-harmonic target.
  - With N = 4: 1 walker, 2 on the beam, 1 piper; roles are free to choose. With N = 3: walker, beam (1 + stone push), piper. With N = 2: the Echo takes one role.
- **Generic rule for other combinations:** each micro-module declares `{needsSeats: 1|2, condition(st) → bool, couplesTo?: "weight"|"position"|"signal"}`. The engine places them so at least one coupling exists (e.g. a Foundry latch powers the Choir's pipes, Mirror beam light falls on the Garden).
- **Payoff:** the icosahedron reassembles face by face (each face one lemma glyph), the Echoes of all wings appear, a 3-line dialogue plays, and rewards follow.
- **Effort:** 2 days for the MVP version; generic composition comes later with the v1 pool.

---

## 10. Network protocol

### 10.1 Room model
- **Realm `vault`** uses **party rooms**: the key is `vault#<code>`, with max **4 humans**. The room is created by `vault.create` (returns a code) or `vault.quick` (matchmaking among open parties with the same class claim).
- The existing `pickRoom` (40 per realm) stays for other realms.
- **Seats** `0..3` are keyed by **`uid`** (`ws.user.uid`), not `ws.id`. A reconnecting uid within the grace period (120 s) gets the same seat back, and the seat's companion releases it.
- **Tick:** the existing 10 Hz loop. For vault rooms it calls `vaultTick(room, positions, now)` and adds `v` (state delta) to the `snap` only when something changed (dirty flag), mirroring the `b` field.

### 10.2 Run state (server-authoritative, JSON)
```json
{
  "v": 1,
  "run": "r_7f3k9q",
  "code": "KX7P",
  "seed": 912345,
  "plan": ["konigsberg", "balance", "fourier"],
  "seats": [
    { "seat": 0, "uid": "u…", "name": "Linh", "glyph": "●", "conn": 1, "comp": false, "ready": true },
    { "seat": 1, "uid": "u…", "name": "Minh", "glyph": "▲", "conn": 0, "comp": true, "graceUntil": 1764160000000 },
    { "seat": 2, "uid": null, "name": "Echo of Euler", "glyph": "■", "conn": 1, "comp": true }
  ],
  "ch": 0,
  "stage": 2,
  "n": 3,
  "phase": "play",
  "hint": { "offered": 1, "level": 0, "askAt": 0, "askBy": -1 },
  "count": { "at": 0, "by": -1 },
  "st": { "g": "grand3", "lit": [[0, 2]], "trail": { "0": { "start": 3, "at": 4, "edges": [0] } }, "stuck": [] },
  "seq": 418,
  "cleared": [["konigsberg", 1], ["konigsberg", 2]]
}
```
`phase ∈ intro | plan | play | clear | reveal | breath | finale | done`. `n` is locked per stage (§5.2).

### 10.3 Messages
**Client → server** (all JSON, all rate-limited, all ignored unless the sender has a seat in the room):

| `t` | Payload | Validation |
|---|---|---|
| `vault.create` / `vault.join` | `{code?}` / `{code, resume?}` | Code alphabet and length; room ≤ 4 humans; demo users allowed (no receipt). |
| `vault.quick` | `{}` | Matches only parties whose class claim equals the sender's (or both opted into strangers). |
| `vault.ready` | `{on}` | Only in `intro`/`breath`. |
| `vault.fill` | `{}` | Fills empty seats with companions. Any human may do it, in `intro`/`breath` only. |
| `act` | `{k, …}` (chamber verb, e.g. `dial`, `push`, `plunge`, `ring`, `rewind`, `reset`, `brace`, `fire`, `invert`, `socket`) | Each chamber defines `validate(k, payload, seatPos, now)`: station proximity (≤ 1.5 m), numeric finiteness and clamps, cooldowns, phase = `play`, and a per-verb token bucket. |
| `ping` | `{kind, x, y, z, target?, val?}` | ≤ 1 per 0.5 s, ≤ 3 live, \|pos − sender\| ≤ 60 m (cross-room pings refused). The Cartographer's model pings are mapped by the server. |
| `say` | `{id}` | Must be a known phrase id. ≤ 1/s. |
| `count` | `{}` | Ignored if a countdown is active. Sets `count.at = now + 3000`. |
| `hint.ask` / `hint.notyet` | `{}` | Opens or cancels the 5 s window (§6). |
| `lead` | `{seat, on}` | Distance ≤ 3 m; the target must accept. |

**Server → client:**

| `t` | Payload |
|---|---|
| `vault` | The **full** state (on join, resume, stage change and phase change), with `seq`. |
| `snap.v` | Delta `{seq, st?, phase?, hint?, count?}`, piggybacked on the 10 Hz snapshot only when dirty. |
| `ev` | One-shot events: `{k:"clear"|"fail"|"launch"|"arrow"|"bloom"|"hint"|"moment", …}`. |
| `ping` | `{by, kind, x, y, z, target?, val?, until}` |
| `say` | `{by, id}` |
| `receipt` | `{token}` at run end (§10.9). |

### 10.4 Validation philosophy
- **Positions are trusted only within plausibility.** The server already clamps coordinates. Add a **speed check** for vault rooms: a jump of > 30 m/s between samples marks the seat "teleported" and ignores its occupancy for 1 s. Glide, dash and updrafts all stay under 25 m/s.
- **The client claims; the server decides.** Clients never send outcomes such as "bridge lit" or "level reached". They send positions (already flowing) and verbs. Outcomes come only from the pure chamber modules on the server.
- **Idempotent and debounced verbs:** `ring`, `reset` and `count` are debounced server-side.
- **Anti-grief without vote-kicks** (`RESEARCH.md` §5.4 forbids vote-kicking). Team reset needs a majority hold. A seat can be **muted** (its pings hidden for you). Parties default to friends and class. AFK seats turn into companions.

### 10.5 Server code shape
- `lib/world/vault/` (pure TS, tested in `tests/world/vault/*.test.ts`):
  - `run.ts`: seats, phases, N lock, hint timers, countdown, receipts payload.
  - One module per chamber, each exporting `ChamberDef { id, stages(n, seed) → StageDef[], init(stage, n, seed), tick(st, ctx), act(st, seat, a, ctx) → bool, progress(st), clear(st), hints(st) → {l1, l2, l3}, finale }`.
  - `ctx = { now, seats: [{pos, yaw, comp}], rng }`, with no I/O and no `Date.now()` inside.
- `realtime/vault/*.mjs` is **generated** from `lib/world/vault/*.ts` with a new `scripts/gen-realtime.mjs` that strips types (esbuild or `tsc --module esnext`, chosen to keep `.mjs` readable). Regenerate `boss.mjs` through the same script.
  - A test (`tests/world/realtime-sync.test.ts`) fails if the generated files are stale.
  - Alternative: the realtime container runs Node 22 with `--experimental-strip-types` and imports the `.ts` directly. This requires erasable-only syntax (no enums or parameter properties). It is simpler, but couples the realtime container to the repo layout.
- Companion AI runs in `run.ts` on the server tick for online parties. It writes the companion's position into `ctx.seats` exactly like a human's, and broadcasts it in the snapshot as a pseudo-peer (`id: "echo-<seat>"`), so `RemotePlayers` renders it with no special path.

### 10.6 Clock and smoothness
- Use `snap.at` as the server clock. Each client keeps `offset = min(at − recvTime)` over 20 samples (as in `COMBAT_VFX_RESEARCH.md` §3.1). Countdowns, arrow flights and forge animations are scheduled in server time.
- **Local prediction** is limited to your own continuous input: your dial value, your mirror yaw, your beam position. The server's value replaces it within 200 ms.

### 10.7 Reconnect (includes a prerequisite fix)
- **Fix first:** in `net.ts`, before every reconnect (and on `close` code 4001), call `rawApi.realtime()` to get a **fresh token**. Optionally refresh proactively at 8 minutes. Without this, any reconnect after the token's 10-minute TTL fails auth forever, and a run lasts 15–20 minutes.
- On `welcome`, if `vaultCode` is set, send `vault.join {code, resume: true}`. The server matches the uid → seat, the companion hands the seat back, and the server sends the full `vault` state. The client snaps the player to the seat's last known position if the stage is position-sensitive (Balance), otherwise to the stage's respawn.
- A disconnect during a countdown or a plunge window simply misses it. There's no punishment; teams retry.

### 10.8 Solo / offline
`VaultClient` runs the same `lib/world/vault` modules locally when there's no realtime connection or the party has only one human (like the Siren). Companions run locally and pings are local. Rewards still go through a receipt; offline runs get the **local** version with a lower daily cap (see §10.9).

### 10.9 Rewards receipt
- At run end, the server signs `receipt = base64url({uid, run, plan, cleared, n, ts, demo})` + HMAC-SHA256 with `WORLD_RT_SECRET`, the same scheme as the join token in reverse. It is sent only to that uid's socket.
- The client posts it to a new server action, `claimVaultRun(receipt)`, which:
  1. verifies the HMAC and that `uid` = the session user,
  2. checks `ts` is within 10 min,
  3. records it with `run` as a unique key (no double-claim),
  4. applies the weekly first-clear rules.
  Demo users are rejected with the standard demo message.
- Solo/offline runs, with no server, post an unsigned local summary and receive **Codex pages and Field Notes only** (no materials beyond a small daily cap). Nobody gains anything by faking it, and nothing touches real coins.
- **DB:** `WorldVaultRun {id run (unique), userId, plan Json, cleared Json, n Int, at DateTime}`. Per CLAUDE.md, `prisma db push` runs on the local DB only; production needs the user's approval at deploy.
- **Token claim for class matchmaking:** add `cls` (the class id, or null) to `signRealtimeToken`'s payload. Matchmaking compares the claims and never sends class ids to other clients.

### 10.10 Bandwidth
The state delta is < 300 B when dirty, pings and says are tiny, and beam paths are ≤ 104 B. Expect < 2 KB/s per party, well under the presence traffic.

---

## 11. Client architecture

```
components/world/vault/
  VaultScene.tsx          chamber loader (lazy import per chamber), phases, breathing room, doors
  VaultClient.ts          local runner (solo) + bridge to net (online); exposes a zustand store for HUD
  companion.ts            Echo brain (shared with server via lib/world/vault/companion.ts)
  chambers/Konigsberg.tsx · Balance.tsx · Choir.tsx · (Garden, Foundry, Observatory, Forge, Gallery, Carto)
  finale/TheoremEngine.tsx
components/world/ui/
  PingWheel.tsx           long-press + radial, contextual default, acks
  QuickChat.tsx           phrase wheel (i18n ids)
  Countdown.tsx           shared 3-2-1 ring (DOM + world sprite)
  StationPanel.tsx        dial / rotate / action, thumb zone
  Spectrum.tsx            SVG bars (Choir conductor)
  VaultHud.tsx            party portraits (glyph, conn, companion), hint button + banner, stage title
lib/world/vault/          pure logic (see §10.5) + i18n strings for hints and Echo lines
lib/world/story.ts        new Objective {type:"vault", chamber?, n}; Chapter II quests use it
```
- **Scene integration:** add `"vault"` to `SceneId` and `REALMS`, a `VaultGate` in `Hub.tsx`, and spawn positions in `WorldClient.go()`. Each chamber passes its own `ground`/`blocked` to `Player`.
- **Performance:**
  - Each chamber is ≤ 60 draw calls on low (instanced bridges, notches, beds, flowers), with no new textures beyond the existing FX kit and paper cut-outs.
  - Dispose chamber geometries and materials on exit.
  - Avoid allocations in `useFrame` (`TECH.md`).
  - Recompute ribbons and lines only on change.
- **Audio:** one shared `AudioContext` (`sfx.ts`), plus a `choir()` voice using `PeriodicWave` and a per-seat pentatonic palette for crossings and blooms.

---

## 12. Prioritized build plan

Effort is in ideal dev-days. Each step ends with the CLAUDE.md checks: `npx tsc --noEmit -p .`, eslint on touched files, `npm test` (pure-logic tests need no DB), and e2e with a running server when UI changed.

| # | Item | What, concretely | Effort |
|---|---|---|---|
| **P0** | **Prerequisites** | (a) Token refresh on reconnect (§10.7) + test with a short TTL. (b) `scripts/gen-realtime.mjs` + a staleness test; regenerate `boss.mjs`. (c) Party rooms (code, seats by uid, grace, ≤ 4) on the server + `net.ts` API (`vaultCreate/Join/Quick`, `onVault`). (d) Optional `cls` claim. | 3 |
| **P1** | **Comms kit** | PingWheel (long-press vs camera drag), contextual defaults, acks, QuickChat, Countdown, mute seat, server relay + rate limits. Also enable it in the Siren realm (immediate value). | 3 |
| **P2** | **Vault framework** | `run.ts` (phases, N lock, hint ladder, countdown, receipts), VaultScene shell, Threshold, breathing room, VaultHud, StationPanel, Echo companion v1 (goTo/hold/dial nudges), solo local runner. | 4 |
| **P3** | **★ Königsberg** | §8.1 | 3.5 |
| **P4** | **★ Balance** | §8.2 | 4 |
| **P5** | **★ Fourier Choir** | §8.5 | 4 |
| **P6** | **Finale-lite + rewards** | Theorem Engine MVP coupling, `claimVaultRun` + `WorldVaultRun` (local DB), Codex lemma pages, Field Notes stamps, Moments card. | 3 |
| **P7** | **Playtest round 1** | §13 protocol with 2, 3 and 4 players and solo, mics muted; tune numbers; fix the top 5 issues. | 3 |
| | **MVP total** | | **≈ 27.5** |
| P8 | v1 pool: Latch Foundry · Forge of Order · Four-Color Garden | §8.4, §8.7, §8.3, + weekly rotation + generic finale composition | 3 + 3 + 3 + 2 |
| P9 | v2 pool: Mirror Observatory · Galileo's Gallery · Cartographer's Booth | §8.6, §8.8, §8.9 | 4.5 + 3 + 4 |
| P10 | Hard modes ("Proof of Rigor") | Kempe chains, the orthogonality discovery in the Choir, Chinese-postman bridges, wind in the Gallery | ongoing |

**Why this MVP:**
- It shows three different verbs (path, weight + plunge, dial + split information) across graph theory, physics and waves.
- Königsberg and Balance need **no new input UI** beyond what P1/P2 already add, so they de-risk the framework first.
- The Choir is the "wow" (you hear the maths) and ties into the Siren.
- The Foundry is the cheapest post-MVP chamber, so CS content follows quickly.

---

## 13. Testing, playtests and metrics

- **Unit tests (pure, no DB):** every chamber module (listed per chamber), `run.ts` (N lock on join/leave mid-stage, seat reclaim by uid within grace, companion handover, hint window with not-yet, countdown exclusivity), receipt sign/verify, ping rate limits.
- **Protocol tests:** start the realtime server in-process with `ALLOW_ANON=1` and drive 3–4 fake `ws` clients. Cover joining by code, 5th-player rejection, disconnect → companion → resume, a stale-token reconnect (must refresh), and invalid `act`s ignored (wrong station, NaN, out of phase).
- **E2E:** 2–3 browser tabs on a local realtime server (`PLAN.md` round 6 recipe). Smoke-test each MVP chamber's S1 at 390 px and 1366 px. Check there are no console errors and the HUD has no layout shift.
- **Playtest protocol** (the research says this is where co-op lives or dies):
  1. **Paper prototype first:** islands on a table with string for threads; coins on a ruler for torque; a phone tone generator for Fourier.
  2. **Mute-mic sessions** (Respawn): ping and quick-chat only.
  3. **Two-room sessions** (We Were Here): players can't see each other's screens.
  4. **Fresh players only** for difficulty (Teikari's blindness warning).
  5. Watch who drives (Lovers) and whether anyone idles > 30 s (Hazelight).
  6. Ask after each chamber: "What was the rule?" If ≥ 1 player per team can state it in their own words, the aha worked.
- **Telemetry** (aggregate only, no names; JSONL on the realtime server keyed by a hashed run id): per stage time, attempts, hint level reached, per-seat idle time, pings per minute, quit stage.
- **Tuning targets:**

| Metric | Target |
|---|---|
| Stage completion with ≤ L1 hint | ≥ 60 % |
| L2 hint reached | < 50 % (else redesign) |
| Median chamber time, first try | 4–6 min |
| Max idle per seat per stage | < 30 s |
| Run completion | ≥ 70 % of started runs |
| Mute-mic team clear rate | ≥ voice-allowed rate × 0.8 |

---

## 14. Risks and open questions

| Risk | Mitigation |
|---|---|
| Quarterbacking by a strong player | Local fog and private information per chamber (§8 split rows); roles rotate; agency is split so you can only move *your* piece. |
| Kids feel slow or "carried" | Low-dexterity, high-meaning roles; Moments card names everyone's hero moment; no blame UI. |
| Griefing in stranger parties | Friends/class first; ping-only; mute seat; majority reset; AFK → companion; no vote-kick (by policy). |
| Mobile precision (mirrors, dials) | Brace mode, detents, fine-step buttons, generous tolerances (err ≤ 0.10, \|θ\| < 6°). |
| Server CPU per party | Pure modules are O(seats + bridges) per tick, the beam trace is ≤ 12 segments, and Fourier error is O(K). Negligible next to snapshot serialisation. |
| Desync of the visible state | Every outcome is server-side; `vault` full-state resync on stage change; `seq` gaps trigger a resync request. |
| iOS memory with chambers | One chamber scene loaded at a time, disposed on exit; no VRM for companions. |
| Session length rules (NĐ 147/2024, `RESEARCH.md` §5.4) | A run is ~15–20 min; breathing rooms are natural stop points; the checkpoint resume window is 30 min. |
| Physics honesty vs fun (catapult, tilt) | Use real formulas with game constants and state the constants in the Codex page. Never fake "more energy out". |
| Generated `.mjs` drifting from TS | Generator + staleness test in P0. |

**Open questions for the user or teacher:**
1. Should Quick Join ever match students from different classes, and if so, from which grade up?
2. Is a weekly rotation OK, or should all chambers be open once cleared?
3. May vault materials be shown in the museum, and may Theorem Fragments change the hub permanently?
4. Should the Siren weakness bonus ship with the MVP?

---

## Sources
- [P2-GD] Game Developer, "Synthesizing *Portal 2*" (Wolpaw: co-op rule, "here" problem, glyph pings): https://gamedeveloper.com/design/synthesizing-i-portal-2-i-
- [P2-PCG] PC Gamer, "Interview: Valve on their insane Portal 2 ideas": https://www.pcgamer.com/interview-valve-on-their-insane-portal-2-ideas
- [P2-GS] GameSpot, Portal 2 co-op hands-on (ping highlights buttons and portal spots): https://www.gamespot.com/articles/portal-2-co-op-hands-on/1100-6286739/
- [KTANE-GD] Game Developer, "Finding the fun in bomb defusal with *Keep Talking and Nobody Explodes*": https://gamedeveloper.com/design/finding-the-fun-in-bomb-defusal-with-i-keep-talking-and-nobody-explodes-i-
- [KTANE-GDC] GDC Vault, "Designing Asymmetric Gameplay For 'Keep Talking and Nobody Explodes'" (abstract): https://gdcvault.com/play/1023113/contactUs
- [HZ-80] 80.lv, "Hazelight Studios' working culture and approach to creating collaborative gameplay": https://80.lv/articles/hazelight-studios-working-culture-and-approach-to-creating-collaborative-gameplay
- [HZ-PS] "Designing for Two: A Conversation with Per Stenbeck of Hazelight Studios" *(community, university blog)*: https://blog.metu.edu.tr/gates/?p=2189
- [HZ-GDC] GDC session page, "Designing the Final Level of Split Fiction" (abstract only): https://schedule.gdconf.com/session/designing-the-final-level-of-split-fiction/917468
- [TW-GD] Game Developer, "*The Witness*: modeling epiphany": https://gamedeveloper.com/design/-i-the-witness-i-modeling-epiphany
- [TW-IC] Game Developer, "IndieCade: inside Jonathan Blow's puzzle design process": https://gamedeveloper.com/design/indiecade-inside-jonathan-blow-s-puzzle-design-process
- [BABA-GDC] GDC Vault, "Reading the Rules of 'Baba Is You'": https://gdcvault.com/play/1026590/Reading-the-Rules-of-Baba
- [BABA-RB] Red Bull, "Baba Is You creator on difficulty…" (reverse-engineering levels, designer blindness): https://www.redbull.com/ng-en/baba-is-you-interview
- [LOV-GD] Game Developer, "Co-op communication in *Lovers in a Dangerous Spacetime*": https://gamedeveloper.com/design/co-op-communication-in-i-lovers-in-a-dangerous-spacetime-i-
- [OC-GMTK] Game Maker's Toolkit, "How Overcooked's Kitchens Force You to Communicate" (subtitle page) *(community)*: https://amara.org/en-gb/videos/1kyGmzeQjsv6
- [OC-PLAY] PLAY magazine via PressReader, "Overcooked! dishes up a birthday feast": https://www.pressreader.com/australia/play-uk-1/20210921/284485756649452
- [SKY-GD] Game Developer, "Using emotion to drive social play in *Sky: Children of the Light*": https://gamedeveloper.com/design/using-emotion-to-drive-social-play-in-i-sky-children-of-the-light-i-
- [SKY-search] Game Informer review (wordless communication, candles): https://www.gameinformer.com/review/Sky-children-of-the-light/the-next-logical-leap
- [APEX-GD] Game Developer, "Respawn played with muted mics to get *Apex Legends*' smart comms system just right": https://gamedeveloper.com/design/respawn-played-with-muted-mics-to-get-i-apex-legends-i-smart-comms-system-just-right
- [APEX-GR] GamesRadar, "Respawn used fake names and disabled voice chat to test Apex Legends' ping system": https://www.gamesradar.com/respawn-used-fake-names-and-disabled-voice-chat-to-test-apex-legends-amazing-ping-system
- [GI-WIKI] Genshin Impact Wiki, Enemy level scaling / co-op multipliers *(community)*: https://genshin-impact.fandom.com/wiki/Enemy/Level_Scaling
- [GI-PCG] PC Gamer, "Genshin Impact's co-op multiplayer is too limited to be fun": https://www.pcgamer.com/genshin-impacts-co-op-multiplayer-is-too-limited-to-be-fun
- [PICO] PICO PARK on Steam: https://store.steampowered.com/app/1509960/PICO_PARK · Nintendo Life listing: https://www.nintendolife.com/games/switch-eshop/pico_park
- [MM] Magic Maze rules summary *(community)*: https://board-game.co.uk/?p=240414 · Rulebook PDF (not opened): https://www.play-in.com/pdf/rules_games/magic_maze_vf_rules_en.pdf
- [ST-GD] Game Developer, "Everybody Shake! The making of Spaceteam, chapter 1": https://www.gamedeveloper.com/design/everybody-shake-the-making-of-spaceteam-chapter-1-of-3
- [WWH-XB] Xbox Wire, "Co-op Puzzle Design for We Were Here Forever": https://news.xbox.com/en-us/?p=190237
- [WWH-GD] Game Developer, "Road to the IGF: Total Mayhem Games' *We Were Here*": https://www.gamedeveloper.com/game-platforms/road-to-the-igf-total-mayhem-games-i-we-were-here-i-
- [MG-IWATA] Iwata Asks, Super Mario Galaxy, "The Old Issue of Two Player Play": https://www.nintendo.co.uk/Iwata-Asks-Super-Mario-Galaxy/Volume-4-Shigeru-Miyamoto/1-The-Old-Issue-of-Two-Player-Play/1-The-Old-Issue-of-Two-Player-Play-220647.html
- [COOP-AGE] GameDev.net, "Designing for multi-age coop play" *(community)*: https://gamedev.net/tutorials/game-design/game-design-and-theory/designing-for-multi-age-coop-play-r4101
- [QB-MM] Meeple Mountain, "Benching the Quarterback: How to Deal with Alpha Players in Co-op Games" *(community)*: https://www.meeplemountain.com/articles/benching-the-quarterback-how-to-deal-with-alpha-players-in-co-op-games/
- [QB-JG] Justin Gary, "Why Cooperation Is Hard to Design" *(community)*: https://justingarydesign.substack.com/p/the-quarterback-problem
- [ER-12] The Codex, "12 rules for escape room puzzle design" *(community)*: https://thecodex.ca/12-rules-for-escape-room-puzzle-design/
- [ER-HINT] Room Escape Artist, "Escape room hint systems" *(community)*: https://roomescapeartist.com/2019/10/24/escape-room-hint-systems/
- [ER-NIC] Scott Nicholson, "Peeking behind the locked door: A survey of escape room facilities" (2015 white paper; cited via faculty page and coverage, not read in full): https://help.wlu.ca/academics/faculties/faculty-of-human-and-social-sciences/faculty-profiles/scott-nicholson/cool-jobs-escape-room.pdf · Red Bull interview: https://redbull.com/in-en/interview-with-dr-scott-nicholson
- [ER-CTU] CTU Prague, NI-ESC lecture "Escape room design": https://courses.fit.cvut.cz/NI-ESC/lectures/files/esc-room-design.pdf
- [PDC] Ron Gilbert, "Puzzle Dependency Charts" (Grumpy Gamer): https://grumpygamer.com/puzzle_dependency_charts · Thimbleweed Park charts: https://blog.thimbleweedpark.com/final_puzzles.html
- [PF] Sinha & Kapur (2021), "When Problem Solving Followed by Instruction Works: Evidence for Productive Failure", *Review of Educational Research* (record): https://ouci.dntb.gov.ua/works/4KnMgZq7
- *(prior)* Euler (1736) on the Königsberg bridges and the k-trail generalisation; Königsberg/Kaliningrad bridge history; Appel & Haken (1976) Four Colour Theorem and Kempe chains (1879); Ada Lovelace's 1843 notes on the Analytical Engine and music; Apollo lunar retroreflectors; Gibbs phenomenon (~9 % overshoot); MRSI artillery; kishōtenketsu level structure. Verify wording before quoting in Codex pages.
- In-repo: `WORLD_DESIGN.md`, `PLAN.md`, `RESEARCH.md` §5–6, `COMBAT_VFX_RESEARCH.md` §3.1–3.3, `SPELLS_ECOLOGY.md` §1, `TECH.md`; code verified in §1.
