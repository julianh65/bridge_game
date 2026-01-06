export type AxialCoord = {
  q: number;
  r: number;
};

export type HexKey = string;
export type EdgeKey = string;

const DIRS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

const assertInteger = (value: number, label: string) => {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
};

export const toHexKey = (q: number, r: number): HexKey => {
  assertInteger(q, "q");
  assertInteger(r, "r");
  return `${q},${r}`;
};

export const parseHexKey = (key: HexKey): AxialCoord => {
  const parts = key.split(",");
  if (parts.length !== 2) {
    throw new Error("HexKey must be in the form q,r");
  }
  const q = Number(parts[0]);
  const r = Number(parts[1]);
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new Error("HexKey coordinates must be integers");
  }
  return { q, r };
};

export const addAxial = (a: AxialCoord, b: AxialCoord): AxialCoord => ({
  q: a.q + b.q,
  r: a.r + b.r
});

export const axialDistance = (a: AxialCoord, b: AxialCoord): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

export const areAdjacent = (a: AxialCoord, b: AxialCoord): boolean => {
  return axialDistance(a, b) === 1;
};

export const axialNeighbors = (coord: AxialCoord): AxialCoord[] => {
  return DIRS.map((dir) => addAxial(coord, dir));
};

export const neighborHexKeys = (key: HexKey): HexKey[] => {
  const coord = parseHexKey(key);
  return axialNeighbors(coord).map((neighbor) => toHexKey(neighbor.q, neighbor.r));
};

export const generateAxialCoords = (radius: number): AxialCoord[] => {
  assertInteger(radius, "radius");
  if (radius < 0) {
    throw new Error("radius must be >= 0");
  }

  const coords: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }
  return coords;
};

export const generateHexKeys = (radius: number): HexKey[] => {
  return generateAxialCoords(radius).map((coord) => toHexKey(coord.q, coord.r));
};

export const compareHexKeys = (a: HexKey, b: HexKey): number => {
  const ac = parseHexKey(a);
  const bc = parseHexKey(b);
  if (ac.q !== bc.q) {
    return ac.q - bc.q;
  }
  return ac.r - bc.r;
};

export const canonicalEdgeKey = (a: HexKey, b: HexKey): EdgeKey => {
  if (a === b) {
    throw new Error("Edge endpoints must be distinct");
  }
  const [first, second] = compareHexKeys(a, b) <= 0 ? [a, b] : [b, a];
  return `${first}|${second}`;
};

export const parseEdgeKey = (edge: EdgeKey): [HexKey, HexKey] => {
  const parts = edge.split("|");
  if (parts.length !== 2) {
    throw new Error("EdgeKey must be in the form hexA|hexB");
  }
  return [parts[0], parts[1]];
};
