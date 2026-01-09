import type { CardPlayTargets } from "./types";

export type TargetRecord = Record<string, unknown>;

export const getTargetRecord = (targets: CardPlayTargets): TargetRecord | null => {
  if (!targets || typeof targets !== "object") {
    return null;
  }
  return targets as TargetRecord;
};

export const getForceCountTarget = (targets: CardPlayTargets): number | null => {
  const record = getTargetRecord(targets);
  const forceCount = record?.forceCount;
  return typeof forceCount === "number" && Number.isFinite(forceCount) ? forceCount : null;
};

export const getBooleanTarget = (targets: CardPlayTargets, key: string): boolean | null => {
  const record = getTargetRecord(targets);
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
};

export const getEdgeKeyTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const edgeKey = record?.edgeKey;
  return typeof edgeKey === "string" && edgeKey.length > 0 ? edgeKey : null;
};

export const getEdgeKeyTargets = (targets: CardPlayTargets): string[] | null => {
  const record = getTargetRecord(targets);
  const raw = record?.edgeKeys ?? record?.edges ?? record?.edgeKey;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return raw.length > 0 ? [raw] : null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const edges: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.length === 0) {
      return null;
    }
    edges.push(entry);
  }
  return edges;
};

export const getHexKeyTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const hexKey = record?.hexKey;
  return typeof hexKey === "string" && hexKey.length > 0 ? hexKey : null;
};

const getPathTarget = (targets: CardPlayTargets): string[] | null => {
  const record = getTargetRecord(targets);
  const path = record?.path;
  if (!Array.isArray(path) || path.length < 2) {
    return null;
  }
  if (!path.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return path;
};

const getStackTarget = (targets: CardPlayTargets): { from: string; to: string } | null => {
  const record = getTargetRecord(targets);
  const from = record?.from;
  const to = record?.to;
  if (typeof from !== "string" || typeof to !== "string") {
    return null;
  }
  if (from.length === 0 || to.length === 0) {
    return null;
  }
  return { from, to };
};

export const getMovePathTarget = (targets: CardPlayTargets): string[] | null => {
  const path = getPathTarget(targets);
  if (path) {
    return path;
  }
  const stack = getStackTarget(targets);
  if (!stack) {
    return null;
  }
  return [stack.from, stack.to];
};

const normalizePath = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  if (!value.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return value as string[];
};

export const getMultiPathTargets = (targets: CardPlayTargets): string[][] | null => {
  const record = getTargetRecord(targets);
  const raw = record?.paths ?? record?.path;
  if (!raw) {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  if (raw.every((entry) => typeof entry === "string")) {
    const single = normalizePath(raw);
    return single ? [single] : null;
  }
  const paths: string[][] = [];
  for (const entry of raw) {
    const path = normalizePath(entry);
    if (!path) {
      return null;
    }
    paths.push(path);
  }
  return paths.length > 0 ? paths : null;
};

export const getChoiceTarget = (
  targets: CardPlayTargets
):
  | { kind: "capital"; hexKey?: string }
  | { kind: "occupiedHex"; hexKey: string }
  | null => {
  const record = getTargetRecord(targets);
  const choice = record?.choice ?? record?.kind;
  if (choice === "capital") {
    const hexKey = record?.hexKey;
    if (typeof hexKey === "string" && hexKey.length > 0) {
      return { kind: "capital", hexKey };
    }
    return { kind: "capital" };
  }
  if (choice === "occupiedHex") {
    const hexKey = record?.hexKey;
    if (typeof hexKey !== "string" || hexKey.length === 0) {
      return null;
    }
    return { kind: "occupiedHex", hexKey };
  }
  return null;
};

export const getChampionTargetId = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const unitId = record?.unitId ?? record?.championId;
  return typeof unitId === "string" && unitId.length > 0 ? unitId : null;
};

export const getCardInstanceTargets = (targets: CardPlayTargets): string[] => {
  const record = getTargetRecord(targets);
  const ids = record?.cardInstanceIds;
  if (Array.isArray(ids)) {
    return ids.filter((entry) => typeof entry === "string" && entry.length > 0);
  }
  const id = record?.cardInstanceId;
  return typeof id === "string" && id.length > 0 ? [id] : [];
};

export const getPlayerIdTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const playerId = record?.playerId ?? record?.targetPlayerId;
  return typeof playerId === "string" && playerId.length > 0 ? playerId : null;
};
