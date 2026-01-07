import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { createBaseBoard } from "./board-generation";
import { applyChampionDeployment } from "./champions";
import { validateMovePath } from "./card-effects";
import { getCardDef } from "./content/cards";
import { createNewGame } from "./engine";
import { applyModifierQuery, getCombatModifiers } from "./modifiers";
import { addChampionToHex, addForcesToHex } from "./units";

const getChampionCard = (cardId: string) => {
  const card = getCardDef(cardId);
  if (!card || !card.champion) {
    throw new Error(`missing champion card ${cardId}`);
  }
  return card;
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
});
