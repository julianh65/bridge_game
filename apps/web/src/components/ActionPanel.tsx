import type { ActionDeclaration, GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type PlayerView = GameView["public"]["players"][number];

type ActionPanelProps = {
  phase: GameView["public"]["phase"];
  player: PlayerView | null;
  players: PlayerView[];
  actionStep: GameView["public"]["actionStep"];
  status: RoomConnectionStatus;
  edgeKey: string;
  marchFrom: string;
  marchTo: string;
  cardInstanceId: string;
  cardTargetsRaw: string;
  boardPickMode: BoardPickMode;
  onSubmit: (declaration: ActionDeclaration) => void;
  onEdgeKeyChange: (value: string) => void;
  onMarchFromChange: (value: string) => void;
  onMarchToChange: (value: string) => void;
  onCardInstanceIdChange: (value: string) => void;
  onCardTargetsRawChange: (value: string) => void;
  onBoardPickModeChange: (mode: BoardPickMode) => void;
};

type CardTargets = Record<string, unknown> | null;

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

const formatTargetsSummary = (
  targets: CardTargets | undefined,
  raw: string
): string => {
  if (raw.trim().length === 0) {
    return "No targets selected.";
  }
  if (!targets || typeof targets !== "object") {
    return "Targets set.";
  }
  const record = targets as Record<string, unknown>;
  const edgeKey = record.edgeKey;
  if (typeof edgeKey === "string" && edgeKey.length > 0) {
    return `Edge ${edgeKey}`;
  }
  const hexKey = record.hexKey;
  if (typeof hexKey === "string" && hexKey.length > 0) {
    return `Hex ${hexKey}`;
  }
  const from = record.from;
  const to = record.to;
  if (typeof from === "string" && typeof to === "string") {
    return `From ${from} -> ${to}`;
  }
  const path = record.path;
  if (
    Array.isArray(path) &&
    path.every((entry) => typeof entry === "string" && entry.length > 0)
  ) {
    return `Path ${path.join(" -> ")}`;
  }
  const choice = record.choice ?? record.kind;
  if (choice === "capital") {
    return "Choice: capital";
  }
  if (choice === "occupiedHex") {
    return typeof hexKey === "string" && hexKey.length > 0
      ? `Choice: occupied hex ${hexKey}`
      : "Choice: occupied hex";
  }
  const unitId = record.unitId ?? record.championId;
  if (typeof unitId === "string" && unitId.length > 0) {
    return `Champion ${unitId}`;
  }
  return "Targets set.";
};

const getActionHint = (
  phase: GameView["public"]["phase"],
  status: RoomConnectionStatus,
  player: PlayerView | null
): string => {
  if (status !== "connected") {
    return "Connect to submit actions.";
  }
  if (!player) {
    return "Spectators cannot submit actions.";
  }
  if (phase !== "round.action") {
    return "Actions are available during the action phase.";
  }
  if (player.doneThisRound) {
    return "You already submitted this action step.";
  }
  if (player.resources.mana < 1) {
    return "No mana for actions; you can choose done.";
  }
  return "Declare one action or choose done.";
};

export const ActionPanel = ({
  phase,
  player,
  players,
  actionStep,
  status,
  edgeKey,
  marchFrom,
  marchTo,
  cardInstanceId,
  cardTargetsRaw,
  boardPickMode,
  onSubmit,
  onEdgeKeyChange,
  onMarchFromChange,
  onMarchToChange,
  onCardInstanceIdChange,
  onCardTargetsRawChange,
  onBoardPickModeChange
}: ActionPanelProps) => {
  const isActionPhase = phase === "round.action";
  const mana = player?.resources.mana ?? 0;
  const gold = player?.resources.gold ?? 0;
  const canSubmitDone =
    status === "connected" && Boolean(player) && isActionPhase && !player?.doneThisRound;
  const canSubmitAction = canSubmitDone && mana >= 1;
  const canReinforce = canSubmitAction && gold >= 1;
  const canBuildBridge = canSubmitAction && edgeKey.trim().length > 0;
  const canMarch =
    canSubmitAction && marchFrom.trim().length > 0 && marchTo.trim().length > 0;
  const canPickMarchTo = marchFrom.trim().length > 0;
  const trimmedCardId = cardInstanceId.trim();
  const trimmedTargets = cardTargetsRaw.trim();
  let parsedTargets: CardTargets | undefined;
  let targetsError: string | null = null;
  if (trimmedTargets.length > 0) {
    try {
      const parsed = JSON.parse(trimmedTargets) as unknown;
      if (parsed === null || typeof parsed === "object") {
        parsedTargets = parsed as CardTargets;
      } else {
        targetsError = "Targets must be a JSON object or null.";
      }
    } catch {
      targetsError = "Targets JSON could not be parsed.";
    }
  }
  const canPlayCard =
    canSubmitAction && trimmedCardId.length > 0 && targetsError === null;
  const hint = getActionHint(phase, status, player);
  const pickLabel =
    boardPickMode === "marchFrom"
      ? "Board pick: March from"
      : boardPickMode === "marchTo"
        ? "Board pick: March to"
        : boardPickMode === "bridgeEdge"
          ? "Board pick: Bridge edge"
          : boardPickMode === "cardEdge"
            ? "Board pick: Card edge"
            : boardPickMode === "cardHex"
              ? "Board pick: Card hex"
            : boardPickMode === "cardStack"
              ? "Board pick: Card stack"
              : boardPickMode === "cardPath"
                ? "Board pick: Card path"
                : boardPickMode === "cardChoice"
                  ? "Board pick: Card choice"
                  : "Board pick: none";
  const actionStepStatus = actionStep
    ? (() => {
        const eligible = new Set(actionStep.eligiblePlayerIds);
        const waiting = new Set(actionStep.waitingForPlayerIds);
        return {
          waiting: players.filter((entry) => waiting.has(entry.id)).map((entry) => entry.name),
          submitted: players
            .filter((entry) => eligible.has(entry.id) && !waiting.has(entry.id))
            .map((entry) => entry.name)
        };
      })()
    : null;

  return (
    <div className="action-panel">
      <div className="action-panel__buttons">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmitDone}
          onClick={() => onSubmit({ kind: "done" })}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canReinforce}
          onClick={() =>
            onSubmit({ kind: "basic", action: { kind: "capitalReinforce" } })
          }
        >
          Capital Reinforce (-1 mana, -1 gold)
        </button>
      </div>
      <label className="action-field">
        <span>Bridge edge</span>
        <div className="action-field__controls">
          <div
            className={`action-field__value ${edgeKey.trim().length > 0 ? "" : "is-empty"}`}
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
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!canBuildBridge}
        onClick={() =>
          onSubmit({
            kind: "basic",
            action: { kind: "buildBridge", edgeKey: edgeKey.trim() }
          })
        }
      >
        Build Bridge (-1 mana)
      </button>
      <div className="action-panel__march">
        <label className="action-field">
          <span>March from</span>
          <div className="action-field__controls">
            <div
              className={`action-field__value ${marchFrom.trim().length > 0 ? "" : "is-empty"}`}
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
        <label className="action-field">
          <span>March to</span>
          <div className="action-field__controls">
            <div
              className={`action-field__value ${marchTo.trim().length > 0 ? "" : "is-empty"}`}
            >
              {marchTo.trim().length > 0 ? marchTo : "Pick a destination hex"}
            </div>
            <button
              type="button"
              className={`btn btn-tertiary ${
                boardPickMode === "marchTo" ? "is-active" : ""
              }`}
              disabled={!canPickMarchTo}
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
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!canMarch}
        onClick={() =>
          onSubmit({
            kind: "basic",
            action: { kind: "march", from: marchFrom.trim(), to: marchTo.trim() }
          })
        }
      >
        March (-1 mana)
      </button>
      <label className="action-field">
        <span>Selected card</span>
        <div className="action-field__controls">
          <div
            className={`action-field__value ${
              trimmedCardId.length > 0 ? "" : "is-empty"
            }`}
          >
            {trimmedCardId.length > 0 ? trimmedCardId : "Select a card from your hand"}
          </div>
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={trimmedCardId.length === 0}
            onClick={() => {
              onCardInstanceIdChange("");
              onCardTargetsRawChange("");
              if (boardPickMode !== "none") {
                onBoardPickModeChange("none");
              }
            }}
          >
            Clear
          </button>
        </div>
      </label>
      <label className="action-field">
        <span>Card targets</span>
        <div
          className={`action-field__value ${
            trimmedTargets.length > 0 ? "" : "is-empty"
          }`}
        >
          {formatTargetsSummary(parsedTargets, trimmedTargets)}
        </div>
      </label>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!canPlayCard}
        onClick={() => {
          if (!canPlayCard) {
            return;
          }
          const declaration: ActionDeclaration =
            parsedTargets !== undefined
              ? {
                  kind: "card",
                  cardInstanceId: trimmedCardId,
                  targets: parsedTargets
                }
              : { kind: "card", cardInstanceId: trimmedCardId };
          onSubmit(declaration);
        }}
      >
        Play Card (-card cost)
      </button>
      {targetsError ? <p className="action-panel__hint">{targetsError}</p> : null}
      <p className="action-panel__hint">{pickLabel}</p>
      <p className="action-panel__hint">{hint}</p>
      {actionStepStatus ? (
        <>
          <p className="action-panel__hint">
            Waiting on:{" "}
            {actionStepStatus.waiting.length > 0
              ? actionStepStatus.waiting.join(", ")
              : "none"}
          </p>
          <p className="action-panel__hint">
            Submitted:{" "}
            {actionStepStatus.submitted.length > 0
              ? actionStepStatus.submitted.join(", ")
              : "none"}
          </p>
        </>
      ) : null}
    </div>
  );
};
