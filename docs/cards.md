# Card Data Guide

Card definitions live as TypeScript data modules so they are easy to edit without touching engine logic.
Stable IDs never change once published (example: `age2.focus_fire`).

## Location
- Store card defs under `packages/engine/src/content/cards/`.
- Export them from `packages/engine/src/content/cards/index.ts` (so the engine can register/lookup by id).
- Keep `packages/engine/src/content/starter-decks.ts` in sync with any starter/faction IDs.

## Required data fields
UI-facing fields must stay purely data:
- `name`
- `rulesText`
- `cost`
- `initiative`
- `type`
- `tags`
- `deck`

Core fields:
- `id` (stable string id; never change)
- `type` (Order / Spell / Victory / Champion)
- `deck` (starter / market age / power age)
- `cost: { mana: number; gold?: number }`
- `initiative: number`
- `burn: boolean`
- `targetSpec` (how to target; must be data)
- `effects?: EffectSpec[]` (data-first effect array)
- `resolve?: (ctx, state, card, targets) => void` (only for genuinely weird cards)

All card logic must call engine primitives via `ctx.fx.*`; card code must never mutate state directly.

## Champion fields
Champion cards include:
- `champion: { hp, attackDice, hitFaces, bounty, goldCostByChampionCount }`

## Example (starter card)
```ts
export const SUPPLY_CACHE: CardDef = {
  id: "starter.supply_cache",
  name: "Supply Cache",
  rulesText: "Gain +2 gold.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 2 }]
};
```

## Targeting
Targeting must live in `targetSpec`, not buried in code. Example shapes:
- `{ kind: "none" }`
- `{ kind: "hex", owner: "self", occupied: true, maxDistance: 2 }`
- `{ kind: "edge", requiresOccupiedEndpoint: true }`

## Effects vs resolve
Prefer `effects` arrays for anything expressible via engine primitives.
Only use `resolve` for truly odd cards that do not fit the effect system yet.
