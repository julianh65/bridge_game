import { useMemo } from "react";

import type { GameEvent, GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type LobbyDiceProps = {
  view: GameView;
  playerId: string | null;
  status: RoomConnectionStatus;
  onRoll: () => void;
};

type DiceRoll = {
  playerId: string;
  roll: number;
  sides: number;
};

const readDiceRoll = (event: GameEvent): DiceRoll | null => {
  if (event.type !== "lobby.diceRolled") {
    return null;
  }
  const payload = event.payload ?? {};
  const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
  const roll = typeof payload.roll === "number" ? payload.roll : null;
  const sides = typeof payload.sides === "number" ? payload.sides : 6;
  if (!playerId || roll === null) {
    return null;
  }
  return { playerId, roll, sides };
};

export const LobbyDice = ({ view, playerId, status, onRoll }: LobbyDiceProps) => {
  const canRoll = status === "connected" && Boolean(playerId);
  const lastRoll = useMemo(() => {
    for (let i = view.public.logs.length - 1; i >= 0; i -= 1) {
      const roll = readDiceRoll(view.public.logs[i]);
      if (roll) {
        return roll;
      }
    }
    return null;
  }, [view.public.logs]);
  const playerNames = useMemo(
    () => new Map(view.public.players.map((player) => [player.id, player.name])),
    [view.public.players]
  );

  const lastRollLabel = lastRoll
    ? `${playerNames.get(lastRoll.playerId) ?? lastRoll.playerId} rolled ${lastRoll.roll} (d${
        lastRoll.sides
      })`
    : "No rolls yet.";

  return (
    <section className="panel lobby-dice">
      <div className="lobby-dice__header">
        <div>
          <p className="eyebrow">Lobby Dice</p>
          <h2>Roll a shared die</h2>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRoll}
          disabled={!canRoll}
        >
          Roll d6
        </button>
      </div>
      <p className="muted">Results are shared with everyone in the room.</p>
      <div className="resource-row">
        <span>Last roll</span>
        <strong>{lastRollLabel}</strong>
      </div>
    </section>
  );
};
