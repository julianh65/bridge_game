import { useMemo, useState } from "react";

import type { CardDef, CardDefId, GameState } from "@bridgefront/engine";
import {
  CARD_DEFS,
  DEFAULT_CONFIG,
  addChampionToHex,
  addForcesToHex,
  applyChampionDeployment,
  createNewGame,
  resolveBattleAtHex
} from "@bridgefront/engine";

import { CombatOverlay } from "./CombatOverlay";
import { extractCombatSequences, type CombatSequence } from "../lib/combat-log";
import { FACTIONS } from "../lib/factions";

type ChampionSlot = {
  id: string;
  cardDefId: CardDefId;
};

const buildPlayerMap = (players: { id: string; name: string }[]) =>
  new Map(players.map((player) => [player.id, player.name]));

const buildFactionMap = (players: { id: string; factionId?: string }[]) =>
  new Map(players.map((player) => [player.id, player.factionId ?? null]));

const getChampionCard = (cardDefId: CardDefId, cardDefsById: Map<string, CardDef>) => {
  const card = cardDefsById.get(cardDefId);
  if (!card || card.type !== "Champion" || !card.champion) {
    return null;
  }
  return card;
};

const addChampion = (
  state: GameState,
  playerId: string,
  hexKey: string,
  cardDefId: CardDefId,
  cardDefsById: Map<string, CardDef>
) => {
  const card = getChampionCard(cardDefId, cardDefsById);
  if (!card || !card.champion) {
    return state;
  }
  const deployed = addChampionToHex(state.board, playerId, hexKey, {
    cardDefId: card.id,
    hp: card.champion.hp,
    attackDice: card.champion.attackDice,
    hitFaces: card.champion.hitFaces,
    bounty: card.champion.bounty
  });
  let nextState: GameState = {
    ...state,
    board: deployed.board
  };
  nextState = applyChampionDeployment(nextState, deployed.unitId, card.id, playerId);
  return nextState;
};

export const BattleDebug = () => {
  const [seed, setSeed] = useState("77");
  const [attackerForces, setAttackerForces] = useState(4);
  const [defenderForces, setDefenderForces] = useState(4);
  const [attackerFaction, setAttackerFaction] = useState(FACTIONS[0]?.id ?? "aerial");
  const [defenderFaction, setDefenderFaction] = useState(FACTIONS[1]?.id ?? "bastion");
  const [attackerSlots, setAttackerSlots] = useState<ChampionSlot[]>([]);
  const [defenderSlots, setDefenderSlots] = useState<ChampionSlot[]>([]);
  const [sequence, setSequence] = useState<CombatSequence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardDefsById = useMemo(
    () => new Map(CARD_DEFS.map((card) => [card.id, card])),
    []
  );
  const championOptions = useMemo(() => {
    return CARD_DEFS.filter((card) => card.type === "Champion")
      .map((card) => ({
        id: card.id,
        label: card.name
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const handleAddSlot = (
    slots: ChampionSlot[],
    setSlots: (next: ChampionSlot[]) => void
  ) => {
    if (championOptions.length === 0) {
      return;
    }
    const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextSlot: ChampionSlot = {
      id: nextId,
      cardDefId: championOptions[0].id
    };
    setSlots([...slots, nextSlot]);
  };

  const handleUpdateSlot = (
    slots: ChampionSlot[],
    setSlots: (next: ChampionSlot[]) => void,
    slotId: string,
    cardDefId: CardDefId
  ) => {
    setSlots(
      slots.map((slot) => (slot.id === slotId ? { ...slot, cardDefId } : slot))
    );
  };

  const handleRemoveSlot = (
    slots: ChampionSlot[],
    setSlots: (next: ChampionSlot[]) => void,
    slotId: string
  ) => {
    setSlots(slots.filter((slot) => slot.id !== slotId));
  };

  const handleSimulate = () => {
    try {
      const players = [
        { id: "p1", name: "Attackers", factionId: attackerFaction },
        { id: "p2", name: "Defenders", factionId: defenderFaction }
      ];
      let state = createNewGame(DEFAULT_CONFIG, Number(seed) || 0, players);
      state = { ...state, logs: [] };
      const centerHex = state.board.hexes["0,0"]
        ? "0,0"
        : Object.keys(state.board.hexes)[0];
      if (!centerHex) {
        throw new Error("No board hexes available for combat.");
      }

      state = { ...state, board: addForcesToHex(state.board, "p1", centerHex, attackerForces) };
      state = { ...state, board: addForcesToHex(state.board, "p2", centerHex, defenderForces) };

      for (const slot of attackerSlots) {
        state = addChampion(state, "p1", centerHex, slot.cardDefId, cardDefsById);
      }
      for (const slot of defenderSlots) {
        state = addChampion(state, "p2", centerHex, slot.cardDefId, cardDefsById);
      }

      state = resolveBattleAtHex(state, centerHex);
      const sequences = extractCombatSequences(state.logs);
      setSequence(sequences[0] ?? null);
      setError(sequences.length === 0 ? "No combat logs generated." : null);
    } catch (err) {
      setSequence(null);
      setError(err instanceof Error ? err.message : "Battle simulation failed.");
    }
  };

  const playerMap = useMemo(
    () => buildPlayerMap([{ id: "p1", name: "Attackers" }, { id: "p2", name: "Defenders" }]),
    []
  );
  const factionMap = useMemo(
    () => buildFactionMap([
      { id: "p1", factionId: attackerFaction },
      { id: "p2", factionId: defenderFaction }
    ]),
    [attackerFaction, defenderFaction]
  );

  return (
    <section className="battle-debug">
      <header className="battle-debug__header">
        <div>
          <p className="eyebrow">Bridgefront Debug</p>
          <h1>Battle Simulator</h1>
          <p className="subhead">Spin up combat logs without playing a full match.</p>
        </div>
        <div className="battle-debug__actions">
          <button type="button" className="btn btn-secondary" onClick={handleSimulate}>
            Simulate Battle
          </button>
        </div>
      </header>

      <section className="panel battle-debug__panel">
        <div className="battle-debug__grid">
          <div className="battle-debug__column">
            <h2>Attackers</h2>
            <label>
              Forces
              <input
                type="number"
                min={0}
                value={attackerForces}
                onChange={(event) => setAttackerForces(Number(event.target.value))}
              />
            </label>
            <label>
              Faction
              <select
                value={attackerFaction}
                onChange={(event) => setAttackerFaction(event.target.value)}
              >
                {FACTIONS.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="battle-debug__slots">
              <div className="battle-debug__slots-header">
                <span>Champions</span>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={() => handleAddSlot(attackerSlots, setAttackerSlots)}
                >
                  Add Champion
                </button>
              </div>
              {attackerSlots.length === 0 ? (
                <p className="muted">No champions queued.</p>
              ) : (
                attackerSlots.map((slot) => (
                  <div key={slot.id} className="battle-debug__slot">
                    <select
                      value={slot.cardDefId}
                      onChange={(event) =>
                        handleUpdateSlot(
                          attackerSlots,
                          setAttackerSlots,
                          slot.id,
                          event.target.value as CardDefId
                        )
                      }
                    >
                      {championOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => handleRemoveSlot(attackerSlots, setAttackerSlots, slot.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="battle-debug__column">
            <h2>Defenders</h2>
            <label>
              Forces
              <input
                type="number"
                min={0}
                value={defenderForces}
                onChange={(event) => setDefenderForces(Number(event.target.value))}
              />
            </label>
            <label>
              Faction
              <select
                value={defenderFaction}
                onChange={(event) => setDefenderFaction(event.target.value)}
              >
                {FACTIONS.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="battle-debug__slots">
              <div className="battle-debug__slots-header">
                <span>Champions</span>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={() => handleAddSlot(defenderSlots, setDefenderSlots)}
                >
                  Add Champion
                </button>
              </div>
              {defenderSlots.length === 0 ? (
                <p className="muted">No champions queued.</p>
              ) : (
                defenderSlots.map((slot) => (
                  <div key={slot.id} className="battle-debug__slot">
                    <select
                      value={slot.cardDefId}
                      onChange={(event) =>
                        handleUpdateSlot(
                          defenderSlots,
                          setDefenderSlots,
                          slot.id,
                          event.target.value as CardDefId
                        )
                      }
                    >
                      {championOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => handleRemoveSlot(defenderSlots, setDefenderSlots, slot.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="battle-debug__column">
            <h2>Settings</h2>
            <label>
              Seed
              <input
                type="number"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </label>
            <p className="muted">
              Battles take place at the center hex. Use the same seed to replay
              deterministic rolls.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <section className="panel error">
          <h2>Battle failed</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {sequence ? (
        <CombatOverlay
          sequence={sequence}
          playersById={playerMap}
          playerFactionsById={factionMap}
          cardDefsById={cardDefsById}
          modifiers={[]}
          isCapitalBattle={false}
          onClose={() => setSequence(null)}
        />
      ) : null}
    </section>
  );
};
