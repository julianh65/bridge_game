import { useEffect, useMemo, useState } from "react";

import { CARD_DEFS, type CardDefId, type CardInstance } from "@bridgefront/engine";

import type { RoomClient } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type RoomDebugPanelProps = {
  room: RoomClient;
};

export const RoomDebugPanel = ({ room }: RoomDebugPanelProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [seedInput, setSeedInput] = useState("");
  const [patchPath, setPatchPath] = useState("");
  const [patchValue, setPatchValue] = useState("");
  const [handCardInput, setHandCardInput] = useState("");
  const currentSeed = room.debugState?.seed ?? room.view?.public.seed ?? null;

  useEffect(() => {
    if (seedInput.trim() === "" && currentSeed !== null && currentSeed !== undefined) {
      setSeedInput(String(currentSeed));
    }
  }, [currentSeed, seedInput]);

  const seedValue = seedInput.trim() === "" ? null : Number(seedInput);
  const seedValid = seedValue === null || Number.isFinite(seedValue);
  const canSend = room.status === "connected" && Boolean(room.playerId);
  const patchValueState = useMemo(() => {
    const raw = patchValue.trim();
    if (!raw) {
      return { value: null, valid: false };
    }
    try {
      return { value: JSON.parse(raw), valid: true };
    } catch {
      return { value: patchValue, valid: true };
    }
  }, [patchValue]);
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
  const patchPathValue = patchPath.trim();
  const canPatch = canSend && patchPathValue !== "" && patchValueState.valid;
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
  const stateJson = useMemo(() => {
    if (!room.debugState) {
      return "";
    }
    return JSON.stringify(room.debugState, null, 2);
  }, [room.debugState]);

  const handleReset = () => {
    if (!canSend || !seedValid) {
      return;
    }
    const seed = seedValue === null ? undefined : seedValue;
    room.sendDebugCommand({ command: "resetGame", seed });
  };

  const handleAdvance = () => {
    if (!canSend) {
      return;
    }
    room.sendDebugCommand({ command: "advancePhase" });
  };

  const handleFetchState = () => {
    if (!canSend) {
      return;
    }
    room.sendDebugCommand({ command: "state" });
  };

  const handlePatch = () => {
    if (!canPatch) {
      return;
    }
    room.sendDebugCommand({
      command: "patchState",
      path: patchPathValue,
      value: patchValueState.value
    });
  };

  const handleInjectHand = (mode: "add" | "replace") => {
    if (!canInjectHand || !room.debugState) {
      return;
    }
    if (playerIndex < 0) {
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

  return (
    <section className="panel">
      <h2>Room Debug Tools</h2>
      <p className="muted">Dev-only host controls for testing and inspection.</p>
      <div className="controls">
        <label>
          Seed
          <input
            type="number"
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
          />
        </label>
        <button type="button" onClick={handleReset} disabled={!canSend || !seedValid}>
          Reset Game
        </button>
        <button type="button" onClick={handleAdvance} disabled={!canSend}>
          Advance Phase
        </button>
        <button type="button" onClick={handleFetchState} disabled={!canSend}>
          Fetch State
        </button>
      </div>
      <p className="muted">
        Current seed: {currentSeed !== null && currentSeed !== undefined ? String(currentSeed) : "?"}
      </p>
      <div className="controls">
        <label>
          Patch path
          <input
            type="text"
            value={patchPath}
            onChange={(event) => setPatchPath(event.target.value)}
            placeholder="players[0].resources.gold"
          />
        </label>
        <label>
          Patch value
          <textarea
            rows={3}
            value={patchValue}
            onChange={(event) => setPatchValue(event.target.value)}
            placeholder="10"
          />
        </label>
        <button type="button" onClick={handlePatch} disabled={!canPatch}>
          Patch State
        </button>
      </div>
      <p className="muted">Patch values accept JSON; unquoted text is treated as a string.</p>
      <h3>Hand Injector</h3>
      <p className="muted">
        Paste card ids to add or replace your hand (comma or space separated).
      </p>
      <div className="controls">
        <label>
          Hand card ids
          <input
            type="text"
            value={handCardInput}
            onChange={(event) => setHandCardInput(event.target.value)}
            placeholder="age1.scavengers_market, starter.supply_cache"
          />
        </label>
        <button
          type="button"
          onClick={() => handleInjectHand("replace")}
          disabled={!canInjectHand}
        >
          Replace Hand
        </button>
        <button
          type="button"
          onClick={() => handleInjectHand("add")}
          disabled={!canInjectHand}
        >
          Add to Hand
        </button>
      </div>
      {parsedHandCards.invalid.length > 0 ? (
        <p className="muted">
          Unknown card ids: {parsedHandCards.invalid.join(", ")}
        </p>
      ) : null}
      {!room.debugState ? (
        <p className="muted">Fetch state to enable hand injection.</p>
      ) : null}
      {room.debugState ? (
        <details>
          <summary>State JSON</summary>
          <pre>{stateJson}</pre>
        </details>
      ) : (
        <p className="muted">No debug state loaded yet.</p>
      )}
    </section>
  );
};
