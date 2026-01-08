import { describe, expect, it } from "vitest";

import type { ActionDeclaration } from "./types";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { createActionResolutionState } from "./action-flow";

describe("basic action order", () => {
  it("orders basic actions by faction priority before lead order", () => {
    const config = {
      ...DEFAULT_CONFIG,
      basicActionFactionOrder: ["veil", "bastion"]
    };
    const base = createNewGame(config, 1, [
      { id: "p1", name: "Player 1", factionId: "bastion" },
      { id: "p2", name: "Player 2", factionId: "veil" },
      { id: "p3", name: "Player 3", factionId: "aerial" }
    ]);
    const state = { ...base, leadSeatIndex: 2 };
    const declarations: Record<string, ActionDeclaration | null> = {
      p1: { kind: "basic", action: { kind: "capitalReinforce" } },
      p2: { kind: "basic", action: { kind: "capitalReinforce" } },
      p3: { kind: "basic", action: { kind: "capitalReinforce" } }
    };

    const resolution = createActionResolutionState(state, declarations);
    const order = resolution.entries
      .filter((entry) => entry.kind === "basic")
      .map((entry) => entry.playerId);

    expect(order).toEqual(["p2", "p1", "p3"]);
  });
});
