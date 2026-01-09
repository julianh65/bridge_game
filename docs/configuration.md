# Configuration Guide

This project keeps gameplay tuning in `packages/engine/src/config.ts` as `DEFAULT_CONFIG`.
Edit that file to adjust rules and regenerate the board in the debug UI.

## Key config sections

### Victory condition
- `VP_TO_WIN`: total VP required to win at the end of scoring (default 10).

### Hand draw size
- `HAND_DRAW_SIZE`: target hand size when drawing at round start and during setup (default 6).

### Action reveal timing
- `ACTION_REVEAL_DURATION_MS`: how long the action reveal overlay stays on screen (milliseconds).
- `ACTION_REVEAL_HIGHLIGHT_PAUSE_MS`: how long board highlights linger after the overlay fades (milliseconds).

### Market roll-off timing
- `MARKET_ROLLOFF_DURATION_MS`: how long each roll-off die roll animates in the market overlay (milliseconds).

### Combat overlay timing
- `COMBAT_ROLL_LOCK_MS`: delay before dice lock after a roll starts (milliseconds).
- `COMBAT_ROLL_ASSIGN_MS`: delay before hit assignment visuals appear (milliseconds).
- `COMBAT_ROLL_DONE_MS`: delay before a combat round is considered resolved (milliseconds).
- `COMBAT_AUTO_CLOSE_MS`: delay before the combat overlay auto-closes after resolution (milliseconds).

### Basic action order
- `basicActionFactionOrder`: faction IDs in the order their basic actions resolve (earlier = faster).
  - Factions not listed resolve after the listed ones, using lead order as the tie-break.

Example:
```ts
basicActionFactionOrder: ["bastion", "veil", "aerial", "prospect", "cipher", "gatewright"]
```

### Board size and capitals
- `boardRadiusByPlayerCount`: radius per player count.
- `capitalSlotsByPlayerCount`: explicit `HexKey` lists for each player count.
  - `HexKey` format is `"q,r"` (axial coordinates).
  - Make sure each slot is within the board radius and that you provide exactly
    one slot per player.

Example:
```ts
capitalSlotsByPlayerCount: {
  2: ["3,0", "-3,0"],
  3: ["4,0", "-4,4", "0,-4"]
}
```

### Tile counts
- `tileCountsByPlayerCount`: per-player counts for mines, forges, center, and random bridges.
- `randomBridges`: number of neutral bridges placed after special tiles are generated.

Example:
```ts
tileCountsByPlayerCount: {
  2: { mines: 4, forges: 1, center: 1, randomBridges: 6 }
}
```

### Special tile placement rules
`boardGenerationRules` controls how forges and mines are placed:
- `minDistanceFromCapital`: minimum distance from any capital for special tiles.
- `forgeDistanceFromCenter`: allowed distances from center for forge candidates.
- `mineDistanceFromCenter`: allowed distances from center for remaining mines.
- `homeMineDistanceFromCapital`: exact distance from the owning capital.
- `homeMineMinDistanceFromOtherCapitals`: minimum distance from other capitals.
- `minForgeSpacing` / `minMineSpacing`: optional minimum spacing between same-type tiles.
  - Use `0` to disable strict spacing (only heuristic spread).
- `maxAttempts` / `topK`: retries and spread heuristic breadth.
- `mineValueWeights`: weighted mine values.

Example:
```ts
boardGenerationRules: {
  minDistanceFromCapital: 2,
  forgeDistanceFromCenter: [2, 3],
  mineDistanceFromCenter: [2],
  homeMineDistanceFromCapital: 2,
  homeMineMinDistanceFromOtherCapitals: 2,
  minForgeSpacing: 0,
  minMineSpacing: 0,
  maxAttempts: 50,
  topK: 5,
  mineValueWeights: [
    { value: 3, weight: 25 },
    { value: 4, weight: 35 },
    { value: 5, weight: 25 },
    { value: 6, weight: 10 },
    { value: 7, weight: 5 }
  ]
}
```

## Where this is used
- The early debug UI in `apps/web` reads `DEFAULT_CONFIG` to render the board.
- The engine uses the same config when setting up a new game.
