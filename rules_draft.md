The Plot / Story / Vibe 🙂
Name:
The Last Tether
Setting
World is called Orodin
Orodin is an ancient prison made of basalt and aurum that the gods used to bind together a chaotic force called The Roil.
The energy from the Roil created life and all chaos on the planet.
For thousands of years the prison held, but as humanity began to (without understanding) mine the aurum out of the earth we began to weaken and cannibalize the prison. Without the aurum the prison structure weakened until it shattered.
Over the ages the energy from The Roil sparked life on the surface of the basalt prison.
The world has now shattered and is literally expanding in volume and getting bigger.
The place where the gods last touched it, the Axis Mundi is the only stationary solid point still left. A massive plate of immutable permanence that holds the planet together.
Factions are fighting for permanence. As the roil expands it will consume parts of the crust that do not have enough permanence.
Eventually the roil will consume all and create higher entropy and chaos, it will erase the memories of people and erase matter.
To survive the great houses are fighting for Permanence, the energy the gods infused to contain The Roil.
Forges are massive industrial complexes left by the gods.
Age Names
Age I: The fracture
The “Great Groan” is heard. The outer crust begins to flake off into the sky. The Roil seeps up through the cracks.
The Great Houses realize the prison is failing, they scramble to secure gold and build the first bridges to secure their immediate surroundings.
Cracks appear, scramble to secure surroundings
Age II: The Drift
The gaps widen and the mist rises.
Age III: The dissolution
The outer world is gone, knife-fight to the end. Unleash your most powerful relics to ensure your house is the only one left standing on the last solid ground.
Factions (right now the ones below are just shitty placeholders)
Leadbound ->
Zealots of gravity, they worship weight.
Lore: They believe that if they build their walls thick and heavy enough the Roil cannot move them. They sew lead into their skin and make armor of basalt.
Champion: The Anchorite: A warrior that has chained a massive slab of basalt to his back, dragging it into battle.
Assassins -> The Virteous Court
They believe that the world is breaking because there is too much noise and too much life. To save the prison they must kill and silence everyone.
Mobile Guys -> idk yet
They inhale The Roil and use it to move faster and energize themselves and fly. At great personal cost.
Miners -> idk yet
They believe and know that Aurum is the only material that can resist The Roil. The only way to save themselves is to construct a fortress made of Gold.
Card MFs ->
They have realized that Orodin and The Roil are governed by strict mathematical laws. They believe the world is ending because the equation has an error. They accumulate knowledge to calculate the final formulate that will stop The Roil.
Bridge / Aggros
They believe that Pain is another form of Permanence. 
Redfines To Do:
Victory Points / Permanence
Center -> Axis Mundi
Market -> The Archive
Burn -> Entropy
Forces -> Cohorts
Aurum -> Gold
All VP cards will need to be renamed to something more “permanence” ish

Bridgefront — Complete Ruleset (Stand‑Alone v3)
A simultaneous‑planning, hex‑board, bridge‑network, deck‑building wargame for 2–6 players.
1) Core Idea
You expand from your Capital, fight over Mines (primary gold), Forges (deck shaping + pressure), and the Center (power cards). You build/destroy Bridges to create routes and choke points.
Each round:
Bid‑Draft cards from a shared Market
Spend Mana to play cards and take basic actions
Resolve battles (and Capital Sieges)
Collect tile rewards
Score and check victory
Discard your hand and start fresh
Actions resolve by Initiative Number printed on cards: lower resolves first.
2) Definitions and Constants
2.1 Hexes, Distance, Stacks
A hex is a tile on the board.
Distance is standard hex distance. (“Distance 1” = adjacent.)
A stack is any number of your units on a single hex moved together.
2.2 Units
Force
1 HP (dies from any hit)
Attacks with 1 die
Hits on 1–2 (2/6)
Champion
Has printed HP (tracked while it’s in play)
Attacks with N dice, hits on 1–H (Champion‑specific)
Has a Bounty value (gold awarded to the killer when it dies)
2.3 Resources
Mana
Your action budget each round
MAX_MANA = 5 (reset each round)
Todo: playtest this, 4-6 mana may be better given the cards but unclear
Todo: consider adding one mana per age?
Gold
Used for Market bids and some costs
START_GOLD = 4
BASE_INCOME = 1 gold at the start of each round
2.4 Victory Points (VP)
Track two numbers:
Permanent VP (never decreases)
Mostly gained from Victory cards when you gain them
Control VP (recalculated during each scoring phase)
From controlling Center / Forges / enemy Capitals right now
Total VP = Permanent VP + Control VP
2.5 Hand / Deck
You have a draw pile and discard pile and a hand.
If you need to draw and your draw pile is empty: shuffle discard into draw pile.
HAND_LIMIT = 10. If you are at HAND_LIMIT and draw then those cards get sent to the discard pile.
2.6 Initiative
Each card has an Initiative number. Lower numbers resolve earlier.
2.7 Dice
All dice are standard d6.
“Roll 1 die” means roll 1d6.
3) Winning and Game Length
3.1 Win Condition
You win at the end of the Scoring Phase if:
Your Total VP ≥ NUM_VICTORY_POINTS_REQUIRED, and
Your Capital contains no enemy units.
NUM_VICTORY_POINTS_REQUIRED = 8?
3.2 Round Cap
Maximum 10 rounds. If nobody wins by end of round 10 winner is determined by:
Highest Total VP
Higher Permanent VP
More Gold
4) Board, Bridges, and Movement
4.1 Board Size
Hexagon-shaped hex grid:
2–3 players: radius R = 4 (Including Center, that is to say diameter 7)
4–6 players: radius R = 5 (Diameter 9)
4.2 Bridges
A Bridge is an edge connecting two adjacent hexes.
Movement between adjacent hexes is allowed only if a Bridge exists on that edge, unless a card/Champion says it ignores Bridges.
Only one Bridge can exist on an edge.
4.3 Occupied
A hex is occupied by a player if it contains at least one of that player’s units. That is to say either forces or champion.
5) Capital Placement / Board Generation
Using axial coordinates (q,r) 
Corner slots for radius R:
C0 = ( R, 0) 
C1 = ( 0, R)
C2 = (-R, R)
C3 = (-R, 0)
C4 = ( 0,-R)
C5 = ( R,-R)
Use these for:
2 players: {C0, C3}
3 players: {C0, C2, C4} 
4 players: {C0, C1, C3, C4}
6 players: {C0, C1, C2, C3, C4, C5}
5 players (R = 5): use these 5 fixed outer-ring slots:
S1: (-5, 0)
S2: (-4, 5)
S3: (2, 2)
S4: (5, -3)
S5: (1, -5)
Players draft Capital slots from the available set during setup.
6) Special Tiles
6.1 Tile Counts (recommended)
Let P = player count.
Players
Mines
Forges
Center
2
3
1
1
3
4
2
1
4
5
2
1
5
6
3
1
6
7
3
1

6.2 Tile Descriptions
Capital
Each player has a capital.
You may deploy Forces into your Capital when an effect allows it.
If your Capital contains any enemy units at scoring, you cannot win.
If you occupy an enemy Capital at scoring, it contributes Control VP only while occupied.
At Scoring, each enemy Capital you occupy: +1 Control VP
Center
At Collection, if you occupy Center: Power Pick (§16.1) (Draft a card from the power deck)
At Scoring, if you occupy Center: +1 Control VP.
Forge
At Collection, if you occupy a Forge choose one:
Reforge: Scrap 1 card from your hand (remove it from your deck permanently).
Forge Draft: Reveal 3 Market cards from the current Age, choose 1 to gain, put the other 2 on the bottom in random order.
At Scoring: each Forge you occupy is worth +1 Control VP.
Mine
Each Mine has a Mine Value token: 4, 5, or 6.
At Collection, if you occupy a Mine choose one:
Gain gold equal to its Mine Value. 
Reveal 1 Market card from the current age, choose to add it to your deck or not.
Mine Values can be increased by certain cards.
7) Procedural Placement Algorithm (For Computer to run) 
Capitals and Center are fixed. All other special tiles are procedural.
7.1 Mine Values
Assign Mine Values with probability:
4: 50%
5: 30%
6: 20%
7.2 Eligibility (for any special tile)
A hex is eligible if:
Not a Capital
Not the Center
Greater than or equal to distance 2 from any Capital
Not already a special tile
7.3 Fair Placement Heuristic
Place Forges
Candidates: eligible hexes with distance from Center {2,3}
Prefer spread (far from other Forges; not stacked near one Capital)
We somehow need a check that the forges are spread from each other.
Place “Home Mines” (1 per player)
For each Capital (random order):
Candidates: eligible hexes at distance 2 from that Capital and ≥2 from other Capitals
Choose among best-spread options
Place remaining Mines
Candidates: eligible hexes with distance from Center in {2}
Prefer spread and roughly equal access
Sanity check
For each player, compute distance from their Capital to nearest Mine.
If max − min > 2, reroll placement.
8) Setup
Choose factions.
Seating order follows lobby seat assignment (no randomization yet).
Capital draft: in reverse seating order, each player chooses a Capital slot.
Generate the board:
Place Center
Place Mines/Forges
Assign Mine Values
Starting units: each player starts with 4 Forces in their Capital.
Starting resources: each player starts with 4 gold.
Deck setup:
Take the common starter deck (§22.1) shared across factions.
Add your faction starter spell (§22.2) and faction Champion (§22.3).
If no faction is chosen, default to Leadbound.
Shuffle to form your draw pile
Put your faction Champion card into your hand first, then draw until you have 6 cards in hand total.
Starting bridges: each player places 2 Bridges simultaneously.
Each Bridge must have at least one endpoint within distance 2 of your Capital.
If multiple players place the same Bridge, it is placed once.
Free starting card:
Each player reveals 3 Age I Market cards, chooses 1 to gain, returns other 2 to the bottom in random order.
Insert gained card randomly into your draw pile (§15.4).
9) Round Structure
Each round has these phases:
Reset
Market Bid‑Draft
Action Phase
Capital Sieges
Collection
Scoring + Victory Check
Cleanup
Age Update (automatic)
Round Phases:
10) Reset Phase
For each player:
Gain +1 gold
Set mana to MAX_MANA
Draw until you have 6 cards in hand
If hand > 10, discard down to 10 immediately
11) Market Bid‑Draft Phase
Let P = number of players.
11.0 Soft Age Preview (Market only)
When revealing the Market row, Ages I and II “preview” the next Age. That is to say that during earlier rounds, some subset of the cards that are bid-able will be from the next age.
Determine Preview Count N:
If Round 1–3 (Age I): N = min(P, Round #)
Round 1 → 0 next‑Age card
Round 2 → 1 next‑Age cards
Round 3 -> 1 next-Age cards
If Round 4–7 (Age II): N = min(P, Round # − 2)
Round 4 → 0 next‑Age card
Round 5 → 1 next‑Age cards
Round 5 → 2 next‑Age cards
If Age III: N = 0
Reveal:
Reveal N cards from the next Age Market deck (Age II previews in Age I; Age III previews in Age II)
Reveal (P − N) cards from the current Age Market deck
Shuffle those P revealed cards together and lay them out as Card 1 … Card P
Forge Draft / Mine Draft / Power Pick do not preview; they use the current Age deck only.
11.1 Market Row Resolution
Resolve Card 1, then Card 2, etc.
Once you gain a Market card in this phase, you are out for the rest of the Market phase (max 1 Market win per round).
11.2 Bids
For the current card, each eligible player simultaneously secretly chooses one:
A) Buy Bid (X)
X is an integer ≥ 1
Highest Buy Bid wins; winner pays X gold and gains the card
B) Pass Bid (X)
X is an integer ≥ 0
Only matters if nobody buys
11.3 Resolution
If at least one player placed a Buy Bid:
Highest Buy Bid wins (ties break by Priority Order)
Winner pays bid and gains the card (random insert into draw pile)
If nobody placed a Buy Bid:
All Pass Bids are revealed
Lowest Pass Bid value defines the eligible pool
Randomly assign the card to one eligible player
All players pay their Pass Bid into a Pass Pot
The receiver gains the entire Pass Pot
11.4 Market Priority Order (tie‑breaker)
All players that are at the highest buy bid (or lowest pass bid if no buy bids are placed) roll a die. The lowest roll gets the card. If multiple players tie for lowest the process is repeated with only the players who have tied for lowest.
12) Action Phase
The Action Phase is a sequence of Action Steps.
12.1 Choosing Actions
In each Action Step, each player who:
has ≥ 1 mana, and
has not declared Done
chooses exactly one:
Play a card from hand (pay its costs), or
Take a Basic Action (§12.2), or
Declare Done (you take no more actions this round; remaining mana is wasted)
12.2 Basic Actions (always available)
Build Bridge
Cost: 1 mana
Place 1 Bridge between two adjacent hexes if at least one endpoint is a hex you occupy.
March 1
Cost: 1 mana
Move one chosen stack 1 hex along an existing Bridge.
If you enter an enemy‑occupied non‑Capital hex, stop and battle immediately.
Capital Reinforce
Cost: 1 mana + 1 gold
Deploy 1 Force into your Capital.
If enemies are in your Capital, this contributes to the siege (no immediate battle).
12.3 Reveal and Resolve
After all players reveal their choice for the Action Step:
Resolve all played cards in ascending Initiative (lower first)
Resolve all Basic Actions in seat order, starting from Lead and moving clockwise
12.4 Locked Targets and Fizzle
Targets/paths are locked when chosen.
If a target becomes illegal when the card resolves, the card fizzles (costs still paid).
12.5 Multi‑hex Moves
If a card moves a stack more than 1 hex:
Declare the full path along Bridges
Stop early if you enter an enemy‑occupied non‑Capital hex (battle)
12.6 Two‑Player‑per‑Hex Rule
A hex may not contain units from more than two players.
If an action would move/deploy units into a hex that already contains units from two different players, that move/deploy fails and the units remain where they were (this should be impossible however).
12.7 Combat Timing
After each individual action resolves, if any non‑Capital hex contains units from two players, resolve a battle there immediately.
Capitals do not fight immediately; they become a siege resolved later (§13).
13) Capital Sieges (end of Action Phase)
After the Action Phase ends, resolve sieges:
For each Capital hex that contains units from two players:
Resolve one full battle to the death in that Capital.
The Capital owner is the Defender.
The other player is the Attacker.
Resolve sieges one Capital at a time.
14) Combat Rules
14.1 Combat Round
Both sides roll simultaneously:
Each Force rolls 1 die, hits on 1–2.
Each Champion rolls its attack dice, hits on its threshold.
14.2 Hit Assignment
Hits are applied simultaneously.
Default: random assignment
Each hit is randomly assigned to one enemy unit among all surviving enemy units in that battle.
A Force assigned a hit dies.
A Champion assigned a hit takes 1 damage.
14.3 Repeat to the Death
Remove casualties. If both sides still have units, repeat another combat round.
14.4 Champion Death and Bounty
If a Champion reaches 0 HP:
Remove it from the board immediately.
The player who dealt the killing blow gains its Bounty gold.
(Champion cards are handled by §20.)
15) Card System Rules
15.1 Playing Cards
Pay the mana cost (and gold cost if any).
Resolve effect at its Initiative.
After resolving, the card goes to your discard pile, unless it says Burn. Note: All champions are Burn
15.2 Burn
If a card says Burn, remove it from the game after resolving (place it in your Burn pile).
15.3 Gaining Cards (Market / Forge / Center)
When you gain a card:
If your draw pile is empty, shuffle discard into draw pile first.
Insert the gained card randomly into your draw pile.
Physical method: cut draw pile and insert between stacks.
15.4 Victory Cards (Permanent VP on gain)
When you gain a Victory card, immediately gain +1 Permanent VP.
Victory cards have intentionally small play effects.
The game will compute Victory Points automatically. Each player sees their own victory points but not other players victory points.
Gold Display
Players see all other players gold counts.
16) Collection Phase (simultaneous)
All players resolve tile collections for tiles they occupy:
Mines: gain gold equal to Mine Value or Draft
Forges: choose Reforge or Forge Draft
Center: Power Pick
16.1 Power Pick (Center)
Reveal 2 cards from the current Age’s Power deck, choose 1 to gain (random insert into draw pile), put the other on the bottom.
16.2 Forge Draft
Reveal 3 cards from current Age Market deck, choose 1 to gain (random insert into draw pile), put other 2 on bottom in random order.
17) Scoring Phase (Control VP recalculates)
Compute each player’s Control VP:
+1 if you occupy the Center
+1 per Forge you occupy
+1 per enemy Capital you occupy
Then:
Total VP = Permanent VP + Control VP
If Total VP ≥ NUM_VICTORY_POINTS_TO_WIN and your Capital has no enemy units → you win!
18) Cleanup Phase
Discard all cards remaining in your hand to your discard pile.
End all “until end of round” effects.
Resolve “destroy in Cleanup” effects (like Temporary Bridges).
19) Ages (round‑based)
Age I: Rounds 1–3
Age II: Rounds 4–7
Age III: Rounds 8–10
Age determines:
Which Market deck is used
Which Power deck is used
Market preview behavior (see §11.0)
20) Champions 
20.1 Deploying Champions
Champions are played like cards during the Action Phase.
When you play a Champion:
Pay its mana cost.
Pay its gold cost based on how many Champions you currently control this round (see 20.2).
Deploy it into your Capital or into any tile where you have forces.
20.2 “Nth Champion” Gold Cost
Each Champion lists gold cost for:
If this were your 1st / 2nd / 3rd Champion you would currently control (simultaneously)
Example: “Gold Cost: 0 / 2 / 4”
If you have 0 Champions in play → pay 0
If you have 1 → pay 2
If you have 2 → pay 4
20.3 Champion Limit
You may control at most 4 Champions at a time. TODO: See if I actually want this
20.4 Champion Cards and Burning
Champion cards are always burnt after being played
21) Factions
Each faction has:
Passive abilities
One unique starter spell
One faction Champion (starts in your opening hand)
21.1 Leadbound (Defense / Troops)
Passive A — Shield Wall: In the first combat round of each battle where you are the Defender, your Forces hit on 1–3.
Passive B — Home Guard: Each time you deploy Forces into your Capital, deploy +1 extra Force.
21.2 Assassins (Champions + Champion Killing)
Passive A — Contracts: When you kill an enemy Champion, gain +2 gold in addition to bounty.
Passive B — Clean Exit: Your champions heal 1 hp after every battle
Passive C Idea — Upon killing a champion roll a d6 and if it hits on a 1 you may “steal” their champion, could also be their faction spell
21.3 Mobile Guys (Mobility)
Passive A — Tailwind: Once per round, the first time one of your stacks moves, it may move 1 additional hex
Passive B — Wings: If you occupy the center you may deploy to it as if it were your capital.
21.4 Miners (Mines / Gold Guys)
Passive A — Ore Cut: Mines you collect from each give +1 gold.
Passive B — Mine Militia: When defending in a mine your Forces hit on 1-3.
Passive C — Deep tunnels: All mines occupied by the miners are considered adjacent and connected.
21.5 Card MFs (Planning)
Passive A — Quiet Study: At the start of each round, after drawing to 6, you may discard up to 2 cards then draw that many.
Passive C — When you have the option to pick from n cards, pick from n + 1.
21.6 Bridge / Assholes (Bridges /Capital Attackers)
Passive A — Extortionists: Upon winning a battle against an enemy steal up to 2 gold from them.
Passive B — Your forces hit on 1-3 while in an enemy capital.
Passive C — You gain 2 temporary VP’s instead of 1 by occupying an enemy capital
22) Cards
Format
Name
Cost (mana + optional gold)
Initiative (rough)
Type: Order / Spell / Victory / Champion
Effect
22.1 Starter Deck (Common) — 9 cards per player
Recruit ×2
Cost: 1 mana + 1 gold
Init: 40 / 110
Type: Order
Deploy either:
2 Forces into your Capital, OR
1 Forces into a hex you occupy.
March Orders ×1
Cost: 1 mana
Init: 100 / 200 (higher initiative)
Type: Order
Move 1 stack up to 2 hexes along Bridges. Stop and battle if you enter enemy‑occupied non‑Capital hex.
Supply Cache ×1
Cost: 1 mana
Init: 55 / 120
Type: Order
Gain +2 gold.
Field Medic ×1
Cost: 1 mana
Init: 60 / 130
Type: Order
Heal any Champion 1 HP
Scout Report ×1
Cost: 1 mana
Init: 25 / 85
Type: Order
Look at top 3 cards of your draw pile. Put 1 into hand, discard 2.
Bridge Crew ×1
Cost: 1 mana
Init: 90 / 150 (slightly higher)
Type: Order
Build 1 Bridge between adjacent hexes where at least one endpoint is a hex you occupy.
Then you may immediately move 1 stack 1 hex (it may cross that new Bridge).
Quick Move ×1
Cost: 1 mana
Init: 20 / 30 (Should be low)
Type: Order
Choose one:
Move 1 Force you control 1 hex along Bridges
Zap ×1
Cost: 1 mana
Init: 20 / 100
Type: Order
Deal 1 damage to any Champion within 1 cell of a cell you occupy.
22.2 Faction Unique Starter Spells (1 each)
Leadbound — Hold the Line
Cost: 1 mana
Init: 35 / 105
Type: Spell
Choose a hex you occupy. Until end of round, when you defend in that hex, your Forces hit on 1–3.
Virteous — Marked for Coin
Cost: 1 mana
Init: 35 / 105
Type: Spell
Mark an enemy Champion within distance 2 of one of your Champions. If it dies before end of round, gain +4 gold.
Vapourborn — Air Drop
Cost: 2 mana + 1 gold
Init: 30 / 100
Type: Spell
Deploy 3 Forces into any non‑Capital hex within distance 1 of one of your Champions (ignores Bridges).
Refiner — Rich Veins
Cost: 2 mana
Init: 45 / 120
Type: Spell
If you occupy a Mine increase the mine value permanently by 1 (max 7 yield).
Cipher — Perfect Recall
Cost: 1 mana
Init: 25 / 90
Type: Spell
Draw 1 card. Then you may put 1 card from your hand on top of your draw pile.
Gatewright — Bridgeborn Path
Cost: 1 mana
Init: 50 / 125
Type: Spell
Build 1 Bridge anywhere on the board.
22.3 Faction Champions (Start‑of‑Game Champions)
Leadbound — Ironclad Warden
Cost: 2 mana
Gold (1st/2nd/3rd): 1 / 3 / 5
Init: 70 / 135
Type: Champion
HP 6
Attack: 2 dice, hits on 1–2
Bounty: 3
Bodyguard — In battles with Ironclad, the first hit that would be assigned to a friendly Champion is assigned to a friendly Force instead (if any).
Virteous — Shadeblade
Cost: 2 mana
Gold: 0 / 2 / 4
Init: 55 / 115
Type: Champion
HP 3
Attack: 5 dice, hits on 1
Bounty: 3
Assassin’s Edge (1/round) — Before combat round 1 of a battle Shadeblade is in, deal 1 damage to an enemy Champion in that hex.
Vapourborn — Skystriker Ace
Cost: 2 mana
Gold: 0 / 2 / 4
Init: 60 / 120
Type: Champion
HP 4
Attack: 2 dice, hits on 1–3
Bounty: 3
Flight — May move to adjacent hexes without Bridges.
Refiner — Mine Overseer
Cost: 2 mana
Gold: 1 / 3 / 5
Init: 65 / 125
Type: Champion
HP 5
Attack: 2 dice, hits on 1–2
Bounty: 4
Extraction — While on a Mine you occupy, that Mine gives +1 gold at Collection.
Cipher — Archivist Prime
Cost: 2 mana
Gold: 1 / 3 / 5
Init: 60 / 120
Type: Champion
HP 5
Attack: 1 dice, hits on 1-2
Bounty: 3
Gain 1 dice for every card you have played this round.
Gatewright — Wormhole Artificer
Cost: 2 mana
Gold: 1 / 3 / 5
Init: 65 / 125
Type: Champion
HP 5
Attack: 2 dice, hits on 1–3
Bounty: 3
If moving alone, may move +1 spaces.
23) Market Decks (Ages I–III)
Each Age uses its own Market deck during:
Market Bid‑Draft
Forge Draft
Victory cards below grant +1 Permanent VP when gained.
23.1 Age I Market (47 cards)
A) Movement (5)
Quick March
Cost: 1 mana — Init: 40 / 50 (very fast initiative) — Type: Order
Move 1 stack up to 2 hexes along Bridges.
Roll Out
Cost: 1 mana — Init: 60 / 125 — Type: Order
Move up to 2 different stacks up to 1 hexes along Bridges each.
Emergency Evac
Cost: 1 mana — Init: 45 / 115 — Type: Order
Move 1 friendly Champion to your capital. Heal it 1 HP.
Flank Step
Cost: 1 mana — Init: 35 / 105 — Type: Order
Move 1 stack 1 hex ignoring Bridges.
Column Advance
Cost: 2 mana — Init: 55 / 120 — Type: Order
Move 1 stack up to 3 along Bridges; must stop if it enters any occupied hex.

B) Recruitment (5)
Recruit Detachment
Cost: 2 mana + 1 gold — Init: 45 / 115 — Type: Order
Deploy 4 Forces to your Capital, OR 2 Forces to a hex you occupy.
Paid Volunteers
Cost: 1 mana + 2 gold — Init: 65 / 135 — Type: Order
Deploy 4 Forces to your Capital.
Escort Detail
Cost: 1 mana + 1 gold — Init: 35 / 110 — Type: Order
Deploy 2 Forces to a friendly Champion’s hex
Roadblock Squad
Cost: 1 mana + 1 gold — Init: 70 / 145 — Type: Order
Deploy 3 Forces to a Mine or Forge you occupy. OR 1 Force to your Capital.
Frontier Claim
Cost: 2 mana + 2 gold — Init: 55 / 130 — Type: Order
Deploy 4 Forces to an empty hex within dist 1 of your Capital (Ignoring bridges)
Propaganda Recruitment
Cost: 1 mana + 2 gold — Init: 55 / 130 — Type: Order
Deploy 0 forces into your capital. Increase the amount of forces by 1 every time this card is played. (Max 10)
National Service
Cost: 0 mana + 1 gold — Init: 55 / 130 — Type: Order
Deploy 1 force into your capital.
Future Investment
Cost: 1 mana + 2 gold — Init: 55 / 130 — Type: Order
Deploy 2 forcs into your capital. Increase the amount of forces by 1 every time this card is discarded. (Max 10). Burn.

C) Economy (5)
Refinering
Cost: 1 mana — Init: 30 / 100 — Type: Order
Gain +2 gold. If you occupy a Mine, gain +3 gold instead.
Trade Caravan
Cost: 1 mana — Init: 75 / 150 — Type: Order
Gain +3 gold.
Spoils of War
Cost: 1 mana — Init: 80 / 155 — Type: Order
If you won a battle this round, gain +3 gold.
Scavenger’s Market
Cost: 1 mana — Init: 50 / 125 — Type: Order
Gain +1 gold. Draw 1.
D) Deckcraft
Quick Study (1x)
Cost: 1 mana — Init: 25 / 95 — Type: Spell
Draw 2.
Cycle Notes (2x)
Cost: 1 mana — Init: 45 / 110 — Type: Spell
Draw 2, discard 1.
Hard Mulligan
Cost: 2 mana — Init: 70 / 140 — Type: Spell
Discard up to 3 cards, then draw that many.
Make a Play
Cost: 0 mana — Init: 70 / 140 — Type: Spell
Gain 1 mana (BURN)
Spellcaster
Cost: 1 mana — Init: 70 / 140 — Type: Spell
Draw 1 card, if you draw a spell, draw 2 more.
Small Hands
Cost: 1 mana — Init: 70 / 140 — Type: Spell
If this is the last card in your hand, draw 3 cards.
Paid Logistics
Cost: 0 mana + 6 gold — Init: 70 / 140 — Type: Spell
Gain 1 mana. Burn.
Precise Planning
Cost: 1 mana— Init: 70 / 140 — Type: Spell
If there are exactly 0 cards in your draw pile. Draw 3 and gain 1 mana.

E) Combat / Tactics
Battle Cry
Cost: 1 mana — Init: 35 / 105 — Type: Spell
Until end of round, the first battle you fight: each of your Champions in that battle rolls +1 die in combat round 1.
Smoke Screen
Cost: 2 mana — Init: 30 / 100 — Type: Spell
Until end of round, the first time you fight a battle: enemy Forces hit on 1 only in combat round 1.
Patch Up
Cost: 1 mana — Init: 75 / 150 — Type: Order
Heal a friendly Champion anywhere 2; if it is in your Capital, heal 3 instead.
F) Bridges / Terrain (5)
Temporary Bridge
Cost: 1 mana — Init: 50 / 120 — Type: Order
Build 1 Bridge between any two adjacent hexes (no occupancy requirement). Destroy it in Cleanup.
Sabotage Bridge (2x)
Cost: 2 mana — Init: 65 / 140 — Type: Order
Destroy a Bridge adjacent to a hex you occupy.
Rapid Span
Cost: 1 mana — Init: 80 / 155 — Type: Order
Build 2 Bridges, each touching a hex you occupy.
Bridge Trap
Cost: 1 mana — Init: 55 / 130 — Type: Spell
Choose a Bridge adjacent to a hex you occupy. The first enemy stack to cross it this round loses 1 Force (random) before any battle.
Tunnel Network
Cost: 1 mana — Init: 80 / 155 — Type: Order
Your capital is considered connected to the center by a bridge until the end of the round. Burn.
G) Synergy / Gambits
Dice: Forked Road
Cost: 1 mana — Init: 30 / 100 — Type: Order
Roll 1 die. 
1–5: (A) Gain 2 gold and Deploy 1 Force to your Capital
6: (A) Remove one of your Champions from the board
Supply Swap
Cost: 1 mana — Init: 50 / 120 — Type: Order
You may discard up to 2 cards. For each discarded card, choose one: gain +2 gold OR deploy 2 Force to your Capital.
H) Victory (4) — +1 Permanent VP when gained
Banner Claim
Cost: 1 mana — Init: 60 / 130 — Type: Victory
When played: Move 1 Force you control 1 hex along a Bridge.
War Chronicle
Cost: 1 mana — Init: 50 / 120 — Type: Victory
Look at the top two cards in your draw deck.
Supply Ledger
Cost: 1 mana — Init: 75 / 150 — Type: Victory
When played: Gain +1 gold.
Patrol Record
Cost: 1 mana — Init: 30 / 100 — Type: Victory
When played: Draw 1 card
I) Champions (8)
Skirmisher Captain
Cost: 2 mana — Gold 0/2/4 — Init: 65 / 135 — Type: Champion
HP 4 — 2d hit 1–3 — Bounty 2
On deploy: deploy 1 Force to its hex.
Bridge Runner
Cost: 2 mana — Gold 0/2/4 — Init: 55 / 125 — Type: Champion
HP 3 — 3d hit 1–2 — Bounty 2
Pathfinder — May move to adjacent hexes without Bridges.
Inspiring Geezer
Cost: 2 mana — Gold 1/3/5 — Init: 70 / 145 — Type: Champion
HP 2 — 1d hit 1–2 — Bounty 2
All friendly forces in this hex hit on 1-3
Field Surgeon
Cost: 2 mana — Gold 1/3/5 — Init: 60 / 130 — Type: Champion
HP 4 — 2d hit 1–2 — Bounty 2
Stitchwork (1/round): Heal a friendly Champion in this hex 2.
Bounty Hunter
Cost: 2 mana — Gold 1/3/5 — Init: 75 / 150 — Type: Champion
HP 4 — 2d hit 1–3 — Bounty 2
Contract Pay — When an enemy Champion dies in a battle this Champion is in, gain +1 gold.
Brute
Cost: 2 mana — Gold 2/4/6 — Init: 35 / 105 — Type: Champion
HP 6 — 1d hit 1–3 — Bounty 2
If there is no enemy champion in this hex, roll 2 extra dice (total 3) that hit on 1-3
Sergeant
Cost: 1 mana — Gold 1/1/1 — Init: 35 / 105 — Type: Champion
HP 3 — 1d hit 1–3 — Bounty 1
Traitor
Cost: 1 mana — Gold 1/2/5 — Init: 35 / 105 — Type: Champion
HP 5 — 3d hit 1–3 — Bounty 3
Upon death instantly set the owner's mana to 0.
23.2 Age II Market (47 cards)
Note to self: these should be cool abilities as well as a mix of incremental more powerful versions of the age I market cards
A) Movement (5)
Triple March
Cost: 1 mana — Init: 40 / 105 — Type: Order
Move 1 stack up to 3 along Bridges.
Coordinated Advance
Cost: 2 mana — Init: 55 / 120 — Type: Order
Move 2 stacks up to 2 along Bridges each.
Rapid Redeploy
Cost: 1 mana — Init: 65 / 135 — Type: Order
Move 1 Champion to any occupied hex. Heal it 1 HP.
Breakthrough Line
Cost: 2 mana — Init: 75 / 145 — Type: Order
Move 1 stack up to 2 along Bridges. If it wins a battle this round, draw 2 at Cleanup.
Set to Skirmish
Cost: 1 mana — Init: 75 / 145 — Type: Order
Select a hex, until the end of the round iif a battle were to happen in that hex with your forces, all forces and your champion retreat to a random unoccupied adjacent hex (ignoring bridges). If no hexes are unoccupied all forces and champion die.
B) Recruitment (5)
Battalion Contract
Cost: 3 mana + 2 gold — Init: 80 / 155 — Type: Order
Deploy 10 Forces to your Capital.
Rally Where You Stand
Cost: 1 mana + 3 gold — Init: 50 / 120 — Type: Order
Deploy 3 Forces to a hex you occupy that contains a Champion.
Forward Barracks
Cost: 1 mana + 2 gold — Init: 65 / 135 — Type: Order
Deploy 4 Forces to a Mine/Forge you occupy or your Capital.
Conscription Drive
Cost: 1 mana + 1 gold — Init: 70 / 145 — Type: Order
Deploy 4 Forces to your Capital, then discard 1 cards.
Miner Army
Cost: 1 mana + 1 gold— Init: 70 / 145 — Type: Order
Deploy 2 forces into all mains you currently occupy.
Command Logistics
Cost: 2 mana + 2 gold— Init: 70 / 145 — Type: Order
Deploy 1 force into your capital for every card in your hand.
Swam Logistics
Cost: 2 mana + 1 gold mana— Init: 70 / 145 — Type: Order
Deploy 1 force into your capital for every card you’ve played this round

C) Economy (5)
War Taxes
Cost: 1 mana — Init: 60 / 135 — Type: Order
Gain +4 gold.
Smuggling Ring
Cost: 1 mana — Init: 75 / 150 — Type: Order
Gain +2 gold. If you occupy an enemy Capital right now, gain +3 more.
Refined Ingots
Cost: 1 mana — Init: 55 / 125 — Type: Order
Gain +2 gold. If you occupy a Mine, gain +4 gold instead.
Guild Favor
Cost: 2 mana — Init: 40 / 110 — Type: Order
Gain +4 gold and draw 1.
D) Deckcraft
Cycle Protocol
Cost: 1 mana — Init: 25 / 90 — Type: Order
Draw 3, discard 2.
Insight (1x)
Cost: 0 mana — Init: 60 / 130 — Type: Order
Draw 2. Burn
Clean Cuts
Cost: 1 mana — Init: 70 / 145 — Type: Order
Burn 1 card from your hand. Draw 1.
Stall
Cost: 0 mana — Init: 50 / 120 — Type: Order
Do nothing.
Interrupt
Cost: 1 mana — Init: 50 / 120 — Type: Order
Draw 2 cards. All other players draw 1 card.
E) Combat / Tactics (5)
Focus Fire
Cost: 1 mana — Init: 30 / 95 — Type: Spell
In your next battle this round, you assign hits you deal instead of random.
Slow
Cost: 1 mana — Init: 40 / 105 — Type: Spell
Selected champion rolls only 1 die in their next battle.
Ward
Cost: 1 mana — Init: 55 / 120 — Type: Spell
Choose a friendly Champion. It can’t be targeted by enemy cards this round.
Frenzy
Cost: 1 mana — Init: 35 / 100 — Type: Spell
Friendly Champion rolls +2 dice this round; it takes 2 damage immediately.
Repair Orders
Cost: 1 mana — Init: 35 / 100 — Type: Spell
All your champions heal 1.
Gold Plated Armor
Cost: 2 mana — Init: 35 / 100 — Type: Spell
Select a champion,this round, every time it takes 1 damage lose 2 gold and prevent that damage.
Mortar Shot
Cost: 2 mana — Init: very high initial like 300 so it’s dodgeable — Type: Spell
Target a hex within distance 2 of your forces, 50% chance it hits that hex, 50%/num_adjacent_hexes chance each it hits one of the surrounding hexes. Destroy 4 forces and deal 2 damage to any champions in that hex.
Champion Recall
Cost: 2 mana — Init: 35 / 100 — Type: Spell
Recall a champion to your hand. (Removes champion from the board and adds card to hand from burn pile)
F) Bridges / Terrain
Bridge Lockdown
Cost: 2 mana — Init: 40 / 110 — Type: Spell
Choose 1 Bridge adjacent to a hex you occupy; it can’t be crossed this round.
Bridge Network
Cost: 2 mana — Init: 75 / 150 — Type: Order
Build 3 Bridges, each touching a hex you occupy.
Wormhole Link
Cost: 2 mana — Init: 80 / 155 — Type: Spell
Choose 2 hexes within dist 3 of your Champions; treat as adjacent until the end of round. BURN
Bridge Pivot
Cost: 1 mana — Init: 80 / 155 — Type: Spell
Choose a hex, destroy one bridge connected to that hex and place a new bridge connected to that hex.
G) Synergy / Gambits
Foundry Heist
Cost: 2 mana — Init: 50 / 120 — Type: Order
If you occupy a Forge, choose one now:
Forge Draft (reveal 3 Age II Market, gain 1), OR
Reforge (scrap 1 from hand)
Then draw 1.
Deep Shaft Rig
Cost: 2 mana + 1 gold — Init: 60 / 130 — Type: Order
Choose a Mine you occupy. Increase its Mine Value by +1 (max 7). Then deploy 1 Force onto that Mine.
Dice: War Profiteers
Cost: 1 mana — Init: 45 / 115 — Type: Order
Roll 1 die.
1-4: Gain 1 gold
5-6: Gain 6 gold
Encirclement
Cost: 1 mana — Init: 70 / 145 — Type: Spell
Choose an enemy‑occupied hex. If you occupy at least three different adjacent hexes to it, destroy up to 6 enemy Forces there.
H) Victory (4) — +1 or +2 Permanent VP when gained
Strategic Triumph
Cost: 1 mana — Init: 55 / 125 — Type: Victory
When played: Gain +2 gold.
Center Dispatch
Cost: 1 mana — Init: 35 / 105 — Type: Victory
When played: If you occupy Center, draw 2. Else draw 1.
Banner of Resolve
Cost: 1 mana — Init: 75 / 145 — Type: Victory
When played: Deploy 1 force to your capital.
Big VP Gainer
Cost: 1 mana — Init: 75 / 145 — Type: Victory
Gives +2 VP
When played: No effect
When drawn: Lose 1 gold.
I) Champions (8)
Jet Striker
Cost: 2 mana — Gold 1/3/5 — Init: 45 / 115 — Type: Champion
HP 5 — 3d hit 1–2 — Bounty 3
Guerilla Native Mercenary
Cost: 2 mana — Gold 1/3/5 — Init: 45 / 115 — Type: Champion
HP 4 — 2d hit 1–2 — Bounty 3
Can be deployed to any unoccupied hex on the board (in addition to being able to be deployed to anywhere you occupy)
Tax Reaver
Cost: 2 mana — Gold 2/4/6 — Init: 70 / 145 — Type: Champion
HP 6 — 2d hit 1–3 — Bounty 3
Extort — When it kills a Champion, take up to 2 gold from that player (if possible).
Siege Engineer
Cost: 2 mana — Gold 1/3/5 — Init: 60 / 130 — Type: Champion
HP 5 — 2d hit 1–2 — Bounty 3
On deploy: destroy 1 Bridge adjacent to its hex.
Duelist Exemplar
Cost: 2 mana — Gold 1/3/5 — Init: 35 / 105 — Type: Champion
HP 5 — 2d hit 1–3 — Bounty 3
If any enemy Champion is in its battle, roll +1 die each combat round.
Lone Wolf
Cost: 2 mana — Gold 2/4/6 — Init: 75 / 150 — Type: Champion
HP 5 — 1d hit 1–2 — Bounty 3
If there are no friendly forces roll 3 extra dice.
Reliable Veteran
Cost: 2 mana — Gold 2/4/6 — Init: 65 / 135 — Type: Champion
HP 6 — 1d hit 1–5 — Bounty 3
Exodia
Cost: 3 mana — Gold 0/0/0 — Init: 65 / 135 — Type: Champion
HP 15 — 5d hit 1–4 — Bounty 5
Can only be played while player has 3 champions or more on the board. Destroy all of own players champions.
Capturer
Cost: 2 mana — Gold 1/2/5 — Init: 35 / 105 — Type: Champion
HP 5 — 2d hit 1–3 — Bounty 0
Everytime this champion wins a battle, deploy 1 force to the hex the champion occupies
23.3 Age III Market (47 cards)
Note to self: there should be less of these and they should be not incremental improvements as much but more interesting ender type stuff. And there should be more VPs in this deck
A) Movement (5)
Grand Maneuver
Cost: 3 mana — Init: 45 / 110 — Type: Order
Move 2 stacks up to 3 along Bridges each.
Ghost Step
Cost: 1 mana — Init: 30 / 95 — Type: Order
Move 1 stack up to 2 ignoring Bridges. Burn.
Final Push
Cost: 1 mana — Init: 55 / 125 — Type: Order
Move 1 stack up to 1 along Bridges; if it ends in combat draw 2.
Extraction Run
Cost: 1 mana — Init: 70 / 145 — Type: Order
Move 1 Champion to any Mine (even those occupied by enemy forces). Gain +1 gold.
B) Recruitment (5)
Deep Reserves
Cost: 2 mana + 2 gold — Init: 80 / 155 — Type: Order
Deploy 8 Forces to your Capital.
Endless Conscription
Cost: 2 mana + 1 gold — Init: 60 / 130 — Type: Order
Deploy X Forces to your Capital where X is the number of cards in your hand.
Elite Guard
Cost: 2 mana + 3 gold — Init: 50 / 120 — Type: Order
Deploy 5 Forces to your Capital; heal a Champion there 2.
Forward Legion
Cost: 1 mana + 3 gold — Init: 70 / 145 — Type: Order
Deploy 5 Forces to a hex you occupy.
C) Economy (5)
Royal Mint
Cost: 1 mana — Init: 65 / 135 — Type: Order
Gain +5 gold.
Market Squeeze
Cost: 2 mana — Init: 45 / 115 — Type: Order
Choose opponent: they lose up to 3 gold; you gain that much.
Black Market Pull
Cost: 1 mana — Init: 35 / 100 — Type: Order
Gain 2 random Age III Market card to your hand. Burn this card.
Pulling Strings
Cost: 2 mana — Init: 35 / 100 — Type: Order
Whenever two other players fight a battle this round gain 1 gold.
D) Deckcraft (5)
Master Plan
Cost: 1 mana — Init: 30 / 95 — Type: Order
Draw 4, discard 2.
Perfect Cycle
Cost: 1 mana — Init: 45 / 110 — Type: Order
Draw 1, Burn 1.
Tome of Orders
Cost: 1 mana — Init: 60 / 130 — Type: Order
Draw 2; place 1 card from hand on top of your draw pile.
Last Lecture
Cost: 2 mana — Init: 80 / 155 — Type: Order
Draw 5. Burn this card.
E) Combat / Tactics
Execution Order
Cost: 2 mana — Init: 35 / 100 — Type: Spell
Deal 3 damage to an enemy Champion within dist 2 of your Champion.
Attrition
Cost: 1 mana — Init: 65 / 135 — Type: Spell
Enemy stack within dist 1 of your Champion: destroy up to 3 enemy Forces (random). Champions there take 1 damage.
Civilizational Hero
Cost: 2 mana + 1 gold — Init: 65 / 135 — Type: Spell
If you have only 1 champion on the board, double it’s current health (bumping it’s new max health to it’s new health value if the new health exceeds it’s current max health)
Complete Encirclement
Cost: 2 mana — Init: 70 / 145 — Type: Spell
Choose an enemy‑occupied hex. If you occupy at least four different adjacent hexes to it, destroy all forces in that hex and deal 3 damage to all champions.
F) Bridges / Terrain
Ruin the Span
Cost: 3 mana — Init: 60 / 130 — Type: Order
Destroy 2 Bridges anywhere.
Wormhole Gate
Cost: 3 mana — Init: 45 / 110 — Type: Spell
Choose 2 hexes anywhere on the board treat as adjacent this round. Burn.
G) Synergy / Gambits (5)
Siege Writ
Cost: 1 mana — Init: 70 / 145 — Type: Spell
If you occupy a hex adjacent to a capital, destroy 4 forces in that hex.
Last Contract (1x)
Cost: 1 mana — Init: 20 / 90 — Type: Order
The next Champion card you play this round costs 0 gold and 0 mana. Burn.
H) Victory (4)
Monument Plan (2 copies)
Cost: 1 mana — Init: 60 / 130 — Type: Victory
Gives + 2 VP
When played: Discard 1 card.
Conquest Record (2 copies)
Cost: 1 mana — Init: 50 / 120 — Type: Victory
When played: Gain +3 gold.
Final Oath (2 copies)
Cost: 1 mana — Init: 35 / 105 — Type: Victory
When played: Heal a friendly Champion anywhere 2.
Timer
Cost: 3 mana — Init: 35 / 105 — Type: Victory
Must be played when your own mana is 5 or greater. At the end of the round if you occupy the center gain 3 permanent VPs. (Burn)

I) Champions (8)
Logistics Officer
Cost: 2 mana — Gold 2/4/6 — Init: 55 / 125 — Type: Champion
HP 4 — 2d hit 1–3 — Bounty 3
You may deploy to the logistics officer as if it were your capital.
Titan Vanguard
Cost: 3 mana — Gold 2/4/6 — Init: 70 / 145 — Type: Champion
HP 10 — 2d hit 1–3 — Bounty 5
Center Bannerman
Cost: 2 mana — Gold 2/4/6 — Init: 55 / 125 — Type: Champion
HP 3 — 2d hit 1–2 — Bounty 5
Worth 1 VP while occupying the center.
Blood Banker
Cost: 2 mana — Gold 2/4/6 — Init: 55 / 125 — Type: Champion
HP 7 — 2d hit 1–3 — Bounty 3
Blood Ledger — First time this round a Champion dies in its hex, you gain +2 gold.
Stormcaller
Cost: 3 mana — Gold 2/4/6 — Init: 45 / 110 — Type: Champion
HP 8 — 3d hit 1–2 — Bounty 4
Tempest (1/round): deal 1 damage to every enemy Champion in adjacent hexes.
Grand Strategist
Cost: 2 mana — Gold 2/4/6 — Init: 25 / 90 — Type: Champion
HP 6 — 2d hit 1–3 — Bounty 3
Tactical Hand (1/round): in a battle it’s in, you may assign 3 of your hits.
Capital Breaker
Cost: 3 mana — Gold 2/4/6 — Init: 60 / 130 — Type: Champion
HP 8 — 3d hit 1–3 — Bounty 4
Breach — In Capital sieges this round, your Forces in that siege hit on 1–3 in combat round 1.
24) Power Decks (Center Picks)
Center uses the current Age Power deck.
Power Pick: Reveal 2, choose 1 to gain (random insert), put the other on bottom.
Power decks are about 50% Victory cards (Power‑Victory are still Victory: +1 Permanent VP when gained).
Note: These should mainly be burnable cards, like little extra powerful powers that you can one off use. But they should be decently strong
24.1 Age I Power (12)
Non‑Victory Power (6)
Command Surge
Cost: 0 mana — Init: 10 / 80 — Type: Spell
Gain +2 mana. Burn.
Instant Bridge Net
Cost: 1 mana — Init: 35 / 105 — Type: Order
Build 3 Bridges, each touching a hex you occupy. Burn.
Secret Plans
Cost: 0 mana — Init: 15 / 85 — Type: Order
Draw 2. Burn.
Emergency Pay
Cost: 1 mana — Init: 50 / 120 — Type: Order
Gain +5 gold. Burn.
Shock Drill
Cost: 1 mana — Init: 45 / 110 — Type: Spell
In your next battle this round, your Forces hit on 1–5 in combat round 1. Burn
Power Victory (6) — +1 Permanent VP when gained
Bridge Deed
Cost: 1 mana — Init: 40 / 110 — Type: Victory
When played: Build 1 Bridge. Then you may move 1 stack 1 hex along a Bridge.
Mine Charter
Cost: 1 mana — Init: 55 / 120 — Type: Victory
When played: Gain +1 gold; if you occupy a Mine, gain +2 instead.
Forge Sketch
Cost: 1 mana — Init: 30 / 100 — Type: Victory
When played: You may discard 1 card; if you do, draw 2.
Center Writ
Cost: 1 mana — Init: 25 / 95 — Type: Victory
When played: If you occupy Center, gain +1 mana.
Oathstone
Cost: 1 mana — Init: 70 / 145 — Type: Victory
When played: Heal a friendly Champion in your hex 2.
Banner of Sparks
Cost: 1 mana — Init: 60 / 130 — Type: Victory
When played: Deploy 3 Forces to your Capital.
24.2 Age II Power (12)
Non‑Victory Power
Immunity Field
Cost: 2 mana — Init: 40 / 110 — Type: Spell
Your champions cannot be targeted by enemy spells this round. Burn.
Rapid Reinforcements
Cost: 1 mana — Init: 55 / 125 — Type: Order
Deploy 6 forces to any cell you occupy. Burn.
A Hero Joins the Battle
Cost: 1 mana — Init: 55 / 125 — Type: Order
Randomly select from all 2 mana heroes and deploy them for free into your capital. Burn.
Power Victory (6) — +1 Permanent VP when gained
Writ of Industry
Cost: 1 mana — Init: 55 / 120 — Type: Victory
When played: If you occupy a Mine, gain +2 gold; else gain +1.
Bridge Charter
Cost: 1 mana — Init: 60 / 130 — Type: Victory
When played: Build 2 Bridges, each touching a hex you occupy.
Dispatch to Front
Cost: 1 mana — Init: 35 / 105 — Type: Victory
When played: Deploy 2 Forces to a hex you occupy that contains a Champion.
Chronicle of War
Cost: 1 mana — Init: 65 / 135 — Type: Victory
When played: Draw 1; then you may discard 1 to gain +1 mana.
Power Champion Cards
Bannerman
Cost: 3 mana — Gold 2/4/6 — Init: 55 / 125 — Type: Champion
HP 3 — 2d hit 1–2 — Bounty 5
Worth 1 VP while on the board.
24.3 Age III Power (12)
Non‑Victory Power (6)
Cataclysm Core
Cost: 3 mana — Init: 45 / 110 — Type: Spell
Choose hex: destroy all Forces there; Champions there take 3 damage. Burn.
Quick Mobilization
Cost: 1 mana — Init: 60 / 130 — Type: Order
Move 2 stacks up to 3 along Bridges each. Burn.
Forge Miracle
Cost: 2 mana — Init: 35 / 105 — Type: Order
Add 3 Age I Market cards to your hand and give them the Burn keyword. They cost 1 mana and 0 gold and have initiative 0. Burn.
Final Funding
Cost: 3 mana — Init: 50 / 120 — Type: Order
Gain +15 gold. Burn.Last Stand
Cost: 2 mana — Init: 75 / 150 — Type: Spell
Until end of round, the first time an enemy stack enters your Capital, destroy 3 entering enemy Forces (random) before the siege.
Power Victory (6) — +1 Permanent VP when gained
Imperial Warrant
Cost: 1 mana — Init: 40 / 110 — Type: Victory
When played: Move 1 stack up to 2 along Bridges.
Crown Coin
Cost: 1 mana — Init: 55 / 125 — Type: Victory
When played: Gain +2 gold.
Deep Mine Charter
Cost: 1 mana + 1 gold — Init: 60 / 130 — Type: Victory
When played: Increase a Mine you occupy by +1 value (max 7).
Center Relic
Cost: 1 mana — Init: 25 / 90 — Type: Victory
When played: If you occupy Center, gain +1 mana and draw 1; otherwise scry 2.
Forge Relic
Cost: 1 mana — Init: 35 / 100 — Type: Victory
When played: If you occupy a Forge, Forge Draft (reveal 3 Age III Market, gain 1), then discard 1.
Siege Chronicle
Cost: 1 mana — Init: 70 / 145 — Type: Victory
When played: If your Capital currently contains enemy units, deploy 3 Forces to your Capital.
