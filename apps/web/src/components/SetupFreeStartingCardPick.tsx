import { useMemo } from "react";

import {
  CARD_DEFS,
  type GameView,
  type PlayerID,
  type SetupChoice
} from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { GameCard } from "./GameCard";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type SetupFreeStartingCardPickProps = {
  view: GameView;
  playerId: PlayerID | null;
  status: RoomConnectionStatus;
  onSubmitChoice: (choice: SetupChoice) => void;
};

export const SetupFreeStartingCardPick = ({
  view,
  playerId,
  status,
  onSubmitChoice
}: SetupFreeStartingCardPickProps) => {
  const setup = view.public.setup;
  const cardPickSetup =
    setup && setup.type === "setup.freeStartingCardPick" ? setup : null;

  const privateSetup =
    view.private?.setup && view.private.setup.type === "setup.freeStartingCardPick"
      ? view.private.setup
      : null;

  const players = view.public.players;
  const playerNames = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );
  const waitingFor = cardPickSetup?.waitingForPlayerIds ?? [];
  const waitingLabel =
    waitingFor.length > 0
      ? waitingFor
          .map((id) => playerNames.get(id) ?? id)
          .join(", ")
      : "none";
  const isWaiting = Boolean(playerId && waitingFor.includes(playerId));
  const offers = privateSetup?.offers ?? [];
  const chosenCard = privateSetup?.chosen ?? null;
  const canPick = status === "connected" && Boolean(playerId) && isWaiting;

  const helperText = (() => {
    if (status !== "connected") {
      return "Connect to pick a starting card.";
    }
    if (!playerId) {
      return "Spectators can watch but cannot pick.";
    }
    if (chosenCard) {
      const name = CARD_DEFS_BY_ID.get(chosenCard)?.name ?? chosenCard;
      return `You picked ${name}.`;
    }
    if (!isWaiting) {
      return "Waiting for other players to pick.";
    }
    return "Choose one of your offers.";
  })();

  if (!cardPickSetup) {
    return null;
  }

  return (
    <section className="panel setup-card-pick">
      <h2>Free Starting Card</h2>
      <p className="muted">
        Choose one card from your offers. The rest go to the bottom of your deck.
      </p>
      <div className="setup-card-pick__layout">
        <div className="setup-card-pick__main">
          {playerId && privateSetup ? (
            offers.length > 0 ? (
              <div className="setup-card-pick__offers">
                {offers.map((cardId) => {
                  const def = CARD_DEFS_BY_ID.get(cardId);
                  const isChosen = chosenCard === cardId;
                  return (
                    <button
                      key={cardId}
                      type="button"
                      className={`setup-card-pick__offer${isChosen ? " is-selected" : ""}`}
                      onClick={() => onSubmitChoice({ kind: "pickFreeStartingCard", cardId })}
                      disabled={!canPick || Boolean(chosenCard)}
                    >
                      <GameCard
                        variant="offer"
                        card={def ?? null}
                        cardId={cardId}
                        displayName={def?.name ?? cardId}
                        showChampionStats
                        rulesFallback="Unknown card data."
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="hand-empty">Waiting for your offers to load.</div>
            )
          ) : (
            <div className="hand-empty">
              {playerId ? "Waiting for your offers to load." : "Offers are hidden for spectators."}
            </div>
          )}
          <p className="muted">{helperText}</p>
        </div>
        <aside className="setup-card-pick__status">
          <div className="setup-card-pick__summary">
            <div className="resource-row">
              <span>Waiting on</span>
              <strong>{waitingLabel}</strong>
            </div>
            {playerId ? (
              <div className="resource-row">
                <span>Your pick</span>
                <strong>
                  {chosenCard
                    ? CARD_DEFS_BY_ID.get(chosenCard)?.name ?? chosenCard
                    : isWaiting
                      ? "Picking..."
                      : "Waiting"}
                </strong>
              </div>
            ) : null}
          </div>
          <div className="setup-card-pick__players">
            {players.map((player) => {
              const hasPicked = cardPickSetup.chosen[player.id] ?? false;
              const isActive = waitingFor.includes(player.id);
              return (
                <div
                  key={player.id}
                  className={`setup-card-pick__player-row${
                    isActive ? " setup-card-pick__player-row--active" : ""
                  }`}
                >
                  <span>{player.name}</span>
                  <strong>{hasPicked ? "Picked" : "Waiting"}</strong>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
};
