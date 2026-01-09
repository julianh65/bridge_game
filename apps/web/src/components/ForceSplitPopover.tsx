type ForceSplitPopoverProps = {
  title: string;
  meta?: string | null;
  forceCount: number | null;
  forceMax: number;
  championCount?: number;
  includeChampions?: boolean;
  onChange: (value: number | null) => void;
  onToggleChampions?: (value: boolean) => void;
};

export const ForceSplitPopover = ({
  title,
  meta,
  forceCount,
  forceMax,
  championCount,
  includeChampions,
  onChange,
  onToggleChampions
}: ForceSplitPopoverProps) => {
  const resolvedChampionCount = championCount ?? 0;
  const canToggleChampions = resolvedChampionCount > 0 && Boolean(onToggleChampions);
  const include = includeChampions ?? forceCount === null;
  const allowZero = include && resolvedChampionCount > 0;
  const showForceControls = forceMax > 1 || (allowZero && forceMax > 0);
  if (!showForceControls && !canToggleChampions) {
    return null;
  }
  const minForceCount = allowZero ? 0 : 1;
  const defaultForceCount = forceMax > 0 ? Math.min(forceMax, 1) : 0;
  const currentForceCount = forceCount === null ? defaultForceCount : forceCount;
  const championLabel =
    resolvedChampionCount === 1
      ? "1 champion"
      : `${resolvedChampionCount} champions`;

  return (
    <div className="force-split-popover">
      <div className="force-split-popover__header">
        <span className="force-split-popover__title">{title}</span>
        {meta ? <span className="force-split-popover__meta">{meta}</span> : null}
      </div>
      <div className="action-panel__split">
        {showForceControls ? (
          <>
            <div className="action-panel__split-header">
              <span>Forces to move</span>
              <div className="action-panel__split-toggle">
                <button
                  type="button"
                  className={`btn btn-tertiary ${forceCount === null ? "is-active" : ""}`}
                  onClick={() => onChange(null)}
                >
                  Move all
                </button>
                <button
                  type="button"
                  className={`btn btn-tertiary ${forceCount !== null ? "is-active" : ""}`}
                  onClick={() =>
                    onChange(forceCount === null ? defaultForceCount : forceCount)
                  }
                >
                  Split
                </button>
              </div>
            </div>
            {forceCount !== null ? (
              <div className="action-panel__split-controls">
                <button
                  type="button"
                  className="btn btn-tertiary"
                  disabled={currentForceCount <= minForceCount}
                  onClick={() => onChange(Math.max(minForceCount, currentForceCount - 1))}
                >
                  -
                </button>
                <div className="action-panel__split-count">{currentForceCount}</div>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  disabled={currentForceCount >= forceMax}
                  onClick={() => onChange(Math.min(forceMax, currentForceCount + 1))}
                >
                  +
                </button>
                <span className="action-panel__split-hint">of {forceMax} forces</span>
              </div>
            ) : (
              <p className="action-panel__split-note">Moves the full stack.</p>
            )}
          </>
        ) : null}
        {canToggleChampions ? (
          <>
            {showForceControls ? (
              <div className="action-panel__split-divider" />
            ) : null}
            <div className="action-panel__split-header">
              <span>Champions</span>
              <div className="action-panel__split-toggle">
                <button
                  type="button"
                  className={`btn btn-tertiary ${include ? "is-active" : ""}`}
                  onClick={() => onToggleChampions?.(true)}
                >
                  Move
                </button>
                <button
                  type="button"
                  className={`btn btn-tertiary ${!include ? "is-active" : ""}`}
                  onClick={() => onToggleChampions?.(false)}
                >
                  Hold
                </button>
              </div>
            </div>
            <span className="action-panel__split-hint">{championLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};
