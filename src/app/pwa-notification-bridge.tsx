"use client";

import { useEffect } from "react";

export default function PwaNotificationBridge() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // PWA registration is progressive enhancement and must not block the app.
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
