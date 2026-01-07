import { useMemo, useState } from "react";

import { CARD_DEFS } from "@bridgefront/engine";

import { GameCard } from "./GameCard";

const toggleValue = (values: string[], value: string) => {
  if (values.includes(value)) {
    return values.filter((entry) => entry !== value);
  }
  return [...values, value];
};

export const CardsBrowser = () => {
  const cards = CARD_DEFS;
  const deckOptions = useMemo(
    () => Array.from(new Set(cards.map((card) => card.deck))).sort(),
    [cards]
  );
  const manaOptions = useMemo(
    () =>
      Array.from(new Set(cards.map((card) => card.cost.mana))).sort(
        (a, b) => a - b
      ),
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

  const [selectedDeck, setSelectedDeck] = useState("all");
  const [selectedMana, setSelectedMana] = useState("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState("initiative-desc");

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

  const resetFilters = () => {
    setSelectedDeck("all");
    setSelectedMana("all");
    setSelectedTypes([]);
    setSelectedTags([]);
    setSortOrder("initiative-desc");
  };

  return (
    <section className="cards-browser">
      <header className="cards-browser__header">
        <div>
          <p className="eyebrow">Card Library</p>
          <h1>All Cards</h1>
          <p className="subhead">
            Browse card data from the engine registry. Filters are local-only.
          </p>
        </div>
        <div className="cards-browser__summary">
          <span className="status-pill">
            {filteredCards.length}/{cards.length} cards
          </span>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
      </header>

      <div className="cards-browser__layout">
        <aside className="panel cards-browser__filters">
          <h2>Filters</h2>

          <div className="filter-group">
            <label className="filter-label" htmlFor="deck-filter">
              Age / Deck
            </label>
            <select
              id="deck-filter"
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
            <label className="filter-label" htmlFor="mana-filter">
              Mana cost
            </label>
            <select
              id="mana-filter"
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
            <label className="filter-label" htmlFor="sort-filter">
              Sort
            </label>
            <select
              id="sort-filter"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="initiative-desc">Initiative high to low</option>
              <option value="initiative-asc">Initiative low to high</option>
            </select>
          </div>
        </aside>

        <section className="panel cards-browser__list">
          <h2>Cards</h2>
          {filteredCards.length === 0 ? (
            <div className="hand-empty">No cards match these filters.</div>
          ) : (
            <div className="cards-grid">
              {filteredCards.map((card) => (
                <GameCard
                  key={card.id}
                  variant="grid"
                  card={card}
                  cardId={card.id}
                  showId
                  showChampionStats
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
};
