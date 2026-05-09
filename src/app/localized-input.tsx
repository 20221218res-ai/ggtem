"use client";

import type { InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { COUNTRY_CHANGE_EVENT } from "./country-text";
import {
  COUNTRY_STORAGE_KEY,
  getCountry,
  translate,
  type CountryCode,
  type TranslationKey,
} from "./i18n";

function getStoredCountry(): CountryCode {
  if (typeof window === "undefined") {
    return "KR";
  }

  return getCountry(window.localStorage.getItem(COUNTRY_STORAGE_KEY)).code;
}

export default function LocalizedInput({
  placeholderKey,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  placeholderKey: TranslationKey;
}) {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");

  useEffect(() => {
    const syncCountry = () => setCountryCode(getStoredCountry());

    syncCountry();
    window.addEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
    window.addEventListener("storage", syncCountry);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
      window.removeEventListener("storage", syncCountry);
    };
  }, []);

  return <input {...props} placeholder={translate(placeholderKey, countryCode)} />;
}
