import { randInt, shuffle } from "@bridgefront/shared";

import { CARD_DEFS } from "./content/cards";
import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, PlayerID } from "./types";
import {
  addCardToHandWithOverflow,
  createCardInstance
} from "./cards";
import {
  applyChampionDeployment,
  dealChampionDamage,
  healChampion,
  removeChampionModifiers
} from "./champions";
import {
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
import {
  getChampionTarget,
  getHexTarget
} from "./card-effects-targeting";
import {
  getChoiceTarget,
  type TargetRecord
} from "./card-effects-targets";
import { resolveCapitalDeployHex } from "./deploy-utils";
import { getDeployForcesCount } from "./modifiers";
import { getCardScalingCounter, incrementCardScalingCounter } from "./player-flags";
import {
  addChampionToHex,
  addForcesToHex,
  countPlayerChampions,
  moveUnitToHex
} from "./units";

export const removeForcesFromHex = (
  state: GameState,
  playerId: PlayerID,
  hexKey: string,
  unitIds: string[],
  count: number
): GameState => {
  if (!Number.isFinite(count) || count <= 0) {
    return state;
  }
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }
  const occupants = hex.occupants[playerId] ?? [];
  if (occupants.length === 0) {
    return state;
  }

  const occupantSet = new Set(occupants);
  const eligible = unitIds.filter((unitId) => {
    if (!occupantSet.has(unitId)) {
      return false;
    }
    const unit = state.board.units[unitId];
    return unit?.kind === "force" && unit.ownerPlayerId === playerId;
  });
  if (eligible.length === 0) {
    return state;
  }

  const removeCount = Math.min(Math.floor(count), eligible.length);
  const removeIds = new Set(eligible.slice(0, removeCount));
  const nextUnits = { ...state.board.units };
  for (const unitId of removeIds) {
    delete nextUnits[unitId];
  }
  const nextOccupants = occupants.filter((unitId) => !removeIds.has(unitId));

  return {
    ...state,
    board: {
      ...state.board,
      units: nextUnits,
      hexes: {
        ...state.board.hexes,
        [hexKey]: {
          ...hex,
          occupants: {
            ...hex.occupants,
            [playerId]: nextOccupants
          }
        }
      }
    }
  };
};

const removeChampionFromBoard = (state: GameState, unitId: string): GameState => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }

  const hex = state.board.hexes[unit.hex];
  const nextUnits = { ...state.board.units };
  delete nextUnits[unitId];

  let nextState: GameState = {
    ...state,
    board: {
      ...state.board,
      units: nextUnits
    }
  };

  if (hex) {
    const occupants = (hex.occupants[unit.ownerPlayerId] ?? []).filter(
      (entry) => entry !== unitId
    );
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        hexes: {
          ...nextState.board.hexes,
          [unit.hex]: {
            ...hex,
            occupants: {
              ...hex.occupants,
              [unit.ownerPlayerId]: occupants
            }
          }
        }
      }
    };
  }

  nextState = removeChampionModifiers(nextState, [unitId]);
  const nextModifiers = nextState.modifiers.filter(
    (modifier) => modifier.attachedUnitId !== unitId
  );
  return nextModifiers.length === nextState.modifiers.length
    ? nextState
    : { ...nextState, modifiers: nextModifiers };
};

export const resolveChampionCardPlay = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  targets: CardPlayTargets | null
): GameState | null => {
  if (card.type !== "Champion" || !card.champion) {
    return null;
  }
  const target = getHexTarget(
    state,
    playerId,
    card.targetSpec as TargetRecord,
    targets ?? null
  );
  if (!target) {
    return state;
  }
  const deployed = addChampionToHex(state.board, playerId, target.hexKey, {
    cardDefId: card.id,
    hp: card.champion.hp,
    attackDice: card.champion.attackDice,
    hitFaces: card.champion.hitFaces,
    bounty: card.champion.bounty
  });
  let nextState: GameState = {
    ...state,
    board: deployed.board
  };
  nextState = applyChampionDeployment(nextState, deployed.unitId, card.id, playerId);
  return nextState;
};

export const resolveUnitEffect = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  effect: TargetRecord,
  targets: CardPlayTargets | null
): GameState | null => {
  let nextState = state;

  switch (effect.kind) {
    case "recruit": {
      const choice = getChoiceTarget(targets ?? null);
      if (!choice) {
        return nextState;
      }
      const options = Array.isArray(card.targetSpec.options)
        ? (card.targetSpec.options as TargetRecord[])
        : [];
      const capitalCountRaw =
        typeof effect.capitalCount === "number" ? effect.capitalCount : 2;
      const occupiedCountRaw =
        typeof effect.occupiedCount === "number" ? effect.occupiedCount : 1;
      const capitalCount = Math.max(0, Math.floor(capitalCountRaw));
      const occupiedCount = Math.max(0, Math.floor(occupiedCountRaw));
      const scaleKey = typeof effect.scaleKey === "string" ? effect.scaleKey : null;
      const scaleMaxRaw = typeof effect.scaleMax === "number" ? effect.scaleMax : NaN;
      const scaleMax = Number.isFinite(scaleMaxRaw)
        ? Math.max(0, Math.floor(scaleMaxRaw))
        : null;
      const scaleOnPlay = effect.scaleOnPlay === true;
      if (choice.kind === "capital") {
        if (!options.some((option) => option.kind === "capital")) {
          return nextState;
        }
        const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
        if (!deployHex) {
          return nextState;
        }
        const baseCount = capitalCount;
        let scaledBase = baseCount;
        let maxCounter: number | null = null;
        if (scaleKey) {
          const counter = getCardScalingCounter(nextState, playerId, scaleKey);
          scaledBase = baseCount + counter;
          if (scaleMax !== null) {
            scaledBase = Math.min(scaleMax, scaledBase);
            maxCounter = Math.max(0, scaleMax - baseCount);
          }
        }
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: deployHex, baseCount: scaledBase },
          scaledBase
        );
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, deployHex, count)
        };
        if (scaleKey && scaleOnPlay) {
          nextState = incrementCardScalingCounter(
            nextState,
            playerId,
            scaleKey,
            1,
            maxCounter ?? undefined
          );
        }
        return nextState;
      }
      if (choice.kind === "occupiedHex") {
        const hex = nextState.board.hexes[choice.hexKey];
        if (!hex) {
          return nextState;
        }
        if (!isOccupiedByPlayer(hex, playerId)) {
          return nextState;
        }
        const tileAllowed = options.some((option) => {
          if (option.kind !== "occupiedHex") {
            return false;
          }
          const tile = typeof option.tile === "string" ? option.tile : null;
          return !tile || tile === hex.tile;
        });
        if (!tileAllowed) {
          return nextState;
        }
        if (wouldExceedTwoPlayers(hex, playerId)) {
          return nextState;
        }
        const baseCount = occupiedCount;
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: choice.hexKey, baseCount },
          baseCount
        );
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, choice.hexKey, count)
        };
      }
      return nextState;
    }
    case "recruitByHandSize": {
      const choice = getChoiceTarget(targets ?? null);
      if (!choice || choice.kind !== "capital") {
        return nextState;
      }
      const options = Array.isArray(card.targetSpec.options)
        ? (card.targetSpec.options as TargetRecord[])
        : [];
      if (!options.some((option) => option.kind === "capital")) {
        return nextState;
      }
      const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
      if (!deployHex) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      const baseCount = Math.max(0, Math.floor(player.deck.hand.length));
      const count = getDeployForcesCount(
        nextState,
        { playerId, hexKey: deployHex, baseCount },
        baseCount
      );
      if (count <= 0) {
        return nextState;
      }
      nextState = {
        ...nextState,
        board: addForcesToHex(nextState.board, playerId, deployHex, count)
      };
      return nextState;
    }
    case "deployForces": {
      let targetHexKey: string | null = null;
      if (card.targetSpec.kind === "champion") {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          return nextState;
        }
        targetHexKey = target.unit.hex;
      } else {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          return nextState;
        }
        targetHexKey = target.hexKey;
      }
      if (!targetHexKey) {
        return nextState;
      }
      const targetHex = nextState.board.hexes[targetHexKey];
      if (!targetHex) {
        return nextState;
      }
      if (wouldExceedTwoPlayers(targetHex, playerId)) {
        return nextState;
      }
      const baseCount = typeof effect.count === "number" ? effect.count : 0;
      if (baseCount <= 0) {
        return nextState;
      }
      const count = getDeployForcesCount(
        nextState,
        { playerId, hexKey: targetHexKey, baseCount },
        baseCount
      );
      if (count <= 0) {
        return nextState;
      }
      nextState = {
        ...nextState,
        board: addForcesToHex(nextState.board, playerId, targetHexKey, count)
      };
      return nextState;
    }
    case "deployRandomChampion": {
      const manaCostRaw = typeof effect.manaCost === "number" ? effect.manaCost : 2;
      const manaCost = Math.max(0, Math.floor(manaCostRaw));
      if (countPlayerChampions(nextState.board, playerId) >= nextState.config.CHAMPION_LIMIT) {
        return nextState;
      }
      const candidates = CARD_DEFS.filter(
        (entry) => entry.type === "Champion" && entry.champion && entry.cost.mana === manaCost
      );
      if (candidates.length === 0) {
        return nextState;
      }
      const deployHex = resolveCapitalDeployHex(nextState, playerId, null);
      if (!deployHex) {
        return nextState;
      }
      const pick = randInt(nextState.rngState, 0, candidates.length - 1);
      nextState = { ...nextState, rngState: pick.next };
      const chosen = candidates[pick.value];
      if (!chosen?.champion) {
        return nextState;
      }
      const deployed = addChampionToHex(nextState.board, playerId, deployHex, {
        cardDefId: chosen.id,
        hp: chosen.champion.hp,
        attackDice: chosen.champion.attackDice,
        hitFaces: chosen.champion.hitFaces,
        bounty: chosen.champion.bounty
      });
      nextState = { ...nextState, board: deployed.board };
      nextState = applyChampionDeployment(nextState, deployed.unitId, chosen.id, playerId);
      return nextState;
    }
    case "deployForcesIfEnemyInCapital": {
      const baseCount = typeof effect.count === "number" ? effect.count : 3;
      if (baseCount <= 0) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player?.capitalHex) {
        return nextState;
      }
      const capitalHex = nextState.board.hexes[player.capitalHex];
      if (!capitalHex) {
        return nextState;
      }
      const hasEnemy = Object.entries(capitalHex.occupants).some(
        ([occupantId, units]) => occupantId !== playerId && units.length > 0
      );
      if (!hasEnemy) {
        return nextState;
      }
      const deployHex = resolveCapitalDeployHex(nextState, playerId, player.capitalHex);
      if (!deployHex) {
        return nextState;
      }
      const count = getDeployForcesCount(
        nextState,
        { playerId, hexKey: deployHex, baseCount },
        baseCount
      );
      if (count <= 0) {
        return nextState;
      }
      nextState = {
        ...nextState,
        board: addForcesToHex(nextState.board, playerId, deployHex, count)
      };
      return nextState;
    }
    case "lastStand": {
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player?.capitalHex) {
        return nextState;
      }
      if (!nextState.board.hexes[player.capitalHex]) {
        return nextState;
      }
      const lossValue =
        typeof effect.forceLoss === "number"
          ? effect.forceLoss
          : typeof effect.loss === "number"
            ? effect.loss
            : 3;
      const loss = Math.max(0, Math.floor(lossValue));
      if (loss <= 0) {
        return nextState;
      }
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${player.capitalHex}.last_stand`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedHex: player.capitalHex,
            duration: { type: "endOfRound" },
            hooks: {
              onMove: ({
                state,
                modifier,
                playerId: movingPlayerId,
                to,
                movingUnitIds
              }) => {
                if (!modifier.attachedHex || to !== modifier.attachedHex) {
                  return state;
                }
                if (modifier.ownerPlayerId && modifier.ownerPlayerId === movingPlayerId) {
                  return state;
                }
                const forces = movingUnitIds.filter(
                  (unitId) => state.board.units[unitId]?.kind === "force"
                );
                let nextState = state;
                if (forces.length > 0) {
                  const shuffled = shuffle(state.rngState, forces);
                  nextState = { ...state, rngState: shuffled.next };
                  nextState = removeForcesFromHex(
                    nextState,
                    movingPlayerId,
                    to,
                    shuffled.value,
                    loss
                  );
                }
                const nextModifiers = nextState.modifiers.filter(
                  (entry) => entry.id !== modifier.id
                );
                return nextModifiers.length === nextState.modifiers.length
                  ? nextState
                  : { ...nextState, modifiers: nextModifiers };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "deployForcesOnMines": {
      const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
      if (count <= 0) {
        return nextState;
      }
      for (const hex of Object.values(nextState.board.hexes)) {
        if (hex.tile !== "mine") {
          continue;
        }
        if (!isOccupiedByPlayer(hex, playerId)) {
          continue;
        }
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, hex.key, count)
        };
      }
      return nextState;
    }
    case "evacuateChampion": {
      const target = getChampionTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null,
        card
      );
      if (!target) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player?.capitalHex) {
        return nextState;
      }
      const capitalHex = nextState.board.hexes[player.capitalHex];
      if (!capitalHex) {
        return nextState;
      }
      if (wouldExceedTwoPlayers(capitalHex, playerId)) {
        return nextState;
      }
      nextState = {
        ...nextState,
        board: moveUnitToHex(nextState.board, target.unitId, player.capitalHex)
      };
      return nextState;
    }
    case "recallChampion": {
      const target = getChampionTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null,
        card
      );
      if (!target) {
        return nextState;
      }
      const cardDefId = target.unit.cardDefId;
      nextState = removeChampionFromBoard(nextState, target.unitId);
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      let recalledInstanceId: string | null = null;
      for (const instanceId of player.burned) {
        const defId = nextState.cardsByInstanceId[instanceId]?.defId;
        if (defId === cardDefId) {
          recalledInstanceId = instanceId;
          break;
        }
      }
      if (recalledInstanceId) {
        nextState = {
          ...nextState,
          players: nextState.players.map((entry) =>
            entry.id === playerId
              ? {
                  ...entry,
                  burned: entry.burned.filter((id) => id !== recalledInstanceId)
                }
              : entry
          )
        };
      } else {
        const created = createCardInstance(nextState, cardDefId);
        nextState = created.state;
        recalledInstanceId = created.instanceId;
      }
      if (recalledInstanceId) {
        nextState = addCardToHandWithOverflow(nextState, playerId, recalledInstanceId);
      }
      return nextState;
    }
    case "increaseMineValue": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const current = target.hex.mineValue;
      if (typeof current !== "number") {
        return nextState;
      }
      const amount = typeof effect.amount === "number" ? effect.amount : NaN;
      if (!Number.isFinite(amount) || amount <= 0) {
        return nextState;
      }
      const maxValue =
        typeof effect.maxValue === "number" ? effect.maxValue : Number.POSITIVE_INFINITY;
      const nextValue = Math.min(current + amount, maxValue);
      if (nextValue === current) {
        return nextState;
      }
      nextState = {
        ...nextState,
        board: {
          ...nextState.board,
          hexes: {
            ...nextState.board.hexes,
            [target.hexKey]: {
              ...target.hex,
              mineValue: nextValue
            }
          }
        }
      };
      return nextState;
    }
    case "healChampion": {
      const target = getChampionTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null,
        card
      );
      if (!target) {
        return nextState;
      }
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      nextState = healChampion(nextState, target.unitId, amount);
      return nextState;
    }
    case "healChampions": {
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      if (amount <= 0) {
        return nextState;
      }
      const unitIds = Object.keys(nextState.board.units);
      for (const unitId of unitIds) {
        const unit = nextState.board.units[unitId];
        if (!unit || unit.kind !== "champion") {
          continue;
        }
        if (unit.ownerPlayerId !== playerId) {
          continue;
        }
        nextState = healChampion(nextState, unitId, amount);
      }
      return nextState;
    }
    case "cataclysmCore": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const damageValue = typeof effect.damage === "number" ? effect.damage : 3;
      const damage = Math.max(0, Math.floor(damageValue));
      const targetHexKey = target.hexKey;
      const hex = nextState.board.hexes[targetHexKey];
      if (!hex) {
        return nextState;
      }
      for (const [occupantId, unitIds] of Object.entries(hex.occupants)) {
        if (unitIds.length === 0) {
          continue;
        }
        const forceIds = unitIds.filter(
          (unitId) => nextState.board.units[unitId]?.kind === "force"
        );
        if (forceIds.length === 0) {
          continue;
        }
        nextState = removeForcesFromHex(
          nextState,
          occupantId,
          targetHexKey,
          forceIds,
          forceIds.length
        );
      }
      if (damage <= 0) {
        return nextState;
      }
      const updatedHex = nextState.board.hexes[targetHexKey];
      if (!updatedHex) {
        return nextState;
      }
      const championIds = Object.values(updatedHex.occupants)
        .flat()
        .filter((unitId) => nextState.board.units[unitId]?.kind === "champion");
      for (const unitId of championIds) {
        nextState = dealChampionDamage(nextState, playerId, unitId, damage);
      }
      return nextState;
    }
    case "dealChampionDamage": {
      const target = getChampionTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null,
        card
      );
      if (!target) {
        return nextState;
      }
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      nextState = dealChampionDamage(nextState, playerId, target.unitId, amount);
      return nextState;
    }
    case "patchUp": {
      const target = getChampionTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null,
        card
      );
      if (!target) {
        return nextState;
      }
      const baseHeal = typeof effect.baseHeal === "number" ? effect.baseHeal : 0;
      const capitalBonus = typeof effect.capitalBonus === "number" ? effect.capitalBonus : 0;
      let amount = baseHeal;
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (player?.capitalHex && target.unit.hex === player.capitalHex) {
        amount += capitalBonus;
      }
      nextState = healChampion(nextState, target.unitId, amount);
      return nextState;
    }
    default:
      return null;
  }
};
