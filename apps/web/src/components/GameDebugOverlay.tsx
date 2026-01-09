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
  const [handCardInput, setHandCardInput] = useState("");
  const [injectMode, setInjectMode] = useState<"add" | "replace">("add");
  const canSend = room.status === "connected" && Boolean(room.playerId);

  useEffect(() => {
    if (isOpen && canSend) {
      room.sendDebugCommand({ command: "state" });
    }
  }, [isOpen, canSend, room]);

  const parsedHandCards = useMemo(() => {
    const rawIds = handCardInput
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const valid: CardDefId[] = [];
    const invalid: string[] = [];
    rawIds.forEach((id) => {
      if (CARD_DEFS_BY_ID.has(id as CardDefId)) {
        valid.push(id as CardDefId);
      } else {
        invalid.push(id);
      }
    });
    return { rawIds, valid, invalid };
  }, [handCardInput]);

  const playerIndex = useMemo(() => {
    if (!room.debugState || !room.playerId) {
      return -1;
    }
    return room.debugState.players.findIndex((player) => player.id === room.playerId);
  }, [room.debugState, room.playerId]);

  const canInjectHand =
    canSend &&
    Boolean(room.debugState) &&
    playerIndex >= 0 &&
    parsedHandCards.valid.length > 0 &&
    parsedHandCards.invalid.length === 0;

  const handleInjectHand = () => {
    if (!canInjectHand || !room.debugState) {
      return;
    }
    const state = room.debugState;
    const existingHand = state.players[playerIndex].deck.hand;
    const nextCardsByInstanceId: Record<string, CardInstance> = {
      ...state.cardsByInstanceId
    };
    let nextIndex = Object.keys(nextCardsByInstanceId).length + 1;
    const newInstanceIds: string[] = [];
    parsedHandCards.valid.forEach((defId) => {
      const instanceId = `ci_${nextIndex}`;
      nextIndex += 1;
      nextCardsByInstanceId[instanceId] = { id: instanceId, defId };
      newInstanceIds.push(instanceId);
    });
    const nextHand =
      injectMode === "replace" ? newInstanceIds : [...existingHand, ...newInstanceIds];
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

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 40,
        maxWidth: 320
      }}
    >
      {!isOpen ? (
        <button type="button" className="btn btn-tertiary" onClick={() => setIsOpen(true)}>
          Debug
        </button>
      ) : (
        <section className="panel">
          <div className="controls" style={{ justifyContent: "space-between" }}>
            <strong>Debug Hand</strong>
            <button type="button" className="btn btn-tertiary" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
          <p className="muted">Add card ids to your hand (dev host only).</p>
          <label>
            Card ids
            <input
              type="text"
              value={handCardInput}
              onChange={(event) => setHandCardInput(event.target.value)}
              placeholder="age1.scavengers_market, starter.supply_cache"
            />
          </label>
          <div className="controls">
            <label>
              Mode
              <select
                value={injectMode}
                onChange={(event) => setInjectMode(event.target.value as "add" | "replace")}
              >
                <option value="add">Add to hand</option>
                <option value="replace">Replace hand</option>
              </select>
            </label>
            <button type="button" className="btn btn-secondary" onClick={handleInjectHand}>
              Apply
            </button>
            <button type="button" className="btn btn-tertiary" onClick={() => setHandCardInput("")}>
              Clear
            </button>
          </div>
          {parsedHandCards.invalid.length > 0 ? (
            <p className="muted">Unknown card ids: {parsedHandCards.invalid.join(", ")}</p>
          ) : null}
          {!room.debugState ? (
            <p className="muted">Fetching debug state…</p>
          ) : null}
          {!canInjectHand && room.debugState ? (
            <p className="muted">Enter valid card ids to enable apply.</p>
          ) : null}
        </section>
      )}
    </div>
  );
};
