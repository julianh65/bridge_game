import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { createBaseBoard } from "./board-generation";
import { applyChampionDeployment } from "./champions";
import { validateMovePath } from "./card-effects";
import { getCardDef } from "./content/cards";
import { createNewGame } from "./engine";
import { addChampionToHex } from "./units";

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
});
