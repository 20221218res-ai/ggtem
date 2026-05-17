"use client";

import { useEffect, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export default function PwaNotificationSettings() {
  const { t } = useCountryTranslation();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => undefined);
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission as PermissionState);

      if (nextPermission === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const keyResponse = await fetch("/api/user/push-subscriptions", {
          cache: "no-store",
        });
        const keyData = (await keyResponse.json()) as { publicKey?: string | null };

        if (!keyResponse.ok || !keyData.publicKey) {
          throw new Error(t("notification.pushServerKeyMissing"));
        }

        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
          }));

        const subscriptionPayload = subscription.toJSON();
        const saveResponse = await fetch("/api/user/push-subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...subscriptionPayload,
            userAgent: navigator.userAgent,
          }),
        });

        if (!saveResponse.ok) {
          throw new Error(t("notification.pushSaveFailed"));
        }

        setIsSubscribed(true);
        setSuccessMessage(t("notification.pushSubscribed"));
        await registration.showNotification("GGtem", {
          body: t("notification.pushReady"),
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: "/my/notifications" },
        });
      }
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : t("notification.pushSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendTestNotification() {
    setIsTesting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/user/push-test", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(t("notification.pushTestFailed"));
      }

      setSuccessMessage(t("notification.pushTestSent"));
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : t("notification.pushTestFailed"));
    } finally {
      setIsTesting(false);
    }
  }

  const statusText =
    permission === "granted"
      ? t(isSubscribed ? "notification.pushSubscribed" : "notification.pushEnabled")
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
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
              {t(isStandalone ? "pwaInstall.modeApp" : "pwaInstall.modeBrowser")}
            </span>
            <span className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
              {t(isSubscribed ? "notification.pushSubscribed" : "notification.pushDefault")}
            </span>
          </div>
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
            disabled={isSubmitting || isSubscribed || permission === "denied" || permission === "unsupported"}
            className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? t("notification.pushChecking") : t("notification.pushEnable")}
          </button>
          <button
            type="button"
            onClick={() => void sendTestNotification()}
            disabled={isTesting || !isSubscribed}
            className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isTesting ? t("notification.pushChecking") : t("notification.pushTest")}
          </button>
          {successMessage ? <p className="text-xs font-bold text-emerald-700">{successMessage}</p> : null}
          {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
