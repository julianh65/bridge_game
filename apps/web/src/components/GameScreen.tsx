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
import { ActionRevealOverlay, type ActionRevealOverlayData } from "./ActionRevealOverlay";
import { BoardView } from "./BoardView";
import { CollectionPanel } from "./CollectionPanel";
import { CombatOverlay } from "./CombatOverlay";
import { GameScreenHandPanel } from "./GameScreenHandPanel";
import { GameScreenHeader } from "./GameScreenHeader";
import { GameScreenSidebar } from "./GameScreenSidebar";
import { HandCardPickerModal } from "./HandCardPickerModal";
import { MarketPanel } from "./MarketPanel";
import { VictoryScreen } from "./VictoryScreen";
import { buildHexRender } from "../lib/board-preview";
import { extractCombatSequences, type CombatSequence } from "../lib/combat-log";
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

type CardRevealTargetInfo = {
  targetLines: string[];
  targetHexKeys: string[];
  targetEdgeKeys: string[];
};

type ActionCardReveal = ActionRevealOverlayData & {
  key: string;
  targetHexKeys: string[];
  targetEdgeKeys: string[];
};

type AgeCue = {
  label: string;
  round: number;
  kind: "start" | "shift";
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

const buildHexLabels = (hexKeys: string[]): Record<string, string> => {
  const rows = new Map<number, Array<{ key: string; q: number }>>();
  for (const key of hexKeys) {
    try {
      const { q, r } = parseHexKey(key);
      const row = rows.get(r) ?? [];
      row.push({ key, q });
      rows.set(r, row);
    } catch {
      continue;
    }
  }
  const sortedRows = Array.from(rows.entries()).sort(([a], [b]) => a - b);
  const labels: Record<string, string> = {};
  sortedRows.forEach(([, rowHexes], rowIndex) => {
    const rowLabel = rowIndex < 26 ? String.fromCharCode(97 + rowIndex) : `r${rowIndex + 1}`;
    rowHexes.sort((a, b) => a.q - b.q);
    rowHexes.forEach((entry, colIndex) => {
      labels[entry.key] = `${rowLabel}${colIndex + 1}`;
    });
  });
  return labels;
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

const getTargetCardInstanceIds = (record: Record<string, unknown> | null): string[] => {
  if (!record) {
    return [];
  }
  const ids = record.cardInstanceIds;
  if (Array.isArray(ids)) {
    return ids.filter((entry) => typeof entry === "string" && entry.length > 0);
  }
  const id = record.cardInstanceId;
  return typeof id === "string" && id.length > 0 ? [id] : [];
};

const formatPhaseLabel = (phase: string) => {
  const trimmed = phase.replace("round.", "");
  const spaced = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2").replace(".", " ");
  return spaced.replace(/^\w/, (value) => value.toUpperCase());
};

const CARD_REVEAL_DURATION_MS = 2800;

const buildCardCostLabel = (cardDef: CardDef | null): string | null => {
  if (!cardDef) {
    return null;
  }
  const parts = [`${cardDef.cost.mana} mana`];
  if (cardDef.cost.gold) {
    parts.push(`${cardDef.cost.gold} gold`);
  }
  return parts.join(", ");
};

const describeRevealTargets = (
  targets: Record<string, unknown> | null,
  board: GameView["public"]["board"]
): CardRevealTargetInfo => {
  if (!targets) {
    return { targetLines: [], targetHexKeys: [], targetEdgeKeys: [] };
  }

  const lines: string[] = [];
  const lineSet = new Set<string>();
  const hexKeys = new Set<string>();
  const edgeKeys = new Set<string>();

  const pushLine = (line: string) => {
    if (lineSet.has(line)) {
      return;
    }
    lineSet.add(line);
    lines.push(line);
  };
  const addHex = (hexKey: string | null) => {
    if (hexKey) {
      hexKeys.add(hexKey);
    }
  };
  const addEdge = (edgeKey: string | null) => {
    if (edgeKey) {
      edgeKeys.add(edgeKey);
    }
  };

  const edgeKey = getTargetString(targets, "edgeKey");
  if (edgeKey) {
    addEdge(edgeKey);
    pushLine(`Edge ${edgeKey}`);
  }

  const hexKey = getTargetString(targets, "hexKey");
  if (hexKey) {
    addHex(hexKey);
    pushLine(`Hex ${hexKey}`);
  }

  const path = targets.path;
  if (Array.isArray(path)) {
    const filtered = path.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0
    );
    if (filtered.length > 0) {
      filtered.forEach(addHex);
      pushLine(`Path ${filtered.join(" → ")}`);
    }
  }

  const from = getTargetString(targets, "from");
  const to = getTargetString(targets, "to");
  if (from && to) {
    addHex(from);
    addHex(to);
    pushLine(`Move ${from} → ${to}`);
  }

  const choice = getTargetString(targets, "choice") ?? getTargetString(targets, "kind");
  if (choice === "capital") {
    pushLine("Choice: Capital");
  } else if (choice === "occupiedHex") {
    const occupiedHex = getTargetString(targets, "hexKey");
    addHex(occupiedHex);
    pushLine(occupiedHex ? `Choice: Occupied ${occupiedHex}` : "Choice: Occupied hex");
  }

  const unitId = getTargetString(targets, "unitId") ?? getTargetString(targets, "championId");
  if (unitId) {
    const unit = board.units[unitId];
    const unitName = unit
      ? CARD_DEFS_BY_ID.get(unit.cardDefId)?.name ?? unit.cardDefId
      : null;
    if (unit?.hex) {
      addHex(unit.hex);
    }
    pushLine(
      unit?.hex
        ? `Champion ${unitName ?? unitId} @ ${unit.hex}`
        : `Champion ${unitName ?? unitId}`
    );
  }

  return {
    targetLines: lines,
    targetHexKeys: Array.from(hexKeys),
    targetEdgeKeys: Array.from(edgeKeys)
  };
};

const formatAgeCueLabel = (age: string) => `Age ${age} Begins`;

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
  const hexLabels = useMemo(
    () => buildHexLabels(Object.keys(view.public.board.hexes)),
    [view.public.board.hexes]
  );
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
  const playerFactionById = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const player of view.public.players) {
      mapping[player.id] = player.factionId;
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
  const [reinforceHex, setReinforceHex] = useState("");
  const [cardInstanceId, setCardInstanceId] = useState("");
  const [cardTargetsRaw, setCardTargetsRaw] = useState("");
  const [isHandPickerOpen, setIsHandPickerOpen] = useState(false);
  const [boardPickMode, setBoardPickMode] = useState<BoardPickMode>("none");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isMarketOverlayOpen, setIsMarketOverlayOpen] = useState(false);
  const [marketWinner, setMarketWinner] = useState<MarketWinnerHighlight | null>(null);
  const [cardRevealQueue, setCardRevealQueue] = useState<ActionCardReveal[]>([]);
  const [activeCardReveal, setActiveCardReveal] = useState<ActionCardReveal | null>(null);
  const [cardRevealKey, setCardRevealKey] = useState(0);
  const [combatQueue, setCombatQueue] = useState<CombatSequence[]>([]);
  const [phaseCue, setPhaseCue] = useState<{ label: string; round: number } | null>(null);
  const [phaseCueKey, setPhaseCueKey] = useState(0);
  const [ageCue, setAgeCue] = useState<AgeCue | null>(null);
  const [ageCueKey, setAgeCueKey] = useState(0);
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
  const lastCardRevealIndex = useRef(-1);

  const localCapitalHexKey = useMemo(() => {
    if (!localPlayerId) {
      return null;
    }
    for (const hex of Object.values(view.public.board.hexes)) {
      if (hex.tile === "capital" && hex.ownerPlayerId === localPlayerId) {
        return hex.key;
      }
    }
    return null;
  }, [localPlayerId, view.public.board.hexes]);

  const centerHexKey = useMemo(() => {
    for (const hex of Object.values(view.public.board.hexes)) {
      if (hex.tile === "center") {
        return hex.key;
      }
    }
    return null;
  }, [view.public.board.hexes]);

  const canUseCenterAsCapital = useMemo(() => {
    if (!localPlayerId || localPlayer?.factionId !== "aerial" || !centerHexKey) {
      return false;
    }
    const centerHex = view.public.board.hexes[centerHexKey];
    if (!centerHex) {
      return false;
    }
    return isOccupiedByPlayer(centerHex, localPlayerId);
  }, [localPlayer?.factionId, localPlayerId, centerHexKey, view.public.board.hexes]);

  const reinforceOptions = useMemo(() => {
    if (!localPlayerId) {
      return [];
    }
    const options: { key: string; label: string }[] = [];
    if (localCapitalHexKey) {
      const capitalHex = view.public.board.hexes[localCapitalHexKey];
      if (capitalHex && !wouldExceedTwoPlayers(capitalHex, localPlayerId)) {
        options.push({ key: localCapitalHexKey, label: "Capital" });
      }
    }
    if (canUseCenterAsCapital && centerHexKey) {
      const centerHex = view.public.board.hexes[centerHexKey];
      if (centerHex && !wouldExceedTwoPlayers(centerHex, localPlayerId)) {
        options.push({ key: centerHexKey, label: "Center" });
      }
    }
    return options;
  }, [
    canUseCenterAsCapital,
    centerHexKey,
    localCapitalHexKey,
    localPlayerId,
    view.public.board.hexes
  ]);

  const selectedReinforce =
    reinforceOptions.find((option) => option.key === reinforceHex) ?? reinforceOptions[0] ?? null;
  const lastCombatEndIndex = useRef(-1);
  const hasMarketLogBaseline = useRef(false);
  const hasCardRevealBaseline = useRef(false);
  const hasPhaseCueBaseline = useRef(false);
  const hasAgeIntroShown = useRef(false);
  const lastPhaseRef = useRef(view.public.phase);
  const lastRoundRef = useRef(view.public.round);
  const lastAgeRef = useRef(view.public.market.age);
  const targetRecord = useMemo(() => parseTargets(cardTargetsRaw), [cardTargetsRaw]);
  const selectedChampionId =
    getTargetString(targetRecord, "unitId") ?? getTargetString(targetRecord, "championId");

  const selectedCard = handCards.find((card) => card.id === cardInstanceId) ?? null;
  const selectedCardDef = selectedCard
    ? CARD_DEFS_BY_ID.get(selectedCard.defId) ?? null
    : null;
  const cardTargetKind = selectedCardDef?.targetSpec.kind ?? "none";
  const topdeckEffect = selectedCardDef?.effects?.find(
    (effect) => effect.kind === "topdeckFromHand"
  );
  const topdeckCount =
    typeof topdeckEffect?.count === "number"
      ? Math.max(0, Math.floor(topdeckEffect.count))
      : topdeckEffect
        ? 1
        : 0;
  const handCardLabels = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const card of handCards) {
      const def = CARD_DEFS_BY_ID.get(card.defId);
      mapping.set(card.id, def?.name ?? card.defId);
    }
    return mapping;
  }, [handCards]);
  const selectedHandCardIds = useMemo(() => {
    if (!targetRecord) {
      return [];
    }
    const handIds = new Set(handCards.map((card) => card.id));
    return getTargetCardInstanceIds(targetRecord).filter(
      (cardId) => cardId !== cardInstanceId && handIds.has(cardId)
    );
  }, [cardInstanceId, handCards, targetRecord]);
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
  const activeCombat = combatQueue[0] ?? null;
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
  const canReinforce = canSubmitAction && availableGold >= 1 && reinforceOptions.length > 0;
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
  } else if (basicActionIntent === "reinforce" && canReinforce && selectedReinforce) {
    primaryAction = {
      kind: "basic",
      action: { kind: "capitalReinforce", hexKey: selectedReinforce.key }
    };
    primaryActionLabel = `Reinforce ${selectedReinforce.label}`;
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
  const handleCombatClose = () => {
    setCombatQueue((queue) => queue.slice(1));
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

  useEffect(() => {
    if (topdeckCount === 0) {
      setIsHandPickerOpen(false);
    }
  }, [topdeckCount]);

  useEffect(() => {
    if (reinforceHex.length === 0) {
      return;
    }
    if (!reinforceOptions.some((option) => option.key === reinforceHex)) {
      setReinforceHex("");
    }
  }, [reinforceHex, reinforceOptions]);

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
      setReinforceHex("");
      setIsHandPickerOpen(false);
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
    const age = view.public.market.age;
    const round = view.public.round;
    const phase = view.public.phase;
    const isRoundPhase = phase.startsWith("round.");
    if (!hasAgeIntroShown.current && isRoundPhase && round === 1) {
      setAgeCue({ label: formatAgeCueLabel(age), round, kind: "start" });
      setAgeCueKey((value) => value + 1);
      hasAgeIntroShown.current = true;
      lastAgeRef.current = age;
      return;
    }
    if (age === lastAgeRef.current) {
      return;
    }
    lastAgeRef.current = age;
    setAgeCue({ label: formatAgeCueLabel(age), round, kind: "shift" });
    setAgeCueKey((value) => value + 1);
    hasAgeIntroShown.current = true;
  }, [view.public.market.age, view.public.phase, view.public.round]);

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
    if (!ageCue) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setAgeCue(null);
    }, 3200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [ageCue, ageCueKey]);

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
    const logs = view.public.logs;
    if (!hasCardRevealBaseline.current) {
      hasCardRevealBaseline.current = true;
      lastCardRevealIndex.current = logs.length - 1;
      return;
    }
    if (logs.length === 0) {
      lastCardRevealIndex.current = -1;
      setCardRevealQueue([]);
      setActiveCardReveal(null);
      return;
    }
    if (logs.length - 1 < lastCardRevealIndex.current) {
      lastCardRevealIndex.current = logs.length - 1;
      setCardRevealQueue([]);
      setActiveCardReveal(null);
      return;
    }
    const newReveals: ActionCardReveal[] = [];
    for (let i = lastCardRevealIndex.current + 1; i < logs.length; i += 1) {
      const event = logs[i];
      if (!event.type.startsWith("action.card.")) {
        continue;
      }
      const payload = event.payload ?? {};
      const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
      const cardId =
        typeof payload.cardId === "string"
          ? payload.cardId
          : event.type.slice("action.card.".length);
      const cardDef = CARD_DEFS_BY_ID.get(cardId) ?? null;
      const rawTargets = payload.targets;
      const targetRecord =
        rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)
          ? (rawTargets as Record<string, unknown>)
          : null;
      const targetInfo = describeRevealTargets(targetRecord, view.public.board);
      newReveals.push({
        key: `${i}-${cardId}`,
        playerName: playerId ? playerNames.get(playerId) ?? playerId : "Unknown player",
        cardName: cardDef?.name ?? cardId,
        cardId,
        cardType: cardDef?.type ?? null,
        initiative: cardDef?.initiative ?? null,
        costLabel: buildCardCostLabel(cardDef),
        targetLines: targetInfo.targetLines,
        targetHexKeys: targetInfo.targetHexKeys,
        targetEdgeKeys: targetInfo.targetEdgeKeys
      });
    }
    lastCardRevealIndex.current = logs.length - 1;
    if (newReveals.length > 0) {
      setCardRevealQueue((queue) => [...queue, ...newReveals]);
    }
  }, [view.public.logs, view.public.board, playerNames]);

  useEffect(() => {
    const logs = view.public.logs;
    if (logs.length === 0) {
      lastCombatEndIndex.current = -1;
      setCombatQueue([]);
      return;
    }
    if (lastCombatEndIndex.current >= logs.length) {
      lastCombatEndIndex.current = -1;
      setCombatQueue([]);
    }
    const sequences = extractCombatSequences(logs);
    const newSequences = sequences.filter(
      (sequence) => sequence.endIndex > lastCombatEndIndex.current
    );
    if (newSequences.length === 0) {
      return;
    }
    lastCombatEndIndex.current = newSequences[newSequences.length - 1].endIndex;
    setCombatQueue((queue) => [...queue, ...newSequences]);
  }, [view.public.logs]);

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

  useEffect(() => {
    if (activeCardReveal || cardRevealQueue.length === 0) {
      return;
    }
    const [next, ...rest] = cardRevealQueue;
    setActiveCardReveal(next ?? null);
    setCardRevealQueue(rest);
    setCardRevealKey((value) => value + 1);
  }, [activeCardReveal, cardRevealQueue]);

  useEffect(() => {
    if (!activeCardReveal) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActiveCardReveal(null);
    }, CARD_REVEAL_DURATION_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeCardReveal, cardRevealKey]);

  const setCardTargetsObject = (targets: Record<string, unknown> | null) => {
    setCardTargetsRaw(targets ? JSON.stringify(targets) : "");
  };

  const setCardInstanceTargets = (cardIds: string[]) => {
    const trimmed = cardIds.filter((id) => id.length > 0);
    const nextTargets = targetRecord ? { ...targetRecord } : {};
    delete nextTargets.cardInstanceId;
    delete nextTargets.cardInstanceIds;
    if (trimmed.length > 0) {
      nextTargets.cardInstanceIds = trimmed;
    }
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
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

    if (boardPickMode === "none" && cardTargetKind === "champion" && selectedCardDef) {
      const rawOwner = selectedCardDef.targetSpec.owner;
      const owner =
        rawOwner === "self" || rawOwner === "enemy" || rawOwner === "any"
          ? rawOwner
          : "self";
      const eligibleChampions =
        !localPlayer || owner === "any"
          ? championUnits
          : owner === "self"
            ? championUnits.filter((unit) => unit.ownerId === localPlayer.id)
            : championUnits.filter((unit) => unit.ownerId !== localPlayer.id);
      const championsOnHex = eligibleChampions.filter((unit) => unit.hex === hexKey);
      if (championsOnHex.length > 0) {
        const currentIndex = championsOnHex.findIndex(
          (unit) => unit.id === selectedChampionId
        );
        const nextIndex =
          currentIndex >= 0 ? (currentIndex + 1) % championsOnHex.length : 0;
        setCardTargetsObject({ unitId: championsOnHex[nextIndex].id });
        return;
      }
    }

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
      if (selectedCardDef && cardTargetKind === "choice") {
        const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
        const options = Array.isArray(targetSpec.options) ? targetSpec.options : [];
        const hasCapitalOption = options.some(
          (option) =>
            option && typeof option === "object" && (option as Record<string, unknown>).kind === "capital"
        );
        const canPickCenter = canUseCenterAsCapital && centerHexKey;
        if (hasCapitalOption) {
          if (localCapitalHexKey && hexKey === localCapitalHexKey) {
            setCardTargetsObject({ choice: "capital", hexKey });
            return;
          }
          if (canPickCenter && centerHexKey && hexKey === centerHexKey) {
            setCardTargetsObject({ choice: "capital", hexKey });
            return;
          }
        }
      }
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

  const targetHighlightHexKeys = useMemo(() => {
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

  const { validHexKeys, previewEdgeKeys: targetPreviewEdgeKeys, startHexKeys } = useMemo(() => {
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
      const hasCapitalOption = options.some(
        (option) =>
          option && typeof option === "object" && (option as Record<string, unknown>).kind === "capital"
      );
      const occupiedOption = options.find(
        (option) =>
          option && typeof option === "object" && (option as Record<string, unknown>).kind === "occupiedHex"
      ) as Record<string, unknown> | undefined;
      if (!occupiedOption && !hasCapitalOption) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      if (occupiedOption) {
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
      if (hasCapitalOption) {
        if (localCapitalHexKey) {
          validTargets.add(localCapitalHexKey);
        }
        if (canUseCenterAsCapital && centerHexKey) {
          validTargets.add(centerHexKey);
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

  const revealHexKeys = activeCardReveal?.targetHexKeys ?? [];
  const revealEdgeKeys = activeCardReveal?.targetEdgeKeys ?? [];
  const highlightHexKeys = useMemo(() => {
    if (revealHexKeys.length === 0) {
      return targetHighlightHexKeys;
    }
    const merged = new Set(targetHighlightHexKeys);
    for (const key of revealHexKeys) {
      merged.add(key);
    }
    return Array.from(merged);
  }, [targetHighlightHexKeys, revealHexKeys]);
  const previewEdgeKeys = useMemo(() => {
    if (revealEdgeKeys.length === 0) {
      return targetPreviewEdgeKeys;
    }
    const merged = new Set(targetPreviewEdgeKeys);
    for (const key of revealEdgeKeys) {
      merged.add(key);
    }
    return Array.from(merged);
  }, [targetPreviewEdgeKeys, revealEdgeKeys]);

  const handleSelectCard = (cardId: string) => {
    const card = handCards.find((entry) => entry.id === cardId) ?? null;
    const cardDef = card ? CARD_DEFS_BY_ID.get(card.defId) ?? null : null;
    setCardInstanceId(cardId);
    setCardTargetsRaw("");
    setIsHandPickerOpen(false);
    setBoardPickModeSafe(getDefaultCardPickMode(cardDef));
  };
  const localResources = {
    gold: availableGold,
    mana: availableMana
  };
  const localVpTotal = view.private?.vp ? view.private.vp.total : null;
  const selectedHexLabel = selectedHexKey ? hexLabels[selectedHexKey] ?? null : null;
  const selectedLabelText = selectedHexKey
    ? selectedHexLabel
      ? `Selected ${selectedHexLabel}`
      : "Selected tile"
    : "No tile selected";
  const handPickerCards = handCards.filter((card) => card.id !== cardInstanceId);
  const selectedHandLabels = selectedHandCardIds.map(
    (cardId) => handCardLabels.get(cardId) ?? cardId
  );
  const topdeckLimitLabel = topdeckCount === 1 ? "1 card" : `${topdeckCount} cards`;
  const handTargetsPanel =
    selectedCardDef && topdeckCount > 0 ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Topdeck from hand</strong>
          <span className="hand-targets__meta">
            {selectedHandCardIds.length}/{topdeckCount}
          </span>
        </div>
        <p className="hand-targets__hint">
          Pick up to {topdeckLimitLabel} to place on top of your draw pile.
        </p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={handPickerCards.length === 0}
            onClick={() => setIsHandPickerOpen(true)}
          >
            Choose cards
          </button>
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={selectedHandCardIds.length === 0}
            onClick={() => setCardInstanceTargets([])}
          >
            Clear
          </button>
        </div>
        <p className="hand-targets__selected">
          {selectedHandCardIds.length > 0
            ? `Selected: ${selectedHandLabels.join(", ")}`
            : "No cards selected."}
        </p>
      </div>
    ) : null;
  const showHandPicker =
    isActionPhase && isHandPickerOpen && topdeckCount > 0 && Boolean(selectedCardDef);
  const handPickerTitle = "Topdeck from hand";
  const handPickerDescription =
    topdeckCount > 0
      ? `Pick up to ${topdeckLimitLabel} to place on top of your draw pile.`
      : null;

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
      {ageCue ? (
        <div
          key={ageCueKey}
          className="phase-cue phase-cue--age"
          role="status"
          aria-live="polite"
        >
          <div className="phase-cue__panel">
            <span className="phase-cue__eyebrow">
              {ageCue.kind === "start" ? "Game start" : "New age"}
            </span>
            <strong className="phase-cue__label">{ageCue.label}</strong>
            <span className="phase-cue__round">Round {ageCue.round}</span>
          </div>
        </div>
      ) : null}
      {activeCardReveal ? (
        <ActionRevealOverlay key={activeCardReveal.key} reveal={activeCardReveal} />
      ) : null}
      {activeCombat ? (
        <CombatOverlay
          sequence={activeCombat}
          playersById={playerNames}
          cardDefsById={CARD_DEFS_BY_ID}
          onClose={handleCombatClose}
        />
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
      <HandCardPickerModal
        isOpen={showHandPicker}
        title={handPickerTitle}
        description={handPickerDescription}
        cards={handPickerCards}
        cardDefsById={CARD_DEFS_BY_ID}
        selectedIds={selectedHandCardIds}
        maxSelect={Math.max(topdeckCount, 1)}
        onSelectionChange={setCardInstanceTargets}
        onClose={() => setIsHandPickerOpen(false)}
      />
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
      />

      {marketOverlay}

      {phaseFocusPanel}

      <div
        className={`game-screen__layout ${showPhaseFocus ? "game-screen__layout--focus" : ""}`}
      >
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <div className="game-board__viewport">
              <BoardView
                hexes={hexRender}
                board={view.public.board}
                playerIndexById={playerColorIndexById}
                playerFactionById={playerFactionById}
                showCoords={false}
                showTags
                showMineValues={false}
                labelByHex={hexLabels}
                labelVariant="coords"
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
                showTags={false}
              />
              <div
                className={`board-tools board-tools--overlay ${
                  isBoardTargeting ? "is-targeting" : ""
                }`}
              >
                <div className="board-tools__meta">
                  <span className="chip board-tools__chip">{selectedLabelText}</span>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => setResetViewToken((value) => value + 1)}
                  >
                    Reset view
                  </button>
                </div>
              </div>
            </div>
            <div className="legend legend--compact game-board__legend">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
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
        handTargets={handTargetsPanel}
        phase={view.public.phase}
        player={localPlayer ?? null}
        status={status}
        edgeKey={edgeKey}
        marchFrom={marchFrom}
        marchTo={marchTo}
        reinforceHex={reinforceHex}
        reinforceOptions={reinforceOptions}
        boardPickMode={boardPickMode}
        basicActionIntent={basicActionIntent}
        onBasicActionIntentChange={setBasicActionIntent}
        onEdgeKeyChange={setEdgeKey}
        onMarchFromChange={setMarchFrom}
        onMarchToChange={setMarchTo}
        onReinforceHexChange={setReinforceHex}
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
