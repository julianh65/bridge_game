import { useEffect, useMemo, useState } from "react";

import {
  CARD_DEFS,
  type Age,
  type BoardState,
  type CardDefId,
  type CardInstance
} from "@bridgefront/engine";

import type { RoomClient } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type RoomDebugPanelProps = {
  room: RoomClient;
};

const getAgeForRound = (round: number): Age => {
  if (round >= 8) {
    return "III";
  }
  if (round >= 4) {
    return "II";
  }
  return "I";
};

const isBoardSnapshot = (value: unknown): value is BoardState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.radius === "number" &&
    typeof record.hexes === "object" &&
    record.hexes !== null &&
    typeof record.bridges === "object" &&
    record.bridges !== null &&
    typeof record.units === "object" &&
    record.units !== null
  );
};

const ROUND_PRESETS = [
  { label: "Age I start (Round 1)", round: 1 },
  { label: "Age II start (Round 4)", round: 4 },
  { label: "Age III start (Round 8)", round: 8 }
];

export const RoomDebugPanel = ({ room }: RoomDebugPanelProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [seedInput, setSeedInput] = useState("");
  const [patchPath, setPatchPath] = useState("");
  const [patchValue, setPatchValue] = useState("");
  const [handCardInput, setHandCardInput] = useState("");
  const [roundInput, setRoundInput] = useState("");
  const [boardSnapshotInput, setBoardSnapshotInput] = useState("");
  const currentSeed = room.debugState?.seed ?? room.view?.public.seed ?? null;
  const currentRound = room.debugState?.round ?? room.view?.public.round ?? null;

  useEffect(() => {
    if (seedInput.trim() === "" && currentSeed !== null && currentSeed !== undefined) {
      setSeedInput(String(currentSeed));
    }
  }, [currentSeed, seedInput]);

  useEffect(() => {
    if (roundInput.trim() === "" && currentRound !== null && currentRound !== undefined) {
      setRoundInput(String(currentRound));
    }
  }, [currentRound, roundInput]);

  const seedValue = seedInput.trim() === "" ? null : Number(seedInput);
  const seedValid = seedValue === null || Number.isFinite(seedValue);
  const roundValue = roundInput.trim() === "" ? null : Number(roundInput);
  const roundValid = roundValue !== null && Number.isFinite(roundValue) && roundValue > 0;
  const roundAge =
    roundValid && roundValue !== null ? getAgeForRound(Math.floor(roundValue)) : null;
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
  const boardSnapshotState = useMemo(() => {
    const raw = boardSnapshotInput.trim();
    if (!raw) {
      return { value: null, valid: false, error: "Paste board JSON to apply." };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isBoardSnapshot(parsed)) {
        return {
          value: null,
          valid: false,
          error: "Board snapshot must include radius, hexes, bridges, and units."
        };
      }
      return { value: parsed, valid: true, error: null };
    } catch {
      return { value: null, valid: false, error: "Invalid JSON in board snapshot." };
    }
  }, [boardSnapshotInput]);
  const patchPathValue = patchPath.trim();
  const canPatch = canSend && patchPathValue !== "" && patchValueState.valid;
  const canApplyRound = canSend && Boolean(room.debugState) && roundValid;
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
  const canApplyBoardSnapshot = canSend && Boolean(room.debugState) && boardSnapshotState.valid;
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

  const applyRoundPreset = (targetRound: number) => {
    if (!canSend || !room.debugState) {
      return;
    }
    const normalizedRound = Math.max(1, Math.floor(targetRound));
    const age = getAgeForRound(normalizedRound);
    const playerCount = room.debugState.players.length;
    const leadSeatIndex = playerCount > 0 ? (normalizedRound - 1) % playerCount : 0;
    room.sendDebugCommand({ command: "patchState", path: "round", value: normalizedRound });
    room.sendDebugCommand({ command: "patchState", path: "market.age", value: age });
    room.sendDebugCommand({
      command: "patchState",
      path: "leadSeatIndex",
      value: leadSeatIndex
    });
    room.sendDebugCommand({ command: "state" });
  };

  const handleClearBlocks = () => {
    if (!canSend) {
      return;
    }
    room.sendDebugCommand({ command: "patchState", path: "blocks", value: null });
    room.sendDebugCommand({ command: "patchState", path: "actionResolution", value: null });
    room.sendDebugCommand({ command: "state" });
  };

  const handleJumpToAction = () => {
    if (!canSend || !room.debugState) {
      return;
    }
    const playerIds = room.debugState.players.map((player) => player.id);
    const declarations = Object.fromEntries(playerIds.map((id) => [id, null]));
    const actionBlock = {
      type: "actionStep.declarations",
      waitingFor: playerIds,
      payload: { declarations }
    };
    room.sendDebugCommand({
      command: "patchState",
      path: "phase",
      value: "round.action"
    });
    room.sendDebugCommand({
      command: "patchState",
      path: "blocks",
      value: actionBlock
    });
    room.sendDebugCommand({
      command: "patchState",
      path: "actionResolution",
      value: null
    });
    room.sendDebugCommand({ command: "state" });
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
    const currentVp = state.players[playerIndex].vp;
    const nextCardsByInstanceId: Record<string, CardInstance> = {
      ...state.cardsByInstanceId
    };
    let nextIndex = Object.keys(nextCardsByInstanceId).length + 1;
    const newInstanceIds: string[] = [];
    let gainedVictoryPoints = 0;
    parsedHandCards.valid.forEach((defId) => {
      const instanceId = `ci_${nextIndex}`;
      nextIndex += 1;
      nextCardsByInstanceId[instanceId] = { id: instanceId, defId };
      newInstanceIds.push(instanceId);
      const cardDef = CARD_DEFS_BY_ID.get(defId);
      if (cardDef?.type === "Victory") {
        const victoryPoints = cardDef.victoryPoints ?? 1;
        if (Number.isFinite(victoryPoints) && victoryPoints > 0) {
          gainedVictoryPoints += Math.floor(victoryPoints);
        }
      }
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
    if (gainedVictoryPoints > 0) {
      room.sendDebugCommand({
        command: "patchState",
        path: `players[${playerIndex}].vp.permanent`,
        value: currentVp.permanent + gainedVictoryPoints
      });
      room.sendDebugCommand({
        command: "patchState",
        path: `players[${playerIndex}].vp.total`,
        value: currentVp.total + gainedVictoryPoints
      });
    }
    room.sendDebugCommand({ command: "state" });
  };

  const handleCaptureBoard = () => {
    if (!room.debugState) {
      return;
    }
    setBoardSnapshotInput(JSON.stringify(room.debugState.board, null, 2));
  };

  const handleApplyBoardSnapshot = () => {
    if (!canApplyBoardSnapshot || !boardSnapshotState.value) {
      return;
    }
    room.sendDebugCommand({
      command: "patchState",
      path: "board",
      value: boardSnapshotState.value
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
      <h3>Scenario Presets</h3>
      <p className="muted">Quick round/age adjustments and cleanup helpers.</p>
      <div className="controls">
        <label>
          Round
          <input
            type="number"
            value={roundInput}
            onChange={(event) => setRoundInput(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (roundValue === null || !roundValid) {
              return;
            }
            applyRoundPreset(roundValue);
          }}
          disabled={!canApplyRound}
        >
          Apply Round
        </button>
        {roundAge ? <span className="muted">Age {roundAge}</span> : null}
      </div>
      <div className="controls">
        {ROUND_PRESETS.map((preset) => (
          <button
            key={preset.round}
            type="button"
            onClick={() => applyRoundPreset(preset.round)}
            disabled={!canSend || !room.debugState}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" onClick={handleClearBlocks} disabled={!canSend}>
          Clear Blocks
        </button>
        <button
          type="button"
          onClick={handleJumpToAction}
          disabled={!canSend || !room.debugState}
        >
          Jump to Action
        </button>
      </div>
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
      <h3>Board Snapshot</h3>
      <p className="muted">Capture or apply the current board for scenario testing.</p>
      <div className="controls">
        <button type="button" onClick={handleCaptureBoard} disabled={!room.debugState}>
          Capture Board
        </button>
        <button
          type="button"
          onClick={handleApplyBoardSnapshot}
          disabled={!canApplyBoardSnapshot}
        >
          Apply Board
        </button>
        <button type="button" onClick={() => setBoardSnapshotInput("")}>
          Clear
        </button>
      </div>
      <label>
        Board JSON
        <textarea
          rows={8}
          value={boardSnapshotInput}
          onChange={(event) => setBoardSnapshotInput(event.target.value)}
          placeholder='{"radius":4,"hexes":{...},"bridges":{...},"units":{...}}'
        />
      </label>
      {boardSnapshotState.error ? (
        <p className="muted">{boardSnapshotState.error}</p>
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
