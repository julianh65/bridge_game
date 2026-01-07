import { useMemo, useRef, useState, useEffect } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  WheelEventHandler
} from "react";

import { CARD_DEFS_BY_ID, type BoardState, type UseCounter } from "@bridgefront/engine";
import { parseEdgeKey } from "@bridgefront/shared";

import { HEX_SIZE, hexPoints } from "../lib/hex-geometry";
import type { HexRender } from "../lib/board-preview";

type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

type BoardViewProps = {
  hexes: HexRender[];
  board?: BoardState;
  playerIndexById?: Record<string, number>;
  playerFactionById?: Record<string, string>;
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
  isTargeting?: boolean;
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

const HEX_DRAW_SCALE = 0.94;
const HEX_DRAW_SIZE = HEX_SIZE * HEX_DRAW_SCALE;
const BRIDGE_INSET = HEX_DRAW_SIZE * 0.4;
const BRIDGE_WIDTH = HEX_DRAW_SIZE * 0.32;
const BRIDGE_RAIL_OFFSET = BRIDGE_WIDTH * 0.38;
const BRIDGE_PLANK_EDGE_PAD = BRIDGE_WIDTH * 0.6;
const BRIDGE_PLANK_SPACING = HEX_DRAW_SIZE * 0.28;
const BRIDGE_PLANK_LENGTH = BRIDGE_WIDTH * 0.85;
const TOOLTIP_MIN_WIDTH = 118;
const TOOLTIP_MAX_WIDTH = 210;
const TOOLTIP_CHAR_WIDTH = 5.6;
const TOOLTIP_LINE_HEIGHT = 12;
const TOOLTIP_PADDING_X = 8;
const TOOLTIP_PADDING_Y = 6;
const TOOLTIP_OFFSET_X = 14;
const TOOLTIP_OFFSET_Y = 16;

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
    lines.push({ text: `Uses: ${uses}`, tone: "body" });
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
  const marginX = viewBox.width * 0.3;
  const marginY = viewBox.height * 0.3;
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
  playerIndexById,
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
  isTargeting = false
}: BoardViewProps) => {
  const baseViewBox = useMemo(() => boundsForHexes(hexes), [hexes]);
  const [viewBox, setViewBox] = useState(baseViewBox);
  const [isPanning, setIsPanning] = useState(false);
  const [championTooltip, setChampionTooltip] = useState<ChampionTooltip | null>(null);
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

  const playerLabel = (playerId?: string) => {
    if (!playerId) {
      return "neutral";
    }
    const index = playerIndex.get(playerId);
    return index !== undefined ? `P${index + 1}` : playerId;
  };

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
  };

  const handlePointerLeave: PointerEventHandler<SVGSVGElement> = (event) => {
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

  return (
    <svg
      ref={svgRef}
      className={svgClasses.join(" ")}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      style={enablePanZoom ? { touchAction: "none" } : undefined}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      {hexes.map((hex) => {
        const tag = showTags ? tileTag(hex.tile) : "";
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
        const isInactive =
          clickable && hasValidTargets && !isValidTarget && !isSelected && !isHighlighted;
        const occupantCount = board
          ? Object.values(board.hexes[hex.key]?.occupants ?? {}).filter(
              (unitIds) => unitIds.length > 0
            ).length
          : 0;
        const hexTitleParts = [`Hex ${hex.key}`];
        if (hex.tile && hex.tile !== "normal") {
          hexTitleParts.push(`Tile: ${hex.tile}`);
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

        return (
          <g key={hex.key}>
            <title>{hexTitle}</title>
            <polygon
              className={polygonClasses}
              points={hexPoints(hex.x, hex.y, HEX_DRAW_SIZE)}
              onClick={() => {
                if (didDragRef.current) {
                  return;
                }
                onHexClick?.(hex.key);
              }}
            />
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
                {hex.mineValue}
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

      {unitStacks.map((stack) => {
        const colorIndex = normalizeColorIndex(playerIndex.get(stack.ownerPlayerId));
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
        const tokenCenterY = -26;
        const tokenDiameter = tokenRadius * 2;
        const totalTokenWidth =
          championTokens.length * tokenDiameter +
          Math.max(0, championTokens.length - 1) * tokenGap;
        const tokenLayout = championTokens.map((token, index) => ({
          ...token,
          cx: -totalTokenWidth / 2 + tokenRadius + index * (tokenDiameter + tokenGap),
          cy: tokenCenterY
        }));
        return (
          <g
            key={stack.key}
            className="unit-stack"
            transform={`translate(${stackX} ${stackY})`}
            style={{ transition: "transform 320ms ease" }}
            onClick={() => handleStackClick(stack.hexKey)}
          >
            <circle
              className={
                colorIndex !== undefined ? `unit unit--p${colorIndex}` : "unit"
              }
              cx={0}
              cy={0}
              r={10}
            />
            {stack.forceCount > 0 ? (
              <text x={0} y={3} className="unit__count">
                {stack.forceCount}
              </text>
            ) : null}
            {tokenLayout.map((token, index) => {
              const ringClass = [
                "champion-token__ring",
                colorIndex !== undefined ? `champion-token__ring--p${colorIndex}` : "",
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
              return (
                <g
                  key={`${stack.key}-champion-${index}`}
                  onMouseEnter={handleTokenEnter}
                  onMouseLeave={() => setChampionTooltip(null)}
                >
                  <circle className={ringClass} cx={token.cx} cy={token.cy} r={tokenRadius} />
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
                </g>
              );
            })}
          </g>
        );
      })}
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
