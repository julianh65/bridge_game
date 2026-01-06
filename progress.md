# Write down progess here, things implemented, blockers, etc. Use this as a living breathing context document for tasks and updated plans / things to be aware of.

## Docs alignment (spec/rules)
- Aligned `technical_spec.md` with `rules_draft.md`: added round/lead tracking, VP privacy in views, champion limit + cost scaling, round-cap tiebreaker, hand-limit overflow behavior, market preview mapping, and clarified market tie-break roll-off.
- Updated `rules_draft.md`: clarified initiative placeholders, fixed market preview mapping, and defined lead rotation.
- Fixed market preview round mapping in `rules_draft.md` (Age II rounds 6-7) and marked the task complete in `implementation_plan.md`.
- Clarified setup notes in `rules_draft.md` + `technical_spec.md`: seating order uses lobby assignment (no randomization yet), shared starter deck + faction spell/champion defaults, and champion starts in opening hand; marked plan item complete.
- Card defs in `technical_spec.md` now described as data-first TS modules with stable IDs, targetSpec, and effects/resolve rules.
- Added `docs/cards.md` with card data module editing guidelines.
- Updated board radius defaults (3-player radius 4) in `DEFAULT_CONFIG`, `technical_spec.md`, and `rules_draft.md`.
- Aligned board sizing/capital slots, tile counts, and mine value distribution across `rules_draft.md` + `technical_spec.md`.
- Set `VP_TO_WIN` to 10 across `rules_draft.md` + `technical_spec.md` (config already 10).
- Documented `VP_TO_WIN` default in `docs/configuration.md`.
- Added a coordination note to `agent_instructions.md` to emphasize planning/logging before coding.
- Clarified handling of other-agent changes in `agent_instructions.md` to avoid unnecessary escalation.
- Updated `implementation_plan.md` checkboxes to reflect current milestone status through Milestone 3.

## Active tasks
- [agent-1] Champion ability hooks: implement Bodyguard redirect, Flight movement override, and Assassin’s Edge pre-combat damage with tests. Files: `packages/engine/src/modifiers.ts`, `packages/engine/src/combat.ts`, `packages/engine/src/commands.ts`, `packages/engine/src/modifiers.test.ts` (status: claimed; implementation_plan update deferred until agent-4 frees `implementation_plan.md`)

## Bug audit progress
- Logged potential issues from the quick scan in `docs/bugs.md`.
- Fixed force unit id generation to avoid collisions and added coverage.
- Guarded combat resolution against no-hit stalemates and added a test.
- Added combat start/end event logs (with outcomes) and coverage.
- Wired event logs for phase transitions and action resolution so UI logs are populated.
- Logged setup actions (capital picks, starting bridges, free starting card) so UI logs show setup activity.
- Free starting card now uses a shared deck (offers without independent shuffles) and returns unchosen cards to the bottom.
- ActionPanel now allows “Done” submissions even when mana is 0.

## Faction passives progress
- Added Gatewright passives (capital assault + extortionists) and Veil clean-exit heal modifier with combat coverage; implementation plan update deferred until `implementation_plan.md` is free.

## Testing progress
- Added card draw tests covering reshuffle behavior and hand-limit overflow in `packages/engine/src/cards.test.ts`.
- Added tests for card instance id sequencing and random draw-pile insertion in `packages/engine/src/cards.test.ts`.
- Ran `npm test` (engine Vitest).
- Added Victory card gain VP coverage in `packages/engine/src/cards.test.ts`.
- Added collection-choice resolution tests (mine draft accept/decline, forge reforge, center pick) in `packages/engine/src/round-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts src/market.test.ts`.
- Added a smoke sim auto-resolve test in `packages/engine/src/smoke.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/smoke.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/market.test.ts`.
- Added a randomized smoke sim test that picks legal commands in `packages/engine/src/smoke.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/smoke.test.ts`.
- Added regression coverage for invalid card declarations not spending resources or removing cards in `packages/engine/src/action-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts` (invalid card regression coverage).
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts` (champion play/cost/limit coverage).
- Ran `npm run -w @bridgefront/engine test -- src/combat.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/modifiers.test.ts src/combat.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/cards.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/combat.test.ts src/setup-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/combat.test.ts src/round-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/combat.test.ts`.

## Docs maintenance
- Updated milestone checkboxes in `implementation_plan.md` to match current status.
- Converted Milestone 6.5 notes into checklist tasks and marked the market quick-bid UX item complete in `implementation_plan.md`.
- Added guidance to `agent_instructions.md` on reconciling other-agent/tooling changes.
- Updated `agent_instructions.md` to require logging task scope/files in `progress.md` before coding and clearing entries after completion.
- Added git hygiene guidance in `agent_instructions.md` to minimize user interruptions and preserve work.
- Audited `implementation_plan.md` and marked Milestone 5.5 interaction styling + Milestone 6 Market UI as complete.
- Added a Lobby polish item to `implementation_plan.md` for board preview + reroll (future work).
- Documented the new Cards debug view in `docs/cards.md`.
- Reprioritized setup UX into a new Milestone 4.5 (playtest unblock) in `implementation_plan.md`.
- Audited docs for stale items (implementation plan checkboxes, market preview naming/mapping, dev nav notes).
- Added Milestone 5.5 UI interaction + polish tasks (hand/board targeting/pan-zoom) to `implementation_plan.md`.
- Refreshed Milestones 5-6 checkboxes and noted partial UI polish status in `implementation_plan.md`.
- Marked the Milestone 8 smoke sim task complete in `implementation_plan.md`.
- Audited `rules_draft.md` alignment and logged follow-ups in `implementation_plan.md`.
- Expanded Milestone 5.5 layout tasks in `implementation_plan.md` with phase-focused subtasks.
- Marked Bastion Shield Wall faction passive as done in `implementation_plan.md`.

## Setup balance notes
- Reviewed setup placement logic and drafted balance ideas (symmetry/score-based placement, resource equity thresholds, default rule tweaks); pending decision.
- Added a capital-balance penalty to special-tile scoring to spread forges/mines more evenly across capitals.
- Added a global-spread score so mines/forges avoid clustering and reduce empty regions (notably 3-5 players).
- Increased mine counts by 1 per player count and updated mine value weights to make yield 3 more common.
- Added a low-probability mine value 7 weight in the default mine value distribution.

## Cleanup/organization progress
- Extracted setup flow helpers into `packages/engine/src/setup-flow.ts` so `engine.ts` stays orchestration-focused.
- Added card/deck helpers (`cards.ts`), unit helper (`units.ts`), and starter deck data (`content/starter-decks.ts`).
- Moved view construction (`buildView` + setup view helpers) into `packages/engine/src/view.ts` and updated exports.

## Cleanup/organization TODOs
none

## UI polish TODOs
- none

## UI polish progress
- Added hover tooltips for hexes, bridges, and unit stacks in the board view.
- Added a champion-target picker in the card detail panel to set unit targets from the board state.
- Tightened board panning drag threshold to avoid click misfires.
- Added soft bounds clamping on board pan/zoom so the map stays in view.
- Reworked the hand UI into a fan-style card row with hover zoom, selected highlighting, and disabled styling.
- Added valid-target overlays for board pick modes (hex highlights + edge previews) during action/card targeting.
- Added hover highlight styling for interactive hexes/edges and clickable preview edges for edge pick modes.
- Added touch/pinch support for board pan/zoom in the board view.
- Removed manual axial-coordinate inputs for action/setup bridge/march picks, added card hex target picking, and surfaced target summaries in the action panel.
- Added per-player action status tooltips on the player list in the game sidebar.
- Added lightweight motion for target highlights, preview bridges, selected cards, and card detail reveals.
- Added interaction state styling for board + controls (targeting outline, hex/bridge transitions, action-field active/error labels).
- Added phase status pills and an idle-phase callout, with phase-gated action/market/collection panels in the game sidebar.
- Moved the hand UI into a full-width bottom panel during the action phase and surfaced VP in the resources block.
- Added a collapsible GameScreen header with a compact HUD toggle for play sessions.

## Milestone 0 progress
- Workspace scaffolding created: `apps/` + `packages/`, root tsconfig refs, ESLint/Prettier configs, PartyKit config, and gitignore.
- `apps/web` Vite + React placeholder renders; `apps/server` PartyKit room echoes messages; `packages/engine` Vitest smoke test passes.
- Added `docs/dev.md` with local dev commands and hot reload notes.

## Milestone 1 progress
- Added deterministic RNG module in shared with `nextUint32`, `randInt`, `rollDie`, `shuffle`, plus Vitest coverage in engine.
- Added engine core types/config defaults plus skeleton entry points (`createNewGame`, `runUntilBlocked`, `applyCommand`, `buildView`) and a setup block test.
- Added shared hex utilities (axial neighbors, distance, radius generation, canonical edge keys) with engine tests and inlined shared for Vitest.
- Added board helpers for bridges/occupancy (two-player-per-hex checks) with unit tests.
- Added `emit` event log helper with a 200-event cap and tests.

## Milestone 2 progress
- Added base board generation (axial hex grid, center tile) and capital slot mapping with tests.
- Added setup flow blocks and commands for capital draft, starting bridges, and free starting card; setup now advances to `round.reset` with tests. Free starting card uses the configured card pool (now real card IDs).
- Added starting forces + starter deck initialization after capital draft (defaulting to Bastion if no faction chosen), with champion in hand and draw to 6 before starting bridges.
- Wired special tile placement into setup after capital draft (mines/forges now land on the game board with mine values assigned).
- Added procedural placement for forges/mines (including home mines) and mine values with deterministic tests.
- Board generation is now configurable via `DEFAULT_CONFIG` (radius, capital slots, placement rules). Added `docs/configuration.md`.
- Updated default 4-player capital slots in `DEFAULT_CONFIG`.
- Added pre-game lobby UI placeholders (ready up/start game, faction/settings stubs) in `apps/web` (local only).

## Milestone 3 progress
- Implemented round reset phase logic (income, mana reset, draw to 6 with hand-limit overflow) and wired `runUntilBlocked` to auto-advance into `round.market`.
- Added action step declarations block with basic actions (build bridge, march 1, capital reinforce), auto-advancing `round.market` -> `round.action`, plus tests.
- Round reset now rotates `leadSeatIndex` by round, with tests.
- Added combat resolution for contested non-capital hexes and sieges at end of action phase; `runUntilBlocked` now advances into `round.collection`.
- Added minimal collection (mine gold only) and phase advance into `round.scoring`, with tests.
- Implemented scoring (control VP + win/tiebreak), cleanup (discard/expire temp), and age update phases; round loop now advances to `round.reset`.

## Content system progress
- Added starter card data modules and a registry under `packages/engine/src/content/cards`.
- Added faction starter spells and champions data modules to the card registry.
- Added initial Age I market card stubs and wired the free starting card pool to real card IDs.
- Added Age I market cards using existing effects: Flank Step, Scavenger's Market, Supply Ledger, Patrol Record.
- Added card registry tests for unique IDs and starter/free-start coverage.
- Added an initial Age I market deck list export under `packages/engine/src/content/market-decks.ts`.
- Added market deck tests to validate ids are unique, registered, and age-appropriate.

## Debug UI progress
- Added local board inspector in `apps/web` with seed + player count controls and SVG rendering of capitals/forges/mines.
- Board inspector now labels special tiles (CAP/FORGE/MINE/CTR) on the hexes.
- Fixed hex fill styles so tiles render in their intended colors.
- Added dev-only room debug tools (state JSON fetch, advance phase, reset with seed) plus server debug commands for host-only use.

## Milestone 4 progress
- Added a game screen placeholder layout in `apps/web` (board area + sidebar stubs), no server wiring yet.
- Game screen now renders a preview board using the shared board view component (seeded example).
- Game screen now uses a sample engine state (auto-setup) and BoardView renders bridges/units.
- Implemented PartyKit room server with join/command handling, in-memory game state, revision bumping, and rejoin tokens (`apps/server/src/server.ts`).
- Added a PartyKit web client hook + Home screen for room join; Lobby/GameScreen now render from live `GameView` data with connection state, board, and logs.
- Added pre-game waiting panel in the web client and pruned disconnected lobby seats so stale entries do not block new joins.
- Documented PartyKit multi-tab behavior and cleaned up resolved issues; client now guards against null rejoin tokens.
- Added a basic action panel in the game sidebar with command wiring (done, capital reinforce, build bridge edge key, march from/to).
- Game sidebar now lists hand card IDs, deck counts, and a market row summary.
- GameView now includes hand card metadata, and the hand list shows card names alongside instance IDs.
- Game log list now formats key events into readable strings (setup/actions/combat/phase).
- Lobby now includes a room code copy control with clipboard fallback.
- Pre-game waiting panel now surfaces a room-code copy control for hosts before the lobby starts.
- Lobby now includes a shared dice roller (d6) with last-roll display and room-wide broadcast.
- Lobby map preview now rolls from the game seed and host can reroll the map during setup.
- Lobby map reroll now locks after the first capital pick (server guard).
- Replaced auto-start with host-controlled start, with a pre-game lobby snapshot + start button so up to 6 players can join before setup begins.
- Added a Cards debug tab with filters (age/deck, mana cost, type, tags) and initiative sorting.
- Polished the Cards tab layout for denser grids, deck accents, and compact rule previews.
- Refined Cards tab tag styling with tighter radius and centered labels.
- Game board now supports pan/zoom + reset view, with click selection/highlights for targeting.
- Hand cards are clickable to prefill card play inputs and show card details/target helpers.
- Action panel now supports board-pick buttons for bridge/march inputs and shows board pick mode.
- Player panel now surfaces lead player in the resources block.

## Milestone 4.5 progress
- Added a capital draft panel in the setup lobby that lists available slots, shows pick order/status, and submits `pickCapital` choices from the client.
- Capital draft map preview now shows numbered slot labels, and draft UI uses those labels with coord tooltips.
- Added a dev-only auto-setup command on the server (host-only) to auto-pick setup choices for faster testing.
- GameView now exposes setup block info (public setup payload + private free-card offers) to support setup UI.
- Added setup lobby UI for starting bridges (edge input + suggested edges + per-player status).
- Added setup lobby UI for free starting card picks (private offers + pick status).
- Added a host-only auto-setup button in the setup lobby.

## Milestone 5 progress
- Added action-step card declarations for no-target cards (gain gold/draw cards) with initiative-ordered resolution before basic actions; cards leave hand on declaration and discard/burn after resolution, plus Supply Cache coverage.
- Added Prospecting card effect handling (base + mine bonus gold) with action-flow tests.
- Added moveStack/buildBridge card effect support with target validation and action-flow tests (stack/path moves + temporary bridge).
- Added Bridge Crew support with edge + optional move path validation and coverage.
- Added champion-target card support (heal/damage/patch up) with action-flow tests (heal cap, capital bonus, bounty on kill).
- Added Recruit choice targeting (capital vs occupied hex) with effect handling and tests.
- Added Scout Report effect (deterministic top-card keep) using top-of-deck extraction + hand overflow handling with action-flow coverage.
- Added debug card-play inputs in the action panel to submit card declarations with optional targets JSON during the action phase.
- GameView now surfaces action-step eligible/waiting players, and the action panel lists waiting/submitted names.

## Milestone 6 progress
- Added market deck scaffolding per age with shuffle on game creation (Age II/III placeholders for now).
- Added market row prep using preview mapping + deck draws, plus cleanup resets to clear the row each round.
- Added market row tests covering preview composition and no-op behavior when a row exists.
- Market sidebar now shows card names and bid/pass status per player.
- Added market bid controls in the web client and wired `SubmitMarketBid` commands.
- Added quick bid buttons (1-4) in the Market panel to set common bid amounts faster.
- Implemented market bidding block (buy/pass, tie-break roll-offs, pass pot, one-win-per-round) with command handling + resolution, added market bidding tests, and updated setup/action tests to auto-resolve market.
- Added power deck scaffolding + init (currently seeded from market deck lists as a placeholder), and center picks now draw from power decks; updated collection resolution/tests accordingly.
- Added a collection sidebar panel that renders mine/forge/center prompts and submits `SubmitCollectionChoices` commands.
- Aligned the collection panel props with `GameScreen` and added collection prompt styles in `apps/web/src/styles.css`.
- Added market row reveal events and formatted market buy/pass logs in the UI.
- Victory cards now grant +1 permanent VP on gain (via draw pile insertion).

## Milestone 7 progress
- Implemented champion card play (hex targeting validation + deployment), champion gold cost scaling, and champion limit checks in engine with tests.
- Added champion HP details to board stack tooltips in the UI.
- Added Bastion Shield Wall passive as a permanent faction modifier, wired during setup, with setup/combat coverage.
- Added Prospect Ore Cut (mine gold +1) and Mine Militia (defender forces hit on 1-3 in mines) passives with combat/collection coverage.
- Added combat modifier query pipeline (force/champion stats + hit assignment policy), before/after combat hook dispatch, and coverage.
- Implemented modifier duration expiry (end-of-battle/end-of-round + uses consumption) with tests.
- Added `deployForces` and `increaseMineValue` card effect support for faction starter spells (Air Drop, Rich Veins) with action-flow coverage.
- Added Mine Overseer Extraction bonus (+1 mine gold while occupying a mine) with collection coverage.

## Open decisions
- Card data format confirmed: TypeScript data modules (data-first).

## Milestone 1 breakdown (proposed)
- Types + config constants (GameState, PlayerState, BoardState, MarketState, BlockState, GameEvent) + basic tests for shape invariants.
- Deterministic RNG module with tests (seeded, stable sequence).
- Hex + board utils (axial coords, distance, neighbors, HexKey/EdgeKey canonicalization) + tests.
- Board storage helpers (bridge/occupancy checks, two-player-per-hex) + tests.
- Engine entry points (createNewGame/applyCommand/runUntilBlocked/buildView) with a first "blocked on capital draft" integration test.

## Milestone 1a plan (agent-2)
- Select RNG algorithm (small, fast, deterministic; e.g., mulberry32) and define `RNGState` shape.
- Implement pure helpers in shared: `next(state)`, `randInt(state, min, max)`, `rollDie(state, sides)`, `shuffle(state, items)`.
- Export from shared package barrel for engine usage.
- Tests (Vitest in engine): fixed-seed sequences, bounds checks, shuffle is permutation + deterministic across runs.

## Milestone 1c plan (agent-2)
- Define axial coord types + canonical `HexKey`/`EdgeKey` helpers in shared.
- Implement `neighbors`, `distance`, `withinRadius` utilities.
- Export from shared barrel and add engine tests for determinism and adjacency invariants.

## Milestone 2a plan (agent-2)
- Implement base board generation: axial hex grid for radius, center tile at (0,0), empty occupants/bridges/units.
- Implement capital slot list per player count (corner slots; 5-player special slots).
- Tests: radius counts/center placement, slot mapping per player count, invalid counts handled.

## Milestone 2b plan (agent-1)
- Add setup block types/flow to engine: capital draft -> starting bridges -> free starting card -> advance to `round.reset`.
- Add setup command payloads for `SubmitSetupChoice` (pick capital, place starting bridge, pick free card), with validation and event logging.
- Wire `runUntilBlocked` to advance setup once inputs complete; minimal tests that step through setup with fixed seed.
