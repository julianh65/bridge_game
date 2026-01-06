import { useState } from "react";

import type { ActionDeclaration, GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type PlayerView = GameView["public"]["players"][number];

type ActionPanelProps = {
  phase: GameView["public"]["phase"];
  player: PlayerView | null;
  players: PlayerView[];
  actionStep: GameView["public"]["actionStep"];
  status: RoomConnectionStatus;
  onSubmit: (declaration: ActionDeclaration) => void;
};

type CardTargets = Record<string, unknown> | null;

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
  onSubmit
}: ActionPanelProps) => {
  const [edgeKey, setEdgeKey] = useState("");
  const [marchFrom, setMarchFrom] = useState("");
  const [marchTo, setMarchTo] = useState("");
  const [cardInstanceId, setCardInstanceId] = useState("");
  const [cardTargetsRaw, setCardTargetsRaw] = useState("");
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
        <span>Build bridge (edge key)</span>
        <input
          type="text"
          placeholder="q,r|q,r"
          value={edgeKey}
          onChange={(event) => setEdgeKey(event.target.value)}
        />
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
          <input
            type="text"
            placeholder="q,r"
            value={marchFrom}
            onChange={(event) => setMarchFrom(event.target.value)}
          />
        </label>
        <label className="action-field">
          <span>March to</span>
          <input
            type="text"
            placeholder="q,r"
            value={marchTo}
            onChange={(event) => setMarchTo(event.target.value)}
          />
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
        <span>Play card (instance id)</span>
        <input
          type="text"
          placeholder="ci_12"
          value={cardInstanceId}
          onChange={(event) => setCardInstanceId(event.target.value)}
        />
      </label>
      <label className="action-field">
        <span>Card targets JSON (optional)</span>
        <input
          type="text"
          placeholder='{"edgeKey":"q,r|q,r"}'
          value={cardTargetsRaw}
          onChange={(event) => setCardTargetsRaw(event.target.value)}
        />
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
      <p className="action-panel__hint">
        Targets examples:{" "}
        {"{\"from\":\"0,0\",\"to\":\"1,0\"} | {\"path\":[\"0,0\",\"1,0\"]} | {\"edgeKey\":\"0,0|1,0\"}"}
      </p>
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
