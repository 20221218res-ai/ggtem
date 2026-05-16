"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AdminOrderChatsRefreshProps = {
  autoRefresh: boolean;
  riskOnly: boolean;
};

export function AdminOrderChatsRefresh({
  autoRefresh,
  riskOnly,
}: AdminOrderChatsRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      router.refresh();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, router]);

  const updateParam = (key: string, enabled: boolean) => {
    const next = new URLSearchParams(searchParams.toString());

    if (enabled) {
      next.set(key, "1");
    } else {
      next.delete(key);
    }

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-black text-slate-800">감시 옵션</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateParam("risk", !riskOnly)}
          className={`rounded-md px-3 py-2 text-sm font-black ${
            riskOnly
              ? "bg-red-600 text-white"
              : "border border-red-200 bg-white text-red-700"
          }`}
        >
          위험만 {riskOnly ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={() => updateParam("refresh", !autoRefresh)}
          className={`rounded-md px-3 py-2 text-sm font-black ${
            autoRefresh
              ? "bg-[var(--gg-accent)] text-white"
              : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          자동 갱신 {autoRefresh ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
