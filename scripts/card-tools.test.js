#!/usr/bin/env node
"use strict";

const assert = require("assert");
const {
  buildCollisionGroups,
  buildDecollideChanges,
  buildCompressChanges
} = require("./card-tools");

const summarizeCollisions = (groups) =>
  groups.map((group) => ({
    deck: group.deck,
    collisions: group.collisions.map((collision) => ({
      initiative: collision.initiative,
      cardIds: collision.cards.map((card) => card.id)
    }))
  }));

const summarizeChanges = (changes) =>
  changes.map((change) => ({
    id: change.id,
    from: change.from,
    to: change.to
  }));

(() => {
  const cards = [
    { id: "age1-alpha", name: "Alpha", deck: "age1", initiative: 2 },
    { id: "age1-beta", name: "Beta", deck: "age1", initiative: 2 },
    { id: "age1-charlie", name: "Charlie", deck: "age1", initiative: 3 },
    { id: "age2-echo", name: "Echo", deck: "age2", initiative: 1 },
    { id: "age2-delta", name: "Delta", deck: "age2", initiative: 1 }
  ];

  const groups = buildCollisionGroups(cards);
  const summary = summarizeCollisions(groups);
  assert.deepStrictEqual(summary, [
    {
      deck: "age1",
      collisions: [
        {
          initiative: 2,
          cardIds: ["age1-alpha", "age1-beta"]
        }
      ]
    },
    {
      deck: "age2",
      collisions: [
        {
          initiative: 1,
          cardIds: ["age2-delta", "age2-echo"]
        }
      ]
    }
  ]);
})();

(() => {
  const cards = [
    { id: "alpha", name: "Alpha", deck: "age1", initiative: 1 },
    { id: "beta", name: "Beta", deck: "age1", initiative: 1 },
    { id: "gamma", name: "Gamma", deck: "age1", initiative: 2 },
    { id: "delta", name: "Delta", deck: "age1", initiative: 4 },
    { id: "no-init", name: "No Init", deck: "age1" }
  ];

  const changes = buildDecollideChanges(cards);
  const summary = summarizeChanges(changes);
  assert.deepStrictEqual(summary, [
    { id: "beta", from: 1, to: 2 },
    { id: "gamma", from: 2, to: 3 }
  ]);
})();

(() => {
  const cards = [
    { id: "alpha", name: "Alpha", deck: "age1", initiative: 3 },
    { id: "beta", name: "Beta", deck: "age1", initiative: 5 },
    { id: "gamma", name: "Gamma", deck: "age1", initiative: 8 },
    { id: "no-init", name: "No Init", deck: "age1" }
  ];

  const changes = buildCompressChanges(cards);
  const summary = summarizeChanges(changes);
  assert.deepStrictEqual(summary, [
    { id: "alpha", from: 3, to: 1 },
    { id: "beta", from: 5, to: 2 },
    { id: "gamma", from: 8, to: 3 }
  ]);
})();

console.log("card-tools tests passed.");
