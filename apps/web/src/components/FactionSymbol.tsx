import { getFactionIconUrl, getFactionSymbol } from "../lib/factions";

type FactionSymbolProps = {
  factionId?: string | null;
  className?: string;
};

export const FactionSymbol = ({ factionId, className }: FactionSymbolProps) => {
  const iconUrl = getFactionIconUrl(factionId);
  const symbol = getFactionSymbol(factionId);
  if (!iconUrl && !symbol) {
    return null;
  }
  const classes = ["faction-symbol", className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {iconUrl ? <img className="faction-symbol__icon" src={iconUrl} alt="" /> : symbol}
    </span>
  );
};
