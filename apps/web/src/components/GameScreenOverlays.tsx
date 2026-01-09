import type { Bid, CollectionChoice, GameView } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { CollectionPanel } from "./CollectionPanel";
import { MarketPanel, type MarketWinnerHighlight } from "./MarketPanel";

type GameScreenCollectionOverlayProps = {
  isActive: boolean;
  isOpen: boolean;
  showToggle: boolean;
  toggleLabel: string;
  onToggle: () => void;
  phase: GameView["public"]["phase"];
  player: GameView["public"]["players"][number] | null;
  players: GameView["public"]["players"];
  status: RoomConnectionStatus;
  handCards: NonNullable<GameView["private"]>["handCards"];
  collectionPublic: GameView["public"]["collection"];
  collectionPrivate: NonNullable<GameView["private"]>["collection"] | null;
  labelByHex: Record<string, string>;
  onSubmitChoices: (choices: CollectionChoice[]) => void;
};

export const GameScreenCollectionOverlay = ({
  isActive,
  isOpen,
  showToggle,
  toggleLabel,
  onToggle,
  phase,
  player,
  players,
  status,
  handCards,
  collectionPublic,
  collectionPrivate,
  labelByHex,
  onSubmitChoices
}: GameScreenCollectionOverlayProps) => {
  if (!isActive) {
    return null;
  }

  return (
    <>
      {isOpen ? (
        <div className="collection-overlay" role="dialog" aria-modal="true">
          <div className="collection-overlay__scrim" />
          <div className="collection-overlay__panel">
            <CollectionPanel
              phase={phase}
              player={player}
              players={players}
              status={status}
              handCards={handCards}
              collectionPublic={collectionPublic}
              collectionPrivate={collectionPrivate}
              labelByHex={labelByHex}
              onSubmitChoices={onSubmitChoices}
            />
          </div>
        </div>
      ) : null}
      {showToggle ? (
        <button
          type="button"
          className={`btn btn-primary collection-overlay__toggle${
            isOpen ? " is-active" : ""
          }`}
          data-sfx="soft"
          aria-pressed={isOpen}
          onClick={onToggle}
        >
          {toggleLabel}
        </button>
      ) : null}
    </>
  );
};

type GameScreenMarketOverlayProps = {
  isActive: boolean;
  shouldHoldOpen: boolean;
  isOpen: boolean;
  showToggle: boolean;
  toggleLabel: string;
  canToggle: boolean;
  onToggle: () => void;
  market: GameView["public"]["market"];
  players: GameView["public"]["players"];
  phase: GameView["public"]["phase"];
  player: GameView["public"]["players"][number] | null;
  status: RoomConnectionStatus;
  onSubmitBid: (bid: Bid) => void;
  onSubmitRollOff?: () => void;
  winnerHighlight: MarketWinnerHighlight | null;
  winnerHistory: Record<number, MarketWinnerHighlight>;
  rollDurationMs: number;
  onClose?: () => void;
};

export const GameScreenMarketOverlay = ({
  isActive,
  shouldHoldOpen,
  isOpen,
  showToggle,
  toggleLabel,
  canToggle,
  onToggle,
  market,
  players,
  phase,
  player,
  status,
  onSubmitBid,
  onSubmitRollOff,
  winnerHighlight,
  winnerHistory,
  rollDurationMs,
  onClose
}: GameScreenMarketOverlayProps) => {
  if (!isActive && !shouldHoldOpen) {
    return null;
  }

  return (
    <>
      {isOpen ? (
        <div className="market-overlay" role="dialog" aria-modal="true">
          <div className="market-overlay__scrim" />
          <div className="market-overlay__panel">
            <MarketPanel
              layout="overlay"
              market={market}
              players={players}
              phase={phase}
              player={player}
              status={status}
              onSubmitBid={onSubmitBid}
              onSubmitRollOff={onSubmitRollOff}
              winnerHighlight={winnerHighlight}
              winnerHistory={winnerHistory}
              rollDurationMs={rollDurationMs}
              onClose={onClose}
            />
          </div>
        </div>
      ) : null}
      {showToggle ? (
        <button
          type="button"
          className={`btn btn-primary market-overlay__toggle${
            isOpen ? " is-active" : ""
          }`}
          data-sfx="soft"
          aria-pressed={isOpen}
          onClick={onToggle}
          disabled={!canToggle}
        >
          {toggleLabel}
        </button>
      ) : null}
    </>
  );
};
