import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { addForcesToHex } from "./units";

describe("addForcesToHex", () => {
  it("allocates ids above existing force ids", () => {
    const board = createBaseBoard(1);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["u_1", "u_3"]
      }
    };
    board.units = {
      u_1: { id: "u_1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      u_3: { id: "u_3", ownerPlayerId: "p1", kind: "force", hex: hexKey }
    };

    const updated = addForcesToHex(board, "p1", hexKey, 1);

    expect(updated.units["u_3"]).toBeDefined();
    expect(updated.units["u_4"]).toBeDefined();
    expect(updated.hexes[hexKey].occupants["p1"]).toEqual(["u_1", "u_3", "u_4"]);
  });
});
