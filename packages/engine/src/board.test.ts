import { describe, expect, it } from "vitest";

import {
  countPlayersOnHex,
  getBridgeKey,
  getPlayerIdsOnHex,
  hasBridge,
  hasEnemyUnits,
  isContestedHex,
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
import type { BoardState, HexState } from "./types";

const makeHex = (occupants: HexState["occupants"]): HexState => ({
  key: "0,0",
  tile: "normal",
  occupants
});

describe("board helpers", () => {
  it("tracks occupants and contested state", () => {
    const hex = makeHex({
      p1: ["u1"],
      p2: [],
      p3: ["u2", "u3"]
    });

    expect(getPlayerIdsOnHex(hex)).toEqual(["p1", "p3"]);
    expect(countPlayersOnHex(hex)).toBe(2);
    expect(isOccupiedByPlayer(hex, "p1")).toBe(true);
    expect(isOccupiedByPlayer(hex, "p2")).toBe(false);
    expect(hasEnemyUnits(hex, "p1")).toBe(true);
    expect(hasEnemyUnits(hex, "p3")).toBe(true);
    expect(isContestedHex(hex)).toBe(true);
  });

  it("enforces two-player-per-hex rule checks", () => {
    const hex = makeHex({
      p1: ["u1"],
      p2: ["u2"]
    });

    expect(wouldExceedTwoPlayers(hex, "p1")).toBe(false);
    expect(wouldExceedTwoPlayers(hex, "p2")).toBe(false);
    expect(wouldExceedTwoPlayers(hex, "p3")).toBe(true);
  });

  it("checks bridge existence via canonical edge key", () => {
    const board: BoardState = {
      radius: 1,
      hexes: {},
      bridges: {
        "0,0|1,0": {
          key: "0,0|1,0",
          from: "0,0",
          to: "1,0"
        }
      },
      units: {}
    };

    expect(getBridgeKey("1,0", "0,0")).toBe("0,0|1,0");
    expect(hasBridge(board, "1,0", "0,0")).toBe(true);
    expect(hasBridge(board, "0,0", "0,1")).toBe(false);
  });
});
