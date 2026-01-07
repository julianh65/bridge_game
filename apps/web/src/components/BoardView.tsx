import { useMemo, useRef, useState, useEffect } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  WheelEventHandler
} from "react";

import { CARD_DEFS_BY_ID, type BoardState } from "@bridgefront/engine";
import { parseEdgeKey } from "@bridgefront/shared";

import { HEX_SIZE, hexPoints } from "../lib/hex-geometry";
import type { HexRender } from "../lib/board-preview";
import { getFactionName } from "../lib/factions";

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

const HEX_DRAW_SCALE = 0.94;
const HEX_DRAW_SIZE = HEX_SIZE * HEX_DRAW_SCALE;
const BRIDGE_INSET = HEX_DRAW_SIZE * 0.35;

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

const truncateChampionName = (name: string) => {
  const maxLength = 9;
  if (name.length <= maxLength) {
    return name;
  }
  return `${name.slice(0, maxLength - 3)}...`;
};

const estimateBadgeWidth = (label: string) => Math.max(28, label.length * 6 + 12);
const getFactionBadge = (factionId?: string | null): string | null => {
  if (!factionId || factionId === "unassigned") {
    return null;
  }
  const name = getFactionName(factionId);
  if (!name) {
    return null;
  }
  return name.slice(0, 1).toUpperCase();
};

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
  const marginX = viewBox.width * 0.15;
  const marginY = viewBox.height * 0.15;
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
  playerFactionById,
  showCoords = true,
  showTags = true,
  showMineValues = true,
  labelByHex,
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
      ownerPlayerId?: string;
    }> = [];
    for (const bridge of Object.values(board.bridges)) {
      const from = hexCenters.get(bridge.from);
      const to = hexCenters.get(bridge.to);
      if (!from || !to) {
        continue;
      }
      const shortened = shortenSegment(from, to, BRIDGE_INSET);
      segments.push({
        key: bridge.key,
        from: shortened.from,
        to: shortened.to,
        ownerPlayerId: bridge.ownerPlayerId
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
      championDetails: Array<{
        id: string;
        cardDefId: string;
        name: string;
        hp: number;
        maxHp: number;
      }>;
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
        const championDetails: Array<{
          id: string;
          cardDefId: string;
          hp: number;
          maxHp: number;
        }> = [];
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
              maxHp: unit.maxHp
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
    for (const bridge of bridgeSegments) {
      if (bridge.ownerPlayerId) {
        ids.add(bridge.ownerPlayerId);
      }
    }
    const sorted = Array.from(ids).sort();
    return new Map(sorted.map((id, index) => [id, index]));
  }, [unitStacks, bridgeSegments]);

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
              <text x={hex.x} y={coordsY} className="hex__slot">
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
        const colorIndex = normalizeColorIndex(
          bridge.ownerPlayerId ? playerIndex.get(bridge.ownerPlayerId) : undefined
        );
        const className =
          colorIndex !== undefined ? `bridge bridge--p${colorIndex}` : "bridge";
        const bridgeTitle = bridge.ownerPlayerId
          ? `Bridge ${bridge.key}\nOwner: ${playerLabel(bridge.ownerPlayerId)}`
          : `Bridge ${bridge.key}`;
        return (
          <g key={bridge.key}>
            <title>{bridgeTitle}</title>
            <line
              className={className}
              x1={bridge.from.x}
              y1={bridge.from.y}
              x2={bridge.to.x}
              y2={bridge.to.y}
            />
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
        const championBadges = (() => {
          if (stack.championDetails.length === 0) {
            return [];
          }
          const maxBadges = 2;
          const badges = stack.championDetails.slice(0, maxBadges).map((champion) => {
            const shortName = truncateChampionName(champion.name);
            return {
              label: `${shortName} ${champion.hp}/${champion.maxHp}`,
              title: `${champion.name} ${champion.hp}/${champion.maxHp}`,
              isExtra: false
            };
          });
          const extraCount = stack.championDetails.length - maxBadges;
          if (extraCount > 0) {
            badges.push({
              label: `+${extraCount}`,
              title: `${extraCount} more champion${extraCount === 1 ? "" : "s"}`,
              isExtra: true
            });
          }
          return badges;
        })();
        const badgeHeight = 12;
        const badgeGap = 4;
        const badgeY = -28;
        const badgeWidths = championBadges.map((badge) => estimateBadgeWidth(badge.label));
        const totalBadgeWidth =
          badgeWidths.reduce((sum, width) => sum + width, 0) +
          Math.max(0, badgeWidths.length - 1) * badgeGap;
        const badgeLayout = (() => {
          if (championBadges.length === 0) {
            return [];
          }
          const layout: Array<{
            label: string;
            title: string;
            isExtra: boolean;
            width: number;
            x: number;
          }> = [];
          let cursorX = -totalBadgeWidth / 2;
          championBadges.forEach((badge, index) => {
            const width = badgeWidths[index] ?? estimateBadgeWidth(badge.label);
            layout.push({
              label: badge.label,
              title: badge.title,
              isExtra: badge.isExtra,
              width,
              x: cursorX
            });
            cursorX += width + badgeGap;
          });
          return layout;
        })();
        const stackTitleLines = [
          `Stack ${playerLabel(stack.ownerPlayerId)}`,
          `Forces: ${stack.forceCount}`,
          `Champions: ${stack.championCount}`
        ];
        const factionId = playerFactionById?.[stack.ownerPlayerId];
        if (factionId && factionId !== "unassigned") {
          stackTitleLines.splice(1, 0, `Faction: ${getFactionName(factionId)}`);
        }
        if (stack.championDetails.length > 0) {
          stackTitleLines.push("Champion HP:");
          for (const champion of stack.championDetails) {
            stackTitleLines.push(
              `- ${champion.name} ${champion.hp}/${champion.maxHp}`
            );
          }
        }
        const stackTitle = stackTitleLines.join("\n");
        const championLabel = "C";
        const crestSize = 8;
        const crestX = 10;
        const crestY = -10;
        const factionBadge = getFactionBadge(factionId);
        const factionBadgeWidth = 14;
        const factionBadgeHeight = 10;
        const factionBadgeX = -factionBadgeWidth / 2;
        const factionBadgeY = 12;
        return (
          <g
            key={stack.key}
            className="unit-stack"
            transform={`translate(${stackX} ${stackY})`}
            style={{ transition: "transform 320ms ease" }}
            onClick={() => handleStackClick(stack.hexKey)}
          >
            <title>{stackTitle}</title>
            {stack.championCount > 0 ? (
              <circle
                className="unit__champion-halo"
                cx={0}
                cy={0}
                r={13}
              />
            ) : null}
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
            ) : stack.championCount > 0 ? (
              <text x={0} y={3} className="unit__champion">
                {championLabel}
              </text>
            ) : null}
            {stack.championCount > 0 ? (
              <g className="unit__champion-crest">
                <rect
                  className="unit__champion-crest-shape"
                  x={crestX - crestSize / 2}
                  y={crestY - crestSize / 2}
                  width={crestSize}
                  height={crestSize}
                  rx={2}
                  ry={2}
                  transform={`rotate(45 ${crestX} ${crestY})`}
                />
                <text
                  className="unit__champion-crest-text"
                  x={crestX}
                  y={crestY + 1}
                >
                  {championLabel}
                </text>
              </g>
            ) : null}
            {factionBadge ? (
              <g className="unit__faction-badge">
                <rect
                  className="unit__faction-badge-shape"
                  x={factionBadgeX}
                  y={factionBadgeY}
                  width={factionBadgeWidth}
                  height={factionBadgeHeight}
                  rx={4}
                  ry={4}
                />
                <text
                  className={`unit__faction-badge-text${
                    colorIndex !== undefined ? ` unit__faction-badge-text--p${colorIndex}` : ""
                  }`}
                  x={0}
                  y={factionBadgeY + factionBadgeHeight / 2}
                >
                  {factionBadge}
                </text>
              </g>
            ) : null}
            {badgeLayout.map((badge, index) => {
              const badgeClass = [
                "champion-badge",
                colorIndex !== undefined ? `champion-badge--p${colorIndex}` : "",
                badge.isExtra ? "champion-badge--extra" : ""
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <g
                  key={`${stack.key}-badge-${index}`}
                  className="champion-badge__wrap"
                >
                  <title>{badge.title}</title>
                  <rect
                    className={badgeClass}
                    x={badge.x}
                    y={badgeY}
                    width={badge.width}
                    height={badgeHeight}
                    rx={badgeHeight / 2}
                    ry={badgeHeight / 2}
                  />
                  <text
                    className="champion-badge__text"
                    x={badge.x + badge.width / 2}
                    y={badgeY + badgeHeight / 2}
                  >
                    {badge.label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
