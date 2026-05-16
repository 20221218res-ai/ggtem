"use client";

export type HeaderCounts = {
  unreadChatCount: number;
  unreadNotificationCount: number;
  walletAvailableBalance: string;
  walletCurrency: string;
};

const HEADER_COUNTS_CACHE_KEY = "ggtem-header-counts";
const HEADER_COUNTS_CACHE_TTL_MS = 15_000;

let pendingRequest: Promise<HeaderCounts> | null = null;

export function getDefaultHeaderCounts(): HeaderCounts {
  return {
    unreadChatCount: 0,
    unreadNotificationCount: 0,
    walletAvailableBalance: "0",
    walletCurrency: "USDT",
  };
}

export async function loadHeaderCounts(cacheScope: string) {
  const cachedCounts = readCachedHeaderCounts(cacheScope);

  if (cachedCounts) {
    return cachedCounts;
  }

  if (!pendingRequest) {
    pendingRequest = fetch("/api/user/header-counts", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return getDefaultHeaderCounts();
        }

        const data = (await response.json()) as Partial<HeaderCounts>;
        const counts = normalizeHeaderCounts(data);
        writeCachedHeaderCounts(cacheScope, counts);
        return counts;
      })
      .catch(() => getDefaultHeaderCounts())
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

function normalizeHeaderCounts(data: Partial<HeaderCounts>): HeaderCounts {
  return {
    unreadChatCount: data.unreadChatCount ?? 0,
    unreadNotificationCount: data.unreadNotificationCount ?? 0,
    walletAvailableBalance: data.walletAvailableBalance ?? "0",
    walletCurrency: data.walletCurrency ?? "USDT",
  };
}

function readCachedHeaderCounts(cacheScope: string) {
  try {
    const rawValue = window.sessionStorage.getItem(HEADER_COUNTS_CACHE_KEY);
    if (!rawValue) return null;

    const cached = JSON.parse(rawValue) as {
      scope?: string;
      expiresAt?: number;
      counts?: Partial<HeaderCounts>;
    };

    if (
      cached.scope !== cacheScope ||
      !cached.expiresAt ||
      cached.expiresAt <= Date.now() ||
      !cached.counts
    ) {
      return null;
    }

    return normalizeHeaderCounts(cached.counts);
  } catch {
    return null;
  }
}

function writeCachedHeaderCounts(cacheScope: string, counts: HeaderCounts) {
  try {
    window.sessionStorage.setItem(
      HEADER_COUNTS_CACHE_KEY,
      JSON.stringify({
        scope: cacheScope,
        expiresAt: Date.now() + HEADER_COUNTS_CACHE_TTL_MS,
        counts,
      }),
    );
  } catch {
    // Header badges are non-critical. Storage failures should not affect navigation.
  }
}
