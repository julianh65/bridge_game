import { useMemo, useState, useEffect, useRef } from "react";

import {
  CARD_DEFS,
  getBridgeKey,
  hasBridge,
  hasEnemyUnits,
  isOccupiedByPlayer,
  type ActionDeclaration,
  type Bid,
  type CardDef,
  type CollectionChoice,
  type GameView,
  wouldExceedTwoPlayers
} from "@bridgefront/engine";
import { areAdjacent, axialDistance, neighborHexKeys, parseHexKey } from "@bridgefront/shared";

import { type BasicActionIntent, type BoardPickMode } from "./ActionPanel";
import { BoardView } from "./BoardView";
import { CollectionPanel } from "./CollectionPanel";
import { GameScreenHandPanel } from "./GameScreenHandPanel";
import { GameScreenHeader } from "./GameScreenHeader";
import { GameScreenSidebar } from "./GameScreenSidebar";
import { MarketPanel } from "./MarketPanel";
import { VictoryScreen } from "./VictoryScreen";
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

const getDefaultCardPickMode = (cardDef: CardDef | null): BoardPickMode => {
  if (!cardDef) {
    return "none";
  }
  switch (cardDef.targetSpec.kind) {
    case "edge":
      return "cardEdge";
    case "stack":
      return "cardStack";
    case "path":
      return "cardPath";
    case "hex":
      return "cardHex";
    case "choice":
      return "cardChoice";
    default:
      return "none";
  }
};

type GameScreenProps = {
  view: GameView;
  playerId: string | null;
  roomId: string;
  status: RoomConnectionStatus;
  onSubmitAction: (declaration: ActionDeclaration) => void;
  onSubmitMarketBid: (bid: Bid) => void;
  onSubmitCollectionChoices: (choices: CollectionChoice[]) => void;
  onResetGame?: () => void;
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
  onResetGame,
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
  const hostPlayerId = useMemo(() => {
    const host =
      view.public.players.find((player) => player.seatIndex === 0) ??
      view.public.players[0] ??
      null;
    return host?.id ?? null;
  }, [view.public.players]);
  const isHost = Boolean(playerId && hostPlayerId === playerId);
  const localPlayer = view.public.players.find((player) => player.id === playerId);
  const localPlayerId = localPlayer?.id ?? null;
  const handCards = view.private?.handCards ?? [];
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
  const [phaseCue, setPhaseCue] = useState<{ label: string; round: number } | null>(null);
  const [phaseCueKey, setPhaseCueKey] = useState(0);
  const [isVictoryVisible, setIsVictoryVisible] = useState(() =>
    Boolean(view.public.winnerPlayerId)
  );
  const [selectedHexKey, setSelectedHexKey] = useState<string | null>(null);
  const [pendingEdgeStart, setPendingEdgeStart] = useState<string | null>(null);
  const [pendingStackFrom, setPendingStackFrom] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string[]>([]);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [isInfoDockOpen, setIsInfoDockOpen] = useState(false);
  const [isHandPanelOpen, setIsHandPanelOpen] = useState(true);
  const [basicActionIntent, setBasicActionIntent] = useState<BasicActionIntent>("none");
  const lastMarketEventIndex = useRef(-1);
  const hasMarketLogBaseline = useRef(false);
  const hasPhaseCueBaseline = useRef(false);
  const lastPhaseRef = useRef(view.public.phase);
  const lastRoundRef = useRef(view.public.round);
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
  const logCount = view.public.logs.length;
  const lastLogEntry = logCount > 0 ? view.public.logs[logCount - 1] : null;
  const lastLogLabel = lastLogEntry ? formatGameEvent(lastLogEntry, playerNames) : null;
  const isActionPhase = view.public.phase === "round.action";
  const isMarketPhase = view.public.phase === "round.market";
  const isCollectionPhase = view.public.phase === "round.collection";
  const isInteractivePhase = isActionPhase || isMarketPhase || isCollectionPhase;
  const showPhaseFocus = isCollectionPhase;
  const canShowHandPanel = Boolean(view.private) && isActionPhase;
  const showVictoryScreen = Boolean(view.public.winnerPlayerId && isVictoryVisible);
  const canDeclareAction =
    status === "connected" && Boolean(localPlayer) && isActionPhase && !localPlayer?.doneThisRound;
  const isBoardTargeting = boardPickMode !== "none";
  const isEdgePickMode = boardPickMode === "bridgeEdge" || boardPickMode === "cardEdge";
  const availableMana = localPlayer?.resources.mana ?? 0;
  const availableGold = localPlayer?.resources.gold ?? 0;
  const trimmedCardId = cardInstanceId.trim();
  const trimmedTargets = cardTargetsRaw.trim();
  let parsedTargets: Record<string, unknown> | null | undefined;
  let targetsError: string | null = null;
  if (trimmedTargets.length > 0) {
    try {
      const parsed = JSON.parse(trimmedTargets) as unknown;
      if (parsed === null || typeof parsed === "object") {
        parsedTargets = parsed as Record<string, unknown> | null;
      } else {
        targetsError = "Targets must be a JSON object or null.";
      }
    } catch {
      targetsError = "Targets JSON could not be parsed.";
    }
  }
  const canSubmitDone = canDeclareAction;
  const canSubmitAction = canSubmitDone && availableMana >= 1;
  const canReinforce = canSubmitAction && availableGold >= 1;
  const canBuildBridge = canSubmitAction && edgeKey.trim().length > 0;
  const canMarch =
    canSubmitAction && marchFrom.trim().length > 0 && marchTo.trim().length > 0;
  const canPlayCard = canSubmitAction && trimmedCardId.length > 0 && targetsError === null;
  const cardDeclaration: ActionDeclaration | null = canPlayCard
    ? parsedTargets !== undefined
      ? {
          kind: "card",
          cardInstanceId: trimmedCardId,
          targets: parsedTargets
        }
      : { kind: "card", cardInstanceId: trimmedCardId }
    : null;
  let primaryAction: ActionDeclaration | null = null;
  let primaryActionLabel = "Submit";
  if (cardDeclaration) {
    primaryAction = cardDeclaration;
    primaryActionLabel = "Play Card";
  } else if (basicActionIntent === "bridge" && canBuildBridge) {
    primaryAction = {
      kind: "basic",
      action: { kind: "buildBridge", edgeKey: edgeKey.trim() }
    };
    primaryActionLabel = "Build Bridge";
  } else if (basicActionIntent === "march" && canMarch) {
    primaryAction = {
      kind: "basic",
      action: { kind: "march", from: marchFrom.trim(), to: marchTo.trim() }
    };
    primaryActionLabel = "March";
  } else if (basicActionIntent === "reinforce" && canReinforce) {
    primaryAction = {
      kind: "basic",
      action: { kind: "capitalReinforce" }
    };
    primaryActionLabel = "Reinforce";
  }
  const toggleHeaderCollapsed = () => {
    setIsHeaderCollapsed((value) => !value);
  };
  const handleVictoryClose = () => {
    setIsVictoryVisible(false);
  };
  const toggleDock = () => {
    setIsInfoDockOpen((open) => !open);
  };

  useEffect(() => {
    if (cardInstanceId && !handCards.some((card) => card.id === cardInstanceId)) {
      setCardInstanceId("");
      setCardTargetsRaw("");
      setBoardPickMode("none");
      setPendingEdgeStart(null);
      setPendingStackFrom(null);
      setPendingPath([]);
    }
  }, [cardInstanceId, handCards]);

  const setBoardPickModeSafe = (mode: BoardPickMode) => {
    setBoardPickMode(mode);
    setPendingEdgeStart(null);
    setPendingStackFrom(null);
    setPendingPath([]);
    if (mode === "bridgeEdge") {
      setBasicActionIntent("bridge");
    } else if (mode === "marchFrom" || mode === "marchTo") {
      setBasicActionIntent("march");
    }
  };

  useEffect(() => {
    if (!isActionPhase) {
      setBoardPickMode("none");
      setPendingEdgeStart(null);
      setPendingStackFrom(null);
      setPendingPath([]);
      setCardInstanceId("");
      setCardTargetsRaw("");
      setIsHandPanelOpen(true);
      setBasicActionIntent("none");
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
    if (view.public.winnerPlayerId) {
      setIsVictoryVisible(true);
    } else {
      setIsVictoryVisible(false);
    }
  }, [view.public.winnerPlayerId]);

  useEffect(() => {
    const phase = view.public.phase;
    const round = view.public.round;
    if (!hasPhaseCueBaseline.current) {
      hasPhaseCueBaseline.current = true;
      lastPhaseRef.current = phase;
      lastRoundRef.current = round;
      return;
    }
    if (phase === lastPhaseRef.current && round === lastRoundRef.current) {
      return;
    }
    lastPhaseRef.current = phase;
    lastRoundRef.current = round;
    if (!phase.startsWith("round.")) {
      return;
    }
    setPhaseCue({ label: phaseLabel, round });
    setPhaseCueKey((value) => value + 1);
  }, [view.public.phase, view.public.round, phaseLabel]);

  useEffect(() => {
    if (!phaseCue) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setPhaseCue(null);
    }, 2600);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [phaseCue, phaseCueKey]);

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
                    {boardPickMode === "cardEdge" ? "Picking" : "Pick on board"}
                  </button>
                </div>
                <p className="card-detail__hint">
                  Click a highlighted edge on the board.
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
                    {boardPickMode === "cardStack" ? "Picking" : "Pick on board"}
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
                      {boardPickMode === "cardPath" ? "Picking" : "Pick on board"}
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
                      {boardPickMode === "cardChoice" ? "Picking hex" : "Occupied hex"}
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
                      {boardPickMode === "cardHex" ? "Picking" : "Pick on board"}
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
  const handleSelectCard = (cardId: string) => {
    const card = handCards.find((entry) => entry.id === cardId) ?? null;
    const cardDef = card ? CARD_DEFS_BY_ID.get(card.defId) ?? null : null;
    setCardInstanceId(cardId);
    setCardTargetsRaw("");
    setBoardPickModeSafe(getDefaultCardPickMode(cardDef));
  };
  const localResources = {
    gold: availableGold,
    mana: availableMana
  };
  const localVpTotal = view.private?.vp ? view.private.vp.total : null;

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

  const logContent =
    view.public.logs.length === 0 ? (
      <div className="log-empty">Waiting for events.</div>
    ) : (
      <ul className="log-list">
        {view.public.logs.map((entry, index) => (
          <li key={`${entry.type}-${index}`}>{formatGameEvent(entry, playerNames)}</li>
        ))}
      </ul>
    );

  const infoDock = isInfoDockOpen ? (
    <section className="panel game-dock" aria-live="polite">
      <div className="game-dock__header">
        <div className="game-dock__title">
          <span className="game-dock__eyebrow">Table intel</span>
          <strong className="game-dock__label">Log</strong>
        </div>
        <button
          type="button"
          className="btn btn-tertiary game-dock__close"
          onClick={() => setIsInfoDockOpen(false)}
        >
          Close
        </button>
      </div>
      <div className="game-dock__body">{logContent}</div>
    </section>
  ) : null;

  return (
    <section className="game-screen">
      {phaseCue ? (
        <div key={phaseCueKey} className="phase-cue" role="status" aria-live="polite">
          <div className="phase-cue__panel">
            <span className="phase-cue__eyebrow">Phase change</span>
            <strong className="phase-cue__label">{phaseCue.label}</strong>
            <span className="phase-cue__round">Round {phaseCue.round}</span>
          </div>
        </div>
      ) : null}
      {showVictoryScreen && view.public.winnerPlayerId ? (
        <VictoryScreen
          winnerId={view.public.winnerPlayerId}
          players={view.public.players}
          round={view.public.round}
          viewerId={playerId}
          isHost={isHost}
          onRematch={onResetGame}
          onLeave={onLeave}
          onClose={handleVictoryClose}
        />
      ) : null}
      <GameScreenHeader
        isCollapsed={isHeaderCollapsed}
        connectionLabel={connectionLabel}
        connectionClass={connectionClass}
        phaseLabel={phaseLabel}
        round={view.public.round}
        roomId={roomId}
        playerCount={view.public.players.length}
        winnerPlayerId={view.public.winnerPlayerId ?? null}
        onToggle={toggleHeaderCollapsed}
        onLeave={onLeave}
      />

      {marketOverlay}

      {phaseFocusPanel}

      <div
        className={`game-screen__layout ${showPhaseFocus ? "game-screen__layout--focus" : ""}`}
      >
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <div className="legend legend--compact">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
            <div className={`board-tools ${isBoardTargeting ? "is-targeting" : ""}`}>
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
              validHexKeys={isEdgePickMode ? [] : validHexKeys}
              previewEdgeKeys={previewEdgeKeys}
              isTargeting={isBoardTargeting}
              onHexClick={isEdgePickMode ? undefined : handleBoardHexClick}
              onEdgeClick={handleBoardEdgeClick}
            />
          </div>
        </section>

        <GameScreenSidebar
          connectionLabel={connectionLabel}
          connectionClass={connectionClass}
          phaseLabel={phaseLabel}
          round={view.public.round}
          leadPlayerName={leadPlayer?.name ?? null}
          players={view.public.players}
          actionStep={actionStep}
          actionEligible={actionEligible}
          actionWaiting={actionWaiting}
          isInteractivePhase={isInteractivePhase}
          localResources={localResources}
          localVpTotal={localVpTotal}
          logCount={logCount}
          lastLogLabel={lastLogLabel}
          isInfoDockOpen={isInfoDockOpen}
          onToggleDock={toggleDock}
        />
      </div>
      {infoDock}
      <GameScreenHandPanel
        canShowHandPanel={canShowHandPanel}
        isHandPanelOpen={isHandPanelOpen}
        onShowHandPanel={() => setIsHandPanelOpen(true)}
        onHideHandPanel={() => setIsHandPanelOpen(false)}
        handCards={handCards}
        deckCounts={deckCounts}
        availableMana={availableMana}
        availableGold={availableGold}
        canDeclareAction={canDeclareAction}
        selectedCardId={cardInstanceId}
        selectedCardDef={selectedCardDef}
        cardCostLabel={cardCostLabel}
        cardTargetPanel={cardTargetPanel}
        phase={view.public.phase}
        player={localPlayer ?? null}
        status={status}
        edgeKey={edgeKey}
        marchFrom={marchFrom}
        marchTo={marchTo}
        boardPickMode={boardPickMode}
        basicActionIntent={basicActionIntent}
        onBasicActionIntentChange={setBasicActionIntent}
        onEdgeKeyChange={setEdgeKey}
        onMarchFromChange={setMarchFrom}
        onMarchToChange={setMarchTo}
        onBoardPickModeChange={setBoardPickModeSafe}
        onSelectCard={handleSelectCard}
        onSubmitAction={onSubmitAction}
        primaryAction={primaryAction}
        primaryActionLabel={primaryActionLabel}
        canSubmitDone={canSubmitDone}
      />
    </section>
  );
};
