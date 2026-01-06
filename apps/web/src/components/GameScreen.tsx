import { useMemo, useState, useEffect, useRef, type CSSProperties } from "react";

import {
  CARD_DEFS,
  getBridgeKey,
  hasBridge,
  hasEnemyUnits,
  isOccupiedByPlayer,
  type ActionDeclaration,
  type Bid,
  type CollectionChoice,
  type GameView,
  wouldExceedTwoPlayers
} from "@bridgefront/engine";
import { areAdjacent, axialDistance, neighborHexKeys, parseHexKey } from "@bridgefront/shared";

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

type MarketWinnerHighlight = {
  cardId: string;
  cardIndex: number | null;
  playerName: string;
  kind: "buy" | "pass";
  amount: number | null;
  passPot: number | null;
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

const formatPhaseLabel = (phase: string) => {
  const trimmed = phase.replace("round.", "");
  const spaced = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2").replace(".", " ");
  return spaced.replace(/^\w/, (value) => value.toUpperCase());
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
  const playerColorIndexById = useMemo(() => {
    const mapping: Record<string, number> = {};
    for (const player of view.public.players) {
      mapping[player.id] = player.seatIndex;
    }
    return mapping;
  }, [view.public.players]);
  const localPlayer = view.public.players.find((player) => player.id === playerId);
  const localPlayerId = localPlayer?.id ?? null;
  const handCards = view.private?.handCards ?? [];
  const handCount = view.private ? handCards.length : 0;
  const deckCounts = view.private?.deckCounts ?? null;
  const phaseLabel = formatPhaseLabel(view.public.phase);
  const connectionLabel = status === "connected" ? "Live" : "Waiting";
  const connectionClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const actionStep = view.public.actionStep;
  const actionEligible = new Set(actionStep?.eligiblePlayerIds ?? []);
  const actionWaiting = new Set(actionStep?.waitingForPlayerIds ?? []);
  const [edgeKey, setEdgeKey] = useState("");
  const [marchFrom, setMarchFrom] = useState("");
  const [marchTo, setMarchTo] = useState("");
  const [cardInstanceId, setCardInstanceId] = useState("");
  const [cardTargetsRaw, setCardTargetsRaw] = useState("");
  const [boardPickMode, setBoardPickMode] = useState<BoardPickMode>("none");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isMarketOverlayOpen, setIsMarketOverlayOpen] = useState(false);
  const [marketWinner, setMarketWinner] = useState<MarketWinnerHighlight | null>(null);
  const [selectedHexKey, setSelectedHexKey] = useState<string | null>(null);
  const [pendingEdgeStart, setPendingEdgeStart] = useState<string | null>(null);
  const [pendingStackFrom, setPendingStackFrom] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string[]>([]);
  const [resetViewToken, setResetViewToken] = useState(0);
  const lastMarketEventIndex = useRef(-1);
  const hasMarketLogBaseline = useRef(false);
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
  const getActionStatusTooltip = (playerId: string): string => {
    if (!actionStep) {
      return `Action: not active (${phaseLabel}).`;
    }
    if (!actionEligible.has(playerId)) {
      return "Action: not eligible this step.";
    }
    return actionWaiting.has(playerId)
      ? "Action: waiting for declaration."
      : "Action: declaration submitted.";
  };
  const getActionStatusBadge = (
    playerId: string
  ): { label: string; className: string } | null => {
    if (!actionStep) {
      return null;
    }
    if (!actionEligible.has(playerId)) {
      return { label: "Idle", className: "" };
    }
    if (actionWaiting.has(playerId)) {
      return { label: "Waiting", className: "status-pill--waiting" };
    }
    return { label: "Submitted", className: "status-pill--ready" };
  };
  const isActionPhase = view.public.phase === "round.action";
  const isMarketPhase = view.public.phase === "round.market";
  const isCollectionPhase = view.public.phase === "round.collection";
  const isInteractivePhase = isActionPhase || isMarketPhase || isCollectionPhase;
  const showPhaseFocus = isCollectionPhase;
  const showHandPanel = Boolean(view.private) && isActionPhase;
  const canDeclareAction =
    status === "connected" && Boolean(localPlayer) && isActionPhase && !localPlayer?.doneThisRound;
  const isBoardTargeting = boardPickMode !== "none";
  const availableMana = localPlayer?.resources.mana ?? 0;
  const availableGold = localPlayer?.resources.gold ?? 0;
  const toggleHeaderCollapsed = () => {
    setIsHeaderCollapsed((value) => !value);
  };
  const playerSwatchStyle = (seatIndex: number): CSSProperties => {
    const index = Math.max(0, Math.min(5, Math.floor(seatIndex)));
    return {
      "--player-color": `var(--player-color-${index})`
    } as CSSProperties;
  };

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

  useEffect(() => {
    if (!isActionPhase) {
      setBoardPickMode("none");
      setPendingEdgeStart(null);
      setPendingStackFrom(null);
      setPendingPath([]);
      setCardInstanceId("");
      setCardTargetsRaw("");
    }
  }, [isActionPhase]);

  useEffect(() => {
    if (isMarketPhase) {
      setIsMarketOverlayOpen(true);
    } else {
      setIsMarketOverlayOpen(false);
    }
  }, [isMarketPhase]);

  useEffect(() => {
    const logs = view.public.logs;
    if (!hasMarketLogBaseline.current) {
      hasMarketLogBaseline.current = true;
      if (logs.length > 0) {
        lastMarketEventIndex.current = logs.length - 1;
        return;
      }
    }
    if (logs.length === 0) {
      return;
    }
    if (logs.length - 1 < lastMarketEventIndex.current) {
      lastMarketEventIndex.current = logs.length - 1;
      return;
    }
    let foundIndex = -1;
    for (let i = logs.length - 1; i > lastMarketEventIndex.current; i -= 1) {
      const event = logs[i];
      if (event.type === "market.buy" || event.type === "market.pass") {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex < 0) {
      return;
    }
    const event = logs[foundIndex];
    const payload = event.payload ?? {};
    const cardId = typeof payload.cardId === "string" ? payload.cardId : "unknown";
    const cardIndex = typeof payload.cardIndex === "number" ? payload.cardIndex : null;
    const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
    const playerName = playerId ? playerNames.get(playerId) ?? playerId : "Unknown";
    const amount = typeof payload.amount === "number" ? payload.amount : null;
    const passPot = typeof payload.passPot === "number" ? payload.passPot : null;
    lastMarketEventIndex.current = foundIndex;
    setMarketWinner({
      cardId,
      cardIndex,
      playerName,
      kind: event.type === "market.buy" ? "buy" : "pass",
      amount,
      passPot
    });
  }, [view.public.logs, playerNames]);

  useEffect(() => {
    if (!marketWinner) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setMarketWinner(null);
    }, 3500);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [marketWinner]);

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
    const isPickable =
      boardPickMode === "none" ||
      validHexKeys.includes(hexKey) ||
      startHexKeys.includes(hexKey);
    if (!isPickable) {
      return;
    }
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
    if (boardPickMode === "cardHex") {
      setCardTargetsObject({ hexKey });
    }
  };

  const handleBoardEdgeClick = (edgeKey: string) => {
    if (boardPickMode === "bridgeEdge") {
      setEdgeKey(edgeKey);
      setPendingEdgeStart(null);
      return;
    }
    if (boardPickMode === "cardEdge") {
      setCardTargetsObject({ edgeKey });
      setPendingEdgeStart(null);
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

  const { validHexKeys, previewEdgeKeys, startHexKeys } = useMemo(() => {
    if (!localPlayerId) {
      return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
    }

    const validTargets = new Set<string>();
    const previewEdges = new Set<string>();
    const startTargets = new Set<string>();
    const board = view.public.board;
    const boardHexes = board.hexes;
    const hexKeys = Object.keys(boardHexes);

    const hasHex = (key: string) => Boolean(boardHexes[key]);
    const isOccupied = (key: string) => {
      const hex = boardHexes[key];
      return hex ? isOccupiedByPlayer(hex, localPlayerId) : false;
    };
    const hasEnemy = (key: string) => {
      const hex = boardHexes[key];
      return hex ? hasEnemyUnits(hex, localPlayerId) : false;
    };
    const hasAnyOccupants = (key: string) => {
      const hex = boardHexes[key];
      if (!hex) {
        return false;
      }
      return Object.values(hex.occupants).some((unitIds) => unitIds.length > 0);
    };
    const canEnter = (key: string) => {
      const hex = boardHexes[key];
      return hex ? !wouldExceedTwoPlayers(hex, localPlayerId) : false;
    };
    const neighbors = (key: string) =>
      neighborHexKeys(key).filter((neighbor) => hasHex(neighbor));

    const hasAnyEdgeCandidate = (start: string, requiresOccupiedEndpoint: boolean) => {
      const startOccupied = isOccupied(start);
      for (const neighbor of neighbors(start)) {
        if (hasBridge(board, start, neighbor)) {
          continue;
        }
        if (requiresOccupiedEndpoint && !startOccupied && !isOccupied(neighbor)) {
          continue;
        }
        return true;
      }
      return false;
    };

    const addEdgeCandidatesFrom = (
      start: string,
      requiresOccupiedEndpoint: boolean,
      markNeighborTargets = true
    ) => {
      const startOccupied = isOccupied(start);
      for (const neighbor of neighbors(start)) {
        if (hasBridge(board, start, neighbor)) {
          continue;
        }
        if (requiresOccupiedEndpoint && !startOccupied && !isOccupied(neighbor)) {
          continue;
        }
        previewEdges.add(getBridgeKey(start, neighbor));
        if (markNeighborTargets) {
          validTargets.add(neighbor);
        }
      }
    };

    if (boardPickMode === "marchFrom") {
      for (const key of hexKeys) {
        if (!isOccupied(key)) {
          continue;
        }
        const canMarchFrom = neighbors(key).some(
          (neighbor) => hasBridge(board, key, neighbor) && canEnter(neighbor)
        );
        if (canMarchFrom) {
          validTargets.add(key);
        }
      }
    }

    if (boardPickMode === "marchTo") {
      if (!marchFrom || !hasHex(marchFrom) || !isOccupied(marchFrom)) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      for (const neighbor of neighbors(marchFrom)) {
        if (!hasBridge(board, marchFrom, neighbor)) {
          continue;
        }
        if (!canEnter(neighbor)) {
          continue;
        }
        validTargets.add(neighbor);
      }
    }

    if (boardPickMode === "bridgeEdge") {
      const requiresOccupiedEndpoint = true;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!hasAnyEdgeCandidate(key, requiresOccupiedEndpoint)) {
          continue;
        }
        startCandidates.add(key);
        startTargets.add(key);
      }
      if (pendingEdgeStart && hasHex(pendingEdgeStart)) {
        addEdgeCandidatesFrom(pendingEdgeStart, requiresOccupiedEndpoint);
      } else {
        for (const key of startCandidates) {
          validTargets.add(key);
          addEdgeCandidatesFrom(key, requiresOccupiedEndpoint, false);
        }
      }
    }

    if (boardPickMode === "cardEdge") {
      if (!selectedCardDef || cardTargetKind !== "edge") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const edgeSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const allowAnywhere = edgeSpec.anywhere === true;
      const requiresOccupiedEndpoint =
        allowAnywhere || edgeSpec.requiresOccupiedEndpoint === false ? false : true;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!hasAnyEdgeCandidate(key, requiresOccupiedEndpoint)) {
          continue;
        }
        startCandidates.add(key);
        startTargets.add(key);
      }
      if (pendingEdgeStart && hasHex(pendingEdgeStart)) {
        addEdgeCandidatesFrom(pendingEdgeStart, requiresOccupiedEndpoint);
      } else {
        for (const key of startCandidates) {
          validTargets.add(key);
          addEdgeCandidatesFrom(key, requiresOccupiedEndpoint, false);
        }
      }
    }

    if (boardPickMode === "cardStack") {
      if (!selectedCardDef || cardTargetKind !== "stack") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const requiresBridge = targetSpec.requiresBridge !== false;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!isOccupied(key)) {
          continue;
        }
        const hasDestination = neighbors(key).some((neighbor) => {
          if (requiresBridge && !hasBridge(board, key, neighbor)) {
            return false;
          }
          return canEnter(neighbor);
        });
        if (hasDestination) {
          startCandidates.add(key);
          startTargets.add(key);
        }
      }
      const fromKey = pendingStackFrom;
      if (fromKey && hasHex(fromKey)) {
        for (const neighbor of neighbors(fromKey)) {
          if (requiresBridge && !hasBridge(board, fromKey, neighbor)) {
            continue;
          }
          if (!canEnter(neighbor)) {
            continue;
          }
          validTargets.add(neighbor);
        }
      } else {
        for (const key of startCandidates) {
          validTargets.add(key);
        }
      }
    }

    if (boardPickMode === "cardPath") {
      if (!selectedCardDef || cardTargetKind !== "path") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const requiresBridge = targetSpec.requiresBridge !== false;
      const maxDistance =
        typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : null;
      const canStart = maxDistance === null || maxDistance >= 1;
      const startCandidates = new Set<string>();
      if (canStart) {
        for (const key of hexKeys) {
          if (!isOccupied(key)) {
            continue;
          }
          const hasStep = neighbors(key).some((neighbor) => {
            if (requiresBridge && !hasBridge(board, key, neighbor)) {
              return false;
            }
            return canEnter(neighbor);
          });
          if (hasStep) {
            startCandidates.add(key);
            startTargets.add(key);
          }
        }
      }
      if (pendingPath.length === 0) {
        if (!canStart) {
          return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
        }
        for (const key of startCandidates) {
          validTargets.add(key);
        }
      } else {
        const stepsSoFar = pendingPath.length - 1;
        if (maxDistance !== null && stepsSoFar >= maxDistance) {
          return {
            validHexKeys: [],
            previewEdgeKeys: [],
            startHexKeys: Array.from(startTargets)
          };
        }
        const last = pendingPath[pendingPath.length - 1];
        if (!last || !hasHex(last)) {
          return {
            validHexKeys: [],
            previewEdgeKeys: [],
            startHexKeys: Array.from(startTargets)
          };
        }
        if (pendingPath.length > 1 && hasEnemy(last)) {
          return {
            validHexKeys: [],
            previewEdgeKeys: [],
            startHexKeys: Array.from(startTargets)
          };
        }
        for (const neighbor of neighbors(last)) {
          if (requiresBridge && !hasBridge(board, last, neighbor)) {
            continue;
          }
          if (!canEnter(neighbor)) {
            continue;
          }
          validTargets.add(neighbor);
        }
      }
    }

    if (boardPickMode === "cardChoice") {
      if (!selectedCardDef || cardTargetKind !== "choice") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const options = Array.isArray(targetSpec.options) ? targetSpec.options : [];
      const occupiedOption = options.find(
        (option) =>
          option && typeof option === "object" && (option as Record<string, unknown>).kind === "occupiedHex"
      ) as Record<string, unknown> | undefined;
      if (!occupiedOption) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const owner = typeof occupiedOption.owner === "string" ? occupiedOption.owner : "self";
      for (const key of hexKeys) {
        if (!canEnter(key)) {
          continue;
        }
        if (owner === "any") {
          const hex = boardHexes[key];
          const hasOccupants = hex
            ? Object.values(hex.occupants).some((unitIds) => unitIds.length > 0)
            : false;
          if (hasOccupants) {
            validTargets.add(key);
          }
        } else if (owner === "enemy") {
          if (hasEnemy(key)) {
            validTargets.add(key);
          }
        } else if (isOccupied(key)) {
          validTargets.add(key);
        }
      }
    }

    if (boardPickMode === "cardHex") {
      if (!selectedCardDef || cardTargetKind !== "hex") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
      if (owner !== "self" && owner !== "enemy" && owner !== "any") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const requiresOccupied = targetSpec.occupied === true;
      const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
      const allowCapital = targetSpec.allowCapital !== false;
      const maxDistanceFromChampion =
        typeof targetSpec.maxDistanceFromFriendlyChampion === "number"
          ? targetSpec.maxDistanceFromFriendlyChampion
          : null;

      const hasFriendlyChampionWithinRange = (hexKey: string) => {
        if (maxDistanceFromChampion === null) {
          return true;
        }
        for (const unit of Object.values(board.units)) {
          if (unit.kind !== "champion") {
            continue;
          }
          if (unit.ownerPlayerId !== localPlayerId) {
            continue;
          }
          try {
            if (
              axialDistance(parseHexKey(unit.hex), parseHexKey(hexKey)) <=
              maxDistanceFromChampion
            ) {
              return true;
            }
          } catch {
            continue;
          }
        }
        return false;
      };

      for (const key of hexKeys) {
        const hex = boardHexes[key];
        if (!hex) {
          continue;
        }
        if (owner === "self" && !isOccupiedByPlayer(hex, localPlayerId)) {
          continue;
        }
        if (owner === "enemy" && !hasEnemyUnits(hex, localPlayerId)) {
          continue;
        }
        if (requiresOccupied && !hasAnyOccupants(key)) {
          continue;
        }
        if (tile && hex.tile !== tile) {
          continue;
        }
        if (!allowCapital && hex.tile === "capital") {
          continue;
        }
        if (!hasFriendlyChampionWithinRange(key)) {
          continue;
        }
        validTargets.add(key);
      }
    }

    return {
      validHexKeys: Array.from(validTargets),
      previewEdgeKeys: Array.from(previewEdges),
      startHexKeys: Array.from(startTargets)
    };
  }, [
    localPlayerId,
    view.public.board,
    boardPickMode,
    marchFrom,
    pendingEdgeStart,
    pendingStackFrom,
    pendingPath,
    selectedCardDef,
    cardTargetKind
  ]);

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
                    ? `Pick adjacent hex to ${pendingEdgeStart} or click a highlighted edge.`
                    : "Click a highlighted edge or pick two adjacent hexes."}
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
          case "hex": {
            const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
            const owner =
              typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
            const ownerLabel =
              owner === "self" ? "friendly" : owner === "enemy" ? "enemy" : "any";
            const requiresOccupied = targetSpec.occupied === true;
            const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
            const allowCapital = targetSpec.allowCapital !== false;
            const maxDistanceFromChampion =
              typeof targetSpec.maxDistanceFromFriendlyChampion === "number"
                ? targetSpec.maxDistanceFromFriendlyChampion
                : null;
            const requirementBits: string[] = [];
            if (requiresOccupied) {
              requirementBits.push("occupied");
            }
            if (tile) {
              requirementBits.push(`${tile} tile`);
            }
            if (!allowCapital) {
              requirementBits.push("non-capital");
            }
            if (owner !== "any") {
              requirementBits.push(`${ownerLabel} controlled`);
            }
            if (maxDistanceFromChampion !== null) {
              requirementBits.push(`within ${maxDistanceFromChampion} of friendly champion`);
            }
            const requirementLabel =
              requirementBits.length > 0
                ? `Eligible hexes: ${requirementBits.join(", ")}.`
                : "Pick a hex on the board.";
            const selectedHex = getTargetString(targetRecord, "hexKey");
            return (
              <div className="card-detail__targets">
                <div className="card-detail__row">
                  <span>Target hex</span>
                  <div className="card-detail__row-actions">
                    <button
                      type="button"
                      className={`btn btn-tertiary ${
                        boardPickMode === "cardHex" ? "is-active" : ""
                      }`}
                      onClick={() =>
                        setBoardPickModeSafe(
                          boardPickMode === "cardHex" ? "none" : "cardHex"
                        )
                      }
                    >
                      Pick on board
                    </button>
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
                </div>
                {selectedHex ? (
                  <p className="card-detail__hint">Selected: {selectedHex}.</p>
                ) : null}
                <p className="card-detail__hint">{requirementLabel}</p>
              </div>
            );
          }
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
                Target kind: {cardTargetKind}. Targeting UI is not available yet.
              </p>
            );
        }
      })()
    : null;

  const handPanel = showHandPanel ? (
    <section className="panel game-hand">
      <div className="game-hand__header">
        <h2>Hand</h2>
        <span className="hand-meta">{handCount} cards</span>
      </div>
      {handCount === 0 ? (
        <div className="hand-empty">No cards yet.</div>
      ) : (
        <>
          <div className="hand-row">
            {handCards.map((card, index) => {
              const def = CARD_DEFS_BY_ID.get(card.defId);
              const label = def?.name ?? card.defId;
              const isSelected = card.id === cardInstanceId;
              const manaCost = def?.cost.mana ?? 0;
              const goldCost = def?.cost.gold ?? 0;
              const canAfford = availableMana >= manaCost && availableGold >= goldCost;
              const isPlayable = canDeclareAction && canAfford;
              const totalCards = handCards.length;
              const centerIndex = (totalCards - 1) / 2;
              const offset = index - centerIndex;
              const fanRotation = totalCards > 1 ? offset * 4 : 0;
              const fanLift = Math.abs(offset) * 4;
              const depth = totalCards - Math.abs(offset);
              const costLabel = def ? `M${manaCost}${goldCost ? ` G${goldCost}` : ""}` : "M-";
              const typeLabel = def?.type ?? "Card";
              const initiativeLabel = def ? `Init ${def.initiative}` : "Init -";
              const handStyle = {
                zIndex: 10 + depth,
                "--hand-rotate": `${fanRotation}deg`,
                "--hand-lift": `${fanLift}px`
              } as CSSProperties;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-card ${isSelected ? "is-selected" : ""} ${
                    isPlayable ? "" : "is-disabled"
                  }`}
                  style={handStyle}
                  aria-pressed={isSelected}
                  aria-disabled={!isPlayable}
                  title={`${label} (${card.id})`}
                  onClick={() => {
                    setCardInstanceId(card.id);
                    setCardTargetsRaw("");
                    setBoardPickModeSafe("none");
                  }}
                >
                  <div className="hand-card__face">
                    <div className="hand-card__top">
                      <span className="hand-card__name">{label}</span>
                      <span className="hand-card__cost">{costLabel}</span>
                    </div>
                    <div className="hand-card__body">
                      <span className="hand-card__type">{typeLabel}</span>
                      <span className="hand-card__meta">{initiativeLabel}</span>
                    </div>
                    <div className="hand-card__footer">
                      <span className="hand-card__id">{card.id}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedCardDef ? (
            <div className="card-detail">
              <div className="card-detail__header">
                <strong>{selectedCardDef.name}</strong>
                {cardCostLabel ? (
                  <span className="card-detail__meta">Cost {cardCostLabel}</span>
                ) : null}
                <span className="card-detail__meta">Init {selectedCardDef.initiative}</span>
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
    </section>
  ) : null;

  const phaseFocusPanel = showPhaseFocus ? (
    <div className="game-screen__focus">
      {isCollectionPhase ? (
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
      ) : null}
    </div>
  ) : null;

  const showMarketOverlay = isMarketPhase && isMarketOverlayOpen;
  const showMarketOverlayToggle = isMarketPhase && !isMarketOverlayOpen;
  const marketOverlay = isMarketPhase ? (
    <>
      {showMarketOverlay ? (
        <div className="market-overlay" role="dialog" aria-modal="true">
          <div className="market-overlay__scrim" />
          <div className="market-overlay__panel">
            <MarketPanel
              layout="overlay"
              market={view.public.market}
              players={view.public.players}
              phase={view.public.phase}
              player={localPlayer ?? null}
              status={status}
              onSubmitBid={onSubmitMarketBid}
              winnerHighlight={marketWinner}
              onClose={() => setIsMarketOverlayOpen(false)}
            />
          </div>
        </div>
      ) : null}
      {showMarketOverlayToggle ? (
        <button
          type="button"
          className="btn btn-primary market-overlay__toggle"
          onClick={() => setIsMarketOverlayOpen(true)}
        >
          Show Market
        </button>
      ) : null}
    </>
  ) : null;

  const logSection = (
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
  );

  const playersSection = (
    <div className="sidebar-section">
      <h3>Players</h3>
      <ul className="player-list">
        {view.public.players.map((player) => {
          const actionStatus = getActionStatusBadge(player.id);
          const actionStatusClass = actionStatus
            ? ["status-pill", actionStatus.className].filter(Boolean).join(" ")
            : "";
          return (
            <li
              key={player.id}
              className="player-row"
              title={getActionStatusTooltip(player.id)}
            >
              <div className="player-row__info">
                <span
                  className="player-swatch"
                  style={playerSwatchStyle(player.seatIndex)}
                />
                <div>
                  <span className="player-name">{player.name}</span>
                  <span className="player-meta">Seat {player.seatIndex}</span>
                </div>
              </div>
              <div className="seat__status">
                <span
                  className={`status-pill ${
                    player.connected ? "status-pill--ready" : "status-pill--waiting"
                  }`}
                >
                  {player.connected ? "On" : "Off"}
                </span>
                {actionStatus ? (
                  <span className={actionStatusClass}>{actionStatus.label}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const auxPanels = showPhaseFocus ? (
    <div className="game-screen__aux">
      {logSection}
      {playersSection}
    </div>
  ) : null;

  return (
    <section className="game-screen">
      <header className={`game-screen__header ${isHeaderCollapsed ? "is-collapsed" : ""}`}>
        {isHeaderCollapsed ? (
          <div className="game-screen__collapsed-bar">
            <div className="game-screen__collapsed-meta">
              <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
              <span className="status-pill status-pill--phase">Phase: {phaseLabel}</span>
              <span className="status-pill">Round {view.public.round}</span>
            </div>
            <div className="game-screen__collapsed-actions">
              <button type="button" className="btn btn-tertiary" onClick={toggleHeaderCollapsed}>
                Show HUD
              </button>
              <button type="button" className="btn btn-secondary" onClick={onLeave}>
                Leave Room
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="eyebrow">Bridgefront</p>
              <h1>Room {roomId}</h1>
              <p className="subhead">
                Round {view.public.round} · Phase {phaseLabel}
              </p>
            </div>
            <div className="game-screen__meta">
              <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
              <span className="status-pill status-pill--phase">Phase: {phaseLabel}</span>
              <span className="status-pill">Round {view.public.round}</span>
              <span className="status-pill">Players: {view.public.players.length}</span>
              {view.public.winnerPlayerId ? (
                <span className="status-pill status-pill--winner">
                  Winner: {view.public.winnerPlayerId}
                </span>
              ) : null}
              <button type="button" className="btn btn-tertiary" onClick={toggleHeaderCollapsed}>
                Hide HUD
              </button>
              <button type="button" className="btn btn-secondary" onClick={onLeave}>
                Leave Room
              </button>
            </div>
          </>
        )}
      </header>

      {marketOverlay}

      {phaseFocusPanel}

      <div
        className={`game-screen__layout ${showPhaseFocus ? "game-screen__layout--focus" : ""}`}
      >
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
            <div className={`board-tools ${isBoardTargeting ? "is-targeting" : ""}`}>
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
              playerIndexById={playerColorIndexById}
              showCoords={false}
              showTags
              showMineValues={false}
              className="board-svg board-svg--game"
              enablePanZoom
              resetViewToken={resetViewToken}
              selectedHexKey={selectedHexKey}
              highlightHexKeys={highlightHexKeys}
              validHexKeys={validHexKeys}
              previewEdgeKeys={previewEdgeKeys}
              isTargeting={isBoardTargeting}
              onHexClick={handleBoardHexClick}
              onEdgeClick={handleBoardEdgeClick}
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
            {view.private?.vp ? (
              <div className="resource-row">
                <span>VP</span>
                <strong>{view.private.vp.total}</strong>
              </div>
            ) : null}
          </div>

          {isActionPhase ? (
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
          ) : null}

          {!isInteractivePhase ? (
            <div className="sidebar-section">
              <h3>Phase</h3>
              <p className="muted">Resolving {phaseLabel}. Waiting on the server.</p>
            </div>
          ) : null}
          {!showPhaseFocus ? logSection : null}
          {!showPhaseFocus ? playersSection : null}
        </aside>
      </div>
      {auxPanels}
      {handPanel}
    </section>
  );
};
