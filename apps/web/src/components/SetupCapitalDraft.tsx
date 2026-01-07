import { useMemo } from "react";

import {
  DEFAULT_CONFIG,
  getCapitalSlots,
  type GameView,
  type HexKey,
  type PlayerID,
  type SetupChoice
} from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

type SetupCapitalDraftProps = {
  view: GameView;
  playerId: PlayerID | null;
  status: RoomConnectionStatus;
  onSubmitChoice: (choice: SetupChoice) => void;
};

type CapitalAssignments = {
  capitalByPlayer: Map<PlayerID, HexKey>;
  capitalByHex: Map<HexKey, PlayerID>;
};

const buildCapitalAssignments = (board: GameView["public"]["board"]): CapitalAssignments => {
  const capitalByPlayer = new Map<PlayerID, HexKey>();
  const capitalByHex = new Map<HexKey, PlayerID>();
  for (const hex of Object.values(board.hexes)) {
    if (hex.tile !== "capital" || !hex.ownerPlayerId) {
      continue;
    }
    capitalByPlayer.set(hex.ownerPlayerId, hex.key);
    capitalByHex.set(hex.key, hex.ownerPlayerId);
  }
  return { capitalByPlayer, capitalByHex };
};

const buildDraftOrder = (players: GameView["public"]["players"]): PlayerID[] => {
  return [...players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => player.id)
    .reverse();
};

export const SetupCapitalDraft = ({
  view,
  playerId,
  status,
  onSubmitChoice
}: SetupCapitalDraftProps) => {
  const players = view.public.players;
  const playerCount = players.length;
  const radius = view.public.board.radius;
  const capitalSlots = useMemo(() => {
    try {
      return getCapitalSlots(
        playerCount,
        radius,
        DEFAULT_CONFIG.capitalSlotsByPlayerCount
      );
    } catch {
      return [];
    }
  }, [playerCount, radius]);

  const { capitalByPlayer, capitalByHex } = useMemo(
    () => buildCapitalAssignments(view.public.board),
    [view.public.board]
  );

  const slotLabels = useMemo(() => {
    return new Map(capitalSlots.map((slot, index) => [slot, String(index + 1)]));
  }, [capitalSlots]);

  const availableSlots = useMemo(
    () => capitalSlots.filter((slot) => !capitalByHex.has(slot)),
    [capitalSlots, capitalByHex]
  );
  const draftOrder = useMemo(() => buildDraftOrder(players), [players]);

  const isCapitalDraft =
    view.public.phase === "setup" &&
    capitalSlots.length > 0 &&
    availableSlots.length > 0;

  if (!isCapitalDraft) {
    return null;
  }

  const pickedPlayers = new Set(capitalByPlayer.keys());
  const nextPickerId = draftOrder.find((id) => !pickedPlayers.has(id)) ?? null;
  const nextPickerName =
    players.find((player) => player.id === nextPickerId)?.name ?? "Unknown";
  const localCapital = playerId ? capitalByPlayer.get(playerId) ?? null : null;
  const localCapitalLabel = localCapital
    ? slotLabels.get(localCapital)
    : null;
  const canPick =
    status === "connected" && Boolean(playerId) && playerId === nextPickerId;

  const helperText = (() => {
    if (status !== "connected") {
      return "Connect to pick a capital slot.";
    }
    if (!playerId) {
      return "Spectators can watch the draft but cannot pick.";
    }
    if (canPick) {
      return "Your turn: select a capital slot.";
    }
    return `Waiting for ${nextPickerName} to pick.`;
  })();

  return (
    <section className="panel setup-draft">
      <h2>Capital Draft</h2>
      <p className="muted">
        Pick an available capital slot when it is your turn. Slots are labeled on the map.
      </p>
      <div className="setup-draft__summary">
        <div className="resource-row">
          <span>Up next</span>
          <strong>{nextPickerName}</strong>
        </div>
        {localCapital ? (
          <div className="resource-row">
            <span>Your pick</span>
            <strong title={localCapital}>
              {localCapitalLabel ? `Slot ${localCapitalLabel}` : localCapital}
            </strong>
          </div>
        ) : null}
      </div>
      <div className="setup-draft__slots">
        {availableSlots.map((slot) => {
          const label = slotLabels.get(slot);
          return (
            <button
              key={slot}
              type="button"
              className="btn btn-secondary"
              disabled={!canPick}
              onClick={() => onSubmitChoice({ kind: "pickCapital", hexKey: slot })}
              title={slot}
            >
              {label ? `Slot ${label}` : slot}
            </button>
          );
        })}
      </div>
      <div className="setup-draft__players">
        {players.map((player) => {
          const capitalHex = capitalByPlayer.get(player.id) ?? null;
          const capitalLabel = capitalHex ? slotLabels.get(capitalHex) : null;
          const isActive = player.id === nextPickerId && !capitalHex;
          return (
            <div
              key={player.id}
              className={`setup-draft__player-row${
                isActive ? " setup-draft__player-row--active" : ""
              }`}
            >
              <span>{player.name}</span>
              <strong title={capitalHex ?? undefined}>
                {capitalHex
                  ? capitalLabel
                    ? `Slot ${capitalLabel}`
                    : capitalHex
                  : isActive
                    ? "Picking..."
                    : "Waiting"}
              </strong>
            </div>
          );
        })}
      </div>
      <p className="muted">{helperText}</p>
    </section>
  );
};
