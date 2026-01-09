import { useMemo } from "react";

import {
  getBridgeKey,
  type EdgeKey,
  type GameView,
  type HexKey,
  type PlayerID,
  type SetupChoice
} from "@bridgefront/engine";
import { axialDistance, neighborHexKeys, parseHexKey } from "@bridgefront/shared";

import { BoardView } from "./BoardView";
import { buildHexRender } from "../lib/board-preview";
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
  selectedEdges: EdgeKey[]
): SuggestedEdge[] => {
  const capitalCoord = parseHexKey(capitalHex);
  const seen = new Set<EdgeKey>();
  const placed = new Set<EdgeKey>(selectedEdges);
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
  const startingBridges =
    setup && setup.type === "setup.startingBridges" ? setup : null;
  const privateSetup =
    view.private?.setup && view.private.setup.type === "setup.startingBridges"
      ? view.private.setup
      : null;

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
  const localRemaining = playerId ? remainingByPlayer[playerId] ?? 0 : 0;
  const localPlaced = privateSetup?.selectedEdges ?? [];
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
  const previewEdgeKeys = useMemo(
    () => suggestions.map((edge) => edge.key),
    [suggestions]
  );
  const boardHexes = useMemo(
    () => buildHexRender(view.public.board),
    [view.public.board]
  );
  const playerIndexById = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player.seatIndex])),
    [players]
  );
  const highlightHexKeys = capitalHex ? [capitalHex] : [];
  const canPlace = status === "connected" && Boolean(playerId) && isWaiting;
  const canEdit = status === "connected" && Boolean(playerId);
  const isTargeting = canPlace && previewEdgeKeys.length > 0;
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
      return "You have placed all starting bridges. Click a selected bridge to change it.";
    }
    return `Click a highlighted bridge near your capital to place ${localRemaining} more.`;
  })();

  const handleSubmit = (edge: EdgeKey) => {
    onSubmitChoice({ kind: "placeStartingBridge", edgeKey: edge });
  };

  const handleRemove = (edge: EdgeKey) => {
    if (!canEdit) {
      return;
    }
    onSubmitChoice({ kind: "removeStartingBridge", edgeKey: edge });
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
        {playerId ? (
          <div className="resource-row">
            <span>Selected</span>
            <strong>{localPlaced.length}</strong>
          </div>
        ) : null}
      </div>
      <div className="setup-bridges__board">
        <BoardView
          hexes={boardHexes}
          board={view.public.board}
          playerIndexById={playerIndexById}
          showCoords={false}
          showTags
          showMineValues={false}
          highlightHexKeys={highlightHexKeys}
          previewEdgeKeys={previewEdgeKeys}
          onEdgeClick={canPlace ? handleSubmit : undefined}
          isTargeting={isTargeting}
          className="board-svg board-svg--game setup-bridges__board-svg"
        />
        {previewEdgeKeys.length > 0 ? (
          <p className="muted">Highlighted edges are valid starting bridges.</p>
        ) : null}
      </div>
      <div className="setup-bridges__players">
        {players.map((player) => {
          const remaining = remainingByPlayer[player.id] ?? 0;
          const isLocal = playerId === player.id;
          const placedEdges = isLocal ? localPlaced : [];
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
                {isLocal && placedEdges.length > 0 ? (
                  <ul className="card-list">
                    {placedEdges.map((edge) => (
                      <li key={edge}>
                        <button
                          type="button"
                          className="card-tag card-tag--clickable setup-bridges__selected"
                          onClick={() => handleRemove(edge)}
                          disabled={!canEdit}
                          title={`Remove ${edge}`}
                        >
                          <span>{edge}</span>
                          <span className="setup-bridges__selected-remove">x</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">
                    {remaining === 0 ? "Locked in." : "Selecting bridges."}
                  </span>
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
