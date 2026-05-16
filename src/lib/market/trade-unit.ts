const DEFAULT_MONEY_UNIT = "Game money";
const FIXED_AMOUNT_SCALE = 1_000_000n;

export const GAME_MONEY_QUANTITY_UNIT = 10_000;
export const GAME_MONEY_PRICE_UNIT_OPTIONS = [
  { value: "10000", label: "10K", koreanLabel: "1만" },
  { value: "100000", label: "100K", koreanLabel: "10만" },
  { value: "1000000", label: "1M", koreanLabel: "100만" },
  { value: "10000000", label: "10M", koreanLabel: "1000만" },
] as const;

export type GameMoneyTradeMode = "BULK" | "SPLIT";

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
    throw new Error(`${label}은 선택한 게임머니 단위 기준으로 입력해 주세요.`);
  }
}

export function isGameMoneyQuantityUnit(value: string) {
  const normalized = normalizeGameMoneyQuantityText(value);

  if (!/^\d+$/.test(normalized)) {
    return false;
  }

  return (
    BigInt(normalized) > 0n &&
    BigInt(normalized) % BigInt(GAME_MONEY_QUANTITY_UNIT) === 0n
  );
}

export function normalizeGameMoneyTradeMode(value: unknown): GameMoneyTradeMode {
  return value === "BULK" ? "BULK" : "SPLIT";
}

export function normalizeGameMoneyPriceUnit(value: string | null | undefined) {
  const normalized = value?.trim() || GAME_MONEY_PRICE_UNIT_OPTIONS[0].value;

  if (!GAME_MONEY_PRICE_UNIT_OPTIONS.some((option) => option.value === normalized)) {
    throw new Error("게임머니 가격 단위를 선택해 주세요.");
  }

  return normalized;
}

export function isGameMoneyDisplayQuantity(value: string) {
  const normalized = normalizeGameMoneyQuantityText(value);

  return /^\d+$/.test(normalized) && BigInt(normalized) > 0n;
}

export function toGameMoneyActualQuantity(
  displayQuantity: string,
  priceUnitQuantity: string | null | undefined,
) {
  const normalizedDisplayQuantity = displayQuantity.trim();

  if (!isGameMoneyDisplayQuantity(normalizedDisplayQuantity)) {
    throw new Error("게임머니 수량은 선택한 단위 기준 숫자로 입력해 주세요.");
  }

  return (
    BigInt(normalizedDisplayQuantity) *
    BigInt(normalizeGameMoneyPriceUnit(priceUnitQuantity))
  ).toString();
}

export function toGameMoneyDisplayQuantity(
  actualQuantity: string | null | undefined,
  priceUnitQuantity: string | null | undefined,
) {
  const normalizedActualQuantity = normalizeGameMoneyQuantityText(actualQuantity);

  if (!normalizedActualQuantity || !/^\d+$/.test(normalizedActualQuantity)) {
    return "1";
  }

  const actual = BigInt(normalizedActualQuantity);
  const unit = BigInt(safeNormalizeGameMoneyPriceUnit(priceUnitQuantity));

  if (actual <= 0n || unit <= 0n) {
    return "1";
  }

  if (actual % unit !== 0n) {
    return normalizedActualQuantity;
  }

  return (actual / unit).toString();
}

export function formatGameMoneyQuantityWithUnit(
  actualQuantity: string | null | undefined,
  priceUnitQuantity: string | null | undefined,
  moneyUnitName: string | null | undefined,
) {
  const normalizedActualQuantity = normalizeGameMoneyQuantityText(actualQuantity);

  if (!normalizedActualQuantity || !/^\d+$/.test(normalizedActualQuantity)) {
    return "0";
  }

  const normalizedPriceUnitQuantity =
    safeNormalizeGameMoneyPriceUnit(priceUnitQuantity);
  const displayQuantity = toGameMoneyDisplayQuantity(
    normalizedActualQuantity,
    normalizedPriceUnitQuantity,
  );
  const priceUnitLabel = getGameMoneyPriceUnitLabel(
    normalizedPriceUnitQuantity,
    moneyUnitName,
  );

  return `${formatIntegerQuantity(displayQuantity)} x ${priceUnitLabel}`;
}

export function safeNormalizeGameMoneyPriceUnit(
  value: string | null | undefined,
) {
  try {
    return normalizeGameMoneyPriceUnit(value);
  } catch {
    return GAME_MONEY_PRICE_UNIT_OPTIONS[0].value;
  }
}

export function normalizeGameMoneyQuantityText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  if (/^\d+\.0+$/.test(normalized)) {
    return normalized.replace(/\.0+$/, "");
  }

  return normalized;
}

export function getGameMoneyPriceUnitLabel(
  value: string,
  moneyUnitName: string | null | undefined,
) {
  const option =
    GAME_MONEY_PRICE_UNIT_OPTIONS.find((entry) => entry.value === value) ??
    GAME_MONEY_PRICE_UNIT_OPTIONS[0];
  const unitName = getGameMoneyUnitName(moneyUnitName);

  return `${option.label} (${option.koreanLabel}) ${unitName}`;
}

function formatIntegerQuantity(value: string) {
  if (!/^\d+$/.test(value)) {
    return value;
  }

  return BigInt(value).toLocaleString("en-US");
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
