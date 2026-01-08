import { CARD_DEFS_BY_ID, type PlayerID } from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import { RoomCodeCopy } from "./RoomCodeCopy";
import { FACTIONS, getFactionName } from "../lib/factions";
import type { LobbyView, RoomConnectionStatus } from "../lib/room-client";

type PreGameLobbyProps = {
  lobby: LobbyView;
  playerId: PlayerID | null;
  roomId: string;
  status: RoomConnectionStatus;
  onStartGame: () => void;
  onPickFaction: (factionId: string) => void;
  onLeave: () => void;
};

export const PreGameLobby = ({
  lobby,
  playerId,
  roomId,
  status,
  onStartGame,
  onPickFaction,
  onLeave
}: PreGameLobbyProps) => {
  const formatRulesText = (text?: string) => text?.replace(/\s+/g, " ").trim() ?? "";
  const formatCardSummary = (cardId: string) => {
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card) {
      return cardId;
    }
    const rules = formatRulesText(card.rulesText);
    return rules ? `${card.name} - ${rules}` : card.name;
  };
  const connectedCount = lobby.players.filter((player) => player.connected).length;
  const localFactionId =
    lobby.players.find((player) => player.id === playerId)?.factionId ?? null;
  const missingFactions = lobby.players
    .filter((player) => !player.factionId)
    .map((player) => player.name);
  const takenByFaction = new Map(
    lobby.players
      .filter((player) => player.factionId)
      .map((player) => [player.factionId as string, player])
  );
  const allFactionsPicked = missingFactions.length === 0;
  const hostId = lobby.players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canStart =
    isHost &&
    status === "connected" &&
    connectedCount >= lobby.minPlayers &&
    allFactionsPicked;
  const canPickFaction = status === "connected" && Boolean(playerId);
  const statusLabel = status === "connected" ? "Live" : status === "error" ? "Error" : "Waiting";
  const statusClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const startStatus = (() => {
    if (!isHost) {
      return "Waiting for the host to start.";
    }
    if (connectedCount < lobby.minPlayers) {
      return `Need ${lobby.minPlayers} connected players to start.`;
    }
    if (!allFactionsPicked) {
      return `Waiting for faction picks from ${missingFactions.join(", ")}.`;
    }
    return "Ready to start.";
  })();

  return (
    <section className="lobby">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Room Lobby</p>
          <h1>Room {roomId}</h1>
          <p className="subhead">Host starts the game once everyone has joined.</p>
        </div>
        <div className="lobby__status">
          <div className="lobby__status-pills">
            <span className="status-pill">
              {connectedCount}/{lobby.maxPlayers} connected
            </span>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </div>
          <RoomCodeCopy roomId={roomId} />
        </div>
      </header>

      <div className="lobby__grid">
        <section className="panel">
          <h2>Seats</h2>
          <div className="lobby__start">
            <div className="lobby__start-info">
              <div className="lobby__start-title">Start Game</div>
              <p className="muted">
                Host starts the match once {lobby.minPlayers}+ players are connected and factions
                are chosen.
              </p>
              <p className="muted">{startStatus}</p>
            </div>
            {isHost ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onStartGame}
                disabled={!canStart}
              >
                Start Game
              </button>
            ) : null}
          </div>
          <ul className="seat-list">
            {lobby.players.map((player) => (
              <li key={player.id} className={`seat ${player.connected ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">
                    {player.name}
                    {player.seatIndex === 0 ? <span className="chip chip--host">Host</span> : null}
                    {player.id === playerId ? <span className="chip chip--local">You</span> : null}
                  </span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                  <span className="seat__meta">
                    <span className="faction-inline">
                      <FactionSymbol
                        factionId={player.factionId}
                        className="faction-symbol--small"
                      />
                      Faction {getFactionName(player.factionId)}
                    </span>
                  </span>
                </div>
                <div className="seat__status">
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "Connected" : "Offline"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Factions</h2>
          <p className="muted">Choose your faction before the host starts the game.</p>
          <div className="faction-grid">
            {FACTIONS.map((faction) => {
              const isSelected = faction.id === localFactionId;
              const takenBy = takenByFaction.get(faction.id) ?? null;
              const isTaken = Boolean(takenBy && takenBy.id !== playerId);
              const isDisabled = !canPickFaction || isTaken;
              const tagLabel = isSelected ? "Selected" : isTaken ? "Taken" : "Pick";
              const cardClass = `faction-card${isSelected ? " is-selected" : ""}${
                isTaken ? " is-taken" : ""
              }`;
              return (
                <button
                  key={faction.id}
                  type="button"
                  className={cardClass}
                  disabled={isDisabled}
                  title={isTaken && takenBy ? `Taken by ${takenBy.name}` : undefined}
                  onClick={() => onPickFaction(faction.id)}
                >
                  <div className="faction-card__meta">
                    <div className="faction-card__header">
                      <span className="faction-card__label">
                        <FactionSymbol factionId={faction.id} />
                        <span>{faction.name}</span>
                      </span>
                      <div className="faction-card__desc">{faction.description}</div>
                    </div>
                    <div className="faction-card__section">
                      <span className="faction-card__section-title">Passives</span>
                      <ul className="faction-card__list">
                        {faction.passives.map((passive) => (
                          <li key={passive.name}>
                            <span className="faction-card__passive-name">{passive.name}</span>
                            <span className="faction-card__passive-desc">
                              {passive.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="faction-card__section">
                      <span className="faction-card__section-title">Starter Kit</span>
                      <div className="faction-card__starter">
                        <span className="faction-card__starter-label">Spell</span>
                        <span className="faction-card__starter-value">
                          {formatCardSummary(faction.starterSpellId)}
                        </span>
                      </div>
                      <div className="faction-card__starter">
                        <span className="faction-card__starter-label">Champion</span>
                        <span className="faction-card__starter-value">
                          {formatCardSummary(faction.starterChampionId)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="chip chip--local">Selected</span>
                  ) : (
                    <span className="faction-card__tag">{tagLabel}</span>
                  )}
                </button>
              );
            })}
          </div>
          {!canPickFaction ? (
            <p className="muted">Connect to pick a faction.</p>
          ) : !localFactionId ? (
            <p className="muted">Select a faction to ready up.</p>
          ) : null}
        </section>
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </section>
  );
};
