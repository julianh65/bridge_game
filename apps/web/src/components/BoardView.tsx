import { useMemo } from "react";

import type { BoardState } from "@bridgefront/engine";

import { HEX_SIZE, hexPoints } from "../lib/hex-geometry";
import type { HexRender } from "../lib/board-preview";

type BoardViewProps = {
  hexes: HexRender[];
  board?: BoardState;
  showCoords?: boolean;
  showTags?: boolean;
  showMineValues?: boolean;
  labelByHex?: Record<string, string>;
  className?: string;
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

const boundsForHexes = (hexes: HexRender[]) => {
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

export const BoardView = ({
  hexes,
  board,
  showCoords = true,
  showTags = true,
  showMineValues = true,
  labelByHex,
  className
}: BoardViewProps) => {
  const viewBox = useMemo(() => boundsForHexes(hexes), [hexes]);
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
        for (const unitId of unitIds) {
          const unit = board.units[unitId];
          if (!unit) {
            continue;
          }
          if (unit.kind === "force") {
            forceCount += 1;
          } else {
            championCount += 1;
          }
        }
        if (forceCount + championCount === 0) {
          return;
        }
        stacks.push({
          key: `${hex.key}:${playerId}`,
          x: center.x,
          y: center.y,
          ownerPlayerId: playerId,
          forceCount,
          championCount,
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

  return (
    <svg
      className={className ?? "board-svg"}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
    >
      {hexes.map((hex) => {
        const tag = showTags ? tileTag(hex.tile) : "";
        const labelText = labelByHex?.[hex.key];
        const showCoordsText = showCoords && !labelText;
        const coordsY = tag ? hex.y + 8 : hex.y;
        const hasLowerText = showCoordsText || Boolean(labelText);
        const valueY = tag ? hex.y + (hasLowerText ? 20 : 12) : hex.y + 12;

        return (
          <g key={hex.key}>
            <polygon
              className={`hex hex--${hex.tile}`}
              points={hexPoints(hex.x, hex.y, HEX_SIZE)}
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

      {bridgeSegments.map((bridge) => {
        const index = bridge.ownerPlayerId
          ? playerIndex.get(bridge.ownerPlayerId)
          : undefined;
        const className = index !== undefined ? `bridge bridge--p${index}` : "bridge";
        return (
          <line
            key={bridge.key}
            className={className}
            x1={bridge.from.x}
            y1={bridge.from.y}
            x2={bridge.to.x}
            y2={bridge.to.y}
          />
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
        return (
          <g key={stack.key} className="unit-stack">
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
