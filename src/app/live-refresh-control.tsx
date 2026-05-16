"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useCountryTranslation from "./use-country-translation";

type LiveRefreshControlProps = {
  label?: ReactNode;
  intervalMs?: number;
  defaultEnabled?: boolean;
  streamPath?: string;
};

export default function LiveRefreshControl({
  label,
  intervalMs = 5000,
  defaultEnabled = true,
  streamPath,
}: LiveRefreshControlProps) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [streamFailed, setStreamFailed] = useState(false);

  useEffect(() => {
    const canUseStream = streamPath && !streamFailed && typeof EventSource !== "undefined";

    if (!enabled || canUseStream) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      router.refresh();
      setLastRefreshedAt(new Date());
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, router, streamFailed, streamPath]);

  useEffect(() => {
    if (!enabled || !streamPath || typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource(streamPath);

    source.addEventListener("change", () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      router.refresh();
      setLastRefreshedAt(new Date());
    });

    source.onerror = () => {
      source.close();
      setStreamFailed(true);
    };

    return () => {
      source.close();
    };
  }, [enabled, router, streamPath]);

  function handleManualRefresh() {
    router.refresh();
    setLastRefreshedAt(new Date());
  }

  function handleToggleLive() {
    setStreamFailed(false);
    setEnabled((current) => !current);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--gg-muted)]">
      <span className="rounded-md border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-2 py-1 font-bold">
        {label ?? t("chat.refresh")}
      </span>
      <button
        type="button"
        onClick={handleToggleLive}
        className={`rounded-md border px-2 py-1 font-semibold ${
          enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-muted)]"
        }`}
      >
        {enabled ? t("chat.liveOn") : t("chat.liveOff")}
      </button>
      <button
        type="button"
        onClick={handleManualRefresh}
        className="rounded-md border border-[var(--gg-accent)] bg-emerald-50 px-2 py-1 font-semibold text-[var(--gg-accent)] hover:bg-emerald-100"
      >
        {t("chat.refreshNow")}
      </button>
      <span className="text-[var(--gg-subtle)]">
        {lastRefreshedAt
          ? `${t("chat.lastRefresh")} ${lastRefreshedAt.toLocaleTimeString()}`
          : streamPath && !streamFailed
            ? t("chat.liveWaiting")
            : `${Math.round(intervalMs / 1000)}${t("chat.refreshEverySuffix")}`}
      </span>
    </div>
  );
}
