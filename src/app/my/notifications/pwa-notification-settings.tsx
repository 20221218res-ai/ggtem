"use client";

import { useEffect, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export default function PwaNotificationSettings() {
  const { t } = useCountryTranslation();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supportsNotifications = "Notification" in window;
    const supportsServiceWorker = "serviceWorker" in navigator;

    if (!supportsNotifications || !supportsServiceWorker) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean(navigator.standalone)),
    );
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setIsSubmitting(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission as PermissionState);

      if (nextPermission === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("GGtem", {
          body: t("notification.pushReady"),
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: "/my/notifications" },
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusText =
    permission === "granted"
      ? t("notification.pushEnabled")
      : permission === "denied"
        ? t("notification.pushDenied")
        : permission === "unsupported"
          ? t("notification.pushUnsupported")
          : t("notification.pushDefault");

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            {t("notification.pushEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-black text-[var(--gg-text)]">
            {t("notification.pushTitle")}
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-muted)]">
            {t(isStandalone ? "notification.pushStandaloneBody" : "notification.pushInstallHint")}
          </p>
        </div>

        <div className="grid gap-2 sm:min-w-64">
          <div className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-3 text-sm font-black text-[var(--gg-text)]">
            {statusText}
          </div>
          <button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={isSubmitting || permission === "granted" || permission === "denied" || permission === "unsupported"}
            className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? t("notification.pushChecking") : t("notification.pushEnable")}
          </button>
        </div>
      </div>
    </section>
  );
}
