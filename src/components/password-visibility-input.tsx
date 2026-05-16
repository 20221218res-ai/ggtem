"use client";

import { InputHTMLAttributes, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";
import { TextInput } from "@/components/ui";

type PasswordVisibilityInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordVisibilityInput({
  className,
  ...props
}: PasswordVisibilityInputProps) {
  const { t } = useCountryTranslation();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <TextInput
        {...props}
        type={isVisible ? "text" : "password"}
        className={`w-full pr-12 ${className ?? ""}`}
      />
      <button
        type="button"
        aria-label={isVisible ? t("auth.passwordHide") : t("auth.passwordShow")}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--gg-muted)] transition hover:bg-[var(--gg-card-soft-bg)] hover:text-[var(--gg-text)]"
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.1 4.2" />
      <path d="M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.1-.8" />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" />
    </svg>
  );
}
