import type { GameView } from "@bridgefront/engine";

import { getFactionName, getFactionSymbol } from "../lib/factions";

type VictoryScreenProps = {
  winnerId: string;
  players: GameView["public"]["players"];
  round: number;
  viewerId: string | null;
  isHost: boolean;
  onRematch?: () => void;
  onLeave: () => void;
  onClose?: () => void;
};

export const VictoryScreen = ({
  winnerId,
  players,
  round,
  viewerId,
  isHost,
  onRematch,
  onLeave,
  onClose
}: VictoryScreenProps) => {
  const winner = players.find((player) => player.id === winnerId) ?? null;
  const winnerName = winner?.name ?? winnerId;
  const winnerFaction = winner ? getFactionName(winner.factionId) : null;
  const winnerFactionSymbol = winner ? getFactionSymbol(winner.factionId) : null;
  const sortedPlayers = [...players].sort(
    (a, b) => (b.vp?.total ?? 0) - (a.vp?.total ?? 0)
  );
  const canRematch = Boolean(onRematch && isHost);

  return (
    <section className="victory-screen" role="dialog" aria-live="polite" aria-modal="true">
      <div className="victory-screen__scrim" />
      <div className="victory-screen__panel">
        <header className="victory-screen__header">
          <p className="eyebrow">Game over</p>
          <h2>Victory</h2>
          <p className="victory-screen__winner">
            {winnerName}
            {winnerFaction ? (
              <span className="victory-screen__winner-faction">
                {winnerFactionSymbol ? (
                  <span className="faction-symbol faction-symbol--small" aria-hidden="true">
                    {winnerFactionSymbol}
                  </span>
                ) : null}
                {winnerFaction}
              </span>
            ) : null}
          </p>
          <p className="victory-screen__meta">Round {round} · Final VP standings</p>
        </header>

        <ul className="victory-screen__scores">
          {sortedPlayers.map((player) => {
            const isWinner = player.id === winnerId;
            const isViewer = player.id === viewerId;
            const vp = player.vp ?? { permanent: 0, control: 0, total: 0 };
            const factionName = getFactionName(player.factionId);
            const factionSymbol = getFactionSymbol(player.factionId);
            return (
              <li key={player.id} className={`victory-score ${isWinner ? "is-winner" : ""}`}>
                <div className="victory-score__identity">
                  <span className="victory-score__name">{player.name}</span>
                  <span className="victory-score__faction">
                    {factionSymbol ? (
                      <span className="faction-symbol faction-symbol--mini" aria-hidden="true">
                        {factionSymbol}
                      </span>
                    ) : null}
                    {factionName}
                  </span>
                  {isViewer ? <span className="victory-score__you">You</span> : null}
                </div>
                <div className="victory-score__vp">
                  <span className="victory-score__total">{vp.total} VP</span>
                  <span className="victory-score__breakdown">
                    P {vp.permanent} · C {vp.control}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="victory-screen__actions">
          {onRematch ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={canRematch ? onRematch : undefined}
              disabled={!canRematch}
            >
              {isHost ? "Rematch" : "Rematch (host only)"}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="btn btn-tertiary" onClick={onClose}>
              Keep watching
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onLeave}>
            Exit to Home
          </button>
        </div>
      </div>
    </section>
  );
};
