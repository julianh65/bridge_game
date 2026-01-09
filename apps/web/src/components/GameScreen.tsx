import { useMemo, useState, useEffect, useRef, useCallback } from "react";

import {
  CARD_DEFS,
  getBridgeKey,
  hasBridge,
  hasEnemyUnits,
  isOccupiedByPlayer,
  type BasicAction,
  type ActionDeclaration,
  type Bid,
  type CardDef,
  type CollectionChoice,
  type GameView,
  wouldExceedTwoPlayers
} from "@bridgefront/engine";
import {
  areAdjacent,
  axialDistance,
  neighborHexKeys,
  parseEdgeKey,
  parseHexKey
} from "@bridgefront/shared";

import { type BasicActionIntent, type BoardPickMode } from "./ActionPanel";
import { ActionRevealOverlay, type ActionRevealOverlayData } from "./ActionRevealOverlay";
import { type BoardActionAnimation } from "./BoardView";
import { CombatOverlay } from "./CombatOverlay";
import { DiceRollOverlay, type DiceRollOverlayData } from "./DiceRollOverlay";
import { GameScreenCues, type AgeCue, type PhaseCue } from "./GameScreenCues";
import { GameScreenBoardSection } from "./GameScreenBoardSection";
import {
  GameScreenChampionTargetOverlay,
  type ChampionTargetOverlayOption
} from "./GameScreenChampionTargetOverlay";
import { GameScreenHandPanel } from "./GameScreenHandPanel";
import { GameScreenHeader } from "./GameScreenHeader";
import { GameScreenInfoDock } from "./GameScreenInfoDock";
import {
  GameScreenCollectionOverlay,
  GameScreenMarketOverlay
} from "./GameScreenOverlays";
import { GameScreenSidebar } from "./GameScreenSidebar";
import { GameScreenSidebarToggle } from "./GameScreenSidebarToggle";
import { ForceSplitPopover } from "./ForceSplitPopover";
import { HandCardPickerModal } from "./HandCardPickerModal";
import type { MarketWinnerHighlight } from "./MarketPanel";
import { VictoryScreen } from "./VictoryScreen";
import { buildHexRender } from "../lib/board-preview";
import { extractCombatSequences, type CombatSequence } from "../lib/combat-log";
import { formatGameEvent } from "../lib/event-format";
import { getFactionName } from "../lib/factions";
import {
  buildEdgeTargetPayload,
  buildHexLabels,
  describeBasicAction,
  describeRevealTargets,
  formatEdgeLabel,
  formatHexLabel,
  formatTileLabel,
  getTargetBoolean,
  getTargetCardInstanceIds,
  getTargetNumber,
  getTargetPaths,
  getTargetString,
  getTargetStringArray,
  isEditableTarget,
  parseTargets,
  resolveMoveUnitMeta
} from "../lib/game-screen-targets";
import type { CombatSyncMap, RoomConnectionStatus } from "../lib/room-client";
import { playSfx } from "../lib/sfx";

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

type ActionCardReveal = ActionRevealOverlayData & {
  key: string;
  playerId: string | null;
  targetHexKeys: string[];
  targetEdgeKeys: string[];
  movePaths: string[][];
  moveUnitKind: "force" | "champion" | null;
  moveUnitLabel: string | null;
};

type HandPickerMode = "none" | "topdeck" | "discard" | "burn";

type ModifierView = GameView["public"]["modifiers"][number];

type ActiveEffectEntry = {
  id: string;
  label: string;
  detail: string;
};

const buildLogKey = (event: GameView["public"]["logs"][number]) => {
  const payload = event.payload ? JSON.stringify(event.payload) : "";
  return `${event.type}|${payload}`;
};

const formatPhaseLabel = (phase: string) => {
  const trimmed = phase.replace("round.", "");
  const spaced = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2").replace(".", " ");
  return spaced.replace(/^\w/, (value) => value.toUpperCase());
};

const formatUnitCounts = (forceCount: number, championCount: number) => {
  const parts: string[] = [];
  if (forceCount > 0 || championCount === 0) {
    parts.push(`${forceCount} force${forceCount === 1 ? "" : "s"}`);
  }
  if (championCount > 0) {
    parts.push(`${championCount} champion${championCount === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
};

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

const formatModifierDurationLabel = (duration: ModifierView["duration"]) => {
  switch (duration.type) {
    case "permanent":
      return "Permanent";
    case "endOfRound":
      return "Until round end";
    case "endOfBattle":
      return "Until battle ends";
    case "uses":
      return `${duration.remaining} use${duration.remaining === 1 ? "" : "s"}`;
    default: {
      const _exhaustive: never = duration;
      return String(_exhaustive);
    }
  }
};

const formatModifierSourceLabel = (modifier: ModifierView) => {
  const sourceId = modifier.source.sourceId;
  switch (modifier.source.type) {
    case "faction": {
      const factionName = getFactionName(sourceId);
      return factionName ? `Faction ${factionName}` : `Faction ${sourceId}`;
    }
    case "champion": {
      const name = CARD_DEFS_BY_ID.get(sourceId)?.name ?? sourceId;
      return `Champion ${name}`;
    }
    case "card":
      return CARD_DEFS_BY_ID.get(sourceId)?.name ?? sourceId;
    default: {
      const _exhaustive: never = modifier.source.type;
      return String(_exhaustive);
    }
  }
};

const buildActiveEffects = (
  modifiers: ModifierView[],
  playerNameById: Map<string, string>
): ActiveEffectEntry[] =>
  modifiers.map((modifier) => {
    const ownerLabel = modifier.ownerPlayerId
      ? playerNameById.get(modifier.ownerPlayerId) ?? modifier.ownerPlayerId
      : null;
    const attachment =
      modifier.attachedHex
        ? `Hex ${modifier.attachedHex}`
        : modifier.attachedEdge
          ? `Edge ${modifier.attachedEdge}`
          : modifier.attachedUnitId
            ? `Unit ${modifier.attachedUnitId}`
            : "Global";
    const durationLabel = formatModifierDurationLabel(modifier.duration);
    const detailParts = [
      ownerLabel ? `Owner ${ownerLabel}` : null,
      attachment,
      durationLabel
    ].filter(Boolean);
    return {
      id: modifier.id,
      label: formatModifierSourceLabel(modifier),
      detail: detailParts.join(" · ")
    };
  });

const formatAgeCueLabel = (age: string) => `Age ${age} Begins`;

const AGE_CUE_STORAGE_PREFIX = "bridgefront:age-cue";

const normalizeAgeCueValue = (value: string | null) => {
  if (value === "I" || value === "II" || value === "III") {
    return value;
  }
  return null;
};

const readStoredAgeCue = (roomId: string) => {
  if (!roomId || typeof window === "undefined") {
    return null;
  }
  try {
    const key = `${AGE_CUE_STORAGE_PREFIX}:${roomId}`;
    return normalizeAgeCueValue(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
};

const writeStoredAgeCue = (roomId: string, age: string) => {
  if (!roomId || typeof window === "undefined") {
    return;
  }
  try {
    const key = `${AGE_CUE_STORAGE_PREFIX}:${roomId}`;
    window.sessionStorage.setItem(key, age);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
};

const getDefaultCardPickMode = (cardDef: CardDef | null): BoardPickMode => {
  if (!cardDef) {
    return "none";
  }
  switch (cardDef.targetSpec.kind) {
    case "edge":
      return "cardEdge";
    case "multiEdge":
      return "cardEdge";
    case "stack":
      return "cardStack";
    case "path":
      return "cardPath";
    case "multiPath":
      return "cardPath";
    case "champion":
      return "cardChampion";
    case "hex":
      return "cardHex";
    case "hexPair":
      return "cardHexPair";
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
  suppressEntryCues?: boolean;
  onSubmitAction: (declaration: ActionDeclaration) => void;
  onSubmitMarketBid: (bid: Bid) => void;
  onSubmitMarketRollOff?: () => void;
  onSubmitCollectionChoices: (choices: CollectionChoice[]) => void;
  onSubmitQuietStudy: (cardInstanceIds: string[]) => void;
  onSubmitScoutReportChoice: (cardInstanceIds: string[]) => void;
  onSubmitCombatRetreat?: (hexKey: string, edgeKey: string | null) => void;
  combatSync?: CombatSyncMap | null;
  serverTimeOffset?: number | null;
  onCombatRoll?: (sequenceId: string, roundIndex: number) => void;
  onResetGame?: () => void;
  onLeave: () => void;
  onOpenDeck?: () => void;
};

export const GameScreen = ({
  view,
  playerId,
  roomId,
  status,
  suppressEntryCues = false,
  onSubmitAction,
  onSubmitMarketBid,
  onSubmitMarketRollOff,
  onSubmitCollectionChoices,
  onSubmitQuietStudy,
  onSubmitScoutReportChoice,
  onSubmitCombatRetreat,
  combatSync,
  serverTimeOffset,
  onCombatRoll,
  onResetGame,
  onLeave,
  onOpenDeck
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
  const capitalOwnerByHex = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const player of view.public.players) {
      if (player.capitalHex) {
        mapping[player.capitalHex] = player.name ?? player.id;
      }
    }
    return mapping;
  }, [view.public.players]);
  const activeEffects = useMemo(
    () => buildActiveEffects(view.public.modifiers, playerNames),
    [playerNames, view.public.modifiers]
  );
  const playerFactions = useMemo(
    () =>
      new Map(
        view.public.players.map((player) => [player.id, player.factionId ?? null])
      ),
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
  const quietStudy = view.private?.quietStudy ?? null;
  const scoutReport = view.private?.scoutReport ?? null;
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
  const isLocalEligible = Boolean(localPlayerId && actionEligible.has(localPlayerId));
  const isLocalWaiting = Boolean(localPlayerId && actionWaiting.has(localPlayerId));
  const [edgeKey, setEdgeKey] = useState("");
  const [marchFrom, setMarchFrom] = useState("");
  const [marchTo, setMarchTo] = useState("");
  const [marchForceCount, setMarchForceCount] = useState<number | null>(null);
  const [marchIncludeChampions, setMarchIncludeChampions] = useState<boolean | null>(
    null
  );
  const [reinforceHex, setReinforceHex] = useState("");
  const [cardInstanceId, setCardInstanceId] = useState("");
  const [cardTargetsRaw, setCardTargetsRaw] = useState("");
  const [handPickerMode, setHandPickerMode] = useState<HandPickerMode>("none");
  const [quietStudySelectedIds, setQuietStudySelectedIds] = useState<string[]>([]);
  const [scoutReportSelectedIds, setScoutReportSelectedIds] = useState<string[]>([]);
  const [boardPickMode, setBoardPickMode] = useState<BoardPickMode>("none");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMarketOverlayOpen, setIsMarketOverlayOpen] = useState(false);
  const [isCollectionOverlayOpen, setIsCollectionOverlayOpen] = useState(false);
  const [marketAutoOpenPending, setMarketAutoOpenPending] = useState(false);
  const [collectionAutoOpenPending, setCollectionAutoOpenPending] = useState(false);
  const [marketOutroHold, setMarketOutroHold] = useState(false);
  const [marketWinner, setMarketWinner] = useState<MarketWinnerHighlight | null>(null);
  const [marketWinnerHistory, setMarketWinnerHistory] = useState<
    Record<number, MarketWinnerHighlight>
  >({});
  const [cardRevealQueue, setCardRevealQueue] = useState<ActionCardReveal[]>([]);
  const [activeCardReveal, setActiveCardReveal] = useState<ActionCardReveal | null>(null);
  const [rollReveal, setRollReveal] = useState<DiceRollOverlayData | null>(null);
  const [isActionRevealOverlayVisible, setIsActionRevealOverlayVisible] = useState(false);
  const [cardRevealKey, setCardRevealKey] = useState(0);
  const [combatQueue, setCombatQueue] = useState<CombatSequence[]>([]);
  const [phaseCue, setPhaseCue] = useState<PhaseCue | null>(null);
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
  const [pendingHexPair, setPendingHexPair] = useState<string | null>(null);
  const [isInfoDockOpen, setIsInfoDockOpen] = useState(false);
  const [infoDockTab, setInfoDockTab] = useState<"log" | "effects">("log");
  const [isHandPanelOpen, setIsHandPanelOpen] = useState(true);
  const [basicActionIntent, setBasicActionIntent] = useState<BasicActionIntent>("none");
  const storedAgeCue = useMemo(() => readStoredAgeCue(roomId), [roomId]);
  const lastMarketEventIndex = useRef(-1);
  const lastRollEventIndex = useRef(-1);
  const lastCardRevealIndex = useRef(-1);
  const marketOverlayHoldTimeout = useRef<number | null>(null);
  const rollRevealTimeout = useRef<number | null>(null);
  const wasMarketPhaseRef = useRef(false);
  const wasCollectionPhaseRef = useRef(false);
  const marketRowKey = useMemo(() => {
    const cardIds = view.public.market.currentRow.map((card) => card.cardId).join("|");
    return `${view.public.market.age}:${view.public.round}:${cardIds}`;
  }, [view.public.market.age, view.public.market.currentRow, view.public.round]);
  const marketRowKeyRef = useRef(marketRowKey);

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

  const linkedNeighborsByHex = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!localPlayerId) {
      return map;
    }
    const boardHexes = view.public.board.hexes;
    const addLink = (from: string, to: string) => {
      const current = map.get(from);
      if (current) {
        current.add(to);
      } else {
        map.set(from, new Set([to]));
      }
    };
    for (const modifier of view.public.modifiers) {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== localPlayerId) {
        continue;
      }
      const link = modifier.data?.link as { from?: string; to?: string } | undefined;
      if (!link?.from || !link?.to) {
        continue;
      }
      if (!boardHexes[link.from] || !boardHexes[link.to]) {
        continue;
      }
      addLink(link.from, link.to);
      addLink(link.to, link.from);
    }
    return map;
  }, [localPlayerId, view.public.board.hexes, view.public.modifiers]);

  const bridgeBypassUnitIds = useMemo(() => {
    const ids = new Set<string>();
    if (!localPlayerId) {
      return ids;
    }
    for (const modifier of view.public.modifiers) {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== localPlayerId) {
        continue;
      }
      if (!modifier.id.endsWith(".bridge_bypass")) {
        continue;
      }
      const unitId = modifier.data?.unitId;
      if (typeof unitId === "string" && unitId.length > 0) {
        ids.add(unitId);
      }
    }
    return ids;
  }, [localPlayerId, view.public.modifiers]);

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

  const marchForceMax = useMemo(() => {
    if (!localPlayerId || !marchFrom) {
      return 0;
    }
    const hex = view.public.board.hexes[marchFrom];
    if (!hex) {
      return 0;
    }
    const unitIds = hex.occupants[localPlayerId] ?? [];
    let count = 0;
    for (const unitId of unitIds) {
      if (view.public.board.units[unitId]?.kind === "force") {
        count += 1;
      }
    }
    return count;
  }, [localPlayerId, marchFrom, view.public.board.hexes, view.public.board.units]);

  const marchChampionCount = useMemo(() => {
    if (!localPlayerId || !marchFrom) {
      return 0;
    }
    const hex = view.public.board.hexes[marchFrom];
    if (!hex) {
      return 0;
    }
    const unitIds = hex.occupants[localPlayerId] ?? [];
    let count = 0;
    for (const unitId of unitIds) {
      if (view.public.board.units[unitId]?.kind === "champion") {
        count += 1;
      }
    }
    return count;
  }, [localPlayerId, marchFrom, view.public.board.hexes, view.public.board.units]);

  const selectedReinforce =
    reinforceOptions.find((option) => option.key === reinforceHex) ?? reinforceOptions[0] ?? null;
  const lastCombatEndIndex = useRef(-1);
  const hasCombatLogBaseline = useRef(false);
  const hasMarketLogBaseline = useRef(false);
  const hasRollLogBaseline = useRef(false);
  const hasCardRevealBaseline = useRef(false);
  const lastCardRevealKeyRef = useRef<string | null>(null);
  const hasPhaseCueBaseline = useRef(false);
  const hasAgeIntroShown = useRef(Boolean(storedAgeCue) || suppressEntryCues);
  const lastPhaseRef = useRef(view.public.phase);
  const lastRoundRef = useRef(view.public.round);
  const lastAgeRef = useRef(
    suppressEntryCues ? view.public.market.age : storedAgeCue ?? view.public.market.age
  );
  const targetRecord = useMemo(() => parseTargets(cardTargetsRaw), [cardTargetsRaw]);
  const selectedChampionId =
    getTargetString(targetRecord, "unitId") ?? getTargetString(targetRecord, "championId");
  const selectedTargetPlayerId = getTargetString(targetRecord, "playerId");

  const selectedCard = handCards.find((card) => card.id === cardInstanceId) ?? null;
  const selectedCardDef = selectedCard
    ? CARD_DEFS_BY_ID.get(selectedCard.defId) ?? null
    : null;
  const cardTargetKind = selectedCardDef?.targetSpec.kind ?? "none";
  const championTargetOwner =
    cardTargetKind === "champion" && selectedCardDef
      ? (() => {
          const rawOwner = selectedCardDef.targetSpec.owner;
          if (rawOwner === "self" || rawOwner === "enemy" || rawOwner === "any") {
            return rawOwner;
          }
          return "self";
        })()
      : null;
  const moveStackEffect =
    selectedCardDef?.effects?.find((effect) => effect.kind === "moveStack") ?? null;
  const edgeMoveMode =
    cardTargetKind === "edge" && moveStackEffect
      ? typeof (moveStackEffect as { maxDistance?: number }).maxDistance === "number" &&
        (moveStackEffect as { maxDistance?: number }).maxDistance <= 1
        ? "cardStack"
        : "cardPath"
      : null;
  const cardMoveTargetKind =
    edgeMoveMode === "cardPath"
      ? "path"
      : edgeMoveMode === "cardStack"
        ? "stack"
        : cardTargetKind;
  const hasFixedMoveForceCount =
    typeof moveStackEffect?.forceCount === "number" ||
    typeof selectedCardDef?.targetSpec.forceCount === "number";
  const cardMoveSupportsSplit =
    Boolean(moveStackEffect) &&
    !hasFixedMoveForceCount &&
    (cardMoveTargetKind === "stack" || cardMoveTargetKind === "path");
  const cardMoveForceCount = useMemo(() => {
    if (!cardMoveSupportsSplit) {
      return null;
    }
    const rawCount = getTargetNumber(targetRecord, "forceCount");
    if (rawCount === null) {
      return null;
    }
    const normalized = Math.floor(rawCount);
    return normalized >= 0 ? normalized : null;
  }, [cardMoveSupportsSplit, targetRecord]);
  const cardMoveIncludeChampions = useMemo(() => {
    if (!cardMoveSupportsSplit) {
      return false;
    }
    const rawInclude = getTargetBoolean(targetRecord, "includeChampions");
    if (rawInclude !== null) {
      return rawInclude;
    }
    return cardMoveForceCount === null;
  }, [cardMoveForceCount, cardMoveSupportsSplit, targetRecord]);
  const cardMoveStartHex = useMemo(() => {
    if (!cardMoveSupportsSplit || !targetRecord) {
      return null;
    }
    if (cardMoveTargetKind === "path") {
      const path = getTargetStringArray(targetRecord, "path");
      return path.length > 0 ? path[0] : null;
    }
    if (cardMoveTargetKind === "stack") {
      return getTargetString(targetRecord, "from");
    }
    return null;
  }, [cardMoveSupportsSplit, cardMoveTargetKind, targetRecord]);
  const cardMoveForceMax = useMemo(() => {
    if (!localPlayerId || !cardMoveStartHex) {
      return 0;
    }
    const hex = view.public.board.hexes[cardMoveStartHex];
    if (!hex) {
      return 0;
    }
    const unitIds = hex.occupants[localPlayerId] ?? [];
    let count = 0;
    for (const unitId of unitIds) {
      if (view.public.board.units[unitId]?.kind === "force") {
        count += 1;
      }
    }
    return count;
  }, [cardMoveStartHex, localPlayerId, view.public.board.hexes, view.public.board.units]);
  const cardMoveChampionCount = useMemo(() => {
    if (!localPlayerId || !cardMoveStartHex) {
      return 0;
    }
    const hex = view.public.board.hexes[cardMoveStartHex];
    if (!hex) {
      return 0;
    }
    const unitIds = hex.occupants[localPlayerId] ?? [];
    let count = 0;
    for (const unitId of unitIds) {
      if (view.public.board.units[unitId]?.kind === "champion") {
        count += 1;
      }
    }
    return count;
  }, [cardMoveStartHex, localPlayerId, view.public.board.hexes, view.public.board.units]);
  const topdeckEffect = selectedCardDef?.effects?.find(
    (effect) => effect.kind === "topdeckFromHand"
  );
  const topdeckCount =
    typeof topdeckEffect?.count === "number"
      ? Math.max(0, Math.floor(topdeckEffect.count))
      : topdeckEffect
        ? 1
        : 0;
  const discardFromHandEffect = selectedCardDef?.effects?.find(
    (effect) => effect.kind === "discardFromHand"
  );
  const discardFromHandCount =
    typeof discardFromHandEffect?.count === "number"
      ? Math.max(0, Math.floor(discardFromHandEffect.count))
      : discardFromHandEffect
        ? 1
        : 0;
  const burnFromHandEffect = selectedCardDef?.effects?.find(
    (effect) => effect.kind === "burnFromHand"
  );
  const burnFromHandCount =
    typeof burnFromHandEffect?.count === "number"
      ? Math.max(0, Math.floor(burnFromHandEffect.count))
      : burnFromHandEffect
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
  const quietStudyMaxDiscard = quietStudy?.maxDiscard ?? 0;
  const isQuietStudyActive = Boolean(quietStudy?.isWaiting);
  const scoutReportKeepCount = scoutReport?.keepCount ?? 0;
  const scoutReportOffers = scoutReport?.offers ?? [];
  const isScoutReportActive =
    Boolean(scoutReport?.isWaiting) && scoutReportKeepCount > 0 && scoutReportOffers.length > 0;

  useEffect(() => {
    if (!isQuietStudyActive) {
      setQuietStudySelectedIds([]);
      return;
    }
    const available = new Set(handCards.map((card) => card.id));
    setQuietStudySelectedIds((current) => {
      const base = quietStudy?.selected ?? current;
      return base.filter((id) => available.has(id)).slice(0, quietStudyMaxDiscard);
    });
  }, [handCards, isQuietStudyActive, quietStudy?.selected, quietStudyMaxDiscard]);
  useEffect(() => {
    if (!isScoutReportActive) {
      setScoutReportSelectedIds([]);
      return;
    }
    const available = new Set(scoutReportOffers.map((card) => card.id));
    const maxKeep = Math.min(scoutReportKeepCount, scoutReportOffers.length);
    const base = scoutReport?.selected ?? [];
    const filtered = base.filter((id) => available.has(id)).slice(0, maxKeep);
    if (filtered.length > 0) {
      setScoutReportSelectedIds(filtered);
      return;
    }
    if (scoutReportOffers.length > 0) {
      setScoutReportSelectedIds([scoutReportOffers[0].id]);
      return;
    }
    setScoutReportSelectedIds([]);
  }, [isScoutReportActive, scoutReport?.selected, scoutReportKeepCount, scoutReportOffers]);
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
  const eligibleChampionTargets = useMemo(() => {
    if (!championTargetOwner) {
      return [];
    }
    if (championTargetOwner === "any") {
      return championUnits;
    }
    if (!localPlayerId) {
      return [];
    }
    if (championTargetOwner === "self") {
      return championUnits.filter((unit) => unit.ownerId === localPlayerId);
    }
    return championUnits.filter((unit) => unit.ownerId !== localPlayerId);
  }, [championTargetOwner, championUnits, localPlayerId]);
  const selectedChampion =
    selectedChampionId
      ? championUnits.find((unit) => unit.id === selectedChampionId) ?? null
      : null;
  const leadSeatIndex =
    view.public.players.length > 0
      ? (view.public.round - 1 + view.public.players.length) % view.public.players.length
      : 0;
  const leadPlayer = view.public.players.find((player) => player.seatIndex === leadSeatIndex) ?? null;
  const logCount = view.public.logs.length;
  const lastLogEntry = logCount > 0 ? view.public.logs[logCount - 1] : null;
  const lastLogKey = lastLogEntry ? buildLogKey(lastLogEntry) : null;
  const lastLogLabel = lastLogEntry
    ? formatGameEvent(lastLogEntry, playerNames, hexLabels, CARD_DEFS_BY_ID)
    : null;
  const pendingCombat = view.public.combat;
  const activeCombat = combatQueue[0] ?? null;
  const activeCombatSync =
    activeCombat && combatSync ? combatSync[activeCombat.id] ?? null : null;
  const hasPendingCardReveal =
    hasCardRevealBaseline.current && lastLogKey !== lastCardRevealKeyRef.current;
  const actionRevealInFlight = Boolean(
    activeCardReveal || cardRevealQueue.length > 0 || hasPendingCardReveal
  );
  const overlayBlockers = Boolean(pendingCombat || activeCombat || actionRevealInFlight);
  const showScoutReportModal = isScoutReportActive && !actionRevealInFlight;
  const pendingCombatHex = pendingCombat
    ? view.public.board.hexes[pendingCombat.hexKey] ?? null
    : null;
  const pendingCombatCoordLabel = pendingCombat
    ? formatHexLabel(pendingCombat.hexKey, hexLabels)
    : null;
  const pendingCombatTileLabel = formatTileLabel(pendingCombatHex?.tile);
  const pendingCombatLabel =
    pendingCombatCoordLabel && pendingCombatTileLabel
      ? `${pendingCombatCoordLabel} ${pendingCombatTileLabel}`
      : pendingCombatCoordLabel;
  const combatRetreatTargets = useMemo(() => {
    if (!pendingCombat || !localPlayerId) {
      return { hexKeys: [] as string[], edgeByHex: new Map<string, string>() };
    }
    const edgeKeys = pendingCombat.availableEdges[localPlayerId] ?? [];
    const edgeByHex = new Map<string, string>();
    const hexKeys: string[] = [];
    for (const edgeKey of edgeKeys) {
      let destination: string | null = null;
      try {
        const [from, to] = parseEdgeKey(edgeKey);
        destination = from === pendingCombat.hexKey ? to : to === pendingCombat.hexKey ? from : null;
      } catch {
        destination = null;
      }
      if (!destination || !view.public.board.hexes[destination]) {
        continue;
      }
      if (!edgeByHex.has(destination)) {
        edgeByHex.set(destination, edgeKey);
        hexKeys.push(destination);
      }
    }
    return { hexKeys, edgeByHex };
  }, [pendingCombat, localPlayerId, view.public.board.hexes]);
  const isCombatRetreatWaiting = Boolean(
    pendingCombat &&
      localPlayerId &&
      pendingCombat.waitingForPlayerIds.includes(localPlayerId)
  );
  const combatRetreatHexKeys = isCombatRetreatWaiting ? combatRetreatTargets.hexKeys : [];
  const combatRetreatPanel = useMemo(() => {
    if (!pendingCombat || !localPlayerId) {
      return null;
    }
    if (
      pendingCombat.attackers.playerId !== localPlayerId &&
      pendingCombat.defenders.playerId !== localPlayerId
    ) {
      return null;
    }
    const options = pendingCombat.availableEdges[localPlayerId] ?? [];
    const selection = pendingCombat.choices[localPlayerId] ?? null;
    const canAct = pendingCombat.waitingForPlayerIds.includes(localPlayerId);
    const labeledOptions = options
      .map((edgeKey) => {
        let destination: string | null = null;
        try {
          const [from, to] = parseEdgeKey(edgeKey);
          destination =
            from === pendingCombat.hexKey ? to : to === pendingCombat.hexKey ? from : null;
        } catch {
          destination = null;
        }
        if (!destination) {
          return null;
        }
        const label = hexLabels[destination] ?? destination;
        return { edgeKey, label };
      })
      .filter((entry): entry is { edgeKey: string; label: string } => Boolean(entry));
    return {
      hexLabel: pendingCombatLabel ?? pendingCombat.hexKey,
      options: labeledOptions,
      selection,
      canAct
    };
  }, [hexLabels, localPlayerId, pendingCombat, pendingCombatLabel]);
  const activeCombatHex = activeCombat
    ? view.public.board.hexes[activeCombat.start.hexKey] ?? null
    : null;
  const activeCombatCoordLabel = activeCombat
    ? formatHexLabel(activeCombat.start.hexKey, hexLabels)
    : null;
  const activeCombatTileLabel = formatTileLabel(activeCombatHex?.tile);
  const activeCombatLabel =
    activeCombatCoordLabel && activeCombatTileLabel
      ? `${activeCombatCoordLabel} ${activeCombatTileLabel}`
      : activeCombatCoordLabel;
  const isCapitalBattle = activeCombatHex?.tile === "capital";
  const actionRevealDurationMs = view.public.config.ACTION_REVEAL_DURATION_MS;
  const actionRevealHighlightPauseMs = Math.max(
    0,
    view.public.config.ACTION_REVEAL_HIGHLIGHT_PAUSE_MS
  );
  const rollRevealDurationMs = Math.max(
    1200,
    Math.min(actionRevealDurationMs, 1800)
  );
  const shouldHoldActionReveal =
    Boolean(activeCardReveal) && !isActionRevealOverlayVisible && actionRevealHighlightPauseMs > 0;
  const isActionPhase = view.public.phase === "round.action";
  const isStudyPhase = view.public.phase === "round.study";
  const isMarketPhase = view.public.phase === "round.market";
  const isCollectionPhase = view.public.phase === "round.collection";
  const isInteractivePhase =
    isActionPhase || isStudyPhase || isMarketPhase || isCollectionPhase;
  const showPhaseFocus = false;
  const marketOutroHoldMs = Math.max(
    1200,
    view.public.config.MARKET_ROLLOFF_DURATION_MS + 400
  );
  const shouldHoldMarketOverlay =
    !isMarketPhase && (Boolean(marketWinner) || marketOutroHold);
  const lastMarketCardIndex = view.public.market.currentRow.length - 1;
  const isLastMarketWinner =
    Boolean(marketWinner) &&
    typeof marketWinner?.cardIndex === "number" &&
    lastMarketCardIndex >= 0 &&
    marketWinner.cardIndex === lastMarketCardIndex;
  const shouldForceMarketOverlay = Boolean(isLastMarketWinner);
  const showMarketOverlay =
    !actionRevealInFlight &&
    ((isMarketPhase && (isMarketOverlayOpen || shouldForceMarketOverlay)) ||
      shouldHoldMarketOverlay);
  const canToggleMarketOverlay = isMarketPhase && !shouldForceMarketOverlay;
  const showCollectionOverlay =
    isCollectionPhase && isCollectionOverlayOpen && !actionRevealInFlight;
  const canShowHandPanel =
    Boolean(view.private) && isActionPhase && !showMarketOverlay;
  const showVictoryScreen = Boolean(view.public.winnerPlayerId && isVictoryVisible);
  const canDeclareAction =
    status === "connected" &&
    Boolean(localPlayer) &&
    isActionPhase &&
    Boolean(actionStep) &&
    isLocalWaiting &&
    !localPlayer?.doneThisRound;
  const isBoardTargeting = boardPickMode !== "none" || isCombatRetreatWaiting;
  const isEdgePickMode =
    !isCombatRetreatWaiting && (boardPickMode === "bridgeEdge" || boardPickMode === "cardEdge");
  const availableMana = localPlayer?.resources.mana ?? 0;
  const availableGold = localPlayer?.resources.gold ?? 0;
  const maxMana = view.public.config.MAX_MANA;
  let actionHint: string | null = null;
  if (status !== "connected") {
    actionHint = "Connect to submit actions.";
  } else if (!localPlayer) {
    actionHint = "Spectators cannot submit actions.";
  } else if (!isActionPhase) {
    actionHint = "Actions are available during the action phase.";
  } else if (!actionStep) {
    actionHint = "Resolving actions...";
  } else if (!isLocalEligible) {
    if (localPlayer.doneThisRound) {
      actionHint = "You passed this round.";
    } else if (availableMana < 1) {
      actionHint = "No mana left to act this round.";
    } else {
      actionHint = "Not eligible to act this step.";
    }
  } else if (!isLocalWaiting) {
    actionHint = "Action submitted. Waiting on other players.";
  }
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
  const resolvedMarchIncludeChampions =
    marchIncludeChampions ?? marchForceCount === null;
  const requiredHandSelectionCount = Math.max(discardFromHandCount, burnFromHandCount);
  const hasRequiredHandTargets =
    requiredHandSelectionCount === 0 ||
    selectedHandCardIds.length === requiredHandSelectionCount;
  const hasValidTargetCount = useMemo(() => {
    if (!selectedCardDef) {
      return true;
    }
    const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
    if (cardTargetKind === "multiEdge") {
      const edgeKeys = new Set(getTargetStringArray(targetRecord, "edgeKeys"));
      const edgeKey = getTargetString(targetRecord, "edgeKey");
      if (edgeKey) {
        edgeKeys.add(edgeKey);
      }
      const count = edgeKeys.size;
      const minEdges =
        typeof targetSpec.minEdges === "number"
          ? Math.max(0, Math.floor(targetSpec.minEdges))
          : 1;
      const maxEdges =
        typeof targetSpec.maxEdges === "number"
          ? Math.max(0, Math.floor(targetSpec.maxEdges))
          : Number.POSITIVE_INFINITY;
      return count >= minEdges && count <= maxEdges;
    }
    if (cardTargetKind === "multiPath") {
      const paths = getTargetPaths(targetRecord);
      const count = paths.length;
      const minPaths =
        typeof targetSpec.minPaths === "number"
          ? Math.max(0, Math.floor(targetSpec.minPaths))
          : 1;
      const maxPaths =
        typeof targetSpec.maxPaths === "number"
          ? Math.max(0, Math.floor(targetSpec.maxPaths))
          : Number.POSITIVE_INFINITY;
      return count >= minPaths && count <= maxPaths;
    }
    if (cardTargetKind === "player") {
      if (!selectedTargetPlayerId) {
        return false;
      }
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "enemy";
      if (!localPlayerId) {
        return owner === "any";
      }
      if (owner === "self") {
        return selectedTargetPlayerId === localPlayerId;
      }
      if (owner === "enemy") {
        return selectedTargetPlayerId !== localPlayerId;
      }
      return owner === "any";
    }
    return true;
  }, [cardTargetKind, localPlayerId, selectedCardDef, selectedTargetPlayerId, targetRecord]);
  const canPlayCard =
    canSubmitAction &&
    trimmedCardId.length > 0 &&
    targetsError === null &&
    hasRequiredHandTargets &&
    hasValidTargetCount;
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
      action:
        marchForceCount !== null
          ? {
              kind: "march",
              from: marchFrom.trim(),
              to: marchTo.trim(),
              forceCount: marchForceCount,
              includeChampions: resolvedMarchIncludeChampions
            }
          : {
              kind: "march",
              from: marchFrom.trim(),
              to: marchTo.trim(),
              includeChampions: resolvedMarchIncludeChampions
            }
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
  const toggleMarketOverlay = useCallback(() => {
    setMarketAutoOpenPending(false);
    setIsMarketOverlayOpen((current) => !current);
  }, []);
  const toggleCollectionOverlay = useCallback(() => {
    setCollectionAutoOpenPending(false);
    setIsCollectionOverlayOpen((current) => !current);
  }, []);
  const handleVictoryClose = () => {
    setIsVictoryVisible(false);
  };
  const openDock = (tab: "log" | "effects") => {
    setInfoDockTab(tab);
    setIsInfoDockOpen(true);
  };
  const collapseSidebar = () => {
    setIsSidebarCollapsed(true);
  };
  const expandSidebar = () => {
    setIsSidebarCollapsed(false);
  };
  const handleCombatClose = () => {
    setCombatQueue((queue) => queue.slice(1));
  };
  const handleCombatRoll = (roundIndex: number) => {
    if (!activeCombat || !onCombatRoll) {
      return;
    }
    onCombatRoll(activeCombat.id, roundIndex);
  };
  const handleCombatRetreat = (hexKey: string, edgeKey: string | null) => {
    if (!onSubmitCombatRetreat) {
      return;
    }
    onSubmitCombatRetreat(hexKey, edgeKey);
  };
  const clearCardSelection = () => {
    setCardInstanceId("");
    setCardTargetsRaw("");
    setHandPickerMode("none");
    setBoardPickMode("none");
    setPendingEdgeStart(null);
    setPendingStackFrom(null);
    setPendingPath([]);
    setPendingHexPair(null);
  };

  const handleMarchFromChange = (value: string) => {
    setMarchFrom(value);
    if (value === "" || value !== marchFrom) {
      setMarchTo("");
    }
    setMarchForceCount(null);
    setMarchIncludeChampions(null);
  };

  useEffect(() => {
    if (cardInstanceId && !handCards.some((card) => card.id === cardInstanceId)) {
      clearCardSelection();
    }
  }, [cardInstanceId, handCards]);

  useEffect(() => {
    if (handPickerMode === "none") {
      return;
    }
    const shouldClose =
      (handPickerMode === "topdeck" && topdeckCount === 0) ||
      (handPickerMode === "discard" && discardFromHandCount === 0) ||
      (handPickerMode === "burn" && burnFromHandCount === 0);
    if (shouldClose) {
      setHandPickerMode("none");
    }
  }, [handPickerMode, topdeckCount, discardFromHandCount, burnFromHandCount]);

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
    setPendingHexPair(null);
    if (mode === "bridgeEdge") {
      setBasicActionIntent("bridge");
    } else if (mode === "marchFrom" || mode === "marchTo") {
      setBasicActionIntent("march");
    }
  };

  const handleBasicActionIntentChange = (intent: BasicActionIntent) => {
    if (intent !== "none" && cardInstanceId) {
      clearCardSelection();
    }
    if (intent === "bridge") {
      setBoardPickModeSafe("bridgeEdge");
      return;
    }
    if (intent === "march") {
      setBoardPickModeSafe("marchFrom");
      return;
    }
    setBasicActionIntent(intent);
    if (boardPickMode !== "none") {
      setBoardPickModeSafe("none");
    }
  };

  useEffect(() => {
    if (!isActionPhase) {
      setBoardPickMode("none");
      setPendingEdgeStart(null);
      setPendingStackFrom(null);
      setPendingPath([]);
      setPendingHexPair(null);
      setCardInstanceId("");
      setCardTargetsRaw("");
      setReinforceHex("");
      setHandPickerMode("none");
      setIsHandPanelOpen(true);
      setBasicActionIntent("none");
      setMarchForceCount(null);
      setMarchIncludeChampions(null);
    }
  }, [isActionPhase]);

  useEffect(() => {
    setBasicActionIntent("none");
    setBoardPickMode("none");
    setPendingEdgeStart(null);
    setPendingStackFrom(null);
    setPendingPath([]);
    setPendingHexPair(null);
    setEdgeKey("");
    setMarchFrom("");
    setMarchTo("");
    setMarchForceCount(null);
    setMarchIncludeChampions(null);
    setReinforceHex("");
  }, [view.public.round]);

  useEffect(() => {
    const allowSplit = marchForceMax > 1 || marchChampionCount > 0;
    if (!marchFrom || !allowSplit) {
      if (marchForceCount !== null) {
        setMarchForceCount(null);
      }
      return;
    }
    if (marchForceCount !== null && marchForceCount > marchForceMax) {
      setMarchForceCount(marchForceMax);
    }
  }, [marchChampionCount, marchForceCount, marchForceMax, marchFrom]);

  useEffect(() => {
    const allowSplit =
      cardMoveForceMax > 1 || cardMoveChampionCount > 0;
    if (!cardMoveSupportsSplit || !cardMoveStartHex || !allowSplit) {
      if (cardMoveForceCount !== null) {
        setCardForceCount(null);
      }
      return;
    }
    if (cardMoveForceCount !== null && cardMoveForceCount > cardMoveForceMax) {
      setCardForceCount(cardMoveForceMax);
    }
  }, [
    cardMoveForceCount,
    cardMoveForceMax,
    cardMoveChampionCount,
    cardMoveStartHex,
    cardMoveSupportsSplit
  ]);

  useEffect(() => {
    if (isMarketPhase) {
      if (!wasMarketPhaseRef.current) {
        if (marketOverlayHoldTimeout.current) {
          window.clearTimeout(marketOverlayHoldTimeout.current);
          marketOverlayHoldTimeout.current = null;
        }
        setMarketOutroHold(false);
        if (overlayBlockers) {
          setMarketAutoOpenPending(true);
          setIsMarketOverlayOpen(false);
        } else {
          setIsMarketOverlayOpen(true);
        }
      }
      wasMarketPhaseRef.current = true;
      return;
    }

    if (wasMarketPhaseRef.current) {
      wasMarketPhaseRef.current = false;
      setMarketAutoOpenPending(false);
      if (!isMarketOverlayOpen) {
        if (marketOverlayHoldTimeout.current) {
          window.clearTimeout(marketOverlayHoldTimeout.current);
          marketOverlayHoldTimeout.current = null;
        }
        setMarketOutroHold(false);
        return;
      }

      setMarketOutroHold(true);
      if (marketOverlayHoldTimeout.current) {
        window.clearTimeout(marketOverlayHoldTimeout.current);
      }
      marketOverlayHoldTimeout.current = window.setTimeout(() => {
        setMarketOutroHold(false);
        setIsMarketOverlayOpen(false);
        marketOverlayHoldTimeout.current = null;
      }, marketOutroHoldMs);
      return () => {
        if (marketOverlayHoldTimeout.current) {
          window.clearTimeout(marketOverlayHoldTimeout.current);
          marketOverlayHoldTimeout.current = null;
        }
      };
    }

    if (marketOverlayHoldTimeout.current) {
      window.clearTimeout(marketOverlayHoldTimeout.current);
      marketOverlayHoldTimeout.current = null;
    }
    setMarketOutroHold(false);
  }, [isMarketPhase, isMarketOverlayOpen, marketOutroHoldMs, overlayBlockers]);

  useEffect(() => {
    if (isCollectionPhase) {
      if (!wasCollectionPhaseRef.current) {
        if (overlayBlockers) {
          setCollectionAutoOpenPending(true);
          setIsCollectionOverlayOpen(false);
        } else {
          setIsCollectionOverlayOpen(true);
        }
      }
      wasCollectionPhaseRef.current = true;
      return;
    }
    if (wasCollectionPhaseRef.current) {
      wasCollectionPhaseRef.current = false;
      setCollectionAutoOpenPending(false);
      setIsCollectionOverlayOpen(false);
    }
  }, [isCollectionPhase, overlayBlockers]);

  useEffect(() => {
    if (!isMarketPhase || !marketAutoOpenPending || overlayBlockers) {
      return;
    }
    setMarketAutoOpenPending(false);
    setIsMarketOverlayOpen(true);
  }, [isMarketPhase, marketAutoOpenPending, overlayBlockers]);

  useEffect(() => {
    if (!isCollectionPhase || !collectionAutoOpenPending || overlayBlockers) {
      return;
    }
    setCollectionAutoOpenPending(false);
    setIsCollectionOverlayOpen(true);
  }, [collectionAutoOpenPending, isCollectionPhase, overlayBlockers]);

  useEffect(() => {
    if (!canToggleMarketOverlay) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key.toLowerCase() !== "m") {
        return;
      }
      event.preventDefault();
      toggleMarketOverlay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canToggleMarketOverlay, toggleMarketOverlay]);

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
    const previousPhase = lastPhaseRef.current;
    const previousRound = lastRoundRef.current;
    if (phase === previousPhase && round === previousRound) {
      return;
    }
    lastPhaseRef.current = phase;
    lastRoundRef.current = round;
    if (!phase.startsWith("round.")) {
      return;
    }
    if (round !== previousRound) {
      playSfx("bell");
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
      playSfx("bell");
      setAgeCue({ label: formatAgeCueLabel(age), round, kind: "start" });
      setAgeCueKey((value) => value + 1);
      hasAgeIntroShown.current = true;
      lastAgeRef.current = age;
      writeStoredAgeCue(roomId, age);
      return;
    }
    if (age === lastAgeRef.current) {
      return;
    }
    lastAgeRef.current = age;
    playSfx("bell");
    setAgeCue({ label: formatAgeCueLabel(age), round, kind: "shift" });
    setAgeCueKey((value) => value + 1);
    hasAgeIntroShown.current = true;
    writeStoredAgeCue(roomId, age);
  }, [roomId, view.public.market.age, view.public.phase, view.public.round]);

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
    if (marketRowKeyRef.current === marketRowKey) {
      return;
    }
    marketRowKeyRef.current = marketRowKey;
    setMarketWinnerHistory({});
  }, [marketRowKey]);

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
      lastMarketEventIndex.current = -1;
      return;
    }
    if (logs.length - 1 < lastMarketEventIndex.current) {
      lastMarketEventIndex.current = logs.length - 1;
      return;
    }
    let latestWinner: MarketWinnerHighlight | null = null;
    const historyUpdates: Record<number, MarketWinnerHighlight> = {};
    for (let i = lastMarketEventIndex.current + 1; i < logs.length; i += 1) {
      const event = logs[i];
      if (event.type !== "market.buy" && event.type !== "market.pass") {
        continue;
      }
      const payload = event.payload ?? {};
      const cardId = typeof payload.cardId === "string" ? payload.cardId : "unknown";
      const cardIndex = typeof payload.cardIndex === "number" ? payload.cardIndex : null;
      const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
      const playerName = playerId ? playerNames.get(playerId) ?? playerId : "Unknown";
      const amount = typeof payload.amount === "number" ? payload.amount : null;
      const passPot = typeof payload.passPot === "number" ? payload.passPot : null;
      const rollOffRaw = Array.isArray(payload.rollOff) ? payload.rollOff : null;
      const rollOff =
        rollOffRaw
          ?.map((round) => {
            if (!round || typeof round !== "object" || Array.isArray(round)) {
              return null;
            }
            const cleaned = Object.fromEntries(
              Object.entries(round).filter(([, value]) => typeof value === "number")
            ) as Record<string, number>;
            return Object.keys(cleaned).length > 0 ? cleaned : null;
          })
          .filter((round): round is Record<string, number> => Boolean(round)) ?? null;
      const winner: MarketWinnerHighlight = {
        cardId,
        cardIndex,
        playerId,
        playerName,
        kind: event.type === "market.buy" ? "buy" : "pass",
        amount,
        passPot,
        rollOff: rollOff && rollOff.length > 0 ? rollOff : null,
        rollOffKey: i
      };
      latestWinner = winner;
      if (typeof cardIndex === "number") {
        historyUpdates[cardIndex] = winner;
      }
    }
    if (Object.keys(historyUpdates).length > 0) {
      setMarketWinnerHistory((current) => ({ ...current, ...historyUpdates }));
    }
    if (latestWinner) {
      setMarketWinner(latestWinner);
    }
    lastMarketEventIndex.current = logs.length - 1;
  }, [view.public.logs, playerNames]);

  useEffect(() => {
    const logs = view.public.logs;
    if (!hasRollLogBaseline.current) {
      hasRollLogBaseline.current = true;
      if (logs.length > 0) {
        lastRollEventIndex.current = logs.length - 1;
        return;
      }
    }
    if (logs.length === 0) {
      lastRollEventIndex.current = -1;
      setRollReveal(null);
      return;
    }
    if (logs.length - 1 < lastRollEventIndex.current) {
      lastRollEventIndex.current = logs.length - 1;
      setRollReveal(null);
      return;
    }
    let latestRoll: DiceRollOverlayData | null = null;
    for (let i = lastRollEventIndex.current + 1; i < logs.length; i += 1) {
      const event = logs[i];
      if (event.type !== "card.rollGold") {
        continue;
      }
      const payload = event.payload ?? {};
      const roll = typeof payload.roll === "number" ? payload.roll : null;
      if (roll === null) {
        continue;
      }
      const sides = typeof payload.sides === "number" ? payload.sides : 6;
      const amount = typeof payload.amount === "number" ? payload.amount : null;
      const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
      const playerName = playerId ? playerNames.get(playerId) ?? playerId : "Unknown player";
      const cardId = typeof payload.cardId === "string" ? payload.cardId : null;
      const cardName = cardId ? CARD_DEFS_BY_ID.get(cardId)?.name ?? cardId : "Gold roll";
      latestRoll = {
        key: `${i}-${roll}`,
        playerName,
        cardName,
        roll,
        sides,
        amount
      };
    }
    if (latestRoll) {
      setRollReveal(latestRoll);
    }
    lastRollEventIndex.current = logs.length - 1;
  }, [playerNames, view.public.logs]);

  useEffect(() => {
    const logs = view.public.logs;
    if (!hasCardRevealBaseline.current) {
      hasCardRevealBaseline.current = true;
      lastCardRevealIndex.current = logs.length - 1;
      lastCardRevealKeyRef.current =
        logs.length > 0 ? buildLogKey(logs[logs.length - 1]) : null;
      return;
    }
    if (logs.length === 0) {
      lastCardRevealIndex.current = -1;
      lastCardRevealKeyRef.current = null;
      setCardRevealQueue([]);
      setActiveCardReveal(null);
      return;
    }
    const lastKey = lastCardRevealKeyRef.current;
    let startIndex = 0;
    if (lastKey) {
      let foundIndex = -1;
      for (let i = logs.length - 1; i >= 0; i -= 1) {
        if (buildLogKey(logs[i]) === lastKey) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex >= 0) {
        if (foundIndex === logs.length - 1) {
          return;
        }
        startIndex = foundIndex + 1;
      } else {
        setCardRevealQueue([]);
        setActiveCardReveal(null);
        startIndex = Math.max(0, logs.length - 1);
      }
    } else {
      startIndex = Math.max(0, logs.length - 1);
    }
    const newReveals: ActionCardReveal[] = [];
    for (let i = startIndex; i < logs.length; i += 1) {
      const event = logs[i];
      if (event.type.startsWith("action.card.")) {
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
        const targetInfo = describeRevealTargets(
          targetRecord,
          view.public.board,
          hexLabels,
          CARD_DEFS_BY_ID
        );
        const movePaths = getTargetPaths(targetRecord);
        const moveMeta =
          movePaths.length > 0
            ? resolveMoveUnitMeta(targetRecord, view.public.board, CARD_DEFS_BY_ID)
            : { unitKind: null, unitLabel: null };
        newReveals.push({
          key: `${i}-${cardId}`,
          playerId,
          playerName: playerId ? playerNames.get(playerId) ?? playerId : "Unknown player",
          cardName: cardDef?.name ?? cardId,
          cardId,
          cardDef: cardDef ?? null,
          cardType: cardDef?.type ?? null,
          initiative: cardDef?.initiative ?? null,
          costLabel: buildCardCostLabel(cardDef),
          targetLines: targetInfo.targetLines,
          targetHexKeys: targetInfo.targetHexKeys,
          targetEdgeKeys: targetInfo.targetEdgeKeys,
          movePaths,
          moveUnitKind: moveMeta.unitKind,
          moveUnitLabel: moveMeta.unitLabel
        });
        continue;
      }
      if (event.type.startsWith("action.basic.")) {
        const payload = event.payload ?? {};
        const playerId = typeof payload.playerId === "string" ? payload.playerId : null;
        const actionRaw = payload.action;
        if (!actionRaw || typeof actionRaw !== "object" || Array.isArray(actionRaw)) {
          continue;
        }
        const kind = (actionRaw as { kind?: unknown }).kind;
        if (kind !== "buildBridge" && kind !== "march" && kind !== "capitalReinforce") {
          continue;
        }
        const action = actionRaw as BasicAction;
        const basicReveal = describeBasicAction(action, hexLabels);
        const movePaths = action.kind === "march" ? [[action.from, action.to]] : [];
        const moveUnitKind =
          action.kind === "march"
            ? action.includeChampions
              ? "champion"
              : "force"
            : null;
        const moveUnitLabel =
          action.kind === "march" && typeof action.forceCount === "number"
            ? action.includeChampions && action.forceCount === 0
              ? "C"
              : String(action.forceCount)
            : null;
        newReveals.push({
          key: `${i}-${event.type}`,
          playerId,
          playerName: playerId ? playerNames.get(playerId) ?? playerId : "Unknown player",
          cardName: basicReveal.label,
          cardId: event.type,
          cardDef: null,
          cardType: "Basic action",
          initiative: null,
          costLabel: null,
          targetLines: basicReveal.targets.targetLines,
          targetHexKeys: basicReveal.targets.targetHexKeys,
          targetEdgeKeys: basicReveal.targets.targetEdgeKeys,
          movePaths,
          moveUnitKind,
          moveUnitLabel
        });
      }
    }
    lastCardRevealIndex.current = logs.length - 1;
    lastCardRevealKeyRef.current = buildLogKey(logs[logs.length - 1]);
    if (newReveals.length > 0) {
      setCardRevealQueue((queue) => [...queue, ...newReveals]);
    }
  }, [hexLabels, playerNames, view.public.board, view.public.logs]);

  useEffect(() => {
    const logs = view.public.logs;
    if (!hasCombatLogBaseline.current) {
      hasCombatLogBaseline.current = true;
      lastCombatEndIndex.current = logs.length - 1;
      setCombatQueue([]);
      return;
    }
    if (logs.length === 0) {
      lastCombatEndIndex.current = -1;
      setCombatQueue([]);
      return;
    }
    if (logs.length - 1 < lastCombatEndIndex.current) {
      lastCombatEndIndex.current = logs.length - 1;
      setCombatQueue([]);
      return;
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
    const baseHoldMs = 3500;
    let holdMs = baseHoldMs;
    if (marketWinner.rollOff && marketWinner.rollOff.length > 0) {
      const rollDurationMs = Math.max(
        0,
        view.public.config.MARKET_ROLLOFF_DURATION_MS
      );
      // Keep these roll-off timing values aligned with MarketPanel.
      const rollDelayBaseMs = 120;
      const rollRoundGapMs = 260;
      const rollGapMs = 0;
      let nextStartMs = rollDelayBaseMs;
      let rollOffDurationMs = rollDelayBaseMs;
      for (const round of marketWinner.rollOff) {
        const rollCount = Object.keys(round).length;
        if (rollCount === 0) {
          continue;
        }
        const lastIndex = Math.max(rollCount - 1, 0);
        const endMs = nextStartMs + lastIndex * rollGapMs + rollDurationMs;
        rollOffDurationMs = endMs;
        nextStartMs = endMs + rollRoundGapMs;
      }
      const winnerPauseMs = 1400;
      holdMs = Math.max(baseHoldMs, rollOffDurationMs + winnerPauseMs);
    }
    const timeout = window.setTimeout(() => {
      setMarketWinner(null);
    }, holdMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [marketWinner, view.public.config.MARKET_ROLLOFF_DURATION_MS]);

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
      setIsActionRevealOverlayVisible(false);
      return;
    }
    setIsActionRevealOverlayVisible(true);
    const overlayTimeout = window.setTimeout(() => {
      setIsActionRevealOverlayVisible(false);
    }, actionRevealDurationMs);
    const revealTimeout = window.setTimeout(() => {
      setActiveCardReveal(null);
    }, actionRevealDurationMs + actionRevealHighlightPauseMs);
    return () => {
      window.clearTimeout(overlayTimeout);
      window.clearTimeout(revealTimeout);
    };
  }, [
    activeCardReveal,
    actionRevealDurationMs,
    actionRevealHighlightPauseMs,
    cardRevealKey
  ]);

  useEffect(() => {
    if (!rollReveal) {
      if (rollRevealTimeout.current) {
        window.clearTimeout(rollRevealTimeout.current);
        rollRevealTimeout.current = null;
      }
      return;
    }
    if (rollRevealTimeout.current) {
      window.clearTimeout(rollRevealTimeout.current);
    }
    rollRevealTimeout.current = window.setTimeout(() => {
      setRollReveal(null);
      rollRevealTimeout.current = null;
    }, rollRevealDurationMs);
    return () => {
      if (rollRevealTimeout.current) {
        window.clearTimeout(rollRevealTimeout.current);
        rollRevealTimeout.current = null;
      }
    };
  }, [rollReveal, rollRevealDurationMs]);

  const actionAnimations = useMemo<BoardActionAnimation[]>(() => {
    if (!activeCardReveal) {
      return [];
    }
    const animations: BoardActionAnimation[] = [];
    activeCardReveal.movePaths.forEach((path, index) => {
      animations.push({
        id: `${activeCardReveal.key}-move-${index}`,
        kind: "move",
        path,
        playerId: activeCardReveal.playerId,
        unitKind: activeCardReveal.moveUnitKind ?? undefined,
        unitLabel: activeCardReveal.moveUnitLabel ?? undefined
      });
    });
    activeCardReveal.targetEdgeKeys.forEach((edgeKey, index) => {
      animations.push({
        id: `${activeCardReveal.key}-edge-${index}`,
        kind: "edge",
        edgeKey,
        playerId: activeCardReveal.playerId
      });
    });
    if (animations.length === 0) {
      activeCardReveal.targetHexKeys.forEach((hexKey, index) => {
        animations.push({
          id: `${activeCardReveal.key}-hex-${index}`,
          kind: "hex",
          hexKey,
          playerId: activeCardReveal.playerId
        });
      });
    }
    return animations;
  }, [activeCardReveal]);

  const applyCardMoveUnitSelection = (targets: Record<string, unknown>) => {
    if (!cardMoveSupportsSplit) {
      return targets;
    }
    const nextTargets = { ...targets };
    if (cardMoveForceCount !== null) {
      nextTargets.forceCount = cardMoveForceCount;
    }
    const includeChampions = getTargetBoolean(targetRecord, "includeChampions");
    if (includeChampions !== null) {
      nextTargets.includeChampions = includeChampions;
    }
    return nextTargets;
  };

  const setCardTargetsObject = (targets: Record<string, unknown> | null) => {
    if (!targets) {
      setCardTargetsRaw("");
      return;
    }
    const nextTargets = applyCardMoveUnitSelection(targets);
    setCardTargetsRaw(JSON.stringify(nextTargets));
  };

  const setCardForceCount = (value: number | null) => {
    const nextTargets = targetRecord ? { ...targetRecord } : {};
    if (value === null) {
      delete nextTargets.forceCount;
    } else {
      nextTargets.forceCount = value;
    }
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
  };

  const setCardIncludeChampions = (value: boolean) => {
    const nextTargets = targetRecord ? { ...targetRecord } : {};
    nextTargets.includeChampions = value;
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
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

  const clearEdgeMoveTargets = () => {
    if (!targetRecord) {
      return;
    }
    const nextTargets = { ...targetRecord };
    delete nextTargets.from;
    delete nextTargets.to;
    delete nextTargets.path;
    delete nextTargets.forceCount;
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
    setPendingStackFrom(null);
    setPendingPath([]);
  };
  const clearMultiEdgeTargets = () => {
    const nextTargets = targetRecord ? { ...targetRecord } : {};
    delete nextTargets.edgeKey;
    delete nextTargets.edgeKeys;
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
    setPendingEdgeStart(null);
  };

  const clearMultiPathTargets = () => {
    const nextTargets = targetRecord ? { ...targetRecord } : {};
    delete nextTargets.path;
    delete nextTargets.paths;
    const hasTargets = Object.keys(nextTargets).length > 0;
    setCardTargetsRaw(hasTargets ? JSON.stringify(nextTargets) : "");
    setPendingPath([]);
  };

  const removeMultiPathAt = (index: number) => {
    if (index < 0 || cardTargetKind !== "multiPath") {
      return;
    }
    const nextPaths = multiPathTargets.filter((_, pathIndex) => pathIndex !== index);
    setCardTargetsObject(nextPaths.length > 0 ? { paths: nextPaths } : null);
    const removed = multiPathTargets[index];
    if (removed && arePathsEqual(removed, pendingPath)) {
      setPendingPath([]);
    }
  };

  const isAdjacent = (from: string, to: string) => {
    try {
      return areAdjacent(parseHexKey(from), parseHexKey(to));
    } catch {
      return false;
    }
  };

  const arePathsEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  };

  const isMoveAdjacent = (from: string, to: string) => {
    if (isAdjacent(from, to)) {
      return true;
    }
    return linkedNeighborsByHex.get(from)?.has(to) ?? false;
  };

  const handleBoardHexClick = (hexKey: string) => {
    if (pendingCombat) {
      if (isCombatRetreatWaiting) {
        const edgeKey = combatRetreatTargets.edgeByHex.get(hexKey);
        if (edgeKey) {
          handleCombatRetreat(pendingCombat.hexKey, edgeKey);
        }
      }
      return;
    }
    const isPickable =
      boardPickMode === "none" ||
      boardValidHexKeys.includes(hexKey) ||
      startHexKeys.includes(hexKey);
    if (!isPickable) {
      return;
    }
    setSelectedHexKey(hexKey);

    if (
      (boardPickMode === "none" || boardPickMode === "cardChampion") &&
      cardTargetKind === "champion" &&
      selectedCardDef
    ) {
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
      handleMarchFromChange(hexKey);
      setBoardPickMode("marchTo");
      return;
    }
    if (boardPickMode === "marchTo") {
      setMarchTo(hexKey);
      return;
    }
    if (boardPickMode === "bridgeEdge" || boardPickMode === "cardEdge") {
      const isCardEdge = boardPickMode === "cardEdge";
      const isMultiEdge = isCardEdge && cardTargetKind === "multiEdge";
      if (!pendingEdgeStart || pendingEdgeStart === hexKey) {
        setPendingEdgeStart(hexKey);
        if (isCardEdge && !isMultiEdge) {
          setCardTargetsObject(null);
        }
        return;
      }
      if (!isAdjacent(pendingEdgeStart, hexKey)) {
        setPendingEdgeStart(hexKey);
        if (isCardEdge && !isMultiEdge) {
          setCardTargetsObject(null);
        }
        return;
      }
      const edge = getBridgeKey(pendingEdgeStart, hexKey);
      if (isCardEdge) {
        if (isMultiEdge) {
          const currentEdges = getTargetStringArray(targetRecord, "edgeKeys");
          const nextEdges = currentEdges.includes(edge)
            ? currentEdges.filter((entry) => entry !== edge)
            : [...currentEdges, edge];
          const targetSpec = selectedCardDef?.targetSpec as Record<string, unknown> | undefined;
          const maxEdges =
            typeof targetSpec?.maxEdges === "number" ? Math.floor(targetSpec.maxEdges) : null;
          const limited =
            maxEdges && maxEdges > 0 && nextEdges.length > maxEdges
              ? nextEdges.slice(nextEdges.length - maxEdges)
              : nextEdges;
          setCardTargetsObject(limited.length > 0 ? { edgeKeys: limited } : null);
        } else {
          setCardTargetsObject({ edgeKey: edge });
        }
      } else {
        setEdgeKey(edge);
      }
      setPendingEdgeStart(null);
      return;
    }
    if (boardPickMode === "cardStack") {
      const edgePayload =
        cardTargetKind === "edge" && moveStackEffect
          ? buildEdgeTargetPayload(targetRecord)
          : null;
      if (cardTargetKind === "edge" && moveStackEffect && !edgePayload) {
        return;
      }
      if (!pendingStackFrom || pendingStackFrom === hexKey) {
        setPendingStackFrom(hexKey);
        setCardTargetsObject(edgePayload);
        return;
      }
      const nextTargets: Record<string, unknown> = {
        from: pendingStackFrom,
        to: hexKey,
        ...(edgePayload ?? {})
      };
      setCardTargetsObject(nextTargets);
      setPendingStackFrom(null);
      return;
    }
    if (boardPickMode === "cardPath") {
      if (cardTargetKind === "multiPath") {
        setPendingPath((current) => {
          if (current.length === 0) {
            return [hexKey];
          }
          const last = current[current.length - 1];
          if (last === hexKey) {
            return current;
          }
          const currentPaths = getTargetPaths(targetRecord);
          if (!isMoveAdjacent(last, hexKey)) {
            return [hexKey];
          }
          const next = [...current, hexKey];
          const shouldReplace =
            current.length >= 2 &&
            currentPaths.length > 0 &&
            arePathsEqual(currentPaths[currentPaths.length - 1], current);
          const basePaths = shouldReplace ? currentPaths.slice(0, -1) : currentPaths;
          const nextPaths = next.length >= 2 ? [...basePaths, next] : basePaths;
          setCardTargetsObject(nextPaths.length > 0 ? { paths: nextPaths } : null);
          return next;
        });
        return;
      }
      setPendingPath((current) => {
        if (current.length === 0) {
          const next = [hexKey];
          const edgePayload =
            cardTargetKind === "edge" && moveStackEffect
              ? buildEdgeTargetPayload(targetRecord)
              : null;
          setCardTargetsObject(edgePayload);
          return next;
        }
        const last = current[current.length - 1];
        if (last === hexKey) {
          return current;
        }
        if (!isMoveAdjacent(last, hexKey)) {
          const next = [hexKey];
          const edgePayload =
            cardTargetKind === "edge" && moveStackEffect
              ? buildEdgeTargetPayload(targetRecord)
              : null;
          setCardTargetsObject(edgePayload);
          return next;
        }
        const next = [...current, hexKey];
        if (next.length >= 2) {
          const edgePayload =
            cardTargetKind === "edge" && moveStackEffect
              ? buildEdgeTargetPayload(targetRecord)
              : null;
          const nextTargets: Record<string, unknown> = { path: next, ...(edgePayload ?? {}) };
          setCardTargetsObject(nextTargets);
        }
        return next;
      });
      return;
    }
    if (boardPickMode === "cardHexPair") {
      if (!selectedCardDef || cardTargetKind !== "hexPair") {
        return;
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const allowSame = targetSpec.allowSame === true;
      if (!pendingHexPair) {
        setPendingHexPair(hexKey);
        setCardTargetsObject(null);
        return;
      }
      if (pendingHexPair === hexKey) {
        if (allowSame) {
          setCardTargetsObject({ hexKeys: [hexKey, hexKey] });
        } else {
          setCardTargetsObject(null);
        }
        setPendingHexPair(null);
        return;
      }
      setCardTargetsObject({ hexKeys: [pendingHexPair, hexKey] });
      setPendingHexPair(null);
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
      setBoardPickModeSafe("none");
      return;
    }
    if (boardPickMode === "cardEdge") {
      if (cardTargetKind === "multiEdge") {
        const currentEdges = getTargetStringArray(targetRecord, "edgeKeys");
        const nextEdges = currentEdges.includes(edgeKey)
          ? currentEdges.filter((entry) => entry !== edgeKey)
          : [...currentEdges, edgeKey];
        const targetSpec = selectedCardDef?.targetSpec as Record<string, unknown> | undefined;
        const maxEdges =
          typeof targetSpec?.maxEdges === "number" ? Math.floor(targetSpec.maxEdges) : null;
        const limited =
          maxEdges && maxEdges > 0 && nextEdges.length > maxEdges
            ? nextEdges.slice(nextEdges.length - maxEdges)
            : nextEdges;
        setCardTargetsObject(limited.length > 0 ? { edgeKeys: limited } : null);
      } else {
        setCardTargetsObject({ edgeKey });
      }
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
    if (pendingHexPair) {
      keys.add(pendingHexPair);
    }
    if (cardTargetKind === "hexPair") {
      const selectedPair = getTargetStringArray(targetRecord, "hexKeys");
      selectedPair.forEach((hexKey) => keys.add(hexKey));
    }
    if (cardTargetKind === "multiPath") {
      const selectedPaths = getTargetPaths(targetRecord);
      selectedPaths.forEach((path) => {
        path.forEach((hexKey) => keys.add(hexKey));
      });
    }
    for (const key of pendingPath) {
      keys.add(key);
    }
    return Array.from(keys);
  }, [cardTargetKind, pendingEdgeStart, pendingHexPair, pendingPath, pendingStackFrom, targetRecord]);

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
    const getLocalUnitsAt = (key: string) => {
      const hex = boardHexes[key];
      if (!hex) {
        return { forceUnits: [] as string[], championUnits: [] as string[] };
      }
      const unitIds = hex.occupants[localPlayerId] ?? [];
      const forceUnits: string[] = [];
      const championUnits: string[] = [];
      for (const unitId of unitIds) {
        const unit = board.units[unitId];
        if (!unit) {
          continue;
        }
        if (unit.kind === "force") {
          forceUnits.push(unitId);
        } else if (unit.kind === "champion") {
          championUnits.push(unitId);
        }
      }
      return { forceUnits, championUnits };
    };
    const canBypassBridges = (
      key: string,
      forceCount: number | null,
      includeChampions?: boolean,
      allowChampionOnly = false
    ) => {
      if (bridgeBypassUnitIds.size === 0) {
        return false;
      }
      const { forceUnits, championUnits } = getLocalUnitsAt(key);
      if (championUnits.length === 0) {
        return false;
      }
      if (!championUnits.every((unitId) => bridgeBypassUnitIds.has(unitId))) {
        return false;
      }
      const include =
        typeof includeChampions === "boolean" ? includeChampions : forceCount == null;
      if (!include) {
        return false;
      }
      if (forceCount === null || forceCount === undefined) {
        if (forceUnits.length === 0) {
          return true;
        }
        return allowChampionOnly;
      }
      if (!Number.isFinite(forceCount)) {
        return false;
      }
      const normalized = Math.floor(forceCount);
      if (normalized > 0) {
        return false;
      }
      return normalized === 0;
    };
    const resolveRequiresBridge = (
      key: string,
      baseRequiresBridge: boolean,
      forceCount: number | null,
      includeChampions?: boolean,
      allowChampionOnly = false
    ) => {
      if (!baseRequiresBridge) {
        return false;
      }
      return !canBypassBridges(key, forceCount, includeChampions, allowChampionOnly);
    };
    const neighbors = (key: string) =>
      neighborHexKeys(key).filter((neighbor) => hasHex(neighbor));
    const getLinkedNeighbors = (key: string) => {
      const linked = linkedNeighborsByHex.get(key);
      if (!linked || linked.size === 0) {
        return [];
      }
      return Array.from(linked).filter((neighbor) => hasHex(neighbor));
    };
    const getMoveNeighbors = (key: string) => {
      const baseNeighbors = neighbors(key);
      const linkedNeighbors = getLinkedNeighbors(key);
      if (linkedNeighbors.length === 0) {
        return baseNeighbors;
      }
      const merged = new Set(baseNeighbors);
      for (const neighbor of linkedNeighbors) {
        merged.add(neighbor);
      }
      return Array.from(merged);
    };
    const hasBuildAndMoveEdge =
      Boolean(selectedCardDef) &&
      cardTargetKind === "edge" &&
      Boolean(moveStackEffect) &&
      (selectedCardDef?.effects?.some((effect) => effect.kind === "buildBridge") ?? false);
    const pendingBridgeEdges = new Set<string>();
    if (hasBuildAndMoveEdge) {
      const edgeKey = getTargetString(targetRecord, "edgeKey");
      if (edgeKey) {
        pendingBridgeEdges.add(edgeKey);
      }
      const edgeKeys = getTargetStringArray(targetRecord, "edgeKeys");
      for (const key of edgeKeys) {
        pendingBridgeEdges.add(key);
      }
    }
    const hasPendingBridge = (from: string, to: string) => {
      if (pendingBridgeEdges.size === 0) {
        return false;
      }
      return pendingBridgeEdges.has(getBridgeKey(from, to));
    };
    const canMoveBetween = (from: string, to: string, requiresBridge: boolean) => {
      const baseNeighbors = neighbors(from);
      const baseNeighborSet = new Set(baseNeighbors);
      const isBaseAdjacent = baseNeighborSet.has(to);
      const isLinked = linkedNeighborsByHex.get(from)?.has(to) ?? false;
      if (!isBaseAdjacent && !isLinked) {
        return false;
      }
      if (
        requiresBridge &&
        isBaseAdjacent &&
        !hasBridge(board, from, to) &&
        !hasPendingBridge(from, to)
      ) {
        return false;
      }
      return canEnter(to);
    };

    const hasAnyEdgeCandidate = (
      start: string,
      requiresOccupiedEndpoint: boolean,
      requiresExistingBridge: boolean
    ) => {
      const startOccupied = isOccupied(start);
      for (const neighbor of neighbors(start)) {
        const isBridge = hasBridge(board, start, neighbor);
        if (requiresExistingBridge ? !isBridge : isBridge) {
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
      requiresExistingBridge: boolean,
      markNeighborTargets = true
    ) => {
      const startOccupied = isOccupied(start);
      for (const neighbor of neighbors(start)) {
        const isBridge = hasBridge(board, start, neighbor);
        if (requiresExistingBridge ? !isBridge : isBridge) {
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
        const requiresBridge = resolveRequiresBridge(key, true, null, true, true);
        const canMarchFrom = getMoveNeighbors(key).some((neighbor) =>
          canMoveBetween(key, neighbor, requiresBridge)
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
      const requiresBridge = resolveRequiresBridge(
        marchFrom,
        true,
        marchForceCount,
        resolvedMarchIncludeChampions,
        false
      );
      for (const neighbor of getMoveNeighbors(marchFrom)) {
        if (!canMoveBetween(marchFrom, neighbor, requiresBridge)) {
          continue;
        }
        validTargets.add(neighbor);
      }
    }

    if (boardPickMode === "bridgeEdge") {
      const requiresOccupiedEndpoint = true;
      const requiresExistingBridge = false;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!hasAnyEdgeCandidate(key, requiresOccupiedEndpoint, requiresExistingBridge)) {
          continue;
        }
        startCandidates.add(key);
        startTargets.add(key);
      }
      if (pendingEdgeStart && hasHex(pendingEdgeStart)) {
        addEdgeCandidatesFrom(pendingEdgeStart, requiresOccupiedEndpoint, requiresExistingBridge);
      } else {
        for (const key of startCandidates) {
          validTargets.add(key);
          addEdgeCandidatesFrom(key, requiresOccupiedEndpoint, requiresExistingBridge, false);
        }
      }
    }

    if (boardPickMode === "cardEdge") {
      if (
        !selectedCardDef ||
        (cardTargetKind !== "edge" && cardTargetKind !== "multiEdge")
      ) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const edgeSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const allowAnywhere = edgeSpec.anywhere === true;
      const requiresOccupiedEndpoint =
        allowAnywhere || edgeSpec.requiresOccupiedEndpoint === false ? false : true;
      const hasBuildBridge =
        selectedCardDef.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
      const hasExistingBridgeEffect =
        selectedCardDef.effects?.some(
          (effect) =>
            effect.kind === "lockBridge" ||
            effect.kind === "trapBridge" ||
            effect.kind === "destroyBridge"
        ) ?? false;
      const requiresExistingBridge = !hasBuildBridge && hasExistingBridgeEffect;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!hasAnyEdgeCandidate(key, requiresOccupiedEndpoint, requiresExistingBridge)) {
          continue;
        }
        startCandidates.add(key);
        startTargets.add(key);
      }
      if (pendingEdgeStart && hasHex(pendingEdgeStart)) {
        addEdgeCandidatesFrom(pendingEdgeStart, requiresOccupiedEndpoint, requiresExistingBridge);
      } else {
        for (const key of startCandidates) {
          validTargets.add(key);
          addEdgeCandidatesFrom(key, requiresOccupiedEndpoint, requiresExistingBridge, false);
        }
      }
    }

    if (boardPickMode === "cardStack") {
      const isEdgeMove =
        cardTargetKind === "edge" && edgeMoveMode === "cardStack" && moveStackEffect;
      if (!selectedCardDef || (!isEdgeMove && cardTargetKind !== "stack")) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      if (isEdgeMove) {
        const edgeKey = getTargetString(targetRecord, "edgeKey");
        const edgeKeys = getTargetStringArray(targetRecord, "edgeKeys");
        if (!edgeKey && edgeKeys.length === 0) {
          return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
        }
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const baseRequiresBridge =
        moveStackEffect && moveStackEffect.requiresBridge === false
          ? false
          : targetSpec.requiresBridge !== false;
      const startCandidates = new Set<string>();
      for (const key of hexKeys) {
        if (!isOccupied(key)) {
          continue;
        }
        const requiresBridge = resolveRequiresBridge(
          key,
          baseRequiresBridge,
          cardMoveForceCount,
          cardMoveIncludeChampions,
          cardMoveSupportsSplit
        );
        const hasDestination = getMoveNeighbors(key).some((neighbor) =>
          canMoveBetween(key, neighbor, requiresBridge)
        );
        if (hasDestination) {
          startCandidates.add(key);
          startTargets.add(key);
        }
      }
      const fromKey = pendingStackFrom;
      if (fromKey && hasHex(fromKey)) {
        const requiresBridge = resolveRequiresBridge(
          fromKey,
          baseRequiresBridge,
          cardMoveForceCount,
          cardMoveIncludeChampions,
          false
        );
        for (const neighbor of getMoveNeighbors(fromKey)) {
          if (!canMoveBetween(fromKey, neighbor, requiresBridge)) {
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
      const isEdgeMove =
        cardTargetKind === "edge" && edgeMoveMode === "cardPath" && moveStackEffect;
      const isPathTarget = cardTargetKind === "path" || cardTargetKind === "multiPath";
      if (!selectedCardDef || (!isEdgeMove && !isPathTarget)) {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      if (isEdgeMove) {
        const edgeKey = getTargetString(targetRecord, "edgeKey");
        const edgeKeys = getTargetStringArray(targetRecord, "edgeKeys");
        if (!edgeKey && edgeKeys.length === 0) {
          return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
        }
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const baseRequiresBridge =
        moveStackEffect && moveStackEffect.requiresBridge === false
          ? false
          : targetSpec.requiresBridge !== false;
      const maxDistance =
        isEdgeMove && typeof moveStackEffect?.maxDistance === "number"
          ? moveStackEffect.maxDistance
          : typeof targetSpec.maxDistance === "number"
            ? targetSpec.maxDistance
            : null;
      const stopOnOccupied =
        moveStackEffect?.stopOnOccupied === true || targetSpec.stopOnOccupied === true;
      const canStart = maxDistance === null || maxDistance >= 1;
      const startCandidates = new Set<string>();
      if (canStart) {
        for (const key of hexKeys) {
          if (!isOccupied(key)) {
            continue;
          }
          const requiresBridge = resolveRequiresBridge(
            key,
            baseRequiresBridge,
            cardMoveForceCount,
            cardMoveIncludeChampions,
            cardMoveSupportsSplit
          );
          const hasStep = getMoveNeighbors(key).some((neighbor) =>
            canMoveBetween(key, neighbor, requiresBridge)
          );
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
        if (pendingPath.length > 1 && stopOnOccupied && hasAnyOccupants(last)) {
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
        const requiresBridge = resolveRequiresBridge(
          pendingPath[0] ?? last,
          baseRequiresBridge,
          cardMoveForceCount,
          cardMoveIncludeChampions,
          false
        );
        for (const neighbor of getMoveNeighbors(last)) {
          if (!canMoveBetween(last, neighbor, requiresBridge)) {
            continue;
          }
          validTargets.add(neighbor);
        }
      }
    }

    if (boardPickMode === "cardHexPair") {
      if (!selectedCardDef || cardTargetKind !== "hexPair") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
      if (owner !== "self" && owner !== "enemy" && owner !== "any") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const allowEmpty = targetSpec.allowEmpty === true;
      const requiresOccupied = targetSpec.occupied === true;
      const requiresEmpty = targetSpec.requiresEmpty === true;
      const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
      const allowCapital = targetSpec.allowCapital !== false;
      const allowSame = targetSpec.allowSame === true;
      const maxDistanceFromChampion =
        typeof targetSpec.maxDistanceFromFriendlyChampion === "number"
          ? targetSpec.maxDistanceFromFriendlyChampion
          : null;
      const maxDistanceFromCapital =
        typeof targetSpec.maxDistanceFromCapital === "number"
          ? targetSpec.maxDistanceFromCapital
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

      const isWithinCapitalRange = (hexKey: string) => {
        if (maxDistanceFromCapital === null) {
          return true;
        }
        if (!localCapitalHexKey || !hasHex(localCapitalHexKey)) {
          return false;
        }
        try {
          return (
            axialDistance(parseHexKey(localCapitalHexKey), parseHexKey(hexKey)) <=
            maxDistanceFromCapital
          );
        } catch {
          return false;
        }
      };

      for (const key of hexKeys) {
        const hex = boardHexes[key];
        if (!hex) {
          continue;
        }
        const isEmpty = !hasAnyOccupants(key);
        if (owner === "self" && !isOccupiedByPlayer(hex, localPlayerId)) {
          if (!(allowEmpty || requiresEmpty) || !isEmpty) {
            continue;
          }
        }
        if (owner === "enemy" && !hasEnemyUnits(hex, localPlayerId)) {
          continue;
        }
        if (requiresOccupied && isEmpty) {
          continue;
        }
        if (requiresEmpty && !isEmpty) {
          continue;
        }
        if (tile && hex.tile !== tile) {
          continue;
        }
        if (!allowCapital && hex.tile === "capital") {
          continue;
        }
        if (!isWithinCapitalRange(key)) {
          continue;
        }
        if (!hasFriendlyChampionWithinRange(key)) {
          continue;
        }
        startTargets.add(key);
        if (pendingHexPair && !allowSame && pendingHexPair === key) {
          continue;
        }
        validTargets.add(key);
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
      const allowEmpty = targetSpec.allowEmpty === true;
      const requiresOccupied = targetSpec.occupied === true;
      const requiresEmpty = targetSpec.requiresEmpty === true;
      const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
      const allowCapital = targetSpec.allowCapital !== false;
      const maxDistanceFromCapital =
        typeof targetSpec.maxDistanceFromCapital === "number"
          ? targetSpec.maxDistanceFromCapital
          : null;
      const maxDistanceFromChampion =
        typeof targetSpec.maxDistanceFromFriendlyChampion === "number"
          ? targetSpec.maxDistanceFromFriendlyChampion
          : null;
      const mortarEffect = selectedCardDef.effects?.find(
        (effect) => effect.kind === "mortarShot"
      ) as { maxDistance?: number } | undefined;
      const mortarMaxDistance =
        mortarEffect && typeof mortarEffect.maxDistance === "number"
          ? mortarEffect.maxDistance
          : 2;
      const mortarForceCoords =
        mortarEffect && Number.isFinite(mortarMaxDistance) && mortarMaxDistance >= 0
          ? Object.values(board.units)
              .filter(
                (unit) => unit.kind === "force" && unit.ownerPlayerId === localPlayerId
              )
              .map((unit) => {
                try {
                  return parseHexKey(unit.hex);
                } catch {
                  return null;
                }
              })
              .filter((coord): coord is { q: number; r: number } => coord !== null)
          : [];

      const hasFriendlyForceWithinRange = (hexKey: string) => {
        if (!mortarEffect) {
          return true;
        }
        if (mortarForceCoords.length === 0) {
          return false;
        }
        let targetCoord: { q: number; r: number } | null = null;
        try {
          targetCoord = parseHexKey(hexKey);
        } catch {
          return false;
        }
        if (!targetCoord) {
          return false;
        }
        return mortarForceCoords.some(
          (coord) => axialDistance(coord, targetCoord) <= mortarMaxDistance
        );
      };

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

      const isWithinCapitalRange = (hexKey: string) => {
        if (maxDistanceFromCapital === null) {
          return true;
        }
        if (!localCapitalHexKey || !hasHex(localCapitalHexKey)) {
          return false;
        }
        try {
          return (
            axialDistance(parseHexKey(localCapitalHexKey), parseHexKey(hexKey)) <=
            maxDistanceFromCapital
          );
        } catch {
          return false;
        }
      };

      for (const key of hexKeys) {
        const hex = boardHexes[key];
        if (!hex) {
          continue;
        }
        const isEmpty = !hasAnyOccupants(key);
        if (owner === "self" && !isOccupiedByPlayer(hex, localPlayerId)) {
          if (!(allowEmpty || requiresEmpty) || !isEmpty) {
            continue;
          }
        }
        if (owner === "enemy" && !hasEnemyUnits(hex, localPlayerId)) {
          continue;
        }
        if (requiresOccupied && isEmpty) {
          continue;
        }
        if (requiresEmpty && !isEmpty) {
          continue;
        }
        if (tile && hex.tile !== tile) {
          continue;
        }
        if (!allowCapital && hex.tile === "capital") {
          continue;
        }
        if (!isWithinCapitalRange(key)) {
          continue;
        }
        if (!hasFriendlyChampionWithinRange(key)) {
          continue;
        }
        if (!hasFriendlyForceWithinRange(key)) {
          continue;
        }
        validTargets.add(key);
      }
    }

    if (boardPickMode === "cardHexPair") {
      if (!selectedCardDef || cardTargetKind !== "hexPair") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
      if (owner !== "self" && owner !== "enemy" && owner !== "any") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const allowEmpty = targetSpec.allowEmpty === true;
      const requiresOccupied = targetSpec.occupied === true;
      const requiresEmpty = targetSpec.requiresEmpty === true;
      const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
      const allowCapital = targetSpec.allowCapital !== false;
      const allowSame = targetSpec.allowSame === true;
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
        const isEmpty = !hasAnyOccupants(key);
        if (owner === "self" && !isOccupiedByPlayer(hex, localPlayerId)) {
          if (!(allowEmpty || requiresEmpty) || !isEmpty) {
            continue;
          }
        }
        if (owner === "enemy" && !hasEnemyUnits(hex, localPlayerId)) {
          continue;
        }
        if (requiresOccupied && isEmpty) {
          continue;
        }
        if (requiresEmpty && !isEmpty) {
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

    if (boardPickMode === "cardChampion") {
      if (!selectedCardDef || cardTargetKind !== "champion") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
      if (owner !== "self" && owner !== "enemy" && owner !== "any") {
        return { validHexKeys: [], previewEdgeKeys: [], startHexKeys: [] };
      }
      const requiresFriendlyChampion = targetSpec.requiresFriendlyChampion === true;
      const maxDistance =
        typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : NaN;
      const friendlyChampionCoords =
        requiresFriendlyChampion && localPlayerId
          ? Object.values(board.units)
              .filter(
                (unit) => unit.kind === "champion" && unit.ownerPlayerId === localPlayerId
              )
              .map((unit) => {
                try {
                  return parseHexKey(unit.hex);
                } catch {
                  return null;
                }
              })
              .filter(
                (coord): coord is { q: number; r: number } => coord !== null
              )
          : [];
      const hasFriendlyChampionWithinRange = (hexKey: string) => {
        if (!requiresFriendlyChampion) {
          return true;
        }
        if (!Number.isFinite(maxDistance) || maxDistance < 0) {
          return false;
        }
        if (friendlyChampionCoords.length === 0) {
          return false;
        }
        let targetCoord: { q: number; r: number } | null = null;
        try {
          targetCoord = parseHexKey(hexKey);
        } catch {
          return false;
        }
        if (!targetCoord) {
          return false;
        }
        return friendlyChampionCoords.some(
          (coord) => axialDistance(coord, targetCoord) <= maxDistance
        );
      };
      for (const unit of Object.values(board.units)) {
        if (unit.kind !== "champion") {
          continue;
        }
        if (owner === "self" && unit.ownerPlayerId !== localPlayerId) {
          continue;
        }
        if (owner === "enemy" && unit.ownerPlayerId === localPlayerId) {
          continue;
        }
        if (!boardHexes[unit.hex]) {
          continue;
        }
        if (!hasFriendlyChampionWithinRange(unit.hex)) {
          continue;
        }
        validTargets.add(unit.hex);
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
    linkedNeighborsByHex,
    bridgeBypassUnitIds,
    boardPickMode,
    marchFrom,
    marchForceCount,
    resolvedMarchIncludeChampions,
    pendingEdgeStart,
    pendingStackFrom,
    pendingPath,
    pendingHexPair,
    selectedCardDef,
    cardTargetKind,
    cardMoveForceCount,
    cardMoveIncludeChampions,
    cardMoveSupportsSplit,
    moveStackEffect,
    edgeMoveMode,
    targetRecord
  ]);
  const boardValidHexKeys = useMemo(() => {
    if (isCombatRetreatWaiting) {
      return combatRetreatHexKeys;
    }
    return validHexKeys;
  }, [combatRetreatHexKeys, isCombatRetreatWaiting, validHexKeys]);

  const revealHexKeys = activeCardReveal?.targetHexKeys ?? [];
  const revealEdgeKeys = activeCardReveal?.targetEdgeKeys ?? [];
  const mortarScatterHexKeys = useMemo(() => {
    if (!selectedCardDef || cardTargetKind !== "hex") {
      return [];
    }
    const mortarEffect = selectedCardDef.effects?.find(
      (effect) => effect.kind === "mortarShot"
    );
    if (!mortarEffect) {
      return [];
    }
    const targetHex = getTargetString(targetRecord, "hexKey");
    if (!targetHex || !view.public.board.hexes[targetHex]) {
      return [];
    }
    return neighborHexKeys(targetHex).filter((key) => view.public.board.hexes[key]);
  }, [cardTargetKind, selectedCardDef, targetRecord, view.public.board.hexes]);
  const previewHexPair = useMemo(() => {
    if (cardTargetKind !== "hexPair") {
      return null;
    }
    const selectedPair = getTargetStringArray(targetRecord, "hexKeys");
    if (selectedPair.length === 2) {
      return { from: selectedPair[0], to: selectedPair[1] };
    }
    return null;
  }, [cardTargetKind, targetRecord]);
  const highlightHexKeys = useMemo(() => {
    const merged = new Set(targetHighlightHexKeys);
    for (const key of revealHexKeys) {
      merged.add(key);
    }
    for (const key of mortarScatterHexKeys) {
      merged.add(key);
    }
    return Array.from(merged);
  }, [targetHighlightHexKeys, revealHexKeys, mortarScatterHexKeys]);
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
    if (cardId === cardInstanceId) {
      clearCardSelection();
      return;
    }
    const card = handCards.find((entry) => entry.id === cardId) ?? null;
    const cardDef = card ? CARD_DEFS_BY_ID.get(card.defId) ?? null : null;
    setBasicActionIntent("none");
    setCardInstanceId(cardId);
    setCardTargetsRaw("");
    setHandPickerMode("none");
    setBoardPickModeSafe(getDefaultCardPickMode(cardDef));
  };
  const localGold = view.private ? availableGold : null;
  const localVpTotal = view.private?.vp ? view.private.vp.total : null;
  const handPickerCards = handCards.filter((card) => card.id !== cardInstanceId);
  const selectedHandLabels = selectedHandCardIds.map(
    (cardId) => handCardLabels.get(cardId) ?? cardId
  );
  const topdeckLimitLabel = topdeckCount === 1 ? "1 card" : `${topdeckCount} cards`;
  const discardLimitLabel =
    discardFromHandCount === 1 ? "1 card" : `${discardFromHandCount} cards`;
  const burnLimitLabel = burnFromHandCount === 1 ? "1 card" : `${burnFromHandCount} cards`;
  const edgeMovePayload = edgeMoveMode ? buildEdgeTargetPayload(targetRecord) : null;
  const edgeMoveEdgeKey = getTargetString(targetRecord, "edgeKey");
  const edgeMoveEdgeLabel = edgeMoveEdgeKey
    ? formatEdgeLabel(edgeMoveEdgeKey, hexLabels)
    : null;
  const edgeMovePath =
    edgeMoveMode === "cardPath" ? getTargetStringArray(targetRecord, "path") : [];
  const edgeMoveFrom = getTargetString(targetRecord, "from");
  const edgeMoveTo = getTargetString(targetRecord, "to");
  const edgeMoveSummary =
    edgeMovePath.length > 1
      ? `Path ${edgeMovePath
          .map((hexKey) => hexLabels[hexKey] ?? hexKey)
          .join(" → ")}`
      : edgeMoveFrom && edgeMoveTo
        ? `Move ${hexLabels[edgeMoveFrom] ?? edgeMoveFrom} → ${
            hexLabels[edgeMoveTo] ?? edgeMoveTo
          }`
        : null;
  const multiEdgeTargets = useMemo(() => {
    if (cardTargetKind !== "multiEdge") {
      return [];
    }
    return getTargetStringArray(targetRecord, "edgeKeys");
  }, [cardTargetKind, targetRecord]);
  const multiEdgeLimits = useMemo(() => {
    if (!selectedCardDef || cardTargetKind !== "multiEdge") {
      return null;
    }
    const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
    const minEdgesRaw =
      typeof targetSpec.minEdges === "number" ? Math.floor(targetSpec.minEdges) : null;
    const maxEdgesRaw =
      typeof targetSpec.maxEdges === "number" ? Math.floor(targetSpec.maxEdges) : null;
    const minEdges =
      minEdgesRaw !== null && Number.isFinite(minEdgesRaw) && minEdgesRaw >= 0
        ? minEdgesRaw
        : null;
    const maxEdges =
      maxEdgesRaw !== null && Number.isFinite(maxEdgesRaw) && maxEdgesRaw >= 0
        ? maxEdgesRaw
        : null;
    return { minEdges, maxEdges };
  }, [cardTargetKind, selectedCardDef]);
  const multiEdgeLabels = useMemo(
    () => multiEdgeTargets.map((edgeKey) => formatEdgeLabel(edgeKey, hexLabels)),
    [hexLabels, multiEdgeTargets]
  );
  const multiEdgeCountLabel =
    multiEdgeTargets.length === 1 ? "1 edge" : `${multiEdgeTargets.length} edges`;
  const pendingMultiEdgeStart = pendingEdgeStart
    ? formatHexLabel(pendingEdgeStart, hexLabels)
    : null;
  const multiEdgeHint = useMemo(() => {
    if (!multiEdgeLimits) {
      return "Pick multiple edges on the board.";
    }
    const { minEdges, maxEdges } = multiEdgeLimits;
    if (minEdges !== null && maxEdges !== null) {
      if (minEdges === maxEdges) {
        return `Pick ${minEdges} edges on the board.`;
      }
      return `Pick ${minEdges}-${maxEdges} edges on the board.`;
    }
    if (minEdges !== null) {
      return `Pick at least ${minEdges} edges on the board.`;
    }
    if (maxEdges !== null) {
      return `Pick up to ${maxEdges} edges on the board.`;
    }
    return "Pick multiple edges on the board.";
  }, [multiEdgeLimits]);
  const multiPathTargets = useMemo(() => {
    if (cardTargetKind !== "multiPath") {
      return [];
    }
    return getTargetPaths(targetRecord);
  }, [cardTargetKind, targetRecord]);
  const multiPathLimits = useMemo(() => {
    if (!selectedCardDef || cardTargetKind !== "multiPath") {
      return null;
    }
    const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
    const minPathsRaw =
      typeof targetSpec.minPaths === "number" ? Math.floor(targetSpec.minPaths) : null;
    const maxPathsRaw =
      typeof targetSpec.maxPaths === "number" ? Math.floor(targetSpec.maxPaths) : null;
    const minPaths =
      minPathsRaw !== null && Number.isFinite(minPathsRaw) && minPathsRaw >= 0
        ? minPathsRaw
        : null;
    const maxPaths =
      maxPathsRaw !== null && Number.isFinite(maxPathsRaw) && maxPathsRaw >= 0
        ? maxPathsRaw
        : null;
    return { minPaths, maxPaths };
  }, [cardTargetKind, selectedCardDef]);
  const multiPathLabels = useMemo(() => {
    return multiPathTargets.map((path) =>
      path.map((hexKey) => hexLabels[hexKey] ?? hexKey).join(" → ")
    );
  }, [hexLabels, multiPathTargets]);
  const multiPathCountLabel =
    multiPathTargets.length === 1 ? "1 path" : `${multiPathTargets.length} paths`;
  const pendingMultiPathStart =
    pendingPath.length === 1 ? hexLabels[pendingPath[0]] ?? pendingPath[0] : null;
  const multiPathHint = useMemo(() => {
    if (!multiPathLimits) {
      return "Pick multiple paths on the board. Click a new start hex to add another path.";
    }
    const { minPaths, maxPaths } = multiPathLimits;
    if (minPaths !== null && maxPaths !== null) {
      if (minPaths === maxPaths) {
        return `Pick ${minPaths} paths on the board. Click a new start hex to add another path.`;
      }
      return `Pick ${minPaths}-${maxPaths} paths on the board. Click a new start hex to add another path.`;
    }
    if (minPaths !== null) {
      return `Pick at least ${minPaths} paths on the board. Click a new start hex to add another path.`;
    }
    if (maxPaths !== null) {
      return `Pick up to ${maxPaths} paths on the board. Click a new start hex to add another path.`;
    }
    return "Pick multiple paths on the board. Click a new start hex to add another path.";
  }, [multiPathLimits]);
  const cardMoveStartLabel = cardMoveStartHex
    ? hexLabels[cardMoveStartHex] ?? cardMoveStartHex
    : null;
  const showCardMoveSplitControls =
    cardMoveSupportsSplit &&
    Boolean(cardMoveStartHex) &&
    (cardMoveForceMax > 1 || cardMoveChampionCount > 0);
  const showMarchSplitControls =
    basicActionIntent === "march" &&
    marchFrom.trim().length > 0 &&
    (marchForceMax > 1 || marchChampionCount > 0);
  const marchFromLabel = marchFrom ? hexLabels[marchFrom] ?? marchFrom : null;
  const cardMoveMeta = cardMoveStartLabel
    ? `From ${cardMoveStartLabel} (${formatUnitCounts(
        cardMoveForceMax,
        cardMoveChampionCount
      )})`
    : formatUnitCounts(cardMoveForceMax, cardMoveChampionCount);
  const marchMoveMeta = marchFromLabel
    ? `From ${marchFromLabel} (${formatUnitCounts(
        marchForceMax,
        marchChampionCount
      )})`
    : formatUnitCounts(marchForceMax, marchChampionCount);
  const championTargetScopeLabel =
    championTargetOwner === "self"
      ? "Your champions"
      : championTargetOwner === "enemy"
        ? "Enemy champions"
        : championTargetOwner === "any"
          ? "Any champion"
          : null;
  const selectedChampionLabel = selectedChampion
    ? `${selectedChampion.name} (${selectedChampion.ownerName})`
    : null;
  const selectedChampionHexLabel = selectedChampion
    ? hexLabels[selectedChampion.hex] ?? selectedChampion.hex
    : null;
  const playerTargetOptions = useMemo(() => {
    if (!selectedCardDef || cardTargetKind !== "player") {
      return [];
    }
    const targetSpec = selectedCardDef.targetSpec as Record<string, unknown>;
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "enemy";
    return view.public.players.filter((player) => {
      if (owner === "self") {
        return player.id === localPlayerId;
      }
      if (owner === "enemy") {
        return player.id !== localPlayerId;
      }
      return true;
    });
  }, [cardTargetKind, localPlayerId, selectedCardDef, view.public.players]);
  const selectedTargetPlayer =
    playerTargetOptions.find((player) => player.id === selectedTargetPlayerId) ?? null;
  const edgeMoveLabel = edgeMoveMode === "cardPath" ? "Path" : "Stack";
  const topdeckPanel =
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
            onClick={() => setHandPickerMode("topdeck")}
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
  const handDiscardPanel =
    selectedCardDef && discardFromHandCount > 0 ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Discard from hand</strong>
          <span className="hand-targets__meta">
            {selectedHandCardIds.length}/{discardFromHandCount}
          </span>
        </div>
        <p className="hand-targets__hint">Select {discardLimitLabel} to discard.</p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={handPickerCards.length === 0}
            onClick={() => setHandPickerMode("discard")}
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
  const handBurnPanel =
    selectedCardDef && burnFromHandCount > 0 ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Burn from hand</strong>
          <span className="hand-targets__meta">
            {selectedHandCardIds.length}/{burnFromHandCount}
          </span>
        </div>
        <p className="hand-targets__hint">Select {burnLimitLabel} to burn.</p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={handPickerCards.length === 0}
            onClick={() => setHandPickerMode("burn")}
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
  const playerTargetPanel =
    selectedCardDef && cardTargetKind === "player" ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Target player</strong>
          <span className="hand-targets__meta">
            {selectedTargetPlayer ? "Selected" : "Pick 1"}
          </span>
        </div>
        <p className="hand-targets__hint">
          {playerTargetOptions.length > 0
            ? "Choose a player to target."
            : "No eligible players."}
        </p>
        <div className="hand-targets__actions">
          {playerTargetOptions.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`btn btn-tertiary${
                player.id === selectedTargetPlayerId ? " is-active" : ""
              }`}
              onClick={() => setCardTargetsObject({ playerId: player.id })}
            >
              {player.id === localPlayerId ? `${player.name} (You)` : player.name}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={!selectedTargetPlayerId}
            onClick={() => setCardTargetsObject(null)}
          >
            Clear
          </button>
        </div>
        <p className="hand-targets__selected">
          {selectedTargetPlayer ? `Selected: ${selectedTargetPlayer.name}` : "No player selected."}
        </p>
      </div>
    ) : null;
  const edgeMovePanel =
    edgeMoveMode && selectedCardDef ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Optional move</strong>
          <span className="hand-targets__meta">{edgeMoveLabel}</span>
        </div>
        <p className="hand-targets__hint">
          {edgeMovePayload
            ? "Bridge selected. Pick a stack to move after building the bridge (optional)."
            : "Pick a bridge first to unlock the optional move."}
        </p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={!canSubmitAction}
            onClick={() => setBoardPickModeSafe("cardEdge")}
          >
            Pick bridge
          </button>
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={!edgeMovePayload || !canSubmitAction}
            onClick={() => setBoardPickModeSafe(edgeMoveMode)}
          >
            Pick move
          </button>
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={!edgeMoveSummary}
            onClick={clearEdgeMoveTargets}
          >
            Clear move
          </button>
        </div>
        <p className="hand-targets__selected">
          {edgeMoveEdgeLabel ? `Bridge: ${edgeMoveEdgeLabel}` : "Bridge: none."}
        </p>
        <p className="hand-targets__selected">
          {edgeMoveSummary ? `Move: ${edgeMoveSummary}` : "Move: none."}
        </p>
      </div>
    ) : null;
  const multiEdgePanel =
    selectedCardDef && cardTargetKind === "multiEdge" ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Edges</strong>
          <span className="hand-targets__meta">{multiEdgeCountLabel}</span>
        </div>
        <p className="hand-targets__hint">{multiEdgeHint}</p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={multiEdgeTargets.length === 0 && !pendingEdgeStart}
            onClick={clearMultiEdgeTargets}
          >
            Clear edges
          </button>
        </div>
        <p className="hand-targets__selected">
          {multiEdgeLabels.length > 0
            ? `Selected: ${multiEdgeLabels.join(", ")}`
            : pendingMultiEdgeStart
              ? `Start: ${pendingMultiEdgeStart}`
              : "No edges selected."}
        </p>
      </div>
    ) : null;
  const multiPathPanel =
    selectedCardDef && cardTargetKind === "multiPath" ? (
      <div className="hand-targets">
        <div className="hand-targets__header">
          <strong>Paths</strong>
          <span className="hand-targets__meta">{multiPathCountLabel}</span>
        </div>
        <p className="hand-targets__hint">{multiPathHint}</p>
        <div className="hand-targets__actions">
          <button
            type="button"
            className="btn btn-tertiary"
            disabled={multiPathTargets.length === 0 && pendingPath.length === 0}
            onClick={clearMultiPathTargets}
          >
            Clear paths
          </button>
          {multiPathTargets.map((path, index) => (
            <button
              key={`${path.join("|")}-${index}`}
              type="button"
              className="btn btn-tertiary"
              onClick={() => removeMultiPathAt(index)}
            >
              Remove path {index + 1}
            </button>
          ))}
        </div>
        <p className="hand-targets__selected">
          {multiPathLabels.length > 0
            ? `Selected: ${multiPathLabels.join(" | ")}`
            : pendingMultiPathStart
              ? `Start: ${pendingMultiPathStart}`
              : "No paths selected."}
        </p>
      </div>
    ) : null;
  const cardMovePanel = showCardMoveSplitControls ? (
    <div className="hand-targets">
      <div className="hand-targets__header">
        <strong>Move forces</strong>
        <span className="hand-targets__meta">{cardMoveMeta}</span>
      </div>
      <p className="hand-targets__hint">
        Adjust the split on the board near the start hex.
      </p>
    </div>
  ) : null;
  const forceSplitPanel =
    showCardMoveSplitControls && cardMoveStartHex ? (
      <ForceSplitPopover
        title="Move forces"
        meta={cardMoveMeta}
        forceCount={cardMoveForceCount}
        forceMax={cardMoveForceMax}
        championCount={cardMoveChampionCount}
        includeChampions={cardMoveIncludeChampions}
        onChange={setCardForceCount}
        onToggleChampions={setCardIncludeChampions}
      />
    ) : showMarchSplitControls ? (
      <ForceSplitPopover
        title="March forces"
        meta={marchMoveMeta}
        forceCount={marchForceCount}
        forceMax={marchForceMax}
        championCount={marchChampionCount}
        includeChampions={resolvedMarchIncludeChampions}
        onChange={setMarchForceCount}
        onToggleChampions={setMarchIncludeChampions}
      />
    ) : null;
  const championTargetOptions = useMemo<ChampionTargetOverlayOption[]>(() => {
    if (!selectedCardDef || cardTargetKind !== "champion") {
      return [];
    }
    return eligibleChampionTargets.map((unit) => ({
      id: unit.id,
      name: unit.name,
      ownerName: unit.ownerName,
      hex: unit.hex,
      hexLabel: hexLabels[unit.hex] ?? unit.hex,
      hp: unit.hp,
      maxHp: unit.maxHp
    }));
  }, [cardTargetKind, eligibleChampionTargets, hexLabels, selectedCardDef]);
  const showChampionTargetOverlay = Boolean(selectedCardDef && cardTargetKind === "champion");
  const handleChampionTargetSelect = (unit: ChampionTargetOverlayOption) => {
    setSelectedHexKey(unit.hex);
    setBoardPickModeSafe("cardChampion");
    setCardTargetsObject({ unitId: unit.id });
  };
  const handTargetsPanel =
    topdeckPanel ||
    handDiscardPanel ||
    handBurnPanel ||
    playerTargetPanel ||
    edgeMovePanel ||
    multiEdgePanel ||
    multiPathPanel ||
    cardMovePanel ? (
      <>
        {topdeckPanel}
        {handDiscardPanel}
        {handBurnPanel}
        {playerTargetPanel}
        {edgeMovePanel}
        {multiEdgePanel}
        {multiPathPanel}
        {cardMovePanel}
      </>
    ) : null;
  const championTargetOverlay = (
    <GameScreenChampionTargetOverlay
      isOpen={showChampionTargetOverlay}
      scopeLabel={championTargetScopeLabel}
      options={championTargetOptions}
      selectedChampionId={selectedChampionId}
      selectedLabel={selectedChampionLabel}
      selectedHexLabel={selectedChampionHexLabel}
      onSelect={handleChampionTargetSelect}
    />
  );
  const handPickerCount =
    handPickerMode === "topdeck"
      ? topdeckCount
      : handPickerMode === "discard"
        ? discardFromHandCount
        : handPickerMode === "burn"
          ? burnFromHandCount
          : 0;
  const handPickerLimitLabel = handPickerCount === 1 ? "1 card" : `${handPickerCount} cards`;
  const showHandPicker =
    isActionPhase && handPickerMode !== "none" && handPickerCount > 0 && Boolean(selectedCardDef);
  const handPickerTitle =
    handPickerMode === "discard"
      ? "Discard from hand"
      : handPickerMode === "burn"
        ? "Burn from hand"
        : "Topdeck from hand";
  const handPickerDescription =
    handPickerMode === "discard"
      ? `Select ${handPickerLimitLabel} to discard.`
      : handPickerMode === "burn"
        ? `Select ${handPickerLimitLabel} to burn.`
        : handPickerCount > 0
          ? `Pick up to ${handPickerLimitLabel} to place on top of your draw pile.`
          : null;
  const showQuietStudyModal = isQuietStudyActive && quietStudyMaxDiscard > 0;
  const quietStudyTitle = "Quiet Study";
  const quietStudyDescription =
    quietStudyMaxDiscard > 0
      ? `Discard up to ${quietStudyMaxDiscard} card${
          quietStudyMaxDiscard === 1 ? "" : "s"
        }, then draw that many.`
      : null;
  const scoutReportTitle = "Scout Report";
  const scoutReportDescription =
    scoutReportKeepCount > 0
      ? `Choose ${scoutReportKeepCount} to keep. Discard the rest.`
      : null;
  const handleSubmitQuietStudy = () => {
    if (!quietStudy?.isWaiting) {
      return;
    }
    onSubmitQuietStudy(quietStudySelectedIds);
  };
  const handleSubmitScoutReport = () => {
    if (!scoutReport?.isWaiting) {
      return;
    }
    onSubmitScoutReportChoice(scoutReportSelectedIds);
  };

  const showCollectionOverlayToggle = isCollectionPhase;
  const collectionToggleLabel = showCollectionOverlay
    ? "Hide Collection"
    : "Show Collection";
  const collectionOverlay = (
    <GameScreenCollectionOverlay
      isActive={isCollectionPhase}
      isOpen={showCollectionOverlay}
      showToggle={showCollectionOverlayToggle}
      toggleLabel={collectionToggleLabel}
      onToggle={toggleCollectionOverlay}
      phase={view.public.phase}
      player={localPlayer ?? null}
      players={view.public.players}
      status={status}
      handCards={handCards}
      collectionPublic={view.public.collection}
      collectionPrivate={view.private?.collection ?? null}
      labelByHex={hexLabels}
      onSubmitChoices={onSubmitCollectionChoices}
    />
  );

  const showMarketOverlayToggle = isMarketPhase;
  const showDeckToggle = Boolean(onOpenDeck && view.private);
  const marketToggleLabel = !canToggleMarketOverlay
    ? "Market Locked"
    : showMarketOverlay
      ? "Hide Market"
      : "Show Market";
  const marketOverlay = (
    <GameScreenMarketOverlay
      isActive={isMarketPhase}
      shouldHoldOpen={shouldHoldMarketOverlay}
      isOpen={showMarketOverlay}
      showToggle={showMarketOverlayToggle}
      toggleLabel={marketToggleLabel}
      canToggle={canToggleMarketOverlay}
      onToggle={toggleMarketOverlay}
      market={view.public.market}
      players={view.public.players}
      phase={view.public.phase}
      player={localPlayer ?? null}
      status={status}
      onSubmitBid={onSubmitMarketBid}
      onSubmitRollOff={onSubmitMarketRollOff}
      winnerHighlight={marketWinner}
      winnerHistory={marketWinnerHistory}
      rollDurationMs={view.public.config.MARKET_ROLLOFF_DURATION_MS}
      onClose={isMarketPhase ? () => setIsMarketOverlayOpen(false) : undefined}
    />
  );

  const logContent =
    view.public.logs.length === 0 ? (
      <div className="log-empty">Waiting for events.</div>
    ) : (
      <ul className="log-list">
        {view.public.logs.map((entry, index) => (
          <li key={`${entry.type}-${index}`}>
            {formatGameEvent(entry, playerNames, hexLabels, CARD_DEFS_BY_ID)}
          </li>
        ))}
      </ul>
    );
  const effectsContent =
    activeEffects.length === 0 ? (
      <div className="log-empty">No active effects.</div>
    ) : (
      <ul className="log-list">
        {activeEffects.map((effect) => (
          <li key={effect.id}>
            <span className="intel-value">{effect.label}</span>
            {effect.detail ? <span className="player-meta"> {effect.detail}</span> : null}
          </li>
        ))}
      </ul>
    );

  const infoDock = (
    <GameScreenInfoDock
      isOpen={isInfoDockOpen}
      activeTab={infoDockTab}
      logCount={logCount}
      effectsCount={activeEffects.length}
      logContent={logContent}
      effectsContent={effectsContent}
      onTabChange={setInfoDockTab}
      onClose={() => setIsInfoDockOpen(false)}
    />
  );
  return (
    <section className="game-screen">
      <GameScreenCues
        phaseCue={phaseCue}
        phaseCueKey={phaseCueKey}
        ageCue={ageCue}
        ageCueKey={ageCueKey}
      />
      {activeCardReveal && isActionRevealOverlayVisible ? (
        <ActionRevealOverlay
          key={activeCardReveal.key}
          reveal={activeCardReveal}
          durationMs={actionRevealDurationMs}
        />
      ) : null}
      {rollReveal ? (
        <DiceRollOverlay reveal={rollReveal} durationMs={rollRevealDurationMs} />
      ) : null}
      {activeCombat ? (
        <CombatOverlay
          sequence={activeCombat}
          playersById={playerNames}
          playerFactionsById={playerFactions}
          cardDefsById={CARD_DEFS_BY_ID}
          modifiers={view.public.modifiers}
          hexLabel={activeCombatLabel}
          isCapitalBattle={isCapitalBattle}
          viewerId={playerId}
          combatSync={activeCombatSync}
          serverTimeOffset={serverTimeOffset}
          config={view.public.config}
          onRequestRoll={handleCombatRoll}
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
        isOpen={showQuietStudyModal}
        title={quietStudyTitle}
        description={quietStudyDescription}
        cards={handCards}
        cardDefsById={CARD_DEFS_BY_ID}
        selectedIds={quietStudySelectedIds}
        maxSelect={Math.max(quietStudyMaxDiscard, 1)}
        onSelectionChange={setQuietStudySelectedIds}
        onClose={handleSubmitQuietStudy}
      />
      <HandCardPickerModal
        isOpen={showScoutReportModal}
        title={scoutReportTitle}
        description={scoutReportDescription}
        cards={scoutReportOffers}
        cardDefsById={CARD_DEFS_BY_ID}
        selectedIds={scoutReportSelectedIds}
        maxSelect={Math.max(scoutReportKeepCount, 1)}
        onSelectionChange={setScoutReportSelectedIds}
        onClose={handleSubmitScoutReport}
      />
      <HandCardPickerModal
        isOpen={showHandPicker}
        title={handPickerTitle}
        description={handPickerDescription}
        cards={handPickerCards}
        cardDefsById={CARD_DEFS_BY_ID}
        selectedIds={selectedHandCardIds}
        maxSelect={Math.max(handPickerCount, 1)}
        onSelectionChange={setCardInstanceTargets}
        onClose={() => setHandPickerMode("none")}
      />
      <GameScreenHeader
        isCollapsed={isHeaderCollapsed}
        connectionLabel={connectionLabel}
        connectionClass={connectionClass}
        phase={view.public.phase}
        phaseLabel={phaseLabel}
        round={view.public.round}
        roomId={roomId}
        playerCount={view.public.players.length}
        winnerPlayerId={view.public.winnerPlayerId ?? null}
        localGold={localGold}
        localVpTotal={localVpTotal}
        onToggle={toggleHeaderCollapsed}
      />

      {marketOverlay}

      {showDeckToggle ? (
        <button
          type="button"
          className="btn btn-secondary deck-toggle"
          data-sfx="soft"
          onClick={onOpenDeck}
        >
          View Deck
        </button>
      ) : null}

      {collectionOverlay}

      {championTargetOverlay}

      <GameScreenSidebarToggle
        isCollapsed={isSidebarCollapsed}
        onExpand={expandSidebar}
      />
      <div
        className={`game-screen__layout ${showPhaseFocus ? "game-screen__layout--focus" : ""} ${
          isSidebarCollapsed ? "game-screen__layout--sidebar-collapsed" : ""
        }`}
      >
        <GameScreenBoardSection
          hexes={hexRender}
          board={view.public.board}
          modifiers={view.public.modifiers}
          playerIndexById={playerColorIndexById}
          playerFactionById={playerFactionById}
          capitalOwnerByHex={capitalOwnerByHex}
          homeCapitalHexKey={localCapitalHexKey}
          labelByHex={hexLabels}
          selectedHexKey={selectedHexKey}
          highlightHexKeys={highlightHexKeys}
          validHexKeys={isEdgePickMode ? [] : boardValidHexKeys}
          previewEdgeKeys={previewEdgeKeys}
          previewHexPair={previewHexPair}
          isTargeting={isBoardTargeting}
          onHexClick={isEdgePickMode ? undefined : handleBoardHexClick}
          onEdgeClick={handleBoardEdgeClick}
          actionAnimations={actionAnimations}
          actionAnimationDurationMs={actionRevealDurationMs}
          actionAnimationHold={shouldHoldActionReveal}
          forceSplitPanel={forceSplitPanel}
        />

        {!isSidebarCollapsed ? (
          <GameScreenSidebar
            connectionLabel={connectionLabel}
            connectionClass={connectionClass}
            phaseLabel={phaseLabel}
            round={view.public.round}
            leadPlayerName={leadPlayer?.name ?? null}
            players={view.public.players}
            modifiers={view.public.modifiers}
            actionStep={actionStep}
            actionEligible={actionEligible}
            actionWaiting={actionWaiting}
            isInteractivePhase={isInteractivePhase}
            logCount={logCount}
            lastLogLabel={lastLogLabel}
            activeEffectsCount={activeEffects.length}
            isInfoDockOpen={isInfoDockOpen}
            infoDockTab={infoDockTab}
            onOpenDock={openDock}
            onCollapse={collapseSidebar}
          />
        ) : null}
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
        maxMana={maxMana}
        availableGold={availableGold}
        vpTotal={localVpTotal}
        canDeclareAction={canDeclareAction}
        canSubmitAction={canSubmitAction}
        actionHint={actionHint}
        selectedCardId={cardInstanceId}
        handTargets={handTargetsPanel}
        player={localPlayer ?? null}
        edgeKey={edgeKey}
        marchFrom={marchFrom}
        marchTo={marchTo}
        marchForceMax={marchForceMax}
        reinforceHex={reinforceHex}
        reinforceOptions={reinforceOptions}
        boardPickMode={boardPickMode}
        basicActionIntent={basicActionIntent}
        onBasicActionIntentChange={handleBasicActionIntentChange}
        onReinforceHexChange={setReinforceHex}
        onBoardPickModeChange={setBoardPickModeSafe}
        onSelectCard={handleSelectCard}
        onSubmitAction={onSubmitAction}
        primaryAction={primaryAction}
        primaryActionLabel={primaryActionLabel}
        canSubmitDone={canSubmitDone}
        combatRetreat={
          combatRetreatPanel && pendingCombat
            ? {
                ...combatRetreatPanel,
                onSubmit: (edgeKey) => handleCombatRetreat(pendingCombat.hexKey, edgeKey)
              }
            : null
        }
      />
    </section>
  );
};
