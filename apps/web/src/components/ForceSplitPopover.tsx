type ForceSplitPopoverProps = {
  title: string;
  meta?: string | null;
  forceCount: number | null;
  forceMax: number;
  onChange: (value: number | null) => void;
};

export const ForceSplitPopover = ({
  title,
  meta,
  forceCount,
  forceMax,
  onChange
}: ForceSplitPopoverProps) => {
  if (forceMax <= 1) {
    return null;
  }
  const currentForceCount = forceCount === null ? Math.min(1, forceMax) : forceCount;

  return (
    <div className="force-split-popover">
      <div className="force-split-popover__header">
        <span className="force-split-popover__title">{title}</span>
        {meta ? <span className="force-split-popover__meta">{meta}</span> : null}
      </div>
      <div className="action-panel__split">
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
                onChange(forceCount === null ? Math.min(1, forceMax) : forceCount)
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
              disabled={currentForceCount <= 1}
              onClick={() => onChange(Math.max(1, currentForceCount - 1))}
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
      </div>
    </div>
  );
};
