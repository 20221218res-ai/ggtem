const DEFAULT_MONEY_UNIT = "Game money";
const FIXED_AMOUNT_SCALE = 1_000_000n;

export const GAME_MONEY_QUANTITY_UNIT = 10_000;
const GAME_MONEY_FIXED_QUANTITY_UNIT =
  BigInt(GAME_MONEY_QUANTITY_UNIT) * FIXED_AMOUNT_SCALE;

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

export function assertGameMoneyQuantityUnit(
  category: string,
  quantity: bigint,
  label = "수량",
) {
  if (category !== "GAME_MONEY") {
    return;
  }

  if (quantity % GAME_MONEY_FIXED_QUANTITY_UNIT !== 0n) {
    throw new Error(`${label}은 10,000 단위로만 입력할 수 있습니다.`);
  }
}

export function isGameMoneyQuantityUnit(value: string) {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return false;
  }

  return Number(normalized) > 0 && Number(normalized) % GAME_MONEY_QUANTITY_UNIT === 0;
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
