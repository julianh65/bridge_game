import { useMemo } from "react";

import { CARD_DEFS, type CardInstance, type GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type CardDef = (typeof CARD_DEFS)[number];

type DeckViewerProps = {
  view: GameView | null;
  playerId: string | null;
  roomId: string | null;
  status: RoomConnectionStatus;
};

type CardGroup = {
  defId: string;
  count: number;
  card: CardDef | null;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const initiativeChipStyle = (initiative: number) => {
  const clamped = clamp(initiative, 0, 250);
  const t = clamped / 250;
  const hue = 140 - 120 * t;
  const saturation = 72;
  const lightness = 46 - 10 * t;
  const backgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
  const borderColor = `hsl(${hue} ${saturation}% ${Math.max(20, lightness - 14)}%)`;
  const color = lightness > 55 ? "#1f1300" : "#fff7e6";

  return { backgroundColor, borderColor, color };
};

const groupCards = (cards: CardInstance[]): CardGroup[] => {
  const grouped = new Map<string, CardGroup>();

  for (const entry of cards) {
    const existing = grouped.get(entry.defId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const def = CARD_DEFS_BY_ID.get(entry.defId) ?? null;
    grouped.set(entry.defId, { defId: entry.defId, count: 1, card: def });
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

export const DeckViewer = ({ view, playerId, roomId, status }: DeckViewerProps) => {
  const privateView = view?.private ?? null;
  const playerName =
    view?.public.players.find((player) => player.id === playerId)?.name ?? null;
  const deckCards = privateView?.deckCards ?? null;

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
        </div>
      </header>

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
                      <article
                        key={`${pile.id}-${group.defId}`}
                        className="card-entry"
                        data-deck={card?.deck ?? "unknown"}
                        data-type={card?.type ?? "unknown"}
                      >
                        <div className="card-entry__header">
                          <div>
                            <p className="card-entry__eyebrow">
                              {card?.deck ?? "unknown"}
                            </p>
                            <h3>{card?.name ?? group.defId}</h3>
                            <p className="card-entry__id">{group.defId}</p>
                          </div>
                          <div className="card-entry__stats">
                            <span className="card-tag">x{group.count}</span>
                            {card ? (
                              <>
                                <span className="card-tag">{card.type}</span>
                                <span
                                  className="card-tag"
                                  style={initiativeChipStyle(card.initiative)}
                                >
                                  Init {card.initiative}
                                </span>
                                <span className="card-tag">Mana {card.cost.mana}</span>
                                {card.cost.gold ? (
                                  <span className="card-tag">Gold {card.cost.gold}</span>
                                ) : null}
                                {card.burn ? <span className="card-tag">Burn</span> : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        {card ? (
                          <p className="card-entry__text" title={card.rulesText}>
                            {card.rulesText}
                          </p>
                        ) : (
                          <p className="card-entry__text">Unknown card data.</p>
                        )}
                        {card && card.tags.length > 0 ? (
                          <div className="card-entry__tags">
                            {card.tags.map((tag) => (
                              <span key={`${group.defId}-${tag}`} className="card-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
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
