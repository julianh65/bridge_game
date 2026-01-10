import { createRngState, neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import {
  GRAND_STRATEGIST_CHAMPION_ID,
  TACTICAL_HAND_KEY,
  applyChampionDeathEffects,
  applyChampionDeployment
} from "./champions";
import { resolveBattleAtHex } from "./combat";
import { validateMovePath } from "./card-effects";
import { getCardDef } from "./content/cards";
import { createNewGame } from "./engine";
import { applyModifierQuery, getCombatModifiers, runModifierEvents } from "./modifiers";
import { incrementCardsPlayedThisRound } from "./player-flags";
import { applyScoring } from "./round-flow";
import { applyChampionKillRewards } from "./rewards";
import type { GameEvent, GameState } from "./types";
import { addChampionToHex, addForcesToHex } from "./units";

const getChampionCard = (cardId: string) => {
  const card = getCardDef(cardId);
  if (!card || !card.champion) {
    throw new Error(`missing champion card ${cardId}`);
  }
  return card;
};

type CombatRoundPayload = Extract<GameEvent, { type: "combat.round" }>["payload"];

const getFirstCombatRound = (state: GameState, hexKey: string): CombatRoundPayload => {
  const entry = state.logs.find(
    (event) => event.type === "combat.round" && event.payload.hexKey === hexKey
  );
  if (!entry || entry.type !== "combat.round") {
    throw new Error(`missing combat round log for ${hexKey}`);
  }
  return entry.payload;
};

describe("champion abilities", () => {
  it("deploys Skirmisher Captain with an extra force", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const card = getChampionCard("champion.age1.skirmisher_captain");
    const deployed = addChampionToHex(board, "p1", "0,0", {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");

    const occupants = state.board.hexes["0,0"].occupants["p1"] ?? [];
    const forceUnits = occupants.filter((unitId) => state.board.units[unitId]?.kind === "force");
    expect(forceUnits).toHaveLength(1);
  });

  it("destroys an adjacent bridge on Siege Engineer deploy", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const neighbor = neighborHexKeys(hexKey).find((key) => Boolean(board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor for siege engineer test");
    }
    const edgeKey = getBridgeKey(hexKey, neighbor);
    board.bridges = {
      ...board.bridges,
      [edgeKey]: { key: edgeKey, from: hexKey, to: neighbor }
    };
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.siege_engineer",
      hp: 5,
      attackDice: 2,
      hitFaces: 2,
      bounty: 3
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, "champion.age2.siege_engineer", "p1");

    expect(state.board.bridges[edgeKey]).toBeUndefined();
  });

  it("allows Bridge Runner to move without bridges", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const card = getChampionCard("champion.age1.bridge_runner");
    const fromHex = "0,0";
    const toHex = "1,0";
    const deployed = addChampionToHex(board, "p1", fromHex, {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");

    const path = validateMovePath(state, "p1", [fromHex, toHex], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });

    expect(path).toEqual([fromHex, toHex]);
  });

  it("grants Wormhole Artificer +1 move distance when moving alone", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(2);
    const card = getChampionCard("champion.gatewright.wormhole_artificer");
    const fromHex = "0,0";
    const midHex = "1,0";
    const toHex = "2,0";
    const deployed = addChampionToHex(board, "p1", fromHex, {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");

    const path = validateMovePath(state, "p1", [fromHex, midHex, toHex], {
      maxDistance: 1,
      requiresBridge: false,
      requireStartOccupied: true
    });

    expect(path).toEqual([fromHex, midHex, toHex]);
  });

  it("adds control bonus for Bannerman while on the board", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const bannerman = addChampionToHex(board, "p1", "1,0", {
      cardDefId: "champion.power.bannerman",
      hp: 3,
      attackDice: 2,
      hitFaces: 2,
      bounty: 5
    });

    let state: GameState = {
      ...base,
      board: bannerman.board
    };
    state = applyChampionDeployment(state, bannerman.unitId, "champion.power.bannerman", "p1");

    const next = applyScoring(state);
    const p1 = next.players.find((player) => player.id === "p1");

    expect(p1?.vp.control).toBe(1);
  });

  it("only grants Center Bannerman control bonus while on the center", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const onCenter = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "champion.age3.center_bannerman",
      hp: 3,
      attackDice: 2,
      hitFaces: 2,
      bounty: 5
    });

    let stateOnCenter: GameState = {
      ...base,
      board: onCenter.board
    };
    stateOnCenter = applyChampionDeployment(
      stateOnCenter,
      onCenter.unitId,
      "champion.age3.center_bannerman",
      "p1"
    );

    const scoredCenter = applyScoring(stateOnCenter);
    const p1Center = scoredCenter.players.find((player) => player.id === "p1");

    expect(p1Center?.vp.control).toBe(2);

    const offCenterBoard = createBaseBoard(1);
    const offCenter = addChampionToHex(offCenterBoard, "p1", "1,0", {
      cardDefId: "champion.age3.center_bannerman",
      hp: 3,
      attackDice: 2,
      hitFaces: 2,
      bounty: 5
    });

    let stateOffCenter: GameState = {
      ...base,
      board: offCenter.board
    };
    stateOffCenter = applyChampionDeployment(
      stateOffCenter,
      offCenter.unitId,
      "champion.age3.center_bannerman",
      "p1"
    );

    const scoredOffCenter = applyScoring(stateOffCenter);
    const p1OffCenter = scoredOffCenter.players.find((player) => player.id === "p1");

    expect(p1OffCenter?.vp.control).toBe(0);
  });

  it("uses bodyguard hit assignment when forces protect a champion", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const card = getChampionCard("champion.bastion.ironclad_warden");
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });
    const boardWithForce = addForcesToHex(deployed.board, "p1", hexKey, 1);

    let state = {
      ...base,
      board: boardWithForce,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");

    const occupants = state.board.hexes[hexKey].occupants["p1"] ?? [];
    const targetUnitIds = occupants.filter((unitId) => {
      const unit = state.board.units[unitId];
      return unit?.kind === "champion" || unit?.kind === "force";
    });

    const modifiers = getCombatModifiers(state, hexKey);
    const policy = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getHitAssignmentPolicy,
      {
        hexKey,
        attackerPlayerId: "p2",
        defenderPlayerId: "p1",
        round: 1,
        targetSide: "defenders",
        targetUnitIds,
        hits: 1
      },
      "random"
    );

    expect(policy).toBe("bodyguard");

    const noForcePolicy = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getHitAssignmentPolicy,
      {
        hexKey,
        attackerPlayerId: "p2",
        defenderPlayerId: "p1",
        round: 1,
        targetSide: "defenders",
        targetUnitIds: [deployed.unitId],
        hits: 1
      },
      "random"
    );

    expect(noForcePolicy).toBe("random");
  });

  it("assigns tactical hand hits to enemy champions first", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const deployedStrategist = addChampionToHex(board, "p1", hexKey, {
      cardDefId: GRAND_STRATEGIST_CHAMPION_ID,
      hp: 6,
      attackDice: 3,
      hitFaces: 6,
      bounty: 3
    });
    const deployedDefenderA = addChampionToHex(deployedStrategist.board, "p2", hexKey, {
      cardDefId: "test.defender_a",
      hp: 2,
      attackDice: 0,
      hitFaces: 0,
      bounty: 0
    });
    const deployedDefenderB = addChampionToHex(deployedDefenderA.board, "p2", hexKey, {
      cardDefId: "test.defender_b",
      hp: 5,
      attackDice: 0,
      hitFaces: 0,
      bounty: 0
    });

    let state: GameState = {
      ...base,
      board: deployedDefenderB.board,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(7)
    };

    state = applyChampionDeployment(
      state,
      deployedStrategist.unitId,
      GRAND_STRATEGIST_CHAMPION_ID,
      "p1"
    );
    state = resolveBattleAtHex(state, hexKey);

    const firstRound = getFirstCombatRound(state, hexKey);
    const hitsByUnit = Object.fromEntries(
      firstRound.hitsToDefenders.champions.map((entry) => [entry.unitId, entry.hits])
    );

    expect(hitsByUnit[deployedDefenderA.unitId]).toBe(2);
    expect(hitsByUnit[deployedDefenderB.unitId]).toBe(1);

    const strategistUnit = state.board.units[deployedStrategist.unitId];
    if (!strategistUnit || strategistUnit.kind !== "champion") {
      throw new Error("missing grand strategist unit");
    }
    expect(strategistUnit.abilityUses[TACTICAL_HAND_KEY]?.remaining).toBe(0);
  });

  it("triggers Assassin's Edge before combat round 1", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const shadeblade = getChampionCard("champion.veil.shadeblade");
    const enemyCard = getChampionCard("champion.age1.sergeant");
    const hexKey = "0,0";
    const deployedShade = addChampionToHex(board, "p1", hexKey, {
      cardDefId: shadeblade.id,
      hp: shadeblade.champion.hp,
      attackDice: shadeblade.champion.attackDice,
      hitFaces: shadeblade.champion.hitFaces,
      bounty: shadeblade.champion.bounty
    });
    const deployedEnemy = addChampionToHex(deployedShade.board, "p2", hexKey, {
      cardDefId: enemyCard.id,
      hp: enemyCard.champion.hp,
      attackDice: enemyCard.champion.attackDice,
      hitFaces: enemyCard.champion.hitFaces,
      bounty: enemyCard.champion.bounty
    });

    let state = {
      ...base,
      board: deployedEnemy.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployedShade.unitId, shadeblade.id, "p1");

    const enemyUnit = state.board.units[deployedEnemy.unitId];
    if (!enemyUnit || enemyUnit.kind !== "champion") {
      throw new Error("missing enemy champion for assassin's edge test");
    }
    const enemyHp = enemyUnit.hp;

    state = runModifierEvents(
      state,
      getCombatModifiers(state, hexKey),
      (hooks) => hooks.beforeCombatRound,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        attackers: [deployedShade.unitId],
        defenders: [deployedEnemy.unitId]
      }
    );

    const damagedEnemy = state.board.units[deployedEnemy.unitId];
    if (!damagedEnemy || damagedEnemy.kind !== "champion") {
      throw new Error("missing damaged enemy for assassin's edge test");
    }
    expect(damagedEnemy.hp).toBe(enemyHp - 1);

    const shadeUnit = state.board.units[deployedShade.unitId];
    if (!shadeUnit || shadeUnit.kind !== "champion") {
      throw new Error("missing shadeblade unit");
    }
    expect(shadeUnit.abilityUses["assassins_edge"]?.remaining).toBe(0);
  });

  it("triggers Stormcaller tempest on adjacent enemy champions", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const enemyCard = getChampionCard("champion.age1.sergeant");
    const stormHex = "0,0";
    const adjacentHex = neighborHexKeys(stormHex).find((key) => Boolean(board.hexes[key]));
    if (!adjacentHex) {
      throw new Error("missing adjacent hex for stormcaller test");
    }

    const deployedStorm = addChampionToHex(board, "p1", stormHex, {
      cardDefId: "champion.age3.stormcaller",
      hp: 8,
      attackDice: 3,
      hitFaces: 2,
      bounty: 4
    });
    const deployedEnemy = addChampionToHex(deployedStorm.board, "p2", stormHex, {
      cardDefId: enemyCard.id,
      hp: enemyCard.champion.hp,
      attackDice: enemyCard.champion.attackDice,
      hitFaces: enemyCard.champion.hitFaces,
      bounty: enemyCard.champion.bounty
    });
    const deployedAdjacent = addChampionToHex(deployedEnemy.board, "p2", adjacentHex, {
      cardDefId: enemyCard.id,
      hp: enemyCard.champion.hp,
      attackDice: enemyCard.champion.attackDice,
      hitFaces: enemyCard.champion.hitFaces,
      bounty: enemyCard.champion.bounty
    });

    let state = {
      ...base,
      board: deployedAdjacent.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployedStorm.unitId, "champion.age3.stormcaller", "p1");

    const adjacentUnit = state.board.units[deployedAdjacent.unitId];
    const battleEnemy = state.board.units[deployedEnemy.unitId];
    if (!adjacentUnit || adjacentUnit.kind !== "champion") {
      throw new Error("missing adjacent enemy champion");
    }
    if (!battleEnemy || battleEnemy.kind !== "champion") {
      throw new Error("missing battle enemy champion");
    }
    const adjacentHp = adjacentUnit.hp;
    const battleHp = battleEnemy.hp;

    state = runModifierEvents(
      state,
      getCombatModifiers(state, stormHex),
      (hooks) => hooks.beforeCombatRound,
      {
        hexKey: stormHex,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        attackers: [deployedStorm.unitId],
        defenders: [deployedEnemy.unitId]
      }
    );

    const damagedAdjacent = state.board.units[deployedAdjacent.unitId];
    if (!damagedAdjacent || damagedAdjacent.kind !== "champion") {
      throw new Error("missing damaged adjacent champion");
    }
    expect(damagedAdjacent.hp).toBe(adjacentHp - 1);

    const stillBattleEnemy = state.board.units[deployedEnemy.unitId];
    if (!stillBattleEnemy || stillBattleEnemy.kind !== "champion") {
      throw new Error("missing battle enemy after tempest");
    }
    expect(stillBattleEnemy.hp).toBe(battleHp);

    const stormUnit = state.board.units[deployedStorm.unitId];
    if (!stormUnit || stormUnit.kind !== "champion") {
      throw new Error("missing stormcaller unit");
    }
    expect(stormUnit.abilityUses["tempest"]?.remaining).toBe(0);
  });

  it("boosts friendly forces in the hex for Inspiring Geezer", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const card = getChampionCard("champion.age1.inspiring_geezer");
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", hexKey, 1)
    };

    const occupants = state.board.hexes[hexKey].occupants["p1"] ?? [];
    const forceUnitId = occupants.find((unitId) => state.board.units[unitId]?.kind === "force");
    if (!forceUnitId) {
      throw new Error("missing force unit for inspiring geezer test");
    }
    const unit = state.board.units[forceUnitId];
    if (!unit || unit.kind !== "force") {
      throw new Error("expected force unit for inspiring geezer test");
    }

    const modifiers = getCombatModifiers(state, hexKey);
    const hitFaces = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getForceHitFaces,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: forceUnitId,
        unit
      },
      2
    );

    expect(hitFaces).toBe(3);
  });

  it("heals a friendly champion in-hex once per round for Field Surgeon", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const surgeonCard = getChampionCard("champion.age1.field_surgeon");
    const targetCard = getChampionCard("champion.age1.sergeant");
    const hexKey = "0,0";
    const deployedSurgeon = addChampionToHex(board, "p1", hexKey, {
      cardDefId: surgeonCard.id,
      hp: surgeonCard.champion.hp,
      attackDice: surgeonCard.champion.attackDice,
      hitFaces: surgeonCard.champion.hitFaces,
      bounty: surgeonCard.champion.bounty
    });
    const deployedTarget = addChampionToHex(deployedSurgeon.board, "p1", hexKey, {
      cardDefId: targetCard.id,
      hp: targetCard.champion.hp,
      attackDice: targetCard.champion.attackDice,
      hitFaces: targetCard.champion.hitFaces,
      bounty: targetCard.champion.bounty
    });

    let state = {
      ...base,
      board: deployedTarget.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployedSurgeon.unitId, surgeonCard.id, "p1");

    const targetUnit = state.board.units[deployedTarget.unitId];
    if (!targetUnit || targetUnit.kind !== "champion") {
      throw new Error("missing target champion unit");
    }
    state = {
      ...state,
      board: {
        ...state.board,
        units: {
          ...state.board.units,
          [deployedTarget.unitId]: {
            ...targetUnit,
            hp: Math.max(1, targetCard.champion.hp - 2),
            maxHp: targetCard.champion.hp
          }
        }
      }
    };

    state = runModifierEvents(
      state,
      getCombatModifiers(state, hexKey),
      (hooks) => hooks.afterBattle,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        reason: "noHits",
        winnerPlayerId: null,
        attackers: [deployedSurgeon.unitId, deployedTarget.unitId],
        defenders: []
      }
    );

    const healedTarget = state.board.units[deployedTarget.unitId];
    if (!healedTarget || healedTarget.kind !== "champion") {
      throw new Error("missing healed target");
    }
    expect(healedTarget.hp).toBe(targetCard.champion.hp);

    const surgeonUnit = state.board.units[deployedSurgeon.unitId];
    if (!surgeonUnit || surgeonUnit.kind !== "champion") {
      throw new Error("missing field surgeon unit");
    }
    expect(surgeonUnit.abilityUses["stitchwork"]?.remaining).toBe(0);
  });

  it("grants Brute bonus dice only without enemy champions", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const bruteCard = getChampionCard("champion.age1.brute");
    const enemyCard = getChampionCard("champion.bastion.ironclad_warden");
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: bruteCard.id,
      hp: bruteCard.champion.hp,
      attackDice: bruteCard.champion.attackDice,
      hitFaces: bruteCard.champion.hitFaces,
      bounty: bruteCard.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, bruteCard.id, "p1");

    const modifiers = getCombatModifiers(state, hexKey);
    const bruteUnit = state.board.units[deployed.unitId];
    if (!bruteUnit || bruteUnit.kind !== "champion") {
      throw new Error("missing brute unit");
    }

    const diceWithoutEnemy = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: bruteUnit
      },
      bruteUnit.attackDice
    );

    expect(diceWithoutEnemy).toBe(bruteUnit.attackDice + 2);

    const enemy = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: enemyCard.id,
      hp: enemyCard.champion.hp,
      attackDice: enemyCard.champion.attackDice,
      hitFaces: enemyCard.champion.hitFaces,
      bounty: enemyCard.champion.bounty
    });
    state = {
      ...state,
      board: enemy.board
    };
    state = applyChampionDeployment(state, enemy.unitId, enemyCard.id, "p2");

    const modifiersWithEnemy = getCombatModifiers(state, hexKey);
    const bruteUnitWithEnemy = state.board.units[deployed.unitId];
    if (!bruteUnitWithEnemy || bruteUnitWithEnemy.kind !== "champion") {
      throw new Error("missing brute unit with enemy");
    }
    const diceWithEnemy = applyModifierQuery(
      state,
      modifiersWithEnemy,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: bruteUnitWithEnemy
      },
      bruteUnitWithEnemy.attackDice
    );

    expect(diceWithEnemy).toBe(bruteUnitWithEnemy.attackDice);
  });

  it("scales Archivist Prime attack dice with cards played this round", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const card = getChampionCard("champion.cipher.archivist_prime");
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: card.id,
      hp: card.champion.hp,
      attackDice: card.champion.attackDice,
      hitFaces: card.champion.hitFaces,
      bounty: card.champion.bounty
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, card.id, "p1");
    state = incrementCardsPlayedThisRound(state, "p1", 3);

    const archivist = state.board.units[deployed.unitId];
    if (!archivist || archivist.kind !== "champion") {
      throw new Error("missing archivist prime");
    }

    const modifiers = getCombatModifiers(state, hexKey);
    const dice = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: archivist
      },
      archivist.attackDice
    );

    expect(dice).toBe(archivist.attackDice + 3);
  });

  it("grants Duelist Exemplar +1 die when an enemy champion is present", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.duelist_exemplar",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 3
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, "champion.age2.duelist_exemplar", "p1");

    const duelist = state.board.units[deployed.unitId];
    if (!duelist || duelist.kind !== "champion") {
      throw new Error("missing duelist exemplar");
    }

    let modifiers = getCombatModifiers(state, hexKey);
    const diceWithoutEnemy = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: duelist
      },
      duelist.attackDice
    );

    expect(diceWithoutEnemy).toBe(duelist.attackDice);

    const enemy = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: "test.enemy",
      hp: 1,
      attackDice: 0,
      hitFaces: 0,
      bounty: 1
    });
    state = {
      ...state,
      board: enemy.board
    };

    const duelistWithEnemy = state.board.units[deployed.unitId];
    if (!duelistWithEnemy || duelistWithEnemy.kind !== "champion") {
      throw new Error("missing duelist exemplar after enemy");
    }

    modifiers = getCombatModifiers(state, hexKey);
    const diceWithEnemy = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: duelistWithEnemy
      },
      duelistWithEnemy.attackDice
    );

    expect(diceWithEnemy).toBe(duelistWithEnemy.attackDice + 1);
  });

  it("grants Lone Wolf bonus dice only when no friendly forces are present", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.lone_wolf",
      hp: 5,
      attackDice: 1,
      hitFaces: 2,
      bounty: 3
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(state, deployed.unitId, "champion.age2.lone_wolf", "p1");

    const loneWolf = state.board.units[deployed.unitId];
    if (!loneWolf || loneWolf.kind !== "champion") {
      throw new Error("missing lone wolf");
    }

    let modifiers = getCombatModifiers(state, hexKey);
    const diceWithoutForces = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: loneWolf
      },
      loneWolf.attackDice
    );

    expect(diceWithoutForces).toBe(loneWolf.attackDice + 3);

    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", hexKey, 1)
    };

    const loneWolfWithForce = state.board.units[deployed.unitId];
    if (!loneWolfWithForce || loneWolfWithForce.kind !== "champion") {
      throw new Error("missing lone wolf after adding force");
    }

    modifiers = getCombatModifiers(state, hexKey);
    const diceWithForce = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: loneWolfWithForce
      },
      loneWolfWithForce.attackDice
    );

    expect(diceWithForce).toBe(loneWolfWithForce.attackDice);
  });

  it("sets Reliable Veteran hit faces to at least 5", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.reliable_veteran",
      hp: 6,
      attackDice: 1,
      hitFaces: 3,
      bounty: 3
    });

    let state = {
      ...base,
      board: deployed.board,
      phase: "round.action",
      blocks: undefined
    };

    state = applyChampionDeployment(
      state,
      deployed.unitId,
      "champion.age2.reliable_veteran",
      "p1"
    );

    const veteran = state.board.units[deployed.unitId];
    if (!veteran || veteran.kind !== "champion") {
      throw new Error("missing reliable veteran");
    }

    const modifiers = getCombatModifiers(state, hexKey);
    const hitFaces = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionHitFaces,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: deployed.unitId,
        unit: veteran
      },
      veteran.hitFaces
    );

    expect(hitFaces).toBe(5);
  });

  it("grants Bounty Hunter bonus gold on champion kill in battle", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const bountyCard = getChampionCard("champion.age1.bounty_hunter");
    const hunter = addChampionToHex(board, "p1", hexKey, {
      cardDefId: bountyCard.id,
      hp: bountyCard.champion.hp,
      attackDice: bountyCard.champion.attackDice,
      hitFaces: bountyCard.champion.hitFaces,
      bounty: bountyCard.champion.bounty
    });
    let state = {
      ...base,
      board: hunter.board,
      phase: "round.action",
      blocks: undefined
    };
    state = applyChampionDeployment(state, hunter.unitId, bountyCard.id, "p1");

    const enemyCard = getChampionCard("champion.age1.sergeant");
    const enemy = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: enemyCard.id,
      hp: enemyCard.champion.hp,
      attackDice: enemyCard.champion.attackDice,
      hitFaces: enemyCard.champion.hitFaces,
      bounty: enemyCard.champion.bounty
    });
    state = {
      ...state,
      board: enemy.board
    };

    const startingGold = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    const enemyUnit = state.board.units[enemy.unitId];
    if (!enemyUnit || enemyUnit.kind !== "champion") {
      throw new Error("missing enemy champion unit");
    }

    state = applyChampionKillRewards(state, {
      killerPlayerId: "p1",
      victimPlayerId: "p2",
      killedChampions: [enemyUnit],
      bounty: enemyUnit.bounty,
      hexKey,
      source: "battle"
    });

    const endingGold = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    expect(endingGold).toBe(startingGold + enemyUnit.bounty + 1);
  });

  it("steals gold on champion kills for Tax Reaver", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const reaver = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.tax_reaver",
      hp: 6,
      attackDice: 2,
      hitFaces: 3,
      bounty: 3
    });
    let state = {
      ...base,
      board: reaver.board,
      phase: "round.action",
      blocks: undefined
    };
    state = applyChampionDeployment(state, reaver.unitId, "champion.age2.tax_reaver", "p1");
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p2"
          ? {
              ...player,
              resources: {
                ...player.resources,
                gold: 1
              }
            }
          : player
      )
    };

    const victim = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 0
    });
    state = {
      ...state,
      board: victim.board
    };

    const victimUnit = state.board.units[victim.unitId];
    if (!victimUnit || victimUnit.kind !== "champion") {
      throw new Error("missing victim champion unit");
    }

    const p1GoldStart = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    const p2GoldStart = state.players.find((player) => player.id === "p2")?.resources.gold ?? 0;

    state = applyChampionKillRewards(state, {
      killerPlayerId: "p1",
      victimPlayerId: "p2",
      killedChampions: [victimUnit],
      bounty: 0,
      hexKey,
      source: "battle"
    });

    const p1GoldEnd = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    const p2GoldEnd = state.players.find((player) => player.id === "p2")?.resources.gold ?? 0;
    expect(p1GoldEnd - p1GoldStart).toBe(1);
    expect(p2GoldStart - p2GoldEnd).toBe(1);
  });

  it("deploys a force when Capturer wins a battle", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const capturer = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age2.capturer",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 0
    });

    let state = {
      ...base,
      board: capturer.board,
      phase: "round.action",
      blocks: undefined
    };
    state = applyChampionDeployment(state, capturer.unitId, "champion.age2.capturer", "p1");

    const modifier = state.modifiers.find(
      (entry) => entry.source.type === "champion" && entry.source.sourceId === "champion.age2.capturer"
    );
    if (!modifier?.hooks?.afterBattle) {
      throw new Error("missing capturer modifier");
    }

    const beforeForces =
      state.board.hexes[hexKey].occupants["p1"]?.filter(
        (unitId) => state.board.units[unitId]?.kind === "force"
      ).length ?? 0;

    const nextState = modifier.hooks.afterBattle({
      state,
      modifier,
      hexKey,
      attackerPlayerId: "p1",
      defenderPlayerId: "p2",
      round: 1,
      reason: "eliminated",
      winnerPlayerId: "p1",
      attackers: [capturer.unitId],
      defenders: []
    });

    const afterForces =
      nextState.board.hexes[hexKey].occupants["p1"]?.filter(
        (unitId) => nextState.board.units[unitId]?.kind === "force"
      ).length ?? 0;

    expect(afterForces).toBe(beforeForces + 1);
  });

  it("boosts forces in capital sieges for Capital Breaker", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const hex = board.hexes[hexKey];
    if (!hex) {
      throw new Error("missing hex for capital breaker test");
    }
    board.hexes[hexKey] = {
      ...hex,
      tile: "capital",
      ownerPlayerId: "p2"
    };
    const breaker = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age3.capital_breaker",
      hp: 8,
      attackDice: 3,
      hitFaces: 3,
      bounty: 4
    });

    let state = {
      ...base,
      board: breaker.board,
      phase: "round.action",
      blocks: undefined
    };
    state = applyChampionDeployment(state, breaker.unitId, "champion.age3.capital_breaker", "p1");
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", hexKey, 1)
    };

    const forceId = (state.board.hexes[hexKey].occupants["p1"] ?? []).find(
      (unitId) => state.board.units[unitId]?.kind === "force"
    );
    if (!forceId) {
      throw new Error("missing force unit for capital breaker test");
    }
    const forceUnit = state.board.units[forceId];
    if (!forceUnit || forceUnit.kind !== "force") {
      throw new Error("expected force unit for capital breaker test");
    }

    const modifiers = getCombatModifiers(state, hexKey);
    const hitFaces = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getForceHitFaces,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId: forceId,
        unit: forceUnit
      },
      2
    );

    expect(hitFaces).toBe(3);
  });

  it("grants gold once per round for Blood Banker champion deaths in its hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const banker = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age3.blood_banker",
      hp: 7,
      attackDice: 2,
      hitFaces: 3,
      bounty: 3
    });
    let state = {
      ...base,
      board: banker.board,
      phase: "round.action",
      blocks: undefined
    };
    state = applyChampionDeployment(state, banker.unitId, "champion.age3.blood_banker", "p1");

    const enemy = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 1
    });
    state = { ...state, board: enemy.board };

    const enemyUnit = state.board.units[enemy.unitId];
    if (!enemyUnit || enemyUnit.kind !== "champion") {
      throw new Error("missing enemy champion unit");
    }

    const goldStart = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    state = applyChampionDeathEffects(state, [enemyUnit]);
    const goldAfter = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    expect(goldAfter).toBe(goldStart + 2);

    const nextEnemy = addChampionToHex(state.board, "p2", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 1
    });
    state = { ...state, board: nextEnemy.board };
    const nextEnemyUnit = state.board.units[nextEnemy.unitId];
    if (!nextEnemyUnit || nextEnemyUnit.kind !== "champion") {
      throw new Error("missing second enemy champion unit");
    }

    const goldBeforeSecond = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    state = applyChampionDeathEffects(state, [nextEnemyUnit]);
    const goldAfterSecond = state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;
    expect(goldAfterSecond).toBe(goldBeforeSecond);

    const bankerUnit = state.board.units[banker.unitId];
    if (!bankerUnit || bankerUnit.kind !== "champion") {
      throw new Error("missing blood banker unit");
    }
    expect(bankerUnit.abilityUses["blood_ledger"]?.remaining).toBe(0);
  });
});
