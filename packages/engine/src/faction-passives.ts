import type { GameState, Modifier, PlayerID } from "./types";

const buildModifierId = (factionId: string, playerId: PlayerID, key: string) =>
  `faction.${factionId}.${playerId}.${key}`;

const createBastionShieldWallModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("bastion", playerId, "shield_wall"),
  source: { type: "faction", sourceId: "bastion" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, defenderPlayerId, round }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (defenderPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (round !== 1) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});

export const createFactionModifiers = (factionId: string, playerId: PlayerID): Modifier[] => {
  switch (factionId) {
    case "bastion":
      return [createBastionShieldWallModifier(playerId)];
    default:
      return [];
  }
};

export const addFactionModifiers = (
  state: GameState,
  playerId: PlayerID,
  factionId: string
): GameState => {
  const modifiers = createFactionModifiers(factionId, playerId);
  if (modifiers.length === 0) {
    return state;
  }
  const existing = new Set(state.modifiers.map((modifier) => modifier.id));
  const nextModifiers = [...state.modifiers];
  for (const modifier of modifiers) {
    if (!existing.has(modifier.id)) {
      nextModifiers.push(modifier);
    }
  }
  if (nextModifiers.length === state.modifiers.length) {
    return state;
  }
  return { ...state, modifiers: nextModifiers };
};
