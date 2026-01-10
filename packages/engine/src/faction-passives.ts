import type { GameState, Modifier, PlayerID } from "./types";
import { isOccupiedByPlayer } from "./board";
import { hasPlayerMovedThisRound } from "./player-flags";

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

const createProspectDeepTunnelsModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("prospect", playerId, "deep_tunnels"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMoveRequiresBridge: ({ modifier, playerId: movingPlayerId, from, to, path, state }, current) => {
      if (!current) {
        return current;
      }
      if (path.length !== 2) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
        return current;
      }
      const fromHex = state.board.hexes[from];
      const toHex = state.board.hexes[to];
      if (!fromHex || !toHex) {
        return current;
      }
      if (fromHex.tile !== "mine" || toHex.tile !== "mine") {
        return current;
      }
      if (!isOccupiedByPlayer(fromHex, movingPlayerId)) {
        return current;
      }
      if (!isOccupiedByPlayer(toHex, movingPlayerId)) {
        return current;
      }
      return false;
    },
    getMoveAdjacency: ({ modifier, playerId: movingPlayerId, from, to, state }, current) => {
      if (current) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
        return current;
      }
      const fromHex = state.board.hexes[from];
      const toHex = state.board.hexes[to];
      if (!fromHex || !toHex) {
        return current;
      }
      if (fromHex.tile !== "mine" || toHex.tile !== "mine") {
        return current;
      }
      if (!isOccupiedByPlayer(fromHex, movingPlayerId)) {
        return current;
      }
      if (!isOccupiedByPlayer(toHex, movingPlayerId)) {
        return current;
      }
      return true;
    }
  }
});

const createAerialTailwindModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("aerial", playerId, "tailwind"),
  source: { type: "faction", sourceId: "aerial" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMoveMaxDistance: ({ modifier, playerId: movingPlayerId, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      if (hasPlayerMovedThisRound(state, movingPlayerId)) {
        return current;
      }
      return current + 1;
    }
  }
});

const createAerialWingsModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("aerial", playerId, "wings"),
  source: { type: "faction", sourceId: "aerial" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" }
});

const createCipherExpandedChoiceModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("cipher", playerId, "expanded_choice"),
  source: { type: "faction", sourceId: "cipher" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getCardChoiceCount: ({ modifier, playerId: choosingPlayerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== choosingPlayerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      return current + 1;
    }
  }
});

const createCipherQuietStudyModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("cipher", playerId, "quiet_study"),
  source: { type: "faction", sourceId: "cipher" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" }
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

const createVeilContractsModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("veil", playerId, "contracts"),
  source: { type: "faction", sourceId: "veil" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getChampionKillBonusGold: ({ modifier, killerPlayerId, killedChampions }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      return current + killedChampions.length * 2;
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

const createGatewrightCapitalVpBonusModifier = (playerId: PlayerID): Modifier => ({
  id: buildModifierId("gatewright", playerId, "capital_vp_bonus"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getControlValue: ({ modifier, playerId: occupantId, hexKey, tile, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== occupantId) {
        return current;
      }
      if (tile !== "capital") {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || !hex.ownerPlayerId || hex.ownerPlayerId === occupantId) {
        return current;
      }
      return Math.max(current, 2);
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
      return [createVeilCleanExitModifier(playerId), createVeilContractsModifier(playerId)];
    case "prospect":
      return [
        createProspectOreCutModifier(playerId),
        createProspectMineMilitiaModifier(playerId),
        createProspectDeepTunnelsModifier(playerId)
      ];
    case "aerial":
      return [createAerialTailwindModifier(playerId), createAerialWingsModifier(playerId)];
    case "cipher":
      return [
        createCipherExpandedChoiceModifier(playerId),
        createCipherQuietStudyModifier(playerId)
      ];
    case "gatewright":
      return [
        createGatewrightCapitalAssaultModifier(playerId),
        createGatewrightCapitalVpBonusModifier(playerId),
        createGatewrightExtortionistsModifier(playerId)
      ];
    default:
      return [];
  }
};

export const hasAerialWings = (state: GameState, playerId: PlayerID): boolean => {
  const targetId = buildModifierId("aerial", playerId, "wings");
  return state.modifiers.some((modifier) => modifier.id === targetId);
};

export const hasCipherQuietStudy = (state: GameState, playerId: PlayerID): boolean => {
  const targetId = buildModifierId("cipher", playerId, "quiet_study");
  return state.modifiers.some((modifier) => modifier.id === targetId);
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
