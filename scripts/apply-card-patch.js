#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);
const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1];
};

const usage = () => {
  console.log("Usage: node scripts/apply-card-patch.js --patch <file> [--write]");
  console.log("Options:");
  console.log("  --patch <file>   Path to Card Editor JSON patch export");
  console.log("  --write          Write changes to disk (default is dry-run)");
  console.log("  --cards-dir <dir> Override cards directory (default engine cards dir)");
};

const patchPath = getArgValue("--patch") || getArgValue("-p");
const write = hasFlag("--write");
const cardsDir =
  getArgValue("--cards-dir") ||
  path.join(__dirname, "..", "packages", "engine", "src", "content", "cards");

if (!patchPath) {
  usage();
  process.exit(1);
}

if (!fs.existsSync(patchPath)) {
  console.error(`Patch file not found: ${patchPath}`);
  process.exit(1);
}

if (!fs.existsSync(cardsDir)) {
  console.error(`Cards directory not found: ${cardsDir}`);
  process.exit(1);
}

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const patch = readJson(patchPath);
const edits = Array.isArray(patch.edits) ? patch.edits : [];
const clones = Array.isArray(patch.clones) ? patch.clones : [];

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const numberText = (value) => String(value);
const arrayText = (value) => `[${value.join(", ")}]`;

const findPropertyAssignment = (objectLiteral, name) => {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    const propName = prop.name;
    if (ts.isIdentifier(propName) && propName.text === name) {
      return prop;
    }
    if (ts.isStringLiteral(propName) && propName.text === name) {
      return prop;
    }
  }
  return null;
};

const buildInsertText = (source, sourceFile, objectLiteral, propertyText) => {
  const objStart = objectLiteral.getStart(sourceFile);
  const objEnd = objectLiteral.getEnd();
  const closeBracePos = objEnd - 1;
  const objectText = source.slice(objStart, objEnd);
  const isMultiline = objectText.includes("\n");
  const hasTrailingComma = Boolean(objectLiteral.properties.hasTrailingComma);

  if (objectLiteral.properties.length === 0) {
    return {
      start: objStart + 1,
      end: objStart + 1,
      text: ` ${propertyText} `
    };
  }

  if (isMultiline) {
    const anchorProp = objectLiteral.properties[0];
    const lineStart = source.lastIndexOf("\n", anchorProp.getStart(sourceFile)) + 1;
    const indent = source.slice(lineStart, anchorProp.getStart(sourceFile));
    const prefix = hasTrailingComma ? "" : ",";
    return {
      start: closeBracePos,
      end: closeBracePos,
      text: `${prefix}\n${indent}${propertyText}`
    };
  }

  const prefix = hasTrailingComma ? " " : ", ";
  return {
    start: closeBracePos,
    end: closeBracePos,
    text: `${prefix}${propertyText}`
  };
};

const queueSetProperty = (replacements, source, sourceFile, objectLiteral, name, valueText) => {
  const prop = findPropertyAssignment(objectLiteral, name);
  if (prop && prop.initializer) {
    replacements.push({
      start: prop.initializer.getStart(sourceFile),
      end: prop.initializer.getEnd(),
      text: valueText
    });
    return;
  }
  replacements.push(
    buildInsertText(source, sourceFile, objectLiteral, `${name}: ${valueText}`)
  );
};

const applyReplacements = (source, replacements) => {
  const sorted = [...replacements].sort((a, b) => b.start - a.start);
  let nextSource = source;
  for (const replacement of sorted) {
    nextSource =
      nextSource.slice(0, replacement.start) +
      replacement.text +
      nextSource.slice(replacement.end);
  }
  return nextSource;
};

const buildCardIndex = (sourceFile) => {
  const cards = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isObjectLiteralExpression(node.initializer)) {
        const idProp = findPropertyAssignment(node.initializer, "id");
        if (idProp && ts.isStringLiteral(idProp.initializer)) {
          cards.set(idProp.initializer.text, node.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return cards;
};

const cardFiles = fs
  .readdirSync(cardsDir)
  .filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      file !== "index.ts" &&
      file !== "types.ts"
  )
  .map((file) => path.join(cardsDir, file));

const editsById = new Map();
for (const entry of edits) {
  if (!entry || typeof entry.id !== "string") {
    continue;
  }
  editsById.set(entry.id, entry.changes || {});
}

const missingIds = new Set(editsById.keys());
const warnings = [];
const touchedFiles = [];
let appliedEdits = 0;

for (const filePath of cardFiles) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const cardIndex = buildCardIndex(sourceFile);
  const replacements = [];

  for (const [id, changes] of editsById.entries()) {
    const cardLiteral = cardIndex.get(id);
    if (!cardLiteral) {
      continue;
    }
    missingIds.delete(id);

    if (changes.initiative !== undefined) {
      if (isNumber(changes.initiative)) {
        queueSetProperty(
          replacements,
          source,
          sourceFile,
          cardLiteral,
          "initiative",
          numberText(changes.initiative)
        );
      } else {
        warnings.push(`${id}: invalid initiative value`);
      }
    }

    if (changes.victoryPoints !== undefined) {
      if (isNumber(changes.victoryPoints)) {
        queueSetProperty(
          replacements,
          source,
          sourceFile,
          cardLiteral,
          "victoryPoints",
          numberText(changes.victoryPoints)
        );
      } else {
        warnings.push(`${id}: invalid victoryPoints value`);
      }
    }

    if (changes.cost) {
      const costProp = findPropertyAssignment(cardLiteral, "cost");
      if (costProp && ts.isObjectLiteralExpression(costProp.initializer)) {
        if (changes.cost.mana !== undefined) {
          if (isNumber(changes.cost.mana)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              costProp.initializer,
              "mana",
              numberText(changes.cost.mana)
            );
          } else {
            warnings.push(`${id}: invalid cost.mana value`);
          }
        }
        if (changes.cost.gold !== undefined) {
          if (isNumber(changes.cost.gold)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              costProp.initializer,
              "gold",
              numberText(changes.cost.gold)
            );
          } else {
            warnings.push(`${id}: invalid cost.gold value`);
          }
        }
      } else {
        warnings.push(`${id}: cost object not found`);
      }
    }

    if (changes.champion) {
      const champProp = findPropertyAssignment(cardLiteral, "champion");
      if (champProp && ts.isObjectLiteralExpression(champProp.initializer)) {
        const champObj = champProp.initializer;
        if (changes.champion.hp !== undefined) {
          if (isNumber(changes.champion.hp)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              champObj,
              "hp",
              numberText(changes.champion.hp)
            );
          } else {
            warnings.push(`${id}: invalid champion.hp value`);
          }
        }
        if (changes.champion.attackDice !== undefined) {
          if (isNumber(changes.champion.attackDice)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              champObj,
              "attackDice",
              numberText(changes.champion.attackDice)
            );
          } else {
            warnings.push(`${id}: invalid champion.attackDice value`);
          }
        }
        if (changes.champion.hitFaces !== undefined) {
          if (isNumber(changes.champion.hitFaces)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              champObj,
              "hitFaces",
              numberText(changes.champion.hitFaces)
            );
          } else {
            warnings.push(`${id}: invalid champion.hitFaces value`);
          }
        }
        if (changes.champion.bounty !== undefined) {
          if (isNumber(changes.champion.bounty)) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              champObj,
              "bounty",
              numberText(changes.champion.bounty)
            );
          } else {
            warnings.push(`${id}: invalid champion.bounty value`);
          }
        }
        if (changes.champion.goldCostByChampionCount !== undefined) {
          if (
            Array.isArray(changes.champion.goldCostByChampionCount) &&
            changes.champion.goldCostByChampionCount.every(isNumber)
          ) {
            queueSetProperty(
              replacements,
              source,
              sourceFile,
              champObj,
              "goldCostByChampionCount",
              arrayText(changes.champion.goldCostByChampionCount)
            );
          } else {
            warnings.push(`${id}: invalid champion.goldCostByChampionCount value`);
          }
        }
      } else {
        warnings.push(`${id}: champion object not found`);
      }
    }

    appliedEdits += 1;
  }

  if (replacements.length > 0) {
    const nextSource = applyReplacements(source, replacements);
    if (nextSource !== source) {
      touchedFiles.push(filePath);
      if (write) {
        fs.writeFileSync(filePath, nextSource);
      }
    }
  }
}

if (missingIds.size > 0) {
  warnings.push(`Missing card ids: ${Array.from(missingIds).join(", ")}`);
}

if (clones.length > 0) {
  warnings.push(
    `Patch includes ${clones.length} clone entries (not applied). Create these manually.`
  );
}

const modeLabel = write ? "write" : "dry-run";
console.log(
  `Card patch ${modeLabel}: ${appliedEdits} edits across ${touchedFiles.length} file(s).`
);
if (touchedFiles.length > 0) {
  console.log(`Touched files:\n- ${touchedFiles.join("\n- ")}`);
}
if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
