import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { applyChampionDeployment } from "./champions";
import { validateMovePath } from "./card-effects";
import { getCardDef } from "./content/cards";
import { createNewGame } from "./engine";
import { applyModifierQuery, getCombatModifiers } from "./modifiers";
import { applyChampionKillRewards } from "./rewards";
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
});
