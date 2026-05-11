import { getPrismaClient } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import { lockPurchaseQuantity } from "@/lib/inventory/purchase-lock";
import { calculateMarketplacePurchaseAmount } from "@/lib/market/purchase-calculation";
import { calculateMarketplaceOrderFees } from "@/lib/market/order-fees";
import { getCurrentUserEmailForRole } from "@/lib/auth/session";
import {
  assertGameMoneyQuantityUnit,
  getGameMoneyUnitName,
} from "@/lib/market/trade-unit";
import { normalizeAccountTransferType } from "@/lib/market/account-transfer-types";
import { isPremiumActive } from "@/lib/market/premium-promotion";
import {
  type GameCatalogOption,
  type LocalizedGameNames,
  mapGameLocalizedNames,
} from "@/lib/market/game-localization";
import { resolveGameNameFilter } from "@/lib/market/game-name-filter";
import { normalizeServerDetail } from "@/lib/market/server-detail-options";

const MARKET_USER_EMAIL = "user-demo@ggitem.local";
const MARKET_USER_ROLES = ["CUSTOMER", "SELLER"];
const ORDER_NUMBER_RANDOM_LENGTH = 6;

export type MarketplaceListingSummary = {
  listingId: string;
  sellerId: string;
  title: string;
  primaryImageUrl: string | null;
  sellerName: string;
  sellerReviewSummary: SellerReviewSummary;
  gameName: string;
  gameCode: string;
  gameImageUrl: string | null;
  gameLocalizedNames: LocalizedGameNames;
  moneyUnitName: string;
  serverName: string | null;
  serverDetail: string | null;
  category: string;
  accountTransferType: string | null;
  categoryLabel: string;
  settlementLabel: string;
  minimumQuantity: string;
  availableQuantity: string;
  lockedQuantity: string;
  soldQuantity: string;
  unitPrice: string;
  currency: string;
  isPremium: boolean;
  premiumEndsAt: string | null;
  premiumDurationHours: number | null;
  premiumFeeAmount: string | null;
  createdAt: string;
};

export type MarketplaceListingDetail = MarketplaceListingSummary & {
  totalQuantity: string;
  description: string | null;
  status: string;
  gameName: string;
  sellerId: string;
  primaryImageAlt: string | null;
  sellerRecentReviews: SellerRecentReview[];
  relatedListings: MarketplaceListingSummary[];
};

type SellerReviewSummary = {
  averageRating: string;
  reviewCount: number;
};

type SellerRecentReview = {
  reviewId: string;
  rating: number;
  comment: string | null;
  buyerName: string;
  orderNumber: string;
  createdAt: string;
};

export type MarketplacePurchaseResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  quantity: string;
  amount: string;
  buyerWallet: {
    availableBalance: string;
    escrowBalance: string;
    currency: string;
  };
  inventory: {
    availableQuantity: string;
    lockedQuantity: string;
    soldQuantity: string;
  };
};

export type MarketplaceListingFilters = {
  query?: string;
  game?: string;
  category?: string;
  accountTransferType?: string;
  sort?: string;
  server?: string;
  serverDetail?: string;
  limit?: number;
};

export type MarketplaceListingsView = {
  listings: MarketplaceListingSummary[];
  filterOptions: {
    games: string[];
    gameOptions: GameCatalogOption[];
    serverOptions: string[];
    categories: string[];
  };
  appliedFilters: {
    query: string;
    game: string;
    category: string;
    accountTransferType: string;
    sort: string;
    server: string;
    serverDetail: string;
  };
};

export async function getMarketplaceListings(
  filters?: MarketplaceListingFilters,
): Promise<MarketplaceListingsView> {
  const prisma = getPrismaClient();
  const normalizedQuery = filters?.query?.trim() ?? "";
  const gameFilter = await resolveGameNameFilter(prisma, filters?.game);
  const normalizedGame = gameFilter.gameName;
  const normalizedCategory = filters?.category?.trim() ?? "";
  const normalizedAccountTransferType = normalizeAccountTransferType(
    filters?.accountTransferType,
  );
  const normalizedSort = filters?.sort?.trim() || "latest";
  const normalizedServer = filters?.server?.trim() ?? "";
  const take = clampListingLimit(filters?.limit ?? 100);
  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    game: {
      isActive: true,
    },
    server: {
      is: {
        isActive: true,
      },
    },
    inventory: {
      is: {
        availableQuantity: {
          gt: 0,
        },
      },
    },
  };

  if (normalizedCategory) {
    where.category = normalizedCategory as never;
  }

  if (normalizedCategory === "GAME_ACCOUNT" && normalizedAccountTransferType) {
    where.accountTransferType = normalizedAccountTransferType;
  }

  if (normalizedGame) {
    where.game = {
      isActive: true,
      name: normalizedGame,
    };
  }

  if (normalizedServer) {
    where.server = {
      is: {
        isActive: true,
        name: normalizedServer,
      },
    };
  }

  if (filters?.serverDetail) {
    const normalizedServerDetail = normalizeServerDetail(
      filters.serverDetail,
      gameFilter.gameCode,
    );

    if (normalizedServerDetail) {
      where.serverDetail = normalizedServerDetail;
    }
  }

  if (normalizedQuery) {
    where.OR = [
      {
        title: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      {
        seller: {
          displayName: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  const [listings, allActiveListings, activeGames] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        seller: true,
        inventory: true,
        game: true,
        server: true,
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          take: 1,
        },
      },
      orderBy: getListingOrderBy(normalizedSort),
      take,
    }),
    prisma.listing.findMany({
      where: {
        status: "ACTIVE",
        game: {
          isActive: true,
        },
        server: {
          is: {
            isActive: true,
          },
        },
        inventory: {
          is: {
            availableQuantity: {
              gt: 0,
            },
          },
        },
      },
      select: {
        category: true,
        game: {
          select: {
            name: true,
            code: true,
            imageUrl: true,
            nameKo: true,
            nameCn: true,
            nameVn: true,
            namePh: true,
            nameTh: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.game.findMany({
      where: {
        isActive: true,
        servers: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        name: true,
        code: true,
        imageUrl: true,
        nameKo: true,
        nameCn: true,
        nameVn: true,
        namePh: true,
        nameTh: true,
        servers: {
          where: {
            isActive: true,
          },
          select: {
            name: true,
          },
          orderBy: {
            code: "asc",
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const sortedListings = [...listings].sort((left, right) => {
    if (normalizedSort === "price_low") {
      return left.unitPrice.comparedTo(right.unitPrice);
    }

    if (normalizedSort === "price_high") {
      return right.unitPrice.comparedTo(left.unitPrice);
    }

    if (normalizedSort === "quantity_high") {
      const leftAvailable = left.inventory?.availableQuantity ?? 0;
      const rightAvailable = right.inventory?.availableQuantity ?? 0;
      return Number(rightAvailable) - Number(leftAvailable);
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
  const sellerReviewSummaries = await getSellerReviewSummaries(
    prisma,
    sortedListings.map((listing) => listing.sellerId),
  );

  return {
    listings: sortedListings.map((listing) => ({
      listingId: listing.id,
      sellerId: listing.sellerId,
      title: listing.title,
      primaryImageUrl: listing.images[0]?.imageUrl ?? null,
      sellerName: listing.seller.displayName,
      sellerReviewSummary: getSellerReviewSummary(
        sellerReviewSummaries,
        listing.sellerId,
      ),
      gameName: listing.game.name,
      gameCode: listing.game.code,
      gameImageUrl: listing.game.imageUrl,
      gameLocalizedNames: mapGameLocalizedNames(listing.game),
      moneyUnitName: getGameMoneyUnitName(listing.game.moneyUnitName, listing.game.name),
      serverName: listing.server?.name ?? null,
      serverDetail: listing.serverDetail ?? null,
      category: listing.category,
      accountTransferType: listing.accountTransferType ?? null,
      categoryLabel: getCategoryLabel(listing.category),
      settlementLabel: getSettlementLabel(listing.category),
      minimumQuantity: listing.inventory?.minimumQuantity?.toString() ?? "1",
      availableQuantity: listing.inventory?.availableQuantity?.toString() ?? "0",
      lockedQuantity: listing.inventory?.lockedQuantity?.toString() ?? "0",
      soldQuantity: listing.inventory?.soldQuantity?.toString() ?? "0",
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
      isPremium: isPremiumActive(listing.premiumEndsAt),
      premiumEndsAt: listing.premiumEndsAt ? formatKoreanDate(listing.premiumEndsAt) : null,
      premiumDurationHours: listing.premiumDurationHours,
      premiumFeeAmount: listing.premiumFeeAmount?.toString() ?? null,
      createdAt: formatKoreanDate(listing.createdAt),
    })),
    filterOptions: {
      games: activeGames.map((game) => game.name),
      gameOptions: mapGameOptions(activeGames),
      serverOptions: getServerOptionsForGame(activeGames, normalizedGame),
      categories: Array.from(
        new Set(allActiveListings.map((listing) => listing.category)),
      ),
    },
    appliedFilters: {
      query: normalizedQuery,
      game: normalizedGame,
      category: normalizedCategory,
      accountTransferType: normalizedAccountTransferType ?? "",
      sort: normalizedSort,
      server: normalizedServer,
      serverDetail: filters?.serverDetail?.trim() ?? "",
    },
  };
}

function clampListingLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function getListingOrderBy(sort: string): Prisma.ListingOrderByWithRelationInput {
  if (sort === "price_low") {
    return { unitPrice: "asc" };
  }

  if (sort === "price_high") {
    return { unitPrice: "desc" };
  }

  return { createdAt: "desc" };
}

function mapGameOptions(
  games: Array<{
    name: string;
    code: string;
    imageUrl: string | null;
    nameKo?: string | null;
    nameCn?: string | null;
    nameVn?: string | null;
    namePh?: string | null;
    nameTh?: string | null;
  }>,
): GameCatalogOption[] {
  const seen = new Set<string>();
  const options: GameCatalogOption[] = [];

  for (const game of games) {
    if (seen.has(game.name)) {
      continue;
    }

    seen.add(game.name);
    options.push({
      name: game.name,
      code: game.code,
      imageUrl: game.imageUrl,
      region: getGameRegion(game.name),
      localizedNames: mapGameLocalizedNames(game),
    });
  }

  return options;
}

function getServerOptionsForGame(
  games: Array<{
    name: string;
    servers?: Array<{
      name: string;
    }>;
  }>,
  gameName: string,
) {
  if (!gameName) {
    return [];
  }

  const game = games.find((item) => item.name === gameName);
  return game?.servers?.map((server) => server.name) ?? [];
}

function getGameRegion(gameName: string) {
  if (
    gameName.includes("Lineage") ||
    gameName.includes("Lord Nine") ||
    gameName.includes("Night Crows") ||
    gameName.includes("Vampir")
  ) {
    return "KR";
  }

  if (gameName.includes("Dungeon")) {
    return "KR/CN";
  }

  return "Global";
}

export async function getMarketplaceListingDetail(
  listingId: string,
): Promise<MarketplaceListingDetail | null> {
  const prisma = getPrismaClient();
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      seller: true,
      inventory: true,
      game: true,
      server: true,
      images: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
    },
  });

  if (
    !listing ||
    !listing.inventory ||
    !listing.game.isActive ||
    !listing.server?.isActive ||
    listing.inventory.availableQuantity.comparedTo(0) <= 0
  ) {
    return null;
  }

  const relatedListings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      game: {
        isActive: true,
      },
      server: {
        is: {
          isActive: true,
        },
      },
      inventory: {
        is: {
          availableQuantity: {
            gt: 0,
          },
        },
      },
      id: {
        not: listing.id,
      },
      gameId: listing.gameId,
      category: listing.category,
    },
    include: {
      seller: true,
      inventory: true,
      game: true,
      server: true,
      images: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 4,
  });
  const sellerReviewSummaries = await getSellerReviewSummaries(prisma, [
    listing.sellerId,
    ...relatedListings.map((item) => item.sellerId),
  ]);
  const sellerRecentReviews = await prisma.orderReview.findMany({
    where: {
      sellerId: listing.sellerId,
      OR: [
        {
          moderation: null,
        },
        {
          moderation: {
            is: {
              status: {
                not: "HIDDEN",
              },
            },
          },
        },
      ],
    },
    include: {
      buyer: true,
      order: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  return {
    listingId: listing.id,
    title: listing.title,
    primaryImageUrl: listing.images[0]?.imageUrl ?? null,
    sellerName: listing.seller.displayName,
    sellerReviewSummary: getSellerReviewSummary(
      sellerReviewSummaries,
      listing.sellerId,
    ),
    sellerId: listing.sellerId,
    category: listing.category,
    accountTransferType: listing.accountTransferType ?? null,
    categoryLabel: getCategoryLabel(listing.category),
    settlementLabel: getSettlementLabel(listing.category),
    totalQuantity: listing.inventory.totalQuantity.toString(),
    minimumQuantity: listing.inventory.minimumQuantity?.toString() ?? "1",
    availableQuantity: listing.inventory.availableQuantity.toString(),
    lockedQuantity: listing.inventory.lockedQuantity.toString(),
    soldQuantity: listing.inventory.soldQuantity.toString(),
    unitPrice: listing.unitPrice.toString(),
    currency: listing.currency,
    isPremium: isPremiumActive(listing.premiumEndsAt),
    premiumEndsAt: listing.premiumEndsAt ? formatKoreanDate(listing.premiumEndsAt) : null,
    premiumDurationHours: listing.premiumDurationHours,
    premiumFeeAmount: listing.premiumFeeAmount?.toString() ?? null,
    createdAt: formatKoreanDate(listing.createdAt),
    description: listing.description,
    status: listing.status,
    gameName: listing.game.name,
    gameCode: listing.game.code,
    gameImageUrl: listing.game.imageUrl,
    gameLocalizedNames: mapGameLocalizedNames(listing.game),
    moneyUnitName: getGameMoneyUnitName(listing.game.moneyUnitName, listing.game.name),
    primaryImageAlt: listing.images[0]?.altText ?? null,
    serverName: listing.server?.name ?? null,
    serverDetail: listing.serverDetail ?? null,
    sellerRecentReviews: sellerRecentReviews.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      buyerName: review.buyer.displayName,
      orderNumber: review.order.orderNumber,
      createdAt: formatKoreanDate(review.createdAt),
    })),
    relatedListings: relatedListings.map((item) => ({
      listingId: item.id,
      sellerId: item.sellerId,
      title: item.title,
      primaryImageUrl: item.images[0]?.imageUrl ?? null,
      sellerName: item.seller.displayName,
      sellerReviewSummary: getSellerReviewSummary(
        sellerReviewSummaries,
        item.sellerId,
      ),
      gameName: item.game.name,
      gameCode: item.game.code,
      gameImageUrl: item.game.imageUrl,
      gameLocalizedNames: mapGameLocalizedNames(item.game),
      moneyUnitName: getGameMoneyUnitName(item.game.moneyUnitName, item.game.name),
      serverName: item.server?.name ?? null,
      serverDetail: item.serverDetail ?? null,
      category: item.category,
      accountTransferType: item.accountTransferType ?? null,
      categoryLabel: getCategoryLabel(item.category),
      settlementLabel: getSettlementLabel(item.category),
      minimumQuantity: item.inventory?.minimumQuantity?.toString() ?? "1",
      availableQuantity: item.inventory?.availableQuantity?.toString() ?? "0",
      lockedQuantity: item.inventory?.lockedQuantity?.toString() ?? "0",
      soldQuantity: item.inventory?.soldQuantity?.toString() ?? "0",
      unitPrice: item.unitPrice.toString(),
      currency: item.currency,
      isPremium: isPremiumActive(item.premiumEndsAt),
      premiumEndsAt: item.premiumEndsAt ? formatKoreanDate(item.premiumEndsAt) : null,
      premiumDurationHours: item.premiumDurationHours,
      premiumFeeAmount: item.premiumFeeAmount?.toString() ?? null,
      createdAt: formatKoreanDate(item.createdAt),
    })),
  };
}

export async function purchaseMarketplaceListing(input: {
  listingId: string;
  quantity: string;
  amount?: string;
}): Promise<MarketplacePurchaseResult> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.user.findUnique({
      where: { email: buyerEmail },
      include: { wallet: true },
    });

    if (!buyer?.wallet) {
      throw new Error("구매자 지갑을 찾을 수 없습니다.");
    }

    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
      include: {
        game: true,
        server: true,
        inventory: true,
      },
    });

    if (!listing?.inventory) {
      throw new Error("매물을 찾을 수 없습니다.");
    }

    if (listing.status !== "ACTIVE") {
      throw new Error("판매 중인 매물만 구매할 수 있습니다.");
    }

    if (!listing.game.isActive || !listing.server?.isActive) {
      throw new Error("현재 거래 가능한 게임/서버 매물만 구매할 수 있습니다.");
    }

    if (listing.sellerId === buyer.id) {
      throw new Error("본인이 등록한 매물은 구매할 수 없습니다.");
    }

    if (buyer.wallet.currency !== listing.currency) {
      throw new Error("지갑 통화와 매물 통화가 일치하지 않습니다.");
    }

    const purchaseQuantity = parseFixedAmount(input.quantity);
    const minimumQuantity = parseFixedAmount(
      listing.inventory.minimumQuantity?.toString() ?? "1",
    );
    const availableQuantity = parseFixedAmount(
      listing.inventory.availableQuantity.toString(),
    );

    assertGameMoneyQuantityUnit(listing.category, purchaseQuantity, "구매 수량");

    if (purchaseQuantity < minimumQuantity) {
      throw new Error("구매 수량이 매물의 최소 수량보다 적습니다.");
    }

    if (purchaseQuantity > availableQuantity) {
      throw new Error("구매 수량이 현재 구매 가능한 재고보다 많습니다.");
    }

    const expectedAmount = calculateMarketplacePurchaseAmount(
      input.quantity,
      listing.unitPrice.toString(),
    );
    const purchaseAmount = parseFixedAmount(expectedAmount);
    const buyerAvailable = parseFixedAmount(
      buyer.wallet.availableBalance.toString(),
    );
    const buyerWithdrawable = parseFixedAmount(
      buyer.wallet.withdrawableBalance.toString(),
    );
    const buyerEscrow = parseFixedAmount(
      buyer.wallet.escrowLockedBalance.toString(),
    );

    if (purchaseAmount <= 0n) {
      throw new Error("구매 금액은 0보다 커야 합니다.");
    }

    if (input.amount && formatFixedAmount(parseFixedAmount(input.amount)) !== expectedAmount) {
      throw new Error("제출한 구매 금액이 매물 가격과 일치하지 않습니다.");
    }

    if (buyerAvailable < purchaseAmount) {
      throw new Error("구매 가능한 보유 잔액이 부족합니다.");
    }

    if (buyerWithdrawable < purchaseAmount) {
      throw new Error("출금 가능 잔액이 부족해 구매할 수 없습니다.");
    }

    const feeBreakdown = calculateMarketplaceOrderFees(expectedAmount);

    const inventoryResult = lockPurchaseQuantity(
      {
        listingId: listing.id,
        totalQuantity: listing.inventory.totalQuantity.toString(),
        availableQuantity: listing.inventory.availableQuantity.toString(),
        lockedQuantity: listing.inventory.lockedQuantity.toString(),
        soldQuantity: listing.inventory.soldQuantity.toString(),
      },
      {
        listingId: listing.id,
        quantity: input.quantity,
        orderId: `market-order-${Date.now()}`,
      },
    );

    const walletLockUpdate = await tx.wallet.updateMany({
      where: {
        id: buyer.wallet.id,
        currency: listing.currency,
        availableBalance: {
          gte: expectedAmount,
        },
        withdrawableBalance: {
          gte: expectedAmount,
        },
      },
      data: {
        availableBalance: {
          decrement: expectedAmount,
        },
        withdrawableBalance: {
          decrement: expectedAmount,
        },
        escrowLockedBalance: {
          increment: expectedAmount,
        },
      },
    });

    if (walletLockUpdate.count !== 1) {
      throw new Error("구매 가능한 잔액이 부족하거나 이미 다른 거래에서 사용되었습니다.");
    }

    const inventoryLockUpdate = await tx.listingInventory.updateMany({
      where: {
        id: listing.inventory.id,
        version: listing.inventory.version,
        availableQuantity: {
          gte: input.quantity,
        },
      },
      data: {
        availableQuantity: {
          decrement: input.quantity,
        },
        lockedQuantity: {
          increment: input.quantity,
        },
        version: {
          increment: 1,
        },
      },
    });

    if (inventoryLockUpdate.count !== 1) {
      throw new Error("재고가 방금 변경되었습니다. 새로고침 후 다시 구매해 주세요.");
    }

    const order = await tx.order.create({
      data: {
        orderNumber: buildMarketplaceOrderNumber(),
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        listingId: listing.id,
        status: "ESCROW_LOCKED",
        quantity: input.quantity,
        unitPrice: listing.unitPrice.toString(),
        grossAmount: feeBreakdown.grossAmount,
        platformFeeAmount: feeBreakdown.platformFeeAmount,
        sellerReceivableAmount: feeBreakdown.sellerReceivableAmount,
        currency: listing.currency,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "ESCROW_LOCKED",
        message: "구매 금액이 에스크로에 잠기고 판매자에게 주문이 생성되었습니다.",
        metadata: {
          listingId: listing.id,
          quantity: input.quantity,
          amount: feeBreakdown.grossAmount,
          platformFeeAmount: feeBreakdown.platformFeeAmount,
          sellerReceivableAmount: feeBreakdown.sellerReceivableAmount,
        },
      },
    });

    await tx.chatRoom.create({
      data: {
        orderId: order.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          userId: listing.sellerId,
          type: "ORDER_STATUS",
          title: "새 판매 주문이 생성되었습니다.",
          body: `${listing.title} 매물에 새 주문이 생성되었습니다. 채팅에서 전달 정보를 확인해 주세요.`,
          href: `/my/listings/orders/${order.id}`,
          metadata: {
            orderId: order.id,
            listingId: listing.id,
          },
        },
        {
          userId: buyer.id,
          type: "ORDER_STATUS",
          title: "구매 주문이 생성되었습니다.",
          body: "구매 금액이 에스크로에 잠겼습니다. 주문 채팅에서 판매자와 전달 정보를 확인해 주세요.",
          href: `/my/orders/${order.id}`,
          metadata: {
            orderId: order.id,
            listingId: listing.id,
          },
        },
      ],
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyer.wallet.id,
          userId: buyer.id,
          type: "BUYER_ESCROW_LOCKED",
          direction: "DEBIT",
          bucket: "AVAILABLE",
          amount: expectedAmount,
          currency: listing.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매로 보유 잔액이 에스크로로 이동했습니다.",
        },
        {
          walletId: buyer.wallet.id,
          userId: buyer.id,
          type: "BUYER_ESCROW_LOCKED",
          direction: "CREDIT",
          bucket: "ESCROW_LOCKED",
          amount: expectedAmount,
          currency: listing.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매 금액이 구매자 에스크로에 잠겼습니다.",
        },
        {
          walletId: buyer.wallet.id,
          userId: buyer.id,
          type: "BUYER_ESCROW_LOCKED",
          direction: "DEBIT",
          bucket: "WITHDRAWABLE",
          amount: expectedAmount,
          currency: listing.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매 금액이 출금 가능 잔액에서 제외되었습니다.",
        },
      ],
    });

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: buyer.wallet.id },
    });
    const refreshedInventory = await tx.listingInventory.findUniqueOrThrow({
      where: { id: listing.inventory.id },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      quantity: order.quantity.toString(),
      amount: order.grossAmount.toString(),
      buyerWallet: {
        availableBalance: refreshedWallet.availableBalance.toString(),
        escrowBalance: refreshedWallet.escrowLockedBalance.toString(),
        currency: refreshedWallet.currency,
      },
      inventory: {
        availableQuantity: refreshedInventory.availableQuantity.toString(),
        lockedQuantity: refreshedInventory.lockedQuantity.toString(),
        soldQuantity: refreshedInventory.soldQuantity.toString(),
      },
    };
  });
}

function buildMarketplaceOrderNumber() {
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + ORDER_NUMBER_RANDOM_LENGTH)
    .toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function getCategoryLabel(category: string) {
  if (category === "GAME_MONEY") {
    return "게임머니";
  }

  if (category === "GAME_ITEM") {
    return "아이템";
  }

  if (category === "GAME_ACCOUNT") {
    return "계정";
  }

  return category;
}

function getSettlementLabel(category: string) {
  if (category === "GAME_ACCOUNT") {
    return "안전 계정 이전";
  }

  return "에스크로 후 채팅 전달";
}

async function getSellerReviewSummaries(
  prisma: ReturnType<typeof getPrismaClient>,
  sellerIds: string[],
) {
  const uniqueSellerIds = Array.from(new Set(sellerIds));

  if (uniqueSellerIds.length === 0) {
    return new Map<string, SellerReviewSummary>();
  }

  const groups = await prisma.orderReview.groupBy({
    by: ["sellerId"],
    where: {
      sellerId: {
        in: uniqueSellerIds,
      },
      OR: [
        {
          moderation: null,
        },
        {
          moderation: {
            is: {
              status: {
                not: "HIDDEN",
              },
            },
          },
        },
      ],
    },
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
  });

  return new Map(
    groups.map((group) => [
      group.sellerId,
      {
        averageRating: (group._avg.rating ?? 0).toFixed(1),
        reviewCount: group._count.rating,
      },
    ]),
  );
}

function getSellerReviewSummary(
  summaries: Map<string, SellerReviewSummary>,
  sellerId: string,
) {
  return (
    summaries.get(sellerId) ?? {
      averageRating: "0.0",
      reviewCount: 0,
    }
  );
}
