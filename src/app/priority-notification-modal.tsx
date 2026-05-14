"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NotificationItem = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  notification?: NotificationItem | null;
};

const DISMISSED_STORAGE_KEY = "ggtem-dismissed-priority-notification";
const ACTIVE_CHECK_INTERVAL_MS = 45_000;
const DISMISSED_CHECK_INTERVAL_MS = 90_000;

export default function PriorityNotificationModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const shouldCheck = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith("/admin")) return false;
    if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return false;
    if (pathname.startsWith("/password-reset") || pathname.startsWith("/verify-email")) return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    setDismissedId(window.sessionStorage.getItem(DISMISSED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!shouldCheck) {
      setNotification(null);
      return;
    }

    let isActive = true;
    let timer: number | null = null;

    function scheduleNextCheck(delay: number) {
      if (!isActive) {
        return;
      }

      timer = window.setTimeout(() => void loadPriorityNotification(), delay);
    }

    async function loadPriorityNotification() {
      if (document.visibilityState === "hidden") {
        scheduleNextCheck(ACTIVE_CHECK_INTERVAL_MS);
        return;
      }

      try {
        const params = dismissedId
          ? `?dismissedId=${encodeURIComponent(dismissedId)}`
          : "";
        const response = await fetch(`/api/user/priority-notification${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          scheduleNextCheck(ACTIVE_CHECK_INTERVAL_MS);
          return;
        }

        const data = (await response.json()) as NotificationsResponse;

        if (isActive) {
          const nextNotification = data.notification ?? null;
          setNotification(nextNotification);
          scheduleNextCheck(
            nextNotification || !dismissedId
              ? ACTIVE_CHECK_INTERVAL_MS
              : DISMISSED_CHECK_INTERVAL_MS,
          );
        }
      } catch {
        // The modal is opportunistic; failed polling should not block the page.
        scheduleNextCheck(ACTIVE_CHECK_INTERVAL_MS);
      }
    }

    void loadPriorityNotification();

    return () => {
      isActive = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [dismissedId, shouldCheck]);

  async function openNotification() {
    if (!notification) {
      return;
    }

    const nextNotification = notification;
    const targetHref = nextNotification.href ?? "/my/notifications";
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, nextNotification.notificationId);
    setDismissedId(nextNotification.notificationId);
    setNotification(null);

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "READ_ONE",
          notificationId: nextNotification.notificationId,
        }),
      });
    } finally {
      router.push(targetHref);
      router.refresh();
    }
  }

  function dismissNotification() {
    if (!notification) {
      return;
    }

    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, notification.notificationId);
    setDismissedId(notification.notificationId);
    setNotification(null);
  }

  if (!notification) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-[var(--gg-accent)]">
              우선 알림
            </p>
            <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
              먼저 확인해야 할 거래 알림이 있습니다
            </h2>
          </div>
          <button
            type="button"
            onClick={dismissNotification}
            className="rounded-lg border border-[var(--gg-border)] px-3 py-2 text-sm font-black text-[var(--gg-muted)] hover:text-[var(--gg-text)]"
          >
            닫기
          </button>
        </div>
        <button
          type="button"
          onClick={() => void openNotification()}
          className="mt-4 w-full rounded-xl border border-[color-mix(in_srgb,var(--gg-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)] p-4 text-left transition hover:border-[var(--gg-accent)]"
        >
          <p className="font-black text-[var(--gg-text)]">{notification.title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--gg-muted)]">
            {notification.body}
          </p>
          <p className="mt-3 text-xs font-bold text-[var(--gg-subtle)]">
            {notification.createdAt}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void openNotification()}
          className="mt-4 w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white hover:brightness-105"
        >
          바로 확인하기
        </button>
      </div>
    </div>
  );
}
