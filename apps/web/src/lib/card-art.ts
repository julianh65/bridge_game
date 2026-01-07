import cardArtManifest from "../data/card-art.json";

type CardArtManifest = Record<string, string>;

const manifest = cardArtManifest as CardArtManifest;

export const getCardArtUrl = (cardId?: string | null): string | null => {
  if (!cardId) {
    return null;
  }
  const entry = manifest[cardId];
  if (!entry) {
    return null;
  }
  if (entry.startsWith("/") || entry.startsWith("http")) {
    return entry;
  }
  return `/card-art/${entry}`;
};

export const CARD_ART_MANIFEST = manifest;
