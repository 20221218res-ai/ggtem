"use client";

import { useEffect, useState } from "react";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "./country-text";
import { translate, type CountryCode, type TranslationKey } from "./i18n";

export default function useCountryTranslation() {
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

  return {
    countryCode,
    t: (key: TranslationKey) => translate(key, countryCode),
  };
}
