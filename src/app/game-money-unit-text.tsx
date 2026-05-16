"use client";

import useCountryTranslation from "./use-country-translation";
import {
  formatGameMoneyQuantityWithUnit,
  getGameMoneyPriceUnitLabel,
  type MoneyUnitNameSource,
} from "@/lib/market/trade-unit";

export function GameMoneyPriceUnitText({
  priceUnitQuantity,
  moneyUnitName,
}: {
  priceUnitQuantity: string;
  moneyUnitName: MoneyUnitNameSource;
}) {
  const { countryCode } = useCountryTranslation();

  return (
    <>
      {getGameMoneyPriceUnitLabel(priceUnitQuantity, moneyUnitName, countryCode)}
    </>
  );
}

export function GameMoneyQuantityText({
  quantity,
  priceUnitQuantity,
  moneyUnitName,
}: {
  quantity: string | null | undefined;
  priceUnitQuantity: string | null | undefined;
  moneyUnitName: MoneyUnitNameSource;
}) {
  const { countryCode } = useCountryTranslation();

  return (
    <>
      {formatGameMoneyQuantityWithUnit(
        quantity,
        priceUnitQuantity,
        moneyUnitName,
        countryCode,
      )}
    </>
  );
}
