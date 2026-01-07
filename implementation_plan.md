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
- [x] Add interaction state styling for board + controls (active/hover/selected/disabled/error).
- [x] Add lightweight motion (card play, target highlight pulse, selection fade) to reduce the "debug UI" feel.
- [x] Add tooltips for hex stacks/bridges/units and per-player action status (hex/bridge/unit tooltips done).
- [x] Clean up sidebar/board layout spacing and typography for readability.
- [x] Add a clear phase marker in the header/status area.
- [x] Gate phase-specific panels (action/market/collection) and add an idle-phase callout.
- [x] Move the hand panel into a full-width bottom panel during the action phase.
- [x] Add phase-focused layouts (market/collection focus + log/player repositioning).
  - [x] Add a focus row for market/collection panels above the board.
  - [x] Move log + player list into a secondary row during market/collection phases.
  - [x] Expand market/collection focus cards (initiative/effects) for richer phase layouts.
- [x] Add collapsible/relocatable panels so not everything lives in the right sidebar.
  - [x] Add collapsible sections for sidebar panels (status/table/intel).
- [x] Make the phase market at the top part much bigger and cooler
- [x] During the game we don't need to see all the room id and those little details and top bar, those can be collapsed


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
- [x] Victory cards grant +1 permanent VP on gain.
- [x] Implement collection prompts:
  - mines: gold or mine draft (reveal 1 market card -> choose gain or not)
  - forges: reforge (scrap 1) or forge draft (reveal 3 -> gain 1)
  - center: power pick (reveal 2 -> gain 1; currently drawn from market deck until power decks land)

### Tasks (web)
- [x] Market UI:
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

## Milestone 6.5 -- Code Cleanup + Misc Things I'm just adding (the boss is adding)
### Tasks
- [x] Refactor longer files for readability and maintainability.
- [x] Market bidding UX: add quick bid buttons (1-4) while keeping manual entry.
- [x] Basic actions auto-enter board targeting on selection (bridge/march) for fast flow.
- [x] Reduce board click friction; declutter and improve target picking reliability.

## Milestone 7 — Factions + champions + modifiers (core “exceptions” framework)


### Tasks (engine)
- [x] Do a quick align on rules_draft to remaining implementation plan
- Implement `modifiers` with:
  - [x] duration expiry
  - [x] query application pipeline (combat queries wired)
  - [x] event trigger dispatch (combat before/after hooks)
- [ ] Implement faction passives as permanent modifiers:
  - [x] Leadbound Shield Wall
  - [x] Refiner Ore Cut / Mine Militia
  - [x] Leadbound Home Guard (extra force on capital deploy)
  - [x] Assassins Contracts (bonus gold on champion kill)
  - [x] Vapourborn Tailwind (first stack move per round gets +1 hex)
  - [x] Vapourborn Wings (deploy to center as if capital when occupied)
  - [x] Miners Deep Tunnels (occupied mines count adjacent/connected)
  - [x] Cipher Quiet Study (round-start discard then redraw)
  - [x] Cipher Expanded Choice (pick from N+1 when choosing cards)
  - [x] Capital occupation VP bonus (+2 temp VP instead of +1)
  - [ ] etc. (start with 1–2 factions but first double check the rules from rules_draft)
- [x] Support faction starter spell effects with existing primitives (Air Drop deployForces, Rich Veins increaseMineValue).
- [x] Implement remaining faction starter spell effects (Hold the Line, Marked for Coin, Perfect Recall).
- Implement champions:
  - [x] play champion card => spawn champion unit
  - [x] champion gold cost scaling by “nth champion currently controlled”
  - [x] champion limit
  - [x] champion cards always burn after play
- Implement a few champion abilities using hooks:
  - [x] Bodyguard redirect
  - [x] Flight movement permission override
  - [x] “before combat round 1” damage effect (Assassin’s Edge)
  - [x] Mine Overseer Extraction (+1 mine gold while occupying a mine)
  - [ ] Expand champion hooks for on-deploy/on-death/on-battle-win, movement exceptions, and conditional dice mods (Archivist Prime, Brute, Traitor, Siege Engineer, Capturer, Bannerman, etc.)
    - [x] Archivist Prime: +attack dice per card played this round
    - [x] Wormhole Artificer: +1 move distance when moving alone
    - [x] On-deploy triggers: Skirmisher Captain (deploy 1 Force).
    - [x] On-deploy triggers: Siege Engineer (destroy adjacent Bridge).
    - [x] On-death triggers: Traitor (set owner mana to 0)
    - [x] On-death triggers: Blood Banker (first champion death in hex grants gold)
    - [x] On-battle-win/kill triggers: Bounty Hunter (bonus gold on champion kill in battle)
    - [x] On-battle-win/kill triggers: Capturer (deploy 1 Force on win), Tax Reaver (steal gold on champion kill)
    - [x] Movement exceptions: Bridge Runner pathfinder (adjacent moves ignore bridges).
    - [ ] Movement/deploy exceptions: Guerilla Native Mercenary (deploy to any unoccupied hex), Logistics Officer (deploy as capital)
    - [x] Dice mods/thresholds: Inspiring Geezer (forces hit 1-3), Brute (extra dice if no enemy champion).
    - [x] Dice mods/thresholds: Duelist Exemplar (if enemy champion +1 die/round), Lone Wolf (if no friendly forces +3 dice), Reliable Veteran (hits on 1-5)
    - [x] Siege modifiers: Capital Breaker (siege hit buff)
    - [x] VP modifiers: Bannerman/Center Bannerman (VP while on board/center)
    - [x] Active abilities: Field Surgeon (heal champion in hex 1/round)
    - [ ] Active abilities: Stormcaller (Tempest AoE), Grand Strategist (Tactical Hand hit assignment)
- [ ] Quick check in, the rules in rules_draft are kind of living and breathing as I update things or change balance so make sure that everything is still correct, and add a few more champions and their abilities and everything in to test

### Tasks (web)
- Champion UI:
  - [x] display champion hp
  - [x] show ability usage counters (optional)
- [x] Add simple “effect badges” on hexes/edges for attached modifiers (optional)

### Acceptance criteria
- At least one faction passive changes combat outcome in the expected situations.
- A champion can be deployed, take damage, die, pay bounty, and be removed.

## Milestone 7.2 — Factions + champions + modifiers (core “exceptions” framework)

Start going through the rules_draft and adding the logic for the different types of cards, keep track of which have been implemented or not and try to make it as extensible and smart as possible.

### Tasks
- [x] Add per-round counters for cards played/discarded (cards played now tracked for Archivist Prime; discard tracking + other cards pending).
- [ ] Add draw/round-end triggers (on-draw penalties, end-of-round VP awards, marked champion payouts).
  - [x] Engine hooks for on-card-draw + end-of-round modifier events (cards/cleanup integration).
- [x] Add targeting immunities and marked/contract flags (Ward, Immunity Field, Marked for Coin).
- [ ] Add movement/adjacency modifiers (bridge lockdown/trap, wormhole links, tunnel network).
  - [x] Bridge lockdown effect (lock a bridge until end of round).
  - [x] Bridge trap (first enemy crossing loses a force).
  - [x] Wormhole links (treat two hexes as adjacent for a round).
  - [x] Tunnel network adjacency (non-passive card effects).
- [ ] Add hit-assignment control + battle retreat effects (Focus Fire, Tactical Hand, Set to Skirmish).
- [ ] Add multi-target/multi-stack actions (move two stacks, build multiple bridges, deploy to multiple mines).
- [ ] Add variable VP sources (Victory +2, center-based VP, timer VP).
- [ ] Add champion recall + removal effects (return champion to hand, on-death penalties).
- [ ] Add deckcraft primitives: draw/discard mixes, discard up to N, burn from hand, conditional draw, scry/topdeck (Quick Study, Cycle Notes, Hard Mulligan, Tome of Orders, War Chronicle, Precise Planning, Small Hands, Spellcaster).
- [ ] Add conditional economy triggers: battle-won gold, enemy capital bonuses, opponent gold steal, other-players battle gold (Spoils of War, Smuggling Ring, Market Squeeze, Pulling Strings).
- [ ] Add scaling/permanent counters tied to card state (Propaganda Recruitment, Future Investment).
- [ ] Add bridge manipulation suite: build multiple bridges, destroy adjacent/any bridges, pivot, temporary bridges, bridge lockdown/trap.
  - [x] Destroy bridge effect (adjacent/occupied-edge).
- [ ] Add relocation effects: champion move to capital/occupied/mine, recall to hand, move stack ignoring bridges with stop-on-occupy rules.
- [ ] Add deployment variants: champion-hex deploys, mines/forges deploys, empty-hex near capital deploys, deploy to all mines, deploy to any unoccupied hex.
- [ ] Add AoE/encirclement effects: Mortar Shot scatter, Attrition, Encirclement/Complete Encirclement, Cataclysm Core, Siege Writ.
- [ ] Add combat state modifiers: Smoke Screen, Shock Drill, Frenzy self-damage + dice mods, Gold Plated Armor damage prevention.
- [ ] Add cost overrides/free-play effects (Last Contract, A Hero Joins the Battle).
- [ ] Add random card generation effects (Black Market Pull, Forge Miracle).
- [ ] Add burn keyword enforcement for granted cards (Forge Miracle, power deck burn effects).


## Milestone 7.5 — Script to Generate Art for Cards

### Tasks
- [x] Add a card-art manifest in the web client that maps card ids to image paths.
- [x] Update `GameCard` to render art images when a manifest entry exists.
- [x] Add a CLI script to select cards, build prompts, call a diffusion provider, and write images + update the manifest.
- [x] Decide on the default diffusion provider + credentials workflow (OpenAI image API via `OPENAI_API_KEY`).
- [x] Document how to run the art script and tune prompts/negative prompts.

---

## Milestone 7.6 — Rules alignment review

Pause and read through the rules of the game. Make sure that what we've done aligns as much as possible. Add any tasks below to fix things that don't.

### Tasks
- [x] Resolve board sizing + capital slot mapping across `rules_draft.md`, `technical_spec.md`, and `DEFAULT_CONFIG` (radius + slots per player count).
- [x] Align special tile counts across rules/spec/config (mines/forges/center per player count).
- [x] Align mine value distribution across rules/spec/config (values + weights, including current 3/7 entries).
- [x] Fix market preview round mapping typo in rules (Age II Round 6 preview count).


## Milestone 8 — Content expansion + stability pass

### Tasks
- Add a structured workflow for adding cards:
  - card def file
  - minimal tests per card
- Expand Age I market cards first (the ones that touch your most-used primitives).
  - [x] Added Flank Step, Scavenger's Market, Supply Ledger, Patrol Record (existing effects only).
  - [x] Added Banner Claim (Victory: move 1 stack 1 hex along a Bridge).
- [ ] Add remaining Age I market cards + Age I market champions per rules_draft (movement/recruit/economy/deckcraft/combat/bridges/synergy/victory).
  - [x] Age I champions: Bounty Hunter, Sergeant, Traitor.
  - [x] Age I champion: Field Surgeon (active heal ability).
  - [x] Added Sabotage Bridge, Bridge Trap, and Tunnel Network (bridge/terrain effects).
  - [x] Added Recruit Detachment, Paid Volunteers, and National Service (recruit variants).
  - [x] Added Escort Detail with champion-targeted deploy support.
  - [x] Added Battle Cry and Smoke Screen combat-tactics cards with first-battle modifiers.
  - [x] Added Make a Play and Paid Logistics deckcraft cards (gain mana, burn).
- Expand Age II/III market + power deck lists to match the latest rules_draft (including power champions and burn-heavy cards).
  - [ ] Age II market cards + champions (47 cards + 8 champions).
  - [ ] Age III market cards + champions (47 cards + 8 champions).
  - [ ] Age I/II/III power deck cards (12 each), including power champions and power-victory cards.
  - [ ] Update deck list exports to match rules counts and add tests for deck composition/uniqueness.
  - [x] Add card metadata tags for Burn/Power/Victory/Champion and ensure filters use them.
- [x] Add “smoke sim” tests:
  - random legal commands for N steps should not crash
- [x] Add dev-only debug tools:
  - show full state JSON
  - force advance to next phase
  - seed controls
- [x] Set explicit Victory card VP values in card defs and surface them in card UI.

## Milestone 8.5 -- Things I've noticed and nice to haves

### Tasks (web - market overlay + cards)
- [x] Replace the market focus row with a full-screen overlay that can be shown/hidden.
- [x] Shrink the board presence while the market overlay is open so the cards dominate.
- [x] The cards on the market overlay look a little bit wide style wise, they should look like cards.
- [x] The bids in the market should not be public / show in the bid status until everyone has bid
- [x] We need a clear animation or something to show who won the card

### Tasks (web - deck + player status)
- [x] Add a deck viewer so players can browse all cards in their current deck.

### Tasks (web - action flow + layout)
- [x] Make only valid targets highlightable, like right now to build a bridge it will highlight the possible edges right, you should only be able to click on the edges not the hexes

### Tasks (web - motion + phase clarity)
- [x] Add card-play reveal animation (who played what, where it landed). This should be timed so it flashes up for a few seconds and we see things happen. This is after everyone locks in their actions. I want it to be like Player 1, show the card they played and flash it up, then show where they did it or something and make it extensible so later we can add animations or sound effects or something here. Pieces also need to animate move around the board.
- [x] Add clearer phase transition cues between round phases. Make it flash on screen in big text slowly to everyone simultaneously.
- [ ] we need a few UI's still, like dice rolling for draws and cards and other stuff
- [x] Add market roll-off dice display with suspenseful rolling numbers.
- [x] The placing starting bridge UI needs to be on the board not picking a bunch of axial coords.
- [x] We should have nice transitions between ages and at the start of the game
- [x] The bottom hand modal part is still a tiny bit clunky in that it can block stuff, maybe try to clean it up a bit and make it shorter and a bit more compact?
- [x] The table view has to be a bit more easy to read, idk where it can go, on the right where it is, on the top, but we need to at a glance be able to just briefly see everyone's status, you can make it smaller as well
- [x] Can the bridges look a bit nicer? They right now just come from the center of each but they should be a bit shorter

### Other
- [x] The champion needs to be more obvious, like a seperate thing with its health and name and stuff, and they can hover over it to see the stats
- [x] A lot of duplicative information everywhere, like multiple live pills or whatever

### Tasks (web - targeting reliability)
- [x] Fix hex selection for Bridge Crew and Build Bridge edge picking.

### Tasks UI
- [x] The basic actions in the card hand panel below needs to be reworked, it's taking up too much horizontal space, The bridge march reinforce buttons should be stacked and be thinner and we can probably streamline the whole UI of each when they're expanded
- [x] The draw, Discard and Scrapped can be pills at the top of the container and are taking up too much space
- [x] The Pass and Submit actions should be floating in the middle bottom of the container and be larger
- [x] Mousing over a champion chit on the board should give a small pop up showing more info on the champion, the health, the card itself maybe, the damage and modifiers on it etc...
- [x] Also can you double check, does it only work for 2 players right now?
- [x] The standard setup still doesn't work, only auto setup works.
- [x] Add a reusable hand-card picker modal for effects like Perfect Recall (topdeck/select cards).
- [x] Each hex should have a small label in it that is interpretable, not axial coords but like a1, b2 etc, maybe make it be from the top to bottom we have a and then left to right we have the number, then we should use that label in the log or other parts of the board
- [x] Each of the factions should have their own unique small like symbol, this can be placeholder for now but i want it to be like a small circle symbol that shows up in faction selection, next to their name, on their unit stacks etc...
- [x] Small / medium task: the log should not use axial coords but our coordinate system of a1, a2 etc...
- [x] Small / medium task: can we allow for a bit more "freedom" in the moving of the board? Like allow to move off screen more up down left right when we drag around
- [x] Can we experiment with making the container that holds the cards and the actions see through
- [x] (harder and urgent) We need a better ui/ux flow for the cards where you click cards and then change your mind, right now it feels clunky and not obvious what I've selected or if I've changed my state of what im about to submit / play
- [x] There's no pop up in the action phase to show what each player has done for basic actions
- [x] After the market phase while we're showing the last card, the hand modal instantly pops up
- [x] The basic actions require too many clicks and that UI is cluttered, cut it down like reinforce is only in the capital we don't need to show that, or march doesn't need all of that jazz
- [x] add some text to the gold and VP chits at the top that says gold or VP
- [x] small / medium, make the borders on the cards for power cards vs champions slightly thicker and better looking
- [x] Somewhere add a bit of description text for each faction to add themeing and color
## Milestone 9 — Add Polish

### Tasks
- [x] Improve board visuals: nicer bridges and a bit of padding between hexes for a shattered plains look.
- [x] Add battle UX: click-to-roll dice with shared roll animations and visible hit assignment.
- [x] Add a host-only board state editor/debug panel (JSON view + light patch tools) for test games, only if it stays simple.
- [x] Add a victory screen (winner, final VP, recap, rematch/exit).
- [x] Upgrade on-board visuals for units/champions/factions (distinct tokens, faction badges).
  - [x] Add champion crest markers on unit stacks.
  - [x] Add faction badge chips on unit stacks.
- [x] Enforce faction uniqueness in setup (no duplicate faction picks).
- [x] Add deck UI with draw/discard piles, counts, direction arrows, and draw/discard animations.
- [x] Add bridge art assets (top-down) and render them in BoardView (SVG symbol/pattern instead of plain lines).
- [ ] Low priority: add at least one targeted test for each card effect/card.
  - [x] Age I market: Flank Step movement without bridges.
  - [x] Age I market: Scavenger's Market gold + draw.
  - [x] Age I market: Supply Ledger / Patrol Record / Banner Claim coverage.
  - [x] Age I market: remaining orders (Quick March, Trade Caravan, Temporary Bridge, Patch Up, Quick Study).
  - [ ] Age II/III market + power deck card tests (as content lands).
  - [ ] Champion ability tests (on-deploy, on-death, on-battle-win, dice mods, VP aura).
    - [x] Bounty Hunter bonus gold on champion kill in battle.
  - [ ] Card primitive tests for new mechanics (bridge lockdown/trap, wormhole adjacency, dice roll cards, cost overrides).
- [x] At the end of the market phase we don't see the nice animation and transition for the last player who auto gets it
- [x] It needs to be much more clear that Done is like "Pass" and won't let you go again
- [ ] Do a targetted review and cleanup of the codebase, try to find things that aren't being used anymore, are wrong etc... and clean it up, without breaking behavior.
- [x] Small, the board that displays in the re-roll container on setup spills outside its parent
- [x] Add a confirm if they click pass and they still have mana
- [x] We need a way for players to choose how many forces to move (split stacks vs move all).
  - [x] Engine support: optional `forceCount` for march/moveStack actions and card effects.
  - [x] UI: add a smooth force-count picker (move all vs split) in the action panel.
  - [x] UI: add force-count controls for card-driven stack moves.
- [x] Any text on the board shouldn't be highlightable
- [x] Add some animations for units moving during the action reveal phase
- [x] I added some random sound effects I downloaded to sound_fx, assign each of them a name / meaning (bell should be for rounds) and add the sound effects to different clicks and stuff, also if you need to feel free to move the sound effects folder and stuff to the appropriate place
- [x] Card styling, can we make the art slightly taller, and add a border around the images that looks nice?
- [ ] Large and hard -- make the entire UI look a bit more dark fantasy and cooler
- [x] For cards with victory points we need to denote how many VP's they're worth on the card

## Milestone 9.5 -- Card Art + Description

Add a way for each card to have related card art and a card description that is thematic. This will be done with diffusion models so we need to have a script and some way to query to automatically pull card art for n cards and store them and let me view them. In addition to this we need other ways to style it up and make this look cool. I guess make the hexes look cool, the capitals, the pieces and forces and battles. It needs to have a bit of oomf. We can add some tasks here later when we get to it

- [x] Cards browser denotes faction-specific cards with a faction label.

## Milestone 9.7 -- Get all cards in
Go through rules and add all cards in lol

## Milestone 10 -- Basic AI to play against
Something that just takes random actions is fine

## Milestone 11 -- Give me a way to balance the game in terms of running n where n is a large number of games where they all take random actions and give me win stats per card and faction and other important metrics

## Milestone 12 -- Host it
What do I need to do to host this?
Can I somehow add analytics to this? see players where, etc etc...

## Milestone 13 -- Future stuff / not urgent now
- [ ] time how long every one takes to do their turns and have that be accessible somewhere
- [ ] a turn timer that at the end picks a random valid card or something

### Acceptance criteria
- 2–4 friends can play a complete game session without needing a restart.
- Adding a new card usually requires:
  - adding a CardDef
  - (sometimes) adding a modifier
  - rarely adding a new query/hook/event

---
