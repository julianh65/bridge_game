import { useMemo, useState, useEffect } from "react";

import {
  CARD_DEFS,
  getBridgeKey,
  type ActionDeclaration,
  type Bid,
  type CollectionChoice,
  type GameView
} from "@bridgefront/engine";
import { areAdjacent, parseHexKey } from "@bridgefront/shared";

import { ActionPanel, type BoardPickMode } from "./ActionPanel";
import { BoardView } from "./BoardView";
import { CollectionPanel } from "./CollectionPanel";
import { MarketPanel } from "./MarketPanel";
import { buildHexRender } from "../lib/board-preview";
import { formatGameEvent } from "../lib/event-format";
import type { RoomConnectionStatus } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type BoardUnitView = GameView["public"]["board"]["units"][string];

type ChampionTargetOption = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  hex: string;
  hp: number;
  maxHp: number;
};

const parseTargets = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const getTargetString = (
  record: Record<string, unknown> | null,
  key: string
): string | null => {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

type GameScreenProps = {
  view: GameView;
  playerId: string | null;
  roomId: string;
  status: RoomConnectionStatus;
  onSubmitAction: (declaration: ActionDeclaration) => void;
  onSubmitMarketBid: (bid: Bid) => void;
  onSubmitCollectionChoices: (choices: CollectionChoice[]) => void;
  onLeave: () => void;
};

export const GameScreen = ({
  view,
  playerId,
  roomId,
  status,
  onSubmitAction,
  onSubmitMarketBid,
  onSubmitCollectionChoices,
  onLeave
}: GameScreenProps) => {
  const hexRender = useMemo(() => buildHexRender(view.public.board), [view.public.board]);
  const playerNames = useMemo(
    () => new Map(view.public.players.map((player) => [player.id, player.name])),
    [view.public.players]
  );
  const localPlayer = view.public.players.find((player) => player.id === playerId);
  const handCards = view.private?.handCards ?? [];
  const handCount = view.private ? handCards.length : 0;
  const deckCounts = view.private?.deckCounts ?? null;
  const phaseLabel = view.public.phase.replace("round.", "").replace(".", " ");
  const connectionLabel = status === "connected" ? "Live" : "Waiting";
  const connectionClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const [edgeKey, setEdgeKey] = useState("");
  const [marchFrom, setMarchFrom] = useState("");
  const [marchTo, setMarchTo] = useState("");
  const [cardInstanceId, setCardInstanceId] = useState("");
  const [cardTargetsRaw, setCardTargetsRaw] = useState("");
  const [boardPickMode, setBoardPickMode] = useState<BoardPickMode>("none");
  const [selectedHexKey, setSelectedHexKey] = useState<string | null>(null);
  const [pendingEdgeStart, setPendingEdgeStart] = useState<string | null>(null);
  const [pendingStackFrom, setPendingStackFrom] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string[]>([]);
  const [resetViewToken, setResetViewToken] = useState(0);
  const targetRecord = useMemo(() => parseTargets(cardTargetsRaw), [cardTargetsRaw]);
  const selectedChampionId =
    getTargetString(targetRecord, "unitId") ?? getTargetString(targetRecord, "championId");

  const selectedCard = handCards.find((card) => card.id === cardInstanceId) ?? null;
  const selectedCardDef = selectedCard
    ? CARD_DEFS_BY_ID.get(selectedCard.defId) ?? null
    : null;
  const cardTargetKind = selectedCardDef?.targetSpec.kind ?? "none";
  const championUnits = useMemo(() => {
    return Object.values(view.public.board.units)
      .map((unit) => {
        if (unit.kind !== "champion") {
          return null;
        }
        const def = CARD_DEFS_BY_ID.get(unit.cardDefId);
        const ownerName = playerNames.get(unit.ownerPlayerId) ?? unit.ownerPlayerId;
        return {
          id: unit.id,
          name: def?.name ?? unit.cardDefId,
          ownerId: unit.ownerPlayerId,
          ownerName,
          hex: unit.hex,
          hp: unit.hp,
          maxHp: unit.maxHp
        };
      })
      .filter((unit): unit is ChampionTargetOption => Boolean(unit))
      .sort((a, b) => {
        if (a.ownerName !== b.ownerName) {
          return a.ownerName.localeCompare(b.ownerName);
        }
        if (a.name !== b.name) {
          return a.name.localeCompare(b.name);
        }
        return a.id.localeCompare(b.id);
      });
  }, [view.public.board.units, playerNames]);
  const leadSeatIndex =
    view.public.players.length > 0
      ? (view.public.round - 1 + view.public.players.length) % view.public.players.length
      : 0;
  const leadPlayer = view.public.players.find((player) => player.seatIndex === leadSeatIndex) ?? null;

  useEffect(() => {
    if (cardInstanceId && !handCards.some((card) => card.id === cardInstanceId)) {
      setCardInstanceId("");
      setCardTargetsRaw("");
    }
  }, [cardInstanceId, handCards]);

  const setBoardPickModeSafe = (mode: BoardPickMode) => {
    setBoardPickMode(mode);
    setPendingEdgeStart(null);
    setPendingStackFrom(null);
    setPendingPath([]);
  };

  const setCardTargetsObject = (targets: Record<string, unknown> | null) => {
    setCardTargetsRaw(targets ? JSON.stringify(targets) : "");
  };

  const isAdjacent = (from: string, to: string) => {
    try {
      return areAdjacent(parseHexKey(from), parseHexKey(to));
    } catch {
      return false;
    }
  };

  const handleBoardHexClick = (hexKey: string) => {
    setSelectedHexKey(hexKey);

    if (boardPickMode === "marchFrom") {
      setMarchFrom(hexKey);
      setBoardPickMode("marchTo");
      return;
    }
    if (boardPickMode === "marchTo") {
      setMarchTo(hexKey);
      return;
    }
    if (boardPickMode === "bridgeEdge" || boardPickMode === "cardEdge") {
      if (!pendingEdgeStart || pendingEdgeStart === hexKey) {
        setPendingEdgeStart(hexKey);
        if (boardPickMode === "cardEdge") {
          setCardTargetsObject(null);
        }
        return;
      }
      if (!isAdjacent(pendingEdgeStart, hexKey)) {
        setPendingEdgeStart(hexKey);
        if (boardPickMode === "cardEdge") {
          setCardTargetsObject(null);
        }
        return;
      }
      const edge = getBridgeKey(pendingEdgeStart, hexKey);
      if (boardPickMode === "bridgeEdge") {
        setEdgeKey(edge);
      } else {
        setCardTargetsObject({ edgeKey: edge });
      }
      setPendingEdgeStart(null);
      return;
    }
    if (boardPickMode === "cardStack") {
      if (!pendingStackFrom || pendingStackFrom === hexKey) {
        setPendingStackFrom(hexKey);
        setCardTargetsObject(null);
        return;
      }
      setCardTargetsObject({ from: pendingStackFrom, to: hexKey });
      setPendingStackFrom(null);
      return;
    }
    if (boardPickMode === "cardPath") {
      setPendingPath((current) => {
        if (current.length === 0) {
          const next = [hexKey];
          setCardTargetsObject(null);
          return next;
        }
        const last = current[current.length - 1];
        if (last === hexKey) {
          return current;
        }
        if (!isAdjacent(last, hexKey)) {
          const next = [hexKey];
          setCardTargetsObject(null);
          return next;
        }
        const next = [...current, hexKey];
        if (next.length >= 2) {
          setCardTargetsObject({ path: next });
        }
        return next;
      });
      return;
    }
    if (boardPickMode === "cardChoice") {
      setCardTargetsObject({ choice: "occupiedHex", hexKey });
    }
  };

  const highlightHexKeys = useMemo(() => {
    const keys = new Set<string>();
    if (pendingEdgeStart) {
      keys.add(pendingEdgeStart);
    }
    if (pendingStackFrom) {
      keys.add(pendingStackFrom);
    }
    for (const key of pendingPath) {
      keys.add(key);
    }
    return Array.from(keys);
  }, [pendingEdgeStart, pendingStackFrom, pendingPath]);

  const cardCostLabel = selectedCardDef
    ? `${selectedCardDef.cost.mana} mana${
        selectedCardDef.cost.gold ? `, ${selectedCardDef.cost.gold} gold` : ""
      }`
    : null;

  const cardTargetPanel = selectedCardDef
    ? (() => {
        switch (cardTargetKind) {
          case "none":
            return <p className="card-detail__hint">No targets required.</p>;
          case "edge":
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target edge</span>
                  <button
                    type="button"
                    className={`btn btn-tertiary ${
                      boardPickMode === "cardEdge" ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setBoardPickModeSafe(
                        boardPickMode === "cardEdge" ? "none" : "cardEdge"
                      )
                    }
                  >
                    Pick on board
                  </button>
                </div>
                <p className="card-detail__hint">
                  {pendingEdgeStart
                    ? `Pick adjacent hex to ${pendingEdgeStart}`
                    : "Pick two adjacent hexes to set edge."}
                </p>
              </div>
            );
          case "stack":
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target stack</span>
                  <button
                    type="button"
                    className={`btn btn-tertiary ${
                      boardPickMode === "cardStack" ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setBoardPickModeSafe(
                        boardPickMode === "cardStack" ? "none" : "cardStack"
                      )
                    }
                  >
                    Pick on board
                  </button>
                </div>
                <p className="card-detail__hint">
                  {pendingStackFrom
                    ? `Pick destination from ${pendingStackFrom}`
                    : "Pick a start hex, then a destination hex."}
                </p>
              </div>
            );
          case "path":
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target path</span>
                  <div className="card-detail__row-actions">
                    <button
                      type="button"
                      className={`btn btn-tertiary ${
                        boardPickMode === "cardPath" ? "is-active" : ""
                      }`}
                      onClick={() =>
                        setBoardPickModeSafe(
                          boardPickMode === "cardPath" ? "none" : "cardPath"
                        )
                      }
                    >
                      Pick on board
                    </button>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => {
                        setPendingPath([]);
                        setCardTargetsRaw("");
                      }}
                    >
                      Clear path
                    </button>
                  </div>
                </div>
                <p className="card-detail__hint">
                  {pendingPath.length > 0
                    ? `Path: ${pendingPath.join(" → ")}`
                    : "Click hexes to build a contiguous path."}
                </p>
              </div>
            );
          case "choice":
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target choice</span>
                  <div className="card-detail__row-actions">
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => {
                        setBoardPickModeSafe("none");
                        setCardTargetsObject({ choice: "capital" });
                      }}
                    >
                      Capital
                    </button>
                    <button
                      type="button"
                      className={`btn btn-tertiary ${
                        boardPickMode === "cardChoice" ? "is-active" : ""
                      }`}
                      onClick={() =>
                        setBoardPickModeSafe(
                          boardPickMode === "cardChoice" ? "none" : "cardChoice"
                        )
                      }
                    >
                      Occupied hex
                    </button>
                  </div>
                </div>
                <p className="card-detail__hint">
                  Pick capital immediately or select an occupied hex on the board.
                </p>
              </div>
            );
          case "champion": {
            const rawOwner = selectedCardDef.targetSpec.owner;
            const owner =
              rawOwner === "self" || rawOwner === "enemy" || rawOwner === "any"
                ? rawOwner
                : "self";
            const ownerLabel =
              owner === "self" ? "Friendly" : owner === "enemy" ? "Enemy" : "Any";
            const eligibleChampions =
              !localPlayer || owner === "any"
                ? championUnits
                : owner === "self"
                  ? championUnits.filter((unit) => unit.ownerId === localPlayer.id)
                  : championUnits.filter((unit) => unit.ownerId !== localPlayer.id);
            const maxDistance =
              typeof selectedCardDef.targetSpec.maxDistance === "number"
                ? selectedCardDef.targetSpec.maxDistance
                : null;
            const requiresFriendlyChampion =
              selectedCardDef.targetSpec.requiresFriendlyChampion === true;
            const rangeHint =
              maxDistance !== null
                ? `Range: within ${maxDistance} hex${
                    maxDistance === 1 ? "" : "es"
                  }${requiresFriendlyChampion ? " of a friendly champion." : "."}`
                : requiresFriendlyChampion
                  ? "Requires a friendly champion near the target."
                  : null;
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target {ownerLabel.toLowerCase()} champion</span>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => {
                      setBoardPickModeSafe("none");
                      setCardTargetsRaw("");
                    }}
                  >
                    Clear
                  </button>
                </div>
                {eligibleChampions.length > 0 ? (
                  <div className="card-detail__options">
                    {eligibleChampions.map((unit) => {
                      const isSelected = selectedChampionId === unit.id;
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          className={`btn btn-tertiary ${isSelected ? "is-active" : ""}`}
                          title={unit.id}
                          onClick={() => {
                            setBoardPickModeSafe("none");
                            setCardTargetsObject({ unitId: unit.id });
                          }}
                        >
                          {unit.name} · {unit.ownerName} · {unit.hex} · {unit.hp}/
                          {unit.maxHp}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="card-detail__hint">No eligible champions on the board.</p>
                )}
                {rangeHint ? <p className="card-detail__hint">{rangeHint}</p> : null}
              </div>
            );
          }
          default:
            return (
              <p className="card-detail__hint">
                Target kind: {cardTargetKind}. Use targets JSON for now.
              </p>
            );
        }
      })()
    : null;

  return (
    <section className="game-screen">
      <header className="game-screen__header">
        <div>
          <p className="eyebrow">Bridgefront</p>
          <h1>
            Room {roomId} · Round {view.public.round} · {phaseLabel}
          </h1>
          <p className="subhead">Live room state from the PartyKit server.</p>
        </div>
        <div className="game-screen__meta">
          <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
          <span className="status-pill">Players: {view.public.players.length}</span>
          {view.public.winnerPlayerId ? (
            <span className="status-pill status-pill--winner">
              Winner: {view.public.winnerPlayerId}
            </span>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onLeave}>
            Leave Room
          </button>
        </div>
      </header>

      <div className="game-screen__layout">
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <h2>Board</h2>
            <p className="muted">Shared board state.</p>
            <div className="legend legend--compact">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
            <div className="board-tools">
              <span className="board-tools__hint">Drag to pan · Scroll to zoom</span>
              <div className="board-tools__meta">
                <span className="chip">
                  {selectedHexKey ? `Selected ${selectedHexKey}` : "No hex selected"}
                </span>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={() => setResetViewToken((value) => value + 1)}
                >
                  Reset view
                </button>
              </div>
            </div>
            <BoardView
              hexes={hexRender}
              board={view.public.board}
              showCoords={false}
              showTags
              showMineValues={false}
              className="board-svg board-svg--game"
              enablePanZoom
              resetViewToken={resetViewToken}
              selectedHexKey={selectedHexKey}
              highlightHexKeys={highlightHexKeys}
              onHexClick={handleBoardHexClick}
            />
          </div>
        </section>

        <aside className="panel game-sidebar">
          <h2>Player Panel</h2>

          <div className="sidebar-section">
            <h3>Resources</h3>
            <div className="resource-row">
              <span>Gold</span>
              <strong>{localPlayer?.resources.gold ?? 0}</strong>
            </div>
            <div className="resource-row">
              <span>Mana</span>
              <strong>{localPlayer?.resources.mana ?? 0}</strong>
            </div>
            <div className="resource-row">
              <span>Lead</span>
              <strong>{leadPlayer ? leadPlayer.name : "—"}</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Hand</h3>
            {!view.private ? (
              <div className="hand-empty">Spectators do not have a hand.</div>
            ) : handCount === 0 ? (
              <div className="hand-empty">No cards yet.</div>
            ) : (
              <>
                <div className="hand-meta">{handCount} cards in hand</div>
                <ul className="card-list">
                  {handCards.map((card) => {
                    const def = CARD_DEFS_BY_ID.get(card.defId);
                    const label = def?.name ?? card.defId;
                    const isSelected = card.id === cardInstanceId;
                    return (
                      <li key={card.id}>
                        <button
                          type="button"
                          className={`card-tag card-tag--clickable ${
                            isSelected ? "is-selected" : ""
                          }`}
                          title={card.defId}
                          onClick={() => {
                            setCardInstanceId(card.id);
                            setCardTargetsRaw("");
                            setBoardPickModeSafe("none");
                          }}
                        >
                          {label} · {card.id}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {selectedCardDef ? (
                  <div className="card-detail">
                    <div className="card-detail__header">
                      <strong>{selectedCardDef.name}</strong>
                      {cardCostLabel ? (
                        <span className="card-detail__meta">Cost {cardCostLabel}</span>
                      ) : null}
                      <span className="card-detail__meta">
                        Init {selectedCardDef.initiative}
                      </span>
                    </div>
                    <p className="card-detail__rules">{selectedCardDef.rulesText}</p>
                    {cardTargetPanel}
                  </div>
                ) : null}
              </>
            )}
            {deckCounts ? (
              <div className="deck-counts">
                <div className="resource-row">
                  <span>Draw</span>
                  <strong>{deckCounts.drawPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Discard</span>
                  <strong>{deckCounts.discardPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Scrapped</span>
                  <strong>{deckCounts.scrapped}</strong>
                </div>
              </div>
            ) : null}
            {view.private?.vp ? (
              <div className="hand-empty">
                VP: {view.private.vp.total} (control {view.private.vp.control})
              </div>
            ) : null}
          </div>

          <div className="sidebar-section">
            <h3>Actions</h3>
            <ActionPanel
              phase={view.public.phase}
              player={localPlayer ?? null}
              players={view.public.players}
              actionStep={view.public.actionStep}
              status={status}
              edgeKey={edgeKey}
              marchFrom={marchFrom}
              marchTo={marchTo}
              cardInstanceId={cardInstanceId}
              cardTargetsRaw={cardTargetsRaw}
              boardPickMode={boardPickMode}
              onSubmit={onSubmitAction}
              onEdgeKeyChange={setEdgeKey}
              onMarchFromChange={setMarchFrom}
              onMarchToChange={setMarchTo}
              onCardInstanceIdChange={setCardInstanceId}
              onCardTargetsRawChange={setCardTargetsRaw}
              onBoardPickModeChange={setBoardPickModeSafe}
            />
          </div>

          <MarketPanel
            market={view.public.market}
            players={view.public.players}
            phase={view.public.phase}
            player={localPlayer ?? null}
            status={status}
            onSubmitBid={onSubmitMarketBid}
          />

          <CollectionPanel
            phase={view.public.phase}
            player={localPlayer ?? null}
            players={view.public.players}
            status={status}
            handCards={handCards}
            collectionPublic={view.public.collection}
            collectionPrivate={view.private?.collection ?? null}
            onSubmitChoices={onSubmitCollectionChoices}
          />

          <div className="sidebar-section">
            <h3>Log</h3>
            {view.public.logs.length === 0 ? (
              <div className="log-empty">Waiting for events.</div>
            ) : (
              <ul className="log-list">
                {view.public.logs.map((entry, index) => (
                  <li key={`${entry.type}-${index}`}>{formatGameEvent(entry, playerNames)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Players</h3>
            <ul className="player-list">
              {view.public.players.map((player) => (
                <li key={player.id} className="player-row">
                  <div>
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">Seat {player.seatIndex}</span>
                  </div>
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "On" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
};
