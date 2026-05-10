"use client";

import { useEffect, useState } from "react";
import type { LocalizedGameNames } from "@/lib/market/game-localization";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "./country-text";

type CountryCode = keyof LocalizedGameNames;

const STATIC_GAME_NAMES: Record<string, LocalizedGameNames> = {
  "Lineage Classic": {
    KR: "리니지 클래식",
    CN: "天堂经典",
    VN: "Lineage Classic",
    PH: "Lineage Classic",
    TH: "ไลน์เอจ คลาสสิก",
  },
  "Aion 2": {
    KR: "아이온2",
    CN: "永恒之塔2",
    VN: "Aion 2",
    PH: "Aion 2",
    TH: "ไอออน 2",
  },
  "Lineage M": {
    KR: "리니지M",
    CN: "天堂M",
    VN: "Lineage M",
    PH: "Lineage M",
    TH: "ไลน์เอจ M",
  },
  Lineage2M: {
    KR: "리니지2M",
    CN: "天堂2M",
    VN: "Lineage2M",
    PH: "Lineage2M",
    TH: "ไลน์เอจ 2M",
  },
  "Lineage W": {
    KR: "리니지W",
    CN: "天堂W",
    VN: "Lineage W",
    PH: "Lineage W",
    TH: "ไลน์เอจ W",
  },
};

export function getLocalizedGameName(
  name: string,
  localizedNames?: Partial<LocalizedGameNames> | null,
  countryCode: string = getCurrentCountryCode(),
) {
  const country = normalizeCountryCode(countryCode);
  const explicit = localizedNames?.[country];
  const fallback = STATIC_GAME_NAMES[name]?.[country];

  return explicit || fallback || name;
}

export function useLocalizedGameName(
  name: string,
  localizedNames?: Partial<LocalizedGameNames> | null,
) {
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());

  useEffect(() => {
    const handleCountryChange = () => setCountryCode(getCurrentCountryCode());
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
    window.addEventListener("storage", handleCountryChange);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
      window.removeEventListener("storage", handleCountryChange);
    };
  }, []);

  return getLocalizedGameName(name, localizedNames, countryCode);
}

export default function GameNameText({
  name,
  localizedNames,
}: {
  name: string;
  localizedNames?: Partial<LocalizedGameNames> | null;
}) {
  return <>{useLocalizedGameName(name, localizedNames)}</>;
}

function normalizeCountryCode(countryCode: string): CountryCode {
  if (
    countryCode === "KR" ||
    countryCode === "CN" ||
    countryCode === "VN" ||
    countryCode === "PH" ||
    countryCode === "TH"
  ) {
    return countryCode;
  }

  return "KR";
}
