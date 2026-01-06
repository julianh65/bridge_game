import { describe, expect, it } from "vitest";

import {
  axialDistance,
  axialNeighbors,
  canonicalEdgeKey,
  generateHexKeys,
  neighborHexKeys,
  parseEdgeKey,
  parseHexKey,
  toHexKey
} from "@bridgefront/shared";

describe("hex", () => {
  it("round-trips hex keys", () => {
    const key = toHexKey(1, -2);
    expect(key).toBe("1,-2");
    expect(parseHexKey(key)).toEqual({ q: 1, r: -2 });
  });

  it("calculates axial distance", () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(axialDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(axialDistance({ q: -1, r: 1 }, { q: 2, r: -1 })).toBe(3);
  });

  it("returns neighbors in axial directions", () => {
    const neighbors = axialNeighbors({ q: 0, r: 0 }).map((coord) => toHexKey(coord.q, coord.r));
    expect(neighbors).toEqual(["1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"]);
    expect(neighborHexKeys("0,0")).toEqual(neighbors);
  });

  it("generates all hexes within radius", () => {
    expect(generateHexKeys(0)).toEqual(["0,0"]);
    const radiusOne = generateHexKeys(1);
    expect(radiusOne.length).toBe(7);
    expect(radiusOne).toEqual(
      expect.arrayContaining(["0,0", "1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"])
    );
  });

  it("builds canonical edge keys", () => {
    expect(canonicalEdgeKey("1,0", "0,0")).toBe("0,0|1,0");
    expect(canonicalEdgeKey("0,-1", "-1,0")).toBe("-1,0|0,-1");
    expect(parseEdgeKey("-1,0|0,-1")).toEqual(["-1,0", "0,-1"]);
  });
});
