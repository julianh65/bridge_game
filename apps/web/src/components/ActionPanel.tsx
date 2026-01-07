import type { GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type PlayerView = GameView["public"]["players"][number];

export type BasicActionIntent = "none" | "bridge" | "march" | "reinforce";

export type BoardPickMode =
  | "none"
  | "marchFrom"
  | "marchTo"
  | "bridgeEdge"
  | "cardEdge"
  | "cardHex"
  | "cardStack"
  | "cardPath"
  | "cardChoice";

type ActionPanelProps = {
  phase: GameView["public"]["phase"];
  player: PlayerView | null;
  status: RoomConnectionStatus;
  edgeKey: string;
  marchFrom: string;
  marchTo: string;
  reinforceHex: string;
  reinforceOptions: { key: string; label: string }[];
  boardPickMode: BoardPickMode;
  basicActionIntent: BasicActionIntent;
  onBasicActionIntentChange: (value: BasicActionIntent) => void;
  onEdgeKeyChange: (value: string) => void;
  onMarchFromChange: (value: string) => void;
  onMarchToChange: (value: string) => void;
  onReinforceHexChange: (value: string) => void;
  onBoardPickModeChange: (mode: BoardPickMode) => void;
};

export const ActionPanel = ({
  phase,
  player,
  status,
  edgeKey,
  marchFrom,
  marchTo,
  reinforceHex,
  reinforceOptions,
  boardPickMode,
  basicActionIntent,
  onBasicActionIntentChange,
  onEdgeKeyChange,
  onMarchFromChange,
  onMarchToChange,
  onReinforceHexChange,
  onBoardPickModeChange
}: ActionPanelProps) => {
  const isActionPhase = phase === "round.action";
  const canSubmitAction =
    status === "connected" &&
    Boolean(player) &&
    isActionPhase &&
    !player?.doneThisRound &&
    (player?.resources.mana ?? 0) >= 1;
  const canReinforce =
    canSubmitAction && (player?.resources.gold ?? 0) >= 1 && reinforceOptions.length > 0;
  const isPickingBridge = boardPickMode === "bridgeEdge";
  const isPickingMarchFrom = boardPickMode === "marchFrom";
  const isPickingMarchTo = boardPickMode === "marchTo";
  const selectedReinforce =
    reinforceOptions.find((option) => option.key === reinforceHex) ?? reinforceOptions[0] ?? null;
  const reinforceLabel = selectedReinforce
    ? `${selectedReinforce.label} (${selectedReinforce.key})`
    : "Select a target";

  const toggleIntent = (intent: BasicActionIntent) => {
    const nextIntent = basicActionIntent === intent ? "none" : intent;
    onBasicActionIntentChange(nextIntent);
    if (nextIntent === "none") {
      if (isPickingBridge || isPickingMarchFrom || isPickingMarchTo) {
        onBoardPickModeChange("none");
      }
    }
  };

  return (
    <div className="action-panel action-panel--compact">
      <div className="action-panel__basic">
        <button
          type="button"
          className={`action-chip ${basicActionIntent === "bridge" ? "is-active" : ""}`}
          disabled={!canSubmitAction}
          onClick={() => toggleIntent("bridge")}
        >
          Bridge
        </button>
        <button
          type="button"
          className={`action-chip ${basicActionIntent === "march" ? "is-active" : ""}`}
          disabled={!canSubmitAction}
          onClick={() => toggleIntent("march")}
        >
          March
        </button>
        <button
          type="button"
          className={`action-chip ${basicActionIntent === "reinforce" ? "is-active" : ""}`}
          disabled={!canReinforce}
          onClick={() => toggleIntent("reinforce")}
        >
          Reinforce
        </button>
      </div>

      {basicActionIntent === "bridge" ? (
        <label className={`action-field action-field--compact ${isPickingBridge ? "is-active" : ""}`}>
          <span>Bridge edge</span>
          <div className="action-field__controls">
            <div
              className={`action-field__value ${
                edgeKey.trim().length > 0 ? "" : "is-empty"
              } ${isPickingBridge ? "is-active" : ""}`}
            >
              {edgeKey.trim().length > 0 ? edgeKey : "Pick an edge on the board"}
            </div>
            <button
              type="button"
              className={`btn btn-tertiary ${
                boardPickMode === "bridgeEdge" ? "is-active" : ""
              }`}
              onClick={() =>
                onBoardPickModeChange(
                  boardPickMode === "bridgeEdge" ? "none" : "bridgeEdge"
                )
              }
            >
              Pick
            </button>
            <button
              type="button"
              className="btn btn-tertiary"
              disabled={edgeKey.trim().length === 0}
              onClick={() => {
                onEdgeKeyChange("");
                if (boardPickMode === "bridgeEdge") {
                  onBoardPickModeChange("none");
                }
              }}
            >
              Clear
            </button>
          </div>
        </label>
      ) : null}

      {basicActionIntent === "march" ? (
        <div className="action-panel__march">
          <label className={`action-field action-field--compact ${isPickingMarchFrom ? "is-active" : ""}`}>
            <span>March from</span>
            <div className="action-field__controls">
              <div
                className={`action-field__value ${
                  marchFrom.trim().length > 0 ? "" : "is-empty"
                } ${isPickingMarchFrom ? "is-active" : ""}`}
              >
                {marchFrom.trim().length > 0 ? marchFrom : "Pick a start hex"}
              </div>
              <button
                type="button"
                className={`btn btn-tertiary ${
                  boardPickMode === "marchFrom" ? "is-active" : ""
                }`}
                onClick={() =>
                  onBoardPickModeChange(
                    boardPickMode === "marchFrom" ? "none" : "marchFrom"
                  )
                }
              >
                Pick
              </button>
              <button
                type="button"
                className="btn btn-tertiary"
                disabled={marchFrom.trim().length === 0 && marchTo.trim().length === 0}
                onClick={() => {
                  onMarchFromChange("");
                  onMarchToChange("");
                  if (boardPickMode === "marchFrom" || boardPickMode === "marchTo") {
                    onBoardPickModeChange("none");
                  }
                }}
              >
                Clear
              </button>
            </div>
          </label>
          <label className={`action-field action-field--compact ${isPickingMarchTo ? "is-active" : ""}`}>
            <span>March to</span>
            <div className="action-field__controls">
              <div
                className={`action-field__value ${
                  marchTo.trim().length > 0 ? "" : "is-empty"
                } ${isPickingMarchTo ? "is-active" : ""}`}
              >
                {marchTo.trim().length > 0 ? marchTo : "Pick a destination hex"}
              </div>
              <button
                type="button"
                className={`btn btn-tertiary ${
                  boardPickMode === "marchTo" ? "is-active" : ""
                }`}
                disabled={marchFrom.trim().length === 0}
                onClick={() =>
                  onBoardPickModeChange(
                    boardPickMode === "marchTo" ? "none" : "marchTo"
                  )
                }
              >
                Pick
              </button>
              <button
                type="button"
                className="btn btn-tertiary"
                disabled={marchTo.trim().length === 0}
                onClick={() => {
                  onMarchToChange("");
                  if (boardPickMode === "marchTo") {
                    onBoardPickModeChange("none");
                  }
                }}
              >
                Clear
              </button>
            </div>
          </label>
        </div>
      ) : null}

      {basicActionIntent === "reinforce" ? (
        <label className="action-field action-field--compact">
          <span>Reinforce target</span>
          <div className="action-field__controls">
            <div
              className={`action-field__value ${
                selectedReinforce ? "" : "is-empty"
              }`}
            >
              {reinforceLabel}
            </div>
          </div>
          {reinforceOptions.length > 1 ? (
            <div className="action-panel__buttons">
              {reinforceOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`btn btn-tertiary ${
                    option.key === selectedReinforce?.key ? "is-active" : ""
                  }`}
                  onClick={() => onReinforceHexChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </label>
      ) : null}
    </div>
  );
};
