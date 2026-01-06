# Write down progess here, things implemented, blockers, etc. Use this as a living breathing context document for tasks and updated plans / things to be aware of.

## Docs alignment (spec/rules)
- Aligned `technical_spec.md` with `rules_draft.md`: added round/lead tracking, VP privacy in views, champion limit + cost scaling, round-cap tiebreaker, hand-limit overflow behavior, market preview mapping, and clarified market tie-break roll-off.
- Updated `rules_draft.md`: clarified initiative placeholders, fixed market preview mapping, and defined lead rotation.
- Card defs in `technical_spec.md` now described as data-first TS modules with stable IDs, targetSpec, and effects/resolve rules.

## Active tasks
- owner: agent-2; scope: Milestone 2c procedural placement (forges/mines + mine values); files: packages/engine/src/board-generation.ts, packages/engine/src/board-generation.test.ts, packages/engine/src/index.ts; status: completed
- owner: agent-1; scope: Milestone 2b setup flow blocks + setup commands (capital draft/starting bridges/free starting card); files: packages/engine/src/engine.ts, packages/engine/src/types.ts, packages/engine/src/index.test.ts; status: in_progress; dependency: board generation outputs/capital slots, card data for free starting card

## Milestone 0 progress
- Workspace scaffolding created: `apps/` + `packages/`, root tsconfig refs, ESLint/Prettier configs, PartyKit config, and gitignore.
- `apps/web` Vite + React placeholder renders; `apps/server` PartyKit room echoes messages; `packages/engine` Vitest smoke test passes.

## Milestone 1 progress
- Added deterministic RNG module in shared with `nextUint32`, `randInt`, `rollDie`, `shuffle`, plus Vitest coverage in engine.
- Added engine core types/config defaults plus skeleton entry points (`createNewGame`, `runUntilBlocked`, `applyCommand`, `buildView`) and a setup block test.
- Added shared hex utilities (axial neighbors, distance, radius generation, canonical edge keys) with engine tests and inlined shared for Vitest.
- Added board helpers for bridges/occupancy (two-player-per-hex checks) with unit tests.

## Milestone 2 progress
- Added base board generation (axial hex grid, center tile) and capital slot mapping with tests.
- Added procedural placement for forges/mines (including home mines) and mine values with deterministic tests.

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
