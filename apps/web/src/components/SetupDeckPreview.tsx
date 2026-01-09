import { useMemo } from "react";

import {
  CARD_DEFS_BY_ID,
  resolveStarterFactionCards,
  type GameView,
  type PlayerID
} from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import { GameCard } from "./GameCard";
import { FACTIONS, getFactionBasicActionOrderLabel, getFactionName } from "../lib/factions";

type SetupDeckPreviewProps = {
  view: GameView;
  playerId: PlayerID | null;
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

export const SetupDeckPreview = ({ view, playerId }: SetupDeckPreviewProps) => {
  const setup = view.public.setup;
  const players = view.public.players;
  const localPlayer = playerId ? players.find((player) => player.id === playerId) ?? null : null;
  const localFactionId = localPlayer?.factionId ?? null;

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
