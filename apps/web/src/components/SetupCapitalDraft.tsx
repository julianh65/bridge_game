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

const buildCapitalAssignments = (choices: Record<PlayerID, HexKey | null>): CapitalAssignments => {
  const capitalByPlayer = new Map<PlayerID, HexKey>();
  const capitalByHex = new Map<HexKey, PlayerID>();
  for (const [playerId, hexKey] of Object.entries(choices)) {
    if (!hexKey) {
      continue;
    }
    const typedPlayerId = playerId as PlayerID;
    capitalByPlayer.set(typedPlayerId, hexKey);
    capitalByHex.set(hexKey, typedPlayerId);
  }
  return { capitalByPlayer, capitalByHex };
};

export const SetupCapitalDraft = ({
  view,
  playerId,
  status,
  onSubmitChoice
}: SetupCapitalDraftProps) => {
  const setup = view.public.setup;
  const players = view.public.players;
  const playerCount = players.length;
  const radius = view.public.board.radius;
  const capitalSlots = useMemo(() => {
    if (setup?.type === "setup.capitalDraft") {
      return setup.availableSlots;
    }
    try {
      return getCapitalSlots(
        playerCount,
        radius,
        DEFAULT_CONFIG.capitalSlotsByPlayerCount
      );
    } catch {
      return [];
    }
  }, [playerCount, radius, setup]);

  const { capitalByPlayer, capitalByHex } = useMemo(() => {
    if (setup?.type === "setup.capitalDraft") {
      return buildCapitalAssignments(setup.choices);
    }
    return { capitalByPlayer: new Map<PlayerID, HexKey>(), capitalByHex: new Map<HexKey, PlayerID>() };
  }, [setup]);

  const slotLabels = useMemo(() => {
    return new Map(capitalSlots.map((slot, index) => [slot, String(index + 1)]));
  }, [capitalSlots]);

  const availableSlots = useMemo(
    () => capitalSlots.filter((slot) => !capitalByHex.has(slot)),
    [capitalSlots, capitalByHex]
  );
  const waitingFor = useMemo(() => {
    if (setup?.type !== "setup.capitalDraft") {
      return new Set<PlayerID>();
    }
    return new Set(setup.waitingForPlayerIds);
  }, [setup]);

  const isCapitalDraft = setup?.type === "setup.capitalDraft" && capitalSlots.length > 0;

  if (!isCapitalDraft) {
    return null;
  }

  const lockedCount = players.length - waitingFor.size;
  const localCapital = playerId ? capitalByPlayer.get(playerId) ?? null : null;
  const localCapitalLabel = localCapital
    ? slotLabels.get(localCapital)
    : null;
  const canPick =
    status === "connected" && Boolean(playerId) && waitingFor.has(playerId as PlayerID);
  const canUnlock =
    status === "connected" &&
    Boolean(playerId) &&
    Boolean(localCapital) &&
    !waitingFor.has(playerId as PlayerID);

  const helperText = (() => {
    if (status !== "connected") {
      return "Connect to pick a capital slot.";
    }
    if (!playerId) {
      return "Spectators can watch the draft but cannot pick.";
    }
    if (canPick) {
      return "Select a capital slot to lock in. You can unlock to change while others pick.";
    }
    if (canUnlock) {
      return "Capital locked. Unlock to change your slot.";
    }
    return "Waiting for other players to lock in.";
  })();

  return (
    <section className="panel setup-draft">
      <h2>Capital Draft</h2>
      <p className="muted">
        Pick an available capital slot to lock in your capital. Slots are labeled on the map.
      </p>
      <div className="setup-draft__summary">
        <div className="resource-row">
          <span>Locked</span>
          <strong>
            {lockedCount}/{players.length}
          </strong>
        </div>
        {localCapital ? (
          <div className="resource-row">
            <span>Your pick</span>
            <strong title={localCapital}>
              {localCapitalLabel ? `Slot ${localCapitalLabel}` : localCapital}
            </strong>
            {canUnlock ? (
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => onSubmitChoice({ kind: "unlockCapital" })}
              >
                Unlock
              </button>
            ) : null}
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
          const isActive = waitingFor.has(player.id);
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
                    : "Locked"}
              </strong>
            </div>
          );
        })}
      </div>
      <p className="muted">{helperText}</p>
    </section>
  );
};
