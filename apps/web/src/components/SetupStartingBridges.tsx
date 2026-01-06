import { useMemo, useState } from "react";

import {
  getBridgeKey,
  type EdgeKey,
  type GameView,
  type HexKey,
  type PlayerID,
  type SetupChoice
} from "@bridgefront/engine";
import { axialDistance, neighborHexKeys, parseHexKey } from "@bridgefront/shared";

import type { RoomConnectionStatus } from "../lib/room-client";

type SetupStartingBridgesProps = {
  view: GameView;
  playerId: PlayerID | null;
  status: RoomConnectionStatus;
  onSubmitChoice: (choice: SetupChoice) => void;
};

type SuggestedEdge = {
  key: EdgeKey;
  alreadyExists: boolean;
};

const findPlayerCapital = (
  board: GameView["public"]["board"],
  playerId: PlayerID | null
): HexKey | null => {
  if (!playerId) {
    return null;
  }
  for (const hex of Object.values(board.hexes)) {
    if (hex.tile === "capital" && hex.ownerPlayerId === playerId) {
      return hex.key;
    }
  }
  return null;
};

const buildSuggestedEdges = (
  board: GameView["public"]["board"],
  capitalHex: HexKey,
  placedEdges: EdgeKey[]
): SuggestedEdge[] => {
  const capitalCoord = parseHexKey(capitalHex);
  const seen = new Set<EdgeKey>();
  const placed = new Set<EdgeKey>(placedEdges);
  const suggestions: SuggestedEdge[] = [];

  for (const hexKey of Object.keys(board.hexes)) {
    const coord = parseHexKey(hexKey);
    if (axialDistance(coord, capitalCoord) > 2) {
      continue;
    }
    const neighbors = neighborHexKeys(hexKey);
    for (const neighbor of neighbors) {
      if (!board.hexes[neighbor]) {
        continue;
      }
      const edgeKey = getBridgeKey(hexKey as HexKey, neighbor as HexKey);
      if (seen.has(edgeKey) || placed.has(edgeKey)) {
        continue;
      }
      seen.add(edgeKey);
      suggestions.push({
        key: edgeKey,
        alreadyExists: Boolean(board.bridges[edgeKey])
      });
    }
  }

  suggestions.sort((a, b) => a.key.localeCompare(b.key));
  return suggestions;
};

export const SetupStartingBridges = ({
  view,
  playerId,
  status,
  onSubmitChoice
}: SetupStartingBridgesProps) => {
  const setup = view.public.setup;
  const [edgeKey, setEdgeKey] = useState("");
  const startingBridges =
    setup && setup.type === "setup.startingBridges" ? setup : null;

  const players = view.public.players;
  const playerNames = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );
  const waitingFor = startingBridges?.waitingForPlayerIds ?? [];
  const waitingLabel =
    waitingFor.length > 0
      ? waitingFor
          .map((id) => playerNames.get(id) ?? id)
          .join(", ")
      : "none";
  const isWaiting = Boolean(playerId && waitingFor.includes(playerId));
  const remainingByPlayer = startingBridges?.remaining ?? {};
  const placedEdgesByPlayer = startingBridges?.placedEdges ?? {};
  const localRemaining = playerId ? remainingByPlayer[playerId] ?? 0 : 0;
  const localPlaced = playerId ? placedEdgesByPlayer[playerId] ?? [] : [];
  const capitalHex = useMemo(
    () => findPlayerCapital(view.public.board, playerId),
    [view.public.board, playerId]
  );
  const suggestions = useMemo(
    () => {
      if (!startingBridges || !capitalHex) {
        return [];
      }
      return buildSuggestedEdges(view.public.board, capitalHex, localPlaced);
    },
    [view.public.board, capitalHex, localPlaced, startingBridges]
  );
  const canPlace = status === "connected" && Boolean(playerId) && isWaiting;
  const trimmedEdgeKey = edgeKey.trim();
  const canSubmit = canPlace && trimmedEdgeKey.length > 0;
  const helperText = (() => {
    if (status !== "connected") {
      return "Connect to place starting bridges.";
    }
    if (!playerId) {
      return "Spectators can watch but cannot place bridges.";
    }
    if (!capitalHex) {
      return "Pick a capital before placing bridges.";
    }
    if (!isWaiting) {
      return "Waiting for other players to place bridges.";
    }
    if (localRemaining <= 0) {
      return "You have placed all starting bridges.";
    }
    return `Place ${localRemaining} more starting bridge${
      localRemaining === 1 ? "" : "s"
    }.`;
  })();

  const handleSubmit = (edge: EdgeKey) => {
    onSubmitChoice({ kind: "placeStartingBridge", edgeKey: edge });
    setEdgeKey("");
  };

  if (!startingBridges) {
    return null;
  }

  return (
    <section className="panel setup-bridges">
      <h2>Starting Bridges</h2>
      <p className="muted">
        Place two bridges between adjacent hexes within distance two of your capital.
      </p>
      <div className="setup-bridges__summary">
        <div className="resource-row">
          <span>Waiting on</span>
          <strong>{waitingLabel}</strong>
        </div>
        {playerId ? (
          <div className="resource-row">
            <span>Your remaining</span>
            <strong>{localRemaining}</strong>
          </div>
        ) : null}
      </div>
      <div className="setup-bridges__inputs">
        <label className="action-field">
          <span>Edge key</span>
          <input
            type="text"
            placeholder="q,r|q,r"
            value={edgeKey}
            onChange={(event) => setEdgeKey(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canSubmit}
          onClick={() => handleSubmit(trimmedEdgeKey)}
        >
          Place bridge
        </button>
      </div>
      {suggestions.length > 0 ? (
        <div className="setup-bridges__suggestions">
          {suggestions.map((edge) => (
            <button
              key={edge.key}
              type="button"
              className="setup-bridges__suggestion"
              disabled={!canPlace}
              onClick={() => handleSubmit(edge.key)}
              title={edge.alreadyExists ? "Bridge already exists" : "New bridge"}
            >
              {edge.key}
              {edge.alreadyExists ? " (existing)" : ""}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">No suggestions yet. Enter an edge key to place a bridge.</p>
      )}
      <div className="setup-bridges__players">
        {players.map((player) => {
          const remaining = remainingByPlayer[player.id] ?? 0;
          const placedEdges = placedEdgesByPlayer[player.id] ?? [];
          const isActive = waitingFor.includes(player.id);
          return (
            <div
              key={player.id}
              className={`setup-bridges__player-row${
                isActive ? " setup-bridges__player-row--active" : ""
              }`}
            >
              <div className="setup-bridges__player-info">
                <span className="setup-bridges__player-name">{player.name}</span>
                {placedEdges.length > 0 ? (
                  <ul className="card-list">
                    {placedEdges.map((edge) => (
                      <li key={edge} className="card-tag" title={edge}>
                        {edge}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">No edges yet.</span>
                )}
              </div>
              <span className="status-pill">{remaining} left</span>
            </div>
          );
        })}
      </div>
      <p className="muted">{helperText}</p>
    </section>
  );
};
