# Bridgefront Web MVP — Technical Specification

## 1. Purpose

This document specifies the architecture and implementation details for the Bridgefront web MVP:
- Multiplayer, room-based play (2–6 players).
- Server-authoritative rules engine.
- Real-time UI updates (cards played, moves, battles, drafting).
- A rules/effects system that stays flexible as new cards/factions/mechanics are added.

Primary goal: a playable MVP that is easy to extend.

Non-goals for MVP:
- Hard security (anti-cheat, strict info hiding). Basic UX hiding is still desirable.
- Production-grade matchmaking or matchmaking queues.
- Perfect animation polish or super-optimized bandwidth.

---

## 2. Tech Stack

### 2.1 Recommended stack
- Language: TypeScript (shared across client/server/engine)
- Frontend: React + Vite
- Rendering: SVG (initially), optionally Canvas later
- Multiplayer server: PartyKit room server (WebSockets, “room = stateful instance” model)
- Hosting:
  - Frontend: Cloudflare Pages
  - Rooms/server: PartyKit deployment
- Persistence: Room snapshot + event log stored in room storage (optional for MVP; recommended early)

### 2.2 Key design principles
- “Rules as pure functions” wherever possible.
- Commands in, events out.
- Deterministic randomness via seeded PRNG.
- Effects implemented via modifiers + event triggers (minimal branching in core engine).

---

## 4. Data Model

All authoritative state must be serializable JSON.

### 4.1 Identifiers
- `PlayerID`: string (stable per seat)
- `ConnID`: string (websocket connection)
- `CardID`: string (e.g., "age1.quick_march")
- `CardInstanceID`: string (unique per copy in a deck)
- `UnitID`: string (unique per unit/champion instance)
- `HexKey`: string "q,r"
- `EdgeKey`: string "hexA|hexB" (canonical: sorted endpoints)

### 4.2 Core types (high-level)

#### GameConfig
Values that may change during tuning should live in config:
- `MAX_MANA` (default 5)
- `START_GOLD` (default 4)
- `BASE_INCOME` (default 1)
- `HAND_LIMIT` (default 10)
- `CHAMPION_LIMIT` (default 4)
- `ROUNDS_MAX` (default 10)
- `VP_TO_WIN` (default 8; tune)
- `boardRadiusByPlayerCount`: {2:4, 3:4, 4:5, 5:5, 6:5}
- `tileCountsByPlayerCount` for Mines/Forges/Center
- `ageByRound` mapping (1–3 Age I, 4–7 Age II, 8–10 Age III)
- Market preview mapping by round (config-driven; see §8.4)

#### GameState
Minimum required fields:

- `config: GameConfig`
- `seed: number` (or string) and `rngState: RNGState`
- `revision: number` (increments every change)
- `createdAt: number`
- `players: PlayerState[]` (seat order)
- `round: number`
- `leadSeatIndex: number` (rotates each round; used for basic action resolution)
- `phase: PhaseState`
- `board: BoardState`
- `market: MarketState`
- `logs: GameEvent[]` (bounded list for UI; full log optional)
- `modifiers: Modifier[]` (temporary/permanent rule modifiers)
- `blocks?: BlockState` (what the engine is waiting on; if any)

#### PlayerState
- `id: PlayerID`
- `name: string`
- `seatIndex: number`
- `factionId: string`
- `resources: { gold: number; mana: number }`
- `vp: { permanent: number }` (control is computed)
- `doneThisRound: boolean`
- `deck: DeckState`
- `burned: CardInstanceID[]`
- `flags: Record<string, any>` (small per-player toggles, e.g. once-per-round usage)
- `visibility: { connected: boolean }` (server-maintained)

#### DeckState
- `drawPile: CardInstanceID[]`
- `discardPile: CardInstanceID[]`
- `hand: CardInstanceID[]`
- `scrapped: CardInstanceID[]` (removed permanently)

Notes:
- `CardInstanceID` is the only thing stored in piles/hand.
- A separate `cardsByInstanceId` dictionary stores card metadata per instance.

#### BoardState
- `radius: number`
- `hexes: Record<HexKey, HexState>`
- `bridges: Record<EdgeKey, BridgeState>`
- `units: Record<UnitID, UnitState>` (location is in the unit, plus per-hex index)

#### HexState
- `key: HexKey`
- `tile: TileType` ("normal" | "capital" | "center" | "mine" | "forge")
- `ownerPlayerId?: PlayerID` (for capitals)
- `mineValue?: number` (for mine tiles)
- `occupants: { [playerId: string]: UnitID[] }` (index for fast queries)

#### UnitState
Two kinds:
- Force:
  - `id`, `ownerPlayerId`, `kind: "force"`, `hex: HexKey`
- Champion:
  - `id`, `ownerPlayerId`, `kind: "champion"`, `hex: HexKey`
  - `cardDefId: string` (which champion card)
  - `hp: number`, `maxHp: number`
  - `attackDice: number`
  - `hitFaces: number` (hits on 1..hitFaces)
  - `bounty: number`
  - `abilityUses: Record<string, UseCounter>` (for 1/round, 1/battle)

#### MarketState
- `age: "I" | "II" | "III"`
- `currentRow: MarketRowCard[]` length = playerCount
- `rowIndexResolving: number` (0..P-1)
- `passPot: number`
- `bids: Record<PlayerID, Bid | null>` (for the currently resolving card)
- `playersOut: Record<PlayerID, boolean>` (after winning a market card this round)

#### Modifier
A modifier is an attached effect that can:
- change a rule query (e.g., hit faces, movement permission)
- react to events (e.g., gain gold when champion dies)

Fields:
- `id: string`
- `source: { type: "faction" | "card" | "champion"; sourceId: string }`
- `ownerPlayerId?: PlayerID`
- `attachedHex?: HexKey`
- `attachedEdge?: EdgeKey`
- `duration: Duration`
- `data?: any` (for small state like “used”)
- `hooks?: HookSpec` (see §7)

#### BlockState
The engine stops when waiting for player input. A block describes:
- what input is required
- from which players
- what payload schema
- any UI metadata required to render choices

Examples:
- `setup.capitalDraft`
- `setup.startingBridges`
- `setup.freeStartingCardPick`
- `market.bidsForCard`
- `actionStep.declarations`
- `prompt.chooseOneCard`
- `collection.choices`

---

## 5. Network Protocol (WebSocket)

The network layer transports Commands from clients and broadcasts Views + Events.

### 5.1 Client → Server messages
All messages are JSON.

- `join`:
  - `{ type: "join", name: string, rejoinToken?: string, asSpectator?: boolean }`

- `command`:
  - `{ type: "command", playerId: PlayerID, clientSeq: number, command: Command }`

- `pong` (optional)
- `leave` (optional)

### 5.2 Server → Client messages
- `welcome`:
  - `{ type: "welcome", playerId, seatIndex, rejoinToken, view: GameView }`

- `update`:
  - `{ type: "update", revision, events: GameEvent[], view: GameView }`

- `error`:
  - `{ type: "error", message: string }`

### 5.3 GameView (what clients receive)
Even if strict secrecy isn’t a priority, client UX is easier with a per-player view.

`GameView` contains:
- `public`: everything safe/visible for all
  - board tiles, bridges, units, gold counts, mana counts, round/phase, market row (revealed), event log
  - does NOT include opponents' VP
- `private`: only for the receiving player
  - their hand, their deck/discard sizes, their VP (permanent/control/total), any secret bids before reveal, their pending prompts

Implementation approach:
- The server stores full authoritative `GameState`.
- For each connection, compute `GameView = buildView(state, viewerPlayerId)`.

---

## 6. Engine Architecture

### 6.1 Command/Event flow
- Client sends `Command`.
- Server calls `engine.applyCommand(state, command, playerId)`:
  - validates legality (lightweight)
  - mutates or produces next state
  - emits `GameEvent[]`
- Then server calls `engine.runUntilBlocked(state)`:
  - advances deterministic steps until input is needed
  - emits more events
- Server broadcasts `update` with events + new view.

### 6.2 Deterministic randomness
All randomness must come from `RNGState` stored in `GameState`:
- dice rolls
- random insertion into draw pile
- shuffles
- random tie-breaks
- random hit assignment
- random mine values / procedural placement
- random assignment during pass-bid resolution pools

Never call `Math.random()` in engine code.

---

## 7. Rules Extension System (Modifiers + Hooks)

### 7.1 Rule queries
Core engine must never hardcode “special cases” by card/faction id.
Instead, it asks queries and applies modifiers.

Key queries (MVP set):
- Combat:
  - `getForceHitFaces(ctx, base=2) -> number`
  - `getChampionAttackDice(ctx, base) -> number`
  - `getChampionHitFaces(ctx, base) -> number`
  - `getHitAssignmentPolicy(ctx) -> "random" | "attackerChooses" | "forcesFirst" | "championsFirst"`
  - `beforeCombatRound(ctx) -> void` (event-driven trigger)
  - `afterBattle(ctx) -> void` (event-driven trigger)
- Targeting:
  - `canTargetUnit(ctx) -> boolean` (e.g., Ward)
- Movement/Bridges:
  - `canTraverseEdge(ctx, base) -> boolean`
  - `requiresBridgeForMove(ctx, base=true) -> boolean`
  - `canBuildBridge(ctx, base) -> boolean`
  - `canDestroyBridge(ctx, base) -> boolean`
- Economy/Collection:
  - `modifyMineGold(ctx, base) -> number`
- Costs:
  - `modifyCardCost(ctx, cost) -> cost`

### 7.2 Events (triggers)
Engine emits events as it resolves gameplay. Modifiers may react.

Examples:
- `CardPlayed`, `CardFizzled`, `CardResolved`
- `BridgeBuilt`, `BridgeDestroyed`, `EdgeCrossed`
- `BattleStarted`, `CombatRoundRolled`, `HitsAssigned`, `UnitsDied`, `BattleEnded`
- `ChampionKilled`
- `TileCollected`
- `PhaseChanged`

### 7.3 HookSpec
Each modifier may implement:
- query modifiers: `(ctx, current) => newValue`
- event triggers: `(ctx, event) => sideEffects` (through engine API)

Important: modifier hooks operate through engine APIs that add events and mutate state; they should not directly reach into state arbitrarily.

### 7.4 Durations
Durations must support:
- `permanent`
- `endOfRound`
- `endOfBattle`
- `uses` (e.g., once per round)
- `untilTriggered` (optional future)

---

## 8. Core Gameplay Implementation (per rules)

### 8.1 Phase model
Phases (top-level):
- `setup`
- `round.reset`
- `round.market`
- `round.action`
- `round.sieges`
- `round.collection`
- `round.scoring`
- `round.cleanup`
- `round.ageUpdate`

The engine advances phases automatically via `runUntilBlocked()`.

### 8.2 Setup
Setup steps:
1. Create board for player count:
   - set radius
   - compute all hex keys within radius
   - place center at (0,0)
2. Assign capital slots available (per player count). Capital draft:
   - block: `setup.capitalDraft`
   - in reverse seating order, each chooses a slot
3. Procedural placement:
   - place forges (count by P)
   - place mines (count by P), including “home mines”
   - assign mine values with probability (4/5/6 = 50/30/20)
   - sanity check distances to mines; reroll if too unfair
4. Starting units:
   - each player begins with 4 forces in their capital
5. Starting resources:
   - gold = START_GOLD
6. Deck setup:
   - common starter deck + faction starter spell + faction champion
   - champion card goes into opening hand first
   - draw until 6
7. Starting bridges:
   - block: `setup.startingBridges`
   - each player places 2 edges with endpoint within distance 2 of their capital
   - if multiple choose same edge, only place once
8. Free starting card:
   - for each player: reveal 3 from Age I market deck, choose 1 to gain, others bottom random order
   - chosen inserted randomly into draw pile

### 8.3 Reset phase
For each player:
- gold += BASE_INCOME
- mana = MAX_MANA
- draw until hand size == 6 (with reshuffle as needed)
- if a draw would exceed HAND_LIMIT, the drawn cards go straight to discard (no choice)

### 8.4 Market bid-draft
Market row size = P cards.

Preview behavior should be config-driven by round number:
- `previewNextAgeCountByRound[round] -> N`
- Default mapping (tunable):
  - R1: 0
  - R2: 1
  - R3: 1
  - R4: 0
  - R5: 1
  - R6: 2
  - R7: 2
  - R8+: 0
- `N` is clamped to `playerCount`
- Reveal `N` from next age market + `(P-N)` from current age market
- Shuffle these P cards and lay out card 1..P

Resolution:
- Resolve row sequentially by index:
  - For current card:
    - eligible players = those not `playersOut` and have >= 0 gold to bid as needed
    - block: `market.bidsForCard`
    - collect bids simultaneously:
      - Buy Bid X (>=1)
      - Pass Bid X (>=0)
    - If any buy bids:
      - highest buy wins; tie -> roll-off tiebreak (lowest roll wins; repeat among tied)
      - winner pays X, gains card (random insert into draw pile)
      - mark winner out for rest of market phase
    - Else (no buy bids):
      - lowest pass defines eligible pool
      - randomly assign card to one eligible player
      - all players pay their pass bid into pass pot
      - receiver gains pass pot
  - advance to next market card
- At most one market win per player per round.

### 8.5 Action phase (simultaneous steps)
Action phase repeats Action Steps until all players:
- have no mana OR
- declared done

Per Action Step:
- eligible players: mana >= 1 and not done
- block: `actionStep.declarations` (simultaneous)
- each eligible player chooses exactly one:
  - play card from hand (pay costs)
  - take basic action
  - declare done

Resolution after all revealed:
Lead order:
- `leadSeatIndex` starts at 0 in Round 1 and rotates clockwise each round
- `leadSeatIndex = (round - 1) % playerCount`
1. Resolve all played cards in ascending initiative (lower first)
2. Resolve all basic actions in seat order starting from `leadSeatIndex`

After each individual action resolves:
- If any non-capital hex contains units from exactly 2 players, resolve battle immediately.
- Capitals do not battle immediately; they become sieges.

Locked targets / fizzle:
- When declaring a card/basic action, target/path is recorded.
- On resolution, if target/path is illegal, the action fizzles; costs stay paid.

Multi-hex moves:
- Must declare full path (edges/hexes).
- Move step-by-step; stop early if entering enemy-occupied non-capital hex, then battle.

Two-player-per-hex rule:
- A hex may not contain units from more than two players.
- If a move/deploy would cause 3+ players on a hex, that operation fails and units remain in place.

### 8.6 Capital sieges
At end of Action Phase:
- For each capital hex with units from two players:
  - resolve one full battle “to the death”
  - defender = capital owner, attacker = the other

Siege resolution order must be deterministic (e.g., by seat order of defender, then by hex key).

### 8.7 Combat
Combat loop:
- While both sides have units:
  1. Pre-round hooks (e.g., Assassin’s Edge)
  2. Both sides roll simultaneously:
     - each force rolls 1 die; hits on 1..forceHitFaces
     - each champion rolls `attackDice`; hits on 1..hitFaces
  3. Assign hits:
     - default random assignment to surviving enemy units
     - policy may be modified (e.g., Focus Fire)
     - assignments are computed first, then applied simultaneously
  4. Apply damage simultaneously:
     - force hit => removed
     - champion hit => hp -= 1
  5. Handle champion deaths + bounty:
     - when champion hp <= 0: remove
     - killer gains bounty gold
     - emit ChampionKilled event

Battle end:
- winning side remains
- post-battle hooks (e.g., Clean Exit healing)

### 8.8 Collection
Collection is simultaneous per occupied special tile:
- Mine: choose gain gold equal to mine value OR reveal 1 market card from current age and choose to gain it or not
- Forge: choose Reforge (scrap 1 card from hand) OR Forge Draft (reveal 3 market cards current age, gain 1)
- Center: Power Pick (reveal 2 power cards current age, gain 1)

Implementation:
- block: `collection.choices` (simultaneous)
- allow one choice per occupied eligible tile per player
- resolve deterministically in seat order after all choices submitted

### 8.9 Scoring + victory check
Compute Control VP per player:
- +1 if occupy center
- +1 per forge occupied
- +1 per enemy capital occupied

Total VP = permanentVP + controlVP
Victory check:
- if total >= VP_TO_WIN AND your capital has no enemy units -> win
Round cap tiebreaker (if no winner after `ROUNDS_MAX`):
- highest total VP
- higher permanent VP
- more gold

### 8.10 Cleanup
- discard all remaining hand cards
- expire end-of-round modifiers
- resolve “destroy in cleanup” effects (temporary bridges)
- clear per-round flags (e.g., once-per-round usage)

### 8.11 Age update
Age determined by round number:
- R1–3: Age I
- R4–7: Age II
- R8–10: Age III

Age affects:
- market deck used
- power deck used
- market preview behavior

---

## 9. Board Generation (Procedural)

### 9.1 Hex generation
Generate all axial coords within radius R:
- include (0,0)
- store in `board.hexes`

### 9.2 Capital placement
Capital slots fixed per rules (axial coordinates).
Capital draft selects which players get which slots.

### 9.3 Eligibility for special tiles
A hex is eligible if:
- not a capital
- not the center
- distance >= 2 from any capital
- not already special

### 9.4 Placement algorithm (deterministic with RNG)
Placement is heuristic-driven with retry:
- Attempt up to `MAX_ATTEMPTS` (e.g., 50), each attempt:
  1. Place forges:
     - candidates: eligible with dist to center in {2,3}
     - select `forgeCount` with spread heuristic
  2. Place home mines (1 per player):
     - for each capital (random order):
       - candidates: eligible dist == 2 from that capital AND dist >=2 from other capitals
       - choose by spread heuristic
  3. Place remaining mines:
     - candidates: eligible dist to center == 2 (or config)
     - choose by spread/balance heuristic
  4. Sanity check:
     - compute each player's dist(capital -> nearest mine)
     - if (max - min) > 2 => reroll attempt

Spread heuristic (simple MVP):
- Score each candidate by:
  - maximize min distance to already placed of same type
  - plus mild penalty if very close to any single capital
- Choose randomly among top K (e.g., K=5) for variety.

### 9.5 Mine values
For each mine, assign value:
- 4 with 50%
- 5 with 30%
- 6 with 20%

---

## 10. Cards & Content System

### 10.1 Card definitions
Card defs are data-first so they can be edited without touching engine code.
For MVP, store them as TypeScript data modules and load them at runtime.
Card IDs are stable and never change once published (e.g., `age2.focus_fire`).

UI-facing fields are purely data:
- `name`, `rulesText`, `cost`, `initiative`, `type`, `tags`, `deck`

Core data fields:
- `id`, `type`, `deck`
- `cost: { mana, gold? }`
- `initiative: number`
- `burn: boolean` (champions always burn; some spells burn)
- `targetSpec` (how to target; do not bury targeting in code)
- `effects?: EffectSpec[]` (data-first effect array)
- `resolve?: (ctx, state, card, targets) => void` (only for genuinely weird cards)

All card logic must call engine primitives via `ctx.fx.*`; card code must never mutate state directly.

Champion-specific data:
- `champion: { hp, attackDice, hitFaces, bounty, goldCostByChampionCount }`

Champion rules:
- Gold cost uses `goldCostByChampionCount` based on champions currently controlled.
- You cannot control more than `CHAMPION_LIMIT` champions at once.

### 10.2 Card instances
When building decks:
- create a `CardInstanceID` for each copy
- map instance -> def id

Card instance is what moves through deck/hand/discard.

### 10.3 Engine primitives
Reusable actions that most cards compose:
- resource: `gainGold`, `spendGold`, `gainMana`, `spendMana`
- cards: `draw`, `discard`, `scrapFromHand`, `burnCard`, `insertIntoDrawPileRandom`, `shuffleDiscardIntoDraw`
- board: `deployForces`, `moveStack`, `buildBridge`, `destroyBridge`, `lockBridge`, `unlockBridge`
- combat: `dealDamageToChampion`, `destroyForcesRandom`, `startBattleNow`
- effects: `addModifier`, `removeModifier`

Cards invoke these through `ctx.fx.*` from effect processing or `resolve`.

### 10.4 Prompts
Prompts are needed for:
- choose 1 of N revealed cards
- choose a hex/edge target
- discard up to N
- choose “mine gold vs mine draft”, “forge reforge vs forge draft”, “power pick”

Prompt system requirements:
- serializable prompt payload in GameState
- response via `RespondToPrompt` command
- prompt resolution emits events for UI

---

## 11. UI Requirements (MVP)

### 11.1 Screens
- Home:
  - create room
  - join room by code/link
- Room Lobby:
  - seats list, player names
  - start game when ready (host button)
- Game Screen:
  - board view (hex grid)
  - side panel: hand, resources, prompts/actions
  - log feed (events)
  - market row UI during market
  - action step submit UI (choose card/basic/done)
  - collection choices UI

### 11.2 Rendering MVP (SVG)
- Draw hexes with tile type shading
- Draw bridges on edges
- Draw units as simple tokens with counts
- Click interactions:
  - select stack
  - select path
  - select bridge edge
  - select targets for cards/prompts

### 11.3 Animation (optional MVP)
MVP can be instantaneous re-render with event log updates.
Later: interpret `GameEvent[]` to animate.

---

## 12. Persistence & Reconnect

Minimum viable:
- Room state held in memory for the life of the room process.
Recommended early:
- Persist snapshot to storage on each accepted command or every N revisions.
- On room startup/restart:
  - load last snapshot
  - continue

Reconnect:
- Server issues `rejoinToken` on welcome.
- Client stores it locally and presents it on rejoin.
- If token matches a seat, reclaim that player id.

---

## 13. Testing Strategy

### 13.1 Unit tests (engine)
- hex distance, adjacency, edge keys
- shuffle and random insert deterministic
- movement legality (bridges required unless ignored)
- combat determinism with seeded RNG
- market bid resolution
- collection prompts

### 13.2 Scenario tests
- “2 players, 1 round smoke test” no crashes
- “battle in non-capital resolves immediately”
- “siege resolves at end of action”

### 13.3 Content tests
- each card has at least:
  - canPlay sanity
  - resolve sanity (does not crash, emits expected events)

---

## 14. Operational Notes

- Logging:
  - store last ~200 events in state for UI
  - optionally store full event log in persistence for replay/debug

- Debug tools (dev-only):
  - “dump state” panel
  - “set seed” for reproducible runs
  - “fast-forward phase” for testing

End of spec.


How I imagine the UI
