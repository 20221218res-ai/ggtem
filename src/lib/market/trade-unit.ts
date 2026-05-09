const DEFAULT_MONEY_UNIT = "Game money";

const BROKEN_UNIT_MARKERS = [
  "\uFFFD",
  "\u5360",
  "\u5BC3",
  "\u6028",
  "\u5A9B",
  "\u91CE",
  "\u7ACA",
  "?",
];

export function getGameMoneyUnitName(
  value: string | null | undefined,
  gameName?: string | null,
) {
  const normalizedValue = value?.trim();

  if (normalizedValue && !isBrokenUnitLabel(normalizedValue)) {
    return normalizedValue;
  }

  return getFallbackMoneyUnitName(gameName);
}

export function getTradeUnitLabel(
  category: string,
  moneyUnitName: string | null | undefined,
  gameName?: string | null,
) {
  if (category === "GAME_MONEY") {
    return getGameMoneyUnitName(moneyUnitName, gameName);
  }

  if (category === "GAME_ACCOUNT") {
    return "Account";
  }

  return "Item";
}

function isBrokenUnitLabel(value: string) {
  const compact = value.replace(/\s+/g, "");

  return (
    compact.length === 0 ||
    BROKEN_UNIT_MARKERS.some((marker) => compact.includes(marker))
  );
}

function getFallbackMoneyUnitName(gameName?: string | null) {
  const normalizedGame = gameName?.toLowerCase() ?? "";

  if (normalizedGame.includes("lineage")) {
    return "Adena";
  }

  if (normalizedGame.includes("ragnarok")) {
    return "Zeny";
  }

  if (normalizedGame.includes("maple")) {
    return "Meso";
  }

  if (normalizedGame.includes("dungeon")) {
    return "Gold";
  }

  if (normalizedGame.includes("odin")) {
    return "Diamond";
  }

  return DEFAULT_MONEY_UNIT;
}
