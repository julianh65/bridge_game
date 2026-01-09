import { useMemo } from "react";

import {
  CARD_DEFS_BY_ID,
  resolveStarterFactionCards,
  type GameView,
  type PlayerID,
  type SetupChoice
} from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import { GameCard } from "./GameCard";
import { FACTIONS, getFactionBasicActionOrderLabel, getFactionName } from "../lib/factions";
import type { RoomConnectionStatus } from "../lib/room-client";

type SetupDeckPreviewProps = {
  view: GameView;
  playerId: PlayerID | null;
  status: RoomConnectionStatus;
  onSubmitChoice: (choice: SetupChoice) => void;
};

type DeckCountEntry = {
  cardId: string;
  count: number;
};

const buildDeckCounts = (deck: string[]): DeckCountEntry[] => {
  const counts = new Map<string, number>();
  const ordered: string[] = [];
  for (const cardId of deck) {
    if (!counts.has(cardId)) {
      ordered.push(cardId);
    }
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }
  return ordered.map((cardId) => ({
    cardId,
    count: counts.get(cardId) ?? 0
  }));
};

export const SetupDeckPreview = ({
  view,
  playerId,
  status,
  onSubmitChoice
}: SetupDeckPreviewProps) => {
  const setup = view.public.setup;
  const players = view.public.players;
  const localPlayer = playerId ? players.find((player) => player.id === playerId) ?? null : null;
  const localFactionId = localPlayer?.factionId ?? null;
  const playerNames = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );

  const starter = useMemo(() => {
    if (!localFactionId) {
      return null;
    }
    return resolveStarterFactionCards(localFactionId);
  }, [localFactionId]);

  const deckCounts = useMemo(() => {
    if (!starter) {
      return [];
    }
    return buildDeckCounts(starter.deck);
  }, [starter]);

  if (!setup || setup.type !== "setup.deckPreview") {
    return null;
  }

  if (!starter) {
    return (
      <section className="panel setup-deck-preview">
        <h2>Starter Deck</h2>
        <p className="muted">Join a seat to preview a starter deck.</p>
      </section>
    );
  }

  const starterSpell = CARD_DEFS_BY_ID[starter.starterSpellId] ?? null;
  const starterChampion = CARD_DEFS_BY_ID[starter.championId] ?? null;
  const coreDeckCount = starter.deck.length;
  const totalDeckCount = coreDeckCount + 1;
  const factionName = getFactionName(starter.factionId);
  const factionOption = FACTIONS.find((entry) => entry.id === starter.factionId) ?? null;
  const basicActionOrderLabel = getFactionBasicActionOrderLabel(starter.factionId);
  const waitingFor = setup.type === "setup.deckPreview" ? setup.waitingForPlayerIds : [];
  const waitingLabel =
    waitingFor.length > 0
      ? waitingFor.map((id) => playerNames.get(id) ?? id).join(", ")
      : "none";
  const isWaiting = Boolean(playerId && waitingFor.includes(playerId));
  const canInteract = status === "connected" && Boolean(playerId);
  const toggleLabel = isWaiting ? "I'm Ready" : "Undo Ready";
  const helperText = (() => {
    if (status !== "connected") {
      return "Connect to confirm you're ready.";
    }
    if (!playerId) {
      return "Spectators can watch but cannot ready up.";
    }
    if (isWaiting) {
      return "Click ready when you have reviewed your starter deck.";
    }
    return "You're marked ready. Undo if you want more time.";
  })();

  return (
    <section className="panel setup-deck-preview">
      <h2>Starter Deck</h2>
      <p className="muted">
        Review your starter kit before the map draft begins. Your champion starts in hand.
      </p>
      <div className="setup-deck-preview__layout">
        <div className="setup-deck-preview__main">
          <div className="setup-deck-preview__faction">
            <FactionSymbol factionId={starter.factionId} />
            <span>Faction {factionName}</span>
          </div>
          <div className="setup-deck-preview__callouts">
            <div className="setup-deck-preview__callout">
              <span className="setup-deck-preview__callout-label">Starter Spell</span>
              <GameCard
                variant="offer"
                card={starterSpell}
                cardId={starter.starterSpellId}
                rulesFallback="Unknown card data."
              />
            </div>
            <div className="setup-deck-preview__callout">
              <span className="setup-deck-preview__callout-label">Starter Champion</span>
              <GameCard
                variant="offer"
                card={starterChampion}
                cardId={starter.championId}
                showChampionStats
                rulesFallback="Unknown card data."
              />
            </div>
          </div>
          <div className="setup-deck-preview__deck">
            <div className="setup-deck-preview__deck-header">
              <h3>Core Deck</h3>
              <span className="setup-deck-preview__deck-count">{coreDeckCount} cards</span>
            </div>
            <div className="setup-deck-preview__grid">
              {deckCounts.map((entry) => (
                <GameCard
                  key={entry.cardId}
                  variant="grid"
                  card={CARD_DEFS_BY_ID[entry.cardId] ?? null}
                  cardId={entry.cardId}
                  count={entry.count}
                  rulesFallback="Unknown card data."
                />
              ))}
            </div>
          </div>
        </div>
        <aside className="setup-deck-preview__aside">
          <div className="setup-deck-preview__ready">
            <div className="setup-deck-preview__ready-header">
              <h3>Ready Check</h3>
              {playerId ? (
                <span className={`status-pill ${isWaiting ? "status-pill--waiting" : "status-pill--ready"}`}>
                  {isWaiting ? "Reviewing" : "Ready"}
                </span>
              ) : null}
            </div>
            <div className="resource-row">
              <span>Waiting on</span>
              <strong>{waitingLabel}</strong>
            </div>
            {playerId ? (
              <div className="resource-row">
                <span>Your status</span>
                <strong>{isWaiting ? "Reviewing" : "Ready"}</strong>
              </div>
            ) : null}
            {playerId ? (
              <div className="setup-deck-preview__ready-actions">
                <button
                  type="button"
                  className={`btn ${isWaiting ? "btn-primary" : "btn-tertiary"}`}
                  onClick={() =>
                    onSubmitChoice({ kind: isWaiting ? "readyDeckPreview" : "unreadyDeckPreview" })
                  }
                  disabled={!canInteract}
                >
                  {toggleLabel}
                </button>
              </div>
            ) : null}
            <p className="muted">{helperText}</p>
          </div>
          <div className="setup-deck-preview__summary">
            <div className="resource-row">
              <span>Deck size</span>
              <strong>{totalDeckCount} cards</strong>
            </div>
            <div className="resource-row">
              <span>Opening hand</span>
              <strong>6 cards + champion</strong>
            </div>
            <div className="resource-row">
              <span>Basic action order</span>
              <strong>{basicActionOrderLabel}</strong>
            </div>
            <div className="resource-row">
              <span>Starter spell</span>
              <strong>{starterSpell?.name ?? starter.starterSpellId}</strong>
            </div>
            <div className="resource-row">
              <span>Starter champion</span>
              <strong>{starterChampion?.name ?? starter.championId}</strong>
            </div>
          </div>
          <div className="setup-deck-preview__players">
            {players.map((player) => {
              const waiting = waitingFor.includes(player.id);
              return (
                <div
                  key={player.id}
                  className={`setup-deck-preview__player-row${
                    waiting ? " setup-deck-preview__player-row--active" : ""
                  }`}
                >
                  <span>{player.name}</span>
                  <strong>{waiting ? "Reviewing" : "Ready"}</strong>
                </div>
              );
            })}
          </div>
          {factionOption ? (
            <div className="setup-deck-preview__abilities faction-card__section">
              <span className="faction-card__section-title">Faction passives</span>
              <div className="faction-card__desc">{factionOption.description}</div>
              <ul className="faction-card__list">
                {factionOption.passives.map((passive) => (
                  <li key={passive.name}>
                    <span className="faction-card__passive-name">{passive.name}</span>
                    <span className="faction-card__passive-desc">{passive.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
};
