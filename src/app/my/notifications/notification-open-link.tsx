"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";

export default function NotificationOpenLink({
  href,
  notificationId,
  isRead,
  className,
  children,
}: {
  href: string;
  notificationId: string;
  isRead: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [isOpening, setIsOpening] = useState(false);

  async function openNotification() {
    setIsOpening(true);

    try {
      if (!isRead) {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "READ_ONE",
            notificationId,
          }),
        });
      }
    } finally {
      router.push(href);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openNotification()}
      disabled={isOpening}
      className={
        className ??
        "rounded-xl bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isOpening ? t("notification.opening") : (children ?? t("notification.openRelated"))}
    </button>
  );
}
