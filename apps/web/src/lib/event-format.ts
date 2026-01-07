import type { GameEvent, PlayerID } from "@bridgefront/engine";
import { parseEdgeKey } from "@bridgefront/shared";

type PlayerNameLookup = Map<PlayerID, string>;

const formatHexKey = (hexKey: string, hexLabels?: Record<string, string>): string => {
  return hexLabels?.[hexKey] ?? hexKey;
};

const formatEdgeKey = (edgeKey: string, hexLabels?: Record<string, string>): string => {
  if (!hexLabels) {
    return edgeKey;
  }
  try {
    const [from, to] = parseEdgeKey(edgeKey);
    return `${formatHexKey(from, hexLabels)}-${formatHexKey(to, hexLabels)}`;
  } catch {
    return edgeKey;
  }
};

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

const readArray = (value: unknown): unknown[] | null => {
  return Array.isArray(value) ? value : null;
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
  playersById: PlayerNameLookup,
  hexLabels?: Record<string, string>
): string => {
  const payload = event.payload ?? {};
  const playerId = readString(payload.playerId);

  switch (event.type) {
    case "setup.capitalPicked": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const hexLabel = formatHexKey(hexKey, hexLabels);
      return `${formatPlayer(playerId, playersById)} picked capital ${hexLabel}`;
    }
    case "setup.startingBridgePlaced": {
      const edgeKey = readString(payload.edgeKey) ?? "unknown";
      const alreadyExists = readBoolean(payload.alreadyExists);
      const edgeLabel = formatEdgeKey(edgeKey, hexLabels);
      return `${formatPlayer(playerId, playersById)} placed starting bridge ${edgeLabel}${
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
      const edgeLabel = formatEdgeKey(edgeKey, hexLabels);
      return `${formatPlayer(playerId, playersById)} built bridge ${edgeLabel}`;
    }
    case "action.basic.march": {
      const action = readRecord(payload.action);
      const from = readString(action?.from) ?? "unknown";
      const to = readString(action?.to) ?? "unknown";
      const fromLabel = formatHexKey(from, hexLabels);
      const toLabel = formatHexKey(to, hexLabels);
      return `${formatPlayer(playerId, playersById)} marched ${fromLabel} -> ${toLabel}`;
    }
    case "action.basic.capitalReinforce": {
      return `${formatPlayer(playerId, playersById)} reinforced capital`;
    }
    case "action.done": {
      return `${formatPlayer(playerId, playersById)} done`;
    }
    case "combat.start": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const hexLabel = formatHexKey(hexKey, hexLabels);
      const attackers = readRecord(payload.attackers);
      const defenders = readRecord(payload.defenders);
      return `Combat starts at ${hexLabel}: ${formatCombatSide(
        attackers,
        playersById
      )} vs ${formatCombatSide(defenders, playersById)}`;
    }
    case "combat.round": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const round = readNumber(payload.round);
      const roundLabel = round !== null ? `Round ${round}` : "Combat round";
      const hexLabel = formatHexKey(hexKey, hexLabels);
      return `${roundLabel} at ${hexLabel}`;
    }
    case "combat.end": {
      const hexKey = readString(payload.hexKey) ?? "unknown";
      const winnerId = readString(payload.winnerPlayerId);
      const reason = readString(payload.reason);
      const winnerLabel = winnerId ? formatPlayer(winnerId, playersById) : "No winner";
      const hexLabel = formatHexKey(hexKey, hexLabels);
      return `Combat ends at ${hexLabel}: ${winnerLabel}${reason ? ` (${reason})` : ""}`;
    }
    case "market.reveal": {
      const row = readArray(payload.row);
      if (!row) {
        return "Market revealed new row";
      }
      const cards = row
        .map((entry) => {
          const record = readRecord(entry);
          const cardId = readString(record?.cardId);
          if (!cardId) {
            return null;
          }
          const age = readString(record?.age);
          return age ? `${cardId} (${age})` : cardId;
        })
        .filter((value): value is string => Boolean(value));
      if (cards.length === 0) {
        return "Market revealed new row";
      }
      return `Market revealed: ${cards.join(", ")}`;
    }
    case "market.buy": {
      const cardId = readString(payload.cardId) ?? "unknown";
      const amount = readNumber(payload.amount);
      const rollOff = readArray(payload.rollOff);
      const priceLabel = amount !== null ? ` for ${amount}g` : "";
      const rollOffLabel = rollOff && rollOff.length > 0 ? " (roll-off)" : "";
      return `${formatPlayer(playerId, playersById)} bought ${cardId}${priceLabel}${rollOffLabel}`;
    }
    case "market.pass": {
      const cardId = readString(payload.cardId) ?? "unknown";
      const passPot = readNumber(payload.passPot);
      const potLabel = passPot && passPot > 0 ? ` and won ${passPot}g` : "";
      return `${formatPlayer(playerId, playersById)} took ${cardId} on pass${potLabel}`;
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
    summaryParts.push(`hex=${formatHexKey(hexKey, hexLabels)}`);
  }
  if (edgeKey) {
    summaryParts.push(`edge=${formatEdgeKey(edgeKey, hexLabels)}`);
  }
  if (cardId) {
    summaryParts.push(`card=${cardId}`);
  }

  if (summaryParts.length > 0) {
    return `${event.type} (${summaryParts.join(", ")})`;
  }

  return event.type;
};
