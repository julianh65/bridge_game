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
- [ ] Implement pre-game screen and logic, faction choosing, settings choosing (leave these blank / placeholder for now), a ready up and start game system
- [x] Implement capital draft block and command:
  - `SubmitSetupChoice { kind: "pickCapital", hexKey }`
- [x] Implement procedural placement:
  - forges
  - mines + home mines
  - mine values
  - sanity check with rerolls
- [ ] Implement starting units/resources/deck initialization:
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
- Implement phases:
  - reset -> action -> sieges -> collection -> scoring -> cleanup -> ageUpdate
- Implement reset:
  - income, mana reset, draw to 6, enforce hand limit
- Implement basic actions:
  - Build Bridge
  - March 1
  - Capital Reinforce
- Implement move execution:
  - requires bridge by default
  - stop and battle on entering enemy-occupied non-capital
  - enforce two-player-per-hex
- Implement battle resolution (random hit assignment):
  - combat rounds to death
  - champion hp + bounty
- Implement siege resolution at end of action phase.
- Implement collection minimal:
  - mines: take gold only (skip mine draft for now)
  - forges/center: no-op placeholder
- Implement scoring:
  - compute control VP and total VP
  - win check
- Implement cleanup:
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
- Implement PartyKit room server:
  - create room state
  - handle join (assign seat or spectator)
  - handle command messages -> apply to engine -> broadcast update
  - maintain revision and reject out-of-turn / invalid block commands (lightly)
- Implement rejoin token:
  - generate per-seat token
  - store mapping in room memory
  - allow reclaiming seat on reconnect

### Tasks (web)
- Implement Home + Lobby:
  - create/join room UI
  - seat list + ready/start game
- Implement Game Screen minimal:
  - render board (SVG hexes)
  - show units + bridges
  - show resources and phase
  - show log events as text

### Acceptance criteria
- Two browser tabs can join the same room and see shared state updates live.
- Clicking a “debug action” button (server command) changes state and both UIs update.

---

## Milestone 5 — Action Step system + hand + playing starter cards

Goal: make the action phase match the rules: simultaneous declarations + initiative resolve.

### Tasks (engine)
- Implement Action Steps:
  - block on `actionStep.declarations`
  - collect one declaration per eligible player
  - pay costs on declaration reveal (or on submit; choose one and stay consistent)
  - resolve cards by initiative, then basic actions by lead order
  - after each resolution, run immediate battle checks
- Implement deck/hand operations:
  - draw with reshuffle
  - hand limit overflow goes to discard
- Implement the first batch of starter cards using primitives:
  - Supply Cache (+2 gold)
  - March Orders (move stack up to 2 along bridges)
  - Scout Report (look top 3: put 1 into hand, discard 2) -> prompt required
  - Recruit (deploy forces) -> needs hex targeting prompt for “hex you occupy” option
  - Bridge Crew (build bridge then immediate move)

### Tasks (web)
- Implement hand UI:
  - show your hand
  - click card -> shows required targets
  - submit play
- Implement action step UI:
  - show “choose action” panel
  - show who has submitted this step
  - show “done” option

### Acceptance criteria
- Players can play cards from hand, see them resolve in initiative order, and see results on the board.
- Prompts appear and block resolution until answered.

---

## Milestone 6 — Market phase + collection prompts + power deck

### Tasks (engine)
- Implement market reveal with preview count per round (config-driven mapping).
- Implement bid collection block:
  - accept buy/pass bids
  - resolve with tie-break roll-offs
  - enforce “one market win per round”
  - implement pass pot logic
- Implement gain-card insertion random into draw pile.
- Implement collection prompts:
  - mines: gold or mine draft (reveal 1 market card -> choose gain or not)
  - forges: reforge (scrap 1) or forge draft (reveal 3 -> gain 1)
  - center: power pick (reveal 2 -> gain 1)

### Tasks (web)
- Market UI:
  - show row cards
  - for current card, show bid controls
  - show reveal + results in log
- Collection UI:
  - present tile-based choices and resolve prompts

### Acceptance criteria
- A full round runs with:
  - reset -> market -> action -> sieges -> collection -> scoring -> cleanup
- Market and collection blocks prevent progress until all required players respond.

---

## Milestone 7 — Factions + champions + modifiers (core “exceptions” framework)

### Tasks (engine)
- Implement `modifiers` with:
  - duration expiry
  - query application pipeline
  - event trigger dispatch
- Implement faction passives as permanent modifiers:
  - Bastion Shield Wall
  - Prospect Ore Cut / Mine Militia
  - etc. (start with 1–2 factions)
- Implement champions:
  - play champion card => spawn champion unit
  - champion gold cost scaling by “nth champion currently controlled”
  - champion limit
  - champion cards always burn after play
- Implement a few champion abilities using hooks:
  - Bodyguard redirect
  - Flight movement permission override
  - “before combat round 1” damage effect (Assassin’s Edge)

### Tasks (web)
- Champion UI:
  - display champion hp
  - show ability usage counters (optional)
- Add simple “effect badges” on hexes/edges for attached modifiers (optional)

### Acceptance criteria
- At least one faction passive changes combat outcome in the expected situations.
- A champion can be deployed, take damage, die, pay bounty, and be removed.

---

## Milestone 8 — Content expansion + stability pass

### Tasks
- Add a structured workflow for adding cards:
  - card def file
  - minimal tests per card
- Expand Age I market cards first (the ones that touch your most-used primitives).
- Add “smoke sim” tests:
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
