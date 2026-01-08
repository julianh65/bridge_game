# Write down progess here, things implemented, blockers, etc. Use this as a living breathing context document for tasks and updated plans / things to be aware of.

## Docs alignment (spec/rules)
- Aligned `technical_spec.md` with `rules_draft.md`: added round/lead tracking, VP privacy in views, champion limit + cost scaling, round-cap tiebreaker, hand-limit overflow behavior, market preview mapping, and clarified market tie-break roll-off.
- Updated `rules_draft.md`: clarified initiative placeholders, fixed market preview mapping, and defined lead rotation.
- Fixed market preview round mapping in `rules_draft.md` (Age II rounds 6-7) and marked the task complete in `implementation_plan.md`.
- Clarified setup notes in `rules_draft.md` + `technical_spec.md`: seating order uses lobby assignment (no randomization yet), shared starter deck + faction spell/champion defaults, and champion starts in opening hand; marked plan item complete.
- Card defs in `technical_spec.md` now described as data-first TS modules with stable IDs, targetSpec, and effects/resolve rules.
- Added `docs/cards.md` with card data module editing guidelines.
- Updated board radius defaults (3-player radius 4) in `DEFAULT_CONFIG`, `technical_spec.md`, and `rules_draft.md`.
- Aligned board sizing/capital slots, tile counts, and mine value distribution across `rules_draft.md` + `technical_spec.md`.
- Set `VP_TO_WIN` to 10 across `rules_draft.md` + `technical_spec.md` (config already 10).
- Documented `VP_TO_WIN` default in `docs/configuration.md`.
- Added a coordination note to `agent_instructions.md` to emphasize planning/logging before coding.
- Clarified handling of other-agent changes in `agent_instructions.md` to avoid unnecessary escalation.
- Updated `implementation_plan.md` checkboxes to reflect current milestone status through Milestone 3.
- Converted "Milestone After Full Test Play and Thinking" into clarified checklist tasks in `implementation_plan.md`.

## Active tasks
## Planning updates
- Scoped and broke down tasks for "Mini Milestone For Me" (card/deck editor + initiative tooling) in `implementation_plan.md` with scope, tasks, and acceptance criteria.
- Expanded the setup flow overhaul checklist (full-screen setup phases + host-advanced gates) with engine/server/UI subtasks in `implementation_plan.md`.
- Added explicit power pick (power deck) card checklist tasks from `rules_draft.md` to `implementation_plan.md`, including missing-entry audit placeholders.

## Mini Milestone For Me progress
- Added a dev-only Card Editor view with inline numeric edits, copy flow, initiative tools (collision listing + decollide/compress), and patch export; wired into the app nav and documented in the plan checklist. (Files: `apps/web/src/components/CardEditor.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` overlaps agent2/agent4 scope.)
- Moved Card Editor filters to the top layout and adjusted the editor grid to keep the tool panel separate from gameplay views. (Files: `apps/web/src/components/CardEditor.tsx`, `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/styles.css` overlaps agent2/agent4 scope.)
- Added a local patch-apply script for Card Editor exports (edits only; clone entries are manual) and exposed it as `npm run cards:apply`; marked the plan item complete. (Files: `scripts/apply-card-patch.js`, `package.json`, `implementation_plan.md`.)
- Added `scripts/card-tools.js` CLI for initiative collisions/decollide/compress with deck filters, plus npm scripts and docs; marked the plan items complete. (Files: `scripts/card-tools.js`, `package.json`, `docs/cards.md`, `implementation_plan.md`.)
- Added lightweight tests for card-tools collision/decollide/compress helpers and exposed `cards:test`; marked the plan item complete. (Files: `scripts/card-tools.js`, `scripts/card-tools.test.js`, `package.json`, `implementation_plan.md`.)
- Added a deck editor panel for market/power decks with per-age counts, totals, and JSON export; marked the plan item complete. (Files: `apps/web/src/components/CardEditor.tsx`, `apps/web/src/styles.css`, `packages/engine/src/index.ts`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` is commonly edited by other agents.)
- Moved the floating market overlay toggle button toward the bottom-center to keep it away from the top-right HUD. (File: `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/styles.css` is also in agent1 scope.)

## Milestone After Full Test Play and Thinking progress
- Added Scout Report draw-and-pick choices with an action-phase block, selection command, private offers view, UI modal, and updated action/smoke tests; marked the plan checklist items complete. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/types.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/view.ts`, `packages/engine/src/action-flow.test.ts`, `packages/engine/src/smoke.test.ts`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/App.tsx`, `implementation_plan.md`.)
- Added hover tooltips for basic action chips to explain bridge/march/reinforce costs; updated the plan checklist. (Files: `apps/web/src/components/ActionPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Made the collection overlay toggleable like the market and added a collection context summary + hex labels/notes for why each prompt appears; updated the plan checklist. (Files: `apps/web/src/components/CollectionPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Updated the center collection prompt copy to call out power deck picks; updated the plan checklist. (Files: `apps/web/src/components/CollectionPanel.tsx`, `implementation_plan.md`.)
- Lowered the mana orb stacking so it no longer covers the action panel during split/move selections; updated the plan checklist. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` is also in agent5 scope.)
- Moved the mana orb into the actions panel so it no longer overlaps split/move controls. (Files: `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/styles.css` is also in agent5 scope.)
- Added burned pile counts to the private view and surfaced a Burned pill in the hand panel deck counts; marked the burn UX checklist item complete. (Files: `packages/engine/src/types.ts`, `packages/engine/src/view.ts`, `apps/web/src/components/GameScreenHandPanel.tsx`, `implementation_plan.md`.)
- Added burned pile details to the deck viewer flow/piles plus a view test verifying burned counts in the private view. (Files: `apps/web/src/components/DeckViewer.tsx`, `apps/web/src/styles.css`, `packages/engine/src/view.test.ts`.) (Test: `npm run -w @bridgefront/engine test -- view.test.ts`.)
- Added a floating in-game deck toggle and a deck-screen return-to-game action; updated the plan checklist. (Files: `apps/web/src/App.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/DeckViewer.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` is also in agent5 scope.)
- Added setup host-advance gating in the engine (AdvanceSetup command + setup status view), updated setup/action/smoke tests plus server auto-setup + sample-game helpers, and added a host-only Advance Setup button in the lobby; updated the plan checklist. (Files: `packages/engine/src/types.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/view.ts`, `packages/engine/src/setup-flow.test.ts`, `packages/engine/src/action-flow.test.ts`, `packages/engine/src/smoke.test.ts`, `packages/engine/src/index.ts`, `apps/server/src/server.ts`, `apps/web/src/lib/sample-game.ts`, `apps/web/src/components/Lobby.tsx`, `apps/web/src/App.tsx`, `implementation_plan.md`.)
- Added a setup deck preview step before capital draft with starter deck counts plus starter spell/champion callouts, and updated setup tests + setup flow UI; marked the plan item complete. (Files: `packages/engine/src/types.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/view.ts`, `packages/engine/src/setup-flow.ts`, `packages/engine/src/index.ts`, `packages/engine/src/setup-flow.test.ts`, `packages/engine/src/smoke.test.ts`, `packages/engine/src/index.test.ts`, `apps/web/src/components/SetupDeckPreview.tsx`, `apps/web/src/components/SetupFlow.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Added per-faction starter deck mapping scaffold (defaults to the common deck), updated card registry coverage, and noted the remaining per-faction initiative work in the plan. (Files: `packages/engine/src/content/starter-decks.ts`, `packages/engine/src/content/cards/cards.test.ts`, `implementation_plan.md`.)
- Added per-faction starter initiative variants for Quick Move/Zap/Scout Report and updated starter decks to use the faction-specific IDs; marked the plan item complete. (Files: `packages/engine/src/content/cards/starter.ts`, `packages/engine/src/content/starter-decks.ts`, `implementation_plan.md`.)
- Added card art mappings for faction-specific starter variants (Quick Move/Zap/Scout Report) so art resolves for the new IDs. (File: `apps/web/src/data/card-art.json`.) (Overlap note: `apps/web/src/data/card-art.json` already had in-flight art mappings.)
- Added a phase tracker with arrow-separated steps highlighting the active phase in the game HUD; updated the plan checklist. (Files: `apps/web/src/components/GameScreenHeader.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` + `apps/web/src/styles.css` are in agent1’s active scope.)
- Fixed setup sidebar player rows to wrap long names and prevent overflow in the setup flow panel. (File: `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/styles.css` is in agent1’s active scope.)
- Enlarged the market overlay show/hide toggle button and kept it fixed in place for both states; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` + `apps/web/src/styles.css` are in agent1’s active scope.)
- Reduced market card art zoom so images fit the market overlay better; updated the plan checklist. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` is in agent5’s active scope.)
- Added a setup flow screen focused on map steps (capital draft + starting bridges) and free starting card, replacing the setup lobby view; marked the map screen + secret bridge reveal plan items complete. (Files: `apps/web/src/components/SetupFlow.tsx`, `apps/web/src/App.tsx`, `implementation_plan.md`.) (Overlap note: `apps/web/src/App.tsx` already in-flight.)
- Tweaked setup flow layout with floating host controls, a slimmer players panel, and a left-to-right free-card offer row with the waiting/status column on the right. (Files: `apps/web/src/components/SetupFlow.tsx`, `apps/web/src/components/SetupFreeStartingCardPick.tsx`, `apps/web/src/styles.css`.)
- Added unselect/change support for starting bridges and free starting card picks (UI + engine) with setup-flow tests. (Files: `apps/web/src/components/SetupStartingBridges.tsx`, `apps/web/src/components/SetupFreeStartingCardPick.tsx`, `apps/web/src/styles.css`, `packages/engine/src/types.ts`, `packages/engine/src/setup-flow.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/setup-flow.test.ts`.)
- Added faction ability copy data (passives + starter spell/champion text) and surfaced it in the faction selection UI. (Files: `apps/web/src/lib/factions.ts`, `apps/web/src/components/PreGameLobby.tsx`, `implementation_plan.md`.)
- Refined the pre-game lobby layout by moving start controls into the seats panel and restyling faction cards into sectioned passives/starter kit blocks. (Files: `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/styles.css`.)
- Thinned seat rows, thickened faction cards, and shifted the start block above the seat list in the pre-game lobby. (Files: `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/styles.css`.)
- Made the pre-game seats column narrower than the faction panel for clearer emphasis. (Files: `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/styles.css`.)
- Tweaked pre-game lobby layout with the start block above seats, slimmer seat rows, and thicker faction cards for readability. (Files: `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/styles.css`.)
- Made capital draft simultaneous with lock/unlock support, updated setup draft UI + event formatting, and added unlock test coverage; marked the plan item complete. (Files: `packages/engine/src/setup-flow.ts`, `packages/engine/src/types.ts`, `packages/engine/src/setup-flow.test.ts`, `apps/web/src/components/SetupCapitalDraft.tsx`, `apps/web/src/lib/event-format.ts`, `implementation_plan.md`.)
- Added random bridge placement after special tiles in setup with config support, board preview integration, and engine tests; marked the plan item complete. (Files: `packages/engine/src/board-generation.ts`, `packages/engine/src/setup-flow.ts`, `packages/engine/src/types.ts`, `packages/engine/src/config.ts`, `packages/engine/src/board-generation.test.ts`, `packages/engine/src/setup-flow.test.ts`, `apps/web/src/lib/board-preview.ts`, `docs/configuration.md`, `implementation_plan.md`.) (Overlap note: `packages/engine/src/config.ts` already had action/market duration tweaks in the working tree.)
- Exported `placeRandomBridges` from the engine index to resolve the board preview import error. (File: `packages/engine/src/index.ts`.)
- Confirmed the market overlay hotkey exists, lightened the market scrim, added special-tile hover labels on the board, and marked mana-short cards in hand; updated the plan checklist. (Files: `apps/web/src/components/BoardView.tsx`, `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4) (Overlap note: `apps/web/src/styles.css` overlap agent2 scope.)
- Centered card face text, added gold/VP chips to the hand header, and constrained grid card sizing to avoid stretched cards on large screens; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4) (Overlap note: `apps/web/src/styles.css` overlaps agent2 scope.)
- Set a minimum size for grid/detail cards so non-champion cards match champion-height layouts. (File: `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/styles.css` is in agent1 scope.)
- Redesigned the combat overlay with side summaries, staged dice flow, faction symbols, active effects list, bounty callouts, capital battle labeling, auto-close, and retreat placeholders. (Files: `apps/web/src/components/CombatOverlay.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` also in agent4 scope.)
- Updated combat overlay headers to include tile labels (A1 Mine) and enlarged faction symbols; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent5) (Overlap note: `apps/web/src/styles.css` overlaps other in-flight styling.)
- Added per-unit combat roll logging plus a single-round combat overlay view with force/champion tokens, HP, and per-unit dice; updated the plan checklist. (Files: `packages/engine/src/combat.ts`, `apps/web/src/lib/combat-log.ts`, `apps/web/src/components/CombatOverlay.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Added shared combat roll readiness + synced reveal timing with server-coordinated combat sync and ready indicators in the overlay; updated the plan checklist. (Files: `apps/server/src/server.ts`, `apps/web/src/lib/room-client.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/CombatOverlay.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` also in agent3 scope.)
- Fixed CombatOverlay crash by moving the auto-close effect below `isResolved` initialization. (File: `apps/web/src/components/CombatOverlay.tsx`.)
- Fixed combat sync flow so the roll button advances to the next round after the shared reveal finishes instead of staying in "Waiting for opponent". (File: `apps/web/src/components/CombatOverlay.tsx`.)
- Removed the combat overlay Skip button and added hit pip visuals above hit summaries for clearer attacker/defender impact. (Files: `apps/web/src/components/CombatOverlay.tsx`, `apps/web/src/styles.css`.)
- Added per-unit hit-face labels in the combat overlay so forces/champions show their hit thresholds; updated the plan checklist. (Files: `apps/web/src/components/CombatOverlay.tsx`, `implementation_plan.md`.)
- Implemented retreat rules with a combat retreat block + action-resolution queue pause, added a retreat selection overlay, and wired retreat to spend mana, run one final round, and move units across the chosen bridge; updated the plan checklist and added smoke/combat test coverage. (Files: `packages/engine/src/types.ts`, `packages/engine/src/combat.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/action-flow.ts`, `packages/engine/src/view.ts`, `packages/engine/src/smoke.test.ts`, `packages/engine/src/combat.test.ts`, `apps/web/src/components/CombatRetreatOverlay.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/CombatOverlay.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` + `apps/web/src/styles.css` overlap agent1 scope.) (Test: `npm run -w @bridgefront/engine test -- combat.test.ts`.)
- Switched action reveal target labels to A1-style board labels, added basic action hover tooltips, and added an active effects intel list; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/GameScreenSidebar.tsx`, `apps/web/src/components/ActionPanel.tsx`, `implementation_plan.md`.)
- Added action-reveal-synced board animations for move paths, edge highlights, and target pulses during action resolution; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/BoardView.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` + `apps/web/src/styles.css` overlap agent2 scope.)
- Upgraded action-reveal move animations to use ghost force/champion chits (labelled by force count or champion glyph when known) moving along the path. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/BoardView.tsx`, `apps/web/src/styles.css`.) (Overlap note: `apps/web/src/components/GameScreen.tsx` + `apps/web/src/styles.css` overlap agent2/agent5 scope.)
- Simplified faction selection cards by removing the starter kit block and keeping the pick/selected tag layout stable; updated the plan checklist. (Files: `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.)
- Action reveal overlay now includes a card preview with art for played cards. (Files: `apps/web/src/components/ActionRevealOverlay.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` is also in agent5 scope.)
- Added a battle debug tab to simulate combat with custom forces/champions, reusing the combat overlay for playback. (Files: `apps/web/src/App.tsx`, `apps/web/src/components/BattleDebug.tsx`, `apps/web/src/styles.css`, `packages/engine/src/index.ts`, `implementation_plan.md`.) (Overlap note: `apps/web/src/App.tsx` also in agent3 scope.)
- Added champion stat iconography (HP/dice/hits/bounty) and a gold cost scaling hint on champion cards; updated the plan checklist. (Files: `apps/web/src/components/GameCard.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4) (Overlap note: `apps/web/src/styles.css` overlaps agent2 scope.)
- Fixed combat overlay log baseline so old combat sequences don’t replay on view changes; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `implementation_plan.md`.)
- Added a market roll-off overlay with faction symbols and synchronized dice timing; updated the plan checklist. (Files: `apps/web/src/components/MarketPanel.tsx`, `implementation_plan.md`.)
- Held market roll-off winner highlights through the tie-break animation so the winner callout stays visible; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `implementation_plan.md`.)
- Persisted market winner banners on resolved cards so each won card keeps its callout. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/MarketPanel.tsx`.)
- Moved force-split controls to a board-adjacent popover for march + card moves, added overlay rendering in BoardView, and left a small split hint in the action/hand panels; updated the plan checklist. (Files: `apps/web/src/components/BoardView.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/ActionPanel.tsx`, `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/components/ForceSplitPopover.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Added Burn the Bridges (Age II) with destroy-connected-bridges effect, movement-target validation, and action-flow coverage; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/action-flow.test.ts`, `implementation_plan.md`.) (owner: agent2)

## Milestone 8 progress
- Added Age II market card defs (Set to Skirmish, Battalion Contract, Rally Where You Stand, Insight, Stall, Deep Shaft Rig, Strategic Triumph, Banner of Resolve) using existing effects; updated the plan checklist. (Files: `packages/engine/src/content/cards/age2.ts`, `implementation_plan.md`.) (owner: agent4) (Overlap note: included a pre-staged `implementation_plan.md` edit about burn animation.)
- Added Escort Detail (Age I) with champion-targeted deploy support and action-flow coverage. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts`, `packages/engine/src/action-flow.test.ts`.)
- Added explicit victoryPoints values to Age I Victory cards and marked the plan item complete in `implementation_plan.md`.
- Added Age I Field Surgeon champion with per-round Stitchwork heal after battles, plus tests and plan update. (Files: `packages/engine/src/content/cards/age1.ts`, `packages/engine/src/champions.ts`, `packages/engine/src/champion-abilities.test.ts`, `implementation_plan.md`.)
- Added Battle Cry + Smoke Screen (Age I) with first-battle combat modifiers and targeted tests; updated the plan checklist. (Overlap note: touched `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts` alongside agent2 scope.)
- Added gain-mana card effect support plus Age I Make a Play/Paid Logistics cards with action-flow coverage. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts`, `packages/engine/src/action-flow.test.ts`.)
- Added Emergency Evac (Age I) with champion recall-to-capital effect + unit move helper and targeted tests; updated the plan checklist. (Overlap note: touched `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts` alongside any in-flight edits.)
- Added Small Hands (Age I) with hand-empty draw effect and action-flow coverage. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts`, `packages/engine/src/action-flow.test.ts`, `implementation_plan.md`.)
- Added action-flow tests for Age I Paid Volunteers + National Service recruit cards; updated the plan checklist. (Files: `packages/engine/src/action-flow.test.ts`, `implementation_plan.md`.) (Overlap note: `progress.md` includes agent4 active-task update.)
- Added Roll Out (Age I) with multi-stack move targeting/effect support and tests. (Overlap note: touched `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts` alongside any in-flight edits.)
- Added Column Advance (Age I) with stop-on-occupied path validation and tests. (Overlap note: touched `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts` alongside any in-flight edits.)
- Added Frontier Claim (Age I) with capital-distance empty-hex targeting and tests. (Overlap note: touched `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age1.ts` alongside any in-flight edits.)
- Added Age III champion card defs (Logistics Officer, Titan Vanguard, Center Bannerman, Blood Banker, Stormcaller, Grand Strategist, Capital Breaker) and wired them into the card registry. (Files: `packages/engine/src/content/cards/age3.ts`, `packages/engine/src/content/cards/index.ts`.) (owner: agent2)
- Added Age II champion card defs for implemented abilities (Jet Striker, Tax Reaver, Siege Engineer, Duelist Exemplar, Lone Wolf, Reliable Veteran, Capturer) and wired them into the card registry; Exodia still pending targeting/condition support. (Files: `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/content/cards/index.ts`.) (owner: agent2)
- Added Guerilla Native Mercenary (Age II) champion card def with allow-empty hex deployment, plus allow-empty target validation + UI highlights and tests; updated the plan checklist. (Files: `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.ts`, `packages/engine/src/card-effects.guerilla-native-mercenary.test.ts`, `apps/web/src/components/GameScreen.tsx`, `implementation_plan.md`.) (owner: agent2)
- Added Age II combat/tactics card defs for Focus Fire, Ward, and Frenzy; updated the plan checklist. (Files: `packages/engine/src/content/cards/age2.ts`, `implementation_plan.md`.) (Overlap note: touched `packages/engine/src/content/cards/age2.ts` + `implementation_plan.md` while agent2 active.)
- Expanded power deck tasks in `implementation_plan.md` (Age I/II/III power card defs, power deck list wiring, tests, and rules audit). (Overlap note: commit also picked up pre-staged agent2 changes in `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.ts`, `packages/engine/src/card-effects.guerilla-native-mercenary.test.ts`, `apps/web/src/components/GameScreen.tsx`.)
- Adjusted power deck plan counts to follow `rules_draft.md` (not fixed 12 each) in `implementation_plan.md`.
- Added Age III market card defs using existing effects (Grand Maneuver, Ghost Step, Deep Reserves, Forward Legion, Royal Mint, Tome of Orders, Last Lecture, Execution Order) and updated the plan checklist. (Files: `packages/engine/src/content/cards/age3.ts`, `implementation_plan.md`.) (Overlap note: commit also picked up pre-staged changes in `apps/web/src/components/GameCard.tsx`.)
- Added Age II Repair Orders with a heal-all-champions effect and action-flow coverage; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/action-flow.test.ts`, `implementation_plan.md`.)
- Added Age II Gold Plated Armor with gold-for-damage prevention, combat integration, and tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/combat.ts`, `packages/engine/src/champions.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.) (Overlap note: touched `packages/engine/src/card-effects.combat-modifiers.test.ts` while agent3 active.)
- Added partial-damage coverage for Gold Plated Armor (only affordable hits prevented) and marked the combat modifier checklist complete in `implementation_plan.md`. (Files: `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.) (owner: agent2) (Test: `npm run -w @bridgefront/engine test -- card-effects.combat-modifiers.test.ts`.)
- Added Age II Slow combat modifier (target champion rolls 1 die next battle) with tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.)
- Added Age II Champion Recall (return champion from board to hand via burn pile) with tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.champion-recall.test.ts`, `implementation_plan.md`.) (Overlap note: touched `packages/engine/src/card-effects.ts` + `packages/engine/src/content/cards/age2.ts` alongside other in-flight edits.)
- Added Age II Mortar Shot (scatter AoE with force destruction + champion damage) with tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.mortar-shot.test.ts`, `implementation_plan.md`.) (Overlap note: touched `packages/engine/src/card-effects.ts` + `packages/engine/src/content/cards/age2.ts` alongside other in-flight edits.)
- Added Age II economy card defs (War Taxes, Refined Ingots, Guild Favor) and bridges/terrain card defs (Bridge Lockdown, Wormhole Link); updated the plan checklist. (Files: `packages/engine/src/content/cards/age2.ts`, `implementation_plan.md`.)
- Added Age II movement card defs (Triple March, Coordinated Advance, Breakthrough Line) plus a battle-win cleanup draw modifier and tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.breakthrough-line.test.ts`, `implementation_plan.md`.) (owner: agent2)
- Added Age II Bridge Network with multi-edge build-bridge support and tests; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, `packages/engine/src/card-effects.bridge-network.test.ts`, `implementation_plan.md`.) (owner: agent2)
- Added Age III Wormhole Gate card def (link-hexes) and updated the plan checklist. (Files: `packages/engine/src/content/cards/age3.ts`, `implementation_plan.md`.) (owner: agent4)
- Added Age III Ruin the Span (destroy 2 bridges) with multi-edge targeting support, edge-selection UI updates for existing bridges, and action-flow coverage; updated the plan checklist. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age3.ts`, `packages/engine/src/action-flow.test.ts`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/GameScreenHandPanel.tsx`, `implementation_plan.md`.) (owner: agent4)
- Added Age III victory card defs (Conquest Record, Final Oath) using gain-gold/heal effects and updated the plan checklist. (Files: `packages/engine/src/content/cards/age3.ts`, `implementation_plan.md`.) (owner: agent4)
- Added Deep Shaft Rig card-effect test for mine value bump + force deploy; updated the plan checklist. (Files: `packages/engine/src/card-effects.deep-shaft-rig.test.ts`, `implementation_plan.md`.) (Test: `npm run -w @bridgefront/engine test -- card-effects.deep-shaft-rig.test.ts`.) (owner: agent4)

## Milestone 9 progress
- Shifted GameCard art cropping upward (~10%) with a slight zoom across variants; updated the plan checklist. (Files: `apps/web/src/components/GameCard.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4)
- Improved GameCard readability with larger fonts, cost chips in bottom corners, and taller hand cards; updated the plan checklist. (Files: `apps/web/src/components/GameCard.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2)
- Added champion-target selection UI with an in-hand list and explicit selection indicator to disambiguate multiple champions on one hex; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2)
- Added dark-fantasy in-game palette overrides (background + palette variables) with nav/panel/button/status restyling; updated the plan subtask. (Files: `apps/web/src/App.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2) (Overlap note: `implementation_plan.md` also has agent3 edits in progress.)
- Added dark-theme overrides for market overlay surfaces and card tag/detail backgrounds to push the fantasy look; updated the plan subtask. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2)
- Added dark-theme overrides for sidebar sections, intel cards, player rows, and empty-state surfaces; updated the plan subtask. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2) (Overlap note: `progress.md` picked up agent4 active-task update.)
- Extended dark-theme variables to cards, hand/action panels, and command table rows for consistent in-game surfaces; updated the plan subtask. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2)
- Rebalanced dark-theme contrast by lifting card/hand surfaces and adding a themed board background + hex strokes for clearer board readability. (Files: `apps/web/src/styles.css`.) (owner: agent2)
- Restyled phase cue and action reveal overlays for dark theme with warmer panels and higher-contrast text. (Files: `apps/web/src/styles.css`.) (owner: agent2)
- Applied the dark-fantasy theme to cards/deck views, setup screens, and combat/hand-picker overlays; enabled theme class for non-game views. (Files: `apps/web/src/App.tsx`, `apps/web/src/styles.css`.) (owner: agent2)

## Milestone After Full Test Play and Thinking progress
- Added the gold emoji chip in the market bid HUD to match the resource iconography used elsewhere; updated the plan checklist. (Files: `apps/web/src/components/MarketPanel.tsx`, `implementation_plan.md`.) (owner: agent4) (Overlap note: `progress.md` includes agent2 active-task update.)
- Added mana/gold cost chips to the basic action buttons in the hand panel; updated the plan checklist. (Files: `apps/web/src/components/ActionPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent3)
- Converted the collection UI into a modal overlay with scrim/panel styling to avoid layout shifts; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4)
- Sequenced collection prompts to highlight mines, then forges, then center choices with a subtle dim/pulse; updated the plan checklist. (Files: `apps/web/src/components/CollectionPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/styles.css` has other in-flight edits.)
- Converted champion target selection into a floating overlay panel to avoid layout shifts; updated the plan checklist. (Files: `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent4)
- Marked the local player's capital with a ring indicator on the board view; updated the plan checklist. (Files: `apps/web/src/components/BoardView.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent3) (Overlap note: `implementation_plan.md` included a pre-existing burn test TODO; `progress.md` picked up an agent5 active-task entry.)
- Lifted hovered card grid items above neighbors in cards/market/collection/hand-picker views; updated the plan checklist. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent3)
- Clarified draw/discard/scrapped pile pills with delta badges and pulse animation in the hand panel; marked the plan checklist item complete. (Files: `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (Overlap note: `apps/web/src/components/GameScreenHandPanel.tsx` also in agent3 scope.)
- Updated the private view VP totals to recompute control points live from board occupation changes; marked the plan checklist item complete. (Files: `packages/engine/src/round-flow.ts`, `packages/engine/src/view.ts`, `implementation_plan.md`.)
- Highlighted Burn tags with distinct styling + subtle animation and split the burn UX checklist into clearer sub-items. (Files: `apps/web/src/components/GameCard.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.)
- Enabled card tags in the Card Editor and Cards tab so the Burn styling is visible during browsing. (Files: `apps/web/src/components/CardEditor.tsx`, `apps/web/src/components/CardsBrowser.tsx`.)
- Applied the dark theme styling to the Play home screen by enabling the game theme for the Play tab even before joining a room; marked the plan item complete. (Files: `apps/web/src/App.tsx`, `implementation_plan.md`.)
- Tuned the Play home hero + panels to use dark-theme gradients and borders so the “Enter the War Table” area matches the fantasy palette. (Files: `apps/web/src/styles.css`.)

## Milestone 8.5 progress
- Ensured the market overlay auto-opens when the first phase is market and added bell cues to age transition overlays.
- Added Mortar Shot target hint text explaining scatter/aoe in the hand target UI. (Files: `apps/web/src/components/GameScreenHandPanel.tsx`, `implementation_plan.md`.) (Overlap note: commit also picked up pre-staged Age II movement card work in `packages/engine/src/card-effects.ts`, `packages/engine/src/content/cards/age2.ts`, and `packages/engine/src/card-effects.breakthrough-line.test.ts`.)
- Limited Mortar Shot card hex highlights to tiles within range of friendly forces. (Files: `apps/web/src/components/GameScreen.tsx`, `implementation_plan.md`.)
- Added collection draw roll reveal animations (mine/forge/center) with `NumberRoll` styling and plan subtask updates. (Files: `apps/web/src/components/CollectionPanel.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.) (owner: agent2)
- Thickened power/champion GameCard borders for clearer differentiation and marked the plan item complete. (Overlap note: `apps/web/src/styles.css` touched.)
- Simplified the basic actions UI: removed pick/clear buttons, made march/bridge targets clickable fields, and auto-clear march destination when the start changes; marked the plan item complete in `implementation_plan.md`. (Overlap note: touched `apps/web/src/components/ActionPanel.tsx`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/styles.css`.)
- Extended the market overlay outro hold so the hand panel stays hidden briefly after market phase ends if the overlay was open; marked the plan item complete in `implementation_plan.md`. (Overlap note: `implementation_plan.md` had pre-existing edits; touched `apps/web/src/components/GameScreen.tsx`.)
- Restored basic action auto-pick mode on selection (bridge/march) per feedback; updated the plan item to match. (Overlap note: `apps/web/src/components/GameScreen.tsx` touched alongside agent1 scope.)
- Prevented the hand panel from appearing while the market overlay holds after market phase end; marked the plan item complete in `implementation_plan.md`.
- Made the hand/action panel semi-transparent with a subtle blur so the board reads through; marked the plan item complete in `implementation_plan.md`. (Overlap note: `apps/web/src/styles.css` touched.)
- Increased hand/action panel transparency after feedback to let the board read through more clearly. (Overlap note: `apps/web/src/styles.css` touched.)
- Added hand-panel hotkeys for action submission (Enter) and pass (P) and marked the plan item complete in `implementation_plan.md`. (Overlap note: `implementation_plan.md` also picked up pre-existing checklist edits.)
- Improved hand card selection UX: added a selected-card summary with target hints + clear button, enabled click-to-deselect, and cleared card selection when switching to basic actions; marked the plan item complete in `implementation_plan.md`. (Overlap note: `apps/web/src/styles.css` touched alongside agent4.)
- Moved local resource display to the header (gold/VP) and added a bottom-left mana orb near the hand panel; marked the plan item complete in `implementation_plan.md`. (Overlap note: `apps/web/src/styles.css` touched alongside agent3.)
- Added a market roll-off tie-break panel with suspenseful rolling dice numbers using a reusable `NumberRoll` component; marked the plan item complete in `implementation_plan.md`. (Overlap note: `apps/web/src/styles.css` touched alongside agent4.)
- Extended market roll-off to include pass-tie roll-offs, increased roll suspense timing, and labeled roll-offs in the log (engine market tests updated).
- Delayed the market winner highlight until after the roll-off animation completes and moved the roll-off panel to the center of the market layout. (Overlap note: `apps/web/src/styles.css` touched alongside agent1.)
- Made market roll-off rounds animate sequentially (no overlap) with per-round scheduling; marked the plan item complete in `implementation_plan.md`. (owner: agent4; files: `apps/web/src/components/MarketPanel.tsx`)
- Made the market roll-off animation duration configurable via `MARKET_ROLLOFF_DURATION_MS` in `DEFAULT_CONFIG` and documented it.
- Removed the Live connection pill from the header and enlarged gold/VP chips with clearer labels. (Overlap note: `apps/web/src/styles.css` touched alongside agent1.)
- Added compact gold/VP labels in the collapsed header chips so the HUD always shows text; marked the plan item complete in `implementation_plan.md`.
- Repositioned the mana orb to the hand panel bottom-right (outside the actions panel) to reduce the perceived empty space above the cards.
- Tightened the hand layout spacing and aligned the action panel to the bottom of the hand row to reduce empty vertical gaps.
- Switched the hand layout to a bottom-aligned flex row so actions and cards sit on the same baseline, reducing the empty quadrants in the hand panel.
- Centered the hand column content, let it stretch full width, and top-aligned the action panel to remove the remaining empty quadrants.
- Fixed hand-card hover popout stacking/spacing so hovered cards render above the actions column without clipping; marked the plan item complete in `implementation_plan.md`.
- Raised hand-panel z-index and reordered hover/pass layering so hovered cards sit above most UI while pass/submit stays on top.
- Let the hand cards column span under the actions column with padding so hovered cards can overlap the actions area without clipping.
- Added unique faction symbols (small circle badges) across faction selection, lobby labels, unit stacks, and victory screen; marked the plan item complete in `implementation_plan.md`.
- Added short faction descriptions to the pre-game faction cards for extra theme color; marked the plan item complete in `implementation_plan.md`. (owner: agent1)
- Restyled champion markers above stacks into circular tokens with glyph placeholders; marked the plan item complete in `implementation_plan.md`.
- Added champion hover tooltips on board tokens with HP/attack/damage and a rules snippet; marked the plan item complete in `implementation_plan.md`.
- Tightened champion tooltip width, expanded rules text lines to reduce truncation, and switched champion token labels to current HP.
- Removed the unit ring + faction badge chip, restored champion glyph labels, and added a small HP pip on each champion token.
- Removed the champion crest marker on stacks and widened multi-champion token spacing.
- Removed the native browser tooltip on unit stack/champion token hover so only the custom SVG tooltip appears.
- Overlap note: commit also picked up pre-staged changes in `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/GameScreenHandPanel.tsx`, and `implementation_plan.md`.
- Increased bridge preview hitbox width to make edge selection easier. (Overlap note: touched `apps/web/src/styles.css` alongside agent3/agent4.)
- Fixed duplicate `edgeKeys` variable name in `GameScreen` target reveal helper to resolve Vite compile error.
- Removed duplicate `showTags` prop in `GameScreen` BoardView to fix Vite JSX warning.
- Added emoji resource symbols (gold/mana/VP) in the command center + table stats with distinct colors for easier scanning.
- Slimmed the action strip: moved Pass/Submit + deck counts into the hand footer, simplified basic actions, and added a command-center table with per-player gold/mana/hand counts.
- Aligned action enablement with action-step waiting eligibility and added action-panel hints for disabled states (no mana/submitted/not action phase).
- Overlap note: commit also captured a BoardView pan/zoom clamp loosen (margin 0.15 → 0.3) + implementation plan task tweaks from agent2.
- Loosened the BoardView pan clamp further (margin 0.45) to allow more off-screen drag freedom.
- Loosened the BoardView pan clamp again (margin 0.7) and avoided clearing drag state on pointer leave while a drag capture is active to reduce edge jitter.
- Added show/hide controls for the hand panel, made the actions column collapsible, and removed internal scrolling from the bottom hand area.
- Removed the duplicate action panel, tightened the game view to fit the viewport, and reduced the board height while keeping the intel dock as a fixed overlay.
- Consolidated the GameScreen layout: moved the action panel into the hand row, added an intel dock for players/log, and tightened the sidebar into status/resources/intel summaries (styles updated).
- Dropped the remaining target strip under the hand and made choice/champion card targeting board-driven (capital/center click + champion-hex cycling).
- Added a reusable `GameCard` component with art/cost/initiative details, refactored card displays (hand, market, deck, cards browser, free starting offers), and marked the plan item complete in `implementation_plan.md`.
- Refined `GameCard` layouts: centered titles, italicized type line, initiative circles, age labels above art, cost line with emoji, larger hand/market sizing, and power/champion borders (overlap: `apps/web/src/styles.css` with agent1).
- Increased card height/sizing in the hand + market views, stretched art areas, and slimmed the hand action column to give cards more space.
- Removed the full-size card preview under the hand panel; kept a compact targets strip instead.
- Added a rules/tutorial placeholder panel on the Home landing page and marked the plan item complete in `implementation_plan.md`.
- Added a Deck tab that shows hand/draw/discard/scrapped piles for the local player, backed by new private `deckCards` data in `GameView`, and marked the plan item complete in `implementation_plan.md`.
- Refreshed the Home landing page layout/typography and marked the plan item complete in `implementation_plan.md`.
- Added seat-index player colors for units/bridges and player list swatches, and marked the plan item complete in `implementation_plan.md`.
- Added pregame faction selection with start gating on all picks, surfaced chosen factions in the setup lobby, and marked the plan item complete in `implementation_plan.md`.
- Added action status pills (idle/waiting/submitted) to the player list for action phase visibility; plan update deferred until `implementation_plan.md` is free.
- Added a phase transition cue overlay that flashes round phase changes in big text and marked the plan item complete in `implementation_plan.md`.
- Made action status more obvious with a player-list summary and row highlighting, and marked the plan item complete in `implementation_plan.md`.
- Reduced duplicate status pills in the command center by removing the summary chips (status still shown per player).
- Removed per-row On/Off pills from the table list to reduce status noise.
- Overlap note: commit also included pre-staged edits in `apps/web/src/components/BoardView.tsx` and `apps/web/src/styles.css` from another agent.
- Removed the in-game Leave Room button from the HUD header to keep the top bar cleaner.
- Added a large Submit/Lock In action button to the action panel and marked the plan item complete in `implementation_plan.md`.
- Added action-panel helper copy clarifying Done/Reinforce/Bridge/March/Play actions and marked the plan item complete in `implementation_plan.md`.
- Submit button now reflects the selected action (Play Card/Build Bridge/etc.) to remove the play-vs-submit confusion; marked the plan item complete in `implementation_plan.md`.
- Wired Vapourborn Wings UI targeting so reinforce/capital-choice actions can select the center when occupied (passes `hexKey`).
- Replaced market focus row with a full-screen overlay + toggle, redesigned market cards with art placeholders and metadata, and marked Milestone 8.5 market tasks complete in `implementation_plan.md`.
- Added an order rail to the market overlay and tightened market card sizing so the overlay reads as a sequenced card run; marked the related checklist items complete in `implementation_plan.md`.
- Hid market bid details in the status list until all bids are submitted and marked the plan item complete in `implementation_plan.md`.
- Added a market winner highlight/animation on the overlay cards and marked the plan item complete in `implementation_plan.md`.
- Enabled direct edge clicks for bridge/card edge targeting (preview edges even before selecting a start hex) and noted the subtask in `implementation_plan.md`.
- Fixed edge-pick hex selection by letting unit stack clicks trigger hex targeting (Bridge Crew/build bridge) and marked the plan item complete in `implementation_plan.md`.
- Fixed SetupCapitalDraft hook ordering to prevent hook-mismatch crashes once capital draft completes, unblocking manual setup progression.
- Delayed BoardView pointer capture until pan/pinch starts so edge/hex clicks register reliably during targeting.
- Disabled hex clicks/highlights during edge targeting so only edges are selectable; updated card edge hint copy and marked the plan item complete in `implementation_plan.md` (overlap: `apps/web/src/components/GameScreen.tsx` touched alongside agent4 scope).
- Removed the board header/hints and tightened board panel padding to reduce wasted space above the board; marked the plan item complete in `implementation_plan.md`.
- Improved champion visibility on the board with a halo + brighter label and marked the plan item complete in `implementation_plan.md` (overlap: `apps/web/src/styles.css` touched alongside layout tweaks).
- Added champion name/HP badges above stacks for clearer champion visibility and marked the plan item complete in `implementation_plan.md`.
- Made the sidebar Table view more compact with a column header, aligned stats, and compact status pills; marked the plan item complete in `implementation_plan.md`.
- Tightened Table spacing and stacked compact status pills (removed uppercase) to prevent overflow on narrower sidebars (overlap: `apps/web/src/styles.css` with agent4).
- Auto-enabled card board targeting on card select (edge/stack/path/hex/choice) and updated card target buttons to show when board picking is active; marked the plan item complete in `implementation_plan.md`.
- Moved starting bridge placement into a board-based picker with clickable edge previews and setup hints in the lobby UI (overlap: `apps/web/src/styles.css` with agent1).
- Compressed the bottom hand panel spacing, card sizing, and detail typography to reduce its vertical footprint; marked the plan item complete in `implementation_plan.md`.
- Added an action card reveal overlay that sequences resolved card plays with target summaries + board highlights, and animated unit stack movement transitions during board updates.
- Slowed the action card reveal overlay timing for a less abrupt reveal.
- Reworked the hand panel layout: stacked basic action buttons, moved deck counts to header pills, and floated Pass/Submit controls; marked the plan items complete in `implementation_plan.md`.
- Smoothed basic Build Bridge picking by auto-entering edge pick mode on Bridge selection and exiting pick mode after an edge click; marked the plan item complete in `implementation_plan.md`. (Overlap note: commit also picked up staged `apps/web/src/components/BoardView.tsx` + `apps/web/src/styles.css` edits and `implementation_plan.md` changes while agent4 was active.)
- Loosened BoardView pan bounds further so the board can be dragged more freely off-screen; marked the plan item complete in `implementation_plan.md`.
- Adjusted the hand panel overlay to stop reserving vertical space and slimmed the actions column width.
- Hid scrollbars on the hand card row while keeping horizontal scroll.
- Refined Pass/Submit placement: removed the visible container, widened buttons evenly, and nudged the bar lower.
- Nudged the Pass/Submit bar further down to sit closer to the screen edge.
- Raised the Pass/Submit bar z-index above idle cards while keeping hovered cards on top.
- Added an age/start-of-game transition cue overlay and marked the plan item complete in `implementation_plan.md`.
- Shortened bridge render segments so they no longer draw center-to-center; marked the plan item complete in `implementation_plan.md`.
- Shortened bridge render segments a bit further by increasing the inset.
- Loosened BoardView pan bounds so the board can be dragged farther off-screen and marked the plan item complete in `implementation_plan.md`.
- Overlap note: included unclaimed `implementation_plan.md` TODO additions (champion hover details, reveal length/settings tweaks, hand hover z-index).
- Added a1-style hex labels to the game board with top-to-bottom row letters and left-to-right numbers via BoardView label variants; marked the plan item complete in `implementation_plan.md` (overlap: `implementation_plan.md`, `progress.md` with agent4).
- Updated event log formatting to use a1-style board labels instead of axial coords (overlap: `apps/web/src/components/GameScreen.tsx` with agent4).
- Updated event log formatting to use card names instead of card ids (overlap: `apps/web/src/components/GameScreen.tsx` with agent4).
- Overlap note: `implementation_plan.md` updated while agent2 is pruning plan tasks.
- Moved the map legend below the board and hid special-tile tags on the game board (hover tooltip still shows tile info); marked the plan items complete in `implementation_plan.md`.
- Moved the board tools bar (selected hex + reset view) into the footer under the board to reduce top clutter.
- Floated the selected-hex chip and reset view button over the board (top-left) with matched heights to save vertical space.
- Shrunk the board overlay controls and switched the selection label to use the board's A1-style tile labels instead of axial coords.
- Updated the game board SVG to stretch to available height so it reaches the legend without extra empty space.
- Added a reusable hand-card picker modal for topdeck-from-hand effects (Perfect Recall), with hand-panel controls to select or clear cards.
- Set the main board layout to flex-fill and raised the hand panel z-index so it stays above the board when open.
- Positioned the hand panel as an absolute overlay so opening/closing it no longer resizes the board.
- Verified multi-player (3-4 player) engine flow via expanded smoke coverage and marked the plan item complete in `implementation_plan.md`.
- Made action reveal duration configurable via game config (propagated to the overlay) and removed card IDs from the reveal modal; marked the plan items complete in `implementation_plan.md`.
- Added action reveal overlays for basic actions (build bridge/march/reinforce) with A1-style target labels; marked the plan item complete in `implementation_plan.md`. (owner: agent3)

## Milestone 9 progress
- Forced the market overlay to surface the winner animation for the last card even if the overlay was closed, so the end-of-market win reveal always shows. (Overlap note: `apps/web/src/components/GameScreen.tsx`.)
- Moved the Victory VP badge into the card description area so it doesn't push the art down.
- Slightly enlarged the Victory VP badge for better legibility in the rules area.
- Made GameCard art areas taller with a framed border treatment across variants and marked the plan item complete. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.)
- Tweaked GameCard art heights and strengthened the art frame border for more visual punch. (Files: `apps/web/src/styles.css`.)
- Nudged GameCard art heights a touch taller across variants. (Files: `apps/web/src/styles.css`.)
- Added Victory card VP badges in `GameCard`, wired configurable `victoryPoints` in card defs/engine VP gain, and added coverage in engine card tests.
- Enabled champion stat blocks on market/hand GameCard views with compact hand styling; marked the plan item complete in `implementation_plan.md`. (Overlap note: `implementation_plan.md` touched alongside agent2 scope.)
- Enlarged market roll-off dice UI and added clearer player labels; added a plan subtask for the remaining click-to-roll wiring. (Overlap note: `implementation_plan.md` touched alongside agent2 scope; commit also picked up pre-staged `packages/engine/src/content/cards/age2.ts` + `packages/engine/src/content/cards/index.ts` changes from agent2.)
- Clarified the champion hover tooltip to call out that the blue dot shows remaining ability uses.
- Added a unit stack arrival pulse animation in the board view to make movement clearer during action reveals; marked the plan item complete in `implementation_plan.md`. (Overlap note: `apps/web/src/components/BoardView.tsx`, `apps/web/src/styles.css`.)
- Added faction labels (symbol + name) on CardsBrowser card tiles to denote faction-specific cards; marked the plan item complete in `implementation_plan.md`. (owner: agent1)
- Added softer click sfx tags to main menu view toggles and Home create/join buttons for more audio coverage.
- Added UI sound effects (click/error/bell) with a global click handler, round bell cue, and moved audio files into web assets; marked the plan item complete in `implementation_plan.md`.
- Enforced unique faction picks in the lobby (server rejects duplicates; UI disables taken factions with status styling) and marked the plan item complete in `implementation_plan.md`. Overlap note: touched `apps/server/src/server.ts` + `apps/web/src/components/PreGameLobby.tsx`, which are in agent3's manual setup scope.
- Added a victory screen overlay with winner + final VP recap, wired rematch/exit controls, and exposed public VP in `GameView` only after a winner is declared; marked the plan item complete in `implementation_plan.md` (overlap note: touched `apps/web/src/styles.css` alongside agent2 scope).
- Clarified Pass/Done messaging in the action panel so players know it locks them out for the step, and marked the plan item complete in `implementation_plan.md` (overlap note: `implementation_plan.md` already had pending task additions in the action/market sections).
- Added a deck flow UI in the Deck tab showing draw/hand/discard/scrapped piles with animated arrows; marked the plan item complete in `implementation_plan.md`.
- Improved board visuals with hex padding, a textured board backdrop, and beefier bridge styling; marked the plan item complete in `implementation_plan.md`.
- Added a host-only debug state patch tool in the room debug panel + server command, and marked the plan item complete in `implementation_plan.md`.
- Added a champion crest marker on unit stacks to make champion presence easier to spot on the board.
- Added compact faction badge glyphs on unit stacks and a unit ring to make tokens more distinct at a glance.
- Fixed a BoardView crash by destructuring `playerFactionById` before rendering faction badges.
- Added a march force-count picker (move all vs split) to the action panel UI and passed `forceCount` through submit payloads; updated `implementation_plan.md` to split remaining card-move UI work.
- Added force-count controls for card-driven stack moves in the hand targets panel and marked the plan item complete in `implementation_plan.md`.
- Added engine support for partial force moves (optional `forceCount`), updated Quick Move/Banner Claim to move 1 force, and refreshed action-flow coverage; `implementation_plan.md` split UI vs engine subtasks.
- Overlap note: commit included pre-staged battle UX files `apps/web/src/components/CombatOverlay.tsx` and `apps/web/src/lib/combat-log.ts` from another agent's scope.
- Added combat round logging with dice/hit assignment payloads and a battle overlay that supports click-to-roll dice with hit assignment display; marked the Milestone 9 battle UX item complete in `implementation_plan.md`.
- Rendered bridges as plank/rail SVG assets in the board view and marked the plan item complete in `implementation_plan.md`.
- Standardized bridge rendering to a neutral color (no owner tint) and confirmed engine movement ignores bridge ownership.
- Fixed lobby map preview overflow in the setup reroll panel by clamping preview height; marked the plan item complete in `implementation_plan.md`.
- Kept the market overlay visible briefly after market ends so the final winner highlight/animation shows; marked the plan item complete in `implementation_plan.md`.
- Disabled board SVG text selection to prevent accidental highlights; marked the plan item complete in `implementation_plan.md`.
- Added a pass confirmation step when mana remains before ending the action step; marked the plan item complete in `implementation_plan.md`.
- Added a Bounty Hunter champion kill-reward test to cover bonus gold on champion kills in battle.

## Bug audit progress
- Logged potential issues from the quick scan in `docs/bugs.md`.
- Fixed force unit id generation to avoid collisions and added coverage.
- Guarded combat resolution against no-hit stalemates and added a test.
- Added combat start/end event logs (with outcomes) and coverage.
- Wired event logs for phase transitions and action resolution so UI logs are populated.
- Logged setup actions (capital picks, starting bridges, free starting card) so UI logs show setup activity.
- Free starting card now uses a shared deck (offers without independent shuffles) and returns unchosen cards to the bottom.
- ActionPanel now allows “Done” submissions even when mana is 0.

## Faction passives progress
- Added Gatewright passives (capital assault + extortionists) and Virteous clean-exit heal modifier with combat coverage; implementation plan update deferred until `implementation_plan.md` is free.
- Implemented Leadbound Home Guard (+1 force on capital deploy) via deploy-count hook; updated action flow/card effects tests.
- Implemented Virteous Contracts (+2 gold per champion kill) via a champion-kill reward hook and added combat coverage; updated `implementation_plan.md`.
- Implemented Cipher Expanded Choice (extra card offers on free-start + collection prompts), plus mine-draft multi-reveal selection support; marked plan item complete.
- Implemented Vapourborn Tailwind (+1 max move distance on first stack move per round) via a moved-this-round flag + move validation hook, with action-flow coverage.
- Implemented Vapourborn Wings (deploy to center as capital when occupied) via shared capital-deploy resolver and action-flow coverage; UI can pass `hexKey` for center targeting when ready (overlap: `packages/engine/src/action-flow.ts`).
- Implemented Refiner Deep Tunnels (occupied mines treated as adjacent for movement) via a move-adjacency modifier hook, updated march validation, and added action-flow coverage; marked `implementation_plan.md`.
- Implemented Gatewright capital occupation VP bonus (+2 control VP on enemy capitals) via a scoring hook + coverage; marked plan item complete.

## Testing progress
- Added action-flow coverage for Flank Step (bridge-less move) + Scavenger's Market (gold + draw).
- Added action-flow coverage for Supply Ledger, Patrol Record, and Banner Claim.
- Added action-flow coverage for Quick March, Trade Caravan, and Quick Study.
- Expanded smoke tests to cover 3-4 player auto-resolve + randomized flows in `packages/engine/src/smoke.test.ts`.
- Expanded smoke tests to cover 5-6 player auto-resolve + randomized flows in `packages/engine/src/smoke.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/smoke.test.ts`.
- Added card draw tests covering reshuffle behavior and hand-limit overflow in `packages/engine/src/cards.test.ts`.
- Added tests for card instance id sequencing and random draw-pile insertion in `packages/engine/src/cards.test.ts`.
- Added Victory card gain VP coverage in `packages/engine/src/cards.test.ts`.
- Added collection-choice resolution tests (mine draft accept/decline, forge reforge, center pick) in `packages/engine/src/round-flow.test.ts`.
- Added a smoke sim auto-resolve test in `packages/engine/src/smoke.test.ts`.
- Added a randomized smoke sim test that picks legal commands in `packages/engine/src/smoke.test.ts`.
- Added regression coverage for invalid card declarations not spending resources or removing cards in `packages/engine/src/action-flow.test.ts`.
- Ran `npm test` (engine Vitest).
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts` (card coverage + regressions).
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts` (collection-choice coverage).
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts src/market.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/smoke.test.ts` (auto-resolve + randomized smoke sims).
- Ran `npm run -w @bridgefront/engine test -- src/market.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/cards.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/modifiers.test.ts src/combat.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts src/setup-flow.test.ts src/smoke.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/round-flow.test.ts`.
- Ran `npm run -w @bridgefront/engine test -- src/action-flow.test.ts` (Hold the Line/Marked for Coin/Perfect Recall coverage).

## Docs maintenance
- Expanded the Milestone 9 card-test checklist with Age I market sub-items in `implementation_plan.md`.
- Added an owner-only TODO to `docs/dev.md` for replacing placeholder faction symbols with final icons and where to wire them.
- Restored the previously removed completed milestone sections in `implementation_plan.md` per request.
- Added a Milestone 8.5 TODO for a reusable hand-card picker/topdeck modal in `implementation_plan.md`.
- Added a Milestone 9 TODO for bridge art assets/rendering in `implementation_plan.md`.
- Marked the Milestone 9 Age I market card-test item (Supply Ledger/Patrol Record/Banner Claim) complete in `implementation_plan.md`.
- Checked off the remaining Age I market card-test checklist item (Quick March/Trade Caravan/Temporary Bridge/Patch Up/Quick Study) in `implementation_plan.md`.
- Cleaned `implementation_plan.md` and `progress.md` (removed duplicate UI tasks, marked starting-bridge board picking as complete, trimmed test log clutter).
- Overlap note: `implementation_plan.md` already included a champion-visibility wording tweak + new table-view readability task while cleaning.
- Updated milestone checkboxes in `implementation_plan.md` to match current status.
- Rewrote Milestone 9 notes into a coherent checklist in `implementation_plan.md`.
- Marked the Milestone 7 champion ability hook tasks complete in `implementation_plan.md`.
- Converted Milestone 6.5 notes into checklist tasks and marked the market quick-bid UX item complete in `implementation_plan.md`.
- Expanded the Milestone 5.5 phase-focused layout task with subitems and marked the focus row/log+player move subtasks complete.
- Noted Banner Claim addition under the Milestone 8 Age I market expansion tasks in `implementation_plan.md`.
- Reviewed the latest `rules_draft.md` card updates and added missing plan items (remaining faction passives, champion hook expansion, new card effect primitives, Age II/III + power deck expansion).
- Expanded `implementation_plan.md` with rules-driven card/champion backlog items (champion abilities, card effect primitives, deck expansions, and test coverage). (Overlap note: edited `implementation_plan.md` while agent2 task is active.)
- Added guidance to `agent_instructions.md` on reconciling other-agent/tooling changes.
- Updated `agent_instructions.md` to require logging task scope/files in `progress.md` before coding and clearing entries after completion.
- Added git hygiene guidance in `agent_instructions.md` to minimize user interruptions and preserve work.
- Updated `agent_instructions.md` to allow overlapping edits for throughput and to include unclaimed changes with logging.
- Audited `implementation_plan.md` and marked Milestone 5.5 interaction styling + Milestone 6 Market UI as complete.
- Marked the Milestone 6.5 board target friction task complete in `implementation_plan.md`.
- Added a Lobby polish item to `implementation_plan.md` for board preview + reroll (future work).
- Documented the new Cards debug view in `docs/cards.md`.
- Reprioritized setup UX into a new Milestone 4.5 (playtest unblock) in `implementation_plan.md`.
- Audited docs for stale items (implementation plan checkboxes, market preview naming/mapping, dev nav notes).
- Added Milestone 5.5 UI interaction + polish tasks (hand/board targeting/pan-zoom) to `implementation_plan.md`.
- Refreshed Milestones 5-6 checkboxes and noted partial UI polish status in `implementation_plan.md`.
- Marked the Milestone 8 smoke sim task complete in `implementation_plan.md`.
- Audited `rules_draft.md` alignment and logged follow-ups in `implementation_plan.md`.
- Expanded Milestone 5.5 layout tasks in `implementation_plan.md` with phase-focused subtasks.
- Marked Leadbound Shield Wall faction passive as done in `implementation_plan.md`.
- Added PartyKit docs to the repo, added `apps/web/dist` to `.gitignore`, and captured outstanding tracked edits in git.
- Logged an unclaimed plan tweak adding piece-movement animation notes to the card-reveal task (overlap: `implementation_plan.md`).
- Documented `ACTION_REVEAL_DURATION_MS` in `docs/configuration.md` and added an owner note in `docs/dev.md`.

## Setup balance notes
- Reviewed setup placement logic and drafted balance ideas (symmetry/score-based placement, resource equity thresholds, default rule tweaks); pending decision.
- Added a capital-balance penalty to special-tile scoring to spread forges/mines more evenly across capitals.
- Added a global-spread score so mines/forges avoid clustering and reduce empty regions (notably 3-5 players).
- Increased mine counts by 1 per player count and updated mine value weights to make yield 3 more common.
- Added a low-probability mine value 7 weight in the default mine value distribution.

## Cleanup/organization progress
- Extracted setup flow helpers into `packages/engine/src/setup-flow.ts` so `engine.ts` stays orchestration-focused.
- Added card/deck helpers (`cards.ts`), unit helper (`units.ts`), and starter deck data (`content/starter-decks.ts`).
- Moved view construction (`buildView` + setup view helpers) into `packages/engine/src/view.ts` and updated exports.
- Refactored `apps/web/src/components/GameScreen.tsx` into `apps/web/src/components/GameScreenHeader.tsx`, `apps/web/src/components/GameScreenSidebar.tsx`, and `apps/web/src/components/GameScreenHandPanel.tsx` for readability; marked the Milestone 6.5 refactor task complete in `implementation_plan.md`.

## Cleanup/organization TODOs
none

## UI polish TODOs
- none

## UI polish progress
- Added hover tooltips for hexes, bridges, and unit stacks in the board view.
- Added a champion-target picker in the card detail panel to set unit targets from the board state.
- Tightened board panning drag threshold to avoid click misfires.
- Added soft bounds clamping on board pan/zoom so the map stays in view.
- Reworked the hand UI into a fan-style card row with hover zoom, selected highlighting, and disabled styling.
- Added valid-target overlays for board pick modes (hex highlights + edge previews) during action/card targeting.
- Added hover highlight styling for interactive hexes/edges and clickable preview edges for edge pick modes.
- Added touch/pinch support for board pan/zoom in the board view.
- Removed manual axial-coordinate inputs for action/setup bridge/march picks, added card hex target picking, and surfaced target summaries in the action panel.
- Added per-player action status tooltips on the player list in the game sidebar.
- Added lightweight motion for target highlights, preview bridges, selected cards, and card detail reveals.
- Added interaction state styling for board + controls (targeting outline, hex/bridge transitions, action-field active/error labels).
- Added phase status pills and an idle-phase callout, with phase-gated action/market/collection panels in the game sidebar.
- Moved the hand UI into a full-width bottom panel during the action phase and surfaced VP in the resources block.
- Added a collapsible GameScreen header with a compact HUD toggle for play sessions.
- Added a phase-focused layout row for market/collection panels and moved log/player sections into a secondary row during those phases.
- Reduced board target click friction by ignoring invalid hex clicks while targeting and allowing start reselects for multi-step picks.
- Enabled scrolling in the command-center sidebar so 5-6 player tables stay readable without clipping.
- Added collapsible toggles for Status/Table/Intel sections in the command-center sidebar.
- Stabilized BoardView pan/zoom by avoiding viewBox resets when board state updates (plan update deferred: `implementation_plan.md` locked by agent3).
- Upgraded collection prompts to show full card tiles (initiative/rules/costs) for revealed picks instead of tag buttons.
- Added a collapsible Command Center sidebar toggle so the board can expand when the right panel is hidden; marked the plan item complete in `implementation_plan.md`.
- Added a champion-target card pick mode with valid-target highlights so Emergency Evac (and other champion cards) can be selected from the board; updated `implementation_plan.md`. (Files: `apps/web/src/components/ActionPanel.tsx`, `apps/web/src/components/GameScreen.tsx`, `implementation_plan.md`.)
- Fixed hand/hand-picker card art lookups by using defIds for GameCard art and marked the plan item complete. (Files: `apps/web/src/components/GameScreenHandPanel.tsx`, `apps/web/src/components/HandCardPickerModal.tsx`, `implementation_plan.md`.)
- Enlarged hand card mana/gold cost display for better readability; marked the plan item complete. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.)
- Restyled card type labels with larger, colored pills for Champion/Victory/Spell/Order cards; marked the plan item complete. (Files: `apps/web/src/styles.css`, `implementation_plan.md`.)

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
- Added setup flow blocks and commands for capital draft, starting bridges, and free starting card; setup now advances to `round.reset` with tests. Free starting card uses the configured card pool (now real card IDs).
- Added starting forces + starter deck initialization after capital draft (defaulting to Leadbound if no faction chosen), with champion in hand and draw to 6 before starting bridges.
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
- Added Age I market cards using existing effects: Flank Step, Scavenger's Market, Supply Ledger, Patrol Record.
- Added Banner Claim (Victory: move 1 stack 1 hex along a Bridge) to the Age I market card list.
- Added Age I bridge/terrain cards (Sabotage Bridge, Bridge Trap, Tunnel Network) using existing bridge effect primitives.
- Added Age I recruitment cards (Recruit Detachment, Paid Volunteers, National Service) plus recruit effect custom counts with test coverage.
- Added card registry tests for unique IDs and starter/free-start coverage.
- Added an initial Age I market deck list export under `packages/engine/src/content/market-decks.ts`.
- Added market deck tests to validate ids are unique, registered, and age-appropriate.
- Added derived card tags for burn/power/victory/champion in the registry, with tests.
- Added Age I champion cards for Bounty Hunter, Sergeant, and Traitor to the Age I market list.

## Debug UI progress
- Added local board inspector in `apps/web` with seed + player count controls and SVG rendering of capitals/forges/mines.
- Board inspector now labels special tiles (CAP/FORGE/MINE/CTR) on the hexes.
- Fixed hex fill styles so tiles render in their intended colors.
- Added dev-only room debug tools (state JSON fetch, advance phase, reset with seed) plus server debug commands for host-only use.

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
- GameView now includes hand card metadata, and the hand list shows card names alongside instance IDs.
- Game log list now formats key events into readable strings (setup/actions/combat/phase).
- Lobby now includes a room code copy control with clipboard fallback.
- Pre-game waiting panel now surfaces a room-code copy control for hosts before the lobby starts.
- Lobby now includes a shared dice roller (d6) with last-roll display and room-wide broadcast.
- Lobby map preview now rolls from the game seed and host can reroll the map during setup.
- Lobby map reroll now locks after the first capital pick (server guard).
- Replaced auto-start with host-controlled start, with a pre-game lobby snapshot + start button so up to 6 players can join before setup begins.
- Added a Cards debug tab with filters (age/deck, mana cost, type, tags) and initiative sorting.
- Polished the Cards tab layout for denser grids, deck accents, and compact rule previews.
- Refined Cards tab tag styling with tighter radius and centered labels.
- Game board now supports pan/zoom + reset view, with click selection/highlights for targeting.
- Hand cards are clickable to prefill card play inputs and show card details/target helpers.
- Action panel now supports board-pick buttons for bridge/march inputs and shows board pick mode.
- Player panel now surfaces lead player in the resources block.

## Milestone 4.5 progress
- Added a capital draft panel in the setup lobby that lists available slots, shows pick order/status, and submits `pickCapital` choices from the client.
- Capital draft map preview now shows numbered slot labels, and draft UI uses those labels with coord tooltips.
- Added a dev-only auto-setup command on the server (host-only) to auto-pick setup choices for faster testing.
- GameView now exposes setup block info (public setup payload + private free-card offers) to support setup UI.
- Added setup lobby UI for starting bridges (edge input + suggested edges + per-player status).
- Added setup lobby UI for free starting card picks (private offers + pick status).
- Added a host-only auto-setup button in the setup lobby.

## Milestone 5 progress
- Added action-step card declarations for no-target cards (gain gold/draw cards) with initiative-ordered resolution before basic actions; cards leave hand on declaration and discard/burn after resolution, plus Supply Cache coverage.
- Added Refinering card effect handling (base + mine bonus gold) with action-flow tests.
- Added moveStack/buildBridge card effect support with target validation and action-flow tests (stack/path moves + temporary bridge).
- Added Bridge Crew support with edge + optional move path validation and coverage.
- Added champion-target card support (heal/damage/patch up) with action-flow tests (heal cap, capital bonus, bounty on kill).
- Added Recruit choice targeting (capital vs occupied hex) with effect handling and tests.
- Added Scout Report effect (deterministic top-card keep) using top-of-deck extraction + hand overflow handling with action-flow coverage.
- Added debug card-play inputs in the action panel to submit card declarations with optional targets JSON during the action phase.
- GameView now surfaces action-step eligible/waiting players, and the action panel lists waiting/submitted names.

## Milestone 6 progress
- Added market deck scaffolding per age with shuffle on game creation (Age II/III placeholders for now).
- Added market row prep using preview mapping + deck draws, plus cleanup resets to clear the row each round.
- Added market row tests covering preview composition and no-op behavior when a row exists.
- Market sidebar now shows card names and bid/pass status per player.
- Added market bid controls in the web client and wired `SubmitMarketBid` commands.
- Added quick bid buttons (1-4) in the Market panel to set common bid amounts faster.
- Implemented market bidding block (buy/pass, tie-break roll-offs, pass pot, one-win-per-round) with command handling + resolution, added market bidding tests, and updated setup/action tests to auto-resolve market.
- Added power deck scaffolding + init (currently seeded from market deck lists as a placeholder), and center picks now draw from power decks; updated collection resolution/tests accordingly.
- Added a collection sidebar panel that renders mine/forge/center prompts and submits `SubmitCollectionChoices` commands.
- Aligned the collection panel props with `GameScreen` and added collection prompt styles in `apps/web/src/styles.css`.
- Added market row reveal events and formatted market buy/pass logs in the UI.
- Victory cards now grant +1 permanent VP on gain (via draw pile insertion).

## Milestone 7 progress
- Implemented champion card play (hex targeting validation + deployment), champion gold cost scaling, and champion limit checks in engine with tests.
- Added champion HP details to board stack tooltips in the UI.
- Added Leadbound Shield Wall passive as a permanent faction modifier, wired during setup, with setup/combat coverage.
- Added Refiner Ore Cut (mine gold +1) and Mine Militia (defender forces hit on 1-3 in mines) passives with combat/collection coverage.
- Added combat modifier query pipeline (force/champion stats + hit assignment policy), before/after combat hook dispatch, and coverage.
- Implemented modifier duration expiry (end-of-battle/end-of-round + uses consumption) with tests.
- Added `deployForces` and `increaseMineValue` card effect support for faction starter spells (Air Drop, Rich Veins) with action-flow coverage.
- Added Mine Overseer Extraction bonus (+1 mine gold while occupying a mine) with collection coverage.
- Implemented champion abilities: Bodyguard hit redirect, Assassin's Edge pre-combat damage (per-round uses), and Flight movement override; added combat + action-flow coverage.
- Implemented Hold the Line + Marked for Coin + Perfect Recall effects (modifier/topdeck handling) and added action-flow coverage.
- Implemented Cipher Quiet Study (round-start discard up to 2 then redraw) with a new `round.study` block, UI modal, and engine smoke/round-flow coverage.
- Moved Quiet Study to trigger after market resolution and normalized hand picker card heights.
- Overlap note: included pre-existing `packages/engine/src/index.ts` export update for `CARD_DEFS_BY_ID`.
- Added Archivist Prime dice scaling (cards played this round) + Wormhole Artificer solo-move bonus, plus card-play counter reset/increment logic and action-flow tests.
- Added per-round discard tracking in player flags (counts Scout Report discards and hand-limit overflow), reset each round, with action-flow coverage.
- Verified engine coverage with `npm run -w @bridgefront/engine test`.
- Added targeting immunity modifiers (Ward/Immunity Field), attached Marked-for-Coin flags to champions, and added action-flow tests for enemy targeting blocks.
- Added modifier hooks for on-card-draw and end-of-round events, wired draw/cleanup dispatch, and covered with engine tests.
- Added lock-bridge card effect support (locks an existing bridge until end of round) with action-flow coverage; marked subtask in `implementation_plan.md`. (Overlap note: touched `implementation_plan.md` while agent3 active.)
- Added destroy-bridge card effect support for edge-targeted cards with action-flow coverage; marked subtask in `implementation_plan.md`. (Overlap note: touched `implementation_plan.md` while agent3/agent2 active.)
- Added Age I champion cards for Skirmisher Captain + Bridge Runner, with on-deploy force add and pathfinder movement support, plus engine tests.
- Added Age I champion cards for Inspiring Geezer + Brute, with combat modifiers and engine tests.
- Added bridge trap modifiers (first enemy crossing loses a force) via move hooks with action-flow coverage.
- Added hex-link movement modifiers for wormhole/tunnel network effects (linkHexes + linkCapitalToCenter) with action-flow coverage; marked the plan items complete.
- Added board effect badges for attached edge/hex modifiers using public modifier views; marked the optional plan item complete. (Overlap note: touched `packages/engine/src/types.ts`, `packages/engine/src/view.ts`, `apps/web/src/components/GameScreen.tsx`, `apps/web/src/components/BoardView.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`.)
- Added champion ability usage counters on board tokens and marked the optional plan item complete. (Overlap note: touched `apps/web/src/components/BoardView.tsx`, `apps/web/src/styles.css`, `implementation_plan.md`, `progress.md` while agent3 is active.)
- Added Traitor on-death mana wipe and Bounty Hunter champion-kill bonus gold hooks, with combat tests.
- Added Siege Engineer on-deploy bridge destruction with champion ability test coverage.
- Added Duelist Exemplar/Lone Wolf/Reliable Veteran champion dice mods and tests; marked the plan item complete in `implementation_plan.md`.
- Added Tax Reaver kill-steal rewards, Capturer battle-win force deploy, Blood Banker per-round gold trigger, and Capital Breaker siege hit buff via champion modifiers + new kill-steal hook; added champion ability tests and plan updates.
- Added Bannerman/Center Bannerman VP bonuses via a scoring bonus hook, plus scoring tests and plan updates.
- Added Logistics Officer deploy-as-capital support in `resolveCapitalDeployHex` with action-flow coverage; updated `implementation_plan.md`. (Overlap note: `progress.md`/`implementation_plan.md` also include pre-existing checklist updates for board-pick highlights and champion ability tests.)
- Added Stormcaller Tempest AoE champion ability (adjacent enemy champion damage) with per-round uses and champion ability test; updated `implementation_plan.md`. (Overlap note: `implementation_plan.md` had pre-existing checklist updates.)
- Added champion ability tests for Ironclad Warden (Bodyguard) and Shadeblade (Assassin's Edge); updated the plan checklist. (Files: `packages/engine/src/champion-abilities.test.ts`, `implementation_plan.md`.) (owner: agent2)
- Added Tactical Hand hit-assignment support for Grand Strategist with combat logic + tests; updated `implementation_plan.md`. (Files: `packages/engine/src/combat.ts`, `packages/engine/src/champions.ts`, `packages/engine/src/types.ts`, `packages/engine/src/champion-abilities.test.ts`, `implementation_plan.md`.) (owner: agent2)
- Added Set to Skirmish retreat-on-battle effect (combat modifier) with targeted test coverage; updated `implementation_plan.md`. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.) (owner: agent3)
- Added Set to Skirmish edge-case test coverage when no adjacent retreat hex exists. (Files: `packages/engine/src/card-effects.combat-modifiers.test.ts`.) (owner: agent3)
- Added Focus Fire hit-assignment support (next-battle modifier + combat policy) with bodyguard-aware targeting and tests; updated `implementation_plan.md`. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/combat.ts`, `packages/engine/src/champions.ts`, `packages/engine/src/types.ts`, `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.)
- Added Shock Drill first-battle force hit-face boost with tests; updated `implementation_plan.md`. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/card-effects.shock-drill.test.ts`, `implementation_plan.md`.)
- Added Frenzy combat modifier effect (dice bonus + self-damage) with tests; updated `implementation_plan.md`. (Files: `packages/engine/src/card-effects.ts`, `packages/engine/src/card-effects.combat-modifiers.test.ts`, `implementation_plan.md`.) (Overlap note: `implementation_plan.md` also had pre-existing edits.)

## Milestone 7.5 progress
- Added a card-art manifest + helper, GameCard art rendering, and a CLI script to generate diffusion art and update the manifest. (Files: `scripts/generate-card-art.js`, `apps/web/src/components/GameCard.tsx`, `apps/web/src/data/card-art.json`, `apps/web/src/lib/card-art.ts`, `.gitignore`.)
- Switched the card-art generator to OpenAI's image API, updated the base prompt + title suffix behavior, added title-based filenames, and made manifest updates optional. (Files: `scripts/generate-card-art.js`.)
- Documented OpenAI card-art generator usage, API key setup, and prompt tuning in `docs/cards.md`.
- Added docs guidance on safe card renames and creating variant cards with unique ids in `docs/cards.md`.
- Added a pre-check in the art generator to skip OpenAI calls when target filenames already exist; manifest still updated for single-image skips. (Overlap note: commit also picked up pre-staged changes in `packages/engine/src/champions.ts`, `packages/engine/src/champion-abilities.test.ts`, and `implementation_plan.md`.)

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
