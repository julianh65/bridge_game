import { useEffect, useMemo, useState } from "react";

import type { RoomClient } from "../lib/room-client";

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
  const patchPathValue = patchPath.trim();
  const canPatch = canSend && patchPathValue !== "" && patchValueState.valid;
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
