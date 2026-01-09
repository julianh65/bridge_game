import type { ReactNode } from "react";

import type { GameView } from "@bridgefront/engine";

import { type HexRender } from "../lib/board-preview";
import { BoardView, type BoardActionAnimation } from "./BoardView";
import { GameScreenBoardLegend } from "./GameScreenBoardLegend";

type GameScreenBoardSectionProps = {
  hexes: HexRender[];
  board: GameView["public"]["board"];
  modifiers: GameView["public"]["modifiers"];
  playerIndexById: Record<string, number>;
  playerFactionById: Record<string, string>;
  capitalOwnerByHex: Record<string, string>;
  homeCapitalHexKey: string | null;
  labelByHex: Record<string, string>;
  selectedHexKey: string | null;
  highlightHexKeys: string[];
  validHexKeys: string[];
  previewEdgeKeys: string[];
  previewHexPair?: { from: string; to: string } | null;
  isTargeting: boolean;
  onHexClick?: (hexKey: string) => void;
  onEdgeClick: (edgeKey: string) => void;
  actionAnimations: BoardActionAnimation[];
  actionAnimationDurationMs: number;
  actionAnimationHold?: boolean;
  forceSplitPanel: ReactNode;
};

export const GameScreenBoardSection = ({
  hexes,
  board,
  modifiers,
  playerIndexById,
  playerFactionById,
  capitalOwnerByHex,
  homeCapitalHexKey,
  labelByHex,
  selectedHexKey,
  highlightHexKeys,
  validHexKeys,
  previewEdgeKeys,
  previewHexPair,
  isTargeting,
  onHexClick,
  onEdgeClick,
  actionAnimations,
  actionAnimationDurationMs,
  actionAnimationHold = false,
  forceSplitPanel
}: GameScreenBoardSectionProps) => {
  return (
    <section className="panel game-board">
      <div className="game-board__placeholder">
        <div className="game-board__viewport">
          <BoardView
            hexes={hexes}
            board={board}
            modifiers={modifiers}
            playerIndexById={playerIndexById}
            playerFactionById={playerFactionById}
            capitalOwnerByHex={capitalOwnerByHex}
            homeCapitalHexKey={homeCapitalHexKey}
            showCoords={false}
            showMineValues
            labelByHex={labelByHex}
            labelVariant="coords"
            className="board-svg board-svg--game"
            enablePanZoom
            selectedHexKey={selectedHexKey}
            highlightHexKeys={highlightHexKeys}
            validHexKeys={validHexKeys}
            previewEdgeKeys={previewEdgeKeys}
            previewHexPair={previewHexPair}
            isTargeting={isTargeting}
            onHexClick={onHexClick}
            onEdgeClick={onEdgeClick}
            showTags={false}
            actionAnimations={actionAnimations}
            actionAnimationDurationMs={actionAnimationDurationMs}
            actionAnimationHold={actionAnimationHold}
          />
          {forceSplitPanel ? (
            <div className="board-tools board-tools--overlay board-tools--split">
              {forceSplitPanel}
            </div>
          ) : null}
        </div>
        <GameScreenBoardLegend />
      </div>
    </section>
  );
};
