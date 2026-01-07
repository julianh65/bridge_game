import type { GameView } from "@bridgefront/engine";

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
  player: PlayerView | null;
  canSubmitAction: boolean;
  edgeKey: string;
  marchFrom: string;
  marchTo: string;
  marchForceCount: number | null;
  marchForceMax: number;
  reinforceHex: string;
  reinforceOptions: { key: string; label: string }[];
  boardPickMode: BoardPickMode;
  basicActionIntent: BasicActionIntent;
  onBasicActionIntentChange: (value: BasicActionIntent) => void;
  onMarchForceCountChange: (value: number | null) => void;
  onReinforceHexChange: (value: string) => void;
  onBoardPickModeChange: (mode: BoardPickMode) => void;
};

export const ActionPanel = ({
  player,
  canSubmitAction,
  edgeKey,
  marchFrom,
  marchTo,
  marchForceCount,
  marchForceMax,
  reinforceHex,
  reinforceOptions,
  boardPickMode,
  basicActionIntent,
  onBasicActionIntentChange,
  onMarchForceCountChange,
  onReinforceHexChange,
  onBoardPickModeChange
}: ActionPanelProps) => {
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
  const canSplitForces = marchForceMax > 1;
  const showSplitControls = basicActionIntent === "march" && canSplitForces && marchFrom;
  const currentForceCount =
    marchForceCount === null ? Math.min(1, marchForceMax) : marchForceCount;

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
          <button
            type="button"
            className={`action-field__value action-field__value--button ${
              edgeKey.trim().length > 0 ? "" : "is-empty"
            } ${isPickingBridge ? "is-active" : ""}`}
            disabled={!canSubmitAction}
            onClick={() =>
              onBoardPickModeChange(isPickingBridge ? "none" : "bridgeEdge")
            }
          >
            {edgeKey.trim().length > 0 ? edgeKey : "Pick an edge on the board"}
          </button>
        </label>
      ) : null}

      {basicActionIntent === "march" ? (
        <div className="action-panel__march">
          <label className={`action-field action-field--compact ${isPickingMarchFrom ? "is-active" : ""}`}>
            <span>March from</span>
            <button
              type="button"
              className={`action-field__value action-field__value--button ${
                marchFrom.trim().length > 0 ? "" : "is-empty"
              } ${isPickingMarchFrom ? "is-active" : ""}`}
              disabled={!canSubmitAction}
              onClick={() =>
                onBoardPickModeChange(isPickingMarchFrom ? "none" : "marchFrom")
              }
            >
              {marchFrom.trim().length > 0 ? marchFrom : "Pick a start hex"}
            </button>
          </label>
          <label className={`action-field action-field--compact ${isPickingMarchTo ? "is-active" : ""}`}>
            <span>March to</span>
            <button
              type="button"
              className={`action-field__value action-field__value--button ${
                marchTo.trim().length > 0 ? "" : "is-empty"
              } ${isPickingMarchTo ? "is-active" : ""}`}
              disabled={!canSubmitAction || marchFrom.trim().length === 0}
              onClick={() =>
                onBoardPickModeChange(isPickingMarchTo ? "none" : "marchTo")
              }
            >
              {marchTo.trim().length > 0 ? marchTo : "Pick a destination hex"}
            </button>
          </label>
          {showSplitControls ? (
            <div className="action-panel__split">
              <div className="action-panel__split-header">
                <span>Forces to move</span>
                <div className="action-panel__split-toggle">
                  <button
                    type="button"
                    className={`btn btn-tertiary ${
                      marchForceCount === null ? "is-active" : ""
                    }`}
                    onClick={() => onMarchForceCountChange(null)}
                  >
                    Move all
                  </button>
                  <button
                    type="button"
                    className={`btn btn-tertiary ${
                      marchForceCount !== null ? "is-active" : ""
                    }`}
                    onClick={() =>
                      onMarchForceCountChange(
                        marchForceCount === null ? Math.min(1, marchForceMax) : marchForceCount
                      )
                    }
                  >
                    Split
                  </button>
                </div>
              </div>
              {marchForceCount !== null ? (
                <div className="action-panel__split-controls">
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    disabled={currentForceCount <= 1}
                    onClick={() =>
                      onMarchForceCountChange(Math.max(1, currentForceCount - 1))
                    }
                  >
                    −
                  </button>
                  <div className="action-panel__split-count">{currentForceCount}</div>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    disabled={currentForceCount >= marchForceMax}
                    onClick={() =>
                      onMarchForceCountChange(
                        Math.min(marchForceMax, currentForceCount + 1)
                      )
                    }
                  >
                    +
                  </button>
                  <span className="action-panel__split-hint">
                    of {marchForceMax} forces
                  </span>
                </div>
              ) : (
                <p className="action-panel__split-note">Moves the full stack.</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {basicActionIntent === "reinforce" ? (
        <label className="action-field action-field--compact">
          <span>Reinforce target</span>
          <div className={`action-field__value ${selectedReinforce ? "" : "is-empty"}`}>
            {reinforceLabel}
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
