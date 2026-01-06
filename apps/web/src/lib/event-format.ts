import type { GameEvent, PlayerID } from "@bridgefront/engine";

type PlayerNameLookup = Map<PlayerID, string>;

const readString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const readNumber = (value: unknown): number | null => {
  return typeof value === "number" ? value : null;
};

const readBoolean = (value: unknown): boolean | null => {
  return typeof value === "boolean" ? value : null;
};

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const formatPlayer = (playerId: string | null, playersById: PlayerNameLookup): string => {
  if (!playerId) {
    return "Unknown player";
  }
  return playersById.get(playerId as PlayerID) ?? playerId;
};

const formatPhaseLabel = (phase: string): string => phase.replace("round.", "").replace(".", " ");

const formatCombatSide = (
  side: Record<string, unknown> | null,
  playersById: PlayerNameLookup
): string => {
  if (!side) {
    return "Unknown side";
  }
  const playerId = readString(side.playerId);
  const name = formatPlayer(playerId, playersById);
  const total = readNumber(side.total);
  if (total !== null) {
    return `${name} (${total})`;
  }
  const forces = readNumber(side.forces) ?? 0;
  const champions = readNumber(side.champions) ?? 0;
  return `${name} (${forces}F/${champions}C)`;
};

export const formatGameEvent = (
  event: GameEvent,
  playersById: PlayerNameLookup
): string => {
  const payload = event.payload ?? {};
  const playerId = readString(payload.playerId);

  switch (event.type) {
    case "setup.capitalPicked": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      return `${formatPlayer(playerId, playersById)} picked capital ${hexKey}`;
    }
    case "setup.startingBridgePlaced": {
      const edgeKey = readString(payload.edgeKey) ?? "unknown";
      const alreadyExists = readBoolean(payload.alreadyExists);
      return `${formatPlayer(playerId, playersById)} placed starting bridge ${edgeKey}${
        alreadyExists ? " (existing)" : ""
      }`;
    }
    case "setup.freeStartingCardPicked": {
      const cardId = readString(payload.cardId) ?? "unknown";
      return `${formatPlayer(playerId, playersById)} picked free card ${cardId}`;
    }
    case "lobby.diceRolled": {
      const roll = readNumber(payload.roll);
      const sides = readNumber(payload.sides) ?? 6;
      const rollLabel = roll !== null ? roll : "?";
      return `${formatPlayer(playerId, playersById)} rolled ${rollLabel} (d${sides})`;
    }
    case "action.basic.buildBridge": {
      const action = readRecord(payload.action);
      const edgeKey = readString(action?.edgeKey) ?? "unknown";
      return `${formatPlayer(playerId, playersById)} built bridge ${edgeKey}`;
    }
    case "action.basic.march": {
      const action = readRecord(payload.action);
      const from = readString(action?.from) ?? "unknown";
      const to = readString(action?.to) ?? "unknown";
      return `${formatPlayer(playerId, playersById)} marched ${from} -> ${to}`;
    }
    case "action.basic.capitalReinforce": {
      return `${formatPlayer(playerId, playersById)} reinforced capital`;
    }
    case "action.done": {
      return `${formatPlayer(playerId, playersById)} done`;
    }
    case "combat.start": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const attackers = readRecord(payload.attackers);
      const defenders = readRecord(payload.defenders);
      return `Combat starts at ${hexKey}: ${formatCombatSide(
        attackers,
        playersById
      )} vs ${formatCombatSide(defenders, playersById)}`;
    }
    case "combat.end": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const winnerId = readString(payload.winnerPlayerId);
      const reason = readString(payload.reason);
      const winnerLabel = winnerId ? formatPlayer(winnerId, playersById) : "No winner";
      return `Combat ends at ${hexKey}: ${winnerLabel}${reason ? ` (${reason})` : ""}`;
    }
    default:
      break;
  }

  if (event.type.startsWith("action.card.")) {
    const cardId = readString(payload.cardId) ?? event.type.slice("action.card.".length);
    return `${formatPlayer(playerId, playersById)} played ${cardId}`;
  }

  if (event.type.startsWith("phase.")) {
    const phase = formatPhaseLabel(event.type.slice("phase.".length));
    const round = readNumber(payload.round);
    return round !== null ? `Phase: ${phase} (round ${round})` : `Phase: ${phase}`;
  }

  const summaryParts: string[] = [];
  const hexKey = readString(payload.hexKey);
  const edgeKey = readString(payload.edgeKey);
  const cardId = readString(payload.cardId);
  if (playerId) {
    summaryParts.push(`player=${formatPlayer(playerId, playersById)}`);
  }
  if (hexKey) {
    summaryParts.push(`hex=${hexKey}`);
  }
  if (edgeKey) {
    summaryParts.push(`edge=${edgeKey}`);
  }
  if (cardId) {
    summaryParts.push(`card=${cardId}`);
  }

  if (summaryParts.length > 0) {
    return `${event.type} (${summaryParts.join(", ")})`;
  }

  return event.type;
};
