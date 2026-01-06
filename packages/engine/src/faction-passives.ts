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

const createBastionHomeGuardModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("bastion", playerId, "home_guard"),
  source: { type: "faction", sourceId: "bastion" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getDeployForcesCount: ({ modifier, playerId: deployerId, hexKey, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== deployerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      const player = state.players.find((entry) => entry.id === deployerId);
      if (!player?.capitalHex || player.capitalHex !== hexKey) {
        return current;
      }
      return current + 1;
    }
  }
});

const createProspectOreCutModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("prospect", playerId, "ore_cut"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMineGoldValue: ({ modifier, playerId: collectingPlayerId, mineValue }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== collectingPlayerId) {
        return current;
      }
      return current + 1;
    }
  }
});

const createProspectMineMilitiaModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("prospect", playerId, "mine_militia"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, defenderPlayerId, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (defenderPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "mine") {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});

const createVeilCleanExitModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("veil", playerId, "clean_exit"),
  source: { type: "faction", sourceId: "veil" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    afterBattle: ({ state, modifier, attackers, defenders }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId) {
        return state;
      }

      const unitIds = new Set<string>([...attackers, ...defenders]);
      if (unitIds.size === 0) {
        return state;
      }

      let updatedUnits: typeof state.board.units | null = null;
      for (const unitId of unitIds) {
        const unit = state.board.units[unitId];
        if (!unit || unit.kind !== "champion") {
          continue;
        }
        if (unit.ownerPlayerId !== ownerId) {
          continue;
        }
        const nextHp = Math.min(unit.maxHp, unit.hp + 1);
        if (nextHp === unit.hp) {
          continue;
        }
        if (!updatedUnits) {
          updatedUnits = { ...state.board.units };
        }
        updatedUnits[unitId] = {
          ...unit,
          hp: nextHp
        };
      }

      if (!updatedUnits) {
        return state;
      }

      return {
        ...state,
        board: {
          ...state.board,
          units: updatedUnits
        }
      };
    }
  }
});

const createGatewrightCapitalAssaultModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("gatewright", playerId, "capital_assault"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "capital") {
        return current;
      }
      if (!hex.ownerPlayerId || hex.ownerPlayerId === unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});

const createGatewrightExtortionistsModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("gatewright", playerId, "extortionists"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    afterBattle: ({ state, modifier, winnerPlayerId, attackerPlayerId, defenderPlayerId }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId || winnerPlayerId !== ownerId) {
        return state;
      }

      const loserId = winnerPlayerId === attackerPlayerId ? defenderPlayerId : attackerPlayerId;
      const loser = state.players.find((player) => player.id === loserId);
      if (!loser) {
        return state;
      }

      const steal = Math.min(2, loser.resources.gold);
      if (steal <= 0) {
        return state;
      }

      const nextPlayers = state.players.map((player) => {
        if (player.id === loserId) {
          return {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold - steal
            }
          };
        }
        if (player.id === ownerId) {
          return {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold + steal
            }
          };
        }
        return player;
      });

      return {
        ...state,
        players: nextPlayers
      };
    }
  }
});

export const createFactionModifiers = (factionId: string, playerId: PlayerID): Modifier[] => {
  switch (factionId) {
    case "bastion":
      return [
        createBastionShieldWallModifier(playerId),
        createBastionHomeGuardModifier(playerId)
      ];
    case "veil":
      return [createVeilCleanExitModifier(playerId)];
    case "prospect":
      return [createProspectOreCutModifier(playerId), createProspectMineMilitiaModifier(playerId)];
    case "gatewright":
      return [
        createGatewrightCapitalAssaultModifier(playerId),
        createGatewrightExtortionistsModifier(playerId)
      ];
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
