import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export type AdminMarketListingsFilters = {
  mode?: string | null;
  status?: string | null;
  category?: string | null;
  query?: string | null;
};

export type AdminMarketListingsState = Awaited<ReturnType<typeof getAdminMarketListingsState>>;

const SELL_STATUSES = ["ACTIVE", "PAUSED", "SOLD_OUT", "HIDDEN", "REMOVED"] as const;
const BUY_STATUSES = ["ACTIVE", "ACCEPTED", "EXPIRED", "CANCELED", "COMPLETED"] as const;

export async function getAdminMarketListingsState(filters?: AdminMarketListingsFilters) {
  const prisma = getPrismaClient();
  const mode = normalizeMode(filters?.mode);
  const status = filters?.status?.trim() || "ALL";
  const category = filters?.category?.trim() || "ALL";
  const query = filters?.query?.trim() || "";

  const [sellCounts, buyCounts, listings, buyRequests] = await Promise.all([
    prisma.listing.groupBy({ by: ["status"], _count: true }),
    prisma.buyRequest.groupBy({ by: ["status"], _count: true }),
    mode === "BUY"
      ? Promise.resolve([])
      : prisma.listing.findMany({
          where: buildListingWhere({ status, category, query }),
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            unitPrice: true,
            currency: true,
            createdAt: true,
            premiumEndsAt: true,
            seller: { select: { id: true, email: true, displayName: true } },
            game: { select: { name: true } },
            server: { select: { name: true } },
            _count: { select: { orders: true, images: true } },
          },
        }),
    mode === "SELL"
      ? Promise.resolve([])
      : prisma.buyRequest.findMany({
          where: buildBuyRequestWhere({ status, category, query }),
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            unitPrice: true,
            totalAmount: true,
            lockAmount: true,
            currency: true,
            createdAt: true,
            premiumEndsAt: true,
            buyer: { select: { id: true, email: true, displayName: true } },
            _count: { select: { offers: true, images: true } },
          },
        }),
  ]);

  return {
    filters: { mode, status, category, query },
    summary: {
      sellTotal: countAll(sellCounts),
      sellActive: countStatus(sellCounts, "ACTIVE"),
      sellHidden: countStatus(sellCounts, "HIDDEN"),
      sellRemoved: countStatus(sellCounts, "REMOVED"),
      buyTotal: countAll(buyCounts),
      buyActive: countStatus(buyCounts, "ACTIVE"),
      buyAccepted: countStatus(buyCounts, "ACCEPTED"),
    },
    listings: listings.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      price: item.unitPrice.toString(),
      currency: item.currency,
      gameName: item.game.name,
      serverName: item.server?.name ?? "서버 없음",
      ownerId: item.seller.id,
      ownerName: item.seller.displayName || item.seller.email,
      orderCount: item._count.orders,
      imageCount: item._count.images,
      isPremium: item.premiumEndsAt ? item.premiumEndsAt > new Date() : false,
      createdAt: formatDateTime(item.createdAt),
      href: `/admin/market-listings/sell/${item.id}`,
      auditHref: `/admin/audit?targetType=LISTING&query=${item.id}`,
    })),
    buyRequests: buyRequests.map((item) => ({
      id: item.id,
      title: item.title || "구매글 제목 없음",
      category: item.category,
      status: item.status,
      price: item.unitPrice.toString(),
      totalAmount: item.totalAmount.toString(),
      lockAmount: item.lockAmount.toString(),
      currency: item.currency,
      ownerId: item.buyer.id,
      ownerName: item.buyer.displayName || item.buyer.email,
      offerCount: item._count.offers,
      imageCount: item._count.images,
      isPremium: item.premiumEndsAt ? item.premiumEndsAt > new Date() : false,
      createdAt: formatDateTime(item.createdAt),
      href: `/admin/market-listings/buy/${item.id}`,
      auditHref: `/admin/audit?targetType=BUY_REQUEST&query=${item.id}`,
      actionLocked: item.status === "ACTIVE" && Number(item.lockAmount) > 0,
    })),
  };
}

export async function getAdminMarketListingDetail(kind: "sell" | "buy", id: string) {
  const prisma = getPrismaClient();

  if (kind === "sell") {
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, email: true, displayName: true } },
        game: { select: { name: true, moneyUnitName: true } },
        server: { select: { name: true } },
        inventory: true,
        images: { orderBy: { sortOrder: "asc" } },
        orders: {
          select: {
            status: true,
          },
        },
        _count: { select: { orders: true, buyRequestOffers: true } },
      },
    });

    if (!listing) return null;
    const activeOrderStatuses = new Set([
      "REQUESTED",
      "ESCROW_LOCKED",
      "SELLER_RESPONSE_PENDING",
      "DELIVERY_IN_PROGRESS",
      "DELIVERY_COMPLETED",
      "BUYER_CONFIRM_PENDING",
    ]);
    const activeOrderCount = listing.orders.filter((order) =>
      activeOrderStatuses.has(order.status),
    ).length;
    const disputeOrderCount = listing.orders.filter((order) => order.status === "DISPUTED").length;

    return {
      kind: "sell" as const,
      id: listing.id,
      title: listing.title,
      description: listing.description ?? "",
      category: listing.category,
      status: listing.status,
      ownerId: listing.seller.id,
      ownerName: listing.seller.displayName || listing.seller.email,
      ownerEmail: listing.seller.email,
      gameName: listing.game.name,
      serverName: listing.server?.name ?? "서버 없음",
      serverDetail: listing.serverDetail ?? "",
      gameNickname: listing.sellerGameNickname ?? "",
      accountTransferType: listing.accountTransferType ?? "",
      tradeMode: listing.tradeMode,
      priceUnitQuantity: listing.priceUnitQuantity.toString(),
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
      totalQuantity: listing.inventory?.totalQuantity.toString() ?? "0",
      minimumQuantity: listing.inventory?.minimumQuantity.toString() ?? "0",
      availableQuantity: listing.inventory?.availableQuantity.toString() ?? "0",
      lockedQuantity: listing.inventory?.lockedQuantity.toString() ?? "0",
      soldQuantity: listing.inventory?.soldQuantity.toString() ?? "0",
      premiumStartedAt: listing.premiumStartedAt ? formatDateTime(listing.premiumStartedAt) : "-",
      premiumEndsAt: listing.premiumEndsAt ? formatDateTime(listing.premiumEndsAt) : "-",
      createdAt: formatDateTime(listing.createdAt),
      updatedAt: formatDateTime(listing.updatedAt),
      orderCount: listing._count.orders,
      activeOrderCount,
      disputeOrderCount,
      offerCount: listing._count.buyRequestOffers,
      images: listing.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        altText: image.altText ?? "본문 이미지",
      })),
      auditHref: `/admin/audit?targetType=LISTING&query=${listing.id}`,
      userHref: `/admin/users/${listing.seller.id}`,
    };
  }

  const request = await prisma.buyRequest.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, email: true, displayName: true } },
      images: { orderBy: { sortOrder: "asc" } },
      _count: { select: { offers: true } },
    },
  });

  if (!request) return null;

  const [game, server] = await Promise.all([
    prisma.game.findUnique({
      where: { id: request.gameId },
      select: { name: true, moneyUnitName: true },
    }),
    request.serverId
      ? prisma.gameServer.findUnique({
          where: { id: request.serverId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    kind: "buy" as const,
    id: request.id,
    title: request.title || "구매글 제목 없음",
    description: request.description ?? "",
    category: request.category,
    status: request.status,
    ownerId: request.buyer.id,
    ownerName: request.buyer.displayName || request.buyer.email,
    ownerEmail: request.buyer.email,
    gameName: game?.name ?? "알 수 없는 게임",
    serverName: server?.name ?? "서버 없음",
    serverDetail: request.serverDetail ?? "",
    gameNickname: request.buyerGameNickname ?? "",
    accountTransferType: request.accountTransferType ?? "",
    accountRank: request.accountRank ?? "",
    tradeMode: request.tradeMode,
    priceUnitQuantity: request.priceUnitQuantity.toString(),
    unitPrice: request.unitPrice.toString(),
    quantity: request.quantity.toString(),
    minimumQuantity: request.minimumQuantity.toString(),
    remainingQuantity: request.remainingQuantity.toString(),
    totalAmount: request.totalAmount.toString(),
    lockAmount: request.lockAmount.toString(),
    currency: request.currency,
    premiumStartedAt: request.premiumStartedAt ? formatDateTime(request.premiumStartedAt) : "-",
    premiumEndsAt: request.premiumEndsAt ? formatDateTime(request.premiumEndsAt) : "-",
    expiresAt: request.expiresAt ? formatDateTime(request.expiresAt) : "-",
    createdAt: formatDateTime(request.createdAt),
    updatedAt: formatDateTime(request.updatedAt),
    offerCount: request._count.offers,
    images: request.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText ?? "본문 이미지",
    })),
    auditHref: `/admin/audit?targetType=BUY_REQUEST&query=${request.id}`,
    userHref: `/admin/users/${request.buyer.id}`,
    actionLocked: request.status === "ACTIVE" && Number(request.lockAmount) > 0,
  };
}

function buildListingWhere(filters: {
  status: string;
  category: string;
  query: string;
}): Prisma.ListingWhereInput {
  return {
    ...(filters.status !== "ALL" && SELL_STATUSES.includes(filters.status as never)
      ? { status: filters.status as never }
      : {}),
    ...(filters.category !== "ALL" ? { category: filters.category as never } : {}),
    ...(filters.query
      ? {
          OR: [
            { id: { contains: filters.query, mode: "insensitive" } },
            { title: { contains: filters.query, mode: "insensitive" } },
            { seller: { email: { contains: filters.query, mode: "insensitive" } } },
            { seller: { displayName: { contains: filters.query, mode: "insensitive" } } },
            { game: { name: { contains: filters.query, mode: "insensitive" } } },
            { server: { name: { contains: filters.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

function buildBuyRequestWhere(filters: {
  status: string;
  category: string;
  query: string;
}): Prisma.BuyRequestWhereInput {
  return {
    ...(filters.status !== "ALL" && BUY_STATUSES.includes(filters.status as never)
      ? { status: filters.status as never }
      : {}),
    ...(filters.category !== "ALL" ? { category: filters.category as never } : {}),
    ...(filters.query
      ? {
          OR: [
            { id: { contains: filters.query, mode: "insensitive" } },
            { title: { contains: filters.query, mode: "insensitive" } },
            { buyer: { email: { contains: filters.query, mode: "insensitive" } } },
            { buyer: { displayName: { contains: filters.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

function normalizeMode(value: string | null | undefined) {
  if (value === "SELL" || value === "BUY") return value;
  return "ALL";
}

function countAll(rows: Array<{ _count: number }>) {
  return rows.reduce((sum, row) => sum + row._count, 0);
}

function countStatus(rows: Array<{ status: string; _count: number }>, status: string) {
  return rows.find((row) => row.status === status)?._count ?? 0;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(value);
}
