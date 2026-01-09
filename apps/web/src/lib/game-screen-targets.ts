import type { BasicAction, CardDef, GameView } from "@bridgefront/engine";
import { parseEdgeKey, parseHexKey } from "@bridgefront/shared";

export type CardDefsById = Map<string, CardDef>;

export type CardRevealTargetInfo = {
  targetLines: string[];
  targetHexKeys: string[];
  targetEdgeKeys: string[];
};

export const parseTargets = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
};

export const buildHexLabels = (hexKeys: string[]): Record<string, string> => {
  const rows = new Map<number, Array<{ key: string; q: number }>>();
  for (const key of hexKeys) {
    try {
      const { q, r } = parseHexKey(key);
      const row = rows.get(r) ?? [];
      row.push({ key, q });
      rows.set(r, row);
    } catch {
      continue;
    }
  }
  const sortedRows = Array.from(rows.entries()).sort(([a], [b]) => a - b);
  const labels: Record<string, string> = {};
  sortedRows.forEach(([, rowHexes], rowIndex) => {
    const rowLabel = rowIndex < 26 ? String.fromCharCode(65 + rowIndex) : `R${rowIndex + 1}`;
    rowHexes.sort((a, b) => a.q - b.q);
    rowHexes.forEach((entry, colIndex) => {
      labels[entry.key] = `${rowLabel}${colIndex + 1}`;
    });
  });
  return labels;
};

export const formatHexLabel = (hexKey: string, labels: Record<string, string>): string => {
  return labels[hexKey] ?? hexKey;
};

export const formatEdgeLabel = (edgeKey: string, labels: Record<string, string>): string => {
  try {
    const [a, b] = parseEdgeKey(edgeKey);
    return `${formatHexLabel(a, labels)}-${formatHexLabel(b, labels)}`;
  } catch {
    return edgeKey;
  }
};

const getChampionGlyph = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  const glyph = initials.replace(/[^A-Z]/g, "").slice(0, 2);
  if (glyph) {
    return glyph;
  }
  const fallback = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return fallback || "C";
};

export const formatTileLabel = (tile: string | null | undefined): string | null => {
  switch (tile) {
    case "capital":
      return "Capital";
    case "forge":
      return "Forge";
    case "mine":
      return "Mine";
    case "center":
      return "Center";
    default:
      return null;
  }
};

export const getTargetString = (
  record: Record<string, unknown> | null,
  key: string
): string | null => {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const getTargetNumber = (
  record: Record<string, unknown> | null,
  key: string
): number | null => {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const getTargetBoolean = (
  record: Record<string, unknown> | null,
  key: string
): boolean | null => {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "boolean" ? value : null;
};

export const getTargetStringArray = (
  record: Record<string, unknown> | null,
  key: string
): string[] => {
  if (!record) {
    return [];
  }
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string" && entry.length > 0);
};

export const buildEdgeTargetPayload = (
  record: Record<string, unknown> | null
): Record<string, unknown> | null => {
  const edgeKeys = getTargetStringArray(record, "edgeKeys");
  if (edgeKeys.length > 0) {
    return { edgeKeys };
  }
  const edgeKey = getTargetString(record, "edgeKey");
  if (edgeKey) {
    return { edgeKey };
  }
  return null;
};

const normalizePathTarget = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const path = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );
  return path.length >= 2 ? path : null;
};

export const getTargetPaths = (record: Record<string, unknown> | null): string[][] => {
  if (!record) {
    return [];
  }
  const paths: string[][] = [];
  const seen = new Set<string>();
  const pushPath = (path: string[]) => {
    const key = path.join("|");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    paths.push(path);
  };
  const raw = record.paths ?? record.path;
  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every((entry) => typeof entry === "string")) {
      const normalized = normalizePathTarget(raw);
      if (normalized) {
        pushPath(normalized);
      }
    } else {
      raw.forEach((entry) => {
        const normalized = normalizePathTarget(entry);
        if (normalized) {
          pushPath(normalized);
        }
      });
    }
  }
  const from = getTargetString(record, "from");
  const to = getTargetString(record, "to");
  if (paths.length === 0 && from && to) {
    pushPath([from, to]);
  }
  return paths;
};

export const resolveMoveUnitMeta = (
  record: Record<string, unknown> | null,
  board: GameView["public"]["board"],
  cardDefsById: CardDefsById
): { unitKind: "force" | "champion" | null; unitLabel: string | null } => {
  if (!record) {
    return { unitKind: null, unitLabel: null };
  }
  const unitId = getTargetString(record, "unitId") ?? getTargetString(record, "championId");
  if (unitId) {
    const unit = board.units[unitId];
    if (unit?.kind === "champion") {
      const name = cardDefsById.get(unit.cardDefId)?.name ?? unit.cardDefId;
      return { unitKind: "champion", unitLabel: getChampionGlyph(name) };
    }
    return { unitKind: "force", unitLabel: null };
  }
  const forceCount = getTargetNumber(record, "forceCount");
  if (forceCount !== null) {
    const includeChampions = getTargetBoolean(record, "includeChampions") ?? false;
    if (forceCount === 0 && includeChampions) {
      return { unitKind: "champion", unitLabel: "C" };
    }
    return {
      unitKind: includeChampions ? "champion" : "force",
      unitLabel: String(forceCount)
    };
  }
  return { unitKind: null, unitLabel: null };
};

export const getTargetCardInstanceIds = (record: Record<string, unknown> | null): string[] => {
  if (!record) {
    return [];
  }
  const ids = record.cardInstanceIds;
  if (Array.isArray(ids)) {
    return ids.filter((entry) => typeof entry === "string" && entry.length > 0);
  }
  const id = record.cardInstanceId;
  return typeof id === "string" && id.length > 0 ? [id] : [];
};

export const describeRevealTargets = (
  targets: Record<string, unknown> | null,
  board: GameView["public"]["board"],
  labels: Record<string, string>,
  cardDefsById: CardDefsById
): CardRevealTargetInfo => {
  if (!targets) {
    return { targetLines: [], targetHexKeys: [], targetEdgeKeys: [] };
  }

  const lines: string[] = [];
  const lineSet = new Set<string>();
  const hexKeys = new Set<string>();
  const edgeKeys = new Set<string>();

  const pushLine = (line: string) => {
    if (lineSet.has(line)) {
      return;
    }
    lineSet.add(line);
    lines.push(line);
  };
  const addHex = (hexKey: string | null) => {
    if (hexKey) {
      hexKeys.add(hexKey);
    }
  };
  const addEdge = (edgeKey: string | null) => {
    if (edgeKey) {
      edgeKeys.add(edgeKey);
    }
  };

  const edgeKeyList = getTargetStringArray(targets, "edgeKeys");
  if (edgeKeyList.length > 0) {
    edgeKeyList.forEach(addEdge);
    const edgeLabels = edgeKeyList.map((edgeKey) => formatEdgeLabel(edgeKey, labels));
    pushLine(
      edgeLabels.length === 1 ? `Edge ${edgeLabels[0]}` : `Edges ${edgeLabels.join(", ")}`
    );
  } else {
    const edgeKey = getTargetString(targets, "edgeKey");
    if (edgeKey) {
      addEdge(edgeKey);
      pushLine(`Edge ${formatEdgeLabel(edgeKey, labels)}`);
    }
  }

  const hexKeyList = getTargetStringArray(targets, "hexKeys");
  if (hexKeyList.length > 0) {
    hexKeyList.forEach(addHex);
    const hexLabels = hexKeyList.map((hex) => formatHexLabel(hex, labels));
    pushLine(
      hexLabels.length === 1 ? `Hex ${hexLabels[0]}` : `Hexes ${hexLabels.join(", ")}`
    );
  } else {
    const hexKey = getTargetString(targets, "hexKey");
    if (hexKey) {
      addHex(hexKey);
      pushLine(`Hex ${formatHexLabel(hexKey, labels)}`);
    }
  }

  const path = targets.path;
  if (Array.isArray(path)) {
    const filtered = path.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0
    );
    if (filtered.length > 0) {
      filtered.forEach(addHex);
      const labeledPath = filtered.map((hex) => formatHexLabel(hex, labels));
      pushLine(`Path ${labeledPath.join(" → ")}`);
    }
  }

  const from = getTargetString(targets, "from");
  const to = getTargetString(targets, "to");
  if (from && to) {
    addHex(from);
    addHex(to);
    pushLine(`Move ${formatHexLabel(from, labels)} → ${formatHexLabel(to, labels)}`);
  }

  const choice = getTargetString(targets, "choice") ?? getTargetString(targets, "kind");
  if (choice === "capital") {
    pushLine("Choice: Capital");
  } else if (choice === "occupiedHex") {
    const occupiedHex = getTargetString(targets, "hexKey");
    addHex(occupiedHex);
    pushLine(
      occupiedHex
        ? `Choice: Occupied ${formatHexLabel(occupiedHex, labels)}`
        : "Choice: Occupied hex"
    );
  }

  const unitId = getTargetString(targets, "unitId") ?? getTargetString(targets, "championId");
  if (unitId) {
    const unit = board.units[unitId];
    const unitName = unit
      ? cardDefsById.get(unit.cardDefId)?.name ?? unit.cardDefId
      : null;
    if (unit?.hex) {
      addHex(unit.hex);
    }
    pushLine(
      unit?.hex
        ? `Champion ${unitName ?? unitId} @ ${formatHexLabel(unit.hex, labels)}`
        : `Champion ${unitName ?? unitId}`
    );
  }

  return {
    targetLines: lines,
    targetHexKeys: Array.from(hexKeys),
    targetEdgeKeys: Array.from(edgeKeys)
  };
};

export const describeBasicAction = (
  action: BasicAction,
  labels: Record<string, string>
): { label: string; targets: CardRevealTargetInfo } => {
  switch (action.kind) {
    case "buildBridge": {
      let edgeLabel = action.edgeKey;
      const targetHexKeys: string[] = [];
      try {
        const [a, b] = parseEdgeKey(action.edgeKey);
        targetHexKeys.push(a, b);
        edgeLabel = `${formatHexLabel(a, labels)}-${formatHexLabel(b, labels)}`;
      } catch {
        // Fall back to raw edge key if parsing fails.
      }
      return {
        label: "Build Bridge",
        targets: {
          targetLines: [`Edge ${edgeLabel}`],
          targetHexKeys,
          targetEdgeKeys: [action.edgeKey]
        }
      };
    }
    case "march": {
      const fromLabel = formatHexLabel(action.from, labels);
      const toLabel = formatHexLabel(action.to, labels);
      const lines = [`From ${fromLabel} to ${toLabel}`];
      if (typeof action.forceCount === "number") {
        lines.push(`Forces: ${action.forceCount}`);
      }
      if (typeof action.includeChampions === "boolean") {
        lines.push(`Champions: ${action.includeChampions ? "Move" : "Hold"}`);
      }
      return {
        label: "March",
        targets: {
          targetLines: lines,
          targetHexKeys: [action.from, action.to],
          targetEdgeKeys: []
        }
      };
    }
    case "capitalReinforce": {
      const hexKey = action.hexKey;
      const label = hexKey ? formatHexLabel(hexKey, labels) : "Capital";
      return {
        label: "Reinforce",
        targets: {
          targetLines: [hexKey ? `Reinforce ${label}` : "Reinforce capital"],
          targetHexKeys: hexKey ? [hexKey] : [],
          targetEdgeKeys: []
        }
      };
    }
    default: {
      const _exhaustive: never = action;
      return {
        label: "Action",
        targets: { targetLines: [], targetHexKeys: [], targetEdgeKeys: [] }
      };
    }
  }
};
