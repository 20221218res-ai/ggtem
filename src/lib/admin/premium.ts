import { getGameMoneyPriceUnitLabel, getGameMoneyUnitName } from "@/lib/market/trade-unit";
import { getPrismaClient } from "@/lib/prisma";

export type AdminPremiumItem = {
  id: string;
  type: "LISTING" | "BUY_REQUEST";
  modeLabel: string;
  title: string;
  ownerName: string;
  gameName: string;
  serverName: string;
  category: string;
  status: string;
  unitPrice: string;
  currency: string;
  tradeModeLabel: string | null;
  minimumQuantityLabel: string | null;
  premiumStartedAt: string;
  premiumEndsAt: string;
  remainingLabel: string;
  durationHours: number;
  feeAmount: string;
  href: string;
};

export type AdminPremiumState = {
  summary: {
    activeCount: number;
    expiringSoonCount: number;
    expiredVisibleCount: number;
    revenueTotal: string;
  };
  activeItems: AdminPremiumItem[];
  expiredItems: AdminPremiumItem[];
  recentLedgerEntries: Array<{
    id: string;
    ownerName: string;
    referenceType: string;
    referenceId: string | null;
    amount: string;
    currency: string;
    createdAt: string;
  }>;
};

export async function getAdminPremiumState(): Promise<AdminPremiumState> {
  try {
    return await getAdminPremiumStateUnsafe();
  } catch (error) {
    if (isMissingPremiumSchemaError(error)) {
      return getEmptyAdminPremiumState();
    }

    throw error;
  }
}

async function getAdminPremiumStateUnsafe(): Promise<AdminPremiumState> {
  const prisma = getPrismaClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const [
    activeListings,
    expiredListings,
    activeBuyRequests,
    expiredBuyRequests,
    revenueAggregate,
    recentLedgerEntries,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: {
        premiumEndsAt: {
          gt: now,
        },
      },
      include: {
        seller: true,
        game: true,
        server: true,
        inventory: true,
      },
      orderBy: {
        premiumEndsAt: "asc",
      },
      take: 50,
    }),
    prisma.listing.findMany({
      where: {
        premiumEndsAt: {
          lte: now,
        },
      },
      include: {
        seller: true,
        game: true,
        server: true,
        inventory: true,
      },
      orderBy: {
        premiumEndsAt: "desc",
      },
      take: 20,
    }),
    prisma.buyRequest.findMany({
      where: {
        premiumEndsAt: {
          gt: now,
        },
      },
      include: {
        buyer: true,
      },
      orderBy: {
        premiumEndsAt: "asc",
      },
      take: 50,
    }),
    prisma.buyRequest.findMany({
      where: {
        premiumEndsAt: {
          lte: now,
        },
      },
      include: {
        buyer: true,
      },
      orderBy: {
        premiumEndsAt: "desc",
      },
      take: 20,
    }),
    prisma.walletLedgerEntry.aggregate({
      where: {
        type: "PREMIUM_PROMOTION_PURCHASED",
        direction: "CREDIT",
        bucket: "PLATFORM_REVENUE",
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.walletLedgerEntry.findMany({
      where: {
        type: "PREMIUM_PROMOTION_PURCHASED",
        direction: "CREDIT",
        bucket: "PLATFORM_REVENUE",
      },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  const buyRequests = [...activeBuyRequests, ...expiredBuyRequests];
  const gameIds = [...new Set(buyRequests.map((item) => item.gameId))];
  const serverIds = [
    ...new Set(
      buyRequests
        .map((item) => item.serverId)
        .filter((serverId): serverId is string => Boolean(serverId)),
    ),
  ];
  const [games, servers] = await Promise.all([
    gameIds.length > 0
      ? prisma.game.findMany({
          where: {
            id: {
              in: gameIds,
            },
          },
          select: {
            id: true,
            name: true,
            moneyUnitName: true,
          },
        })
      : [],
    serverIds.length > 0
      ? prisma.gameServer.findMany({
          where: {
            id: {
              in: serverIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [],
  ]);
  const gameById = new Map(games.map((game) => [game.id, game]));
  const serverNameById = new Map(servers.map((server) => [server.id, server.name]));

  const activeItems = [
    ...activeListings.map((listing) => mapListingPremiumItem(listing, now)),
    ...activeBuyRequests.map((request) =>
      mapBuyRequestPremiumItem(request, now, gameById, serverNameById),
    ),
  ].sort((left, right) => comparePremiumEnd(left, right));
  const expiredItems = [
    ...expiredListings.map((listing) => mapListingPremiumItem(listing, now)),
    ...expiredBuyRequests.map((request) =>
      mapBuyRequestPremiumItem(request, now, gameById, serverNameById),
    ),
  ].sort((left, right) => comparePremiumEnd(right, left));

  return {
    summary: {
      activeCount: activeItems.length,
      expiringSoonCount: activeItems.filter((item) => {
        const endsAt = new Date(item.premiumEndsAt).getTime();
        return endsAt <= soon.getTime();
      }).length,
      expiredVisibleCount: expiredItems.length,
      revenueTotal: formatDecimal(revenueAggregate._sum.amount?.toString() ?? "0"),
    },
    activeItems,
    expiredItems,
    recentLedgerEntries: recentLedgerEntries.map((entry) => ({
      id: entry.id,
      ownerName: entry.wallet.user.displayName,
      referenceType: entry.referenceType ?? "-",
      referenceId: entry.referenceId,
      amount: formatDecimal(entry.amount.toString()),
      currency: entry.currency,
      createdAt: formatKoreanDate(entry.createdAt),
    })),
  };
}

function getEmptyAdminPremiumState(): AdminPremiumState {
  return {
    summary: {
      activeCount: 0,
      expiringSoonCount: 0,
      expiredVisibleCount: 0,
      revenueTotal: "0",
    },
    activeItems: [],
    expiredItems: [],
    recentLedgerEntries: [],
  };
}

function isMissingPremiumSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  const meta = "meta" in error ? error.meta : null;
  const metaText = meta ? JSON.stringify(meta) : "";

  return (
    code === "P2022" &&
    (message.includes("premium") ||
      metaText.includes("premium") ||
      message.includes("column") ||
      metaText.includes("ColumnNotFound"))
  );
}

function mapListingPremiumItem(
  listing: {
    id: string;
    title: string;
    category: string;
    status: string;
    tradeMode: string;
    priceUnitQuantity: unknown;
    unitPrice: unknown;
    currency: string;
    premiumStartedAt: Date | null;
    premiumEndsAt: Date | null;
    premiumDurationHours: number | null;
    premiumFeeAmount: unknown | null;
    seller: { displayName: string };
    game: { name: string; moneyUnitName: string | null };
    server: { name: string } | null;
    inventory: { minimumQuantity: unknown } | null;
  },
  now: Date,
): AdminPremiumItem {
  const isGameMoney = listing.category === "GAME_MONEY";
  const moneyUnitName = getGameMoneyUnitName(listing.game.moneyUnitName, listing.game.name);

  return {
    id: listing.id,
    type: "LISTING",
    modeLabel: "판매글",
    title: listing.title,
    ownerName: listing.seller.displayName,
    gameName: listing.game.name,
    serverName: listing.server?.name ?? "전체 서버",
    category: categoryLabel(listing.category),
    status: listing.status,
    unitPrice: formatPriceLabel({
      category: listing.category,
      unitPrice: listing.unitPrice,
      priceUnitQuantity: listing.priceUnitQuantity,
      currency: listing.currency,
      moneyUnitName,
    }),
    currency: listing.currency,
    tradeModeLabel: isGameMoney ? tradeModeLabel(listing.tradeMode, "sell") : null,
    minimumQuantityLabel:
      isGameMoney && listing.inventory
        ? `${formatDecimal(String(listing.inventory.minimumQuantity))} ${moneyUnitName}`
        : null,
    premiumStartedAt: listing.premiumStartedAt ? formatKoreanDate(listing.premiumStartedAt) : "-",
    premiumEndsAt: listing.premiumEndsAt ? listing.premiumEndsAt.toISOString() : now.toISOString(),
    remainingLabel: formatRemaining(listing.premiumEndsAt, now),
    durationHours: listing.premiumDurationHours ?? 0,
    feeAmount: formatDecimal(String(listing.premiumFeeAmount ?? "0")),
    href: `/listings/${listing.id}`,
  };
}

function mapBuyRequestPremiumItem(
  request: {
    id: string;
    title: string | null;
    category: string;
    status: string;
    tradeMode: string;
    priceUnitQuantity: unknown;
    minimumQuantity: unknown;
    unitPrice: unknown;
    currency: string;
    gameId: string;
    serverId: string | null;
    premiumStartedAt: Date | null;
    premiumEndsAt: Date | null;
    premiumDurationHours: number | null;
    premiumFeeAmount: unknown | null;
    buyer: { displayName: string };
  },
  now: Date,
  gameById: Map<string, { id: string; name: string; moneyUnitName: string | null }>,
  serverNameById: Map<string, string>,
): AdminPremiumItem {
  const game = gameById.get(request.gameId);
  const gameName = game?.name ?? "알 수 없는 게임";
  const isGameMoney = request.category === "GAME_MONEY";
  const moneyUnitName = getGameMoneyUnitName(game?.moneyUnitName, gameName);

  return {
    id: request.id,
    type: "BUY_REQUEST",
    modeLabel: "구매글",
    title: request.title ?? "제목 없는 구매글",
    ownerName: request.buyer.displayName,
    gameName,
    serverName: request.serverId ? serverNameById.get(request.serverId) ?? "알 수 없는 서버" : "전체 서버",
    category: categoryLabel(request.category),
    status: request.status,
    unitPrice: formatPriceLabel({
      category: request.category,
      unitPrice: request.unitPrice,
      priceUnitQuantity: request.priceUnitQuantity,
      currency: request.currency,
      moneyUnitName,
    }),
    currency: request.currency,
    tradeModeLabel: isGameMoney ? tradeModeLabel(request.tradeMode, "buy") : null,
    minimumQuantityLabel: isGameMoney
      ? `${formatDecimal(String(request.minimumQuantity))} ${moneyUnitName}`
      : null,
    premiumStartedAt: request.premiumStartedAt ? formatKoreanDate(request.premiumStartedAt) : "-",
    premiumEndsAt: request.premiumEndsAt ? request.premiumEndsAt.toISOString() : now.toISOString(),
    remainingLabel: formatRemaining(request.premiumEndsAt, now),
    durationHours: request.premiumDurationHours ?? 0,
    feeAmount: formatDecimal(String(request.premiumFeeAmount ?? "0")),
    href: `/listings?mode=buy&category=${request.category}&game=${encodeURIComponent(gameName)}`,
  };
}

function formatPriceLabel({
  category,
  unitPrice,
  priceUnitQuantity,
  currency,
  moneyUnitName,
}: {
  category: string;
  unitPrice: unknown;
  priceUnitQuantity: unknown;
  currency: string;
  moneyUnitName: string;
}) {
  if (category !== "GAME_MONEY") {
    return `${formatDecimal(String(unitPrice))} ${currency}`;
  }

  const unitQuantity = Number(priceUnitQuantity);
  const basePrice = Number(unitPrice);
  const displayAmount =
    Number.isFinite(unitQuantity) && Number.isFinite(basePrice)
      ? basePrice * unitQuantity
      : basePrice;
  const unitLabel = getGameMoneyPriceUnitLabel(formatUnitQuantity(priceUnitQuantity), moneyUnitName);

  return `${formatDecimal(String(displayAmount))} ${currency} / ${unitLabel}`;
}

function tradeModeLabel(value: string, side: "sell" | "buy") {
  if (value === "BULK") {
    return side === "sell" ? "일괄 판매" : "일괄 구매";
  }

  return side === "sell" ? "분할 판매" : "분할 구매";
}

function formatUnitQuantity(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return String(Math.trunc(numeric));
}

function comparePremiumEnd(left: AdminPremiumItem, right: AdminPremiumItem) {
  return new Date(left.premiumEndsAt).getTime() - new Date(right.premiumEndsAt).getTime();
}

function formatRemaining(date: Date | null, now: Date) {
  if (!date) return "만료 정보 없음";

  const diffMs = date.getTime() - now.getTime();
  const absMinutes = Math.max(Math.ceil(Math.abs(diffMs) / 60_000), 0);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const label = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return diffMs > 0 ? `${label} 남음` : `${label} 전 만료`;
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatDecimal(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    GAME_MONEY: "게임머니",
    GAME_ITEM: "아이템",
    GAME_ACCOUNT: "계정",
  };

  return labels[category] ?? category;
}
