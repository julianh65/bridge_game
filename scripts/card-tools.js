#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_CARDS_DIR = path.join(process.cwd(), "packages/engine/src/content/cards");

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
};

const parseListArg = (value) => {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normalizeCommand = (value) => {
  if (!value) {
    return null;
  }
  if (value === "de-collide") {
    return "decollide";
  }
  if (value === "decollide") {
    return "decollide";
  }
  if (value === "collisions") {
    return "collisions";
  }
  if (value === "compress") {
    return "compress";
  }
  return null;
};

const usage = () => {
  console.log("Usage: node scripts/card-tools.js <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  collisions   Show initiative collisions (grouped by deck).");
  console.log("  decollide    Propose initiative updates to remove collisions.");
  console.log("  compress     Compress initiatives to a 1..N range.");
  console.log("");
  console.log("Options:");
  console.log("  --deck <list>     Comma-separated deck filter (starter,age1,age2,age3,power).");
  console.log("  --cards-dir <dir> Override card definitions directory.");
  console.log("  --json            Print JSON output (patch for decollide/compress).");
  console.log("  --patch <file>    Write a patch JSON file (decollide/compress only).");
  console.log("  --help            Show this help.");
};

const readBraceBlock = (source, startIndex) => {
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let isEscaped = false;
  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { block: source.slice(startIndex, i + 1), endIndex: i };
      }
    }
  }
  return { block: null, endIndex: source.length };
};

const extractCardBlocks = (source) => {
  const blocks = [];
  const marker = "CardDef =";
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf(marker, index);
    if (found === -1) {
      break;
    }
    const openIndex = source.indexOf("{", found);
    if (openIndex === -1) {
      break;
    }
    const { block, endIndex } = readBraceBlock(source, openIndex);
    if (block) {
      blocks.push(block);
      index = endIndex + 1;
    } else {
      index = openIndex + 1;
    }
  }
  return blocks;
};

const matchString = (block, key) => {
  const regex = new RegExp(`${key}\\s*:\\s*(["'])([\\s\\S]*?)\\1`);
  const match = block.match(regex);
  if (!match) {
    return null;
  }
  return match[2].replace(/\\n/g, "\n");
};

const matchNumber = (block, key) => {
  const regex = new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
  const match = block.match(regex);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const parseCardBlock = (block, sourceFile) => {
  const id = matchString(block, "id");
  const name = matchString(block, "name");
  const deck = matchString(block, "deck");
  const initiative = matchNumber(block, "initiative");

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    deck: deck || "unknown",
    initiative,
    sourceFile
  };
};

const parseCardFiles = (cardsDir) => {
  const entries = fs.readdirSync(cardsDir, { withFileTypes: true });
  const cardFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name)
    .filter((name) => !name.endsWith(".test.ts"))
    .filter((name) => !["index.ts", "types.ts"].includes(name));

  const cards = [];
  for (const file of cardFiles) {
    const fullPath = path.join(cardsDir, file);
    const source = fs.readFileSync(fullPath, "utf8");
    const blocks = extractCardBlocks(source);
    for (const block of blocks) {
      const card = parseCardBlock(block, file);
      if (card) {
        cards.push(card);
      }
    }
  }
  return cards;
};

const compareCards = (a, b) => {
  const aInit = Number.isFinite(a.initiative) ? a.initiative : Number.MAX_SAFE_INTEGER;
  const bInit = Number.isFinite(b.initiative) ? b.initiative : Number.MAX_SAFE_INTEGER;
  if (aInit !== bInit) {
    return aInit - bInit;
  }
  return a.name.localeCompare(b.name);
};

const formatCardLabel = (card) => `${card.name} (${card.id})`;

const buildCollisionGroups = (cards) => {
  const byDeck = new Map();
  for (const card of cards) {
    if (!Number.isFinite(card.initiative)) {
      continue;
    }
    const deckKey = card.deck || "unknown";
    if (!byDeck.has(deckKey)) {
      byDeck.set(deckKey, new Map());
    }
    const deckMap = byDeck.get(deckKey);
    if (!deckMap.has(card.initiative)) {
      deckMap.set(card.initiative, []);
    }
    deckMap.get(card.initiative).push(card);
  }

  const groups = [];
  for (const [deck, initiatives] of byDeck.entries()) {
    const collisions = [];
    for (const [initiative, items] of initiatives.entries()) {
      if (items.length > 1) {
        collisions.push({
          initiative,
          cards: [...items].sort((a, b) => a.name.localeCompare(b.name))
        });
      }
    }
    if (collisions.length > 0) {
      collisions.sort((a, b) => a.initiative - b.initiative);
      groups.push({ deck, collisions });
    }
  }
  groups.sort((a, b) => a.deck.localeCompare(b.deck));
  return groups;
};

const buildDecollideChanges = (cards) => {
  const sorted = [...cards].sort(compareCards);
  const used = new Set();
  const changes = [];
  for (const card of sorted) {
    if (!Number.isFinite(card.initiative)) {
      continue;
    }
    let value = card.initiative;
    while (used.has(value)) {
      value += 1;
    }
    used.add(value);
    if (value !== card.initiative) {
      changes.push({ ...card, from: card.initiative, to: value });
    }
  }
  return changes;
};

const buildCompressChanges = (cards) => {
  const sorted = [...cards].sort(compareCards);
  const changes = [];
  let nextValue = 1;
  for (const card of sorted) {
    if (!Number.isFinite(card.initiative)) {
      continue;
    }
    if (card.initiative !== nextValue) {
      changes.push({ ...card, from: card.initiative, to: nextValue });
    }
    nextValue += 1;
  }
  return changes;
};

const buildPatch = (changes) => {
  const edits = changes.map((change) => ({
    id: change.id,
    changes: { initiative: change.to }
  }));
  edits.sort((a, b) => a.id.localeCompare(b.id));
  return { edits };
};

const writePatchFile = (filePath, patch) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(patch, null, 2) + "\n", "utf8");
};

const printCollisionReport = (groups) => {
  if (groups.length === 0) {
    console.log("No initiative collisions found.");
    return;
  }
  console.log("Initiative collisions (dry run):");
  for (const group of groups) {
    console.log(`\nDeck: ${group.deck}`);
    for (const collision of group.collisions) {
      const labels = collision.cards.map(formatCardLabel).join(", ");
      console.log(`  Initiative ${collision.initiative}: ${labels}`);
    }
  }
};

const printChangesReport = (changes, command, deckFilter) => {
  if (changes.length === 0) {
    console.log(`No initiative updates needed for ${command}.`);
    return;
  }
  console.log(`Proposed initiative updates (${command}, dry run):`);
  if (deckFilter && deckFilter.length > 1) {
    console.log("Note: initiatives are adjusted across all selected decks.");
  }

  const byDeck = new Map();
  for (const change of changes) {
    const deckKey = change.deck || "unknown";
    if (!byDeck.has(deckKey)) {
      byDeck.set(deckKey, []);
    }
    byDeck.get(deckKey).push(change);
  }
  const deckNames = Array.from(byDeck.keys()).sort();
  for (const deck of deckNames) {
    console.log(`\nDeck: ${deck}`);
    const deckChanges = byDeck.get(deck).sort((a, b) => a.to - b.to);
    for (const change of deckChanges) {
      console.log(
        `  ${change.id} (${change.name}): ${change.from} -> ${change.to}`
      );
    }
  }
};

const main = () => {
  const argv = process.argv.slice(2);
  const command = normalizeCommand(argv[0]);
  const args = parseArgs(argv.slice(1));
  if (!command || args.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  const deckFilter = parseListArg(args.deck || args.decks);
  const activeDeckFilter =
    deckFilter.length > 0 && !deckFilter.includes("all") ? deckFilter : null;
  const cardsDir = args["cards-dir"]
    ? path.resolve(args["cards-dir"])
    : DEFAULT_CARDS_DIR;

  if (!fs.existsSync(cardsDir)) {
    console.error(`Cards directory not found: ${cardsDir}`);
    process.exit(1);
  }

  const cards = parseCardFiles(cardsDir);
  if (cards.length === 0) {
    console.error(`No card definitions found in ${cardsDir}.`);
    process.exit(1);
  }

  const filteredCards = activeDeckFilter
    ? cards.filter((card) => activeDeckFilter.includes(card.deck))
    : cards;

  if (filteredCards.length === 0) {
    console.log("No cards matched the deck filter.");
    return;
  }

  const missingInitiative = filteredCards.filter(
    (card) => !Number.isFinite(card.initiative)
  );
  if (missingInitiative.length > 0) {
    console.error(
      `Warning: ${missingInitiative.length} cards missing initiative values.`
    );
  }

  if (command === "collisions") {
    const groups = buildCollisionGroups(filteredCards);
    if (args.json) {
      const json = {
        collisions: groups.map((group) => ({
          deck: group.deck,
          collisions: group.collisions.map((collision) => ({
            initiative: collision.initiative,
            cardIds: collision.cards.map((card) => card.id)
          }))
        }))
      };
      console.log(JSON.stringify(json, null, 2));
      return;
    }
    printCollisionReport(groups);
    return;
  }

  const changes =
    command === "compress"
      ? buildCompressChanges(filteredCards)
      : buildDecollideChanges(filteredCards);

  const patch = buildPatch(changes);
  const patchPath = args.patch ? path.resolve(args.patch) : null;

  if (patchPath) {
    writePatchFile(patchPath, patch);
    console.log(`Wrote patch to ${patchPath}`);
  }

  if (args.json) {
    console.log(JSON.stringify(patch, null, 2));
    return;
  }

  printChangesReport(changes, command, activeDeckFilter);
};

main();
