"use client";

import { useEffect, useState } from "react";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "./country-text";
import {
  COUNTRY_STORAGE_KEY,
  countries,
  getCountry,
  type CountryCode,
} from "./i18n";
import useCountryTranslation from "./use-country-translation";

export default function CountrySelector() {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");
  const country = getCountry(countryCode);
  const { t } = useCountryTranslation();

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

  function selectCountry(nextCode: CountryCode) {
    const nextCountry = getCountry(nextCode);
    setCountryCode(nextCountry.code);
    document.documentElement.dataset.country = nextCountry.code;
    document.documentElement.lang = nextCountry.htmlLang;
    window.localStorage.setItem(COUNTRY_STORAGE_KEY, nextCountry.code);
    window.dispatchEvent(new CustomEvent(COUNTRY_CHANGE_EVENT));
  }

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-1 text-sm font-bold text-[var(--gg-text)]">
      <span className="sr-only">{t("country.selectorLabel")}</span>
      {countries.map((item) => (
        <button
          key={item.code}
          type="button"
          title={`${item.label} / ${item.language} / ${item.currency}`}
          aria-label={`${item.label} ${t("country.selectAriaSuffix")}`}
          onClick={() => selectCountry(item.code)}
          className={
            countryCode === item.code
              ? "rounded-md bg-[var(--gg-accent)] px-2.5 py-1.5 text-xs font-black text-[var(--gg-inverse-text)] shadow-sm shadow-[var(--gg-shadow)]"
              : "rounded-md px-2.5 py-1.5 text-xs font-black text-[var(--gg-muted)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_10%,transparent)] hover:text-[var(--gg-text)]"
          }
        >
          <span>{item.code}</span>
        </button>
      ))}
      <span className="hidden text-xs font-bold text-[var(--gg-muted)] lg:inline">
        {country.language} / {country.currency}
      </span>
    </div>
  );
}
