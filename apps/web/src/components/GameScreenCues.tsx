export type PhaseCue = {
  label: string;
  round: number;
};

export type AgeCue = {
  label: string;
  round: number;
  kind: "start" | "shift";
};

type GameScreenCuesProps = {
  phaseCue: PhaseCue | null;
  phaseCueKey: number;
  ageCue: AgeCue | null;
  ageCueKey: number;
};

export const GameScreenCues = ({
  phaseCue,
  phaseCueKey,
  ageCue,
  ageCueKey
}: GameScreenCuesProps) => {
  if (!phaseCue && !ageCue) {
    return null;
  }

  return (
    <>
      {phaseCue ? (
        <div key={phaseCueKey} className="phase-cue" role="status" aria-live="polite">
          <div className="phase-cue__panel">
            <span className="phase-cue__eyebrow">Phase change</span>
            <strong className="phase-cue__label">{phaseCue.label}</strong>
            <span className="phase-cue__round">Round {phaseCue.round}</span>
          </div>
        </div>
      ) : null}
      {ageCue ? (
        <div
          key={ageCueKey}
          className="phase-cue phase-cue--age"
          role="status"
          aria-live="polite"
        >
          <div className="phase-cue__panel">
            <span className="phase-cue__eyebrow">
              {ageCue.kind === "start" ? "Game start" : "New age"}
            </span>
            <strong className="phase-cue__label">{ageCue.label}</strong>
            <span className="phase-cue__round">Round {ageCue.round}</span>
          </div>
        </div>
      ) : null}
    </>
  );
};
