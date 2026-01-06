import { describe, expect, it } from "vitest";

import { createBaseBoard, getCapitalSlots } from "./board-generation";

describe("board generation", () => {
  it("creates a base board with a centered tile", () => {
    const board = createBaseBoard(0);
    expect(Object.keys(board.hexes)).toHaveLength(1);
    expect(board.hexes["0,0"]).toBeDefined();
    expect(board.hexes["0,0"].tile).toBe("center");
    expect(board.bridges).toEqual({});
    expect(board.units).toEqual({});
  });

  it("marks non-center tiles as normal", () => {
    const board = createBaseBoard(1);
    expect(Object.keys(board.hexes)).toHaveLength(7);
    for (const [key, hex] of Object.entries(board.hexes)) {
      if (key === "0,0") {
        expect(hex.tile).toBe("center");
      } else {
        expect(hex.tile).toBe("normal");
      }
    }
  });

  it("returns corner capital slots for common player counts", () => {
    expect(getCapitalSlots(2, 4)).toEqual(["4,0", "-4,0"]);
    expect(getCapitalSlots(3, 4)).toEqual(["4,0", "-4,4", "0,-4"]);
    expect(getCapitalSlots(4, 4)).toEqual(["4,0", "0,4", "-4,0", "0,-4"]);
    expect(getCapitalSlots(6, 4)).toEqual(["4,0", "0,4", "-4,4", "-4,0", "0,-4", "4,-4"]);
  });

  it("returns special five-player capital slots for radius 5", () => {
    expect(getCapitalSlots(5, 5)).toEqual(["-5,0", "-4,5", "2,2", "5,-3", "1,-5"]);
  });

  it("rejects invalid player counts and unsupported radius", () => {
    expect(() => getCapitalSlots(1, 4)).toThrow("playerCount must be between 2 and 6");
    expect(() => getCapitalSlots(5, 4)).toThrow("5-player capital slots require radius 5");
    expect(() => getCapitalSlots(7, 4)).toThrow("playerCount must be between 2 and 6");
  });
});
