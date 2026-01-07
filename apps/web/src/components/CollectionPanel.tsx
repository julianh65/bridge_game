import { useEffect, useMemo, useState } from "react";

import {
  CARD_DEFS,
  type CardInstance,
  type CollectionChoice,
  type CollectionPrompt,
  type GameView
} from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { GameCard } from "./GameCard";
import { NumberRoll } from "./NumberRoll";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

const COLLECTION_ROLL_SIDES = 6;
const COLLECTION_ROLL_DURATION_MS = 900;

type CollectionPanelProps = {
  phase: GameView["public"]["phase"];
  collectionPublic: GameView["public"]["collection"];
  collectionPrivate: GameView["private"]["collection"] | null;
  player: GameView["public"]["players"][number] | null;
  players: Array<{ id: string; name: string }>;
  handCards: CardInstance[];
  status: RoomConnectionStatus;
  onSubmitChoices: (choices: CollectionChoice[]) => void;
};

const getPromptKey = (kind: CollectionPrompt["kind"], hexKey: string) => `${kind}:${hexKey}`;

const getChoiceKey = (choice: CollectionChoice) => getPromptKey(choice.kind, choice.hexKey);

const getPromptSignature = (prompt: CollectionPrompt) => {
  const reveals = prompt.revealed.join(",");
  const mineValue = prompt.kind === "mine" ? prompt.mineValue : "";
  return `${prompt.kind}:${prompt.hexKey}:${mineValue}:${reveals}`;
};

const isChoiceValid = (
  prompt: CollectionPrompt,
  choice: CollectionChoice,
  handCardIds: Set<string>
) => {
  if (choice.kind !== prompt.kind || choice.hexKey !== prompt.hexKey) {
    return false;
  }

  if (choice.kind === "mine") {
    if (choice.choice === "gold") {
      return true;
    }
    if (prompt.revealed.length === 0 || typeof choice.gainCard !== "boolean") {
      return false;
    }
    if (!choice.gainCard) {
      return true;
    }
    if (choice.cardId) {
      return prompt.revealed.includes(choice.cardId);
    }
    return prompt.revealed.length === 1;
  }

  if (choice.kind === "forge") {
    if (choice.choice === "reforge") {
      return handCardIds.has(choice.scrapCardId);
    }
    return prompt.revealed.includes(choice.cardId);
  }

  if (choice.kind === "center") {
    return prompt.revealed.includes(choice.cardId);
  }

  return false;
};

type CollectionCardOptionProps = {
  cardId: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

const CollectionCardOption = ({
  cardId,
  isSelected,
  disabled,
  onSelect
}: CollectionCardOptionProps) => {
  const cardDef = CARD_DEFS_BY_ID.get(cardId) ?? null;
  return (
    <button
      type="button"
      className={`collection-card-option${isSelected ? " is-selected" : ""}`}
      disabled={disabled}
      aria-pressed={isSelected}
      onClick={onSelect}
    >
      <GameCard
        card={cardDef}
        cardId={cardId}
        variant="grid"
        className="collection-card"
        showId={false}
      />
    </button>
  );
};

export const CollectionPanel = ({
  phase,
  collectionPublic,
  collectionPrivate,
  player,
  players,
  handCards,
  status,
  onSubmitChoices
}: CollectionPanelProps) => {
  const prompts = collectionPrivate?.prompts ?? [];
  const existingChoices = collectionPrivate?.choices ?? null;
  const promptSignature = useMemo(
    () => prompts.map(getPromptSignature).join("|"),
    [prompts]
  );
  const [selections, setSelections] = useState<Record<string, CollectionChoice | null>>({});
  const [promptRolls, setPromptRolls] = useState<
    Record<string, { revealed: boolean; roll: number; rollKey: string }>
  >({});
  const handCardIds = useMemo(() => new Set(handCards.map((card) => card.id)), [handCards]);
  const playerNames = useMemo(
    () => new Map(players.map((entry) => [entry.id, entry.name])),
    [players]
  );
  const waitingFor = collectionPublic?.waitingForPlayerIds ?? [];

  useEffect(() => {
    const next: Record<string, { revealed: boolean; roll: number; rollKey: string }> = {};
    prompts.forEach((prompt, index) => {
      const key = getPromptKey(prompt.kind, prompt.hexKey);
      const hasReveal = prompt.revealed.length > 0;
      const roll = Math.floor(Math.random() * COLLECTION_ROLL_SIDES) + 1;
      next[key] = {
        revealed: !hasReveal,
        roll,
        rollKey: `${promptSignature}-${index}-${roll}`
      };
    });
    setPromptRolls(next);
  }, [promptSignature, prompts]);

  useEffect(() => {
    if (prompts.length === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setPromptRolls((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key], revealed: true };
        }
        return next;
      });
    }, COLLECTION_ROLL_DURATION_MS + 150);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [promptSignature, prompts.length]);

  useEffect(() => {
    const next: Record<string, CollectionChoice | null> = {};
    for (const prompt of prompts) {
      next[getPromptKey(prompt.kind, prompt.hexKey)] = null;
    }
    if (existingChoices) {
      for (const choice of existingChoices) {
        next[getChoiceKey(choice)] = choice;
      }
    }
    setSelections(next);
  }, [promptSignature, existingChoices]);

  const isCollectionPhase = phase === "round.collection";
  const isSpectator = !player;
  const hasSubmitted = existingChoices !== null;
  const canInteract =
    status === "connected" && isCollectionPhase && !isSpectator && !hasSubmitted;

  const { preparedChoices, allValid } = useMemo(() => {
    const prepared: CollectionChoice[] = [];
    let valid = true;
    for (const prompt of prompts) {
      const key = getPromptKey(prompt.kind, prompt.hexKey);
      const choice = selections[key];
      if (!choice || !isChoiceValid(prompt, choice, handCardIds)) {
        valid = false;
        continue;
      }
      prepared.push(choice);
    }
    if (prepared.length !== prompts.length) {
      valid = false;
    }
    return { preparedChoices: prepared, allValid: valid };
  }, [prompts, selections, handCardIds]);

  const canSubmit = canInteract && prompts.length > 0 && allValid;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    onSubmitChoices(preparedChoices);
  };

  const setChoice = (prompt: CollectionPrompt, choice: CollectionChoice) => {
    const key = getPromptKey(prompt.kind, prompt.hexKey);
    setSelections((current) => ({
      ...current,
      [key]: choice
    }));
  };

  let hint = "Select collection rewards for each prompt.";
  if (status !== "connected") {
    hint = "Connect to submit collection choices.";
  } else if (isSpectator) {
    hint = "Spectators cannot submit collection choices.";
  } else if (!isCollectionPhase) {
    hint = "Collection choices are submitted during the collection phase.";
  } else if (hasSubmitted) {
    hint = "Choices submitted.";
  } else if (prompts.length === 0) {
    hint = "No collection prompts for you this round.";
  } else if (!allValid) {
    hint = "Pick an option for each collection prompt.";
  }

  const waitingLabel =
    waitingFor.length > 0
      ? `Waiting for ${waitingFor
          .map((id) => playerNames.get(id) ?? id)
          .join(", ")}`
      : null;

  return (
    <div className="sidebar-section">
      <h3>Collection</h3>
      {isCollectionPhase ? (
        prompts.length === 0 ? (
          <div className="hand-empty">No collection prompts for you this round.</div>
        ) : (
          <div className="collection-prompts">
            {prompts.map((prompt) => {
              const key = getPromptKey(prompt.kind, prompt.hexKey);
              const selection = selections[key];
              const rollState = promptRolls[key];
              const isRevealPending = Boolean(
                rollState && !rollState.revealed && prompt.revealed.length > 0
              );

              if (prompt.kind === "mine") {
                const selectedGold = selection?.kind === "mine" && selection.choice === "gold";
                const selectedDraftId =
                  selection?.kind === "mine" &&
                  selection.choice === "draft" &&
                  selection.gainCard === true
                    ? selection.cardId ?? (prompt.revealed.length === 1 ? prompt.revealed[0] : null)
                    : null;
                const selectedSkip =
                  selection?.kind === "mine" &&
                  selection.choice === "draft" &&
                  selection.gainCard === false;
                return (
                  <div key={key} className="collection-prompt">
                    <div className="collection-prompt__header">
                      <span className="collection-prompt__title">Mine</span>
                      <span className="collection-prompt__meta">
                        {prompt.hexKey}
                      </span>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">
                        Value {prompt.mineValue} gold
                      </span>
                      <div className="collection-prompt__options">
                        <button
                          type="button"
                          className={`btn btn-tertiary ${selectedGold ? "is-active" : ""}`}
                          disabled={!canInteract}
                          onClick={() =>
                            setChoice(prompt, {
                              kind: "mine",
                              hexKey: prompt.hexKey,
                              choice: "gold"
                            })
                          }
                        >
                          Take gold
                        </button>
                      </div>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">
                        Mine draft (choose 1)
                      </span>
                      {prompt.revealed.length === 0 ? (
                        <div className="collection-prompt__note">
                          No card revealed.
                        </div>
                      ) : isRevealPending ? (
                        <div className="collection-roll">
                          <NumberRoll
                            value={rollState?.roll ?? 1}
                            sides={COLLECTION_ROLL_SIDES}
                            durationMs={COLLECTION_ROLL_DURATION_MS}
                            rollKey={rollState?.rollKey}
                            className="number-roll--lg"
                            label="Mine draw roll"
                          />
                          <span className="collection-roll__label">
                            Revealing mine draw...
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="collection-card-grid">
                            {prompt.revealed.map((cardId) => {
                              const isSelected = selectedDraftId === cardId;
                              return (
                                <CollectionCardOption
                                  key={`${cardId}-${prompt.hexKey}`}
                                  cardId={cardId}
                                  isSelected={isSelected}
                                  disabled={!canInteract}
                                  onSelect={() =>
                                    setChoice(prompt, {
                                      kind: "mine",
                                      hexKey: prompt.hexKey,
                                      choice: "draft",
                                      gainCard: true,
                                      cardId
                                    })
                                  }
                                />
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className={`btn btn-tertiary ${
                              selectedSkip ? "is-active" : ""
                            }`}
                            disabled={!canInteract}
                            onClick={() =>
                              setChoice(prompt, {
                                kind: "mine",
                                hexKey: prompt.hexKey,
                                choice: "draft",
                                gainCard: false
                              })
                            }
                          >
                            Skip cards
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              if (prompt.kind === "forge") {
                const selectedReforgeId =
                  selection?.kind === "forge" && selection.choice === "reforge"
                    ? selection.scrapCardId
                    : null;
                const selectedDraftId =
                  selection?.kind === "forge" && selection.choice === "draft"
                    ? selection.cardId
                    : null;
                return (
                  <div key={key} className="collection-prompt">
                    <div className="collection-prompt__header">
                      <span className="collection-prompt__title">Forge</span>
                      <span className="collection-prompt__meta">
                        {prompt.hexKey}
                      </span>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">
                        Reforge (scrap 1 card)
                      </span>
                      {handCards.length === 0 ? (
                        <div className="collection-prompt__note">
                          No cards in hand.
                        </div>
                      ) : (
                        <ul className="card-list">
                          {handCards.map((card) => {
                            const def = CARD_DEFS_BY_ID.get(card.defId);
                            const label = def?.name ?? card.defId;
                            const isSelected = selectedReforgeId === card.id;
                            return (
                              <li key={card.id}>
                                <button
                                  type="button"
                                  className={`card-tag card-tag--clickable ${
                                    isSelected ? "is-selected" : ""
                                  }`}
                                  disabled={!canInteract}
                                  onClick={() =>
                                    setChoice(prompt, {
                                      kind: "forge",
                                      hexKey: prompt.hexKey,
                                      choice: "reforge",
                                      scrapCardId: card.id
                                    })
                                  }
                                >
                                  {label} · {card.id}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">
                        Forge draft (choose 1)
                      </span>
                      {prompt.revealed.length === 0 ? (
                        <div className="collection-prompt__note">
                          No cards revealed.
                        </div>
                      ) : isRevealPending ? (
                        <div className="collection-roll">
                          <NumberRoll
                            value={rollState?.roll ?? 1}
                            sides={COLLECTION_ROLL_SIDES}
                            durationMs={COLLECTION_ROLL_DURATION_MS}
                            rollKey={rollState?.rollKey}
                            className="number-roll--lg"
                            label="Forge draw roll"
                          />
                          <span className="collection-roll__label">
                            Revealing forge draw...
                          </span>
                        </div>
                      ) : (
                        <div className="collection-card-grid">
                          {prompt.revealed.map((cardId) => {
                            const isSelected = selectedDraftId === cardId;
                            return (
                              <CollectionCardOption
                                key={`${cardId}-${prompt.hexKey}`}
                                cardId={cardId}
                                isSelected={isSelected}
                                disabled={!canInteract}
                                onSelect={() =>
                                  setChoice(prompt, {
                                    kind: "forge",
                                    hexKey: prompt.hexKey,
                                    choice: "draft",
                                    cardId
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (prompt.kind === "center") {
                const selectedCardId =
                  selection?.kind === "center" ? selection.cardId : null;
                return (
                  <div key={key} className="collection-prompt">
                    <div className="collection-prompt__header">
                      <span className="collection-prompt__title">Center</span>
                      <span className="collection-prompt__meta">
                        {prompt.hexKey}
                      </span>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">Pick 1 card</span>
                      {prompt.revealed.length === 0 ? (
                        <div className="collection-prompt__note">
                          No cards revealed.
                        </div>
                      ) : isRevealPending ? (
                        <div className="collection-roll">
                          <NumberRoll
                            value={rollState?.roll ?? 1}
                            sides={COLLECTION_ROLL_SIDES}
                            durationMs={COLLECTION_ROLL_DURATION_MS}
                            rollKey={rollState?.rollKey}
                            className="number-roll--lg"
                            label="Center draw roll"
                          />
                          <span className="collection-roll__label">
                            Revealing center draw...
                          </span>
                        </div>
                      ) : (
                        <div className="collection-card-grid">
                          {prompt.revealed.map((cardId) => {
                            const isSelected = selectedCardId === cardId;
                            return (
                              <CollectionCardOption
                                key={`${cardId}-${prompt.hexKey}`}
                                cardId={cardId}
                                isSelected={isSelected}
                                disabled={!canInteract}
                                onSelect={() =>
                                  setChoice(prompt, {
                                    kind: "center",
                                    hexKey: prompt.hexKey,
                                    cardId
                                  })
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )
      ) : (
        <div className="hand-empty">Collection choices appear during the collection phase.</div>
      )}
      <div className="action-panel">
        <p className="action-panel__hint">{hint}</p>
        {waitingLabel ? <div className="hand-meta">{waitingLabel}</div> : null}
        {canSubmit ? (
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Submit choices
          </button>
        ) : null}
      </div>
    </div>
  );
};
