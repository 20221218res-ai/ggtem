"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CountryText from "./country-text";

export default function SignOutButton({
  className,
  redirectTo = "/sign-in",
}: {
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
      });
      router.push(redirectTo);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={() => void handleSignOut()}
      className={
        className ??
        "rounded-lg border border-[var(--gg-border)] px-3 py-2 text-sm font-bold text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isSubmitting ? (
        <CountryText id="common.signingOut" />
      ) : (
        <CountryText id="common.signOut" />
      )}
    </button>
  );
}
