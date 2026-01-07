#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_OUT_DIR = path.join(process.cwd(), "apps/web/public/card-art");
const DEFAULT_MANIFEST = path.join(process.cwd(), "apps/web/src/data/card-art.json");
const DEFAULT_CARDS_DIR = path.join(process.cwd(), "packages/engine/src/content/cards");
const DEFAULT_PROMPT_PREFIX =
  "Epic fantasy strategy card art, painterly, cinematic lighting, high detail, dramatic composition, no text, no border, no watermark.";
const DEFAULT_NEGATIVE_PROMPT = "text, watermark, logo, frame, border, UI, caption";
const DEFAULT_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const DEFAULT_SIZE = "1024x1024";

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

const parseSize = (value) => {
  if (!value) {
    return { width: 1024, height: 1024 };
  }
  const match = String(value).match(/^(\d+)x(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid --size '${value}'. Expected like 1024x1024.`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), t | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const sanitizeFileName = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw);
};

const writeJsonFile = (filePath, data) => {
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([left], [right]) => left.localeCompare(right))
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
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
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
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

const parseCardBlock = (block, sourceFile) => {
  const id = matchString(block, "id");
  const name = matchString(block, "name");
  const rulesText = matchString(block, "rulesText");
  const type = matchString(block, "type");
  const deck = matchString(block, "deck");
  const factionId = matchString(block, "factionId");
  const tags = matchStringList(block, "tags");

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    rulesText: rulesText || "",
    type: type || "",
    deck: deck || "",
    tags,
    factionId: factionId || "",
    sourceFile
  };
};

const matchString = (block, key) => {
  const regex = new RegExp(`${key}\\s*:\\s*(["'])([\\s\\S]*?)\\1`);
  const match = block.match(regex);
  if (!match) {
    return null;
  }
  const value = match[2];
  return value.replace(/\\n/g, "\n");
};

const matchStringList = (block, key) => {
  const regex = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = block.match(regex);
  if (!match) {
    return [];
  }
  const raw = match[1];
  const items = [];
  const itemRegex = /["']([^"']+)["']/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(raw))) {
    items.push(itemMatch[1]);
  }
  return items;
};

const buildPrompt = (card, options) => {
  const prefix = options.promptPrefix || DEFAULT_PROMPT_PREFIX;
  const suffix = options.promptSuffix || "";
  const parts = [prefix];
  parts.push(`Card name: ${card.name}.`);
  if (card.type) {
    parts.push(`${card.type} card.`);
  }
  if (card.rulesText) {
    parts.push(`Ability: ${card.rulesText}`);
  }
  if (card.factionId) {
    parts.push(`Faction: ${card.factionId}.`);
  }
  if (suffix) {
    parts.push(suffix);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const generateImageCloudflare = async (options) => {
  if (typeof fetch !== "function") {
    throw new Error("This script requires Node 18+ for fetch support.");
  }
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Missing CF_ACCOUNT_ID or CF_API_TOKEN environment variables.");
  }
  const model = process.env.CF_IMAGE_MODEL || DEFAULT_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const body = {
    prompt: options.prompt,
    negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    width: options.width,
    height: options.height
  };
  if (typeof options.seed === "number") {
    body.seed = options.seed;
  }
  if (typeof options.steps === "number") {
    body.num_steps = options.steps;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Cloudflare AI error: ${response.status} ${JSON.stringify(payload)}`);
  }
  const result = payload && payload.result ? payload.result : payload;
  const image = result && result.image ? result.image : result;
  if (!image) {
    throw new Error("Cloudflare AI response did not include image data.");
  }
  if (typeof image === "string") {
    const base64 = image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    return Buffer.from(base64, "base64");
  }
  if (Array.isArray(image)) {
    return Buffer.from(image);
  }
  throw new Error("Unsupported Cloudflare AI image payload format.");
};

const generateImageMock = async () => {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  return Buffer.from(base64, "base64");
};

const pickRandomSubset = (items, count, seed) => {
  if (count >= items.length) {
    return items.slice();
  }
  const random = Number.isFinite(seed) ? mulberry32(Number(seed)) : Math.random;
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
};

const formatCardLine = (card) => {
  const deck = card.deck ? `(${card.deck})` : "";
  return `${card.id} ${deck} - ${card.name}`.trim();
};

const printUsage = () => {
  console.log(`\nUsage: node scripts/generate-card-art.js [options]\n\nOptions:\n  --cards <id1,id2>     Comma-separated card ids to generate\n  --deck <deck>         Filter by deck (starter, age1, age2, age3, power)\n  --tag <tag>           Filter by tag (repeatable via comma)\n  --faction <id>        Filter by factionId\n  --count <n>           Randomly select N cards from the filtered list\n  --seed <n>            Seed for random selection and image generation\n  --provider <name>     cloudflare | mock (default: cloudflare)\n  --cards-dir <path>    Override the card defs directory\n  --out-dir <path>      Output directory for images\n  --manifest <path>     Manifest json path\n  --size <WxH>          Image size, e.g. 1024x1024 (default: 1024x1024)\n  --steps <n>           Diffusion steps (provider-specific)\n  --prompt-prefix <txt> Override the default prompt prefix\n  --prompt-suffix <txt> Extra prompt suffix to append\n  --negative-prompt <t> Negative prompt override\n  --force               Overwrite existing images\n  --dry-run             Print prompts without generating\n  --list                List available cards\n  --help                Show help\n`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const cardsDir = args["cards-dir"] ? path.resolve(args["cards-dir"]) : DEFAULT_CARDS_DIR;
  const outDir = args["out-dir"] ? path.resolve(args["out-dir"]) : DEFAULT_OUT_DIR;
  const manifestPath = args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST;
  const provider = args.provider || "cloudflare";
  const deckFilter = args.deck ? String(args.deck) : null;
  const tagFilter = args.tag ? String(args.tag).split(",").map((tag) => tag.trim()) : [];
  const factionFilter = args.faction ? String(args.faction) : null;
  const count = args.count ? Number(args.count) : null;
  const seed = args.seed ? Number(args.seed) : null;
  const force = Boolean(args.force);
  const dryRun = Boolean(args["dry-run"]);
  const listOnly = Boolean(args.list);
  const promptPrefix = args["prompt-prefix"] ? String(args["prompt-prefix"]) : "";
  const promptSuffix = args["prompt-suffix"] ? String(args["prompt-suffix"]) : "";
  const negativePrompt = args["negative-prompt"] ? String(args["negative-prompt"]) : "";
  const steps = args.steps ? Number(args.steps) : null;
  const { width, height } = parseSize(args.size || DEFAULT_SIZE);

  const cards = parseCardFiles(cardsDir);
  if (cards.length === 0) {
    throw new Error(`No card definitions found in ${cardsDir}.`);
  }

  if (listOnly) {
    cards.forEach((card) => console.log(formatCardLine(card)));
    return;
  }

  let selection = cards.slice();
  if (deckFilter) {
    selection = selection.filter((card) => card.deck === deckFilter);
  }
  if (tagFilter.length > 0) {
    selection = selection.filter((card) => tagFilter.every((tag) => card.tags.includes(tag)));
  }
  if (factionFilter) {
    selection = selection.filter((card) => card.factionId === factionFilter);
  }
  if (args.cards) {
    const cardIds = String(args.cards)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const selectionMap = new Map(selection.map((card) => [card.id, card]));
    const requested = [];
    for (const id of cardIds) {
      const card = selectionMap.get(id) || cards.find((item) => item.id === id);
      if (!card) {
        console.warn(`Unknown card id: ${id}`);
        continue;
      }
      requested.push(card);
    }
    selection = requested;
  }

  if (typeof count === "number" && Number.isFinite(count)) {
    selection = pickRandomSubset(selection, count, seed);
  }

  if (selection.length === 0) {
    console.log("No cards matched the selection filters.");
    return;
  }

  console.log(`Selected ${selection.length} card(s).`);
  selection.forEach((card) => console.log(`- ${formatCardLine(card)}`));

  if (dryRun) {
    console.log("\nDry run prompts:\n");
    selection.forEach((card) => {
      const prompt = buildPrompt(card, { promptPrefix, promptSuffix });
      console.log(`${card.id}: ${prompt}`);
    });
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJsonFile(manifestPath);
  const generateImage =
    provider === "mock"
      ? generateImageMock
      : provider === "cloudflare"
        ? generateImageCloudflare
        : null;

  if (!generateImage) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  for (const card of selection) {
    const prompt = buildPrompt(card, { promptPrefix, promptSuffix });
    const fileName = `${sanitizeFileName(card.id)}.png`;
    const outputPath = path.join(outDir, fileName);

    if (!force && fs.existsSync(outputPath)) {
      console.log(`Skipping ${card.id}, image already exists.`);
      manifest[card.id] = fileName;
      continue;
    }

    console.log(`Generating art for ${card.id}...`);
    const buffer = await generateImage({
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      seed
    });
    fs.writeFileSync(outputPath, buffer);
    manifest[card.id] = fileName;
  }

  writeJsonFile(manifestPath, manifest);
  console.log(`\nUpdated manifest: ${manifestPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
