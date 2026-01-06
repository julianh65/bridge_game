import { useMemo, useRef, useState, useEffect } from "react";
import type { PointerEventHandler, WheelEventHandler } from "react";

import type { BoardState } from "@bridgefront/engine";
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
  previewEdgeKeys = []
}: BoardViewProps) => {
  const baseViewBox = useMemo(() => boundsForHexes(hexes), [hexes]);
  const [viewBox, setViewBox] = useState(baseViewBox);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
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
    setViewBox(baseViewBox);
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
      segments.push({
        key: bridge.key,
        from,
        to,
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
      segments.push({
        key: edgeKey,
        from,
        to
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
      x: number;
      y: number;
      ownerPlayerId: string;
      forceCount: number;
      championCount: number;
      championDetails: Array<{
        id: string;
        cardDefId: string;
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
            championDetails.push({
              id: unit.id,
              cardDefId: unit.cardDefId,
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

  const playerIndex = useMemo(() => {
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

  const handlePointerDown: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    const point = toSvgPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
    const pinchData = getPinchData();
    if (pinchData) {
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
        didDragRef.current = true;
        setIsPanning(true);
        return;
      }
      const scale =
        pinchData.distance > 0 ? pinchRef.current.distance / pinchData.distance : 1;
      pinchRef.current = pinchData;
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
    event.currentTarget.releasePointerCapture(event.pointerId);
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    dragStartRef.current = null;
    setIsPanning(false);
  };

  const handlePointerCancel: PointerEventHandler<SVGSVGElement> = (event) => {
    if (!enablePanZoom) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    dragStartRef.current = null;
    setIsPanning(false);
  };

  const handlePointerLeave = () => {
    dragRef.current = null;
    dragStartRef.current = null;
    activePointersRef.current.clear();
    pinchRef.current = null;
    setIsPanning(false);
  };

  const clickable = Boolean(onHexClick);
  const edgeClickable = Boolean(onEdgeClick);
  const svgClasses = [className ?? "board-svg"];
  if (enablePanZoom || clickable) {
    svgClasses.push("board-svg--interactive");
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
              points={hexPoints(hex.x, hex.y, HEX_SIZE)}
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
        const index = bridge.ownerPlayerId
          ? playerIndex.get(bridge.ownerPlayerId)
          : undefined;
        const className = index !== undefined ? `bridge bridge--p${index}` : "bridge";
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
        const index = playerIndex.get(stack.ownerPlayerId) ?? 0;
        const offsets =
          stack.occupantCount > 1
            ? [
                { dx: -12, dy: 12 },
                { dx: 12, dy: 12 }
              ]
            : [{ dx: 0, dy: 12 }];
        const offset = offsets[stack.offsetIndex % offsets.length] ?? offsets[0];
        const cx = stack.x + offset.dx;
        const cy = stack.y + offset.dy;
        const stackTitleLines = [
          `Stack ${playerLabel(stack.ownerPlayerId)}`,
          `Forces: ${stack.forceCount}`,
          `Champions: ${stack.championCount}`
        ];
        if (stack.championDetails.length > 0) {
          stackTitleLines.push("Champion HP:");
          for (const champion of stack.championDetails) {
            stackTitleLines.push(
              `- ${champion.cardDefId} ${champion.hp}/${champion.maxHp}`
            );
          }
        }
        const stackTitle = stackTitleLines.join("\n");
        return (
          <g key={stack.key} className="unit-stack">
            <title>{stackTitle}</title>
            <circle className={`unit unit--p${index}`} cx={cx} cy={cy} r={10} />
            {stack.forceCount > 0 ? (
              <text x={cx} y={cy + 3} className="unit__count">
                {stack.forceCount}
              </text>
            ) : null}
            {stack.championCount > 0 ? (
              <text x={cx} y={cy - 10} className="unit__champion">
                C{stack.championCount}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};
