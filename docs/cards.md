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

## Debug Card Browser
Use the web client to browse all registered cards without digging through files:
- Run the app and select the `Cards` tab in the top nav.
- Filter by age/deck, mana cost, type, and tags, and sort by initiative.
- This view reads from the engine registry (`CARD_DEFS`), so any edits in
  `packages/engine/src/content/cards/` appear immediately on reload.

## Card Art Generation (OpenAI)
Card art is generated via the CLI script at `scripts/generate-card-art.js`. The script uses
the OpenAI Images API by default and appends the card title to the end of the prompt so
your prompt always ends with the card name.

### API key setup
- Create an API key at `https://platform.openai.com/api-keys`.
- Provide it as an environment variable when running the script:
  - One-off: `OPENAI_API_KEY=sk-... node scripts/generate-card-art.js --deck age1 --count 5`
  - Shell profile: add `export OPENAI_API_KEY=sk-...` to `~/.zshrc` or `~/.bashrc`.

### Where images go
- Output directory: `apps/web/public/card-art`.
- Filenames are derived from the card title (safe characters only).
- By default the manifest is updated for single-image runs; use `--skip-manifest` if you plan
  to wire art manually later.

### Common commands
```bash
# Preview prompts without generating images.
OPENAI_API_KEY=sk-... node scripts/generate-card-art.js --deck age1 --count 5 --dry-run

# Generate 5 random Age I card arts, skip manifest updates.
OPENAI_API_KEY=sk-... node scripts/generate-card-art.js --deck age1 --count 5 --skip-manifest

# Generate a specific card by id.
OPENAI_API_KEY=sk-... node scripts/generate-card-art.js --cards age1.quick_march --skip-manifest
```

### Prompt tuning
- Base prompt text is in `scripts/generate-card-art.js` and can be overridden with
  `--prompt-prefix` or `--prompt-suffix`.
- The card title is always appended at the end of the prompt.

### Model / size
- Default model: `gpt-image-1.5` (override with `--model` or `OPENAI_IMAGE_MODEL`).
- Default size: `1024x1024` (override with `--size`).
