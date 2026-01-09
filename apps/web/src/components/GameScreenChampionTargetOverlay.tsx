type ChampionTargetOverlayOption = {
  id: string;
  name: string;
  ownerName: string;
  hex: string;
  hexLabel: string;
  hp: number;
  maxHp: number;
};

type GameScreenChampionTargetOverlayProps = {
  isOpen: boolean;
  scopeLabel: string | null;
  options: ChampionTargetOverlayOption[];
  selectedChampionId: string | null;
  selectedLabel: string | null;
  selectedHexLabel: string | null;
  onSelect: (option: ChampionTargetOverlayOption) => void;
};

export const GameScreenChampionTargetOverlay = ({
  isOpen,
  scopeLabel,
  options,
  selectedChampionId,
  selectedLabel,
  selectedHexLabel,
  onSelect
}: GameScreenChampionTargetOverlayProps) => {
  if (!isOpen) {
    return null;
  }

  const targetLabel = scopeLabel ?? "Champion";
  const selectedSummary = selectedLabel
    ? `Selected: ${selectedLabel}${selectedHexLabel ? ` @ ${selectedHexLabel}` : ""}.`
    : "No champion selected yet.";

  return (
    <div
      className="champion-target-overlay"
      role="dialog"
      aria-modal="false"
      aria-label="Champion target selection"
    >
      <div className="champion-target-overlay__panel">
        <div className="hand-targets hand-targets--overlay">
          <div className="hand-targets__header">
            <strong>Target champion</strong>
            <span className="hand-targets__meta">
              {targetLabel} ({options.length})
            </span>
          </div>
          <p className="hand-targets__hint">
            Click a champion on the board, or pick one below. Clicking a hex cycles
            between champions on that hex.
          </p>
          {options.length > 0 ? (
            <div className="hand-targets__list">
              {options.map((unit) => {
                const isSelected = unit.id === selectedChampionId;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    className={`btn btn-tertiary hand-targets__option${
                      isSelected ? " is-active" : ""
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(unit)}
                  >
                    <span className="hand-targets__option-name">{unit.name}</span>
                    <span className="hand-targets__option-meta">
                      {unit.ownerName} · {unit.hexLabel} · HP {unit.hp}/{unit.maxHp}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="hand-targets__selected">No eligible champions on the board.</p>
          )}
          <p className="hand-targets__selected">{selectedSummary}</p>
        </div>
      </div>
    </div>
  );
};

export type { ChampionTargetOverlayOption };
