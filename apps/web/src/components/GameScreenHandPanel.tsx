import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import {
  CARD_DEFS,
  type ActionDeclaration,
  type CardDef,
  type GameView
} from "@bridgefront/engine";

import { ActionPanel, type BasicActionIntent, type BoardPickMode } from "./ActionPanel";
import { GameCard } from "./GameCard";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return target.isContentEditable;
};

const getCardTargetHint = (cardDef: CardDef | null): string | null => {
  if (!cardDef) {
    return null;
  }
  const mortarEffect = cardDef.effects?.find((effect) => effect.kind === "mortarShot") as
    | { maxDistance?: number }
    | undefined;
  if (mortarEffect) {
    const maxDistance =
      typeof mortarEffect.maxDistance === "number" ? mortarEffect.maxDistance : 2;
    return `Pick a hex within ${maxDistance} of your forces. Impact may scatter to adjacent hexes.`;
  }
  switch (cardDef.targetSpec.kind) {
    case "edge":
      return "Pick an edge on the board.";
    case "multiEdge":
      return "Pick multiple edges on the board.";
    case "stack":
      return "Pick a stack, then a destination.";
    case "path":
      return "Pick a path on the board.";
    case "hex":
      return "Pick a hex on the board.";
    case "choice":
      return "Pick a capital or occupied hex.";
    case "champion":
      return "Click a hex with an eligible champion.";
    case "none":
      return "No targets required.";
    default:
      return null;
  }
};

type DeckPulseKey = "draw" | "discard" | "scrapped" | "burned";

type GameScreenHandPanelProps = {
  canShowHandPanel: boolean;
  isHandPanelOpen: boolean;
  onShowHandPanel: () => void;
  onHideHandPanel: () => void;
  handCards: NonNullable<GameView["private"]>["handCards"];
  deckCounts: NonNullable<GameView["private"]>["deckCounts"] | null;
  availableMana: number;
  maxMana: number;
  availableGold: number;
  vpTotal: number | null;
  canDeclareAction: boolean;
  canSubmitAction: boolean;
  actionHint: string | null;
  selectedCardId: string;
  handTargets: ReactNode | null;
  player: GameView["public"]["players"][number] | null;
  edgeKey: string;
  marchFrom: string;
  marchTo: string;
  marchForceMax: number;
  reinforceHex: string;
  reinforceOptions: { key: string; label: string }[];
  boardPickMode: BoardPickMode;
  basicActionIntent: BasicActionIntent;
  onBasicActionIntentChange: (intent: BasicActionIntent) => void;
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
  maxMana,
  availableGold,
  vpTotal,
  canDeclareAction,
  canSubmitAction,
  actionHint,
  selectedCardId,
  handTargets,
  player,
  edgeKey,
  marchFrom,
  marchTo,
  marchForceMax,
  reinforceHex,
  reinforceOptions,
  boardPickMode,
  basicActionIntent,
  onBasicActionIntentChange,
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
  const selectedCard = handCards.find((card) => card.id === selectedCardId) ?? null;
  const selectedCardDef = selectedCard ? CARD_DEFS_BY_ID.get(selectedCard.defId) ?? null : null;
  const selectedLabel = selectedCardDef?.name ?? selectedCard?.defId ?? null;
  const selectedTargetHint = getCardTargetHint(selectedCardDef);
  const [isPassConfirming, setIsPassConfirming] = useState(false);
  const shouldConfirmPass = availableMana > 0;
  const manaLabel = `${availableMana}/${maxMana}`;
  const [deckPulse, setDeckPulse] = useState({ draw: 0, discard: 0, scrapped: 0, burned: 0 });
  const [deckDelta, setDeckDelta] = useState({ draw: 0, discard: 0, scrapped: 0, burned: 0 });
  const deckPrevRef = useRef<NonNullable<GameView["private"]>["deckCounts"] | null>(null);
  const deckTimersRef = useRef<Partial<Record<DeckPulseKey, number>>>({});

  useEffect(() => {
    if (!canSubmitDone || !shouldConfirmPass) {
      setIsPassConfirming(false);
    }
  }, [canSubmitDone, shouldConfirmPass]);

  useEffect(() => {
    if (primaryAction) {
      setIsPassConfirming(false);
    }
  }, [primaryAction]);

  useEffect(() => {
    if (!showHandPanel) {
      setIsPassConfirming(false);
    }
  }, [showHandPanel]);

  useEffect(() => {
    if (!deckCounts) {
      deckPrevRef.current = null;
      return;
    }
    const previous = deckPrevRef.current;
    deckPrevRef.current = deckCounts;
    if (!previous) {
      return;
    }
    const deltas = {
      draw: deckCounts.drawPile - previous.drawPile,
      discard: deckCounts.discardPile - previous.discardPile,
      scrapped: deckCounts.scrapped - previous.scrapped,
      burned: deckCounts.burned - previous.burned
    };
    (Object.keys(deltas) as DeckPulseKey[]).forEach((key) => {
      const delta = deltas[key];
      if (delta === 0) {
        return;
      }
      setDeckDelta((current) => ({ ...current, [key]: delta }));
      setDeckPulse((current) => ({ ...current, [key]: current[key] + 1 }));
      const existingTimer = deckTimersRef.current[key];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      deckTimersRef.current[key] = window.setTimeout(() => {
        setDeckDelta((current) => ({ ...current, [key]: 0 }));
      }, 900);
    });
  }, [deckCounts]);

  useEffect(() => {
    return () => {
      Object.values(deckTimersRef.current).forEach((timer) => {
        if (timer) {
          window.clearTimeout(timer);
        }
      });
    };
  }, []);

  const handlePassClick = () => {
    if (!canSubmitDone) {
      return;
    }
    if (shouldConfirmPass && !isPassConfirming) {
      setIsPassConfirming(true);
      return;
    }
    setIsPassConfirming(false);
    onSubmitAction({ kind: "done" });
  };

  useEffect(() => {
    if (!showHandPanel) {
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
      if (event.key === "Enter" || event.key === "NumpadEnter") {
        if (!primaryAction) {
          return;
        }
        event.preventDefault();
        setIsPassConfirming(false);
        onSubmitAction(primaryAction);
        return;
      }
      if (event.key.toLowerCase() === "p") {
        if (!canSubmitDone) {
          return;
        }
        event.preventDefault();
        handlePassClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHandPanel, primaryAction, canSubmitDone, handlePassClick, onSubmitAction]);

  const deckPills = deckCounts
    ? [
        {
          id: "draw" as const,
          label: "Draw pile",
          count: deckCounts.drawPile,
          delta: deckDelta.draw,
          pulseKey: deckPulse.draw
        },
        {
          id: "discard" as const,
          label: "Discard",
          count: deckCounts.discardPile,
          delta: deckDelta.discard,
          pulseKey: deckPulse.discard
        },
        {
          id: "scrapped" as const,
          label: "Scrapped",
          count: deckCounts.scrapped,
          delta: deckDelta.scrapped,
          pulseKey: deckPulse.scrapped
        },
        {
          id: "burned" as const,
          label: "Burned",
          count: deckCounts.burned,
          delta: deckDelta.burned,
          pulseKey: deckPulse.burned
        }
      ]
    : [];

  return (
    <>
      {showHandPanel ? (
        <section className="panel game-hand">
          <div className="game-hand__header">
            <div className="game-hand__title">
              <div className="hand-title">
                <h2>Hand</h2>
                <div className="hand-resources" aria-label="Hand resources">
                  <span className="hand-resource hand-resource--gold">
                    <span aria-hidden="true">🟡</span>
                    {availableGold}
                  </span>
                  {vpTotal !== null ? (
                    <span className="hand-resource hand-resource--vp">
                      <span aria-hidden="true">🟢</span>
                      {vpTotal}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="hand-meta">{handCount} cards</span>
            </div>
            <div className="hand-controls">
              {deckCounts ? (
                <div className="deck-pills" aria-label="Deck counts">
                  {deckPills.map((pill) => (
                    <span
                      key={`${pill.id}-${pill.pulseKey}`}
                      className={`deck-pill deck-pill--${pill.id} ${
                        pill.delta !== 0 ? "is-pulsing" : ""
                      }`}
                      aria-label={`${pill.label} ${pill.count}`}
                    >
                      <span className="deck-pill__label">{pill.label}</span>
                      <strong>{pill.count}</strong>
                      {pill.delta !== 0 ? (
                        <span
                          className={`deck-pill__delta ${
                            pill.delta > 0 ? "is-positive" : "is-negative"
                          }`}
                        >
                          {pill.delta > 0 ? `+${pill.delta}` : pill.delta}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
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
                      const hasMana = availableMana >= manaCost;
                      const hasGold = availableGold >= goldCost;
                      const canAfford = hasMana && hasGold;
                      const showManaWarning = canDeclareAction && manaCost > 0 && !hasMana;
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
                          } ${showManaWarning ? "is-mana-short" : ""}`}
                          style={handStyle}
                          aria-pressed={isSelected}
                          aria-disabled={!isPlayable}
                          title={`${label} (${card.id})`}
                          onClick={() => onSelectCard(card.id)}
                        >
                          {showManaWarning ? (
                            <span className="hand-card__mana-warning" aria-hidden="true">
                              Need Mana
                            </span>
                          ) : null}
                          <GameCard
                            as="div"
                            variant="hand"
                            card={def ?? null}
                            cardId={card.defId}
                            displayName={label}
                            eyebrow={null}
                            showId={false}
                            showTags={false}
                            showChampionStats
                            rulesFallback="Unknown card data."
                          />
                        </button>
                      );
                    })}
                  </div>
                  {handTargets ? <div className="game-hand__targets">{handTargets}</div> : null}
                </>
              )}
            </div>
            <aside className="game-hand__actions">
              <div className="game-hand__actions-header">
                <h3>Actions</h3>
                <span className="hand-meta">Basic actions</span>
              </div>
              <div className="game-hand__mana">
                <div className="mana-orb" aria-label={`Mana ${manaLabel}`}>
                  <span className="mana-orb__label">Mana</span>
                  <strong className="mana-orb__value">{manaLabel}</strong>
                </div>
              </div>
              {selectedCard && selectedLabel ? (
                <div className="hand-selection">
                  <div className="hand-selection__main">
                    <span className="hand-selection__eyebrow">Selected card</span>
                    <strong className="hand-selection__name">{selectedLabel}</strong>
                    {selectedTargetHint ? (
                      <span className="hand-selection__hint">{selectedTargetHint}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => onSelectCard(selectedCard.id)}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              {actionHint ? <p className="action-panel__hint">{actionHint}</p> : null}
              <ActionPanel
                player={player}
                canSubmitAction={canSubmitAction}
                edgeKey={edgeKey}
                marchFrom={marchFrom}
                marchTo={marchTo}
                marchForceMax={marchForceMax}
                reinforceHex={reinforceHex}
                reinforceOptions={reinforceOptions}
                boardPickMode={boardPickMode}
                basicActionIntent={basicActionIntent}
                onBasicActionIntentChange={onBasicActionIntentChange}
                onReinforceHexChange={onReinforceHexChange}
                onBoardPickModeChange={onBoardPickModeChange}
              />
            </aside>
          </div>
          <div className="game-hand__footer">
            <div className="hand-submit">
              <button
                type="button"
                className={`btn btn-secondary hand-pass ${isPassConfirming ? "is-armed" : ""}`}
                disabled={!canSubmitDone}
                title={
                  isPassConfirming
                    ? "You still have mana. Click again to pass."
                    : "Pass and end your actions for this step."
                }
                onClick={handlePassClick}
              >
                {isPassConfirming ? "Confirm Pass" : "Pass"}
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
                  setIsPassConfirming(false);
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
