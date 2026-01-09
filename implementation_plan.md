# Bridgefront Web MVP — Implementation Plan

This plan is organized by deliverable milestones with concrete acceptance criteria. It's a living breathing document that is always being added to by the admin. Old milestones and tasks will
sometimes be culled / cleaned up to reduce context load on things completed.
The aim is to reach “playable with friends” quickly while preserving a clean extension path.


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
  - mines: take gold only
  - forges/center: no-op placeholder
- [x] Implement scoring:
  - compute control VP and total VP
  - win check
- [x] Implement cleanup:
  - discard hand
  - expire end-of-round modifiers
  - destroy temporary bridges

---

## Milestone 4 — Multiplayer server + room protocol + minimal UI

### Tasks (server)
- [x] Implement PartyKit room server (host-controlled start; engine handles legality checks):
- [x] Implement rejoin token:

### Tasks (web)
- [x] Implement Home + Lobby:
  - [x] create/join room UI
  - [x] host-controlled start with pre-game lobby snapshot
- [x] Lobby polish:
  - [x] board preview panel + reroll control
  - [x] Animate lobby dice roll display
---

## Milestone 5 — Action Step system + hand + playing starter cards

Goal: make the action phase match the rules: simultaneous declarations + initiative resolve.

### Tasks (engine)
- [x] Implement Action Steps:
  - block on `actionStep.declarations`
  - collect one declaration per eligible player
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
  - mines: gain gold only
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
- [x] Implement faction passives as permanent modifiers:
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
- [x] Confirm with the rules and everything that all faction passives are implemented
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
    - [x] Movement/deploy exceptions:
      - [x] Guerilla Native Mercenary (deploy to any unoccupied hex)
      - [x] Logistics Officer (deploy as capital)
    - [x] Dice mods/thresholds: Inspiring Geezer (forces hit 1-3), Brute (extra dice if no enemy champion).
    - [x] Dice mods/thresholds: Duelist Exemplar (if enemy champion +1 die/round), Lone Wolf (if no friendly forces +3 dice), Reliable Veteran (hits on 1-5)
    - [x] Siege modifiers: Capital Breaker (siege hit buff)
    - [x] VP modifiers: Bannerman/Center Bannerman (VP while on board/center)
    - [x] Active abilities: Field Surgeon (heal champion in hex 1/round)
    - [x] Active abilities:
      - [x] Stormcaller (Tempest AoE)
      - [x] Grand Strategist (Tactical Hand hit assignment)
- [ ] Quick check in, the rules in rules_draft are kind of living and breathing as I update things or change balance so make sure that everything is still correct, and add a few more champions and their abilities and everything in to test

### Milestone After Full Test Play and Thinking
### Tasks
- [x] Capital draft selection is simultaneous (no ordered picking); allow lock/unlock freely.
- [ ] Setup flow overhaul into full-screen phases with host-advanced gates:
  - [x] Lobby waiting room view for join/ready state.
  - [x] Faction selection screen with faction abilities visible; host advances once all lock.
    - [x] Add faction ability copy data (passive + starter spell/champion text) for UI display.
  - [x] Starting deck preview screen (card components) showing faction abilities; all ready -> host advance.
    - [x] Show starter deck composition (counts) + champion/spell callouts.
    - [x] Require player ready-up before host can advance from deck preview.
  - [x] Map screen with two sub-steps:
    - [x] Capital selection (simultaneous, no turn order).
    - [x] Initial bridge placement: secret selection of two bridges, reveal simultaneously.
  - [x] Free starting card draft screen with improved presentation.
  - [x] Transition to main game after all setup steps complete.
  - [x] Engine: add setup host-advance gate + setup status view (AdvanceSetup + readiness), update setup tests.
  - [x] Engine: add secret starting-bridge selection + reveal flow, with setup tests.
  - [ ] UI smoke coverage for setup gating/bridge reveal if feasible.
- [x] Champion card UI shows iconography for health, dice, hits, and bounty.
- [x] Market HUD shows current gold with the same emoji/visual language used elsewhere.
- [x] Champion cards communicate gold cost scaling for the nth champion clearly.
- [x] Action reveal popup uses A1-style board labels (not axial coords).
- [x] Collection UI becomes a modal overlay (no top-bar layout shift).
- [x] Center collection offers power picks (not normal card draft).
- [x] Market dice roll animation feels smoother and more synchronized.
- [x] Board generation spawns a fixed number of random bridges at setup (per updated rules).
- [ ] Combat and combat overlay redesign:
 - [x] Change the coords to the tile type and our labelling system e.g. Battle at A1 Mine
 - [x] Make Faction Icons Bigger
   - [x] Each force alive should be represented by a circle and should have a die under it (unrolled)
   - [x] Each champion should also be represented by a circle and should have their stats and dice under them (unrolled) it should be obvious their health
   - [x] Then each player clicks roll and all the dice roll
   - [x] at the bottom it shows the cumulative hits each side did
   - [x] then both players hit like “next” and the engine randomly assigns hits, putting x’s over forces and displaying how many hits were assigned to the champions
   - [x] then players hit next again and the forces that were hit are removed and the champions take damage and the loop continues again where they roll again
 - [x] Each consecutive round shouldn’t be like a new div / container appended to the bottom, the UI should just update to reflect the changes
 - [x] Right now there are issues with syncing, it should show who has rolled and who hasn’t and the outcomes should only show after both players hit roll and they should be synchronized in terms of going to the next round of the battle or retreating for all players
 - [x] Make combat overlay timing configurable (roll lock/assign/done/auto-close) and align server sync with config.
- [x] Draw/discard UI clarity: show piles clearly and add draw animations in hand area.
- [x] Retreat rules implementation:
  - [x] If a bridge is adjacent and player has 1 mana, allow retreat selection.
  - [x] On retreat, resolve one final combat round, then move all forces across chosen bridge and end combat.
- [x] Add "Burn the Bridges" card (rules-aligned effect + UI + tests).
- [x] Live VP updates immediately on occupation changes.
- [x] Basic actions show a short hover tooltip explanation.
- [x] Basic actions show mana/gold costs on the buttons.
- [x] Center card text alignment (titles/lines) on card faces.
- [x] Market show/hide has a hotkey; overlay background slightly transparent.
- [x] Market dice overlay includes faction symbols and uses an overlay (not a new stacked container).
- [x] Special tiles show a small hover label with type (Mine, Forge, etc).
- [x] Fix phantom/ghost battle overlay state leaks when moving between screens.
- [x] Collection phase sequence highlights per-source payouts one by one (mines, forge, center).
- [x] Add gold + VP to the hand panel header area (near Hand label).
- [x] Board "chit" styling (units/champions/forces) aligns with dark fantasy theme.
- [x] Champion target modal should not shift page layout; convert to overlay.
- [x] Fix card hover stacking so hovered cards always render on top.
- [x] Force-split dialog appears near the clicked hex (not bottom of screen).
- [x] Add an "active effects" view so players see ongoing effects.
- [x] Gray out or mark cards that are unaffordable due to mana.
- [x] Fix phase progression after capital battles (ensure collection/market transitions).
- [x] Add UI for scout orders and "draw and pick" effects.
- [x] Fix card aspect ratios on large screens (avoid stretched/fat cards).
- [x] Add a battle debug tab to simulate combat with custom forces/champions.
- [x] Need a something in UI to mark which cell is "my capital"
- [x] Add per-faction starter deck mapping (edit in `starter-decks.ts`).
- [x] Update starter card defs per faction with unique initiatives as needed.
- [x] Add the dark styling to the Play main tab area
- [x] Burn keyword UX + validation
  - [x] Make Burn tags visually distinct (color + subtle animation).
  - [x] Verify burn effects resolve correctly; add a small visual cue if needed.
- [x] there should be a nice / easy to see phase tracker, so right now we see it’s phase market but it would be cool if it was like the different phases separated by → and then it just highlights whichever phase it is
- [x] the show / hide market button should be bigger and easier to hit and toggle back and forth, like it should probably be floating and fixed position and be in the exact same position whether they are in show / hide so it’s easier to toggle between
- [x] why is all the card art way zoomed in at market phase?
- [x] the market dice roll is a bit weird for ties, like it seemed like it insta skipped and i didn’t get to see who won it, at the end of the rolls it needs to show who won the roll and pause
- [x] when the action phase flashes up also show the card that was played, like the art and all
- [x] right now the mana orb can sometimes cover up the action panel when it goes to split or move all
- [x] for the collection phase modal that should be hid-able like the market, and it should have more detail as to who’s collecting what and why
- [x] need to add order of basic actions logic, different factions will always act before others, that should show in the faction selector and be configurable from the config and should also really impact the game
- [x] hard: the forces should move around the board and bridges and things should happen in sync with the popup modal during the action phase
- [x] there’s still a bit of buginess between phase transitions where we go from action phase to collection phase like the collection modal will instantly pop up
- [x] scout report still doesn’t let you choose which ones to draw or discard
- [x] in the combat screen we should see what the champions as well as forces hit on (if there are modifiers it should reflect that as well)
- [x] tunnel network didn’t work
- [x] similar to the show / hide market floating button we also want a go to and forth your own deck button to see the deck and go back and forth
- [x] the faction information is squished, remove the starter kit and pick going to selected affects the layout of the container its in
- [x] for the bridges that generate and randomly get placed try to wire it up so it's a bit more "intelligent" in that it balances out the board, place bridges not conected to the center and try to place them on more empty parts of the board
- [x] sometimes the texts on cards are cut off and turn into ...
- [x] the bridge card didn't give me the option to move 1 stack 1 hex
- [x] needs to be a way for me to test different cards in different board states, like a debug play game where i straight launch to age n with whatever cards in my hand i want
  - [x] Add dev-only hand injector in the Room Debug panel to append/replace hand cards quickly.
  - [x] Add quick age/round presets and board-state snapshot helpers for scenario testing.
- [x] The UI in the cards for mana and gold needs to be slightly larger and more readable, background gradient makes it hard to read slightly
- [x] The cards across different parts of the game can be different sizes, I want them to all be a standard size, big enough to fit everything, it's fine if there's empty space on some. they should be the size of the champion cards fitting those stats + their description
- [x] Between action reveals while the board is still "highlighting" where it was played there should be like a configurable timing pause where the popup modal displaying the card and who played it closes and we see where on the map it's played
- [x] I want there to be an animation when cards are drawn
- [x] on the board we need to see the mine yields
- [x] Board hex labels use the UI font and mine values show +gold markers
- [x] The pass and confirm pass button is bugged
- [x] The forge scrap doesn't look right, i just see a bunch of pills with random card ids
- [x] remove the mine draft, it should just give gold, and update the rules
- [x] The market click to roll for ties for each player still does it automatically and doesn't look right
- [x] Can the champion chits on the map have the background image of their image? Same desaturated style of the board hexes
- [x] Can the forces on the map have the background image as well? same desaturated style of the board hexes, pick a random soldier type image for now
- [x] During the small action preview phase on the board while cards are being played keep the highlighting paths and indicators on the board during that little pause between 
- [x] Can we make the amount of cards we draw configurable from the config
- [x] Make whether or not they get the first "free card add" during setup phase configurable and make sure it doesn't break the tests


### Milestone After Second Full Test Play and Thinking
### Tasks

- [x] in the setup phase the connected and waiting pills mess up the flow and the left side info is completely squished, maybe replace the waiting with just an x or check red or green, and connected pill can go above or below
- [x] need to remove one core deck card: probably scout report
- [x] move Scout Report into the Age I market deck as a normal card
- [x] the reroll map button sends you back one screen
- [x] when you select a slot 1 or slot 2 during the capital draft it would be nice if it shows up on the board somehow so we can see who’s where
	- [x] also the button shouldn’t disappear it should just be like taken or not and unclickable if someone takes it
- [x] in the quiet study i don’t see the champion stats
- [x] hitting done in quiet study doesn’t work nothing happens
- [x] the rejoin button needs a bit of like top margin or something, it’s squished
- [x] right now with the split there’s no option to move 0 forces and move just the champion
- [x] there’s an edge case with skystriker ace and other cards that move without bridges where you should be allowed to, if you just select them, move them with more options
- [x] right now if there’s just a champion in the hex the force market still shows, it should just be the champion marker
- [x] certain cards won’t show like i did scout report and it didn’t show up in the action show phase
- [x] cards that are being hovered over sometimes don’t move “on top” of other cards in z axis in hand, it works on the first round but after you play cards I think it stops working?
- [x] after the last action while the actions are showing the market phase modal instantly pops up covering everything
- [x] we should make it higher dice roll wins the card
- [x] bridge crew card pop up affects ui flow of hand area and pushes all cards up
- [x] I shrank the radii and adjusted the capital slots in the config, the board generation algorithm could be reworked slightly to try to make it more fair and reduce massive empty chances or one spawn that’s particularly bad, the mine placement is fine more the forges have to be fair, especially on 5 player maps, I get that it’s hard though, maybe relax the rule (but try to not prefer it) such that forges are allowed to go next to the center
- [x] reduce the range of bridges you can place in the starting bridge setup from 3 to 2
- [x] the retreat options need to not just list the cell you need to be able to pick on the map which hex you retreat to if you pick that option
	- [x] and the retreat shouldn’t be on a separate screen it should be something you click on the main panel, and it should make it clear in the button that you still do one round of combat
- [x] the scout report hand picker UI instantly pops up not letting that player see what happened on the board during the action reveal part
- [x] the collection modal also instantly pops up not letting you see what happened during the action phase
- [x] can’t play banner of sparks power card
- [x] between rounds if you click march once we go to the next round the march action is still selected
- [x] game breaking: after several rolls sometimes the forces keep rolling the same numbers? and then the whole fight just stalls out?
- [x] why is there a dice roll for revealing forge draw / power deck?
- [x] power deck for age 2 isn’t there yet
- [x] Expose the debug hand-injection overlay via `?debugHand=1`/localStorage for easier in-game testing.
- [x] Any number in a card description can we bold it?
- [x] make the card text slightly slightly larger
- [x] tighten setup deck preview/capital draft layout so the player panel stays narrow and the main panels fill more width

### Refactor Milestone

Note: hold off on doing these refactors until I specifically instruct

- Refactor massive files into smaller components and be very smart about it so we don't break any behavior, the biggest offenders are gamescreen.tsx, card-effects.ts, styles.css those files are huge and need to be broken up (BUT IN A SMART WAY SO WE DON't BREAK ANYTHING)
- [x] GameScreen: extract market/collection overlay rendering into dedicated overlay components.
- [x] GameScreen: extract info dock (log/effects) into component.
- [x] GameScreen: extract phase/age cue overlays into component.
- [x] GameScreen: extract board legend + sidebar toggle into components.
- [x] GameScreen: extract board section (BoardView + legend + overlays) into component.
- [x] GameScreen: extract champion target overlay into component.
- [x] GameScreen: move label/target helper utilities into a shared module.
- [x] card-effects: extract target parsing helpers into a shared module.
- [x] card-effects: extract targeting helper utilities into a shared module.
- [x] card-effects: extract economy/hand effect handlers into a dedicated module.
- [x] card-effects: split effect resolvers into categorized modules and re-export from a single index.
- [ ] styles.css: split into logical partials (base/layout/components/overlays) and import in main. hold off on this for now

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
- [x] Keep `SUPPORTED_EFFECTS` allowlist synced with effect resolvers so new effect kinds remain playable.
- [ ] Add draw/round-end triggers (on-draw penalties, end-of-round VP awards, marked champion payouts).
  - [x] Engine hooks for on-card-draw + end-of-round modifier events (cards/cleanup integration).
- [x] Add targeting immunities and marked/contract flags (Ward, Immunity Field, Marked for Coin).
- [x] Add movement/adjacency modifiers (bridge lockdown/trap, wormhole links, tunnel network).
  - [x] Bridge lockdown effect (lock a bridge until end of round).
  - [x] Bridge trap (first enemy crossing loses a force).
  - [x] Wormhole links (treat two hexes as adjacent for a round).
  - [x] Tunnel network adjacency (non-passive card effects).
- [x] Add hit-assignment control + battle retreat effects (Focus Fire, Tactical Hand, Set to Skirmish).
<!-- - [ ] UI: manual hit assignment prompt when Tactical Hand/Focus Fire are active (select targets for assigned hits). -->
  - [x] Set to Skirmish retreat-on-battle modifier.
  - [x] Focus Fire hit assignment control.
  - [x] Tactical Hand hit assignment control.
- [x] Add multi-target/multi-stack actions (move two stacks, build multiple bridges, deploy to multiple mines).
- [x] Add variable VP sources (Victory +2, center-based VP, timer VP).
- [ ] Add champion recall + removal effects (return champion to hand, on-death penalties).
- [ ] Add deckcraft primitives: draw/discard mixes, discard up to N, burn from hand, conditional draw, scry/topdeck (Quick Study, Cycle Notes, Hard Mulligan, Tome of Orders, War Chronicle, Precise Planning, Small Hands, Spellcaster).
  - [x] Precise Planning (draw pile empty conditional draw + mana).
  - [x] Spellcaster (draw 1; if it is a Spell, draw 2 more).
  - [ ] Add post-draw choice prompts for discard/burn/topdeck so newly drawn cards can be selected.
  - [ ] Support optional discard/burn/topdeck choices ("may discard/topdeck") without blocking card play when hand is empty.
  - [ ] Add a reusable action-step hand-picker block for draw-then-choose effects (Tome of Orders, Perfect Cycle, Forge Sketch, Chronicle of War, Perfect Recall).
- [x] Add conditional economy triggers: battle-won gold, enemy capital bonuses, opponent gold steal, other-players battle gold (Spoils of War, Smuggling Ring, Market Squeeze, Pulling Strings).
  - [x] Spoils of War (battle-win gold).
  - [x] Smuggling Ring (enemy capital bonus gold).
  - [x] Pulling Strings (other-players battle gold).
  - [x] Market Squeeze (opponent gold steal).
- [x] Add scaling/permanent counters tied to card state (Propaganda Recruitment, Future Investment).
  - [x] Propaganda Recruitment scaling counter (increments on play).
  - [x] Future Investment scaling counter (increments on discard).
- [x] Add bridge manipulation suite: build multiple bridges, destroy adjacent/any bridges, pivot, temporary bridges, bridge lockdown/trap.
  - [x] Destroy bridge effect (adjacent/occupied-edge).
- [ ] Add relocation effects: champion move to capital/occupied/mine, recall to hand, move stack ignoring bridges with stop-on-occupy rules.
- [ ] Add deployment variants: champion-hex deploys, mines/forges deploys, empty-hex near capital deploys, deploy to all mines, deploy to any unoccupied hex.
- [x] Add AoE/encirclement effects: Mortar Shot scatter, Attrition, Encirclement/Complete Encirclement, Cataclysm Core, Siege Writ.
- [ ] Add combat state modifiers:
  - [x] Smoke Screen: first battle this round enemy Forces hit on 1 only in combat round 1.
  - [x] Shock Drill: first battle this round your Forces hit on 1–5 in combat round 1.
  - [x] Frenzy: target friendly Champion rolls +2 dice this round and takes 2 damage immediately.
  - [x] Gold Plated Armor: prevent champion damage at gold cost for the round.
- [x] Add cost overrides/free-play effects (Last Contract, A Hero Joins the Battle).
- [ ] Add random card generation effects (Black Market Pull, Forge Miracle).
  - [x] Black Market Pull draws random cards from the market deck (not top-of-deck).
  - [ ] Forge Miracle: grant Age I market cards with burn + cost/initiative overrides.
- [ ] Add burn keyword enforcement for granted cards (Forge Miracle, power deck burn effects). and an animation on burn
- [x] Bridge crew is supposed to let you immediately move over the bridge you are going to construct


### Punchlist — Done cards blocked by UI/validation
- [x] UI: add `multiPath` targeting flow with per-path add/remove, min/max path counts, and per-path highlights (Roll Out, Coordinated Advance, Grand Maneuver).
- [x] UI: add `hexPair` targeting flow (pick two hexes, show linkage preview, enforce allowSame/maxDistanceFromFriendlyChampion) for Wormhole Link + Wormhole Gate.
- [x] UI: support compound targets for edge+move cards (Bridge Crew: `edgeKey` + optional `from/to` or `path`) with a stepper or dual-mode picker.
- [x] UI: Bridge Pivot edge picking must be exactly 1 existing + 1 new bridge that share a hex; block invalid edge pairs.
- [x] UI: enforce `stopOnOccupied` during path selection (Column Advance): block path continuation past occupied hexes and surface a hint.
- [x] UI: enforce champion targeting constraints in picker (`requiresFriendlyChampion`, `maxDistance`) for Marked for Coin + Execution Order.
- [x] UI: Mortar Shot targeting helpers (force-range gating + scatter preview ring) and block invalid picks.
- [ ] UI: manual hit assignment overlay for Focus Fire + Tactical Hand (pick targets for assigned hits, show remaining hits).
  - [ ] Add combat-step target selection + sync for assigned hits (server payload + client selection).
  - [ ] Re-enable Focus Fire + Grand Strategist once the UI flow is live.
- [x] Engine: decide on no-op orders (Stall) — allow playable no-effect cards or remove the card.


## Milestone 7.5 — Script to Generate Art for Cards

Done


## Milestone 8 — Content expansion + stability pass

### Tasks
- Add a structured workflow for adding cards:
  - card def file
  - minimal tests per card
- Expand Age I market cards first (the ones that touch your most-used primitives).
  - [x] Added Flank Step, Scavenger's Market, Supply Ledger, Patrol Record (existing effects only).
  - [x] Added Banner Claim (Victory: move 1 stack 1 hex along a Bridge).
- [ ] Add remaining Age I market cards + Age I market champions per rules_draft (movement/recruit/economy/deckcraft/combat/bridges/synergy/victory).
  - [x] Start adding Age II/III card sets into the game (defs + deck lists wired so they appear in market phases).
  - [x] Age I champions: Bounty Hunter, Sergeant, Traitor.
  - [x] Age I champion: Field Surgeon (active heal ability).
  - [x] Added Sabotage Bridge, Bridge Trap, and Tunnel Network (bridge/terrain effects).
  - [x] Added Recruit Detachment, Paid Volunteers, and National Service (recruit variants).
  - [x] Added Escort Detail with champion-targeted deploy support.
  - [x] Added Battle Cry and Smoke Screen combat-tactics cards with first-battle modifiers.
  - [x] Added Emergency Evac with champion recall to capital + heal effect.
  - [x] Added Make a Play and Paid Logistics deckcraft cards (gain mana, burn).
  - [x] Added Small Hands deckcraft card (draw when hand empty).
  - [x] Added Roll Out with multi-stack movement support.
  - [x] Added Column Advance with stop-on-occupied movement support.
  - [x] Added Frontier Claim with empty-hex deployment near capital.
  - [x] Added Roadblock Squad (mine/forge vs capital recruit) and Rapid Span (multi-bridge build).
- Expand Age II/III market + power deck lists to match the latest rules_draft (including power champions and burn-heavy cards).
  - [ ] Age II market cards + champions (47 cards + 8 champions).
  - [ ] Age III market cards + champions (47 cards + 8 champions).
  - [ ] Power decks card defs and wiring (counts per `rules_draft.md`).
    - [x] Audit `rules_draft.md` power lists and record exact counts per age (current: Age I 11, Age II 8, Age III 8).
    - [x] Age I power non-victory card defs (per rules_draft counts).
    - [x] Age I power victory card defs (per rules_draft counts, +1 VP on gain).
    - [x] Age II power non-victory card defs (per rules_draft counts).
    - [x] Age II power victory card defs (per rules_draft counts, +1 VP on gain).
    - [x] Age II power champion card defs (per rules_draft counts) and tagging.
    - [x] Age III power non-victory card defs (per rules_draft counts).
    - [x] Age III power victory card defs (per rules_draft counts, +1 VP on gain).
    - [x] Verify power/burn/victory tags on power cards.
    - [ ] Power pick card checklist (rules_draft §24).
      - [ ] Age I Power (11) — Non-victory (5).
        - [x] Command Surge.
        - [x] Instant Bridge Net.
        - [x] Secret Plans.
        - [x] Emergency Pay.
        - [x] Shock Drill.
      - [x] Age I Power Victory (6).
        - [x] Bridge Deed.
        - [x] Mine Charter.
        - [x] Forge Sketch.
        - [x] Center Writ.
        - [x] Oathstone.
        - [x] Banner of Sparks.
      - [ ] Age II Power (8) — Non-victory (3).
        - [x] Immunity Field.
        - [x] Rapid Reinforcements.
        - [x] A Hero Joins the Battle.
      - [ ] Age II Power Victory (4).
        - [x] Writ of Industry.
        - [x] Bridge Charter.
        - [x] Dispatch to Front.
        - [x] Chronicle of War.
      - [x] Age II Power Champions (verify deck size inclusion).
        - [x] Bannerman.
      - [ ] Age III Power (8) — Non-victory (4).
        - [x] Cataclysm Core.
        - [x] Quick Mobilization.
        - [x] Final Funding.
        - [x] Last Stand.
      - [ ] Age III Power Victory (4).
        - [x] Imperial Warrant.
        - [x] Crown Coin.
        - [x] Deep Mine Charter.
        - [x] Siege Chronicle.
      - [ ] Planned power additions (not in deck yet).
        - [ ] Forge Miracle.
        - [ ] Center Relic.
        - [ ] Forge Relic.
        - [ ] TBD: one additional Age III non-victory entry.
  - [ ] Replace `packages/engine/src/content/power-decks.ts` with real power deck lists (no market clones).
  - [ ] Update deck list exports/tests for market + power counts/uniqueness.
  - [ ] Add power deck card tests (at least one per unique effect).
  - [ ] Define Age II card defs by category (movement/recruit/economy/deckcraft/combat/bridges/victory/champions).
    - [ ] Age II Movement card defs (6).
      - [x] Triple March.
      - [x] Coordinated Advance.
      - [ ] Rapid Redeploy.
      - [x] Breakthrough Line.
      - [x] Set to Skirmish.
      - [x] Burn the Bridges.
    - [ ] Age II Recruitment card defs (5).
      - [x] Battalion Contract.
      - [x] Rally Where You Stand.
      - [x] Forward Barracks.
      - [x] Conscription Drive.
      - [x] Miner Army.
    - [ ] Age II Economy card defs (5).
    - [x] War Taxes.
    - [x] Smuggling Ring.
      - [x] Refined Ingots.
      - [x] Guild Favor.
      - [ ] TBD: missing Age II economy entry after rules audit.
    - [ ] Age II Deckcraft card defs (5).
    - [x] Cycle Protocol.
    - [x] Insight.
    - [x] Clean Cuts.
    - [x] Stall.
    - [x] Interrupt.
    - [ ] Age II Combat/Tactics card defs (5).
      - [x] Focus Fire.
      - [x] Ward.
      - [x] Frenzy.
      - [x] Slow.
      - [x] Repair Orders.
      - [x] Gold Plated Armor.
      - [x] Mortar Shot.
      - [x] Champion Recall.
    - [ ] Age II Bridges/Terrain card defs (4).
      - [x] Bridge Lockdown.
      - [x] Wormhole Link.
      - [x] Bridge Network.
      - [x] Bridge Pivot.
    - [ ] Age II Synergy/Gambits card defs (4).
      - [ ] Foundry Heist.
      - [x] Deep Shaft Rig.
      - [x] Dice: War Profiteers.
      - [x] Encirclement.
    - [ ] Age II Victory card defs (4).
      - [x] Strategic Triumph.
      - [x] Center Dispatch.
      - [x] Banner of Resolve.
      - [x] Big VP Gainer.
    - [ ] Age II Champion card defs (8).
  - [ ] Define Age III card defs by category (movement/recruit/economy/deckcraft/combat/bridges/victory/champions).
    - [ ] Age III Movement card defs (4).
      - [x] Grand Maneuver.
      - [x] Ghost Step.
      - [x] Final Push.
      - [ ] Extraction Run.
    - [ ] Age III Recruitment card defs (4).
      - [x] Deep Reserves.
      - [x] Endless Conscription.
      - [ ] Elite Guard.
      - [x] Forward Legion.
    - [ ] Age III Economy card defs (4).
      - [x] Royal Mint.
      - [x] Black Market Pull.
      - [x] Pulling Strings.
    - [ ] Age III Deckcraft card defs (4).
      - [x] Tome of Orders.
      - [x] Last Lecture.
      - [x] Master Plan.
      - [x] Perfect Cycle.
    - [ ] Age III Combat/Tactics card defs (4).
      - [x] Execution Order.
      - [x] Attrition.
      - [x] Complete Encirclement.
    - [ ] Age III Bridges/Terrain card defs (2).
      - [x] Wormhole Gate.
      - [x] Ruin the Span.
    - [x] Age III Synergy/Gambits card defs (2).
      - [x] Last Contract.
      - [x] Siege Writ.
    - [ ] Age III Victory card defs (4+).
      - [x] Conquest Record.
      - [x] Final Oath.
      - [x] Monument Plan.
      - [ ] Timer.
    - [ ] Age III Champion card defs (8).
  - [x] Add card metadata tags for Burn/Power/Victory/Champion and ensure filters use them.
- [x] Add “smoke sim” tests:
  - random legal commands for N steps should not crash
- [x] Add dev-only debug tools:
  - show full state JSON
  - force advance to next phase
  - seed controls
- [x] Improve in-game debug hand injector with searchable card queue + add/replace actions.
- [x] Set explicit Victory card VP values in card defs and surface them in card UI.
- [x] Right now it's possible for the cards in the hand if there are too many or on certain screens to not be seen, requiring left and right scrolling, I don't want the card sizes to be changed but I want this to be fixed
- [x] It would be nice if the background of the champions in the battle modal had the background image like the champions on the board chits
- [x] Confirm that if a card that allows you to move 2 hexes is played, and after it's confirmed during the action phase, if another player who plays a card with lower initiative moves into the first hex of the two hex path, that the player will "stop" at that hex and do a combat.

## Milestone 8.5 -- Things I've noticed and nice to haves

### Tasks (web - market overlay + cards)
- [x] Replace the market focus row with a full-screen overlay that can be shown/hidden.
- [x] Shrink the board presence while the market overlay is open so the cards dominate.
- [x] The cards on the market overlay look a little bit wide style wise, they should look like cards.
- [x] The bids in the market should not be public / show in the bid status until everyone has bid
- [x] For the market bids the dice roll needs to be slowed down a bit, and they happen like "simultaneously" say the first dice roll happens and it's a draw, it will then do the second round, but those two will show up at the same time on the UI, it needs to be consecutive

### Tasks (web - deck + player status)
- [x] Add a deck viewer so players can browse all cards in their current deck.

### Tasks (web - action flow + layout)
- [x] Make only valid targets highlightable, like right now to build a bridge it will highlight the possible edges right, you should only be able to click on the edges not the hexes
- [x] The art is not showing up in the "hand" cards
- [x] It should be more clear the card type, like Champion or Victory or whatever should be slightly larger and look nice and each should have their own color

### Tasks (web - motion + phase clarity)
- [x] Add card-play reveal animation (who played what, where it landed). This should be timed so it flashes up for a few seconds and we see things happen. This is after everyone locks in their actions. I want it to be like Player 1, show the card they played and flash it up, then show where they did it or something and make it extensible so later we can add animations or sound effects or something here. Pieces also need to animate move around the board.
- [x] Add clearer phase transition cues between round phases. Make it flash on screen in big text slowly to everyone simultaneously.
- [ ] we need a few UI's still, like dice rolling for draws and cards and other stuff
  - [x] Add collection draw roll reveals (mine/forge/center) with NumberRoll animations.
  - [x] Add dice roll UI for other random draws as they are identified.
- [x] Add market roll-off dice display with suspenseful rolling numbers.
- [x] The placing starting bridge UI needs to be on the board not picking a bunch of axial coords.
- [x] We should have nice transitions between ages and at the start of the game
- [x] The bottom hand modal part is still a tiny bit clunky in that it can block stuff, maybe try to clean it up a bit and make it shorter and a bit more compact?
- [x] The mana and gold costs on the cards in hand needs to be much larger and easier to see
- [x] When moving between hexes we need to also be able to determine if we want to move just troops, champion, champion plus split of troops etc
- [x] The market transition can happen to fast while we're still waiting to see what all the actions were.
- [x] Dice roll in the market and in general needs to be a bit bigger and clearly mark who is who.
- [x] Market roll-offs: each player clicks to roll their respective die.
  - [x] Enlarge market roll-off dice UI and add clearer player labels.
  - [x] Allow each player to click to roll their die (sync with server).
- [x] In the market or on the card I don't see the nice champion stats that we created
### Other
- [x] The champion needs to be more obvious, like a seperate thing with its health and name and stuff, and they can hover over it to see the stats
- [x] A lot of duplicative information everywhere, like multiple live pills or whatever

### Tasks (web - targeting reliability)
- [x] Fix hex selection for Bridge Crew and Build Bridge edge picking.
- [x] Add board-pick mode + valid target highlights for champion-targeted cards (ex: Emergency Evac).
- [x] Add Mortar Shot targeting helpers: highlight only hexes within range of friendly forces.
- [x] Add Mortar Shot targeting helper: show scatter/aoe hint in the card target UI.

### Tasks UI
- [x] The basic actions in the card hand panel below needs to be reworked, it's taking up too much horizontal space, The bridge march reinforce buttons should be stacked and be thinner and we can probably streamline the whole UI of each when they're expanded
- [x] The draw, Discard and Scrapped can be pills at the top of the container and are taking up too much space
- [x] Also can you double check, does it only work for 2 players right now?
- [x] The standard setup still doesn't work, only auto setup works.
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
- [x] Add textured hex tiles with desaturated + vignette treatment.
- [x] Add battle UX: click-to-roll dice with shared roll animations and visible hit assignment.
- [x] Add a victory screen (winner, final VP, recap, rematch/exit).
- [x] Upgrade on-board visuals for units/champions/factions (distinct tokens, faction badges).
- [x] Add bridge art assets (top-down) and render them in BoardView (SVG symbol/pattern instead of plain lines).
- [ ] Low priority: add at least one targeted test for each card effect/card.
  - [x] Age I market: Flank Step movement without bridges.
  - [x] Age I market: Scavenger's Market gold + draw.
  - [x] Age I market: Supply Ledger / Patrol Record / Banner Claim coverage.
  - [x] Age I market: remaining orders (Quick March, Trade Caravan, Temporary Bridge, Patch Up, Quick Study).
  - [x] Age I market: Sabotage Bridge (destroy bridge).
  - [x] Age I market: Temporary Bridge (temporary flag on bridge).
  - [x] Age I market: Paid Volunteers / National Service recruit coverage.
  - [x] Age I market: Small Hands (draw 3 if last card).
  - [x] Age I market: Spoils of War (battle-win gold).
  - [x] Age I market: Roll Out (move two stacks).
  - [x] Starter: Bridge Crew build + move across a newly built bridge.
  - [ ] Age II/III market + power deck card tests (as content lands).
    - [x] Age II market: Deep Shaft Rig (mine value bump + force deploy).
    - [x] Age II market: Rally Where You Stand (deploy to champion hex).
    - [x] Age II market: Smuggling Ring (enemy capital bonus gold).
    - [x] Age II market: Guild Favor (gold + draw).
    - [x] Age II market: Insight (draw 2).
    - [x] Age II market: Refined Ingots (mine bonus gold).
    - [x] Age II market: War Taxes (gain gold).
    - [x] Age II market: Strategic Triumph (gain gold).
    - [x] Age II market: Bridge Lockdown (lock bridge modifier).
    - [x] Age II market: Wormhole Link (link hexes).
    - [x] Age II market: Battalion Contract (deploy to capital).
    - [x] Age II market: Triple March (move up to 3 along bridges).
    - [x] Age II market: Stall (no-op).
    - [x] Age II market: Burn the Bridges (destroy connected bridges).
    - [x] Age II market: Encirclement (adjacent force removal).
    - [x] Age II market: Center Dispatch (draw if you occupy center).
    - [x] Age II market: Repair Orders (heal all champions).
  - [ ] Champion ability tests (on-deploy, on-death, on-battle-win, dice mods, VP aura).
    - [x] Bounty Hunter bonus gold on champion kill in battle.
    - [x] Ironclad Warden bodyguard hit assignment policy.
    - [x] Shadeblade Assassin's Edge pre-combat damage.
  - [ ] Card primitive tests for new mechanics.
    - [x] Bridge lockdown movement block.
    - [ ] Bridge trap force-loss trigger.
    - [ ] Wormhole adjacency override.
    - [x] Dice roll gold thresholds.
    - [ ] Cost override/scaling primitives.
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
  - [x] Add a darker in-game palette + background overrides (body `is-game`) plus nav/panel/button/status restyling.
  - [x] Convert remaining hard-coded light surfaces to theme variables so the dark palette is consistent.
    - [x] Market overlay surfaces (panel/order/bids/rolloff/chips) now use dark overrides.
    - [x] Card tag + detail surfaces now use dark overrides.
    - [x] Sidebar sections, intel cards, player rows, and empty-state surfaces now use dark overrides.
    - [x] Hand/action panels, card surfaces, and command table rows now use theme variables.
- [x] For cards with victory points we need to denote how many VP's they're worth on the card
- [x] We need to add logic and look for escalating champion costs as per the rules
- [x] Slightly make the images a bit bigger and for all images it will crop, but I want it to crop like 10% higher than it is now, that is to say i want it centered 10% higher than it is now for all cards
- [x] Make the cards slightly more readable, try to maximize space usage, make the font slightly larger, and it should be way more obvious the mana and gold cost, you can even put them in the bottom left and right corner like in hearthstone, to that end the entire hand area on the bottom can be made like 10% taller to accomodate
- [x] Confirm that champion targetting cards have a UI and work such that you can target a specific champion if there are two in the same hex
- [x] add a rejoin game type logic

## Milestone 9.5 -- Card Art + Description

Add a way for each card to have related card art and a card description that is thematic. This will be done with diffusion models so we need to have a script and some way to query to automatically pull card art for n cards and store them and let me view them. In addition to this we need other ways to style it up and make this look cool. I guess make the hexes look cool, the capitals, the pieces and forces and battles. It needs to have a bit of oomf. We can add some tasks here later when we get to it

- [x] Cards browser denotes faction-specific cards with a faction label.
- [x] Added placeholder art entries for Black Market Pull and Pulling Strings (replace with final art later).


## Milestone 10 -- Basic AI to play against
Something that just takes random actions is fine

## Milestone 11 -- Give me a way to balance the game in terms of running n where n is a large number of games where they all take random actions and give me win stats per card and faction and other important metrics

## Milestone 12 -- Host it
What do I need to do to host this?
Can I somehow add analytics to this? see players where, etc etc...

## Milestone 13 -- Future stuff / not urgent now
- [x] time how long every one takes to do their turns and have that be accessible somewhere
- [ ] a turn timer that at the end picks a random valid card or something, this should be configurable from settings
- [ ] add save / loading games
- [ ] make a public list of rooms
- [ ] add stats tracking throughout the game
