import { useMemo } from "react";

import {
  CARD_DEFS,
  applyCardInstanceOverrides,
  type CardInstance,
  type CardInstanceOverrides,
  type GameView
} from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { GameCard } from "./GameCard";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type CardDef = (typeof CARD_DEFS)[number];

type DeckViewerProps = {
  view: GameView | null;
  playerId: string | null;
  roomId: string | null;
  status: RoomConnectionStatus;
  onReturnToGame?: () => void;
};

type CardGroup = {
  key: string;
  defId: string;
  count: number;
  card: CardDef | null;
};

const getOverrideKey = (overrides?: CardInstanceOverrides | null): string => {
  if (!overrides) {
    return "";
  }
  const cost = overrides.cost;
  const tags = overrides.tags ? [...overrides.tags].sort() : null;
  return JSON.stringify({
    cost: cost ? { mana: cost.mana, gold: cost.gold ?? 0 } : null,
    initiative: overrides.initiative ?? null,
    burn: overrides.burn ?? null,
    name: overrides.name ?? null,
    rulesText: overrides.rulesText ?? null,
    tags
  });
};

const groupCards = (cards: CardInstance[]): CardGroup[] => {
  const grouped = new Map<string, CardGroup>();

  for (const entry of cards) {
    const overrideKey = getOverrideKey(entry.overrides);
    const groupKey = `${entry.defId}:${overrideKey}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const baseDef = CARD_DEFS_BY_ID.get(entry.defId) ?? null;
    const def = baseDef ? applyCardInstanceOverrides(baseDef, entry.overrides) : null;
    grouped.set(groupKey, { key: groupKey, defId: entry.defId, count: 1, card: def });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aName = a.card?.name ?? a.defId;
    const bName = b.card?.name ?? b.defId;
    if (aName !== bName) {
      return aName.localeCompare(bName);
    }
    return a.defId.localeCompare(b.defId);
  });
};

export const DeckViewer = ({
  view,
  playerId,
  roomId,
  status,
  onReturnToGame
}: DeckViewerProps) => {
  const privateView = view?.private ?? null;
  const playerName =
    view?.public.players.find((player) => player.id === playerId)?.name ?? null;
  const deckCards = privateView?.deckCards ?? null;
  const deckCounts = privateView?.deckCounts ?? null;
  const handCount = privateView?.handCards.length ?? 0;

  const piles = useMemo(() => {
    if (!privateView || !deckCards) {
      return [];
    }
    return [
      {
        id: "hand",
        label: `Hand (${privateView.handCards.length})`,
        cards: privateView.handCards
      },
      {
        id: "draw",
        label: `Draw pile (${privateView.deckCounts.drawPile})`,
        cards: deckCards.drawPile
      },
      {
        id: "discard",
        label: `Discard (${privateView.deckCounts.discardPile})`,
        cards: deckCards.discardPile
      },
      {
        id: "scrapped",
        label: `Scrapped (${privateView.deckCounts.scrapped})`,
        cards: deckCards.scrapped
      },
      {
        id: "burned",
        label: `Burned (${privateView.deckCounts.burned})`,
        cards: deckCards.burned
      }
    ];
  }, [deckCards, privateView]);

  if (!view) {
    return (
      <section className="panel">
        <h2>Deck Viewer</h2>
        <p className="muted">Join a room to inspect your deck.</p>
      </section>
    );
  }

  if (!privateView) {
    return (
      <section className="panel">
        <h2>Deck Viewer</h2>
        <p className="muted">Spectators do not have a private deck view.</p>
      </section>
    );
  }

  const inDeckCount =
    privateView.handCards.length +
    privateView.deckCounts.drawPile +
    privateView.deckCounts.discardPile;
  const deckFlow = deckCounts
    ? [
        {
          id: "draw",
          label: "Draw",
          count: deckCounts.drawPile,
          arrow: "draw"
        },
        {
          id: "hand",
          label: "Hand",
          count: handCount,
          arrow: "discard"
        },
        {
          id: "discard",
          label: "Discard",
          count: deckCounts.discardPile,
          arrow: "scrap"
        },
        {
          id: "scrapped",
          label: "Scrapped",
          count: deckCounts.scrapped,
          arrow: null
        },
        {
          id: "burned",
          label: "Burned",
          count: deckCounts.burned,
          arrow: null
        }
      ]
    : [];

  return (
    <section className="cards-browser">
      <header className="cards-browser__header">
        <div>
          <p className="eyebrow">Deck Viewer</p>
          <h1>{playerName ? `${playerName}'s Deck` : "Your Deck"}</h1>
          <p className="subhead">
            {roomId ? `Room ${roomId}` : ""}{" "}
            {status === "connected" ? "Live" : "Offline"}
          </p>
        </div>
        <div className="cards-browser__summary">
          <span className="status-pill">{inDeckCount} cards in deck</span>
          <span className="status-pill">{privateView.deckCounts.scrapped} scrapped</span>
          <span className="status-pill">{privateView.deckCounts.burned} burned</span>
          {onReturnToGame ? (
            <button
              type="button"
              className="btn btn-secondary"
              data-sfx="soft"
              onClick={onReturnToGame}
            >
              Back to Game
            </button>
          ) : null}
        </div>
      </header>

      {onReturnToGame ? (
        <button
          type="button"
          className="btn btn-secondary deck-toggle deck-toggle--return"
          data-sfx="soft"
          onClick={onReturnToGame}
        >
          Back to Game
        </button>
      ) : null}

      {deckFlow.length > 0 ? (
        <section className="panel deck-flow" aria-label="Deck flow">
          <div className="deck-flow__track">
            {deckFlow.map((step) => (
              <div key={step.id} className="deck-flow__step">
                <div className="deck-flow__pile" data-pile={step.id}>
                  <span className="deck-flow__label">{step.label}</span>
                  <span className="deck-flow__count">{step.count}</span>
                </div>
                {step.arrow ? (
                  <span
                    className={`deck-flow__arrow deck-flow__arrow--${step.arrow}`}
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="cards-browser__layout">
        {piles.map((pile) => {
          const grouped = groupCards(pile.cards);
          return (
            <section key={pile.id} className="panel">
              <h2>{pile.label}</h2>
              {grouped.length === 0 ? (
                <div className="hand-empty">No cards in this pile.</div>
              ) : (
                <div className="cards-grid">
                  {grouped.map((group) => {
                    const card = group.card;
                    return (
                      <GameCard
                        key={`${pile.id}-${group.key}`}
                        variant="grid"
                        card={card}
                        cardId={group.defId}
                        count={group.count}
                        showId
                        showChampionStats
                        rulesFallback="Unknown card data."
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
};
