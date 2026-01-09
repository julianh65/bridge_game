import { useEffect, useMemo, useState } from "react";

import type {
  BoardState,
  GameView,
  HexKey,
  PlayerID,
  SetupChoice,
  SetupConfigUpdate
} from "@bridgefront/engine";

import { BoardView } from "./BoardView";
import { FactionSymbol } from "./FactionSymbol";
import { RoomCodeCopy } from "./RoomCodeCopy";
import { SetupCapitalDraft } from "./SetupCapitalDraft";
import { SetupDeckPreview } from "./SetupDeckPreview";
import { SetupFreeStartingCardPick } from "./SetupFreeStartingCardPick";
import { SetupStartingBridges } from "./SetupStartingBridges";
import { buildBoardPreview } from "../lib/board-preview";
import { getFactionName } from "../lib/factions";
import type { DebugCommand, RoomConnectionStatus } from "../lib/room-client";

const getAgeForRound = (round: number) => {
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
  { label: "Age I (Round 1)", round: 1 },
  { label: "Age II (Round 4)", round: 4 },
  { label: "Age III (Round 8)", round: 8 }
];

type SetupFlowProps = {
  view: GameView;
  playerId: PlayerID | null;
  roomId: string;
  status: RoomConnectionStatus;
  onRerollMap: () => void;
  onSubmitSetupChoice: (choice: SetupChoice) => void;
  onSubmitSetupConfig: (update: SetupConfigUpdate) => void;
  onAutoSetup: () => void;
  onAdvanceSetup: () => void;
  onDebugCommand: (command: DebugCommand) => void;
  onLeave: () => void;
};

export const SetupFlow = ({
  view,
  playerId,
  roomId,
  status,
  onRerollMap,
  onSubmitSetupChoice,
  onSubmitSetupConfig,
  onAutoSetup,
  onAdvanceSetup,
  onDebugCommand,
  onLeave
}: SetupFlowProps) => {
  const players = view.public.players;
  const setup = view.public.setup;
  const setupStatus = view.public.setupStatus;
  const connectedCount = players.filter((player) => player.connected).length;
  const statusLabel = status === "connected" ? "Live" : status === "error" ? "Error" : "Waiting";
  const statusClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const hostId =
    setupStatus?.hostPlayerId ?? players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canReroll = isHost && status === "connected";
  const canAutoSetup = isHost && status === "connected";
  const canAdvanceSetup = Boolean(setupStatus?.canAdvance) && isHost && status === "connected";
  const autoSetupHint = (() => {
    if (status !== "connected") {
      return "Connect to use auto-setup.";
    }
    if (!isHost) {
      return "Only the host can run auto-setup.";
    }
    return "Auto-setup is a dev shortcut for playtesting.";
  })();
  const advanceHint = canAdvanceSetup
    ? "Advance to the next setup phase."
    : "Waiting for all players to lock in.";
  const [scenarioRoundInput, setScenarioRoundInput] = useState("");
  const [scenarioAutoApply, setScenarioAutoApply] = useState(true);
  const [boardSnapshotInput, setBoardSnapshotInput] = useState("");
  const [maxManaInput, setMaxManaInput] = useState(String(view.public.config.MAX_MANA));
  const [vpToWinInput, setVpToWinInput] = useState(String(view.public.config.VP_TO_WIN));
  const [configDirty, setConfigDirty] = useState(false);
  const scenarioRoundValue =
    scenarioRoundInput.trim() === "" ? null : Number(scenarioRoundInput);
  const scenarioRoundValid =
    scenarioRoundValue !== null &&
    Number.isFinite(scenarioRoundValue) &&
    scenarioRoundValue > 0;
  const scenarioRoundNormalized = scenarioRoundValid
    ? Math.max(1, Math.floor(scenarioRoundValue ?? 1))
    : null;
  const scenarioAge =
    scenarioRoundNormalized !== null ? getAgeForRound(scenarioRoundNormalized) : null;
  const maxManaValue = maxManaInput.trim() === "" ? null : Number(maxManaInput);
  const maxManaValid = maxManaValue !== null && Number.isFinite(maxManaValue) && maxManaValue > 0;
  const maxManaNormalized = maxManaValid ? Math.max(1, Math.floor(maxManaValue)) : null;
  const vpToWinValue = vpToWinInput.trim() === "" ? null : Number(vpToWinInput);
  const vpToWinValid = vpToWinValue !== null && Number.isFinite(vpToWinValue) && vpToWinValue > 0;
  const vpToWinNormalized = vpToWinValid ? Math.max(1, Math.floor(vpToWinValue)) : null;
  const hasConfigChanges =
    (maxManaNormalized !== null && maxManaNormalized !== view.public.config.MAX_MANA) ||
    (vpToWinNormalized !== null && vpToWinNormalized !== view.public.config.VP_TO_WIN);
  const canApplyConfig =
    isHost && status === "connected" && hasConfigChanges && maxManaValid && vpToWinValid;
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

  useEffect(() => {
    if (configDirty) {
      return;
    }
    setMaxManaInput(String(view.public.config.MAX_MANA));
    setVpToWinInput(String(view.public.config.VP_TO_WIN));
  }, [configDirty, view.public.config.MAX_MANA, view.public.config.VP_TO_WIN]);

  const handleApplyConfig = () => {
    if (!canApplyConfig) {
      return;
    }
    const update: SetupConfigUpdate = {};
    if (maxManaNormalized !== null) {
      update.maxMana = maxManaNormalized;
    }
    if (vpToWinNormalized !== null) {
      update.vpToWin = vpToWinNormalized;
    }
    if (Object.keys(update).length === 0) {
      return;
    }
    onSubmitSetupConfig(update);
    setConfigDirty(false);
  };
  const canDebug = isHost && status === "connected" && import.meta.env.DEV;
  const canApplyScenario = canDebug && scenarioRoundNormalized !== null;
  const canApplyBoard = canDebug && boardSnapshotState.valid;

  const applyScenarioRound = (round: number) => {
    if (!canDebug) {
      return;
    }
    const normalized = Math.max(1, Math.floor(round));
    const age = getAgeForRound(normalized);
    const leadSeatIndex = players.length > 0 ? (normalized - 1) % players.length : 0;
    onDebugCommand({ command: "patchState", path: "round", value: normalized });
    onDebugCommand({ command: "patchState", path: "market.age", value: age });
    onDebugCommand({ command: "patchState", path: "leadSeatIndex", value: leadSeatIndex });
    onDebugCommand({ command: "state" });
  };

  const applyBoardSnapshot = (snapshot: BoardState) => {
    if (!canDebug) {
      return;
    }
    onDebugCommand({ command: "patchState", path: "board", value: snapshot });
    onDebugCommand({ command: "state" });
  };

  const handleClearBlocks = () => {
    if (!canDebug) {
      return;
    }
    onDebugCommand({ command: "patchState", path: "blocks", value: null });
    onDebugCommand({ command: "patchState", path: "actionResolution", value: null });
    onDebugCommand({ command: "state" });
  };

  const handleApplyScenario = () => {
    if (!canDebug) {
      return;
    }
    if (scenarioRoundNormalized !== null) {
      applyScenarioRound(scenarioRoundNormalized);
    }
    if (boardSnapshotState.valid && boardSnapshotState.value) {
      applyBoardSnapshot(boardSnapshotState.value);
    }
  };

  const handleAutoSetupScenario = () => {
    if (!canAutoSetup) {
      return;
    }
    onAutoSetup();
    if (!scenarioAutoApply) {
      return;
    }
    handleApplyScenario();
  };

  let phaseLabel = "Setup Lobby";
  let phaseSubtitle = "Waiting for the host to start setup.";
  if (setup?.type === "setup.deckPreview") {
    phaseLabel = "Starter Deck";
    phaseSubtitle = "Review your starter deck before drafting capitals.";
  } else if (setup?.type === "setup.capitalDraft") {
    phaseLabel = "Capital Draft";
    phaseSubtitle = "Select a capital slot and lock it in before moving on.";
  } else if (setup?.type === "setup.startingBridges") {
    phaseLabel = "Starting Bridges";
    phaseSubtitle = "Secretly select two bridges near your capital.";
  } else if (setup?.type === "setup.freeStartingCardPick") {
    phaseLabel = "Free Starting Card";
    phaseSubtitle = "Choose one bonus card to add to your starting deck.";
  }

  const mapPreview = useMemo(() => {
    return buildBoardPreview(players.length, String(view.public.seed ?? 0));
  }, [players.length, view.public.seed]);
  const capitalLabels = useMemo(() => {
    return Object.fromEntries(
      mapPreview.capitals.map((slot, index) => [slot, String(index + 1)])
    );
  }, [mapPreview.capitals]);
  const playerLabelById = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const player of players) {
      labels[player.id] = `P${player.seatIndex + 1}`;
    }
    return labels;
  }, [players]);
  const capitalPickLabels = useMemo(() => {
    const labels: Record<string, string> = { ...capitalLabels };
    if (setup?.type !== "setup.capitalDraft") {
      return labels;
    }
    for (const [playerId, hexKey] of Object.entries(setup.choices)) {
      if (!hexKey) {
        continue;
      }
      const slotLabel = labels[hexKey] ?? "";
      const playerLabel = playerLabelById[playerId] ?? playerId;
      labels[hexKey] = slotLabel ? `${slotLabel}/${playerLabel}` : playerLabel;
    }
    return labels;
  }, [capitalLabels, playerLabelById, setup]);
  const pickedCapitals = useMemo(() => {
    if (setup?.type !== "setup.capitalDraft") {
      return [] as HexKey[];
    }
    return Object.values(setup.choices).filter(Boolean) as HexKey[];
  }, [setup]);
  const showMapPreview = setup?.type === "setup.capitalDraft";
  const setupWaiting = useMemo(() => {
    return new Set(setupStatus?.waitingForPlayerIds ?? []);
  }, [setupStatus]);
  const showSetupStatus = Boolean(setupStatus);

  return (
    <section className="lobby setup-flow">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Setup Phase</p>
          <h1>{phaseLabel}</h1>
          <p className="subhead">{phaseSubtitle}</p>
        </div>
        <div className="lobby__status">
          <div className="lobby__status-pills">
            <span className="status-pill">
              {connectedCount}/{players.length} connected
            </span>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </div>
          <RoomCodeCopy roomId={roomId} />
        </div>
      </header>

      {isHost ? (
        <div className="setup-flow__host-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAdvanceSetup}
            disabled={!canAdvanceSetup}
            title={advanceHint}
          >
            Advance Setup
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAutoSetup}
            disabled={!canAutoSetup}
            title={autoSetupHint}
          >
            Auto-setup
          </button>
          <div className="panel">
            <h3>Match Settings</h3>
            <div className="controls">
              <label>
                Max Mana
                <input
                  type="number"
                  min={1}
                  value={maxManaInput}
                  onChange={(event) => {
                    setMaxManaInput(event.target.value);
                    setConfigDirty(true);
                  }}
                />
              </label>
              <label>
                VP to Win
                <input
                  type="number"
                  min={1}
                  value={vpToWinInput}
                  onChange={(event) => {
                    setVpToWinInput(event.target.value);
                    setConfigDirty(true);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleApplyConfig}
                disabled={!canApplyConfig}
              >
                Apply Settings
              </button>
            </div>
            <p className="muted">
              Current: {view.public.config.MAX_MANA} max mana,{" "}
              {view.public.config.VP_TO_WIN} VP to win.
            </p>
          </div>
          {canDebug ? (
            <details className="setup-flow__debug-details">
              <summary>Scenario tools (dev)</summary>
              <div className="panel">
                <p className="muted">
                  Set a round (1, 4, 8) and optionally paste a board snapshot.
                </p>
                <div className="controls">
                  <label>
                    Round
                    <input
                      type="number"
                      value={scenarioRoundInput}
                      onChange={(event) => setScenarioRoundInput(event.target.value)}
                      placeholder="1"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleApplyScenario}
                    disabled={!canApplyScenario && !canApplyBoard}
                  >
                    Apply Scenario
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAutoSetupScenario}
                    disabled={!canAutoSetup}
                    title={autoSetupHint}
                  >
                    Auto-setup + Scenario
                  </button>
                  {scenarioAge ? <span className="muted">Age {scenarioAge}</span> : null}
                </div>
                <div className="controls">
                  {ROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.round}
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => setScenarioRoundInput(String(preset.round))}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={handleClearBlocks}
                  >
                    Clear Blocks
                  </button>
                </div>
                <label className="setup-flow__debug-toggle">
                  <input
                    type="checkbox"
                    checked={scenarioAutoApply}
                    onChange={(event) => setScenarioAutoApply(event.target.checked)}
                  />
                  Auto-apply after auto-setup
                </label>
                <details>
                  <summary>Board JSON</summary>
                  <label>
                    Board snapshot
                    <textarea
                      rows={6}
                      value={boardSnapshotInput}
                      onChange={(event) => setBoardSnapshotInput(event.target.value)}
                      placeholder='{"radius":4,"hexes":{...},"bridges":{...},"units":{...}}'
                    />
                  </label>
                  {boardSnapshotState.error ? (
                    <p className="muted">{boardSnapshotState.error}</p>
                  ) : null}
                  <div className="controls">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        if (boardSnapshotState.value) {
                          applyBoardSnapshot(boardSnapshotState.value);
                        }
                      }}
                      disabled={!canApplyBoard}
                    >
                      Apply Board
                    </button>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => setBoardSnapshotInput("")}
                    >
                      Clear Board JSON
                    </button>
                  </div>
                </details>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="lobby__grid">
        {showMapPreview ? (
          <section className="panel">
            <h2>Map Preview</h2>
            <p className="muted">Capital slots are labeled on the board.</p>
            <div className="lobby__map-preview">
              <BoardView
                hexes={mapPreview.hexRender}
                board={mapPreview.board}
                showCoords={false}
                showTags
                showMineValues={false}
                labelByHex={capitalPickLabels}
                highlightHexKeys={pickedCapitals}
                className="board-svg"
              />
            </div>
            {isHost ? (
              <div className="lobby__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onRerollMap}
                  disabled={!canReroll}
                >
                  Reroll Map
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <SetupCapitalDraft
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <SetupDeckPreview
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <SetupStartingBridges
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <SetupFreeStartingCardPick
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <section className="panel setup-flow__players">
          <h2>Players</h2>
          <ul className="seat-list">
            {players.map((player) => (
              <li key={player.id} className={`seat ${player.connected ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">
                    {player.name}
                    {player.seatIndex === 0 ? <span className="chip chip--host">Host</span> : null}
                    {player.id === playerId ? <span className="chip chip--local">You</span> : null}
                  </span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                  <span className="seat__meta">
                    <span className="faction-inline">
                      <FactionSymbol
                        factionId={player.factionId}
                        className="faction-symbol--small"
                      />
                      {getFactionName(player.factionId)}
                    </span>
                  </span>
                </div>
                <div className="seat__status">
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "Connected" : "Offline"}
                  </span>
                  {showSetupStatus ? (
                    <span
                      className={`seat__setup-indicator ${
                        setupWaiting.has(player.id) ? "is-waiting" : "is-ready"
                      }`}
                      title={
                        setupWaiting.has(player.id)
                          ? "Waiting on setup choice"
                          : "Ready for setup"
                      }
                      aria-label={
                        setupWaiting.has(player.id)
                          ? "Waiting on setup choice"
                          : "Ready for setup"
                      }
                    >
                      {setupWaiting.has(player.id) ? "x" : "ok"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </section>
  );
};
