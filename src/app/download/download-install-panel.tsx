"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function DownloadInstallPanel() {
  const { t } = useCountryTranslation();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean(navigator.standalone)),
    );
    setIsIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
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

  async function installApp() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-2xl border border-[var(--gg-border)] bg-white p-6 shadow-sm shadow-[var(--gg-shadow)]">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--gg-border)] bg-white shadow-lg shadow-slate-900/10">
            <Image src="/icons/icon-192.png" alt="GGtem app icon" width={64} height={64} className="rounded-2xl" />
          </div>
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">{t("pwaInstall.eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-black text-[var(--gg-text)]">{t("pwaInstall.title")}</h1>
          </div>
        </div>

        <p className="mt-5 text-sm font-bold leading-6 text-[var(--gg-muted)]">
          {t(isIos ? "pwaInstall.iosBody" : "pwaInstall.androidBody")}
        </p>

        <div className="mt-5 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
          <p className="text-xs font-black uppercase text-[var(--gg-muted)]">
            {t("pwaInstall.currentMode")}
          </p>
          <p className="mt-1 text-lg font-black text-[var(--gg-text)]">
            {t(isReady && isStandalone ? "pwaInstall.modeApp" : "pwaInstall.modeBrowser")}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {installPrompt ? (
            <button
              type="button"
              onClick={() => void installApp()}
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              {t("pwaInstall.installButton")}
            </button>
          ) : (
            <Link
              href="/my/notifications"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              {t("pwaInstall.notificationButton")}
            </Link>
          )}
          <Link
            href="/"
            className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-4 text-center text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
          >
            {t("common.home")}
          </Link>
        </div>

        {isReady && isStandalone ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            {t("pwaInstall.installedNotice")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <InstallStep step="1" title="iPhone / iPad" body={t("pwaInstall.iosStep")} />
        <InstallStep step="2" title="Android" body={t("pwaInstall.androidStep")} />
        <InstallStep step="3" title={t("pwaInstall.notificationStepTitle")} body={t("pwaInstall.notificationStep")} />
      </div>
    </section>
  );
}

function InstallStep({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-[var(--gg-border)] bg-white p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
        {step}
      </span>
      <div>
        <p className="text-lg font-black text-[var(--gg-text)]">{title}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-muted)]">{body}</p>
      </div>
    </div>
  );
}
