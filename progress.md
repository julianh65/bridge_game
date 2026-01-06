# Write down progess here, things implemented, blockers, etc. Use this as a living breathing context document for tasks and updated plans / things to be aware of.

## Docs alignment (spec/rules)
- Aligned `technical_spec.md` with `rules_draft.md`: added round/lead tracking, VP privacy in views, champion limit + cost scaling, round-cap tiebreaker, hand-limit overflow behavior, market preview mapping, and clarified market tie-break roll-off.
- Updated `rules_draft.md`: clarified initiative placeholders, fixed market preview mapping, and defined lead rotation.
- Card defs in `technical_spec.md` now described as data-first TS modules with stable IDs, targetSpec, and effects/resolve rules.
- Added `docs/cards.md` with card data module editing guidelines.
- Updated board radius defaults (3-player radius 4) in `DEFAULT_CONFIG`, `technical_spec.md`, and `rules_draft.md`.
- Added a coordination note to `agent_instructions.md` to emphasize planning/logging before coding.
- Clarified handling of other-agent changes in `agent_instructions.md` to avoid unnecessary escalation.
- Updated `implementation_plan.md` checkboxes to reflect current milestone status through Milestone 3.

## Active tasks
- (none)
- [agent1] Implement action-step card declarations for no-target cards (Supply Cache) with initiative-ordered resolution + discard/burn handling; add tests. Files: `packages/engine/src/types.ts`, `packages/engine/src/action-flow.ts`, `packages/engine/src/cards.ts`, `packages/engine/src/card-effects.ts` (new), `packages/engine/src/action-flow.test.ts`. Status: in progress.

## Bug audit progress
- Logged potential issues from the quick scan in `docs/bugs.md`.
- Fixed force unit id generation to avoid collisions and added coverage.
- Guarded combat resolution against no-hit stalemates and added a test.
- Added combat start/end event logs (with outcomes) and coverage.
- Wired event logs for phase transitions and action resolution so UI logs are populated.
- Logged setup actions (capital picks, starting bridges, free starting card) so UI logs show setup activity.

## Testing progress
- Added card draw tests covering reshuffle behavior and hand-limit overflow in `packages/engine/src/cards.test.ts`.

## Docs maintenance
- Updated milestone checkboxes in `implementation_plan.md` to match current status.
- Added guidance to `agent_instructions.md` on reconciling other-agent/tooling changes.
- Updated `agent_instructions.md` to require logging task scope/files in `progress.md` before coding and clearing entries after completion.
- Added a Lobby polish item to `implementation_plan.md` for board preview + reroll (future work).

## Setup balance notes
- Reviewed setup placement logic and drafted balance ideas (symmetry/score-based placement, resource equity thresholds, default rule tweaks); pending decision.
- Added a capital-balance penalty to special-tile scoring to spread forges/mines more evenly across capitals.
- Added a global-spread score so mines/forges avoid clustering and reduce empty regions (notably 3-5 players).

## Cleanup/organization progress
- Extracted setup flow helpers into `packages/engine/src/setup-flow.ts` so `engine.ts` stays orchestration-focused.
- Added card/deck helpers (`cards.ts`), unit helper (`units.ts`), and starter deck data (`content/starter-decks.ts`).

## Cleanup/organization TODOs
- Consider moving view construction into `packages/engine/src/view.ts` if `buildView` grows.

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
- Added setup flow blocks and commands for capital draft, starting bridges, and free starting card; setup now advances to `round.reset` with tests. Free starting card uses a placeholder pool in config (to be replaced by real card defs/deck).
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
- Added card registry tests for unique IDs and starter/free-start coverage.
- Added an initial Age I market deck list export under `packages/engine/src/content/market-decks.ts`.
- Added market deck tests to validate ids are unique, registered, and age-appropriate.

## Debug UI progress
- Added local board inspector in `apps/web` with seed + player count controls and SVG rendering of capitals/forges/mines.
- Board inspector now labels special tiles (CAP/FORGE/MINE/CTR) on the hexes.
- Fixed hex fill styles so tiles render in their intended colors.

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
- Lobby now includes a room code copy control with clipboard fallback.

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
