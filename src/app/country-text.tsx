"use client";

import { useEffect, useState } from "react";
import {
  COUNTRY_STORAGE_KEY,
  getCountry,
  translate,
  type CountryCode,
  type TranslationKey,
} from "./i18n";

export const COUNTRY_CHANGE_EVENT = "ggitem-country-change";

export function getCurrentCountryCode(): CountryCode {
  if (typeof window === "undefined") {
    return "KR";
  }

  return getCountry(window.localStorage.getItem(COUNTRY_STORAGE_KEY)).code;
}

export default function CountryText({
  id,
  values,
}: {
  id: TranslationKey;
  values?: Record<string, string | number>;
}) {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");

  useEffect(() => {
    function syncCountry() {
      setCountryCode(getCurrentCountryCode());
    }

    syncCountry();
    window.addEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
    window.addEventListener("storage", syncCountry);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
      window.removeEventListener("storage", syncCountry);
    };
  }, []);

  const text = translate(id, countryCode);

  return (
    <>
      {values
        ? Object.entries(values).reduce(
            (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
            text,
          )
        : text}
    </>
  );
}
