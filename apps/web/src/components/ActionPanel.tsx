import { useState } from "react";

import type { ActionDeclaration, GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type PlayerView = GameView["public"]["players"][number];

type ActionPanelProps = {
  phase: GameView["public"]["phase"];
  player: PlayerView | null;
  status: RoomConnectionStatus;
  onSubmit: (declaration: ActionDeclaration) => void;
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
    return "Need at least 1 mana to declare an action.";
  }
  return "Declare one action or choose done.";
};

export const ActionPanel = ({ phase, player, status, onSubmit }: ActionPanelProps) => {
  const [edgeKey, setEdgeKey] = useState("");
  const [marchFrom, setMarchFrom] = useState("");
  const [marchTo, setMarchTo] = useState("");
  const isActionPhase = phase === "round.action";
  const mana = player?.resources.mana ?? 0;
  const gold = player?.resources.gold ?? 0;
  const canSubmit =
    status === "connected" &&
    Boolean(player) &&
    isActionPhase &&
    !player?.doneThisRound &&
    mana >= 1;
  const canReinforce = canSubmit && gold >= 1;
  const canBuildBridge = canSubmit && edgeKey.trim().length > 0;
  const canMarch = canSubmit && marchFrom.trim().length > 0 && marchTo.trim().length > 0;
  const hint = getActionHint(phase, status, player);

  return (
    <div className="action-panel">
      <div className="action-panel__buttons">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit}
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
      <p className="action-panel__hint">{hint}</p>
    </div>
  );
};
