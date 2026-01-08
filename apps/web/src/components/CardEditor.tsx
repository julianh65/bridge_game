import { useEffect, useMemo, useState } from "react";

import type { Age, CardDef, CardDefId } from "@bridgefront/engine";
import {
  CARD_DEFS,
  MARKET_DECKS_BY_AGE,
  POWER_DECKS_BY_AGE
} from "@bridgefront/engine";

import { GameCard } from "./GameCard";

type CardEdit = {
  initiative?: number;
  cost?: {
    mana?: number;
    gold?: number;
  };
  victoryPoints?: number;
  champion?: {
    hp?: number;
    attackDice?: number;
    hitFaces?: number;
    bounty?: number;
    goldCostByChampionCount?: number[];
  };
};

type CloneCard = {
  baseId: CardDefId;
  card: CardDef;
};

type CardEditPatch = {
  id: CardDefId;
  changes: CardEdit;
};

type CardClonePatch = {
  id: CardDefId;
  baseId: CardDefId;
  changes?: CardEdit;
};

type DeckKind = "market" | "power";

const toggleValue = (values: string[], value: string) => {
  if (values.includes(value)) {
    return values.filter((entry) => entry !== value);
  }
  return [...values, value];
};

const buildDeckCounts = (deck: CardDefId[]) => {
  const counts: Record<CardDefId, number> = {};
  for (const id of deck) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

const mergeDeckCounts = (
  baseCounts: Record<CardDefId, number>,
  edits: Record<CardDefId, number> | undefined
) => {
  if (!edits || Object.keys(edits).length === 0) {
    return baseCounts;
  }
  const next = { ...baseCounts };
  for (const [id, count] of Object.entries(edits)) {
    const safeCount = Math.max(0, Math.floor(count));
    next[id as CardDefId] = safeCount;
  }
  return next;
};

const buildDeckListFromCounts = (
  entries: { id: CardDefId; count: number }[]
) => {
  const list: CardDefId[] = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i += 1) {
      list.push(entry.id);
    }
  }
  return list;
};

const normalizeEdit = (edit: CardEdit): CardEdit => {
  const next: CardEdit = {};

  if (edit.initiative !== undefined) {
    next.initiative = edit.initiative;
  }
  if (edit.victoryPoints !== undefined) {
    next.victoryPoints = edit.victoryPoints;
  }

  if (edit.cost) {
    const cost: CardEdit["cost"] = {};
    if (edit.cost.mana !== undefined) {
      cost.mana = edit.cost.mana;
    }
    if (edit.cost.gold !== undefined) {
      cost.gold = edit.cost.gold;
    }
    if (Object.keys(cost).length > 0) {
      next.cost = cost;
    }
  }

  if (edit.champion) {
    const champion: NonNullable<CardEdit["champion"]> = {};
    if (edit.champion.hp !== undefined) {
      champion.hp = edit.champion.hp;
    }
    if (edit.champion.attackDice !== undefined) {
      champion.attackDice = edit.champion.attackDice;
    }
    if (edit.champion.hitFaces !== undefined) {
      champion.hitFaces = edit.champion.hitFaces;
    }
    if (edit.champion.bounty !== undefined) {
      champion.bounty = edit.champion.bounty;
    }
    if (edit.champion.goldCostByChampionCount !== undefined) {
      champion.goldCostByChampionCount = edit.champion.goldCostByChampionCount.slice();
    }
    if (Object.keys(champion).length > 0) {
      next.champion = champion;
    }
  }

  return next;
};

const applyEdit = (card: CardDef, edit?: CardEdit): CardDef => {
  if (!edit) {
    return card;
  }

  const next: CardDef = { ...card };

  if (edit.initiative !== undefined) {
    next.initiative = edit.initiative;
  }

  if (edit.cost) {
    next.cost = {
      ...card.cost,
      ...edit.cost
    };
  }

  if (edit.victoryPoints !== undefined) {
    next.victoryPoints = edit.victoryPoints;
  }

  if (edit.champion && card.champion) {
    next.champion = {
      ...card.champion,
      ...edit.champion,
      goldCostByChampionCount:
        edit.champion.goldCostByChampionCount ?? card.champion.goldCostByChampionCount
    };
  }

  return next;
};

const formatOptionalNumber = (value: number | undefined) =>
  value === undefined ? "none" : String(value);

const formatNumberList = (value: number[] | undefined) =>
  value && value.length > 0 ? value.join(", ") : "none";

type NumberListInputProps = {
  value?: number[];
  placeholder?: string;
  onCommit: (value?: number[]) => void;
};

const parseNumberList = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const values = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const numbers = values.map((entry) => Number(entry));
  if (numbers.some((entry) => !Number.isFinite(entry))) {
    return null;
  }
  return numbers;
};

const NumberListInput = ({ value, placeholder, onCommit }: NumberListInputProps) => {
  const [draft, setDraft] = useState(value ? value.join(", ") : "");
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setDraft(value ? value.join(", ") : "");
    setIsValid(true);
  }, [value]);

  const handleBlur = () => {
    const parsed = parseNumberList(draft);
    if (parsed === null) {
      setIsValid(false);
      return;
    }
    setIsValid(true);
    onCommit(parsed.length > 0 ? parsed : undefined);
  };

  return (
    <div className="card-editor__list-input">
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
      />
      {!isValid ? <span className="card-editor__error">Use comma-separated numbers.</span> : null}
    </div>
  );
};

export const CardEditor = () => {
  const [selectedDeck, setSelectedDeck] = useState("all");
  const [selectedMana, setSelectedMana] = useState("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState("initiative-desc");
  const [selectedId, setSelectedId] = useState<CardDefId | null>(null);
  const [edits, setEdits] = useState<Record<CardDefId, CardEdit>>({});
  const [clones, setClones] = useState<CloneCard[]>([]);
  const [deckKind, setDeckKind] = useState<DeckKind>("market");
  const [deckAge, setDeckAge] = useState<Age>("I");
  const [deckEdits, setDeckEdits] = useState<
    Record<string, Record<CardDefId, number>>
  >({});

  const baseCards = useMemo(
    () => [...CARD_DEFS, ...clones.map((clone) => clone.card)],
    [clones]
  );

  const baseCardById = useMemo(() => {
    const entries: Record<CardDefId, CardDef> = {};
    for (const card of baseCards) {
      entries[card.id] = card;
    }
    return entries;
  }, [baseCards]);

  const cards = useMemo(
    () => baseCards.map((card) => applyEdit(card, edits[card.id])),
    [baseCards, edits]
  );

  const cardById = useMemo(() => {
    const entries: Record<CardDefId, CardDef> = {};
    for (const card of cards) {
      entries[card.id] = card;
    }
    return entries;
  }, [cards]);

  const cloneById = useMemo(() => {
    const entries: Record<CardDefId, CloneCard> = {};
    for (const clone of clones) {
      entries[clone.card.id] = clone;
    }
    return entries;
  }, [clones]);

  const deckKey = `${deckKind}-${deckAge}`;
  const deckSource =
    deckKind === "market"
      ? MARKET_DECKS_BY_AGE[deckAge]
      : POWER_DECKS_BY_AGE[deckAge];

  const baseDeckCounts = useMemo(() => buildDeckCounts(deckSource), [deckSource]);
  const deckCounts = useMemo(
    () => mergeDeckCounts(baseDeckCounts, deckEdits[deckKey]),
    [baseDeckCounts, deckEdits, deckKey]
  );

  const deckEntries = useMemo(() => {
    const entries: {
      id: CardDefId;
      name: string;
      count: number;
      baseCount: number;
      isEdited: boolean;
    }[] = [];
    const baseIds = new Set<CardDefId>();

    for (const [id, baseCount] of Object.entries(baseDeckCounts)) {
      const cardId = id as CardDefId;
      baseIds.add(cardId);
      const count = deckCounts[cardId] ?? 0;
      const card = baseCardById[cardId];
      entries.push({
        id: cardId,
        name: card?.name ?? cardId,
        count,
        baseCount,
        isEdited: count !== baseCount
      });
    }

    for (const [id, count] of Object.entries(deckCounts)) {
      const cardId = id as CardDefId;
      if (baseIds.has(cardId) || count === 0) {
        continue;
      }
      const card = baseCardById[cardId];
      entries.push({
        id: cardId,
        name: card?.name ?? cardId,
        count,
        baseCount: 0,
        isEdited: count !== 0
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  }, [baseDeckCounts, deckCounts, baseCardById]);

  const deckTotals = useMemo(() => {
    const totalCards = deckEntries.reduce((sum, entry) => sum + entry.count, 0);
    const uniqueCards = deckEntries.filter((entry) => entry.count > 0).length;
    const editedCards = deckEntries.filter((entry) => entry.isEdited).length;
    return { totalCards, uniqueCards, editedCards };
  }, [deckEntries]);

  const deckExport = useMemo(() => buildDeckListFromCounts(deckEntries), [deckEntries]);

  const deckOptions = useMemo(
    () => Array.from(new Set(cards.map((card) => card.deck))).sort(),
    [cards]
  );
  const manaOptions = useMemo(
    () =>
      Array.from(new Set(cards.map((card) => card.cost.mana))).sort((a, b) => a - b),
    [cards]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(cards.map((card) => card.type))).sort(),
    [cards]
  );
  const tagOptions = useMemo(
    () =>
      Array.from(new Set(cards.flatMap((card) => card.tags)))
        .filter((tag) => tag.length > 0)
        .sort(),
    [cards]
  );

  const filteredCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      if (selectedDeck !== "all" && card.deck !== selectedDeck) {
        return false;
      }
      if (selectedMana !== "all" && card.cost.mana !== Number(selectedMana)) {
        return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(card.type)) {
        return false;
      }
      if (
        selectedTags.length > 0 &&
        !card.tags.some((tag) => selectedTags.includes(tag))
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortOrder === "initiative-asc") {
        return a.initiative - b.initiative;
      }
      return b.initiative - a.initiative;
    });
  }, [cards, selectedDeck, selectedMana, selectedTypes, selectedTags, sortOrder]);

  useEffect(() => {
    if (filteredCards.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }
    if (!selectedId || !filteredCards.some((card) => card.id === selectedId)) {
      setSelectedId(filteredCards[0].id);
    }
  }, [filteredCards, selectedId]);

  const selectedCard = selectedId ? cardById[selectedId] ?? null : null;
  const selectedBaseCard = selectedId ? baseCardById[selectedId] ?? null : null;
  const selectedEdit = selectedId ? edits[selectedId] ?? null : null;
  const selectedClone = selectedId ? cloneById[selectedId] ?? null : null;

  const updateEdit = (cardId: CardDefId, updater: (current: CardEdit) => CardEdit) => {
    setEdits((prev) => {
      const current = prev[cardId] ?? {};
      const nextEdit = normalizeEdit(updater(current));
      const next = { ...prev };
      if (Object.keys(nextEdit).length === 0) {
        delete next[cardId];
      } else {
        next[cardId] = nextEdit;
      }
      return next;
    });
  };

  const setCardField = (
    cardId: CardDefId,
    field: "initiative" | "victoryPoints",
    value?: number
  ) => {
    updateEdit(cardId, (current) => {
      const next = { ...current };
      if (value === undefined) {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const setCostField = (cardId: CardDefId, field: keyof NonNullable<CardEdit["cost"]>, value?: number) => {
    updateEdit(cardId, (current) => {
      const cost = { ...(current.cost ?? {}) };
      if (value === undefined) {
        delete cost[field];
      } else {
        cost[field] = value;
      }
      return { ...current, cost };
    });
  };

  const setChampionField = (
    cardId: CardDefId,
    field: keyof NonNullable<CardEdit["champion"]>,
    value?: number | number[]
  ) => {
    updateEdit(cardId, (current) => {
      const champion = { ...(current.champion ?? {}) };
      if (value === undefined) {
        delete champion[field];
      } else {
        champion[field] = value as NonNullable<CardEdit["champion"]>[typeof field];
      }
      return { ...current, champion };
    });
  };

  const clearCardEdits = (cardId: CardDefId) => {
    setEdits((prev) => {
      if (!prev[cardId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const clearAllEdits = () => {
    setEdits({});
  };

  const updateDeckCount = (cardId: CardDefId, value: number) => {
    const safeValue = Math.max(0, Math.floor(value));
    setDeckEdits((prev) => {
      const next = { ...prev };
      const deckEdit = { ...(next[deckKey] ?? {}) };
      const baseValue = baseDeckCounts[cardId] ?? 0;
      if (safeValue === baseValue) {
        delete deckEdit[cardId];
      } else {
        deckEdit[cardId] = safeValue;
      }
      if (Object.keys(deckEdit).length === 0) {
        delete next[deckKey];
      } else {
        next[deckKey] = deckEdit;
      }
      return next;
    });
  };

  const resetDeckEdits = () => {
    setDeckEdits((prev) => {
      if (!prev[deckKey]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deckKey];
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedDeck("all");
    setSelectedMana("all");
    setSelectedTypes([]);
    setSelectedTags([]);
    setSortOrder("initiative-desc");
  };

  const createClone = (card: CardDef) => {
    const existingIds = new Set(baseCards.map((entry) => entry.id));
    const baseId = card.id;
    let index = 1;
    let newId = `${baseId}__copy${index}`;
    while (existingIds.has(newId)) {
      index += 1;
      newId = `${baseId}__copy${index}`;
    }
    const clone: CardDef = {
      ...card,
      id: newId,
      name: `${card.name} (Copy ${index})`,
      tags: [...card.tags],
      cost: { ...card.cost },
      effects: card.effects ? card.effects.map((effect) => ({ ...effect })) : card.effects,
      champion: card.champion ? { ...card.champion } : card.champion
    };
    setClones((prev) => [...prev, { baseId, card: clone }]);
    setSelectedId(newId);
  };

  const collisionGroups = useMemo(() => {
    const byDeck: Record<string, Record<number, CardDef[]>> = {};
    for (const card of filteredCards) {
      const deck = card.deck ?? "unknown";
      if (!byDeck[deck]) {
        byDeck[deck] = {};
      }
      if (!byDeck[deck][card.initiative]) {
        byDeck[deck][card.initiative] = [];
      }
      byDeck[deck][card.initiative].push(card);
    }
    return Object.entries(byDeck)
      .map(([deck, initiatives]) => {
        const collisions = Object.entries(initiatives)
          .map(([initiative, cardsForInit]) => ({
            initiative: Number(initiative),
            cards: cardsForInit
          }))
          .filter((entry) => entry.cards.length > 1)
          .sort((a, b) => a.initiative - b.initiative);
        return { deck, collisions };
      })
      .filter((group) => group.collisions.length > 0)
      .sort((a, b) => a.deck.localeCompare(b.deck));
  }, [filteredCards]);

  const applyInitiativeChanges = (updates: Record<CardDefId, number>) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const [id, value] of Object.entries(updates)) {
        const base = baseCardById[id];
        if (!base) {
          continue;
        }
        const current = next[id] ?? {};
        const updated: CardEdit = { ...current, initiative: value };
        if (value === base.initiative) {
          delete updated.initiative;
        }
        const normalized = normalizeEdit(updated);
        if (Object.keys(normalized).length === 0) {
          delete next[id];
        } else {
          next[id] = normalized;
        }
      }
      return next;
    });
  };

  const decollideInitiatives = () => {
    const updates: Record<CardDefId, number> = {};
    const sorted = [...filteredCards].sort((a, b) => {
      const byInit = a.initiative - b.initiative;
      if (byInit !== 0) {
        return byInit;
      }
      return a.name.localeCompare(b.name);
    });
    const used = new Set<number>();
    for (const card of sorted) {
      let value = card.initiative;
      while (used.has(value)) {
        value += 1;
      }
      used.add(value);
      if (value !== card.initiative) {
        updates[card.id] = value;
      }
    }
    applyInitiativeChanges(updates);
  };

  const compressInitiatives = () => {
    const updates: Record<CardDefId, number> = {};
    const sorted = [...filteredCards].sort((a, b) => {
      const byInit = a.initiative - b.initiative;
      if (byInit !== 0) {
        return byInit;
      }
      return a.name.localeCompare(b.name);
    });
    let nextValue = 1;
    for (const card of sorted) {
      updates[card.id] = nextValue;
      nextValue += 1;
    }
    applyInitiativeChanges(updates);
  };

  const editCount = Object.keys(edits).length;
  const cloneCount = clones.length;

  const patch = useMemo(() => {
    const editEntries: CardEditPatch[] = Object.entries(edits).map(([id, change]) => ({
      id,
      changes: normalizeEdit(change)
    }));
    const cloneEntries: CardClonePatch[] = clones.map((clone) => {
      const change = edits[clone.card.id];
      return {
        id: clone.card.id,
        baseId: clone.baseId,
        changes: change ? normalizeEdit(change) : undefined
      };
    });
    return {
      edits: editEntries,
      clones: cloneEntries
    };
  }, [edits, clones]);

  const summary = useMemo(() => {
    const lines: string[] = [];
    for (const [id, change] of Object.entries(edits)) {
      const base = baseCardById[id];
      if (!base) {
        continue;
      }
      const parts: string[] = [];
      if (change.initiative !== undefined) {
        parts.push(`initiative ${base.initiative} -> ${change.initiative}`);
      }
      if (change.cost?.mana !== undefined) {
        parts.push(`mana ${base.cost.mana} -> ${change.cost.mana}`);
      }
      if (change.cost?.gold !== undefined) {
        parts.push(`gold ${formatOptionalNumber(base.cost.gold)} -> ${change.cost.gold}`);
      }
      if (change.victoryPoints !== undefined) {
        parts.push(
          `victoryPoints ${formatOptionalNumber(base.victoryPoints)} -> ${change.victoryPoints}`
        );
      }
      if (change.champion?.hp !== undefined && base.champion) {
        parts.push(`champion.hp ${base.champion.hp} -> ${change.champion.hp}`);
      }
      if (change.champion?.attackDice !== undefined && base.champion) {
        parts.push(
          `champion.attackDice ${base.champion.attackDice} -> ${change.champion.attackDice}`
        );
      }
      if (change.champion?.hitFaces !== undefined && base.champion) {
        parts.push(
          `champion.hitFaces ${base.champion.hitFaces} -> ${change.champion.hitFaces}`
        );
      }
      if (change.champion?.bounty !== undefined && base.champion) {
        parts.push(
          `champion.bounty ${base.champion.bounty} -> ${change.champion.bounty}`
        );
      }
      if (change.champion?.goldCostByChampionCount !== undefined && base.champion) {
        parts.push(
          `champion.costScale ${formatNumberList(
            base.champion.goldCostByChampionCount
          )} -> ${formatNumberList(change.champion.goldCostByChampionCount)}`
        );
      }
      if (parts.length > 0) {
        lines.push(`${base.name} (${id}): ${parts.join("; ")}`);
      }
    }
    for (const clone of clones) {
      lines.push(`Clone ${clone.card.id} from ${clone.baseId}`);
    }
    return lines.join("\n");
  }, [baseCardById, edits, clones]);

  return (
    <section className="card-editor">
      <header className="card-editor__header">
        <div>
          <p className="eyebrow">Dev Tool</p>
          <h1>Card Editor</h1>
          <p className="subhead">
            Local-only edits for costs, initiative, and champion stats. Export a patch and
            apply manually to the TypeScript card defs.
          </p>
        </div>
        <div className="card-editor__summary">
          <span className="status-pill">{cards.length} cards</span>
          <span className="status-pill">{editCount} edited</span>
          <span className="status-pill">{cloneCount} copies</span>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            Reset Filters
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={clearAllEdits}
            disabled={editCount === 0}
          >
            Clear All Edits
          </button>
        </div>
      </header>

      <aside className="panel card-editor__filters">
        <h2>Filters</h2>

        <div className="filter-group">
          <label className="filter-label" htmlFor="editor-deck-filter">
            Age / Deck
          </label>
          <select
            id="editor-deck-filter"
            value={selectedDeck}
            onChange={(event) => setSelectedDeck(event.target.value)}
          >
            <option value="all">All decks</option>
            {deckOptions.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="editor-mana-filter">
            Mana cost
          </label>
          <select
            id="editor-mana-filter"
            value={selectedMana}
            onChange={(event) => setSelectedMana(event.target.value)}
          >
            <option value="all">Any cost</option>
            {manaOptions.map((cost) => (
              <option key={cost} value={cost}>
                {cost}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Type</span>
          <div className="filter-pills">
            {typeOptions.map((type) => {
              const active = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`filter-pill ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setSelectedTypes(toggleValue(selectedTypes, type))}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Tags</span>
          <div className="filter-pills">
            {tagOptions.length === 0 ? (
              <span className="muted">No tags available.</span>
            ) : (
              tagOptions.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`filter-pill ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setSelectedTags(toggleValue(selectedTags, tag))}
                  >
                    {tag}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="editor-sort-filter">
            Sort
          </label>
          <select
            id="editor-sort-filter"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="initiative-desc">Initiative high to low</option>
            <option value="initiative-asc">Initiative low to high</option>
          </select>
        </div>
      </aside>

      <div className="card-editor__layout">
        <section className="panel card-editor__list">
          <h2>Cards</h2>
          {filteredCards.length === 0 ? (
            <div className="hand-empty">No cards match these filters.</div>
          ) : (
            <div className="cards-grid">
              {filteredCards.map((card) => {
                const isSelected = card.id === selectedId;
                const isEdited = Boolean(edits[card.id]);
                const isClone = Boolean(cloneById[card.id]);
                const overlay =
                  isEdited || isClone ? (
                    <div className="card-editor__card-badges">
                      {isClone ? (
                        <span className="status-pill status-pill--compact">Copy</span>
                      ) : null}
                      {isEdited ? (
                        <span className="status-pill status-pill--compact">Edited</span>
                      ) : null}
                    </div>
                  ) : null;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`card-editor__card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(card.id)}
                  >
                    <GameCard
                      variant="grid"
                      card={card}
                      cardId={card.id}
                      showId
                      showTags
                      showFaction
                      showChampionStats
                      overlay={overlay}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel card-editor__editor">
          <h2>Editor</h2>
          {!selectedCard || !selectedBaseCard ? (
            <p className="muted">Select a card to edit.</p>
          ) : (
            <>
              <div className="card-editor__editor-header">
                <div>
                  <h3>{selectedCard.name}</h3>
                  <p className="muted">
                    {selectedCard.id} · {selectedCard.deck} · {selectedCard.type}
                  </p>
                  {selectedClone ? (
                    <p className="muted">Copy of {selectedClone.baseId}</p>
                  ) : null}
                </div>
                <div className="card-editor__editor-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => createClone(selectedBaseCard)}
                  >
                    Create Copy
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => clearCardEdits(selectedBaseCard.id)}
                    disabled={!selectedEdit}
                  >
                    Reset Card
                  </button>
                </div>
              </div>

              <div className="card-editor__preview">
                <GameCard
                  variant="detail"
                  card={selectedCard}
                  cardId={selectedCard.id}
                  showId
                  showTags
                  showFaction
                  showChampionStats
                />
              </div>

              <div className="card-editor__fields">
                <div className="card-editor__field">
                  <label htmlFor="edit-initiative">Initiative</label>
                  <input
                    id="edit-initiative"
                    type="number"
                    step="1"
                    min="0"
                    value={selectedEdit?.initiative ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        setCardField(selectedBaseCard.id, "initiative", undefined);
                        return;
                      }
                      const value = Number(raw);
                      if (!Number.isFinite(value)) {
                        return;
                      }
                      setCardField(selectedBaseCard.id, "initiative", value);
                    }}
                  />
                  <span className="card-editor__hint">
                    Current: {selectedBaseCard.initiative}
                  </span>
                </div>

                <div className="card-editor__field">
                  <label htmlFor="edit-mana">Mana Cost</label>
                  <input
                    id="edit-mana"
                    type="number"
                    step="1"
                    min="0"
                    value={selectedEdit?.cost?.mana ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        setCostField(selectedBaseCard.id, "mana", undefined);
                        return;
                      }
                      const value = Number(raw);
                      if (!Number.isFinite(value)) {
                        return;
                      }
                      setCostField(selectedBaseCard.id, "mana", value);
                    }}
                  />
                  <span className="card-editor__hint">
                    Current: {selectedBaseCard.cost.mana}
                  </span>
                </div>

                <div className="card-editor__field">
                  <label htmlFor="edit-gold">Gold Cost</label>
                  <input
                    id="edit-gold"
                    type="number"
                    step="1"
                    min="0"
                    value={selectedEdit?.cost?.gold ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        setCostField(selectedBaseCard.id, "gold", undefined);
                        return;
                      }
                      const value = Number(raw);
                      if (!Number.isFinite(value)) {
                        return;
                      }
                      setCostField(selectedBaseCard.id, "gold", value);
                    }}
                  />
                  <span className="card-editor__hint">
                    Current: {formatOptionalNumber(selectedBaseCard.cost.gold)}
                  </span>
                </div>

                {selectedBaseCard.type === "Victory" ? (
                  <div className="card-editor__field">
                    <label htmlFor="edit-vp">Victory Points</label>
                    <input
                      id="edit-vp"
                      type="number"
                      step="1"
                      min="0"
                      value={selectedEdit?.victoryPoints ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === "") {
                          setCardField(selectedBaseCard.id, "victoryPoints", undefined);
                          return;
                        }
                        const value = Number(raw);
                        if (!Number.isFinite(value)) {
                          return;
                        }
                        setCardField(selectedBaseCard.id, "victoryPoints", value);
                      }}
                    />
                    <span className="card-editor__hint">
                      Current: {formatOptionalNumber(selectedBaseCard.victoryPoints)}
                    </span>
                  </div>
                ) : null}

                {selectedBaseCard.champion ? (
                  <div className="card-editor__champion">
                    <h4>Champion Stats</h4>
                    <div className="card-editor__field">
                      <label htmlFor="edit-hp">HP</label>
                      <input
                        id="edit-hp"
                        type="number"
                        step="1"
                        min="0"
                        value={selectedEdit?.champion?.hp ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "") {
                            setChampionField(selectedBaseCard.id, "hp", undefined);
                            return;
                          }
                          const value = Number(raw);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setChampionField(selectedBaseCard.id, "hp", value);
                        }}
                      />
                      <span className="card-editor__hint">
                        Current: {selectedBaseCard.champion.hp}
                      </span>
                    </div>
                    <div className="card-editor__field">
                      <label htmlFor="edit-attack">Attack Dice</label>
                      <input
                        id="edit-attack"
                        type="number"
                        step="1"
                        min="0"
                        value={selectedEdit?.champion?.attackDice ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "") {
                            setChampionField(selectedBaseCard.id, "attackDice", undefined);
                            return;
                          }
                          const value = Number(raw);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setChampionField(selectedBaseCard.id, "attackDice", value);
                        }}
                      />
                      <span className="card-editor__hint">
                        Current: {selectedBaseCard.champion.attackDice}
                      </span>
                    </div>
                    <div className="card-editor__field">
                      <label htmlFor="edit-hit-faces">Hit Faces</label>
                      <input
                        id="edit-hit-faces"
                        type="number"
                        step="1"
                        min="0"
                        value={selectedEdit?.champion?.hitFaces ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "") {
                            setChampionField(selectedBaseCard.id, "hitFaces", undefined);
                            return;
                          }
                          const value = Number(raw);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setChampionField(selectedBaseCard.id, "hitFaces", value);
                        }}
                      />
                      <span className="card-editor__hint">
                        Current: {selectedBaseCard.champion.hitFaces}
                      </span>
                    </div>
                    <div className="card-editor__field">
                      <label htmlFor="edit-bounty">Bounty</label>
                      <input
                        id="edit-bounty"
                        type="number"
                        step="1"
                        min="0"
                        value={selectedEdit?.champion?.bounty ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "") {
                            setChampionField(selectedBaseCard.id, "bounty", undefined);
                            return;
                          }
                          const value = Number(raw);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setChampionField(selectedBaseCard.id, "bounty", value);
                        }}
                      />
                      <span className="card-editor__hint">
                        Current: {selectedBaseCard.champion.bounty}
                      </span>
                    </div>
                    <div className="card-editor__field">
                      <label htmlFor="edit-cost-scale">Gold Cost by Champion Count</label>
                      <NumberListInput
                        value={selectedEdit?.champion?.goldCostByChampionCount}
                        placeholder={formatNumberList(
                          selectedBaseCard.champion.goldCostByChampionCount
                        )}
                        onCommit={(value) =>
                          setChampionField(
                            selectedBaseCard.id,
                            "goldCostByChampionCount",
                            value
                          )
                        }
                      />
                      <span className="card-editor__hint">
                        Current:{" "}
                        {formatNumberList(selectedBaseCard.champion.goldCostByChampionCount)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="card-editor__tools">
                <h4>Initiative Tools</h4>
                <div className="card-editor__tool-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={decollideInitiatives}
                    disabled={filteredCards.length === 0}
                  >
                    De-collide initiatives
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={compressInitiatives}
                    disabled={filteredCards.length === 0}
                  >
                    Compress initiatives
                  </button>
                </div>
                {collisionGroups.length === 0 ? (
                  <p className="muted">No initiative collisions in the current filter.</p>
                ) : (
                  <div className="card-editor__collisions">
                    {collisionGroups.map((group) => (
                      <div key={group.deck} className="card-editor__collision-group">
                        <h5>{group.deck}</h5>
                        {group.collisions.map((collision) => (
                          <div key={`${group.deck}-${collision.initiative}`}>
                            <strong>Init {collision.initiative}:</strong>{" "}
                            {collision.cards.map((card) => card.name).join(", ")}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-editor__export">
                <h4>Patch Export</h4>
                <p className="muted">
                  Copy this JSON and apply the changes manually to the card definition
                  files. The editor does not write to disk.
                </p>
                <textarea
                  readOnly
                  rows={8}
                  value={JSON.stringify(patch, null, 2)}
                />
                <p className="muted">Summary</p>
                <pre>{summary || "No edits yet."}</pre>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel card-editor__deck">
        <header className="card-editor__deck-header">
          <div>
            <h2>Deck Editor</h2>
            <p className="muted">
              Adjust card counts for the market and power decks, then copy the JSON
              array into the deck definitions.
            </p>
          </div>
          <div className="card-editor__deck-controls">
            <div className="card-editor__deck-select">
              <label htmlFor="deck-kind-select">Deck</label>
              <select
                id="deck-kind-select"
                value={deckKind}
                onChange={(event) => setDeckKind(event.target.value as DeckKind)}
              >
                <option value="market">Market</option>
                <option value="power">Power</option>
              </select>
            </div>
            <div className="card-editor__deck-select">
              <label htmlFor="deck-age-select">Age</label>
              <select
                id="deck-age-select"
                value={deckAge}
                onChange={(event) => setDeckAge(event.target.value as Age)}
              >
                <option value="I">Age I</option>
                <option value="II">Age II</option>
                <option value="III">Age III</option>
              </select>
            </div>
            <button type="button" className="btn btn-secondary" onClick={resetDeckEdits}>
              Reset Deck
            </button>
          </div>
        </header>

        <div className="card-editor__deck-meta">
          <span className="status-pill">{deckTotals.totalCards} cards</span>
          <span className="status-pill">{deckTotals.uniqueCards} unique</span>
          <span className="status-pill">{deckTotals.editedCards} edits</span>
        </div>

        {deckEntries.length === 0 ? (
          <p className="muted">No cards are listed in this deck yet.</p>
        ) : (
          <div className="card-editor__deck-grid">
            {deckEntries.map((entry) => (
              <div
                key={entry.id}
                className={`card-editor__deck-row ${
                  entry.isEdited ? "is-edited" : ""
                }`}
              >
                <div className="card-editor__deck-card">
                  <strong>{entry.name}</strong>
                  <span className="muted">{entry.id}</span>
                </div>
                <div className="card-editor__deck-count">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={entry.count}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        updateDeckCount(entry.id, 0);
                        return;
                      }
                      const value = Number(raw);
                      if (!Number.isFinite(value)) {
                        return;
                      }
                      updateDeckCount(entry.id, value);
                    }}
                  />
                  <span className="card-editor__hint">Base: {entry.baseCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card-editor__export card-editor__deck-export">
          <h4>Deck JSON</h4>
          <p className="muted">
            Paste into{" "}
            {deckKind === "market"
              ? "packages/engine/src/content/market-decks.ts"
              : "packages/engine/src/content/power-decks.ts"}
            .
          </p>
          <textarea readOnly rows={6} value={JSON.stringify(deckExport, null, 2)} />
        </div>
      </section>
    </section>
  );
};
