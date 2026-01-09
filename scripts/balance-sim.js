#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const registerTypeScriptHook = () => {
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    jsx: ts.JsxEmit.React
  };

  const compile = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions,
      fileName: filename
    });
    return module._compile(output.outputText, filename);
  };

  require.extensions[".ts"] = compile;
  require.extensions[".tsx"] = compile;
};

registerTypeScriptHook();

const repoRoot = path.join(__dirname, "..");
const engine = require(path.join(repoRoot, "packages", "engine", "src", "index.ts"));
const shared = require("@bridgefront/shared");

const {
  createNewGame,
  DEFAULT_CONFIG,
  applyCommand,
  runUntilBlocked,
  CARD_DEFS_BY_ID,
  applyCardInstanceOverrides,
  getBridgeKey,
  hasBridge,
  isOccupiedByPlayer,
  wouldExceedTwoPlayers,
  isCardPlayable
} = engine;

const { createRngState, randInt, neighborHexKeys } = shared;

const DEFAULT_FACTIONS = [
  "bastion",
  "veil",
  "aerial",
  "prospect",
  "cipher",
  "gatewright"
];

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

const parseNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const usage = () => {
  console.log("Usage: node scripts/balance-sim.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --games <n>            Games to simulate per player count (default: 100)");
  console.log("  --players <n>          Player count (default: 2-6 when not provided)");
  console.log("  --player-counts <list> Comma-separated player counts (overrides --players)");
  console.log("  --seed <n>             Seed base for simulations (default: 1)");
  console.log("  --max-steps <n>        Max block-resolution steps per game (default: 5000)");
  console.log("  --max-rounds <n>       Override ROUNDS_MAX (default: config value)");
  console.log("  --max-targets <n>      Max target candidates per card (default: 16)");
  console.log("  --factions <list>      Comma-separated faction ids (default: built-ins)");
  console.log("  --out <file>           Write JSON output (default: balance-stats.json)");
  console.log("  --report <file>        Write summary report (default: balance-summary.txt)");
  console.log("  --cards-csv <file>     Write card ranking CSV");
  console.log("  --include-games        Include per-game summaries in output");
  console.log("  --log-every <n>        Progress log interval (default: 25)");
  console.log("  --top-cards <n>        Cards to show in report (default: all)");
  console.log("  --min-card-games <n>   Min games played to include in report (default: 1)");
  console.log("  --vp-to-win <n>        Override VP_TO_WIN");
  console.log("  --help                 Show this help");
};

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const gamesPerCount = Math.max(1, Math.floor(parseNumber(args.games, 100)));
const playerCounts = args["player-counts"]
  ? parseListArg(args["player-counts"]).map((entry) => Math.max(2, Math.floor(Number(entry))))
  : args.players
    ? [Math.max(2, Math.floor(parseNumber(args.players, 4)))]
    : [2, 3, 4, 5, 6];
const seedBase = Math.max(0, Math.floor(parseNumber(args.seed, 1)));
const maxSteps = Math.max(200, Math.floor(parseNumber(args["max-steps"], 5000)));
const maxRoundsOverride = args["max-rounds"]
  ? Math.max(1, Math.floor(parseNumber(args["max-rounds"], DEFAULT_CONFIG.ROUNDS_MAX)))
  : null;
const maxTargetsPerCard = Math.max(4, Math.floor(parseNumber(args["max-targets"], 16)));
const factionsList = parseListArg(args.factions);
const factions = factionsList.length > 0 ? factionsList : DEFAULT_FACTIONS;
const outFile = args.out ? String(args.out) : "balance-stats.json";
const reportFile = args.report ? String(args.report) : "balance-summary.txt";
const cardsCsvFile = args["cards-csv"] ? String(args["cards-csv"]) : null;
const includeGames = Boolean(args["include-games"]);
const logEvery = Math.max(1, Math.floor(parseNumber(args["log-every"], 25)));
const topCards = Math.max(0, Math.floor(parseNumber(args["top-cards"], 0)));
const minCardGames = Math.max(1, Math.floor(parseNumber(args["min-card-games"], 1)));
const vpToWinOverride = args["vp-to-win"]
  ? Math.max(1, Math.floor(parseNumber(args["vp-to-win"], DEFAULT_CONFIG.VP_TO_WIN)))
  : null;

const ensureStartingForcesByFaction = (config) => {
  const defaultForces = 4;
  const existing = config.startingForcesByFaction;
  if (!existing || typeof existing !== "object") {
    return {
      ...config,
      startingForcesByFaction: Object.fromEntries(
        factions.map((factionId) => [factionId, defaultForces])
      )
    };
  }
  const nextMap = { ...existing };
  for (const factionId of factions) {
    if (!Number.isFinite(nextMap[factionId])) {
      nextMap[factionId] = defaultForces;
    }
  }
  return { ...config, startingForcesByFaction: nextMap };
};

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.00$/, "");
};

const formatPercent = (value) => `${formatNumber(value * 100, 1)}%`;

const renderTable = (headers, rows) => {
  const columns = headers.map((header, index) => {
    const width = Math.max(
      header.length,
      ...rows.map((row) => String(row[index]).length)
    );
    return { header, width };
  });
  const headerLine = columns
    .map((col, index) => String(headers[index]).padEnd(col.width))
    .join("  ");
  const divider = columns.map((col) => "-".repeat(col.width)).join("  ");
  const body = rows
    .map((row) =>
      row
        .map((cell, index) => String(cell).padEnd(columns[index].width))
        .join("  ")
    )
    .join("\n");
  return `${headerLine}\n${divider}\n${body}`;
};

const buildSummaryReport = (stats) => {
  const lines = [];
  lines.push("Balance Simulation Report");
  lines.push("=========================");
  lines.push("");
  lines.push("Run");
  lines.push("----");
  lines.push(`Games per count: ${stats.meta.gamesPerCount}`);
  lines.push(`Player counts: ${stats.meta.playerCounts.join(", ")}`);
  lines.push(`Seed base: ${stats.meta.seedBase}`);
  lines.push(`Max steps: ${stats.meta.maxSteps}`);
  lines.push(`Max rounds override: ${stats.meta.maxRoundsOverride ?? "none"}`);
  lines.push(`VP to win override: ${stats.meta.vpToWinOverride ?? "none"}`);
  lines.push(`Max targets per card: ${stats.meta.maxTargetsPerCard}`);
  lines.push(`Factions: ${stats.meta.factions.join(", ")}`);
  lines.push(`Started: ${stats.meta.startedAt}`);
  lines.push(`Finished: ${stats.meta.finishedAt}`);
  lines.push("");

  lines.push("Outcomes");
  lines.push("--------");
  lines.push(`Games: ${stats.totals.games}`);
  lines.push(`Wins: ${stats.totals.wins}`);
  lines.push(
    `No winner: ${stats.totals.noWinner} (round limit: ${stats.totals.roundLimit}, step limit: ${stats.totals.stepLimit})`
  );
  if (stats.totals.wins === 0) {
    lines.push("Note: No winners recorded. Card win rates will all be 0.");
  }
  lines.push("");

  lines.push("Rounds & Steps");
  lines.push("--------------");
  lines.push(
    `Rounds: min ${stats.totals.rounds.min}, avg ${formatNumber(
      stats.averages.rounds
    )}, median ${formatNumber(stats.averages.roundsMedian ?? 0)}, max ${
      stats.totals.rounds.max
    }`
  );
  lines.push(
    `Steps: min ${stats.totals.steps.min}, avg ${formatNumber(
      stats.averages.steps
    )}, median ${formatNumber(stats.averages.stepsMedian ?? 0)}, max ${
      stats.totals.steps.max
    }`
  );
  lines.push("");

  lines.push("Actions & Combat");
  lines.push("----------------");
  lines.push(
    `Card actions/game: ${formatNumber(stats.averages.cardActionsPerGame)}`
  );
  lines.push(
    `Basic actions/game: ${formatNumber(stats.averages.basicActionsPerGame)}`
  );
  lines.push(
    `Combats/game: ${formatNumber(stats.averages.combatsPerGame)}`
  );
  lines.push(
    `Combat rounds/game: ${formatNumber(stats.averages.combatRoundsPerGame)}`
  );
  lines.push("");

  lines.push("Market");
  lines.push("------");
  lines.push(
    `Avg buy amount: ${formatNumber(stats.averages.avgMarketBuyAmount)}`
  );
  lines.push(
    `Avg pass pot: ${formatNumber(stats.averages.avgMarketPassPot)}`
  );
  lines.push(
    `Avg roll-off rounds per roll-off: ${formatNumber(
      stats.averages.avgMarketRollOffRounds
    )}`
  );
  lines.push("");

  lines.push("Faction Win Rates");
  lines.push("-----------------");
  const factionRows = Object.entries(stats.factions)
    .map(([factionId, entry]) => [
      factionId,
      entry.games,
      entry.wins,
      formatPercent(entry.winRate),
      formatNumber(entry.avgFinalGold),
      formatNumber(entry.avgFinalMana),
      formatNumber(entry.avgFinalVpTotal)
    ])
    .sort((a, b) => Number(b[3].replace("%", "")) - Number(a[3].replace("%", "")));
  lines.push(
    renderTable(
      ["Faction", "Games", "Wins", "Win%", "AvgGold", "AvgMana", "AvgVP"],
      factionRows
    )
  );
  lines.push("");

  lines.push("Seat Win Rates");
  lines.push("--------------");
  const seatRows = Object.entries(stats.seats)
    .map(([seat, entry]) => [
      seat,
      entry.games,
      entry.wins,
      formatPercent(entry.winRate)
    ])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  lines.push(renderTable(["Seat", "Games", "Wins", "Win%"], seatRows));
  lines.push("");

  lines.push("Economy (Avg per player)");
  lines.push("------------------------");
  const phaseOrder = [
    "setup",
    "round.reset",
    "round.study",
    "round.market",
    "round.action",
    "round.sieges",
    "round.collection",
    "round.scoring",
    "round.cleanup",
    "round.ageUpdate"
  ];
  for (const phase of phaseOrder) {
    const rounds = stats.economySummary[phase];
    if (!rounds) {
      continue;
    }
    lines.push(`Phase: ${phase}`);
    const roundRows = Object.entries(rounds)
      .map(([round, entry]) => [
        round,
        formatNumber(entry.minGold),
        formatNumber(entry.avgGold),
        formatNumber(entry.maxGold),
        formatNumber(entry.minMana),
        formatNumber(entry.avgMana),
        formatNumber(entry.maxMana),
        formatNumber(entry.minVpTotal),
        formatNumber(entry.avgVpTotal),
        formatNumber(entry.maxVpTotal),
        formatNumber(entry.minVpPermanent),
        formatNumber(entry.avgVpPermanent),
        formatNumber(entry.maxVpPermanent),
        formatNumber(entry.minVpControl),
        formatNumber(entry.avgVpControl),
        formatNumber(entry.maxVpControl),
        formatNumber(entry.minHand),
        formatNumber(entry.avgHand),
        formatNumber(entry.maxHand)
      ])
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    lines.push(
      renderTable(
        [
          "Round",
          "Gold min",
          "Gold avg",
          "Gold max",
          "Mana min",
          "Mana avg",
          "Mana max",
          "VP min",
          "VP avg",
          "VP max",
          "VP+perm min",
          "VP+perm avg",
          "VP+perm max",
          "VP+ctrl min",
          "VP+ctrl avg",
          "VP+ctrl max",
          "Hand min",
          "Hand avg",
          "Hand max"
        ],
        roundRows
      )
    );
    lines.push("");
  }

  lines.push("Card Win Rates (games with card played)");
  lines.push("---------------------------------------");
  const cardRows = Object.entries(stats.cards)
    .filter(([, entry]) => entry.gamesPlayed >= minCardGames)
    .map(([cardId, entry]) => [
      cardId,
      entry.gamesPlayed,
      entry.winsWhenPlayed ?? entry.gamesWinnerPlayed,
      formatPercent(entry.winRateWhenPlayed),
      entry.plays,
      formatPercent(entry.playWinShare),
      entry.marketBuys,
      formatPercent(entry.buyWinShare)
    ])
    .sort((a, b) => {
      const winA = Number(a[3].replace("%", ""));
      const winB = Number(b[3].replace("%", ""));
      if (winA !== winB) {
        return winB - winA;
      }
      return b[1] - a[1];
    });
  const sliced = topCards > 0 ? cardRows.slice(0, topCards) : cardRows;
  lines.push(
    renderTable(
      ["Card", "Games", "Wins", "Win%", "Plays", "PlayWin%", "Buys", "BuyWin%"],
      sliced
    )
  );
  if (topCards > 0 && cardRows.length > sliced.length) {
    lines.push("");
    lines.push(
      `Showing top ${sliced.length} of ${cardRows.length} cards (min games: ${minCardGames}).`
    );
  }

  return `${lines.join("\n")}\n`;
};

const writeCardsCsv = (stats, filePath) => {
  const rows = [["cardId", "gamesPlayed", "winsWhenPlayed", "winRate", "plays", "playWinShare", "marketBuys", "buyWinShare", "marketPasses", "passWinShare"]];
  const entries = Object.entries(stats.cards)
    .filter(([, entry]) => entry.gamesPlayed > 0)
    .sort((a, b) => b[1].winRateWhenPlayed - a[1].winRateWhenPlayed);
  for (const [cardId, entry] of entries) {
    rows.push([
      cardId,
      entry.gamesPlayed,
      entry.gamesWinnerPlayed,
      entry.winRateWhenPlayed,
      entry.plays,
      entry.playWinShare,
      entry.marketBuys,
      entry.buyWinShare,
      entry.marketPasses,
      entry.passWinShare
    ]);
  }
  const csv = rows.map((row) => row.join(",")).join("\n");
  fs.writeFileSync(filePath, `${csv}\n`, "utf8");
};

const createDecisionPicker = (seed) => {
  let rng = createRngState(seed);

  const pickInt = (min, max) => {
    const { value, next } = randInt(rng, min, max);
    rng = next;
    return value;
  };

  const pickBool = () => pickInt(0, 1) === 1;

  const pick = (items, context) => {
    if (!items.length) {
      throw new Error(`no options available for ${context}`);
    }
    return items[pickInt(0, items.length - 1)];
  };

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = pickInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return { pick, pickBool, pickInt, shuffle };
};

const applyCommandOrThrow = (state, command, playerId, context) => {
  const nextState = applyCommand(state, command, playerId);
  if (nextState === state) {
    throw new Error(`failed to apply ${context} for ${playerId}`);
  }
  return nextState;
};

const getPlayer = (state, playerId) =>
  state.players.find((entry) => entry.id === playerId) ?? null;

const getPlayerOccupiedHexKeys = (state, playerId) =>
  Object.values(state.board.hexes)
    .filter((hex) => isOccupiedByPlayer(hex, playerId))
    .map((hex) => hex.key);

const getBuildBridgeActions = (state, playerId) => {
  const options = new Set();
  for (const from of getPlayerOccupiedHexKeys(state, playerId)) {
    for (const neighbor of neighborHexKeys(from)) {
      if (!state.board.hexes[neighbor]) {
        continue;
      }
      if (hasBridge(state.board, from, neighbor)) {
        continue;
      }
      options.add(getBridgeKey(from, neighbor));
    }
  }
  return [...options].map((edgeKey) => ({ kind: "buildBridge", edgeKey }));
};

const getMarchActions = (state, playerId) => {
  const options = [];
  for (const from of getPlayerOccupiedHexKeys(state, playerId)) {
    for (const neighbor of neighborHexKeys(from)) {
      const toHex = state.board.hexes[neighbor];
      if (!toHex) {
        continue;
      }
      if (!hasBridge(state.board, from, neighbor)) {
        continue;
      }
      if (wouldExceedTwoPlayers(toHex, playerId)) {
        continue;
      }
      options.push({ kind: "march", from, to: neighbor });
    }
  }
  return options;
};

const getCapitalReinforceAction = (state, playerId) => {
  const player = getPlayer(state, playerId);
  if (!player?.capitalHex) {
    return null;
  }
  const capitalHex = state.board.hexes[player.capitalHex];
  if (!capitalHex) {
    return null;
  }
  if (wouldExceedTwoPlayers(capitalHex, playerId)) {
    return null;
  }
  return { kind: "capitalReinforce" };
};

const getBasicActionOptions = (state, playerId) => {
  const player = getPlayer(state, playerId);
  if (!player || player.resources.mana < 1) {
    return [];
  }

  const options = [
    ...getBuildBridgeActions(state, playerId),
    ...getMarchActions(state, playerId)
  ];

  const reinforce = getCapitalReinforceAction(state, playerId);
  if (reinforce && player.resources.gold >= 1) {
    options.push(reinforce);
  }

  return options;
};

const getCardDefinition = (state, cardInstanceId) => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return null;
  }
  const baseCard = CARD_DEFS_BY_ID[instance.defId];
  if (!baseCard) {
    return null;
  }
  return applyCardInstanceOverrides(baseCard, instance.overrides);
};

const hasEffectKind = (card, kind) =>
  Array.isArray(card.effects) && card.effects.some((entry) => entry.kind === kind);

const getHandEffectCounts = (card) => {
  const getHandEffectCount = (kind, defaultCount) => {
    const effect = card.effects?.find((entry) => entry.kind === kind);
    if (!effect) {
      return 0;
    }
    const rawCount = typeof effect.count === "number" ? effect.count : defaultCount;
    return Math.max(0, Math.floor(rawCount));
  };

  const discardEffect = card.effects?.find((entry) => entry.kind === "discardFromHand");
  const discardCount =
    typeof discardEffect?.count === "number"
      ? Math.max(0, Math.floor(discardEffect.count))
      : discardEffect
        ? 1
        : 0;
  const discardOptional = discardEffect?.optional === true;
  const burnCount = getHandEffectCount("burnFromHand", 1);
  const topdeckCount = getHandEffectCount("topdeckFromHand", 1);

  return {
    discardCount,
    discardOptional,
    burnCount,
    topdeckCount
  };
};

const pickUnique = (items, count, picker) => {
  if (count <= 0) {
    return [];
  }
  if (items.length < count) {
    return null;
  }
  const copy = [...items];
  const selected = [];
  for (let i = 0; i < count; i += 1) {
    const index = picker.pickInt(0, copy.length - 1);
    const [picked] = copy.splice(index, 1);
    if (!picked) {
      return null;
    }
    selected.push(picked);
  }
  return selected;
};

const buildTargetContext = (state, playerId) => {
  const hexKeys = Object.keys(state.board.hexes);
  const playerHexes = [];
  const enemyHexes = [];
  const emptyHexes = [];
  const occupiedHexes = [];
  for (const hex of Object.values(state.board.hexes)) {
    const isPlayer = isOccupiedByPlayer(hex, playerId);
    const hasEnemy = Object.entries(hex.occupants).some(
      ([occupantId, units]) => occupantId !== playerId && units.length > 0
    );
    if (isPlayer) {
      playerHexes.push(hex.key);
    }
    if (hasEnemy) {
      enemyHexes.push(hex.key);
    }
    if (!isPlayer && !hasEnemy) {
      emptyHexes.push(hex.key);
    }
    if (isPlayer || hasEnemy) {
      occupiedHexes.push(hex.key);
    }
  }

  const championsSelf = [];
  const championsEnemy = [];
  const championsAny = [];
  for (const unit of Object.values(state.board.units)) {
    if (unit.kind !== "champion") {
      continue;
    }
    if (unit.ownerPlayerId === playerId) {
      championsSelf.push(unit.id);
    } else {
      championsEnemy.push(unit.id);
    }
    championsAny.push(unit.id);
  }

  const edgesSet = new Set();
  const neighborsByHex = {};
  const bridgeNeighborsByHex = {};
  for (const hexKey of hexKeys) {
    const neighbors = neighborHexKeys(hexKey).filter((key) => Boolean(state.board.hexes[key]));
    neighborsByHex[hexKey] = neighbors;
    bridgeNeighborsByHex[hexKey] = neighbors.filter((neighbor) =>
      hasBridge(state.board, hexKey, neighbor)
    );
    for (const neighbor of neighbors) {
      edgesSet.add(getBridgeKey(hexKey, neighbor));
    }
  }

  return {
    hexKeys,
    playerHexes,
    enemyHexes,
    emptyHexes,
    occupiedHexes,
    championsSelf,
    championsEnemy,
    championsAny,
    edges: [...edgesSet],
    neighborsByHex,
    bridgeNeighborsByHex
  };
};

const getHexPoolFromSpec = (state, playerId, spec, context) => {
  const owner = typeof spec.owner === "string" ? spec.owner : "any";
  const requiresEmpty = spec.requiresEmpty === true;
  const allowEmpty = spec.allowEmpty === true;
  const occupied = spec.occupied === true;
  const tile = typeof spec.tile === "string" ? spec.tile : null;

  let pool = context.hexKeys;
  if (owner === "self") {
    pool = allowEmpty || requiresEmpty ? [...context.playerHexes, ...context.emptyHexes] : context.playerHexes;
  } else if (owner === "enemy") {
    pool = context.enemyHexes;
  }

  if (occupied) {
    pool = pool.filter((hexKey) => context.occupiedHexes.includes(hexKey));
  }
  if (requiresEmpty) {
    pool = pool.filter((hexKey) => context.emptyHexes.includes(hexKey));
  }
  if (tile) {
    pool = pool.filter((hexKey) => state.board.hexes[hexKey]?.tile === tile);
  }

  return pool;
};

const buildRandomPath = (state, startHex, options, context, picker) => {
  const maxDistance =
    typeof options.maxDistance === "number" && Number.isFinite(options.maxDistance)
      ? Math.max(1, Math.floor(options.maxDistance))
      : 1;
  const limit = Math.min(maxDistance, 4);
  const steps = picker.pickInt(1, limit);
  const requiresBridge = options.requiresBridge === true;

  const path = [startHex];
  let current = startHex;
  const visited = new Set([startHex]);

  for (let i = 0; i < steps; i += 1) {
    const neighbors = requiresBridge
      ? context.bridgeNeighborsByHex[current] ?? []
      : context.neighborsByHex[current] ?? [];
    const candidates = neighbors.filter((hexKey) => !visited.has(hexKey));
    if (!candidates.length) {
      break;
    }
    const next = picker.pick(candidates, "path neighbor");
    path.push(next);
    visited.add(next);
    current = next;
  }

  return path.length >= 2 ? path : null;
};

const buildHandTargets = (state, playerId, card, picker) => {
  const player = getPlayer(state, playerId);
  if (!player) {
    return null;
  }
  const hand = player.deck.hand;
  if (!hand.length) {
    return null;
  }

  const counts = getHandEffectCounts(card);
  const requiredCount = Math.max(counts.discardCount, counts.burnCount);

  if (requiredCount > 0) {
    const picked = pickUnique(hand, requiredCount, picker);
    return picked ? { cardInstanceIds: picked } : null;
  }

  if (counts.topdeckCount > 0) {
    const maxCount = Math.min(counts.topdeckCount, hand.length);
    const count = picker.pickInt(1, maxCount);
    const picked = pickUnique(hand, count, picker);
    return picked ? { cardInstanceIds: picked } : null;
  }

  return null;
};

const buildTargetCandidatesForCard = (state, playerId, card, picker, context) => {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (target) => {
    const key = target ? JSON.stringify(target) : "null";
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(target ?? null);
  };

  const targetSpec = card.targetSpec ?? {};
  const kind = targetSpec.kind;

  if (kind === "none") {
    addCandidate(null);
    const handTargets = buildHandTargets(state, playerId, card, picker);
    if (handTargets) {
      addCandidate(handTargets);
    }
    return candidates;
  }

  const attempt = (fn, count) => {
    for (let i = 0; i < count && candidates.length < maxTargetsPerCard; i += 1) {
      const target = fn();
      if (target) {
        addCandidate(target);
      }
    }
  };

  if (kind === "hex") {
    const pool = getHexPoolFromSpec(state, playerId, targetSpec, context);
    attempt(() => {
      if (!pool.length) {
        return null;
      }
      const hexKey = picker.pick(pool, "hex target");
      return { hexKey };
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "hexPair") {
    const pool = context.hexKeys;
    const allowSame = targetSpec.allowSame === true;
    attempt(() => {
      if (!pool.length) {
        return null;
      }
      const from = picker.pick(pool, "hexPair from");
      const to = picker.pick(pool, "hexPair to");
      if (!allowSame && from === to) {
        return null;
      }
      return { from, to };
    }, maxTargetsPerCard * 3);
    return candidates;
  }

  if (kind === "edge") {
    const edges = context.edges;
    const requiresBridge = targetSpec.requiresBridge !== false;
    const maxDistance =
      typeof targetSpec.maxDistance === "number" ? Math.floor(targetSpec.maxDistance) : 1;
    const wantsMove = hasEffectKind(card, "moveStack");

    attempt(() => {
      if (!edges.length) {
        return null;
      }
      const edgeKey = picker.pick(edges, "edge target");
      const target = { edgeKey };
      if (wantsMove && context.playerHexes.length > 0) {
        const start = picker.pick(context.playerHexes, "edge move start");
        const path = buildRandomPath(
          state,
          start,
          { maxDistance, requiresBridge },
          context,
          picker
        );
        if (path) {
          target.path = path;
        }
      }
      return target;
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "multiEdge") {
    const edges = context.edges;
    const minEdges =
      typeof targetSpec.minEdges === "number" ? Math.max(1, Math.floor(targetSpec.minEdges)) : 1;
    const maxEdges =
      typeof targetSpec.maxEdges === "number"
        ? Math.max(minEdges, Math.floor(targetSpec.maxEdges))
        : Math.min(minEdges + 1, edges.length);

    attempt(() => {
      if (!edges.length) {
        return null;
      }
      const upper = Math.min(maxEdges, edges.length);
      const count = picker.pickInt(minEdges, upper);
      const picked = pickUnique(edges, count, picker);
      return picked ? { edgeKeys: picked } : null;
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "stack" || kind === "path") {
    if (!context.playerHexes.length) {
      return candidates;
    }
    const requiresBridge = targetSpec.requiresBridge !== false;
    const maxDistance =
      typeof targetSpec.maxDistance === "number" ? Math.floor(targetSpec.maxDistance) : 1;

    attempt(() => {
      const start = picker.pick(context.playerHexes, "path start");
      const path = buildRandomPath(
        state,
        start,
        { maxDistance, requiresBridge },
        context,
        picker
      );
      return path ? { path } : null;
    }, maxTargetsPerCard * 3);
    return candidates;
  }

  if (kind === "multiPath") {
    if (!context.playerHexes.length) {
      return candidates;
    }
    const minPaths =
      typeof targetSpec.minPaths === "number" ? Math.max(1, Math.floor(targetSpec.minPaths)) : 1;
    const maxPaths =
      typeof targetSpec.maxPaths === "number"
        ? Math.max(minPaths, Math.floor(targetSpec.maxPaths))
        : Math.min(minPaths + 1, context.playerHexes.length);
    const requiresBridge = targetSpec.requiresBridge !== false;
    const maxDistance =
      typeof targetSpec.maxDistance === "number" ? Math.floor(targetSpec.maxDistance) : 1;

    attempt(() => {
      const availableStarts = [...context.playerHexes];
      const upper = Math.min(maxPaths, availableStarts.length);
      const count = picker.pickInt(minPaths, upper);
      const starts = pickUnique(availableStarts, count, picker);
      if (!starts) {
        return null;
      }
      const paths = [];
      for (const start of starts) {
        const path = buildRandomPath(
          state,
          start,
          { maxDistance, requiresBridge },
          context,
          picker
        );
        if (!path) {
          return null;
        }
        paths.push(path);
      }
      return { paths };
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "champion") {
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
    const pool =
      owner === "enemy"
        ? context.championsEnemy
        : owner === "any"
          ? context.championsAny
          : context.championsSelf;
    attempt(() => {
      if (!pool.length) {
        return null;
      }
      return { unitId: picker.pick(pool, "champion target") };
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "championMove") {
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
    const pool =
      owner === "enemy"
        ? context.championsEnemy
        : owner === "any"
          ? context.championsAny
          : context.championsSelf;
    const destinationSpec =
      targetSpec.destination && typeof targetSpec.destination === "object"
        ? targetSpec.destination
        : {};
    const destPool = getHexPoolFromSpec(state, playerId, destinationSpec, context);
    attempt(() => {
      if (!pool.length || !destPool.length) {
        return null;
      }
      const unitId = picker.pick(pool, "champion move unit");
      const hexKey = picker.pick(destPool, "champion move hex");
      return { unitId, hexKey };
    }, maxTargetsPerCard * 2);
    return candidates;
  }

  if (kind === "choice") {
    const options = Array.isArray(targetSpec.options) ? targetSpec.options : [];
    for (const option of options) {
      if (candidates.length >= maxTargetsPerCard) {
        break;
      }
      if (option?.kind === "capital") {
        addCandidate({ choice: "capital" });
      }
      if (option?.kind === "occupiedHex") {
        const pool = context.playerHexes.filter((hexKey) => {
          if (typeof option.tile === "string") {
            return state.board.hexes[hexKey]?.tile === option.tile;
          }
          return true;
        });
        if (pool.length > 0) {
          addCandidate({ choice: "occupiedHex", hexKey: picker.pick(pool, "choice hex") });
        }
      }
    }
    return candidates;
  }

  if (kind === "player") {
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "enemy";
    const pool =
      owner === "self"
        ? [playerId]
        : owner === "any"
          ? state.players.map((player) => player.id)
          : state.players.map((player) => player.id).filter((id) => id !== playerId);
    attempt(() => {
      if (!pool.length) {
        return null;
      }
      return { playerId: picker.pick(pool, "player target") };
    }, maxTargetsPerCard);
    return candidates;
  }

  return candidates;
};

const getPlayableCardDeclarations = (state, playerId, picker) => {
  const player = getPlayer(state, playerId);
  if (!player) {
    return [];
  }

  const declarations = [];
  const context = buildTargetContext(state, playerId);

  for (const cardInstanceId of player.deck.hand) {
    const card = getCardDefinition(state, cardInstanceId);
    if (!card) {
      continue;
    }
    const goldCost = card.cost.gold ?? 0;
    if (card.cost.mana > player.resources.mana || goldCost > player.resources.gold) {
      continue;
    }

    const candidates = buildTargetCandidatesForCard(state, playerId, card, picker, context);
    if (!candidates.length) {
      continue;
    }

    for (const targets of candidates) {
      if (isCardPlayable(state, playerId, card, targets)) {
        declarations.push({ kind: "card", cardInstanceId, targets });
      }
      if (declarations.length >= maxTargetsPerCard * 3) {
        break;
      }
    }
  }

  return declarations;
};

const getActionDeclarationOptions = (state, playerId, picker) => {
  const options = [{ kind: "done" }];
  const basicOptions = getBasicActionOptions(state, playerId).map((action) => ({
    kind: "basic",
    action
  }));
  options.push(...basicOptions);
  options.push(...getPlayableCardDeclarations(state, playerId, picker));
  return options;
};

const resolveCapitalDraftBlockRandom = (state, picker) => {
  let nextState = state;
  while (
    nextState.blocks?.type === "setup.capitalDraft" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const taken = new Set(
      Object.values(block.payload.choices).filter((value) => Boolean(value))
    );
    const availableSlots = block.payload.availableSlots.filter(
      (candidate) => !taken.has(candidate)
    );
    const slot = picker.pick(availableSlots, "capital draft slot");
    const playerId = block.waitingFor[0];
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: slot } },
      playerId,
      "capital draft pick"
    );
  }
  return nextState;
};

const resolveStartingBridgesBlockRandom = (state, picker) => {
  let nextState = state;
  while (
    nextState.blocks?.type === "setup.startingBridges" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const player = getPlayer(nextState, playerId);
    if (!player?.capitalHex) {
      throw new Error(`missing capital for ${playerId}`);
    }
    const placedEdges = new Set(block.payload.selectedEdges[playerId] ?? []);
    const neighbors = neighborHexKeys(player.capitalHex).filter(
      (key) => Boolean(nextState.board.hexes[key])
    );
    const edgeOptions = neighbors
      .map((neighbor) => getBridgeKey(player.capitalHex, neighbor))
      .filter((edgeKey) => !placedEdges.has(edgeKey));
    const edgeKey = picker.pick(edgeOptions, `starting bridge for ${playerId}`);

    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey } },
      playerId,
      "starting bridge placement"
    );
  }
  return nextState;
};

const resolveFreeStartingCardBlockRandom = (state, picker) => {
  let nextState = state;
  while (
    nextState.blocks?.type === "setup.freeStartingCardPick" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const offers = block.payload.offers[playerId] ?? [];
    const cardId = picker.pick(offers, `free starting card for ${playerId}`);
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId } },
      playerId,
      "free starting card pick"
    );
  }
  return nextState;
};

const resolveMarketBidBlockRandom = (state, picker) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "market.bidsForCard") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const player = getPlayer(nextState, playerId);
    if (!player) {
      throw new Error(`missing player ${playerId}`);
    }

    const gold = player.resources.gold;
    const shouldBuy = gold > 0 && picker.pickBool();
    const amount = shouldBuy ? picker.pickInt(1, gold) : picker.pickInt(0, gold);
    nextState = applyCommandOrThrow(
      nextState,
      {
        type: "SubmitMarketBid",
        payload: { kind: shouldBuy ? "buy" : "pass", amount }
      },
      playerId,
      "market bid"
    );
  }
  return nextState;
};

const resolveMarketRollOffBlockRandom = (state) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "market.rollOff") {
    return nextState;
  }
  for (const playerId of block.waitingFor) {
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitMarketRollOff" },
      playerId,
      "market roll-off"
    );
  }
  return nextState;
};

const resolveActionStepBlockRandom = (state, picker) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "actionStep.declarations") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const options = getActionDeclarationOptions(nextState, playerId, picker);
    const shuffled = picker.shuffle(options);
    let applied = false;
    for (const declaration of shuffled) {
      const attempted = applyCommand(
        nextState,
        { type: "SubmitAction", payload: declaration },
        playerId
      );
      if (attempted !== nextState) {
        nextState = attempted;
        applied = true;
        break;
      }
    }
    if (!applied) {
      nextState = applyCommandOrThrow(
        nextState,
        { type: "SubmitAction", payload: { kind: "done" } },
        playerId,
        "action declaration fallback"
      );
    }
  }
  return nextState;
};

const resolveScoutReportBlockRandom = (state, picker) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "action.scoutReport") {
    return nextState;
  }
  const maxKeep = Math.min(block.payload.keepCount, block.payload.offers.length);
  const picks = [];
  const remaining = [...block.payload.offers];
  const pickCount = maxKeep > 0 ? picker.pickInt(1, maxKeep) : 0;
  for (let i = 0; i < pickCount && remaining.length > 0; i += 1) {
    const index = picker.pickInt(0, remaining.length - 1);
    const [picked] = remaining.splice(index, 1);
    if (picked) {
      picks.push(picked);
    }
  }
  nextState = applyCommandOrThrow(
    nextState,
    { type: "SubmitScoutReportChoice", payload: { cardInstanceIds: picks } },
    block.payload.playerId,
    "scout report"
  );
  return nextState;
};

const resolveCombatRetreatBlockRandom = (state) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "combat.retreat") {
    return nextState;
  }
  for (const playerId of block.waitingFor) {
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitCombatRetreat", payload: { hexKey: block.payload.hexKey, edgeKey: null } },
      playerId,
      "combat retreat"
    );
  }
  return nextState;
};

const resolveQuietStudyBlockRandom = (state, picker) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return nextState;
  }
  for (const playerId of block.waitingFor) {
    const player = getPlayer(nextState, playerId);
    if (!player) {
      continue;
    }
    const hand = [...player.deck.hand];
    const maxDiscard = Math.min(block.payload.maxDiscard, hand.length);
    const discardCount = maxDiscard > 0 ? picker.pickInt(0, maxDiscard) : 0;
    const selected = [];
    for (let i = 0; i < discardCount; i += 1) {
      const index = picker.pickInt(0, hand.length - 1);
      const [picked] = hand.splice(index, 1);
      if (picked) {
        selected.push(picked);
      }
    }
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitQuietStudy", payload: { cardInstanceIds: selected } },
      playerId,
      "quiet study"
    );
  }
  return nextState;
};

const buildCollectionChoices = (state, playerId, prompts, picker) => {
  const player = getPlayer(state, playerId);
  if (!player) {
    throw new Error(`missing player ${playerId}`);
  }
  return prompts.map((prompt) => {
    if (prompt.kind === "forge") {
      const canDraft = prompt.revealed.length > 0;
      const canReforge = player.deck.hand.length > 0;
      if (canDraft && (!canReforge || picker.pickBool())) {
        const cardId = picker.pick(prompt.revealed, `forge draft for ${playerId}`);
        return { kind: "forge", hexKey: prompt.hexKey, choice: "draft", cardId };
      }
      if (canReforge) {
        const scrapCardId = picker.pick(player.deck.hand, `forge scrap for ${playerId}`);
        return { kind: "forge", hexKey: prompt.hexKey, choice: "reforge", scrapCardId };
      }
      throw new Error(`no valid forge choice for ${playerId}`);
    }

    const cardId = picker.pick(prompt.revealed, `center pick for ${playerId}`);
    return { kind: "center", hexKey: prompt.hexKey, cardId };
  });
};

const resolveCollectionBlockRandom = (state, picker) => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "collection.choices") {
    return nextState;
  }
  for (const playerId of block.waitingFor) {
    const prompts = block.payload.prompts[playerId] ?? [];
    const choices = buildCollectionChoices(nextState, playerId, prompts, picker);
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitCollectionChoices", payload: choices },
      playerId,
      "collection choices"
    );
  }
  return nextState;
};

const advanceSetupGate = (state) => {
  let nextState = state;
  if (nextState.blocks?.type === "setup.deckPreview") {
    for (const playerId of nextState.blocks.waitingFor) {
      nextState = applyCommandOrThrow(
        nextState,
        { type: "SubmitSetupChoice", payload: { kind: "readyDeckPreview" } },
        playerId,
        "deck preview ready"
      );
    }
  }
  const hostId = nextState.players.find((player) => player.seatIndex === 0)?.id;
  if (!hostId) {
    throw new Error("no host available to advance setup");
  }
  return applyCommandOrThrow(nextState, { type: "AdvanceSetup" }, hostId, "advance setup");
};

const resolveBlockRandom = (state, picker) => {
  const block = state.blocks;
  if (!block) {
    return state;
  }

  switch (block.type) {
    case "setup.deckPreview":
      return advanceSetupGate(state);
    case "setup.capitalDraft":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveCapitalDraftBlockRandom(state, picker);
    case "setup.startingBridges":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveStartingBridgesBlockRandom(state, picker);
    case "setup.freeStartingCardPick":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveFreeStartingCardBlockRandom(state, picker);
    case "market.bidsForCard":
      return resolveMarketBidBlockRandom(state, picker);
    case "market.rollOff":
      return resolveMarketRollOffBlockRandom(state);
    case "actionStep.declarations":
      return resolveActionStepBlockRandom(state, picker);
    case "action.scoutReport":
      return resolveScoutReportBlockRandom(state, picker);
    case "combat.retreat":
      return resolveCombatRetreatBlockRandom(state);
    case "round.quietStudy":
      return resolveQuietStudyBlockRandom(state, picker);
    case "collection.choices":
      return resolveCollectionBlockRandom(state, picker);
    default: {
      const unknown = block;
      throw new Error(`Unhandled block type: ${unknown.type}`);
    }
  }
};

const buildLobbyPlayers = (count, picker) => {
  const assigned = [];
  let available = picker.shuffle(factions);
  for (let i = 0; i < count; i += 1) {
    if (available.length === 0) {
      available = picker.shuffle(factions);
    }
    assigned.push(available.pop());
  }
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    factionId: assigned[index]
  }));
};

const initStats = () => ({
  meta: {
    gamesPerCount,
    playerCounts,
    seedBase,
    maxSteps,
    maxRoundsOverride,
    vpToWinOverride,
    maxTargetsPerCard,
    factions
  },
  totals: {
    games: 0,
    completed: 0,
    wins: 0,
    noWinner: 0,
    roundLimit: 0,
    stepLimit: 0,
    rounds: { min: null, max: null, sum: 0, list: [] },
    steps: { min: null, max: null, sum: 0, list: [] },
    combats: { starts: 0, rounds: 0, ends: 0 },
    actions: { cards: 0, basics: 0, done: 0 }
  },
  factions: {},
  seats: {},
  cards: {},
  market: {
    buys: 0,
    passes: 0,
    buyAmountSum: 0,
    passAmountSum: 0,
    rollOffs: 0,
    rollOffRounds: 0,
    cards: {}
  },
  economy: {
    byPhaseRound: {}
  },
  games: []
});

const ensureNested = (root, keys, init) => {
  let node = root;
  for (const key of keys) {
    if (!node[key]) {
      node[key] = {};
    }
    node = node[key];
  }
  if (init && node.samples === undefined) {
    Object.assign(node, init());
  }
  return node;
};

const recordEconomySnapshot = (stats, state) => {
  const round = state.round;
  const phase = state.phase;
  const entry = ensureNested(stats.economy.byPhaseRound, [phase, String(round)], () => ({
    samples: 0,
    players: 0,
    goldSum: 0,
    manaSum: 0,
    vpTotalSum: 0,
    vpPermanentSum: 0,
    vpControlSum: 0,
    handSum: 0,
    goldMin: null,
    goldMax: null,
    manaMin: null,
    manaMax: null,
    vpTotalMin: null,
    vpTotalMax: null,
    vpPermanentMin: null,
    vpPermanentMax: null,
    vpControlMin: null,
    vpControlMax: null,
    handMin: null,
    handMax: null
  }));
  entry.samples += 1;
  for (const player of state.players) {
    const gold = player.resources.gold;
    const mana = player.resources.mana;
    const vpTotal = player.vp.total;
    const vpPermanent = player.vp.permanent;
    const vpControl = player.vp.control;
    const hand = player.deck.hand.length;
    entry.players += 1;
    entry.goldSum += gold;
    entry.manaSum += mana;
    entry.vpTotalSum += vpTotal;
    entry.vpPermanentSum += vpPermanent;
    entry.vpControlSum += vpControl;
    entry.handSum += hand;
    entry.goldMin = entry.goldMin === null ? gold : Math.min(entry.goldMin, gold);
    entry.goldMax = entry.goldMax === null ? gold : Math.max(entry.goldMax, gold);
    entry.manaMin = entry.manaMin === null ? mana : Math.min(entry.manaMin, mana);
    entry.manaMax = entry.manaMax === null ? mana : Math.max(entry.manaMax, mana);
    entry.vpTotalMin = entry.vpTotalMin === null ? vpTotal : Math.min(entry.vpTotalMin, vpTotal);
    entry.vpTotalMax = entry.vpTotalMax === null ? vpTotal : Math.max(entry.vpTotalMax, vpTotal);
    entry.vpPermanentMin =
      entry.vpPermanentMin === null ? vpPermanent : Math.min(entry.vpPermanentMin, vpPermanent);
    entry.vpPermanentMax =
      entry.vpPermanentMax === null ? vpPermanent : Math.max(entry.vpPermanentMax, vpPermanent);
    entry.vpControlMin =
      entry.vpControlMin === null ? vpControl : Math.min(entry.vpControlMin, vpControl);
    entry.vpControlMax =
      entry.vpControlMax === null ? vpControl : Math.max(entry.vpControlMax, vpControl);
    entry.handMin = entry.handMin === null ? hand : Math.min(entry.handMin, hand);
    entry.handMax = entry.handMax === null ? hand : Math.max(entry.handMax, hand);
  }
};

const recordTotalsList = (bucket, value) => {
  bucket.sum += value;
  bucket.min = bucket.min === null ? value : Math.min(bucket.min, value);
  bucket.max = bucket.max === null ? value : Math.max(bucket.max, value);
  bucket.list.push(value);
};

const parseGameLogs = (state) => {
  const cardPlaysByPlayer = {};
  const cardsPlayedSet = new Set();
  const cardsPlayedByPlayerSet = {};
  const marketBuysByPlayer = {};
  const marketPassByPlayer = {};
  let combats = { starts: 0, rounds: 0, ends: 0 };
  let actions = { cards: 0, basics: 0, done: 0 };
  let rollOffRounds = 0;
  let rollOffEvents = 0;
  let buyAmountSum = 0;
  let passPotSum = 0;

  for (const event of state.logs) {
    if (!event || typeof event.type !== "string") {
      continue;
    }
    if (event.type.startsWith("action.card.")) {
      const payload = event.payload ?? {};
      const cardId = payload.cardId ?? event.type.slice("action.card.".length);
      const playerId = payload.playerId;
      if (typeof cardId === "string") {
        cardsPlayedSet.add(cardId);
        if (playerId) {
          cardPlaysByPlayer[playerId] = cardPlaysByPlayer[playerId] ?? {};
          cardPlaysByPlayer[playerId][cardId] =
            (cardPlaysByPlayer[playerId][cardId] ?? 0) + 1;
          cardsPlayedByPlayerSet[playerId] =
            cardsPlayedByPlayerSet[playerId] ?? new Set();
          cardsPlayedByPlayerSet[playerId].add(cardId);
        }
      }
      actions.cards += 1;
      continue;
    }
    if (event.type.startsWith("action.basic.")) {
      actions.basics += 1;
      continue;
    }
    if (event.type === "action.done") {
      actions.done += 1;
      continue;
    }
    if (event.type === "market.buy") {
      const payload = event.payload ?? {};
      const cardId = payload.cardId;
      const playerId = payload.playerId;
      if (typeof payload.amount === "number") {
        buyAmountSum += payload.amount;
      }
      if (cardId && playerId) {
        marketBuysByPlayer[playerId] = marketBuysByPlayer[playerId] ?? {};
        marketBuysByPlayer[playerId][cardId] =
          (marketBuysByPlayer[playerId][cardId] ?? 0) + 1;
      }
      if (Array.isArray(payload.rollOff)) {
        rollOffEvents += 1;
        rollOffRounds += payload.rollOff.length;
      }
      continue;
    }
    if (event.type === "market.pass") {
      const payload = event.payload ?? {};
      const cardId = payload.cardId;
      const playerId = payload.playerId;
      if (typeof payload.passPot === "number") {
        passPotSum += payload.passPot;
      }
      if (cardId && playerId) {
        marketPassByPlayer[playerId] = marketPassByPlayer[playerId] ?? {};
        marketPassByPlayer[playerId][cardId] =
          (marketPassByPlayer[playerId][cardId] ?? 0) + 1;
      }
      if (Array.isArray(payload.rollOff)) {
        rollOffEvents += 1;
        rollOffRounds += payload.rollOff.length;
      }
      continue;
    }
    if (event.type === "combat.start") {
      combats.starts += 1;
      continue;
    }
    if (event.type === "combat.round") {
      combats.rounds += 1;
      continue;
    }
    if (event.type === "combat.end") {
      combats.ends += 1;
      continue;
    }
  }

  return {
    cardPlaysByPlayer,
    cardsPlayedSet,
    cardsPlayedByPlayerSet,
    marketBuysByPlayer,
    marketPassByPlayer,
    combats,
    actions,
    rollOffEvents,
    rollOffRounds,
    buyAmountSum,
    passPotSum
  };
};

const updateCardStats = (stats, cardId, updates) => {
  if (!stats.cards[cardId]) {
    stats.cards[cardId] = {
      plays: 0,
      playsByWinners: 0,
      gamesPlayed: 0,
      gamesWinnerPlayed: 0,
      marketBuys: 0,
      marketBuysByWinners: 0,
      marketPasses: 0,
      marketPassesByWinners: 0
    };
  }
  Object.assign(stats.cards[cardId], updates);
};

const updateMarketCardStats = (stats, cardId, updates) => {
  if (!stats.market.cards[cardId]) {
    stats.market.cards[cardId] = {
      buys: 0,
      passes: 0,
      buysByWinners: 0,
      passesByWinners: 0
    };
  }
  Object.assign(stats.market.cards[cardId], updates);
};

const finalizeStats = (stats) => {
  const roundsList = [...stats.totals.rounds.list].sort((a, b) => a - b);
  const stepsList = [...stats.totals.steps.list].sort((a, b) => a - b);
  const median = (list) => {
    if (!list.length) {
      return null;
    }
    const mid = Math.floor(list.length / 2);
    if (list.length % 2 === 0) {
      return (list[mid - 1] + list[mid]) / 2;
    }
    return list[mid];
  };

  stats.averages = {
    rounds: stats.totals.rounds.sum / Math.max(1, stats.totals.completed),
    roundsMedian: median(roundsList),
    steps: stats.totals.steps.sum / Math.max(1, stats.totals.completed),
    stepsMedian: median(stepsList),
    combatsPerGame: stats.totals.combats.starts / Math.max(1, stats.totals.completed),
    combatRoundsPerGame: stats.totals.combats.rounds / Math.max(1, stats.totals.completed),
    cardActionsPerGame: stats.totals.actions.cards / Math.max(1, stats.totals.completed),
    basicActionsPerGame: stats.totals.actions.basics / Math.max(1, stats.totals.completed),
    avgMarketBuyAmount: stats.market.buys > 0 ? stats.market.buyAmountSum / stats.market.buys : 0,
    avgMarketPassPot:
      stats.market.passes > 0 ? stats.market.passAmountSum / stats.market.passes : 0,
    avgMarketRollOffRounds:
      stats.market.rollOffs > 0 ? stats.market.rollOffRounds / stats.market.rollOffs : 0
  };

  for (const entry of Object.values(stats.factions)) {
    entry.winRate = entry.wins / Math.max(1, entry.games);
    entry.avgFinalGold = entry.goldSum / Math.max(1, entry.games);
    entry.avgFinalMana = entry.manaSum / Math.max(1, entry.games);
    entry.avgFinalVpTotal = entry.vpTotalSum / Math.max(1, entry.games);
  }

  for (const entry of Object.values(stats.seats)) {
    entry.winRate = entry.wins / Math.max(1, entry.games);
  }

  for (const [cardId, entry] of Object.entries(stats.cards)) {
    entry.playWinShare = entry.plays > 0 ? entry.playsByWinners / entry.plays : 0;
    entry.winRateWhenPlayed =
      entry.gamesPlayed > 0 ? entry.gamesWinnerPlayed / entry.gamesPlayed : 0;
    entry.buyWinShare =
      entry.marketBuys > 0 ? entry.marketBuysByWinners / entry.marketBuys : 0;
    entry.passWinShare =
      entry.marketPasses > 0 ? entry.marketPassesByWinners / entry.marketPasses : 0;
    stats.cards[cardId] = entry;
  }

  for (const [cardId, entry] of Object.entries(stats.market.cards)) {
    entry.buyWinShare = entry.buys > 0 ? entry.buysByWinners / entry.buys : 0;
    entry.passWinShare = entry.passes > 0 ? entry.passesByWinners / entry.passes : 0;
    stats.market.cards[cardId] = entry;
  }

  const economySummary = {};
  for (const [phase, rounds] of Object.entries(stats.economy.byPhaseRound)) {
    economySummary[phase] = {};
    for (const [round, entry] of Object.entries(rounds)) {
      economySummary[phase][round] = {
        samples: entry.samples,
        players: entry.players,
        avgGold: entry.players > 0 ? entry.goldSum / entry.players : 0,
        avgMana: entry.players > 0 ? entry.manaSum / entry.players : 0,
        avgVpTotal: entry.players > 0 ? entry.vpTotalSum / entry.players : 0,
        avgVpPermanent: entry.players > 0 ? entry.vpPermanentSum / entry.players : 0,
        avgVpControl: entry.players > 0 ? entry.vpControlSum / entry.players : 0,
        avgHand: entry.players > 0 ? entry.handSum / entry.players : 0,
        minGold: entry.goldMin ?? 0,
        maxGold: entry.goldMax ?? 0,
        minMana: entry.manaMin ?? 0,
        maxMana: entry.manaMax ?? 0,
        minVpTotal: entry.vpTotalMin ?? 0,
        maxVpTotal: entry.vpTotalMax ?? 0,
        minVpPermanent: entry.vpPermanentMin ?? 0,
        maxVpPermanent: entry.vpPermanentMax ?? 0,
        minVpControl: entry.vpControlMin ?? 0,
        maxVpControl: entry.vpControlMax ?? 0,
        minHand: entry.handMin ?? 0,
        maxHand: entry.handMax ?? 0
      };
    }
  }
  stats.economySummary = economySummary;

  return stats;
};

const simulateGame = (seed, playerCount, stats) => {
  const picker = createDecisionPicker(seed + 1337);
  let baseConfig = maxRoundsOverride
    ? { ...DEFAULT_CONFIG, ROUNDS_MAX: maxRoundsOverride }
    : DEFAULT_CONFIG;
  if (vpToWinOverride) {
    baseConfig = { ...baseConfig, VP_TO_WIN: vpToWinOverride };
  }
  const config = ensureStartingForcesByFaction(baseConfig);
  const lobbyPlayers = buildLobbyPlayers(playerCount, picker);

  let state = createNewGame(config, seed, lobbyPlayers);
  let steps = 0;
  let lastPhase = state.phase;
  let lastRound = state.round;
  recordEconomySnapshot(stats, state);

  let endedBy = "win";

  while (!state.winnerPlayerId) {
    if (steps >= maxSteps) {
      endedBy = "stepLimit";
      break;
    }
    const progressed = runUntilBlocked(state);
    state = progressed;
    if (!state.blocks) {
      if (state.winnerPlayerId) {
        break;
      }
      throw new Error(
        `expected a block while advancing game (phase=${state.phase}, round=${state.round})`
      );
    }
    if (state.phase !== lastPhase || state.round !== lastRound) {
      recordEconomySnapshot(stats, state);
      lastPhase = state.phase;
      lastRound = state.round;
    }

    const resolved = resolveBlockRandom(state, picker);
    if (resolved === state) {
      throw new Error("random resolution made no progress");
    }
    state = resolved;
    if (state.phase !== lastPhase || state.round !== lastRound) {
      recordEconomySnapshot(stats, state);
      lastPhase = state.phase;
      lastRound = state.round;
    }
    steps += 1;
  }

  if (!state.winnerPlayerId && endedBy !== "stepLimit") {
    endedBy = "roundLimit";
  }

  return { state, steps, endedBy, lobbyPlayers };
};

const stats = initStats();
const totalGames = gamesPerCount * playerCounts.length;
const startedAt = new Date().toISOString();

let gameIndex = 0;
for (const playerCount of playerCounts) {
  for (let i = 0; i < gamesPerCount; i += 1) {
    const seed = seedBase + gameIndex;
    const { state, steps, endedBy } = simulateGame(seed, playerCount, stats);

    const winnerId = state.winnerPlayerId;
    stats.totals.games += 1;
    stats.totals.completed += 1;
    if (winnerId) {
      stats.totals.wins += 1;
    } else {
      stats.totals.noWinner += 1;
    }
    if (endedBy === "roundLimit") {
      stats.totals.roundLimit += 1;
    } else if (endedBy === "stepLimit") {
      stats.totals.stepLimit += 1;
    }

    recordTotalsList(stats.totals.rounds, state.round);
    recordTotalsList(stats.totals.steps, steps);

    const {
      cardPlaysByPlayer,
      cardsPlayedSet,
      cardsPlayedByPlayerSet,
      marketBuysByPlayer,
      marketPassByPlayer,
      combats,
      actions,
      rollOffEvents,
      rollOffRounds,
      buyAmountSum,
      passPotSum
    } = parseGameLogs(state);

    stats.totals.combats.starts += combats.starts;
    stats.totals.combats.rounds += combats.rounds;
    stats.totals.combats.ends += combats.ends;
    stats.totals.actions.cards += actions.cards;
    stats.totals.actions.basics += actions.basics;
    stats.totals.actions.done += actions.done;
    stats.market.rollOffs += rollOffEvents;
    stats.market.rollOffRounds += rollOffRounds;
    stats.market.buyAmountSum += buyAmountSum;
    stats.market.passAmountSum += passPotSum;

    for (const cardId of cardsPlayedSet) {
      updateCardStats(stats, cardId, {
        gamesPlayed: (stats.cards[cardId]?.gamesPlayed ?? 0) + 1
      });
    }

    for (const player of state.players) {
      const factionId = player.factionId ?? "unassigned";
      if (!stats.factions[factionId]) {
        stats.factions[factionId] = {
          games: 0,
          wins: 0,
          goldSum: 0,
          manaSum: 0,
          vpTotalSum: 0
        };
      }
      stats.factions[factionId].games += 1;
      stats.factions[factionId].goldSum += player.resources.gold;
      stats.factions[factionId].manaSum += player.resources.mana;
      stats.factions[factionId].vpTotalSum += player.vp.total;

      if (!stats.seats[player.seatIndex]) {
        stats.seats[player.seatIndex] = { games: 0, wins: 0 };
      }
      stats.seats[player.seatIndex].games += 1;

      if (player.id === winnerId) {
        stats.factions[factionId].wins += 1;
        stats.seats[player.seatIndex].wins += 1;
      }
    }

    for (const [playerId, plays] of Object.entries(cardPlaysByPlayer)) {
      for (const [cardId, count] of Object.entries(plays)) {
        updateCardStats(stats, cardId, {
          plays: (stats.cards[cardId]?.plays ?? 0) + count,
          playsByWinners:
            (stats.cards[cardId]?.playsByWinners ?? 0) + (playerId === winnerId ? count : 0)
        });
      }
    }

    for (const [playerId, cards] of Object.entries(cardsPlayedByPlayerSet)) {
      if (playerId !== winnerId) {
        continue;
      }
      for (const cardId of cards) {
        updateCardStats(stats, cardId, {
          gamesWinnerPlayed: (stats.cards[cardId]?.gamesWinnerPlayed ?? 0) + 1
        });
      }
    }

    for (const [playerId, buys] of Object.entries(marketBuysByPlayer)) {
      for (const [cardId, count] of Object.entries(buys)) {
        stats.market.buys += count;
        updateCardStats(stats, cardId, {
          marketBuys: (stats.cards[cardId]?.marketBuys ?? 0) + count,
          marketBuysByWinners:
            (stats.cards[cardId]?.marketBuysByWinners ?? 0) +
            (playerId === winnerId ? count : 0)
        });
        updateMarketCardStats(stats, cardId, {
          buys: (stats.market.cards[cardId]?.buys ?? 0) + count,
          buysByWinners:
            (stats.market.cards[cardId]?.buysByWinners ?? 0) +
            (playerId === winnerId ? count : 0)
        });
      }
    }

    for (const [playerId, passes] of Object.entries(marketPassByPlayer)) {
      for (const [cardId, count] of Object.entries(passes)) {
        stats.market.passes += count;
        updateCardStats(stats, cardId, {
          marketPasses: (stats.cards[cardId]?.marketPasses ?? 0) + count,
          marketPassesByWinners:
            (stats.cards[cardId]?.marketPassesByWinners ?? 0) +
            (playerId === winnerId ? count : 0)
        });
        updateMarketCardStats(stats, cardId, {
          passes: (stats.market.cards[cardId]?.passes ?? 0) + count,
          passesByWinners:
            (stats.market.cards[cardId]?.passesByWinners ?? 0) +
            (playerId === winnerId ? count : 0)
        });
      }
    }

    if (includeGames) {
      stats.games.push({
        seed,
        playerCount,
        rounds: state.round,
        steps,
        endedBy,
        winnerId,
        winnerFaction:
          state.players.find((player) => player.id === winnerId)?.factionId ?? null
      });
    }

    gameIndex += 1;
    if (gameIndex % logEvery === 0 || gameIndex === totalGames) {
      console.log(
        `Simulated ${gameIndex}/${totalGames} games (last: ${playerCount}p, rounds=${state.round}, steps=${steps})`
      );
    }
  }
}

stats.meta.startedAt = startedAt;
stats.meta.finishedAt = new Date().toISOString();

finalizeStats(stats);

fs.writeFileSync(outFile, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
fs.writeFileSync(reportFile, buildSummaryReport(stats), "utf8");
if (cardsCsvFile) {
  writeCardsCsv(stats, cardsCsvFile);
}

console.log(`Balance sim complete. Wrote ${outFile}`);
console.log(`Summary report: ${reportFile}`);
if (cardsCsvFile) {
  console.log(`Cards CSV: ${cardsCsvFile}`);
}
