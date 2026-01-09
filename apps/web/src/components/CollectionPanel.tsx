import { useEffect, useMemo, useState } from "react";

import {
  CARD_DEFS,
  applyCardInstanceOverrides,
  type CardInstance,
  type CollectionChoice,
  type CollectionPrompt,
  type GameView
} from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { GameCard } from "./GameCard";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

const COLLECTION_REVEAL_DELAY_MS = 1050;
const COLLECTION_HIGHLIGHT_STEP_MS = 1200;

type CollectionPanelProps = {
  phase: GameView["public"]["phase"];
  collectionPublic: GameView["public"]["collection"];
  collectionPrivate: GameView["private"]["collection"] | null;
  player: GameView["public"]["players"][number] | null;
  players: Array<{ id: string; name: string }>;
  handCards: CardInstance[];
  status: RoomConnectionStatus;
  labelByHex?: Record<string, string>;
  onSubmitChoices: (choices: CollectionChoice[]) => void;
};

const getPromptKey = (kind: CollectionPrompt["kind"], hexKey: string) => `${kind}:${hexKey}`;

const getChoiceKey = (choice: CollectionChoice) => getPromptKey(choice.kind, choice.hexKey);

const formatHexLabel = (hexKey: string, labelByHex?: Record<string, string>) =>
  labelByHex?.[hexKey] ?? hexKey;

const getPromptSignature = (prompt: CollectionPrompt) =>
  `${prompt.kind}:${prompt.hexKey}:${prompt.revealed.join(",")}`;

const isChoiceValid = (
  prompt: CollectionPrompt,
  choice: CollectionChoice,
  handCardIds: Set<string>
) => {
  if (choice.kind !== prompt.kind || choice.hexKey !== prompt.hexKey) {
    return false;
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

type CollectionHandCardOptionProps = {
  card: CardInstance;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

const CollectionHandCardOption = ({
  card,
  isSelected,
  disabled,
  onSelect
}: CollectionHandCardOptionProps) => {
  const baseDef = CARD_DEFS_BY_ID.get(card.defId) ?? null;
  const cardDef = baseDef ? applyCardInstanceOverrides(baseDef, card.overrides) : null;
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
        cardId={card.defId}
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
  labelByHex,
  onSubmitChoices
}: CollectionPanelProps) => {
  const prompts = collectionPrivate?.prompts ?? [];
  const existingChoices = collectionPrivate?.choices ?? null;
  const promptSignature = useMemo(
    () => prompts.map(getPromptSignature).join("|"),
    [prompts]
  );
  const promptKeySignature = useMemo(
    () => prompts.map((prompt) => getPromptKey(prompt.kind, prompt.hexKey)).join("|"),
    [prompts]
  );
  const [selections, setSelections] = useState<Record<string, CollectionChoice | null>>({});
  const [promptRevealState, setPromptRevealState] = useState<Record<string, boolean>>({});
  const [highlightStage, setHighlightStage] = useState<CollectionPrompt["kind"] | null>(null);
  const handCardIds = useMemo(() => new Set(handCards.map((card) => card.id)), [handCards]);
  const playerNames = useMemo(
    () => new Map(players.map((entry) => [entry.id, entry.name])),
    [players]
  );
  const waitingFor = collectionPublic?.waitingForPlayerIds ?? [];
  const promptSummary = useMemo(() => {
    return prompts.map((prompt) => {
      const hexLabel = formatHexLabel(prompt.hexKey, labelByHex);
      const kindLabel = prompt.kind === "forge" ? "Forge" : "Center";
      let detail = "";
      if (prompt.kind === "forge") {
        detail = "Scrap 1 to reforge or draft a card";
      } else {
        detail = "Pick 1 power card";
      }
      return {
        key: getPromptKey(prompt.kind, prompt.hexKey),
        title: `${kindLabel} ${hexLabel}`,
        detail
      };
    });
  }, [labelByHex, prompts]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    prompts.forEach((prompt) => {
      const key = getPromptKey(prompt.kind, prompt.hexKey);
      const hasReveal = prompt.revealed.length > 0;
      next[key] = !hasReveal;
    });
    setPromptRevealState(next);
  }, [promptSignature, prompts]);

  useEffect(() => {
    if (prompts.length === 0) {
      setHighlightStage(null);
      return;
    }
    const stageOrder: CollectionPrompt["kind"][] = [];
    (["forge", "center"] as const).forEach((kind) => {
      if (prompts.some((prompt) => prompt.kind === kind)) {
        stageOrder.push(kind);
      }
    });
    if (stageOrder.length === 0) {
      setHighlightStage(null);
      return;
    }
    const timers: number[] = [];
    stageOrder.forEach((kind, index) => {
      timers.push(
        window.setTimeout(() => {
          setHighlightStage(kind);
        }, index * COLLECTION_HIGHLIGHT_STEP_MS)
      );
    });
    timers.push(
      window.setTimeout(() => {
        setHighlightStage(null);
      }, stageOrder.length * COLLECTION_HIGHLIGHT_STEP_MS)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [promptKeySignature, prompts]);

  useEffect(() => {
    if (prompts.length === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setPromptRevealState((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          next[key] = true;
        }
        return next;
      });
    }, COLLECTION_REVEAL_DELAY_MS);
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
            <div className="collection-summary">
              <div className="collection-summary__header">
                <span className="collection-summary__title">Your collection sites</span>
                <span className="collection-summary__count">
                  {prompts.length} to resolve
                </span>
              </div>
              <ul className="collection-summary__list">
                {promptSummary.map((entry) => (
                  <li key={entry.key} className="collection-summary__item">
                    <span className="collection-summary__label">{entry.title}</span>
                    <span className="collection-summary__detail">{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            {prompts.map((prompt) => {
              const key = getPromptKey(prompt.kind, prompt.hexKey);
              const selection = selections[key];
              const isRevealPending = Boolean(
                promptRevealState[key] === false && prompt.revealed.length > 0
              );
              const isStageActive = highlightStage === prompt.kind;
              const isStageDimmed = highlightStage !== null && !isStageActive;
              const hexLabel = formatHexLabel(prompt.hexKey, labelByHex);
              const revealCount = prompt.revealed.length;
              const revealLabel = revealCount === 1 ? "1 card" : `${revealCount} cards`;

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
                  <div
                    key={key}
                    className={`collection-prompt ${isStageActive ? "is-highlighted" : ""} ${
                      isStageDimmed ? "is-dimmed" : ""
                    }`}
                  >
                    <div className="collection-prompt__header">
                      <span className="collection-prompt__title">Forge</span>
                      <span className="collection-prompt__meta">{hexLabel}</span>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">
                        Reforge (scrap 1 card)
                      </span>
                      <p className="collection-prompt__note">
                        {revealCount > 0
                          ? `Scrap 1 card to reforge, or draft 1 of ${revealLabel}.`
                          : "No cards left to draft; reforge is still available."}
                      </p>
                      {handCards.length === 0 ? (
                        <div className="collection-prompt__note">
                          No cards in hand.
                        </div>
                      ) : (
                        <div className="collection-card-grid">
                          {handCards.map((card) => {
                            const isSelected = selectedReforgeId === card.id;
                            return (
                              <CollectionHandCardOption
                                key={card.id}
                                card={card}
                                isSelected={isSelected}
                                disabled={!canInteract}
                                onSelect={() =>
                                  setChoice(prompt, {
                                    kind: "forge",
                                    hexKey: prompt.hexKey,
                                    choice: "reforge",
                                    scrapCardId: card.id
                                  })
                                }
                              />
                            );
                          })}
                        </div>
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
                  <div
                    key={key}
                    className={`collection-prompt ${isStageActive ? "is-highlighted" : ""} ${
                      isStageDimmed ? "is-dimmed" : ""
                    }`}
                  >
                    <div className="collection-prompt__header">
                      <span className="collection-prompt__title">Center Power</span>
                      <span className="collection-prompt__meta">{hexLabel}</span>
                    </div>
                    <div className="collection-prompt__section">
                      <span className="collection-prompt__label">Power pick</span>
                      <p className="collection-prompt__note">
                        {revealCount > 0
                          ? `Pick 1 power card from ${revealLabel}.`
                          : "No power cards left to reveal this round."}
                      </p>
                      {prompt.revealed.length === 0 ? (
                        <div className="collection-prompt__note">
                          No cards revealed.
                        </div>
                      ) : isRevealPending ? (
                        <div className="collection-roll">
                          <span className="collection-roll__label">
                            Revealing power deck...
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
