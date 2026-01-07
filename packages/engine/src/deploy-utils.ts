import type { GameState, HexKey, PlayerID } from "./types";
import { getCenterHexKey, isOccupiedByPlayer, wouldExceedTwoPlayers } from "./board";
import { hasAerialWings } from "./faction-passives";

const getCapitalHexKey = (state: GameState, playerId: PlayerID): HexKey | null => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return null;
  }
  if (!state.board.hexes[player.capitalHex]) {
    return null;
  }
  return player.capitalHex;
};

const getAerialCenterHexKey = (state: GameState, playerId: PlayerID): HexKey | null => {
  if (!hasAerialWings(state, playerId)) {
    return null;
  }
  const centerHexKey = getCenterHexKey(state.board);
  if (!centerHexKey) {
    return null;
  }
  const centerHex = state.board.hexes[centerHexKey];
  if (!centerHex) {
    return null;
  }
  if (!isOccupiedByPlayer(centerHex, playerId)) {
    return null;
  }
  return centerHexKey;
};

const isDeployable = (state: GameState, playerId: PlayerID, hexKey: HexKey): boolean => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  return !wouldExceedTwoPlayers(hex, playerId);
};

export const resolveCapitalDeployHex = (
  state: GameState,
  playerId: PlayerID,
  preferredHex?: HexKey | null
): HexKey | null => {
  const capitalHexKey = getCapitalHexKey(state, playerId);
  const centerHexKey = getAerialCenterHexKey(state, playerId);
  const candidates: HexKey[] = [];

  if (capitalHexKey) {
    candidates.push(capitalHexKey);
  }
  if (centerHexKey && centerHexKey !== capitalHexKey) {
    candidates.push(centerHexKey);
  }

  if (preferredHex) {
    if (!candidates.includes(preferredHex)) {
      return null;
    }
    return isDeployable(state, playerId, preferredHex) ? preferredHex : null;
  }

  for (const hexKey of candidates) {
    if (isDeployable(state, playerId, hexKey)) {
      return hexKey;
    }
  }

  return null;
};
