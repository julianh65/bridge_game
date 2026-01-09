import { useMemo, useRef, useState, useEffect } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  ReactNode,
  WheelEventHandler
} from "react";

import {
  CARD_DEFS_BY_ID,
  type BoardState,
  type ModifierView,
  type UseCounter
} from "@bridgefront/engine";
import { parseEdgeKey } from "@bridgefront/shared";

import { getCardArtUrl } from "../lib/card-art";
import { HEX_SIZE, hexPoints } from "../lib/hex-geometry";
import { getFactionIconUrl, getFactionSymbol } from "../lib/factions";
import type { HexRender } from "../lib/board-preview";

type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type BoardActionAnimation = {
  id: string;
  kind: "move" | "edge" | "hex";
  path?: string[];
  edgeKey?: string;
  hexKey?: string;
  playerId?: string | null;
  unitKind?: "force" | "champion";
  unitLabel?: string | null;
};

export type BoardOverlayItem = {
  id: string;
  hexKey: string;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  className?: string;
  content: ReactNode;
};

type BoardViewProps = {
  hexes: HexRender[];
  board?: BoardState;
  modifiers?: ModifierView[];
  playerIndexById?: Record<string, number>;
  playerFactionById?: Record<string, string>;
  capitalOwnerByHex?: Record<string, string>;
  homeCapitalHexKey?: string | null;
  showCoords?: boolean;
  showTags?: boolean;
  showMineValues?: boolean;
  labelByHex?: Record<string, string>;
  labelVariant?: "slot" | "coords" | "label";
  className?: string;
  enablePanZoom?: boolean;
  resetViewToken?: number;
  onHexClick?: (hexKey: string) => void;
  onEdgeClick?: (edgeKey: string) => void;
  selectedHexKey?: string | null;
  highlightHexKeys?: string[];
  validHexKeys?: string[];
  previewEdgeKeys?: string[];
  previewHexPair?: { from: string; to: string } | null;
  isTargeting?: boolean;
  actionAnimations?: BoardActionAnimation[];
  actionAnimationDurationMs?: number;
  actionAnimationHold?: boolean;
  overlays?: BoardOverlayItem[];
};

type TooltipTone = "title" | "label" | "body";

type TooltipLine = {
  text: string;
  tone: TooltipTone;
};

type ChampionDetail = {
  id: string;
  cardDefId: string;
  name: string;
  hp: number;
  maxHp: number;
  attackDice: number;
  hitFaces: number;
  bounty: number;
  abilityUses: Record<string, UseCounter>;
};

type ChampionToken = {
  label: string;
  isExtra: boolean;
  champion?: ChampionDetail;
  extraCount?: number;
};

type ChampionTooltip = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: TooltipLine[];
};

type TileTooltip = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

type EffectBadge = {
  key: string;
  x: number;
  y: number;
  label: string;
  title: string;
  tone: "edge" | "hex";
};

const HEX_DRAW_SCALE = 0.94;
const HEX_DRAW_SIZE = HEX_SIZE * HEX_DRAW_SCALE;
const BRIDGE_INSET = HEX_DRAW_SIZE * 0.4;
const BRIDGE_WIDTH = HEX_DRAW_SIZE * 0.32;
const BRIDGE_RAIL_OFFSET = BRIDGE_WIDTH * 0.38;
const BRIDGE_PLANK_EDGE_PAD = BRIDGE_WIDTH * 0.6;
const BRIDGE_PLANK_SPACING = HEX_DRAW_SIZE * 0.28;
const BRIDGE_PLANK_LENGTH = BRIDGE_WIDTH * 0.85;
const OVERLAY_DEFAULT_WIDTH = 180;
const OVERLAY_DEFAULT_HEIGHT = 120;
const OVERLAY_OFFSET_Y = HEX_SIZE * 0.6;
const TOOLTIP_MIN_WIDTH = 118;
const TOOLTIP_MAX_WIDTH = 210;
const TOOLTIP_CHAR_WIDTH = 5.6;
const TOOLTIP_LINE_HEIGHT = 12;
const TOOLTIP_PADDING_X = 8;
const TOOLTIP_PADDING_Y = 6;
const TOOLTIP_OFFSET_X = 14;
const TOOLTIP_OFFSET_Y = 16;
const TILE_TOOLTIP_MIN_WIDTH = 56;
const TILE_TOOLTIP_MAX_WIDTH = 120;
const TILE_TOOLTIP_CHAR_WIDTH = 6;
const TILE_TOOLTIP_LINE_HEIGHT = 12;
const TILE_TOOLTIP_PADDING_X = 6;
const TILE_TOOLTIP_PADDING_Y = 4;
const TILE_TOOLTIP_OFFSET_X = 10;
const TILE_TOOLTIP_OFFSET_Y = 12;
const FORCE_TOKEN_ART_CARD_ID = "age1.recruit_detachment";
const FORCE_TOKEN_ART_URL = getCardArtUrl(FORCE_TOKEN_ART_CARD_ID);
const toSvgId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
const UNIT_MOVE_PULSE_MS = 720;
const EFFECT_BADGE_RADIUS = HEX_DRAW_SIZE * 0.12;
const EFFECT_BADGE_OFFSET = HEX_DRAW_SIZE * 0.3;
const HOME_CAPITAL_RING_SIZE = HEX_DRAW_SIZE * 1.06;
const TILE_TEXTURES = [
  {
    id: "normal",
    src: "/tile-textures/standard_tile.png",
    base: "var(--normal)"
  },
  {
    id: "capital",
    src: "/tile-textures/capital.png",
    base: "var(--capital)"
  },
  {
    id: "forge",
    src: "/tile-textures/forge.png",
    base: "var(--forge)"
  },
  {
    id: "mine",
    src: "/tile-textures/mine.png",
    base: "var(--mine)"
  },
  {
    id: "center",
    src: "/tile-textures/center.png",
    base: "var(--center)"
  }
] as const;

const shortenSegment = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  inset: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= inset * 2) {
    return { from, to };
  }
  const nx = dx / length;
  const ny = dy / length;
  return {
    from: { x: from.x + nx * inset, y: from.y + ny * inset },
    to: { x: to.x - nx * inset, y: to.y - ny * inset }
  };
};

const buildPathD = (points: Array<{ x: number; y: number }>): string | null => {
  if (points.length < 2) {
    return null;
  }
  const [start, ...rest] = points;
  const segments = rest.map((point) => `L ${point.x} ${point.y}`).join(" ");
  return `M ${start.x} ${start.y} ${segments}`;
};

const tileTag = (tile: string) => {
  switch (tile) {
    case "capital":
      return "CAP";
    case "forge":
      return "FORGE";
    case "mine":
      return "MINE";
    case "center":
      return "CTR";
    default:
      return "";
  }
};

const tileLabel = (tile: string): string | null => {
  switch (tile) {
    case "capital":
      return "Capital";
    case "forge":
      return "Forge";
    case "mine":
      return "Mine";
    case "center":
      return "Center";
    default:
      return null;
  }
};

const boundsForHexes = (hexes: HexRender[]): ViewBox => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const hex of hexes) {
    minX = Math.min(minX, hex.x);
    maxX = Math.max(maxX, hex.x);
    minY = Math.min(minY, hex.y);
    maxY = Math.max(maxY, hex.y);
  }

  const padding = HEX_SIZE * 1.2;
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeColorIndex = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(5, Math.floor(value)));
};

const getCardName = (cardDefId: string) => {
  return CARD_DEFS_BY_ID[cardDefId]?.name ?? cardDefId;
};

const getModifierSourceLabel = (modifier: ModifierView) => {
  if (modifier.source.type === "faction") {
    return `Faction: ${formatAbilityName(modifier.source.sourceId)}`;
  }
  const name = getCardName(modifier.source.sourceId);
  return modifier.source.type === "champion" ? `Champion: ${name}` : name;
};

const getChampionGlyph = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  const glyph = initials.replace(/[^A-Z]/g, "").slice(0, 2);
  if (glyph) {
    return glyph;
  }
  const fallback = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return fallback || "C";
};

const formatAbilityName = (abilityId: string) =>
  abilityId.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

const formatAbilityUses = (uses: Record<string, UseCounter>): string | null => {
  const entries = Object.entries(uses);
  if (entries.length === 0) {
    return null;
  }
  return entries
    .map(([abilityId, counter]) => `${formatAbilityName(abilityId)} ${counter.remaining}`)
    .join(", ");
};

const getAbilityUseTotal = (uses: Record<string, UseCounter>): number => {
  return Object.values(uses).reduce((sum, entry) => {
    const remaining = typeof entry?.remaining === "number" ? entry.remaining : 0;
    return sum + Math.max(0, remaining);
  }, 0);
};

const wrapText = (text: string, maxLength: number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
};

const limitTextLines = (lines: string[], maxLines: number): string[] => {
  if (lines.length <= maxLines) {
    return lines;
  }
  const trimmed = lines.slice(0, maxLines);
  const lastIndex = trimmed.length - 1;
  trimmed[lastIndex] = trimmed[lastIndex].replace(/\.*$/, "") + "...";
  return trimmed;
};

const buildChampionTooltipLines = (champion: ChampionDetail): TooltipLine[] => {
  const damage = Math.max(0, champion.maxHp - champion.hp);
  const lines: TooltipLine[] = [
    { text: champion.name, tone: "title" },
    { text: `HP ${champion.hp}/${champion.maxHp} (damage ${damage})`, tone: "body" },
    { text: `Attack ${champion.attackDice}d${champion.hitFaces}`, tone: "body" },
    { text: `Bounty ${champion.bounty}`, tone: "body" }
  ];
  const uses = formatAbilityUses(champion.abilityUses);
  if (uses) {
    lines.push({ text: `Ability uses (blue dot): ${uses}`, tone: "body" });
  }
  const rulesText = CARD_DEFS_BY_ID[champion.cardDefId]?.rulesText?.trim();
  if (rulesText) {
    lines.push({ text: "Rules:", tone: "label" });
    const wrapped = limitTextLines(wrapText(rulesText, 28), 7);
    wrapped.forEach((line) => {
      lines.push({ text: line, tone: "body" });
    });
  }
  return lines;
};

const buildExtraChampionTooltipLines = (extraCount: number): TooltipLine[] => [
  {
    text: `${extraCount} more champion${extraCount === 1 ? "" : "s"}`,
    tone: "body"
  }
];

const viewBoxEquals = (a: ViewBox, b: ViewBox): boolean => {
  const epsilon = 0.01;
  return (
    Math.abs(a.minX - b.minX) < epsilon &&
    Math.abs(a.minY - b.minY) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
};

const clampViewBox = (viewBox: ViewBox, baseViewBox: ViewBox): ViewBox => {
  const baseMaxX = baseViewBox.minX + baseViewBox.width;
  const baseMaxY = baseViewBox.minY + baseViewBox.height;
  const marginX = viewBox.width * 0.7;
  const marginY = viewBox.height * 0.7;
  const minAllowedX = baseViewBox.minX - marginX;
  const maxAllowedX = baseMaxX + marginX - viewBox.width;
  const minAllowedY = baseViewBox.minY - marginY;
  const maxAllowedY = baseMaxY + marginY - viewBox.height;
  const minX =
    minAllowedX > maxAllowedX
      ? baseViewBox.minX + (baseViewBox.width - viewBox.width) / 2
      : clamp(viewBox.minX, minAllowedX, maxAllowedX);
  const minY =
    minAllowedY > maxAllowedY
      ? baseViewBox.minY + (baseViewBox.height - viewBox.height) / 2
      : clamp(viewBox.minY, minAllowedY, maxAllowedY);
  return { ...viewBox, minX, minY };
};

export const BoardView = ({
  hexes,
  board,
  modifiers,
  playerIndexById,
  playerFactionById,
  capitalOwnerByHex,
  homeCapitalHexKey = null,
  showCoords = true,
  showTags = true,
  showMineValues = true,
  labelByHex,
  labelVariant = "slot",
  className,
  enablePanZoom = false,
  resetViewToken,
  onHexClick,
  onEdgeClick,
  selectedHexKey = null,
  highlightHexKeys = [],
  validHexKeys = [],
  previewEdgeKeys = [],
  previewHexPair = null,
  isTargeting = false,
  actionAnimations = [],
  actionAnimationDurationMs,
  actionAnimationHold = false,
  overlays = []
}: BoardViewProps) => {
  const baseViewBox = useMemo(() => boundsForHexes(hexes), [hexes]);
  const [viewBox, setViewBox] = useState(baseViewBox);
  const [isPanning, setIsPanning] = useState(false);
  const [championTooltip, setChampionTooltip] = useState<ChampionTooltip | null>(null);
  const [tileTooltip, setTileTooltip] = useState<TileTooltip | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastBaseViewBoxRef = useRef<ViewBox | null>(null);
  const lastResetTokenRef = useRef<number | null>(resetViewToken ?? null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const capturedPointersRef = useRef<Set<number>>(new Set());
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(
    new Map()
  );
  const pinchRef = useRef<{ distance: number; center: { x: number; y: number } } | null>(
    null
  );
  const [recentStackKeys, setRecentStackKeys] = useState<string[]>([]);
  const recentStackTimersRef = useRef<Record<string, number>>({});
  const previousStackKeysRef = useRef<Set<string>>(new Set());
  const hasStackBaselineRef = useRef(false);
  const highlightSet = useMemo(() => new Set(highlightHexKeys), [highlightHexKeys]);
  const validSet = useMemo(() => new Set(validHexKeys), [validHexKeys]);
  const hasValidTargets = validSet.size > 0;

  useEffect(() => {
    const resetToken = resetViewToken ?? null;
    const resetChanged = resetToken !== lastResetTokenRef.current;
    const baseChanged =
      !lastBaseViewBoxRef.current || !viewBoxEquals(lastBaseViewBoxRef.current, baseViewBox);
    if (resetChanged || baseChanged) {
      setViewBox(baseViewBox);
      lastBaseViewBoxRef.current = baseViewBox;
      lastResetTokenRef.current = resetToken;
    }
  }, [baseViewBox, resetViewToken]);

  useEffect(() => {
    if (isPanning) {
      setChampionTooltip(null);
    }
  }, [isPanning]);

  useEffect(() => {
    if (!board) {
      setChampionTooltip(null);
    }
  }, [board]);
  const hexCenters = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const hex of hexes) {
      map.set(hex.key, { x: hex.x, y: hex.y });
    }
    return map;
  }, [hexes]);

  const bridgeSegments = useMemo(() => {
    if (!board) {
      return [];
    }
    const segments: Array<{
      key: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      length: number;
      ux: number;
      uy: number;
      px: number;
      py: number;
    }> = [];
    for (const bridge of Object.values(board.bridges)) {
      const from = hexCenters.get(bridge.from);
      const to = hexCenters.get(bridge.to);
      if (!from || !to) {
        continue;
      }
      const shortened = shortenSegment(from, to, BRIDGE_INSET);
      const dx = shortened.to.x - shortened.from.x;
      const dy = shortened.to.y - shortened.from.y;
      const length = Math.hypot(dx, dy);
      const ux = length > 0 ? dx / length : 0;
      const uy = length > 0 ? dy / length : 0;
      segments.push({
        key: bridge.key,
        from: shortened.from,
        to: shortened.to,
        length,
        ux,
        uy,
        px: -uy,
        py: ux
      });
    }
    return segments;
  }, [board, hexCenters]);

  const previewSegments = useMemo(() => {
    if (previewEdgeKeys.length === 0) {
      return [];
    }
    const segments: Array<{
      key: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }> = [];
    for (const edgeKey of previewEdgeKeys) {
      let rawA: string;
      let rawB: string;
      try {
        [rawA, rawB] = parseEdgeKey(edgeKey);
      } catch {
        continue;
      }
      const from = hexCenters.get(rawA);
      const to = hexCenters.get(rawB);
      if (!from || !to) {
        continue;
      }
      const shortened = shortenSegment(from, to, BRIDGE_INSET);
      segments.push({
        key: edgeKey,
        from: shortened.from,
        to: shortened.to
      });
    }
    return segments;
  }, [previewEdgeKeys, hexCenters]);

  const previewHexLink = useMemo(() => {
    if (!previewHexPair) {
      return null;
    }
    const from = hexCenters.get(previewHexPair.from);
    const to = hexCenters.get(previewHexPair.to);
    if (!from || !to) {
      return null;
    }
    const shortened = shortenSegment(from, to, BRIDGE_INSET);
    return { from: shortened.from, to: shortened.to };
  }, [hexCenters, previewHexPair]);

  const bridgeSegmentByKey = useMemo(() => {
    const map = new Map<string, (typeof bridgeSegments)[number]>();
    bridgeSegments.forEach((segment) => {
      map.set(segment.key, segment);
    });
    return map;
  }, [bridgeSegments]);

  const effectBadges = useMemo(() => {
    const edgeBadges: EffectBadge[] = [];
    const hexBadges: EffectBadge[] = [];
    if (!modifiers || modifiers.length === 0) {
      return { edgeBadges, hexBadges };
    }
    const edgeModifiers = new Map<string, ModifierView[]>();
    const hexModifiers = new Map<string, ModifierView[]>();

    modifiers.forEach((modifier) => {
      if (modifier.attachedEdge) {
        const list = edgeModifiers.get(modifier.attachedEdge) ?? [];
        list.push(modifier);
        edgeModifiers.set(modifier.attachedEdge, list);
      }
      if (modifier.attachedHex) {
        const list = hexModifiers.get(modifier.attachedHex) ?? [];
        list.push(modifier);
        hexModifiers.set(modifier.attachedHex, list);
      }
    });

    const buildLabel = (entries: ModifierView[]) =>
      entries.length > 1 ? String(entries.length) : "FX";
    const buildTitle = (entries: ModifierView[]) =>
      entries.map((modifier) => getModifierSourceLabel(modifier)).join("\n");

    edgeModifiers.forEach((entries, edgeKey) => {
      let x: number | null = null;
      let y: number | null = null;
      const segment = bridgeSegmentByKey.get(edgeKey);
      if (segment) {
        x = (segment.from.x + segment.to.x) / 2 + segment.px * (BRIDGE_WIDTH * 0.55);
        y = (segment.from.y + segment.to.y) / 2 + segment.py * (BRIDGE_WIDTH * 0.55);
      } else {
        try {
          const [fromKey, toKey] = parseEdgeKey(edgeKey);
          const from = hexCenters.get(fromKey);
          const to = hexCenters.get(toKey);
          if (from && to) {
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const px = -dy / length;
            const py = dx / length;
            x = midX + px * (BRIDGE_WIDTH * 0.55);
            y = midY + py * (BRIDGE_WIDTH * 0.55);
          }
        } catch {
          x = null;
          y = null;
        }
      }
      if (x === null || y === null) {
        return;
      }
      edgeBadges.push({
        key: edgeKey,
        x,
        y,
        label: buildLabel(entries),
        title: buildTitle(entries),
        tone: "edge"
      });
    });

    hexModifiers.forEach((entries, hexKey) => {
      const center = hexCenters.get(hexKey);
      if (!center) {
        return;
      }
      hexBadges.push({
        key: hexKey,
        x: center.x + EFFECT_BADGE_OFFSET,
        y: center.y - EFFECT_BADGE_OFFSET,
        label: buildLabel(entries),
        title: buildTitle(entries),
        tone: "hex"
      });
    });

    return { edgeBadges, hexBadges };
  }, [bridgeSegmentByKey, hexCenters, modifiers]);

  const unitStacks = useMemo(() => {
    if (!board) {
      return [];
    }
    const stacks: Array<{
      key: string;
      hexKey: string;
      x: number;
      y: number;
      ownerPlayerId: string;
      forceCount: number;
      championCount: number;
      championDetails: ChampionDetail[];
      offsetIndex: number;
      occupantCount: number;
    }> = [];

    for (const hex of Object.values(board.hexes)) {
      const center = hexCenters.get(hex.key);
      if (!center) {
        continue;
      }

      const occupants = Object.entries(hex.occupants)
        .filter(([, unitIds]) => unitIds.length > 0)
        .sort(([a], [b]) => a.localeCompare(b));

      occupants.forEach(([playerId, unitIds], index) => {
        let forceCount = 0;
        let championCount = 0;
        const championDetails: ChampionDetail[] = [];
        for (const unitId of unitIds) {
          const unit = board.units[unitId];
          if (!unit) {
            continue;
          }
          if (unit.kind === "force") {
            forceCount += 1;
          } else {
            championCount += 1;
            const name = getCardName(unit.cardDefId);
            championDetails.push({
              id: unit.id,
              cardDefId: unit.cardDefId,
              name,
              hp: unit.hp,
              maxHp: unit.maxHp,
              attackDice: unit.attackDice,
              hitFaces: unit.hitFaces,
              bounty: unit.bounty,
              abilityUses: unit.abilityUses ?? {}
            });
          }
        }
        if (forceCount + championCount === 0) {
          return;
        }
        championDetails.sort((a, b) => {
          if (a.cardDefId !== b.cardDefId) {
            return a.cardDefId.localeCompare(b.cardDefId);
          }
          return a.id.localeCompare(b.id);
        });
        stacks.push({
          key: `${hex.key}:${playerId}`,
          hexKey: hex.key,
          x: center.x,
          y: center.y,
          ownerPlayerId: playerId,
          forceCount,
          championCount,
          championDetails,
          offsetIndex: index,
          occupantCount: occupants.length
        });
      });
    }

    return stacks;
  }, [board, hexCenters]);

  useEffect(() => {
    const nextKeys = new Set(unitStacks.map((stack) => stack.key));
    if (!hasStackBaselineRef.current) {
      hasStackBaselineRef.current = true;
      previousStackKeysRef.current = nextKeys;
      return;
    }

    const arrivals = unitStacks
      .filter((stack) => !previousStackKeysRef.current.has(stack.key))
      .map((stack) => stack.key);

    if (arrivals.length > 0) {
      setRecentStackKeys((prev) => {
        const merged = new Set(prev);
        arrivals.forEach((key) => merged.add(key));
        return Array.from(merged);
      });

      arrivals.forEach((key) => {
        const existing = recentStackTimersRef.current[key];
        if (existing) {
          window.clearTimeout(existing);
        }
        recentStackTimersRef.current[key] = window.setTimeout(() => {
          setRecentStackKeys((prev) => prev.filter((entry) => entry !== key));
          delete recentStackTimersRef.current[key];
        }, UNIT_MOVE_PULSE_MS);
      });
    }

    previousStackKeysRef.current = nextKeys;
  }, [unitStacks]);

  useEffect(() => {
    return () => {
      Object.values(recentStackTimersRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  const fallbackPlayerIndex = useMemo(() => {
    const ids = new Set<string>();
    for (const stack of unitStacks) {
      ids.add(stack.ownerPlayerId);
    }
    const sorted = Array.from(ids).sort();
    return new Map(sorted.map((id, index) => [id, index]));
  }, [unitStacks]);

  const playerIndex = useMemo(() => {
    if (!playerIndexById) {
      return fallbackPlayerIndex;
    }
    const merged = new Map<string, number>();
    for (const [id, index] of Object.entries(playerIndexById)) {
      merged.set(id, index);
    }
    for (const [id, index] of fallbackPlayerIndex) {
      if (!merged.has(id)) {
        merged.set(id, index);
      }
    }
    return merged;
  }, [playerIndexById, fallbackPlayerIndex]);

  const recentStackKeySet = useMemo(() => new Set(recentStackKeys), [recentStackKeys]);

  const playerLabel = (playerId?: string) => {
    if (!playerId) {
      return "neutral";
    }
    const index = playerIndex.get(playerId);
    return index !== undefined ? `P${index + 1}` : playerId;
  };

  const resolvePathPoints = (path: string[] | undefined) => {
    if (!path || path.length < 2) {
      return null;
    }
    const points = path
      .map((hexKey) => hexCenters.get(hexKey))
      .filter((point): point is { x: number; y: number } => Boolean(point));
    return points.length >= 2 ? points : null;
  };

  const resolveEdgeSegment = (edgeKey: string | undefined) => {
    if (!edgeKey) {
      return null;
    }
    try {
      const [fromKey, toKey] = parseEdgeKey(edgeKey);
      const from = hexCenters.get(fromKey);
      const to = hexCenters.get(toKey);
      if (!from || !to) {
        return null;
      }
      return shortenSegment(from, to, BRIDGE_INSET);
    } catch {
      return null;
    }
  };

  const resolveHexCenter = (hexKey: string | undefined) => {
    if (!hexKey) {
      return null;
    }
    return hexCenters.get(hexKey) ?? null;
  };

  const actionAnimationDuration = actionAnimationDurationMs ?? 0;
  const actionAnimationStyle = actionAnimationDuration
    ? ({ ["--action-anim-duration" as string]: `${actionAnimationDuration}ms` } as CSSProperties)
    : undefined;
  const actionAnimationsActive =
    actionAnimations.length > 0 && (actionAnimationDuration > 0 || actionAnimationHold);
  const actionHoldStyle = actionAnimationHold
    ? ({ animation: "none", opacity: 0.85 } as CSSProperties)
    : undefined;
  const actionHoldUnitStyle = actionAnimationHold
    ? ({ animation: "none", opacity: 0.95 } as CSSProperties)
    : undefined;
  const shouldAnimateUnits = !actionAnimationHold && actionAnimationDuration > 0;

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) {
      return null;
    }
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const getPinchData = () => {
    if (activePointersRef.current.size < 2) {
      return null;
    }
    const points = Array.from(activePointersRef.current.values());
    const first = points[0];
    const second = points[1];
    if (!first || !second) {
      return null;
    }
    const centerClientX = (first.clientX + second.clientX) / 2;
    const centerClientY = (first.clientY + second.clientY) / 2;
    const center = toSvgPoint(centerClientX, centerClientY);
    if (!center) {
      return null;
    }
    const distance = Math.hypot(
      first.clientX - second.clientX,
      first.clientY - second.clientY
    );
    return { distance, center };
  };

  const buildTooltip = (
    lines: TooltipLine[],
    anchorX: number,
    anchorY: number
  ): ChampionTooltip | null => {
    if (lines.length === 0) {
      return null;
    }
    const longestLine = Math.max(...lines.map((line) => line.text.length));
    const estimatedWidth = longestLine * TOOLTIP_CHAR_WIDTH + TOOLTIP_PADDING_X * 2;
    const width = clamp(estimatedWidth, TOOLTIP_MIN_WIDTH, TOOLTIP_MAX_WIDTH);
    const height = lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING_Y * 2;
    const rawX = anchorX + TOOLTIP_OFFSET_X;
    const rawY = anchorY - height - TOOLTIP_OFFSET_Y;
    const minX = viewBox.minX + 4;
    const maxX = viewBox.minX + viewBox.width - width - 4;
    const minY = viewBox.minY + 4;
    const maxY = viewBox.minY + viewBox.height - height - 4;
    return {
      x: clamp(rawX, minX, maxX),
      y: clamp(rawY, minY, maxY),
      width,
      height,
      lines
    };
  };

  const buildTileTooltip = (
    label: string,
    anchorX: number,
    anchorY: number
  ): TileTooltip | null => {
    if (!label) {
      return null;
    }
    const estimatedWidth =
      label.length * TILE_TOOLTIP_CHAR_WIDTH + TILE_TOOLTIP_PADDING_X * 2;
    const width = clamp(estimatedWidth, TILE_TOOLTIP_MIN_WIDTH, TILE_TOOLTIP_MAX_WIDTH);
    const height = TILE_TOOLTIP_LINE_HEIGHT + TILE_TOOLTIP_PADDING_Y * 2;
    const rawX = anchorX + TILE_TOOLTIP_OFFSET_X;
    const rawY = anchorY - height - TILE_TOOLTIP_OFFSET_Y;
    const minX = viewBox.minX + 4;
    const maxX = viewBox.minX + viewBox.width - width - 4;
    const minY = viewBox.minY + 4;
    const maxY = viewBox.minY + viewBox.height - height - 4;
    return {
      x: clamp(rawX, minX, maxX),
      y: clamp(rawY, minY, maxY),
      width,
      height,
      label
    };
  };

  const handleWheel: WheelEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom) {
      return;
    }
    const point = toSvgPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 1.12 : 0.9;
    setViewBox((current) => {
      const nextWidth = clamp(
        current.width * zoomFactor,
        baseViewBox.width * 0.4,
        baseViewBox.width * 2.5
      );
      const nextHeight = clamp(
        current.height * zoomFactor,
        baseViewBox.height * 0.4,
        baseViewBox.height * 2.5
      );
      const widthRatio = nextWidth / current.width;
      const heightRatio = nextHeight / current.height;
      return clampViewBox(
        {
          minX: point.x - (point.x - current.minX) * widthRatio,
          minY: point.y - (point.y - current.minY) * heightRatio,
          width: nextWidth,
          height: nextHeight
        },
        baseViewBox
      );
    });
  };

  // Delay pointer capture until we actually pan/pinch so clicks reach SVG targets.
  const capturePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (capturedPointersRef.current.has(event.pointerId)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    capturedPointersRef.current.add(event.pointerId);
  };

  const releasePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!capturedPointersRef.current.has(event.pointerId)) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    capturedPointersRef.current.delete(event.pointerId);
  };

  const handlePointerDown: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    const point = toSvgPoint(event.clientX, event.clientY);
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
    const pinchData = getPinchData();
    if (pinchData) {
      capturePointer(event);
      pinchRef.current = pinchData;
      didDragRef.current = true;
      dragRef.current = null;
      dragStartRef.current = null;
      setIsPanning(true);
      return;
    }
    if (!point) {
      return;
    }
    dragRef.current = point;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    setIsPanning(false);
  };

  const handlePointerMove: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom) {
      return;
    }
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY
      });
    }
    const pinchData = getPinchData();
    if (pinchData) {
      if (!pinchRef.current) {
        pinchRef.current = pinchData;
        capturePointer(event);
        didDragRef.current = true;
        setIsPanning(true);
        return;
      }
      const scale =
        pinchData.distance > 0 ? pinchRef.current.distance / pinchData.distance : 1;
      pinchRef.current = pinchData;
      capturePointer(event);
      setViewBox((current) => {
        const nextWidth = clamp(
          current.width * scale,
          baseViewBox.width * 0.4,
          baseViewBox.width * 2.5
        );
        const nextHeight = clamp(
          current.height * scale,
          baseViewBox.height * 0.4,
          baseViewBox.height * 2.5
        );
        const widthRatio = nextWidth / current.width;
        const heightRatio = nextHeight / current.height;
        return clampViewBox(
          {
            minX: pinchData.center.x - (pinchData.center.x - current.minX) * widthRatio,
            minY: pinchData.center.y - (pinchData.center.y - current.minY) * heightRatio,
            width: nextWidth,
            height: nextHeight
          },
          baseViewBox
        );
      });
      didDragRef.current = true;
      return;
    }
    if (!dragRef.current || !dragStartRef.current) {
      return;
    }
    const point = toSvgPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    if (!didDragRef.current) {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) < 6) {
        return;
      }
      capturePointer(event);
      didDragRef.current = true;
      setIsPanning(true);
      dragRef.current = point;
      return;
    }
    const dx = dragRef.current.x - point.x;
    const dy = dragRef.current.y - point.y;
    dragRef.current = point;
    setViewBox((current) =>
      clampViewBox(
        {
          ...current,
          minX: current.minX + dx,
          minY: current.minY + dy
        },
        baseViewBox
      )
    );
  };

  const handlePointerUp: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom) {
      return;
    }
    releasePointer(event);
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    dragStartRef.current = null;
    setIsPanning(false);
    didDragRef.current = false;
  };

  const handlePointerCancel: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom) {
      return;
    }
    releasePointer(event);
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    dragStartRef.current = null;
    setIsPanning(false);
    didDragRef.current = false;
    setChampionTooltip(null);
    setTileTooltip(null);
  };

  const handlePointerLeave: PointerEventHandler<SVGSVGElement> = (event) => {
    if (capturedPointersRef.current.size > 0) {
      return;
    }
    for (const pointerId of capturedPointersRef.current) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
    capturedPointersRef.current.clear();
    dragRef.current = null;
    dragStartRef.current = null;
    activePointersRef.current.clear();
    pinchRef.current = null;
    setIsPanning(false);
    didDragRef.current = false;
    setChampionTooltip(null);
    setTileTooltip(null);
  };

  const clickable = Boolean(onHexClick);
  const edgeClickable = Boolean(onEdgeClick);
  const svgClasses = [className ?? "board-svg"];
  if (enablePanZoom || clickable || edgeClickable) {
    svgClasses.push("board-svg--interactive");
  }
  if (isTargeting) {
    svgClasses.push("is-targeting");
  }
  if (isPanning) {
    svgClasses.push("is-panning");
  }

  const svgStyle: CSSProperties = {
    userSelect: "none",
    WebkitUserSelect: "none",
    ...(enablePanZoom ? { touchAction: "none" } : {})
  };

  const handleEdgeClick = (edgeKey: string) => {
    if (didDragRef.current) {
      return;
    }
    onEdgeClick?.(edgeKey);
  };

  const handleStackClick = (hexKey: string) => {
    if (didDragRef.current) {
      return;
    }
    onHexClick?.(hexKey);
  };

  const overlayNodes = overlays.flatMap((overlay) => {
    const center = hexCenters.get(overlay.hexKey);
    if (!center) {
      return [];
    }
    const width = overlay.width ?? OVERLAY_DEFAULT_WIDTH;
    const height = overlay.height ?? OVERLAY_DEFAULT_HEIGHT;
    const offsetX = overlay.offsetX ?? -width / 2;
    const offsetY = overlay.offsetY ?? -height - OVERLAY_OFFSET_Y;
    const x = center.x + offsetX;
    const y = center.y + offsetY;
    const className = ["board-overlay__content", overlay.className ?? ""]
      .filter(Boolean)
      .join(" ");
    return [
      <foreignObject
        key={overlay.id}
        className="board-overlay__item"
        x={x}
        y={y}
        width={width}
        height={height}
      >
        <div className={className}>{overlay.content}</div>
      </foreignObject>
    ];
  });

  return (
    <svg
      ref={svgRef}
      className={svgClasses.join(" ")}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      style={svgStyle}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      <defs>
        <filter id="unit-art-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0.45" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.8" />
            <feFuncG type="linear" slope="0.8" />
            <feFuncB type="linear" slope="0.8" />
          </feComponentTransfer>
        </filter>
        <filter id="tile-texture-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0.7" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.85" />
            <feFuncG type="linear" slope="0.85" />
            <feFuncB type="linear" slope="0.85" />
          </feComponentTransfer>
        </filter>
        <radialGradient id="hex-vignette" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="70%" stopColor="#000" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        {TILE_TEXTURES.map((texture) => (
          <pattern
            key={texture.id}
            id={`tile-texture-${texture.id}`}
            width="1"
            height="1"
            patternUnits="objectBoundingBox"
            patternContentUnits="objectBoundingBox"
          >
            <rect width="1" height="1" fill={texture.base} />
            <image
              href={texture.src}
              width="1"
              height="1"
              preserveAspectRatio="xMidYMid slice"
              filter="url(#tile-texture-filter)"
            />
          </pattern>
        ))}
      </defs>
      {hexes.map((hex) => {
        const tag = showTags ? tileTag(hex.tile) : "";
        const isHomeCapital = homeCapitalHexKey === hex.key;
        const capitalOwner = hex.tile === "capital" ? capitalOwnerByHex?.[hex.key] : null;
        const tileLabelText = capitalOwner
          ? `Capital: ${capitalOwner}${isHomeCapital ? " (Home)" : ""}`
          : isHomeCapital
            ? "Home Capital"
            : tileLabel(hex.tile);
        const labelText = labelByHex?.[hex.key];
        const labelClassName =
          labelVariant === "coords"
            ? "hex__coords"
            : labelVariant === "label"
              ? "hex__label"
              : "hex__slot";
        const showCoordsText = showCoords && !labelText;
        const coordsY = tag ? hex.y + 8 : hex.y;
        const hasLowerText = showCoordsText || Boolean(labelText);
        const valueY = tag ? hex.y + (hasLowerText ? 20 : 12) : hex.y + 12;
        const isSelected = selectedHexKey === hex.key;
        const isHighlighted = highlightSet.has(hex.key);
        const isValidTarget = validSet.has(hex.key);
        const homeLabelY = tag ? hex.y - 18 : hex.y - 10;
        const isInactive =
          clickable && hasValidTargets && !isValidTarget && !isSelected && !isHighlighted;
        const hexPointsString = hexPoints(hex.x, hex.y, HEX_DRAW_SIZE);
        const vignetteClassName = isInactive
          ? "hex__vignette hex__vignette--inactive"
          : "hex__vignette";
        const occupantCount = board
          ? Object.values(board.hexes[hex.key]?.occupants ?? {}).filter(
              (unitIds) => unitIds.length > 0
            ).length
          : 0;
        const hexTitleParts = [`Hex ${hex.key}`];
        if (hex.tile && hex.tile !== "normal") {
          hexTitleParts.push(`Tile: ${hex.tile}`);
        }
        if (hex.tile === "capital") {
          const ownerLabel = capitalOwnerByHex?.[hex.key];
          if (ownerLabel) {
            hexTitleParts.push(`Capital: ${ownerLabel}`);
          }
        }
        if (isHomeCapital) {
          hexTitleParts.push("Home capital");
        }
        if (hex.tile === "mine" && hex.mineValue) {
          hexTitleParts.push(`Mine value: ${hex.mineValue}`);
        }
        if (occupantCount > 0) {
          hexTitleParts.push(`Stacks: ${occupantCount}`);
        }
        const hexTitle = hexTitleParts.join("\n");
        const polygonClasses = [
          "hex",
          `hex--${hex.tile}`,
          clickable ? "hex--clickable" : "",
          isSelected ? "hex--selected" : "",
          isHighlighted ? "hex--highlight" : "",
          isValidTarget ? "hex--target" : "",
          isInactive ? "hex--inactive" : ""
        ]
          .filter(Boolean)
          .join(" ");
        const handleTileEnter = () => {
          if (!tileLabelText || isPanning || didDragRef.current) {
            return;
          }
          const tooltip = buildTileTooltip(tileLabelText, hex.x, hex.y);
          if (tooltip) {
            setTileTooltip(tooltip);
          }
        };
        const handleTileLeave = () => {
          setTileTooltip(null);
        };

        return (
          <g key={hex.key} onMouseEnter={handleTileEnter} onMouseLeave={handleTileLeave}>
            <title>{hexTitle}</title>
            {isHomeCapital ? (
              <polygon
                className="hex__home-ring"
                points={hexPoints(hex.x, hex.y, HOME_CAPITAL_RING_SIZE)}
              />
            ) : null}
            <polygon
              className={polygonClasses}
              points={hexPointsString}
              onClick={() => {
                if (didDragRef.current) {
                  return;
                }
                onHexClick?.(hex.key);
              }}
            />
            <polygon className={vignetteClassName} points={hexPointsString} />
            {isHomeCapital ? (
              <text x={hex.x} y={homeLabelY} className="hex__home-label">
                HOME
              </text>
            ) : null}
            {tag ? (
              <text x={hex.x} y={hex.y - 6} className="hex__tag">
                {tag}
              </text>
            ) : null}
            {labelText ? (
              <text x={hex.x} y={coordsY} className={labelClassName}>
                {labelText}
              </text>
            ) : null}
            {showCoordsText ? (
              <text
                x={hex.x}
                y={coordsY}
                className={tag ? "hex__coords" : "hex__label"}
              >
                {hex.key}
              </text>
            ) : null}
            {showMineValues && hex.tile === "mine" && hex.mineValue ? (
              <text x={hex.x} y={valueY} className="hex__value">
                +{hex.mineValue}
              </text>
            ) : null}
          </g>
        );
      })}

      {previewSegments.map((segment) => (
        <g
          key={`preview-${segment.key}`}
          className={edgeClickable ? "bridge-preview is-clickable" : "bridge-preview"}
        >
          {edgeClickable ? (
            <line
              className="bridge bridge--preview bridge--hitbox"
              x1={segment.from.x}
              y1={segment.from.y}
              x2={segment.to.x}
              y2={segment.to.y}
              onClick={() => handleEdgeClick(segment.key)}
            />
          ) : null}
          <line
            className={`bridge bridge--preview ${edgeClickable ? "bridge--clickable" : ""}`}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
          />
        </g>
      ))}

      {previewHexLink ? (
        <g className="hex-link-preview" aria-hidden="true">
          <line
            className="hex-link-preview__line"
            x1={previewHexLink.from.x}
            y1={previewHexLink.from.y}
            x2={previewHexLink.to.x}
            y2={previewHexLink.to.y}
          />
        </g>
      ) : null}

      {bridgeSegments.map((bridge) => {
        if (bridge.length <= 0.01) {
          return null;
        }
        const bridgeTitle = `Bridge ${bridge.key}`;
        const railOffset = BRIDGE_RAIL_OFFSET;
        const plankSpan = bridge.length - BRIDGE_PLANK_EDGE_PAD * 2;
        const plankCount =
          plankSpan > 0 ? Math.max(1, Math.floor(plankSpan / BRIDGE_PLANK_SPACING) + 1) : 0;
        const plankSpacing = plankCount > 1 ? plankSpan / (plankCount - 1) : 0;
        const planks: Array<{
          key: string;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        }> = [];
        for (let i = 0; i < plankCount; i += 1) {
          const offset =
            plankCount === 1 ? bridge.length / 2 : BRIDGE_PLANK_EDGE_PAD + i * plankSpacing;
          const centerX = bridge.from.x + bridge.ux * offset;
          const centerY = bridge.from.y + bridge.uy * offset;
          const halfLength = BRIDGE_PLANK_LENGTH / 2;
          planks.push({
            key: `${bridge.key}-plank-${i}`,
            x1: centerX + bridge.px * halfLength,
            y1: centerY + bridge.py * halfLength,
            x2: centerX - bridge.px * halfLength,
            y2: centerY - bridge.py * halfLength
          });
        }
        const railAFrom = {
          x: bridge.from.x + bridge.px * railOffset,
          y: bridge.from.y + bridge.py * railOffset
        };
        const railATo = {
          x: bridge.to.x + bridge.px * railOffset,
          y: bridge.to.y + bridge.py * railOffset
        };
        const railBFrom = {
          x: bridge.from.x - bridge.px * railOffset,
          y: bridge.from.y - bridge.py * railOffset
        };
        const railBTo = {
          x: bridge.to.x - bridge.px * railOffset,
          y: bridge.to.y - bridge.py * railOffset
        };
        return (
          <g key={bridge.key} className="bridge">
            <title>{bridgeTitle}</title>
            <line
              className="bridge__body"
              x1={bridge.from.x}
              y1={bridge.from.y}
              x2={bridge.to.x}
              y2={bridge.to.y}
            />
            <line
              className="bridge__rail"
              x1={railAFrom.x}
              y1={railAFrom.y}
              x2={railATo.x}
              y2={railATo.y}
            />
            <line
              className="bridge__rail"
              x1={railBFrom.x}
              y1={railBFrom.y}
              x2={railBTo.x}
              y2={railBTo.y}
            />
            {planks.map((plank) => (
              <line
                key={plank.key}
                className="bridge__plank"
                x1={plank.x1}
                y1={plank.y1}
                x2={plank.x2}
                y2={plank.y2}
              />
            ))}
          </g>
        );
      })}

      {effectBadges.hexBadges.map((badge) => (
        <g key={`effect-hex-${badge.key}`} className="board-effect board-effect--hex">
          <title>{badge.title}</title>
          <circle className="board-effect__badge" cx={badge.x} cy={badge.y} r={EFFECT_BADGE_RADIUS} />
          <text className="board-effect__text" x={badge.x} y={badge.y}>
            {badge.label}
          </text>
        </g>
      ))}

      {effectBadges.edgeBadges.map((badge) => (
        <g key={`effect-edge-${badge.key}`} className="board-effect board-effect--edge">
          <title>{badge.title}</title>
          <circle className="board-effect__badge" cx={badge.x} cy={badge.y} r={EFFECT_BADGE_RADIUS} />
          <text className="board-effect__text" x={badge.x} y={badge.y}>
            {badge.label}
          </text>
        </g>
      ))}

      {unitStacks.map((stack) => {
        const colorIndex = normalizeColorIndex(playerIndex.get(stack.ownerPlayerId));
        const unitColorClass = colorIndex !== undefined ? ` unit--p${colorIndex}` : "";
        const factionSymbol = getFactionSymbol(playerFactionById?.[stack.ownerPlayerId]);
        const factionIconUrl = getFactionIconUrl(playerFactionById?.[stack.ownerPlayerId]);
        const offsets =
          stack.occupantCount > 1
            ? [
                { dx: -12, dy: 12 },
                { dx: 12, dy: 12 }
              ]
            : [{ dx: 0, dy: 12 }];
        const offset = offsets[stack.offsetIndex % offsets.length] ?? offsets[0];
        const stackX = stack.x + offset.dx;
        const stackY = stack.y + offset.dy;
        const championTokens: ChampionToken[] = (() => {
          if (stack.championDetails.length === 0) {
            return [];
          }
          const maxTokens = 3;
          const tokens = stack.championDetails.slice(0, maxTokens).map((champion) => ({
            label: getChampionGlyph(champion.name),
            isExtra: false,
            champion
          }));
          const extraCount = stack.championDetails.length - maxTokens;
          if (extraCount > 0) {
            tokens.push({
              label: `+${extraCount}`,
              isExtra: true,
              extraCount
            });
          }
          return tokens;
        })();
        const tokenRadius = 8;
        const tokenGap = 6;
        const showForceToken = stack.forceCount > 0;
        const tokenCenterY = showForceToken ? -26 : 0;
        const tokenDiameter = tokenRadius * 2;
        const totalTokenWidth =
          championTokens.length * tokenDiameter +
          Math.max(0, championTokens.length - 1) * tokenGap;
        const tokenLayout = championTokens.map((token, index) => ({
          ...token,
          cx: -totalTokenWidth / 2 + tokenRadius + index * (tokenDiameter + tokenGap),
          cy: tokenCenterY
        }));
        const badgeRadius = 4;
        const badgeX = 7;
        const badgeY = 7;
        const iconSize = badgeRadius * 1.6;
        const isArriving = recentStackKeySet.has(stack.key);
        const safeStackKey = toSvgId(stack.key);
        const showForceArt = showForceToken && Boolean(FORCE_TOKEN_ART_URL);
        const forceArtClipId = showForceArt ? `unit-art-${safeStackKey}` : null;
        return (
          <g
            key={stack.key}
            className={`unit-stack${isArriving ? " unit-stack--arrive" : ""}`}
            transform={`translate(${stackX} ${stackY})`}
            style={{ transition: "transform 320ms ease" }}
            onClick={() => handleStackClick(stack.hexKey)}
          >
            <g className={`unit-stack__body${unitColorClass}`}>
              {showForceToken ? (
                <>
                  <circle className="unit__rim" cx={0} cy={0} r={11} />
                  <circle
                    className="unit unit__core"
                    cx={0}
                    cy={0}
                    r={10}
                  />
                  {showForceArt && forceArtClipId ? (
                    <>
                      <defs>
                        <clipPath id={forceArtClipId}>
                          <circle cx={0} cy={0} r={10} />
                        </clipPath>
                      </defs>
                      <image
                        className="unit__art"
                        href={FORCE_TOKEN_ART_URL ?? undefined}
                        x={-10}
                        y={-10}
                        width={20}
                        height={20}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#${forceArtClipId})`}
                        filter="url(#unit-art-filter)"
                      />
                      <circle className="unit__art-tint" cx={0} cy={0} r={10} />
                    </>
                  ) : null}
                  <circle className="unit__glow" cx={-2} cy={-2} r={4} />
                  <text x={0} y={3} className="unit__count">
                    {stack.forceCount}
                  </text>
                  {factionSymbol || factionIconUrl ? (
                    <g className="unit-faction" aria-hidden="true">
                      <circle
                        className="unit-faction__ring"
                        cx={badgeX}
                        cy={badgeY}
                        r={badgeRadius}
                      />
                      {factionIconUrl ? (
                        <image
                          className="unit-faction__icon"
                          href={factionIconUrl}
                          x={badgeX - iconSize / 2}
                          y={badgeY - iconSize / 2}
                          width={iconSize}
                          height={iconSize}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      ) : (
                        <text
                          className="unit-faction__text"
                          x={badgeX}
                          y={badgeY}
                          dominantBaseline="middle"
                        >
                          {factionSymbol}
                        </text>
                      )}
                    </g>
                  ) : null}
                </>
              ) : (
                <circle cx={0} cy={0} r={12} fill="transparent" />
              )}
              {tokenLayout.map((token, index) => {
                const artUrl = token.champion
                  ? getCardArtUrl(token.champion.cardDefId)
                  : null;
                const hasArt = Boolean(artUrl) && !token.isExtra;
                const artClipId = hasArt
                  ? `champion-art-${safeStackKey}-${index}`
                  : null;
                const artRadius = tokenRadius - 0.8;
                const artDiameter = artRadius * 2;
                const ringClass = [
                  "champion-token__ring",
                  colorIndex !== undefined ? `champion-token__ring--p${colorIndex}` : "",
                  hasArt ? "champion-token__ring--art" : "",
                  token.isExtra ? "champion-token__ring--extra" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                const textClass = [
                  "champion-token__text",
                  token.isExtra ? "champion-token__text--extra" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                const anchorX = stackX + token.cx;
                const anchorY = stackY + token.cy;
                const handleTokenEnter = () => {
                  if (isPanning || didDragRef.current) {
                    return;
                  }
                  const lines = token.champion
                    ? buildChampionTooltipLines(token.champion)
                    : buildExtraChampionTooltipLines(token.extraCount ?? 0);
                  const tooltip = buildTooltip(lines, anchorX, anchorY);
                  if (tooltip) {
                    setChampionTooltip(tooltip);
                  }
                };
                const hpRadius = 5;
                const hpCx = token.cx + tokenRadius - 3.5;
                const hpCy = token.cy - tokenRadius + 3.5;
                const abilityCount = token.champion
                  ? getAbilityUseTotal(token.champion.abilityUses)
                  : 0;
                const abilityLabel = abilityCount > 9 ? "9+" : String(abilityCount);
                const abilityRadius = 4;
                const abilityCx = token.cx - tokenRadius + 3.5;
                const abilityCy = token.cy - tokenRadius + 3.5;
                return (
                  <g
                    key={`${stack.key}-champion-${index}`}
                    onMouseEnter={handleTokenEnter}
                    onMouseLeave={() => setChampionTooltip(null)}
                  >
                    {hasArt && artClipId ? (
                      <>
                        <defs>
                          <clipPath id={artClipId}>
                            <circle cx={token.cx} cy={token.cy} r={artRadius} />
                          </clipPath>
                        </defs>
                        <image
                          className="champion-token__art"
                          href={artUrl ?? undefined}
                          x={token.cx - artRadius}
                          y={token.cy - artRadius}
                          width={artDiameter}
                          height={artDiameter}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#${artClipId})`}
                          filter="url(#unit-art-filter)"
                        />
                      </>
                    ) : null}
                    <circle
                      className={ringClass}
                      cx={token.cx}
                      cy={token.cy}
                      r={tokenRadius}
                    />
                    <text className={textClass} x={token.cx} y={token.cy + 0.5}>
                      {token.label}
                    </text>
                    {token.champion ? (
                      <g className="champion-token__hp">
                        <circle
                          className="champion-token__hp-dot"
                          cx={hpCx}
                          cy={hpCy}
                          r={hpRadius}
                        />
                        <text
                          className="champion-token__hp-text"
                          x={hpCx}
                          y={hpCy + 0.4}
                        >
                          {token.champion.hp}
                        </text>
                      </g>
                    ) : null}
                    {token.champion && abilityCount > 0 ? (
                      <g className="champion-token__uses">
                        <circle
                          className="champion-token__uses-dot"
                          cx={abilityCx}
                          cy={abilityCy}
                          r={abilityRadius}
                        />
                        <text
                          className="champion-token__uses-text"
                          x={abilityCx}
                          y={abilityCy + 0.2}
                        >
                          {abilityLabel}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </g>
        );
      })}
      {actionAnimationsActive
        ? actionAnimations.map((animation) => {
            const colorIndex = normalizeColorIndex(
              animation.playerId ? playerIndex.get(animation.playerId) : undefined
            );
            const colorClass =
              colorIndex !== undefined ? `action-anim--p${colorIndex}` : "";
            const className = [
              "action-anim",
              `action-anim--${animation.kind}`,
              colorClass
            ]
              .filter(Boolean)
              .join(" ");
            if (animation.kind === "move") {
              const points = resolvePathPoints(animation.path);
              const pathD = points ? buildPathD(points) : null;
              if (!pathD) {
                return null;
              }
              const endPoint = points ? points[points.length - 1] : null;
              const unitKind = animation.unitKind ?? "force";
              const unitLabel = animation.unitLabel ?? null;
              const unitClassName = [
                "action-anim__unit",
                unitKind === "champion" ? "action-anim__unit--champion" : ""
              ]
                .filter(Boolean)
                .join(" ");
              const unitBodyClassName = [
                "action-anim__unit-body",
                unitKind === "champion" ? "action-anim__unit-body--champion" : ""
              ]
                .filter(Boolean)
                .join(" ");
              const unitTransform =
                actionAnimationHold && endPoint
                  ? `translate(${endPoint.x} ${endPoint.y})`
                  : undefined;
              return (
                <g key={animation.id} className={className} style={actionAnimationStyle}>
                  <path className="action-anim__path" d={pathD} style={actionHoldStyle} />
                  <g className={unitClassName} transform={unitTransform}>
                    {unitKind === "champion" ? (
                      <circle
                        className="action-anim__champion-ring"
                        r={11}
                        style={actionHoldUnitStyle}
                      />
                    ) : null}
                    <circle className={unitBodyClassName} r={9} style={actionHoldUnitStyle} />
                    {unitLabel ? (
                      <text
                        className="action-anim__unit-text"
                        y={0.4}
                        style={actionHoldUnitStyle}
                      >
                        {unitLabel}
                      </text>
                    ) : null}
                    {shouldAnimateUnits ? (
                      <animateMotion
                        dur={`${actionAnimationDuration}ms`}
                        path={pathD}
                        keyTimes="0;1"
                        calcMode="linear"
                      />
                    ) : null}
                  </g>
                </g>
              );
            }
            if (animation.kind === "edge") {
              const segment = resolveEdgeSegment(animation.edgeKey);
              if (!segment) {
                return null;
              }
              return (
                <g key={animation.id} className={className} style={actionAnimationStyle}>
                  <line
                    className="action-anim__edge"
                    x1={segment.from.x}
                    y1={segment.from.y}
                    x2={segment.to.x}
                    y2={segment.to.y}
                    style={actionHoldStyle}
                  />
                </g>
              );
            }
            if (animation.kind === "hex") {
              const center = resolveHexCenter(animation.hexKey);
              if (!center) {
                return null;
              }
              return (
                <g key={animation.id} className={className} style={actionAnimationStyle}>
                  <circle
                    className="action-anim__pulse"
                    cx={center.x}
                    cy={center.y}
                    r={14}
                    style={actionHoldStyle}
                  />
                </g>
              );
            }
            return null;
          })
        : null}
      {overlayNodes.length > 0 ? (
        <g className="board-overlay">{overlayNodes}</g>
      ) : null}
      {tileTooltip ? (
        <g
          className="tile-tooltip"
          transform={`translate(${tileTooltip.x} ${tileTooltip.y})`}
        >
          <rect
            className="tile-tooltip__box"
            x={0}
            y={0}
            width={tileTooltip.width}
            height={tileTooltip.height}
            rx={5}
            ry={5}
          />
          <text
            className="tile-tooltip__text"
            x={TILE_TOOLTIP_PADDING_X}
            y={TILE_TOOLTIP_PADDING_Y + TILE_TOOLTIP_LINE_HEIGHT - 2}
          >
            {tileTooltip.label}
          </text>
        </g>
      ) : null}
      {championTooltip ? (
        <g
          className="champion-tooltip"
          transform={`translate(${championTooltip.x} ${championTooltip.y})`}
        >
          <rect
            className="champion-tooltip__box"
            x={0}
            y={0}
            width={championTooltip.width}
            height={championTooltip.height}
            rx={6}
            ry={6}
          />
          <text
            className="champion-tooltip__text"
            x={TOOLTIP_PADDING_X}
            y={TOOLTIP_PADDING_Y + TOOLTIP_LINE_HEIGHT - 2}
          >
            {championTooltip.lines.map((line, index) => {
              const lineClass =
                line.tone === "title"
                  ? "champion-tooltip__title"
                  : line.tone === "label"
                    ? "champion-tooltip__label"
                    : "champion-tooltip__line";
              return (
                <tspan
                  key={`champion-tooltip-line-${index}`}
                  className={lineClass}
                  x={TOOLTIP_PADDING_X}
                  y={TOOLTIP_PADDING_Y + TOOLTIP_LINE_HEIGHT * (index + 1) - 2}
                >
                  {line.text}
                </tspan>
              );
            })}
          </text>
        </g>
      ) : null}
    </svg>
  );
};
