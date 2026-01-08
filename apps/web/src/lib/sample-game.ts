import {
  DEFAULT_CONFIG,
  applyCommand,
  createNewGame,
  getBridgeKey,
  runUntilBlocked,
  type GameState,
  type HexKey
} from "@bridgefront/engine";
import { neighborHexKeys } from "@bridgefront/shared";

import { buildHexRender } from "./board-preview";

type SampleGame = {
  state: GameState;
  hexRender: ReturnType<typeof buildHexRender>;
};

const normalizeSeed = (seedInput: string) => {
  const parsed = Number.parseInt(seedInput, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const autoResolveSetup = (state: GameState): GameState => {
  let nextState = runUntilBlocked(state);

  while (nextState.phase === "setup" && nextState.blocks) {
    const block = nextState.blocks;
    if (block.waitingFor.length === 0) {
      const hostId = nextState.players.find((player) => player.seatIndex === 0)?.id;
      if (!hostId) {
        break;
      }
      nextState = applyCommand(nextState, { type: "AdvanceSetup" }, hostId);
      nextState = runUntilBlocked(nextState);
      continue;
    }

    if (block.type === "setup.capitalDraft") {
      const playerId = block.waitingFor[0];
      const taken = new Set(
        Object.values(block.payload.choices).filter((choice): choice is HexKey => Boolean(choice))
      );
      const choice = block.payload.availableSlots.find((slot) => !taken.has(slot));
      if (!choice) {
        break;
      }
      nextState = applyCommand(
        nextState,
        { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: choice } },
        playerId
      );
      nextState = runUntilBlocked(nextState);
      continue;
    }

    if (block.type === "setup.startingBridges") {
      for (const playerId of block.waitingFor) {
        const remaining = block.payload.remaining[playerId] ?? 0;
        if (remaining <= 0) {
          continue;
        }

        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player?.capitalHex) {
          continue;
        }

        const neighbors = neighborHexKeys(player.capitalHex).filter(
          (key) => Boolean(nextState.board.hexes[key])
        );
        const candidateEdges = neighbors
          .map((neighbor) => getBridgeKey(player.capitalHex as HexKey, neighbor))
          .filter(
            (edgeKey) =>
              !nextState.board.bridges[edgeKey] &&
              !(block.payload.placedEdges[playerId] ?? []).includes(edgeKey)
          );

        for (let i = 0; i < remaining && i < candidateEdges.length; i += 1) {
          nextState = applyCommand(
            nextState,
            {
              type: "SubmitSetupChoice",
              payload: { kind: "placeStartingBridge", edgeKey: candidateEdges[i] }
            },
            playerId
          );
        }
      }

      nextState = runUntilBlocked(nextState);
      continue;
    }

    if (block.type === "setup.freeStartingCardPick") {
      for (const playerId of block.waitingFor) {
        const offer = block.payload.offers[playerId]?.[0];
        if (!offer) {
          continue;
        }
        nextState = applyCommand(
          nextState,
          {
            type: "SubmitSetupChoice",
            payload: { kind: "pickFreeStartingCard", cardId: offer }
          },
          playerId
        );
      }

      nextState = runUntilBlocked(nextState);
      continue;
    }

    break;
  }

  return nextState;
};

export const buildSampleGame = (playerCount: number, seedInput: string): SampleGame => {
  const seedValue = normalizeSeed(seedInput);
  const lobbyPlayers = Array.from({ length: playerCount }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`
  }));

  const baseState = createNewGame(DEFAULT_CONFIG, seedValue, lobbyPlayers);
  const state = autoResolveSetup(baseState);
  const hexRender = buildHexRender(state.board);

  return { state, hexRender };
};
