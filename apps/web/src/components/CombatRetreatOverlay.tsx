import { parseEdgeKey } from "@bridgefront/shared";

import type { CombatRetreatPublicView } from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";

type CombatRetreatOverlayProps = {
  combat: CombatRetreatPublicView;
  playersById: Map<string, string>;
  playerFactionsById?: Map<string, string>;
  viewerId: string | null;
  hexLabel: string | null;
  hexLabels: Record<string, string>;
  onSubmitRetreat?: (hexKey: string, edgeKey: string | null) => void;
};

const formatPlayer = (playerId: string, playersById: Map<string, string>) =>
  playersById.get(playerId) ?? playerId;

const getDestinationHex = (edgeKey: string, hexKey: string): string | null => {
  try {
    const [from, to] = parseEdgeKey(edgeKey);
    if (from === hexKey) {
      return to;
    }
    if (to === hexKey) {
      return from;
    }
  } catch {
    return null;
  }
  return null;
};

export const CombatRetreatOverlay = ({
  combat,
  playersById,
  playerFactionsById,
  viewerId,
  hexLabel,
  hexLabels,
  onSubmitRetreat
}: CombatRetreatOverlayProps) => {
  const renderChoiceLabel = (edgeKey: string) => {
    const destination = getDestinationHex(edgeKey, combat.hexKey);
    const label = destination ? hexLabels[destination] ?? destination : edgeKey;
    return `Retreat to ${label}`;
  };

  const renderSide = (side: "attackers" | "defenders") => {
    const summary = combat[side];
    const playerId = summary.playerId;
    const playerName = formatPlayer(playerId, playersById);
    const factionId = playerFactionsById?.get(playerId) ?? null;
    const options = combat.availableEdges[playerId] ?? [];
    const isWaiting = combat.waitingForPlayerIds.includes(playerId);
    const selection = combat.choices[playerId] ?? null;
    const canAct = Boolean(viewerId && viewerId === playerId && isWaiting);

    return (
      <div className="combat-retreat__side" key={playerId}>
        <div className="combat-retreat__header">
          <div className="combat-retreat__player">
            <FactionSymbol factionId={factionId} className="faction-symbol--mini" />
            <strong>{playerName}</strong>
            <span className="combat-retreat__role">{side === "attackers" ? "Attackers" : "Defenders"}</span>
          </div>
          <span className={`combat-ready${isWaiting ? "" : " combat-ready--ready"}`}>
            {isWaiting ? "Waiting" : "Locked"}
          </span>
        </div>
        <div className="combat-retreat__summary">
          <span>Forces: {summary.forces}</span>
          <span>Champions: {summary.champions}</span>
          <span>Total: {summary.total}</span>
        </div>
        <div className="combat-retreat__options">
          {options.length === 0 ? (
            <span className="combat-retreat__empty">No retreat options.</span>
          ) : canAct ? (
            <>
              <span className="combat-retreat__selection">Click a highlighted hex on the map or choose below.</span>
              {options.map((edgeKey) => (
                <button
                  key={edgeKey}
                  type="button"
                  className="btn btn-tertiary"
                  onClick={() => onSubmitRetreat?.(combat.hexKey, edgeKey)}
                >
                  {renderChoiceLabel(edgeKey)}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSubmitRetreat?.(combat.hexKey, null)}
              >
                Stay
              </button>
            </>
          ) : (
            <span className="combat-retreat__selection">
              {selection && selection !== "stay"
                ? renderChoiceLabel(selection)
                : selection === "stay"
                  ? "Staying in battle"
                  : "Awaiting decision"}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="combat-overlay combat-retreat" role="dialog" aria-modal="true">
      <div className="combat-overlay__scrim" />
      <div className="combat-overlay__panel">
        <header className="combat-overlay__header">
          <div className="combat-overlay__heading">
            <p className="combat-overlay__eyebrow">Retreat decision</p>
            <h2 className="combat-overlay__title">{hexLabel ?? combat.hexKey}</h2>
            <div className="combat-overlay__meta">
              <span className="combat-overlay__badge">Retreat costs 1 mana</span>
            </div>
          </div>
        </header>
        <div className="combat-retreat__body">
          {renderSide("attackers")}
          {renderSide("defenders")}
        </div>
      </div>
    </section>
  );
};
