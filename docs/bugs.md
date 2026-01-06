# Potential Bugs / Issues

## Open
- Missing tests for server/web flows (join/rejoin, waiting UI). `apps/server` `apps/web`

## Resolved
- Unit IDs can collide after combat removal because `addForcesToHex` uses `Object.keys(board.units).length + 1`; deletions shrink the count and reuse IDs, corrupting `units`/`occupants`. `packages/engine/src/units.ts:18`
- Combat can loop forever if both sides deal zero hits (e.g., hitFaces reduced to 0); `resolveBattleAtHex` has no stalemate/round guard. `packages/engine/src/combat.ts:165`
- Invalid actions still spend mana/gold; validation happens after costs are deducted, so bad inputs consume resources with no error. `packages/engine/src/action-flow.ts:62` `packages/engine/src/action-flow.ts:168`
- Market phase is skipped and action ordering is by seat index (not card initiative), diverging from spec and likely requiring refactor. `packages/engine/src/engine.ts:140` `packages/engine/src/action-flow.ts:35`
- Event logs are only used in tests; no production flow calls `emit`, so UI logs stay empty. `packages/engine/src/events.ts:1`
- Capital slot overrides in `DEFAULT_CONFIG` don’t match the corner-slot rules draft for 4–5 players; confirm if intentional. `packages/engine/src/config.ts:25` `rules_draft.md:76`
