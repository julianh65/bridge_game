import type { CSSProperties, ReactNode } from "react";

import {
  CARD_DEFS,
  type ActionDeclaration,
  type CardDef,
  type GameView
} from "@bridgefront/engine";

import { ActionPanel, type BasicActionIntent, type BoardPickMode } from "./ActionPanel";
import { GameCard } from "./GameCard";
import type { RoomConnectionStatus } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type GameScreenHandPanelProps = {
  canShowHandPanel: boolean;
  isHandPanelOpen: boolean;
  onShowHandPanel: () => void;
  onHideHandPanel: () => void;
  handCards: NonNullable<GameView["private"]>["handCards"];
  deckCounts: NonNullable<GameView["private"]>["deckCounts"] | null;
  availableMana: number;
  availableGold: number;
  canDeclareAction: boolean;
  selectedCardId: string;
  selectedCardDef: CardDef | null;
  cardTargetPanel: ReactNode;
  phase: GameView["public"]["phase"];
  player: GameView["public"]["players"][number] | null;
  status: RoomConnectionStatus;
  edgeKey: string;
  marchFrom: string;
  marchTo: string;
  reinforceHex: string;
  reinforceOptions: { key: string; label: string }[];
  boardPickMode: BoardPickMode;
  basicActionIntent: BasicActionIntent;
  onBasicActionIntentChange: (intent: BasicActionIntent) => void;
  onEdgeKeyChange: (edgeKey: string) => void;
  onMarchFromChange: (hexKey: string) => void;
  onMarchToChange: (hexKey: string) => void;
  onReinforceHexChange: (hexKey: string) => void;
  onBoardPickModeChange: (mode: BoardPickMode) => void;
  onSelectCard: (cardId: string) => void;
  onSubmitAction: (declaration: ActionDeclaration) => void;
  primaryAction: ActionDeclaration | null;
  primaryActionLabel: string;
  canSubmitDone: boolean;
};

export const GameScreenHandPanel = ({
  canShowHandPanel,
  isHandPanelOpen,
  onShowHandPanel,
  onHideHandPanel,
  handCards,
  deckCounts,
  availableMana,
  availableGold,
  canDeclareAction,
  selectedCardId,
  selectedCardDef,
  cardTargetPanel,
  phase,
  player,
  status,
  edgeKey,
  marchFrom,
  marchTo,
  reinforceHex,
  reinforceOptions,
  boardPickMode,
  basicActionIntent,
  onBasicActionIntentChange,
  onEdgeKeyChange,
  onMarchFromChange,
  onMarchToChange,
  onReinforceHexChange,
  onBoardPickModeChange,
  onSelectCard,
  onSubmitAction,
  primaryAction,
  primaryActionLabel,
  canSubmitDone
}: GameScreenHandPanelProps) => {
  const showHandPanel = canShowHandPanel && isHandPanelOpen;
  const handCount = handCards.length;

  return (
    <>
      {showHandPanel ? (
        <section className="panel game-hand">
          <div className="game-hand__header">
            <div>
              <h2>Hand</h2>
              <span className="hand-meta">{handCount} cards</span>
            </div>
            <div className="hand-controls">
              <button type="button" className="btn btn-tertiary" onClick={onHideHandPanel}>
                Hide
              </button>
            </div>
          </div>
          <div className="game-hand__layout">
            <div className="game-hand__cards">
              {handCount === 0 ? (
                <div className="hand-empty">No cards yet.</div>
              ) : (
                <>
                  <div className="hand-row">
                    {handCards.map((card, index) => {
                      const def = CARD_DEFS_BY_ID.get(card.defId);
                      const label = def?.name ?? card.defId;
                      const isSelected = card.id === selectedCardId;
                      const manaCost = def?.cost.mana ?? 0;
                      const goldCost = def?.cost.gold ?? 0;
                      const canAfford = availableMana >= manaCost && availableGold >= goldCost;
                      const isPlayable = canDeclareAction && canAfford;
                      const totalCards = handCards.length;
                      const centerIndex = (totalCards - 1) / 2;
                      const offset = index - centerIndex;
                      const fanRotation = totalCards > 1 ? offset * 4 : 0;
                      const fanLift = Math.abs(offset) * 4;
                      const depth = totalCards - Math.abs(offset);
                      const handStyle = {
                        zIndex: 10 + depth,
                        "--hand-rotate": `${fanRotation}deg`,
                        "--hand-lift": `${fanLift}px`
                      } as CSSProperties;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          className={`hand-card ${isSelected ? "is-selected" : ""} ${
                            isPlayable ? "" : "is-disabled"
                          }`}
                          style={handStyle}
                          aria-pressed={isSelected}
                          aria-disabled={!isPlayable}
                          title={`${label} (${card.id})`}
                          onClick={() => onSelectCard(card.id)}
                        >
                          <GameCard
                            as="div"
                            variant="hand"
                            card={def ?? null}
                            cardId={card.id}
                            displayName={label}
                            eyebrow={null}
                            showId={false}
                            showTags={false}
                            rulesFallback="Unknown card data."
                          />
                        </button>
                      );
                    })}
                  </div>
                  {selectedCardDef ? (
                    <div className="card-detail card-detail--targets">
                      <div className="card-detail__header">
                        <strong>{selectedCardDef.name}</strong>
                        <span className="card-detail__meta">Targets</span>
                      </div>
                      {cardTargetPanel}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <aside className="game-hand__actions">
              <div className="game-hand__actions-header">
                <h3>Actions</h3>
                <span className="hand-meta">Basic actions</span>
              </div>
              <ActionPanel
                phase={phase}
                player={player}
                status={status}
                edgeKey={edgeKey}
                marchFrom={marchFrom}
                marchTo={marchTo}
                reinforceHex={reinforceHex}
                reinforceOptions={reinforceOptions}
                boardPickMode={boardPickMode}
                basicActionIntent={basicActionIntent}
                onBasicActionIntentChange={onBasicActionIntentChange}
                onEdgeKeyChange={onEdgeKeyChange}
                onMarchFromChange={onMarchFromChange}
                onMarchToChange={onMarchToChange}
                onReinforceHexChange={onReinforceHexChange}
                onBoardPickModeChange={onBoardPickModeChange}
              />
            </aside>
          </div>
          <div className="game-hand__footer">
            {deckCounts ? (
              <div className="deck-counts deck-counts--compact">
                <div className="resource-row">
                  <span>Draw</span>
                  <strong>{deckCounts.drawPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Discard</span>
                  <strong>{deckCounts.discardPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Scrapped</span>
                  <strong>{deckCounts.scrapped}</strong>
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="hand-submit">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!canSubmitDone}
                onClick={() => onSubmitAction({ kind: "done" })}
              >
                Pass
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!primaryAction}
                title={
                  primaryAction
                    ? `Lock in action: ${primaryActionLabel}`
                    : "Select an action to submit"
                }
                onClick={() => {
                  if (!primaryAction) {
                    return;
                  }
                  onSubmitAction(primaryAction);
                }}
              >
                {primaryAction ? primaryActionLabel : "Submit"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {canShowHandPanel && !isHandPanelOpen ? (
        <div className="hand-toggle">
          <button type="button" className="btn btn-primary" onClick={onShowHandPanel}>
            Show Hand
          </button>
        </div>
      ) : null}
    </>
  );
};
