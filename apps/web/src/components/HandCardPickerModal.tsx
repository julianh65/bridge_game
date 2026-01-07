import type { CardDef, GameView } from "@bridgefront/engine";

import { GameCard } from "./GameCard";

type HandCardEntry = NonNullable<GameView["private"]>["handCards"][number];

type HandCardPickerModalProps = {
  isOpen: boolean;
  title: string;
  description?: string | null;
  cards: HandCardEntry[];
  cardDefsById: Map<string, CardDef>;
  selectedIds: string[];
  maxSelect: number;
  onSelectionChange: (nextSelection: string[]) => void;
  onClose: () => void;
};

export const HandCardPickerModal = ({
  isOpen,
  title,
  description,
  cards,
  cardDefsById,
  selectedIds,
  maxSelect,
  onSelectionChange,
  onClose
}: HandCardPickerModalProps) => {
  if (!isOpen) {
    return null;
  }

  const selectedSet = new Set(selectedIds);
  const canSelectMore = selectedIds.length < maxSelect;

  const handleToggle = (cardId: string) => {
    if (selectedSet.has(cardId)) {
      onSelectionChange(selectedIds.filter((id) => id !== cardId));
      return;
    }
    if (!canSelectMore) {
      return;
    }
    onSelectionChange([...selectedIds, cardId]);
  };

  const selectionLabel = `Selected ${selectedIds.length}/${maxSelect}`;

  return (
    <section className="hand-picker" role="dialog" aria-modal="true">
      <div className="hand-picker__scrim" onClick={onClose} />
      <div className="hand-picker__panel">
        <header className="hand-picker__header">
          <div>
            <p className="hand-picker__eyebrow">Hand picker</p>
            <h2 className="hand-picker__title">{title}</h2>
            {description ? <p className="hand-picker__subhead">{description}</p> : null}
          </div>
          <div className="hand-picker__actions">
            <button
              type="button"
              className="btn btn-tertiary"
              disabled={selectedIds.length === 0}
              onClick={() => onSelectionChange([])}
            >
              Clear
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </header>
        <div className="hand-picker__meta">{selectionLabel}</div>
        {cards.length === 0 ? (
          <p className="hand-picker__empty">No cards available.</p>
        ) : (
          <div className="hand-picker__grid">
            {cards.map((card) => {
              const def = cardDefsById.get(card.defId) ?? null;
              const name = def?.name ?? card.defId;
              const isSelected = selectedSet.has(card.id);
              const isDisabled = !isSelected && !canSelectMore;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-picker__card ${
                    isSelected ? "is-selected" : ""
                  } ${isDisabled ? "is-disabled" : ""}`}
                  disabled={isDisabled}
                  onClick={() => handleToggle(card.id)}
                  title={`${name} (${card.id})`}
                >
                  <GameCard
                    card={def}
                    cardId={card.defId}
                    displayName={name}
                    showId={false}
                    showTags={false}
                    showRules={true}
                    showArt={true}
                    showStats={true}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
