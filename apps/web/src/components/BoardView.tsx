import { useMemo } from "react";

import { HEX_SIZE, hexPoints } from "../lib/hex-geometry";
import type { HexRender } from "../lib/board-preview";

type BoardViewProps = {
  hexes: HexRender[];
  showCoords?: boolean;
  showTags?: boolean;
  showMineValues?: boolean;
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
  showCoords = true,
  showTags = true,
  showMineValues = true,
  className
}: BoardViewProps) => {
  const viewBox = useMemo(() => boundsForHexes(hexes), [hexes]);

  return (
    <svg
      className={className ?? "board-svg"}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
    >
      {hexes.map((hex) => {
        const tag = showTags ? tileTag(hex.tile) : "";
        const coordsY = tag ? hex.y + 8 : hex.y;
        const valueY = tag ? hex.y + (showCoords ? 20 : 12) : hex.y + 12;

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
            {showCoords ? (
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
    </svg>
  );
};
