import { useEffect, useMemo, useState } from "react";

import { CARD_DEFS, type CardDefId, type CardInstance } from "@bridgefront/engine";

import type { RoomClient } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type GameDebugOverlayProps = {
  room: RoomClient;
};

export const GameDebugOverlay = ({ room }: GameDebugOverlayProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }
  if (!room.view || room.view.public.phase === "setup") {
    return null;
  }

  const hostId = room.view.public.players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(room.playerId && hostId === room.playerId);
  if (!isHost) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [queuedCardIds, setQueuedCardIds] = useState<CardDefId[]>([]);
  const canSend = room.status === "connected" && Boolean(room.playerId);

  useEffect(() => {
    if (isOpen && canSend) {
      room.sendDebugCommand({ command: "state" });
    }
  }, [isOpen, canSend, room]);

  const sortedCards = useMemo(() => {
    return [...CARD_DEFS].sort((a, b) => {
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name);
      }
      return a.id.localeCompare(b.id);
    });
  }, []);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchingCards = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }
    return sortedCards.filter((card) => {
      if (card.id.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
      return card.name.toLowerCase().includes(normalizedQuery);
    });
  }, [normalizedQuery, sortedCards]);

  const playerIndex = useMemo(() => {
    if (!room.debugState || !room.playerId) {
      return -1;
    }
    return room.debugState.players.findIndex((player) => player.id === room.playerId);
  }, [room.debugState, room.playerId]);

  const canInjectHand =
    canSend && Boolean(room.debugState) && playerIndex >= 0 && queuedCardIds.length > 0;

  const handleInjectHand = (mode: "add" | "replace") => {
    if (!canInjectHand || !room.debugState) {
      return;
    }
    const state = room.debugState;
    const validQueue = queuedCardIds.filter((id) => CARD_DEFS_BY_ID.has(id));
    if (validQueue.length === 0) {
      return;
    }
    const existingHand = state.players[playerIndex].deck.hand;
    const nextCardsByInstanceId: Record<string, CardInstance> = {
      ...state.cardsByInstanceId
    };
    let nextIndex = Object.keys(nextCardsByInstanceId).length + 1;
    const newInstanceIds: string[] = [];
    validQueue.forEach((defId) => {
      const instanceId = `ci_${nextIndex}`;
      nextIndex += 1;
      nextCardsByInstanceId[instanceId] = { id: instanceId, defId };
      newInstanceIds.push(instanceId);
    });
    const nextHand =
      mode === "replace" ? newInstanceIds : [...existingHand, ...newInstanceIds];
    room.sendDebugCommand({
      command: "patchState",
      path: "cardsByInstanceId",
      value: nextCardsByInstanceId
    });
    room.sendDebugCommand({
      command: "patchState",
      path: `players[${playerIndex}].deck.hand`,
      value: nextHand
    });
    room.sendDebugCommand({ command: "state" });
  };

  const handleQueueCard = (cardId: CardDefId) => {
    setQueuedCardIds((current) => [...current, cardId]);
  };

  const handleQueueRemove = (index: number) => {
    setQueuedCardIds((current) => current.filter((_, idx) => idx !== index));
  };

  return (
    <div className="debug-overlay">
      {!isOpen ? (
        <button
          type="button"
          className="btn btn-tertiary debug-overlay__toggle"
          onClick={() => setIsOpen(true)}
        >
          Debug
        </button>
      ) : (
        <section className="panel debug-overlay__panel">
          <div className="controls debug-overlay__header">
            <strong>Debug Hand</strong>
            <button type="button" className="btn btn-tertiary" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
          <p className="muted">
            Search cards, queue them, and add or replace your hand (dev host only).
          </p>
          <label>
            Find card
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name or id"
            />
          </label>
          {normalizedQuery ? (
            <div className="debug-overlay__results">
              {matchingCards.length > 0 ? (
                matchingCards.slice(0, 10).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="debug-overlay__result"
                    onClick={() => handleQueueCard(card.id)}
                  >
                    <span className="debug-overlay__result-name">{card.name}</span>
                    <span className="debug-overlay__result-id">{card.id}</span>
                    <span className="debug-overlay__result-action">Add</span>
                  </button>
                ))
              ) : (
                <p className="muted">No cards match that search.</p>
              )}
            </div>
          ) : null}
          <div className="debug-overlay__queue">
            <div className="debug-overlay__queue-header">
              <span>Queued cards</span>
              <span className="muted">{queuedCardIds.length}</span>
            </div>
            {queuedCardIds.length > 0 ? (
              <ul className="debug-overlay__queue-list">
                {queuedCardIds.map((cardId, index) => {
                  const card = CARD_DEFS_BY_ID.get(cardId);
                  return (
                    <li key={`${cardId}-${index}`} className="debug-overlay__queue-item">
                      <span>
                        {card?.name ?? cardId}
                        <span className="debug-overlay__queue-id">{cardId}</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-tertiary"
                        onClick={() => handleQueueRemove(index)}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No cards queued yet.</p>
            )}
          </div>
          <div className="controls">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canInjectHand}
              onClick={() => handleInjectHand("add")}
            >
              Add to hand
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canInjectHand}
              onClick={() => handleInjectHand("replace")}
            >
              Replace hand
            </button>
            <button
              type="button"
              className="btn btn-tertiary"
              disabled={queuedCardIds.length === 0}
              onClick={() => setQueuedCardIds([])}
            >
              Clear queue
            </button>
          </div>
          {!room.debugState ? (
            <p className="muted">Fetching debug state…</p>
          ) : null}
          {!canInjectHand && room.debugState ? (
            <p className="muted">Queue cards to enable hand injection.</p>
          ) : null}
        </section>
      )}
    </div>
  );
};
