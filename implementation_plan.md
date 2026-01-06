# Bridgefront Web MVP — Implementation Plan

This plan is organized by deliverable milestones with concrete acceptance criteria.
The aim is to reach “playable with friends” quickly while preserving a clean extension path.

---

## Milestone 0 — Repo scaffolding + dev ergonomics

### Tasks
- [x] Create repo structure.
- [x] Set up TypeScript project references (or workspace tsconfig).
- [x] Add formatting/linting (minimal): Prettier + ESLint.
- [x] Add basic test runner for engine (`vitest` preferred for TS).
- [x] Add a single shared `@bridgefront/shared` package for ids/hex/RNG utils.
- [x] Add dev scripts (web dev server, room server dev, tests).

### Acceptance criteria
- `apps/web` loads a blank page and compiles.
- `apps/server` runs a websocket room that echoes a message.
- `packages/engine` tests run in CI/local.

---

## Milestone 1 — Engine core skeleton (no UI logic yet)

### Tasks
- [x] Define the authoritative state types:
  - `GameState`, `PlayerState`, `BoardState`, `MarketState`, `Modifier`, `BlockState`, `GameEvent`
- [x] Implement deterministic RNG:
  - `rollDie()`, `shuffle()`, `randInt(min,max)`, etc.
- [x] Implement hex utilities:
  - axial coords, distance, neighbors, within-radius generation
- [x] Implement board storage helpers:
  - canonical EdgeKey
  - bridge existence checks
  - occupancy checks (“two-player-per-hex”)
- [x] Implement event log helper:
  - `emit(event)` appends and returns
- [x] Implement engine entry points:
  - `createNewGame(config, seed, lobbyPlayers)`
  - `applyCommand(state, cmd, playerId)`
  - `runUntilBlocked(state)`
  - `buildView(state, viewerPlayerId)`
- [x] Extracted view construction into `packages/engine/src/view.ts` for clarity.

### Acceptance criteria
- A single test creates a 2-player game state, runs `runUntilBlocked`, and ends blocked on the first setup input (capital draft).

---

## Milestone 1.5 — Early debug UI (local inspector)

### Tasks
- [x] Build a local-only debug UI in `apps/web` that renders a seeded board.
- [x] Show player count, radius, and capital slots, plus special tile placements.
- [x] Controls for seed + player count and a regenerate action.

### Acceptance criteria
- `apps/web` shows a deterministic board inspector without needing the server.

---

## Milestone 2 — Setup flow + procedural map

### Tasks
- [x] Implement capital slot logic per player count.
- [x] Make board generation rules configurable via `DEFAULT_CONFIG` (capital slots + placement rules).
- [x] Implement pre-game screen and logic, faction choosing, settings choosing (placeholders), a ready up and start game system.
- [x] Implement capital draft block and command:
  - `SubmitSetupChoice { kind: "pickCapital", hexKey }`
- [x] Implement procedural placement:
  - forges
  - mines + home mines
  - mine values
  - sanity check with rerolls
- [x] Implement starting units/resources/deck initialization:
  - starter deck instances
  - faction starter spell + faction champion instance
  - champion starts in hand, draw to 6
- [x] Implement starting bridges block:
  - `SubmitSetupChoice { kind: "placeStartingBridge", edgeKey }`
  - collect 2 per player, then commit
- [x] Implement free starting card:
  - reveal 3, prompt choose 1, insert random, return others to bottom


### Acceptance criteria
- With a fixed seed, setup produces a deterministic board.
- Setup completes without UI by submitting commands in tests.
- After setup, engine advances to Round 1 Reset automatically.

---

## Milestone 3 — Basic round loop without market/cards (to validate movement/combat)

Goal: get the board game “moving pieces and fighting” ASAP.

### Tasks
- [x] Implement phases (reset/action/sieges/collection/scoring/cleanup/ageUpdate):
  - reset -> action -> sieges -> collection -> scoring -> cleanup -> ageUpdate
- [x] Implement reset:
  - income, mana reset, draw to 6, enforce hand limit
- [x] Implement basic actions:
  - Build Bridge
  - March 1
  - Capital Reinforce
- [x] Implement move execution:
  - requires bridge by default
  - stop and battle on entering enemy-occupied non-capital
  - enforce two-player-per-hex
- [x] Implement battle resolution (random hit assignment):
  - combat rounds to death
  - champion hp + bounty
- [x] Implement siege resolution at end of action phase.
- [x] Implement collection minimal:
  - mines: take gold only (skip mine draft for now)
  - forges/center: no-op placeholder
- [x] Implement scoring:
  - compute control VP and total VP
  - win check
- [x] Implement cleanup:
  - discard hand
  - expire end-of-round modifiers
  - destroy temporary bridges

### Acceptance criteria
- Two players can:
  - build bridges
  - march into each other
  - trigger a battle immediately
  - run a siege at end of action phase
- No crashes across multiple rounds with random commands in tests.

---

## Milestone 4 — Multiplayer server + room protocol + minimal UI

### Tasks (server)
- [x] Implement PartyKit room server (host-controlled start; engine handles legality checks):
  - create room state
  - handle join (assign seat or spectator)
  - handle command messages -> apply to engine -> broadcast update
  - maintain revision and reject out-of-turn / invalid block commands (lightly)
- [x] Implement rejoin token:
  - generate per-seat token
  - store mapping in room memory
  - allow reclaiming seat on reconnect

### Tasks (web)
- [x] Implement Home + Lobby:
  - [x] create/join room UI
  - [x] seat list
  - [x] host-controlled start with pre-game lobby snapshot
- [x] Lobby polish:
  - [x] room code copy to clipboard
  - [x] board preview panel + reroll control
- [x] Implement Game Screen minimal:
  - [x] render board (SVG hexes)
  - [x] show units + bridges
  - [x] show resources and phase
  - [x] show log events as text

### Acceptance criteria
- Two browser tabs can join the same room and see shared state updates live.
- Clicking a “debug action” button (server command) changes state and both UIs update.

---

## Milestone 4.5 — Setup UX (playtest unblock)

Goal: allow two browsers to complete setup and reach the action phase quickly.

### Tasks (server)
- [x] Replace auto-start with host-controlled start (agent2 work).
- [x] Optional dev-only auto-setup command (server-side) for fast testing.

### Tasks (web)
- [x] Setup UI for `setup.capitalDraft`:
  - show available slots
  - submit pick
- [x] Setup UI for `setup.startingBridges`:
  - allow edge input or click to place bridges
  - show remaining bridges per player
- [x] Setup UI for `setup.freeStartingCardPick`:
  - show 3 offers
  - submit pick
- [x] Optional “Auto-setup” button (dev/testing) to submit valid choices.

### Acceptance criteria
- Two browsers can join a room, complete setup (manual or auto), and reach `round.action`.

---

## Milestone 5 — Action Step system + hand + playing starter cards

Goal: make the action phase match the rules: simultaneous declarations + initiative resolve.

### Tasks (engine)
- [x] Implement Action Steps:
  - block on `actionStep.declarations`
  - collect one declaration per eligible player
  - pay costs on declaration reveal (or on submit; choose one and stay consistent)
  - resolve cards by initiative, then basic actions by lead order
  - after each resolution, run immediate battle checks
- [x] Implement deck/hand operations:
  - draw with reshuffle
  - hand limit overflow goes to discard
- [x] Implement the first batch of starter cards using primitives:
  - Supply Cache (+2 gold)
  - March Orders (move stack up to 2 along bridges)
  - Scout Report (look top 3: put 1 into hand, discard 2) -> prompt required
  - Recruit (deploy forces) -> needs hex targeting prompt for “hex you occupy” option
  - Bridge Crew (build bridge then immediate move)

### Tasks (web)
- [x] Implement hand UI:
  - show your hand
  - click card -> shows required targets
  - submit play
- [x] Implement action step UI:
  - show “choose action” panel
  - show who has submitted this step
  - show “done” option

### Acceptance criteria
- Players can play cards from hand, see them resolve in initiative order, and see results on the board.
- Prompts appear and block resolution until answered.

---

## Milestone 5.5 — UI interaction + visual polish (web)

Goal: make the board + hand feel responsive, clear, and pleasant to use.

### Tasks (web)
- [x] Rework hand UI into a card row/fan with hover zoom, selected state, and disabled styling.
- [x] Add a card details panel with consistent layout (name, initiative, rules text, targets).
- [x] Implement target preview overlays for cards/actions: highlight valid hexes/edges/paths and current selection (current selection highlight in place; valid-target overlay pending).
- [x] Improve board hover/click interactions: hover highlight on hex/edge, click selects in pick mode, ignore clicks after pan.
- [ ] Add interaction state styling for board + controls (active/hover/selected/disabled/error).
- [ ] Add lightweight motion (card play, target highlight pulse, selection fade) to reduce the "debug UI" feel.
- [x] Add tooltips for hex stacks/bridges/units and per-player action status (hex/bridge/unit tooltips done).
- [ ] Clean up sidebar/board layout spacing and typography for readability.
- [ ] Improve UI such that it's very clear which phase of the game we are in and what's happening. Show and hide relevant information / modals depending on the phase / what is going on. Not all the info panels should live on the right hand side. For example the cards / hand should be visible during those phases and be large and on the bottom. And so on and so forth. Use your best judgement while doing this tasks to add more tasks below that will streamline and make the UI clean and make sense. Then do one of the tasks and return.


### Tasks (web - pan/zoom)
- [x] Fix world-to-screen coordinate transforms so picks stay accurate under zoom.
- [x] Make wheel zoom anchor to cursor; clamp zoom levels; keep board in view with soft bounds.
- [x] Improve drag panning (ignore clicks after drag threshold) and add touch/pinch support.
- [x] Add "fit board" view reset that works across screen sizes and on resize.

### Acceptance criteria
- Hand is presented as actual cards (not a list), with clear playable/selected states and readable text.
- Selecting a card or action highlights only legal targets and updates as you hover/click.
- Board clicks are reliable at all zoom levels; panning and selection do not conflict.
- Pan/zoom feels stable: wheel zoom anchors to cursor, drag does not mis-select, reset view recenters.

---

## Milestone 6 — Market phase + collection prompts + power deck

### Tasks (engine)
- [x] Implement market reveal with preview count per round (config-driven mapping).
- [x] Implement bid collection block:
  - accept buy/pass bids
  - resolve with tie-break roll-offs
  - enforce “one market win per round”
  - implement pass pot logic
- [x] Implement gain-card insertion random into draw pile.
- [x] Implement collection prompts:
  - mines: gold or mine draft (reveal 1 market card -> choose gain or not)
  - forges: reforge (scrap 1) or forge draft (reveal 3 -> gain 1)
  - center: power pick (reveal 2 -> gain 1; currently drawn from market deck until power decks land)

### Tasks (web)
- [ ] Market UI:
  - [x] show row cards
  - [x] for current card, show bid controls
  - [x] show reveal + results in log
- [x] Collection UI:
  - [x] present tile-based choices and resolve prompts
- [x] Remove / replace all the hard to use panels that require users to enter axial coords.

### Acceptance criteria
- A full round runs with:
  - reset -> market -> action -> sieges -> collection -> scoring -> cleanup
- Market and collection blocks prevent progress until all required players respond.

---

## Milestone 7 — Factions + champions + modifiers (core “exceptions” framework)

### Tasks (engine)
- [x] Do a quick align on rules_draft to remaining implementation plan
- Implement `modifiers` with:
  - duration expiry
  - query application pipeline
  - event trigger dispatch
- Implement faction passives as permanent modifiers:
  - Bastion Shield Wall
  - Prospect Ore Cut / Mine Militia
  - etc. (start with 1–2 factions but first double check the rules from rules_draft)
- Implement champions:
  - [x] play champion card => spawn champion unit
  - [x] champion gold cost scaling by “nth champion currently controlled”
  - [x] champion limit
  - [x] champion cards always burn after play
- Implement a few champion abilities using hooks:
  - Bodyguard redirect
  - Flight movement permission override
  - “before combat round 1” damage effect (Assassin’s Edge)

### Tasks (web)
- Champion UI:
  - [x] display champion hp
  - [ ] show ability usage counters (optional)
- Add simple “effect badges” on hexes/edges for attached modifiers (optional)

### Acceptance criteria
- At least one faction passive changes combat outcome in the expected situations.
- A champion can be deployed, take damage, die, pay bounty, and be removed.

## Milestone 7.5 — Script to Generate Art for Cards

I want to have a script that lets me select a subset of n cards and hits some sort of API to generate epic card art for them, saves it locally and then makes the card reference that image so it gets rendered somehow. Very TBD on this so we'll have to figure it out together, which services to use and how it works etc...

---

## Milestone 7.6 — Rules alignment review

Pause and read through the rules of the game. Make sure that what we've done aligns as much as possible. Add any tasks below to fix things that don't.

### Tasks
- [ ] Resolve board sizing + capital slot mapping across `rules_draft.md`, `technical_spec.md`, and `DEFAULT_CONFIG` (radius + slots per player count).
- [ ] Align special tile counts across rules/spec/config (mines/forges/center per player count).
- [ ] Align mine value distribution across rules/spec/config (values + weights, including current 3/7 entries).
- [ ] Decide `VP_TO_WIN` target and update rules/spec/config (currently 8? vs 10).
- [ ] Clarify setup TODOs: seating order randomization, faction-specific starter deck vs shared, champion in opening hand.
- [x] Fix market preview round mapping typo in rules (Age II Round 6 preview count).


## Milestone 8 — Content expansion + stability pass

### Tasks
- Add a structured workflow for adding cards:
  - card def file
  - minimal tests per card
- Expand Age I market cards first (the ones that touch your most-used primitives).
  - [x] Added Flank Step, Scavenger's Market, Supply Ledger, Patrol Record (existing effects only).
- [x] Add “smoke sim” tests:
  - random legal commands for N steps should not crash
- Add dev-only debug tools:
  - show full state JSON
  - force advance to next phase
  - seed controls

### Acceptance criteria
- 2–4 friends can play a complete game session without needing a restart.
- Adding a new card usually requires:
  - adding a CardDef
  - (sometimes) adding a modifier
  - rarely adding a new query/hook/event

---
