"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useCountryTranslation from "./use-country-translation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "ggtem-pwa-install-prompt-dismissed";

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const shouldHideByPath = useMemo(() => {
    if (!pathname) return true;
    return (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up") ||
      pathname.startsWith("/password-reset") ||
      pathname.startsWith("/verify-email")
    );
  }, [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean(navigator.standalone));
    const mobile = mediaQuery.matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    setIsMobile(mobile);
    setIsStandalone(standalone);
    setIsIos(ios);
    setIsDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    setIsReady(true);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!isReady || shouldHideByPath || isDismissed || !isMobile || isStandalone) {
    return null;
  }

  async function installApp() {
    if (!installPrompt) {
      router.push("/my/notifications");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      dismissPrompt();
      router.push("/my/notifications");
    }
  }

  function dismissPrompt() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setIsDismissed(true);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[65] md:hidden">
      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_35%,var(--gg-border))] bg-white p-4 shadow-2xl shadow-slate-900/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[var(--gg-accent)]">
              {t("pwaInstall.eyebrow")}
            </p>
            <h2 className="mt-1 text-lg font-black text-[var(--gg-text)]">
              {t("pwaInstall.title")}
            </h2>
            <p className="mt-2 text-sm font-bold leading-5 text-[var(--gg-muted)]">
              {t(isIos ? "pwaInstall.iosBody" : "pwaInstall.androidBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissPrompt}
            className="shrink-0 rounded-lg border border-[var(--gg-border)] px-2 py-1 text-xs font-black text-[var(--gg-muted)]"
          >
            {t("wallet.close")}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void installApp()}
            className="rounded-xl bg-[var(--gg-accent)] px-3 py-3 text-sm font-black text-[var(--gg-inverse-text)]"
          >
            {t(installPrompt ? "pwaInstall.installButton" : "pwaInstall.notificationButton")}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-xl border border-[var(--gg-border)] bg-white px-3 py-3 text-sm font-black text-[var(--gg-text)]"
          >
            {t("pwaInstall.laterButton")}
          </button>
        </div>
      </section>
    </div>
  );
}
