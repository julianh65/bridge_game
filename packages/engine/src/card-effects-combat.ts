import {
  neighborHexKeys,
  randInt
} from "@bridgefront/shared";

import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, Modifier, PlayerID } from "./types";
import {
  countPlayersOnHex,
  isOccupiedByPlayer
} from "./board";
import {
  getChampionTarget,
  getHexTarget,
  hasFriendlyForceWithinRange
} from "./card-effects-targeting";
import { type TargetRecord } from "./card-effects-targets";
import { dealChampionDamage } from "./champions";
import { removeModifierById } from "./card-effects-modifiers";
import { moveUnits } from "./card-effects-movement";
import { removeForcesFromHex } from "./card-effects-units";

export const resolveCombatEffect = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  effect: TargetRecord,
  targets: CardPlayTargets | null
): GameState | null => {
  let nextState = state;

  switch (effect.kind) {
    case "encirclement": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const minAdjacent =
        typeof effect.minAdjacent === "number" ? Math.max(0, Math.floor(effect.minAdjacent)) : 3;
      const maxForces =
        typeof effect.maxForces === "number" ? Math.max(0, Math.floor(effect.maxForces)) : 6;
      if (maxForces <= 0) {
        return nextState;
      }
      const neighbors = neighborHexKeys(target.hexKey).filter(
        (hexKey) => Boolean(nextState.board.hexes[hexKey])
      );
      const adjacentCount = neighbors.reduce((count, hexKey) => {
        const hex = nextState.board.hexes[hexKey];
        if (!hex) {
          return count;
        }
        return isOccupiedByPlayer(hex, playerId) ? count + 1 : count;
      }, 0);
      if (adjacentCount < minAdjacent) {
        return nextState;
      }
      const hex = nextState.board.hexes[target.hexKey];
      if (!hex) {
        return nextState;
      }
      const enemyEntry = Object.entries(hex.occupants).find(
        ([occupantId, units]) => occupantId !== playerId && units.length > 0
      );
      if (!enemyEntry) {
        return nextState;
      }
      const [enemyId, unitIds] = enemyEntry;
      const enemyForces = unitIds.filter(
        (unitId) => nextState.board.units[unitId]?.kind === "force"
      );
      const removeCount = Math.min(maxForces, enemyForces.length);
      if (removeCount > 0) {
        nextState = removeForcesFromHex(nextState, enemyId, target.hexKey, unitIds, removeCount);
      }

      const championDamage =
        typeof effect.championDamage === "number"
          ? Math.max(0, Math.floor(effect.championDamage))
          : 0;
      if (championDamage > 0) {
        const updatedHex = nextState.board.hexes[target.hexKey];
        if (!updatedHex) {
          return nextState;
        }
        const championIds = Object.values(updatedHex.occupants).flat().filter((unitId) => {
          return nextState.board.units[unitId]?.kind === "champion";
        });
        for (const unitId of championIds) {
          nextState = dealChampionDamage(nextState, playerId, unitId, championDamage);
        }
      }
      return nextState;
    }
    case "attrition": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const forceLoss =
        typeof effect.forceLoss === "number" ? Math.max(0, Math.floor(effect.forceLoss)) : 3;
      const championDamage =
        typeof effect.championDamage === "number"
          ? Math.max(0, Math.floor(effect.championDamage))
          : 1;
      const hex = nextState.board.hexes[target.hexKey];
      if (!hex) {
        return nextState;
      }
      const enemyEntry = Object.entries(hex.occupants).find(
        ([occupantId, units]) => occupantId !== playerId && units.length > 0
      );
      if (enemyEntry && forceLoss > 0) {
        const [enemyId, unitIds] = enemyEntry;
        const enemyForces = unitIds.filter(
          (unitId) => nextState.board.units[unitId]?.kind === "force"
        );
        if (enemyForces.length > 0) {
          const removeCount = Math.min(forceLoss, enemyForces.length);
          nextState = removeForcesFromHex(
            nextState,
            enemyId,
            target.hexKey,
            unitIds,
            removeCount
          );
        }
      }

      if (championDamage > 0) {
        const updatedHex = nextState.board.hexes[target.hexKey];
        if (!updatedHex) {
          return nextState;
        }
        const championIds = Object.values(updatedHex.occupants).flat().filter((unitId) => {
          return nextState.board.units[unitId]?.kind === "champion";
        });
        for (const unitId of championIds) {
          nextState = dealChampionDamage(nextState, playerId, unitId, championDamage);
        }
      }
      return nextState;
    }
    case "mortarShot": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const maxDistance =
        typeof effect.maxDistance === "number" ? effect.maxDistance : 2;
      if (!hasFriendlyForceWithinRange(nextState, playerId, target.hexKey, maxDistance)) {
        return nextState;
      }

      const neighbors = neighborHexKeys(target.hexKey).filter(
        (hexKey) => Boolean(nextState.board.hexes[hexKey])
      );
      const roll = randInt(nextState.rngState, 0, 99);
      nextState = { ...nextState, rngState: roll.next };

      let strikeHexKey = target.hexKey;
      if (neighbors.length > 0 && roll.value >= 50) {
        const pick = randInt(nextState.rngState, 0, neighbors.length - 1);
        nextState = { ...nextState, rngState: pick.next };
        strikeHexKey = neighbors[pick.value] ?? neighbors[0];
      }

      const forceLoss = typeof effect.forceLoss === "number" ? effect.forceLoss : 4;
      let remainingLoss = Math.max(0, Math.floor(forceLoss));
      for (const player of nextState.players) {
        if (remainingLoss <= 0) {
          break;
        }
        const hex = nextState.board.hexes[strikeHexKey];
        if (!hex) {
          break;
        }
        const occupants = hex.occupants[player.id] ?? [];
        const available = occupants.filter(
          (unitId) => nextState.board.units[unitId]?.kind === "force"
        ).length;
        if (available <= 0) {
          continue;
        }
        const removeCount = Math.min(remainingLoss, available);
        nextState = removeForcesFromHex(
          nextState,
          player.id,
          strikeHexKey,
          occupants,
          removeCount
        );
        remainingLoss -= removeCount;
      }

      const damage = typeof effect.damage === "number" ? effect.damage : 2;
      if (damage > 0) {
        for (const unit of Object.values(nextState.board.units)) {
          if (unit.kind !== "champion") {
            continue;
          }
          if (unit.hex !== strikeHexKey) {
            continue;
          }
          nextState = dealChampionDamage(nextState, playerId, unit.id, damage);
        }
      }
      return nextState;
    }
    case "holdTheLine": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedHex: target.hexKey,
            duration: { type: "endOfRound" },
            hooks: {
              getForceHitFaces: ({ modifier, unit, defenderPlayerId }, current) => {
                if (unit.kind !== "force") {
                  return current;
                }
                if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
                  return current;
                }
                if (defenderPlayerId !== unit.ownerPlayerId) {
                  return current;
                }
                return Math.max(current, 3);
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "markForCoin": {
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
      const bounty = typeof effect.bounty === "number" ? Math.max(0, effect.bounty) : 0;
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedUnitId: target.unitId,
            duration: { type: "endOfRound" },
            data: {
              markedUnitId: target.unitId,
              bonusGold: bounty
            }
          }
        ]
      };
      return nextState;
    }
    case "ward": {
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
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedUnitId: target.unitId,
            duration: { type: "endOfRound" },
            data: {
              targeting: {
                blockEnemyCards: true,
                scope: "attachedUnit"
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "immunityField": {
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            duration: { type: "endOfRound" },
            data: {
              targeting: {
                blockEnemySpells: true,
                scope: "ownerChampions"
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "goldPlatedArmor": {
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
      const costPerDamage =
        typeof effect.costPerDamage === "number" ? effect.costPerDamage : 2;
      if (!Number.isFinite(costPerDamage) || costPerDamage <= 0) {
        return nextState;
      }
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.gold_armor`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedUnitId: target.unitId,
            duration: { type: "endOfRound" },
            data: {
              goldArmor: {
                costPerDamage
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "battleCry": {
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.battle_cry`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({
                state,
                modifier,
                hexKey,
                round,
                attackerPlayerId,
                defenderPlayerId
              }) => {
                if (round !== 1) {
                  return state;
                }
                const ownerId = modifier.ownerPlayerId;
                if (!ownerId) {
                  return state;
                }
                if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                  return state;
                }
                const tempModifier: Modifier = {
                  id: `${modifier.id}.battle`,
                  source: { type: "card", sourceId: card.id },
                  ownerPlayerId: ownerId,
                  attachedHex: hexKey,
                  duration: { type: "endOfBattle" },
                  hooks: {
                    getChampionAttackDice: ({ unit, round }, current) => {
                      if (round !== 1 || unit.kind !== "champion") {
                        return current;
                      }
                      if (unit.ownerPlayerId !== ownerId) {
                        return current;
                      }
                      return current + 1;
                    }
                  }
                };
                const cleaned = removeModifierById(state, modifier.id);
                return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "smokeScreen": {
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.smoke_screen`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({
                state,
                modifier,
                hexKey,
                round,
                attackerPlayerId,
                defenderPlayerId
              }) => {
                if (round !== 1) {
                  return state;
                }
                const ownerId = modifier.ownerPlayerId;
                if (!ownerId) {
                  return state;
                }
                if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                  return state;
                }
                const tempModifier: Modifier = {
                  id: `${modifier.id}.battle`,
                  source: { type: "card", sourceId: card.id },
                  ownerPlayerId: ownerId,
                  attachedHex: hexKey,
                  duration: { type: "endOfBattle" },
                  hooks: {
                    getForceHitFaces: ({ unit, round }, current) => {
                      if (round !== 1 || unit.kind !== "force") {
                        return current;
                      }
                      if (unit.ownerPlayerId === ownerId) {
                        return current;
                      }
                      return Math.min(current, 1);
                    }
                  }
                };
                const cleaned = removeModifierById(state, modifier.id);
                return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "shockDrill": {
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.shock_drill`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({
                state,
                modifier,
                hexKey,
                round,
                attackerPlayerId,
                defenderPlayerId
              }) => {
                if (round !== 1) {
                  return state;
                }
                const ownerId = modifier.ownerPlayerId;
                if (!ownerId) {
                  return state;
                }
                if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                  return state;
                }
                const tempModifier: Modifier = {
                  id: `${modifier.id}.battle`,
                  source: { type: "card", sourceId: card.id },
                  ownerPlayerId: ownerId,
                  attachedHex: hexKey,
                  duration: { type: "endOfBattle" },
                  hooks: {
                    getForceHitFaces: ({ unit, round }, current) => {
                      if (round !== 1 || unit.kind !== "force") {
                        return current;
                      }
                      if (unit.ownerPlayerId !== ownerId) {
                        return current;
                      }
                      return Math.max(current, 5);
                    }
                  }
                };
                const cleaned = removeModifierById(state, modifier.id);
                return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "frenzy": {
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
      const diceBonus = typeof effect.diceBonus === "number" ? effect.diceBonus : 0;
      const damage = typeof effect.damage === "number" ? effect.damage : 0;
      nextState = dealChampionDamage(nextState, playerId, target.unitId, damage);
      const updated = nextState.board.units[target.unitId];
      if (!updated || updated.kind !== "champion") {
        return nextState;
      }
      if (diceBonus <= 0) {
        return nextState;
      }
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.frenzy`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedUnitId: target.unitId,
            duration: { type: "endOfRound" },
            hooks: {
              getChampionAttackDice: ({ unit }, current) => {
                if (unit.kind !== "champion") {
                  return current;
                }
                if (unit.id !== target.unitId) {
                  return current;
                }
                return current + diceBonus;
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "slow": {
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
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.slow`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedUnitId: target.unitId,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({ state, modifier, hexKey }) => {
                const unitId = modifier.attachedUnitId;
                if (!unitId) {
                  return state;
                }
                const unit = state.board.units[unitId];
                if (!unit || unit.kind !== "champion") {
                  return state;
                }
                if (unit.hex !== hexKey) {
                  return state;
                }
                const tempModifier: Modifier = {
                  id: `${modifier.id}.battle`,
                  source: { type: "card", sourceId: card.id },
                  ownerPlayerId: modifier.ownerPlayerId,
                  attachedUnitId: unitId,
                  attachedHex: hexKey,
                  duration: { type: "endOfBattle" },
                  hooks: {
                    getChampionAttackDice: ({ unit }, current) => {
                      if (unit.kind !== "champion" || unit.id !== unitId) {
                        return current;
                      }
                      return Math.min(current, 1);
                    }
                  }
                };
                const cleaned = removeModifierById(state, modifier.id);
                return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "focusFire": {
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.focus_fire`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({
                state,
                modifier,
                hexKey,
                round,
                attackerPlayerId,
                defenderPlayerId
              }) => {
                if (round !== 1) {
                  return state;
                }
                const ownerId = modifier.ownerPlayerId;
                if (!ownerId) {
                  return state;
                }
                if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                  return state;
                }
                const tempModifier: Modifier = {
                  id: `${modifier.id}.battle`,
                  source: { type: "card", sourceId: card.id },
                  ownerPlayerId: ownerId,
                  attachedHex: hexKey,
                  duration: { type: "endOfBattle" },
                  hooks: {
                    getHitAssignmentPolicy: (
                      { targetSide, attackerPlayerId, defenderPlayerId },
                      current
                    ) => {
                      if (ownerId === attackerPlayerId && targetSide === "defenders") {
                        return "focusFire";
                      }
                      if (ownerId === defenderPlayerId && targetSide === "attackers") {
                        return "focusFire";
                      }
                      return current;
                    }
                  }
                };
                const cleaned = removeModifierById(state, modifier.id);
                return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
              }
            }
          }
        ]
      };
      return nextState;
    }
    case "setToSkirmish": {
      const target = getHexTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!target) {
        return nextState;
      }
      const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}.skirmish`;
      nextState = {
        ...nextState,
        modifiers: [
          ...nextState.modifiers,
          {
            id: modifierId,
            source: { type: "card", sourceId: card.id },
            ownerPlayerId: playerId,
            attachedHex: target.hexKey,
            duration: { type: "endOfRound" },
            hooks: {
              beforeCombatRound: ({ state, modifier, hexKey, round }) => {
                if (round !== 1) {
                  return state;
                }
                const ownerId = modifier.ownerPlayerId;
                if (!ownerId) {
                  return state;
                }
                const hex = state.board.hexes[hexKey];
                if (!hex) {
                  return state;
                }
                const ownerUnits = hex.occupants[ownerId] ?? [];
                if (ownerUnits.length === 0) {
                  return state;
                }

                const candidates = neighborHexKeys(hexKey).filter((neighbor) => {
                  const neighborHex = state.board.hexes[neighbor];
                  if (!neighborHex) {
                    return false;
                  }
                  return countPlayersOnHex(neighborHex) === 0;
                });

                if (candidates.length === 0) {
                  let nextState = state;
                  const forceCount = ownerUnits.filter(
                    (unitId) => state.board.units[unitId]?.kind === "force"
                  ).length;
                  if (forceCount > 0) {
                    nextState = removeForcesFromHex(
                      nextState,
                      ownerId,
                      hexKey,
                      ownerUnits,
                      forceCount
                    );
                  }
                  for (const unitId of ownerUnits) {
                    const unit = nextState.board.units[unitId];
                    if (!unit || unit.kind !== "champion") {
                      continue;
                    }
                    nextState = dealChampionDamage(
                      nextState,
                      ownerId,
                      unitId,
                      unit.hp
                    );
                  }
                  return nextState;
                }

                const roll = randInt(state.rngState, 0, candidates.length - 1);
                const retreatHex = candidates[roll.value] ?? candidates[0];
                let nextState: GameState = {
                  ...state,
                  rngState: roll.next
                };
                nextState = moveUnits(nextState, ownerId, ownerUnits, hexKey, retreatHex);
                return nextState;
              }
            }
          }
        ]
      };
      return nextState;
    }
    default:
      return null;
  }
};
