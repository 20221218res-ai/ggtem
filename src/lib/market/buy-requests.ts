import {
  getCurrentSessionUser,
  getCurrentUserEmailForRole,
} from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { ensureUserWallet } from "@/lib/market/wallets";
import { calculateMarketplaceOrderFees } from "@/lib/market/order-fees";
import {
  assertGameMoneyQuantityUnit,
  buildLocalizedMoneyUnitNames,
  getGameMoneyUnitName,
  normalizeGameMoneyPriceUnit,
  normalizeGameMoneyTradeMode,
  type MoneyUnitNameSource,
} from "@/lib/market/trade-unit";
import { normalizeAccountTransferType } from "@/lib/market/account-transfer-types";
import { assertNoOffPlatformContact } from "@/lib/risk/off-platform-contact";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import {
  calculatePremiumPromotionFee,
  formatPremiumPromotionFee,
  getPremiumPromotionWindow,
  isPremiumActive,
  normalizePremiumDurationHours,
} from "@/lib/market/premium-promotion";
import {
  type GameCatalogOption,
  type LocalizedGameNames,
  mapGameLocalizedNames,
} from "@/lib/market/game-localization";
import { getActiveGameCatalog } from "@/lib/market/listings";
import { resolveGameNameFilter } from "@/lib/market/game-name-filter";
import { normalizeServerDetail, validateServerDetail } from "@/lib/market/server-detail-options";

const MARKET_USER_EMAIL = "user-demo@ggitem.local";
const MARKET_USER_ROLES = ["CUSTOMER", "SELLER"];
const FIXED_AMOUNT_SCALE = 1_000_000n;

export type MarketplaceBuyRequestFormView = {
  buyerName: string;
  currency: string;
  wallet: {
    availableBalance: string;
    buyRequestLocked: string;
    escrowLockedBalance: string;
    currency: string;
  } | null;
  categoryOptions: Array<{
    value: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
    label: string;
  }>;
  games: Array<{
    gameId: string;
    code: string;
    name: string;
    moneyUnitName: MoneyUnitNameSource;
    localizedNames: LocalizedGameNames;
    servers: Array<{
      serverId: string;
      name: string;
    }>;
  }>;
};

export type MarketplaceBuyRequestCreateResult = {
  buyRequestId: string;
  status: string;
  totalAmount: string;
  message: string;
};

export type MarketplaceBuyRequestSummary = {
  buyRequestId: string;
  buyerId: string;
  buyerName: string;
  gameName: string;
  gameCode: string;
  gameImageUrl: string | null;
  gameLocalizedNames: LocalizedGameNames;
  moneyUnitName: MoneyUnitNameSource;
  serverName: string | null;
  serverDetail: string | null;
  category: string;
  categoryLabel: string;
  title: string | null;
  description: string | null;
  contentImages: Array<{
    imageId: string;
    imageUrl: string;
    altText: string | null;
  }>;
  accountTransferType: string | null;
  accountRank: string | null;
  buyerGameNickname: string | null;
  tradeMode: string;
  priceUnitQuantity: string;
  quantity: string;
  minimumQuantity: string;
  remainingQuantity: string;
  unitPrice: string;
  totalAmount: string;
  lockAmount: string;
  currency: string;
  status: string;
  expiresAt: string | null;
  isPremium: boolean;
  premiumEndsAt: string | null;
  premiumDurationHours: number | null;
  premiumFeeAmount: string | null;
  createdAt: string;
  offerCount: number;
  offers?: MarketplaceBuyRequestOfferSummary[];
};

export type MarketplaceBuyRequestOfferSummary = {
  offerId: string;
  listingId: string | null;
  sellerName: string;
  listingTitle: string | null;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  currency: string;
  message: string | null;
  status: string;
  createdAt: string;
};

export type MarketplaceBuyRequestInstantSaleResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  buyRequestId: string;
  listingId: string;
  amount: string;
  currency: string;
  redirectHref: string;
  message: string;
};

export type MarketplaceBuyRequestsView = {
  buyRequests: MarketplaceBuyRequestSummary[];
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
    sort: string;
    accountTransferType: string;
    server: string;
    serverDetail: string;
  };
};

export type MarketplaceMyBuyRequestsView = {
  buyerName: string;
  summary: {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    canceledRequests: number;
    totalActiveAmount: string;
  };
  buyRequests: MarketplaceBuyRequestSummary[];
};

export type MarketplaceBuyRequestFilters = {
  query?: string;
  game?: string;
  server?: string;
  serverDetail?: string;
  category?: string;
  accountTransferType?: string;
  sort?: string;
  includeCategories?: boolean;
};

export type MarketplaceBuyRequestDetail = MarketplaceBuyRequestSummary;

type BuyRequestRow = {
  id: string;
  buyerId: string;
  gameId: string;
  serverId: string | null;
  serverDetail: string | null;
  category: string;
  title: string | null;
  description: string | null;
  accountTransferType: string | null;
  accountRank: string | null;
  buyerGameNickname: string | null;
  tradeMode?: string;
  priceUnitQuantity?: { toString(): string };
  quantity: { toString(): string };
  minimumQuantity?: { toString(): string };
  remainingQuantity?: { toString(): string };
  unitPrice: { toString(): string };
  totalAmount: { toString(): string };
  lockAmount: { toString(): string };
  currency: string;
  status: string;
  expiresAt: Date | null;
  premiumEndsAt: Date | null;
  premiumDurationHours: number | null;
  premiumFeeAmount: { toString(): string } | null;
  createdAt: Date;
  buyer: {
    displayName: string;
  };
  offers?: Array<{
    id: string;
    quantity: { toString(): string };
    unitPrice: { toString(): string };
    totalAmount: { toString(): string };
    currency: string;
    message: string | null;
    status: string;
    createdAt: Date;
    seller: {
      displayName: string;
    };
    listing: {
      id: string;
      title: string;
    } | null;
  }>;
  images?: Array<{
    id: string;
    imageUrl: string;
    altText: string | null;
  }>;
  _count?: {
    offers: number;
  };
};

export async function getMarketplaceBuyRequestFormView(): Promise<MarketplaceBuyRequestFormView> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const [buyer, games] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: buyerEmail,
      },
      select: {
        id: true,
        displayName: true,
      },
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
        id: true,
        code: true,
        name: true,
        nameKo: true,
        nameCn: true,
        nameVn: true,
        namePh: true,
        nameTh: true,
        moneyUnitName: true,
        moneyUnitNameKo: true,
        moneyUnitNameCn: true,
        moneyUnitNameVn: true,
        moneyUnitNamePh: true,
        moneyUnitNameTh: true,
        servers: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
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

  const buyerWallet = buyer ? await ensureUserWallet(buyer.id) : null;

  return {
    buyerName: buyer?.displayName ?? "구매자",
    currency: buyerWallet?.currency ?? "USDT",
    wallet: buyerWallet
      ? {
          availableBalance: buyerWallet.availableBalance.toString(),
          buyRequestLocked: buyerWallet.buyRequestLocked.toString(),
          escrowLockedBalance: buyerWallet.escrowLockedBalance.toString(),
          currency: buyerWallet.currency,
        }
      : null,
    categoryOptions: [
      { value: "GAME_MONEY", label: "게임머니" },
      { value: "GAME_ITEM", label: "아이템" },
      { value: "GAME_ACCOUNT", label: "계정" },
    ],
    games: games.map((game) => ({
      gameId: game.id,
      code: game.code,
      name: game.name,
      moneyUnitName: buildLocalizedMoneyUnitNames(game),
      localizedNames: mapGameLocalizedNames(game),
      servers: game.servers.map((server) => ({
        serverId: server.id,
        name: server.name,
      })),
    })),
  };
}

export async function getMarketplaceBuyRequests(
  filters?: MarketplaceBuyRequestFilters,
): Promise<MarketplaceBuyRequestsView> {
  const prisma = getPrismaClient();
  const normalizedQuery = filters?.query?.trim() ?? "";
  const gameFilter = await resolveGameNameFilter(prisma, filters?.game);
  const normalizedGame = gameFilter.gameName;
  const normalizedCategory = filters?.category?.trim() ?? "";
  const normalizedSort = filters?.sort?.trim() || "latest";
  const includeCategories = filters?.includeCategories !== false;
  const normalizedServer = filters?.server?.trim() ?? "";
  const normalizedAccountTransferType = normalizeAccountTransferType(
    filters?.accountTransferType,
  );
  const games = await getActiveGameCatalog();
  const gameById = new Map(games.map((item) => [item.id, item]));
  const serverById = new Map(
    games.flatMap((item) =>
      item.servers.map((server) => [server.id, server] as const),
    ),
  );
  const activeGameIds = games.map((item) => item.id);
  const activeServerIds = Array.from(serverById.keys());
  const game = normalizedGame
    ? games.find((item) => item.name === normalizedGame)
    : null;
  const normalizedServerDetail = normalizeServerDetail(
    filters?.serverDetail,
    game?.code,
  );
  const selectedServer = normalizedServer
    ? game?.servers.find((server) => server.name === normalizedServer)
    : null;

  const buyRequests = await prisma.buyRequest.findMany({
    where: {
      status: "ACTIVE",
      gameId: {
        in: normalizedGame
          ? [game?.id ?? "__missing_game__"]
          : activeGameIds.length > 0
            ? activeGameIds
            : ["__missing_game__"],
      },
      serverId: {
        in: selectedServer
          ? [selectedServer.id]
          : activeServerIds.length > 0
            ? activeServerIds
            : ["__missing_server__"],
      },
      ...(normalizedServerDetail ? { serverDetail: normalizedServerDetail } : {}),
      ...(normalizedCategory ? { category: normalizedCategory as never } : {}),
      ...(normalizedCategory === "GAME_ACCOUNT" && normalizedAccountTransferType
        ? { accountTransferType: normalizedAccountTransferType }
        : {}),
      ...(normalizedQuery
        ? {
            OR: [
              {
                title: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                buyer: {
                  displayName: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: getBuyRequestOrderBy(normalizedSort),
    select: {
      id: true,
      buyerId: true,
      gameId: true,
      serverId: true,
      serverDetail: true,
      category: true,
      title: true,
      description: true,
      accountTransferType: true,
      accountRank: true,
      buyerGameNickname: true,
      tradeMode: true,
      priceUnitQuantity: true,
      quantity: true,
      minimumQuantity: true,
      remainingQuantity: true,
      unitPrice: true,
      totalAmount: true,
      lockAmount: true,
      currency: true,
      status: true,
      expiresAt: true,
      premiumEndsAt: true,
      premiumDurationHours: true,
      premiumFeeAmount: true,
      createdAt: true,
      buyer: {
        select: {
          displayName: true,
        },
      },
      images: {
        select: {
          id: true,
          imageUrl: true,
          altText: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      _count: {
        select: {
          offers: true,
        },
      },
    },
    take: 100,
  });
  const sortedBuyRequests = [...buyRequests].sort((left, right) => {
    if (normalizedSort === "price_low") {
      const priceCompare = left.unitPrice.comparedTo(right.unitPrice);
      return priceCompare || comparePremiumThenCreated(left, right);
    }

    if (normalizedSort === "price_high") {
      const priceCompare = right.unitPrice.comparedTo(left.unitPrice);
      return priceCompare || comparePremiumThenCreated(left, right);
    }

    if (normalizedSort === "quantity_high") {
      return Number(right.quantity) - Number(left.quantity);
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
  const allActiveBuyRequests = includeCategories
    ? await prisma.buyRequest.findMany({
        where: {
          status: "ACTIVE",
          gameId: {
            in: activeGameIds.length > 0 ? activeGameIds : ["__missing_game__"],
          },
          serverId: {
            in:
              activeServerIds.length > 0
                ? activeServerIds
                : ["__missing_server__"],
          },
        },
        select: {
          category: true,
        },
        distinct: ["category"],
      })
    : [];

  return {
    buyRequests: sortedBuyRequests.map((request) =>
      mapBuyRequestSummary({
        request,
        gameById,
        serverById,
      }),
    ),
    filterOptions: {
      games: games.map((game) => game.name),
      gameOptions: mapGameOptions(games),
      serverOptions: getServerOptionsForGame(games, normalizedGame),
      categories: Array.from(
        new Set(allActiveBuyRequests.map((request) => request.category)),
      ),
    },
    appliedFilters: {
      query: normalizedQuery,
      game: normalizedGame,
      category: normalizedCategory,
      sort: normalizedSort,
      accountTransferType: normalizedAccountTransferType ?? "",
      server: normalizedServer,
      serverDetail: filters?.serverDetail?.trim() ?? "",
    },
  };
}

export async function getMarketplaceMyBuyRequests(): Promise<MarketplaceMyBuyRequestsView> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const [buyer, requests, games] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: sessionUser.userId,
      },
      select: {
        displayName: true,
      },
    }),
    prisma.buyRequest.findMany({
      where: {
        buyerId: sessionUser.userId,
      },
      select: {
        id: true,
        buyerId: true,
        gameId: true,
        serverId: true,
        serverDetail: true,
        category: true,
        title: true,
        description: true,
        accountTransferType: true,
        accountRank: true,
        buyerGameNickname: true,
        tradeMode: true,
        priceUnitQuantity: true,
        quantity: true,
        minimumQuantity: true,
        remainingQuantity: true,
        unitPrice: true,
        totalAmount: true,
        lockAmount: true,
        currency: true,
        status: true,
        expiresAt: true,
        premiumEndsAt: true,
        premiumDurationHours: true,
        premiumFeeAmount: true,
        createdAt: true,
        buyer: {
          select: {
            displayName: true,
          },
        },
        offers: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            currency: true,
            message: true,
            status: true,
            createdAt: true,
            seller: {
              select: {
                displayName: true,
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            altText: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        _count: {
          select: {
            offers: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.game.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        imageUrl: true,
        moneyUnitName: true,
        moneyUnitNameKo: true,
        moneyUnitNameCn: true,
        moneyUnitNameVn: true,
        moneyUnitNamePh: true,
        moneyUnitNameTh: true,
        nameKo: true,
        nameCn: true,
        nameVn: true,
        namePh: true,
        nameTh: true,
        servers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  const gameById = new Map(games.map((game) => [game.id, game]));
  const serverById = new Map(
    games.flatMap((game) =>
      game.servers.map((server) => [server.id, server] as const),
    ),
  );
  const activeRequests = requests.filter((request) => request.status === "ACTIVE");
  const totalActiveAmount = activeRequests.reduce(
    (sum, request) => sum + parseFixedAmount(request.totalAmount.toString()),
    0n,
  );

  return {
    buyerName: buyer?.displayName ?? sessionUser.displayName,
    summary: {
      totalRequests: requests.length,
      activeRequests: activeRequests.length,
      completedRequests: requests.filter((request) => request.status === "COMPLETED")
        .length,
      canceledRequests: requests.filter((request) => request.status === "CANCELED")
        .length,
      totalActiveAmount: formatFixedAmount(totalActiveAmount),
    },
    buyRequests: requests.map((request) =>
      mapBuyRequestSummary({
        request,
        gameById,
        serverById,
      }),
    ),
  };
}

export async function getMarketplaceBuyRequestDetail(
  buyRequestId: string,
): Promise<MarketplaceBuyRequestDetail | null> {
  const prisma = getPrismaClient();
  const [request, games] = await Promise.all([
    prisma.buyRequest.findFirst({
      where: {
        id: buyRequestId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        buyerId: true,
        gameId: true,
        serverId: true,
        serverDetail: true,
        category: true,
        title: true,
        description: true,
        accountTransferType: true,
        accountRank: true,
        buyerGameNickname: true,
        tradeMode: true,
        priceUnitQuantity: true,
        quantity: true,
        minimumQuantity: true,
        remainingQuantity: true,
        unitPrice: true,
        totalAmount: true,
        lockAmount: true,
        currency: true,
        status: true,
        expiresAt: true,
        premiumEndsAt: true,
        premiumDurationHours: true,
        premiumFeeAmount: true,
        createdAt: true,
        buyer: {
          select: {
            displayName: true,
          },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            altText: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        _count: {
          select: {
            offers: true,
          },
        },
      },
    }),
    getActiveGameCatalog(),
  ]);

  if (!request) {
    return null;
  }

  const gameById = new Map(games.map((game) => [game.id, game]));
  const serverById = new Map(
    games.flatMap((game) =>
      game.servers.map((server) => [server.id, server] as const),
    ),
  );

  return mapBuyRequestSummary({
    request,
    gameById,
    serverById,
  });
}

export async function createMarketplaceBuyRequest(input: {
  gameId: string;
  serverId?: string;
  serverDetail?: string;
  category: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
  title?: string;
  description?: string;
  accountTransferType?: string;
  accountRank?: string;
  buyerGameNickname?: string;
  quantity: string;
  unitPrice: string;
  pricePerUnit?: string;
  priceUnitQuantity?: string;
  tradeMode?: "BULK" | "SPLIT";
  minimumQuantity?: string;
  expiresInDays?: number;
  premiumDurationHours?: number;
}): Promise<MarketplaceBuyRequestCreateResult> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    include: {
      wallet: true,
    },
  });

  if (!buyer) {
    throw new Error("구매자 계정을 확인할 수 없습니다. 다시 로그인해 주세요.");
  }

  const buyerWallet = await ensureUserWallet(buyer.id);

  if (!buyerWallet) {
    throw new Error("지갑 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
  }

  const normalizedServerId = input.serverId?.trim() || null;
  const trimmedTitle = input.title?.trim() || null;
  const trimmedDescription = input.description?.trim() || null;
  const normalizedAccountTransferType = normalizeAccountTransferType(
    input.accountTransferType,
  );
  const trimmedAccountRank = input.accountRank?.trim() || null;
  const buyerGameNickname = normalizeTradeCharacterName(input.buyerGameNickname);
  const priceUnitQuantityValue =
    input.category === "GAME_MONEY"
      ? normalizeGameMoneyPriceUnit(input.priceUnitQuantity)
      : "1";
  const priceUnitQuantity = parseFixedAmount(priceUnitQuantityValue);
  const quantity = parseFixedAmount(input.quantity);
  const unitPrice =
    input.category === "GAME_MONEY" && input.pricePerUnit
      ? (parseFixedAmount(input.pricePerUnit) * FIXED_AMOUNT_SCALE) / priceUnitQuantity
      : parseFixedAmount(input.unitPrice);
  const tradeMode =
    input.category === "GAME_MONEY"
      ? normalizeGameMoneyTradeMode(input.tradeMode)
      : "BULK";
  const minimumQuantity =
    tradeMode === "BULK" ? quantity : parseFixedAmount(input.minimumQuantity || "1");
  const premiumDurationHours = normalizePremiumDurationHours(
    input.premiumDurationHours,
  );
  const premiumFeeAmount = calculatePremiumPromotionFee(premiumDurationHours);

  if (!normalizedServerId) {
    throw new Error("구매요청은 선택한 서버 1개 기준으로만 등록할 수 있습니다.");
  }

  if (!buyerGameNickname) {
    throw new Error("거래에 사용할 구매자 게임 ID를 입력해 주세요.");
  }

  if (quantity <= 0n) {
    throw new Error("수량은 0보다 커야 합니다.");
  }

  assertGameMoneyQuantityUnit(input.category, quantity, "구매 수량");
  assertGameMoneyQuantityUnit(input.category, minimumQuantity, "최소 판매 수량");

  if (unitPrice <= 0n) {
    throw new Error("단가는 0보다 커야 합니다.");
  }

  if (minimumQuantity <= 0n || minimumQuantity > quantity) {
    throw new Error("최소 판매 수량은 총 구매 수량보다 클 수 없습니다.");
  }

  if (input.category === "GAME_ACCOUNT" && !normalizedAccountTransferType) {
    throw new Error("계정 유형을 선택해 주세요.");
  }

  await assertNoOffPlatformContact(
    [trimmedTitle, trimmedDescription, trimmedAccountRank, buyerGameNickname]
      .filter(Boolean)
      .join("\n"),
    {
      actorUserId: buyer.id,
      sourceType: "BUY_REQUEST_DRAFT",
      sourceId: `buyer:${buyer.id}:${Date.now()}`,
      contentKind: "BUY_REQUEST",
    },
  );

  const game = await prisma.game.findUnique({
    where: {
      id: input.gameId,
    },
    include: {
      servers: {
        where: {
          isActive: true,
        },
      },
    },
  });

  if (!game || !game.isActive) {
    throw new Error("선택한 게임을 사용할 수 없습니다.");
  }

  if (!game.servers.some((server) => server.id === normalizedServerId)) {
    throw new Error("선택한 서버가 해당 게임에 속하지 않습니다.");
  }

  const normalizedServerDetail = validateServerDetail(input.serverDetail, game.code);
  const totalAmount = (quantity * unitPrice) / FIXED_AMOUNT_SCALE;
  const requiredAvailableAmount = totalAmount + premiumFeeAmount;
  const buyerAvailable = parseFixedAmount(buyerWallet.availableBalance.toString());
  const buyerWithdrawable = parseFixedAmount(
    buyerWallet.withdrawableBalance.toString(),
  );
  if (buyerAvailable < requiredAvailableAmount) {
    throw new Error("사용 가능 잔액이 부족합니다.");
  }

  if (buyerWithdrawable < requiredAvailableAmount) {
    throw new Error("출금 가능 잔액이 부족합니다.");
  }

  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const buyRequest = await prisma.$transaction(async (tx) => {
    const premiumWindow = getPremiumPromotionWindow(premiumDurationHours);
    const created = await tx.buyRequest.create({
      data: {
        buyerId: buyer.id,
        gameId: game.id,
        serverId: normalizedServerId,
        serverDetail: normalizedServerDetail,
        category: input.category,
        title: trimmedTitle,
        description: trimmedDescription,
        accountTransferType:
          input.category === "GAME_ACCOUNT" ? normalizedAccountTransferType : null,
        accountRank: input.category === "GAME_ACCOUNT" ? trimmedAccountRank : null,
        buyerGameNickname,
        tradeMode,
        priceUnitQuantity: formatFixedAmount(priceUnitQuantity),
        quantity: formatFixedAmount(quantity),
        minimumQuantity: formatFixedAmount(minimumQuantity),
        remainingQuantity: formatFixedAmount(quantity),
        unitPrice: formatFixedAmount(unitPrice),
        totalAmount: formatFixedAmount(totalAmount),
        lockAmount: formatFixedAmount(totalAmount),
        currency: buyerWallet.currency,
        status: "ACTIVE",
        expiresAt,
        premiumStartedAt: premiumWindow.premiumStartedAt,
        premiumEndsAt: premiumWindow.premiumEndsAt,
        premiumDurationHours: premiumDurationHours || null,
        premiumFeeAmount:
          premiumFeeAmount > 0n ? formatPremiumPromotionFee(premiumFeeAmount) : null,
      },
    });

    const walletLockUpdate = await tx.wallet.updateMany({
      where: {
        id: buyerWallet.id,
        currency: buyerWallet.currency,
        availableBalance: {
          gte: formatFixedAmount(requiredAvailableAmount),
        },
        withdrawableBalance: {
          gte: formatFixedAmount(requiredAvailableAmount),
        },
      },
      data: {
        availableBalance: {
          decrement: formatFixedAmount(requiredAvailableAmount),
        },
        withdrawableBalance: {
          decrement: formatFixedAmount(requiredAvailableAmount),
        },
        buyRequestLocked: {
          increment: formatFixedAmount(totalAmount),
        },
      },
    });

    if (walletLockUpdate.count !== 1) {
      throw new Error("구매요청 예치에 필요한 잔액이 부족하거나 이미 다른 거래에서 사용되었습니다.");
    }

    const premiumFee = formatPremiumPromotionFee(premiumFeeAmount);
    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: buyer.id,
          type: "BUY_REQUEST_LOCKED",
          direction: "DEBIT",
          bucket: "AVAILABLE",
          amount: formatFixedAmount(totalAmount),
          currency: buyerWallet.currency,
          referenceType: "BUY_REQUEST",
          referenceId: created.id,
          memo: "구매요청 등록으로 사용 가능 잔액이 예약되었습니다.",
        },
        {
          walletId: buyerWallet.id,
          userId: buyer.id,
          type: "BUY_REQUEST_LOCKED",
          direction: "CREDIT",
          bucket: "BUY_REQUEST_LOCKED",
          amount: formatFixedAmount(totalAmount),
          currency: buyerWallet.currency,
          referenceType: "BUY_REQUEST",
          referenceId: created.id,
          memo: "판매자 즉시판매를 위해 구매요청 예약금이 잠겼습니다.",
        },
        {
          walletId: buyerWallet.id,
          userId: buyer.id,
          type: "BUY_REQUEST_LOCKED",
          direction: "DEBIT",
          bucket: "WITHDRAWABLE",
          amount: formatFixedAmount(totalAmount),
          currency: buyerWallet.currency,
          referenceType: "BUY_REQUEST",
          referenceId: created.id,
          memo: "구매요청 예약금은 출금 가능 잔액에서 제외되었습니다.",
        },
        ...(premiumFeeAmount > 0n
          ? [
              {
                walletId: buyerWallet.id,
                userId: buyer.id,
                type: "PREMIUM_PROMOTION_PURCHASED" as const,
                direction: "DEBIT" as const,
                bucket: "AVAILABLE" as const,
                amount: premiumFee,
                currency: buyerWallet.currency,
                referenceType: "BUY_REQUEST",
                referenceId: created.id,
                memo: `${premiumDurationHours}시간 프리미엄 구매글 이용료가 차감되었습니다.`,
              },
              {
                walletId: buyerWallet.id,
                userId: buyer.id,
                type: "PREMIUM_PROMOTION_PURCHASED" as const,
                direction: "DEBIT" as const,
                bucket: "WITHDRAWABLE" as const,
                amount: premiumFee,
                currency: buyerWallet.currency,
                referenceType: "BUY_REQUEST",
                referenceId: created.id,
                memo: "프리미엄 구매글 이용료가 출금 가능 잔액에서 제외되었습니다.",
              },
              {
                walletId: buyerWallet.id,
                userId: buyer.id,
                type: "PREMIUM_PROMOTION_PURCHASED" as const,
                direction: "CREDIT" as const,
                bucket: "PLATFORM_REVENUE" as const,
                amount: premiumFee,
                currency: buyerWallet.currency,
                referenceType: "BUY_REQUEST",
                referenceId: created.id,
                memo: "프리미엄 구매글 이용료가 플랫폼 수익으로 확정되었습니다.",
              },
            ]
          : []),
      ],
    });

    return created;
  });

  return {
    buyRequestId: buyRequest.id,
    status: buyRequest.status,
    totalAmount: buyRequest.totalAmount.toString(),
    message:
      premiumFeeAmount > 0n
        ? `구매글이 등록되었습니다. 프리미엄 ${premiumDurationHours}시간이 적용되었습니다.`
        : "구매요청이 등록되었습니다.",
  };
}

export async function cancelMarketplaceBuyRequest(input: {
  buyRequestId: string;
}) {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const request = await prisma.buyRequest.findFirst({
    where: {
      id: input.buyRequestId,
      buyerId: sessionUser.userId,
    },
    include: {
      buyer: {
        include: {
          wallet: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("구매요청을 찾을 수 없습니다.");
  }

  if (request.status !== "ACTIVE") {
    throw new Error("모집 중인 구매요청만 취소할 수 있습니다.");
  }

  if (!request.buyer.wallet) {
    throw new Error("지갑 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
  }
  const requestBuyerWallet = request.buyer.wallet;

  const lockAmount = parseFixedAmount(request.lockAmount.toString());
  const buyerAvailable = parseFixedAmount(
    requestBuyerWallet.availableBalance.toString(),
  );
  const buyerWithdrawable = parseFixedAmount(
    requestBuyerWallet.withdrawableBalance.toString(),
  );
  const buyerBuyRequestLocked = parseFixedAmount(
    requestBuyerWallet.buyRequestLocked.toString(),
  );

  if (buyerBuyRequestLocked < lockAmount) {
    throw new Error("구매요청 예약금 상태가 일치하지 않습니다.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const canceled = await tx.buyRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "CANCELED",
        lockAmount: "0",
      },
    });

    if (lockAmount > 0n) {
      await tx.wallet.update({
        where: {
          id: requestBuyerWallet.id,
        },
        data: {
          availableBalance: formatFixedAmount(buyerAvailable + lockAmount),
          withdrawableBalance: formatFixedAmount(
            buyerWithdrawable + lockAmount,
          ),
          buyRequestLocked: formatFixedAmount(
            buyerBuyRequestLocked - lockAmount,
          ),
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: requestBuyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "DEBIT",
            bucket: "BUY_REQUEST_LOCKED",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: "구매요청 취소로 예약금 잠금이 해제되었습니다.",
          },
          {
            walletId: requestBuyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: "구매요청 취소로 예약금이 사용 가능 잔액으로 반환되었습니다.",
          },
          {
            walletId: requestBuyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: "구매요청 취소로 예약금이 출금 가능 잔액으로 반환되었습니다.",
          },
        ],
      });
    }

    return canceled;
  });

  return {
    buyRequestId: updated.id,
    status: updated.status,
    message: "구매요청을 취소했습니다.",
  };
}

export async function getMarketplaceMyBuyRequestEditorView(
  buyRequestId: string,
): Promise<MarketplaceBuyRequestSummary | null> {
  const view = await getMarketplaceMyBuyRequests();
  return view.buyRequests.find((request) => request.buyRequestId === buyRequestId) ?? null;
}

export async function updateMarketplaceBuyRequestContent(input: {
  buyRequestId: string;
  title?: string;
  description?: string;
  accountRank?: string;
  buyerGameNickname?: string;
}): Promise<MarketplaceBuyRequestCreateResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const trimmedTitle = input.title?.trim() || null;
  const trimmedDescription = input.description?.trim() || null;
  const trimmedAccountRank = input.accountRank?.trim() || null;
  const buyerGameNickname = normalizeTradeCharacterName(input.buyerGameNickname);

  if (!trimmedTitle || trimmedTitle.length < 4) {
    throw new Error("구매글 제목은 4자 이상 입력해 주세요.");
  }

  if (!buyerGameNickname) {
    throw new Error("거래에 사용할 구매자 게임 ID를 입력해 주세요.");
  }

  const existingRequest = await prisma.buyRequest.findFirst({
    where: {
      id: input.buyRequestId,
      buyerId: sessionUser.userId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      category: true,
      totalAmount: true,
    },
  });

  if (!existingRequest) {
    throw new Error("수정 가능한 구매글을 찾을 수 없습니다.");
  }

  if (existingRequest.category === "GAME_ACCOUNT") {
    if (!trimmedAccountRank || trimmedAccountRank.length < 2) {
      throw new Error("계정 구매 조건을 입력해 주세요.");
    }

    if (!trimmedDescription || trimmedDescription.length < 10) {
      throw new Error("계정 구매 상세 조건을 10자 이상 입력해 주세요.");
    }
  } else if (!trimmedDescription || trimmedDescription.length < 6) {
    throw new Error("구매 조건을 6자 이상 입력해 주세요.");
  }

  const updated = await prisma.buyRequest.update({
    where: {
      id: existingRequest.id,
    },
    data: {
      title: trimmedTitle,
      description: trimmedDescription,
      accountRank: existingRequest.category === "GAME_ACCOUNT" ? trimmedAccountRank : null,
      buyerGameNickname,
    },
    select: {
      id: true,
      status: true,
      totalAmount: true,
    },
  });

  return {
    buyRequestId: updated.id,
    status: updated.status,
    totalAmount: updated.totalAmount.toString(),
    message: "구매글을 수정했습니다.",
  };
}

export async function createMarketplaceBuyRequestOffer(input: {
  buyRequestId: string;
  listingId?: string;
  quantity: string;
  unitPrice: string;
  message?: string;
}) {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const normalizedListingId = input.listingId?.trim() || null;
  const quantity = parseFixedAmount(input.quantity);
  const unitPrice = parseFixedAmount(input.unitPrice);
  const message = input.message?.trim() || null;

  if (quantity <= 0n) {
    throw new Error("수량은 0보다 커야 합니다.");
  }

  if (unitPrice <= 0n) {
    throw new Error("단가는 0보다 커야 합니다.");
  }

  const buyRequest = await prisma.buyRequest.findUnique({
    where: {
      id: input.buyRequestId,
    },
  });

  if (!buyRequest || buyRequest.status !== "ACTIVE") {
    throw new Error("모집 중인 구매요청에만 판매 제안을 보낼 수 있습니다.");
  }

  assertGameMoneyQuantityUnit(buyRequest.category, quantity, "판매 제안 수량");

  if (buyRequest.buyerId === sessionUser.userId) {
    throw new Error("본인이 등록한 구매요청에는 판매할 수 없습니다.");
  }

  await assertNoOffPlatformContact(message ?? "", {
    actorUserId: sessionUser.userId,
    targetUserId: buyRequest.buyerId,
    sourceType: "BUY_REQUEST_OFFER",
    sourceId: `offer:${input.buyRequestId}:${sessionUser.userId}:${Date.now()}`,
    contentKind: "BUY_REQUEST",
  });

  let listing: {
    id: string;
    sellerId: string;
    gameId: string;
    serverId: string | null;
    serverDetail: string | null;
    category: string;
    status: string;
    currency: string;
  } | null = null;

  if (normalizedListingId) {
    listing = await prisma.listing.findFirst({
      where: {
        id: normalizedListingId,
        sellerId: sessionUser.userId,
      },
      select: {
        id: true,
        sellerId: true,
        gameId: true,
        serverId: true,
        serverDetail: true,
        category: true,
        status: true,
        currency: true,
      },
    });

    if (!listing) {
      throw new Error("선택한 판매글을 찾을 수 없습니다.");
    }

    if (listing.status !== "ACTIVE") {
      throw new Error("판매중인 글만 제안할 수 있습니다.");
    }

    if (
      listing.gameId !== buyRequest.gameId ||
      listing.serverId !== buyRequest.serverId ||
      (listing.serverDetail ?? null) !== (buyRequest.serverDetail ?? null) ||
      listing.category !== buyRequest.category
    ) {
      throw new Error("선택한 판매글이 이 구매요청 조건과 일치하지 않습니다.");
    }
  }

  const totalAmount = (quantity * unitPrice) / FIXED_AMOUNT_SCALE;
  const offer = await prisma.buyRequestOffer.create({
    data: {
      buyRequestId: buyRequest.id,
      sellerId: sessionUser.userId,
      listingId: listing?.id ?? null,
      quantity: formatFixedAmount(quantity),
      unitPrice: formatFixedAmount(unitPrice),
      totalAmount: formatFixedAmount(totalAmount),
      currency: listing?.currency ?? buyRequest.currency,
      message,
      status: "PENDING",
    },
  });

  return {
    offerId: offer.id,
    status: offer.status,
    totalAmount: offer.totalAmount.toString(),
    message: "판매 제안이 등록되었습니다.",
  };
}

function buildBuyRequestOrderNumber() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-BR-${Date.now()}-${suffix}`;
}

function normalizeTradeCharacterName(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue.slice(0, 80) : null;
}

export async function sellToMarketplaceBuyRequest(input: {
  buyRequestId: string;
  quantity?: string;
  tradeCharacterName?: string;
}): Promise<MarketplaceBuyRequestInstantSaleResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const seller = await tx.user.findUnique({
      where: {
        id: sessionUser.userId,
      },
    });

    if (!seller) {
      throw new Error("판매자 계정을 확인할 수 없습니다.");
    }

    const buyRequest = await tx.buyRequest.findUnique({
      where: {
        id: input.buyRequestId,
      },
      include: {
        buyer: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!buyRequest) {
      throw new Error("구매요청을 찾을 수 없습니다.");
    }

    if (buyRequest.status !== "ACTIVE") {
      throw new Error("모집 중인 구매요청에만 즉시판매할 수 있습니다.");
    }

    if (buyRequest.expiresAt && buyRequest.expiresAt < new Date()) {
      throw new Error("모집 기간이 지난 구매요청에는 즉시판매할 수 없습니다.");
    }

    if (buyRequest.buyerId === seller.id) {
      throw new Error("본인이 등록한 구매요청에는 즉시판매할 수 없습니다.");
    }

    if (!buyRequest.buyer.wallet) {
      throw new Error("구매자 지갑 정보를 확인할 수 없습니다.");
    }

    if (buyRequest.buyer.wallet.currency !== buyRequest.currency) {
      throw new Error("구매자 지갑 통화가 구매요청 통화와 일치하지 않습니다.");
    }

    const sellerWallet = await tx.wallet.upsert({
      where: {
        userId: seller.id,
      },
      create: {
        userId: seller.id,
        currency: buyRequest.currency,
        availableBalance: "0",
        escrowLockedBalance: "0",
        buyRequestLocked: "0",
        pendingSettlement: "0",
        withdrawableBalance: "0",
        withdrawalLocked: "0",
      },
      update: {},
    });

    if (sellerWallet.currency !== buyRequest.currency) {
      throw new Error("판매자 지갑 통화가 구매요청 통화와 일치하지 않습니다.");
    }

    const requestQuantity = parseFixedAmount(buyRequest.quantity.toString());
    const remainingQuantity = parseFixedAmount(
      buyRequest.remainingQuantity?.toString() ?? buyRequest.quantity.toString(),
    );
    const minimumQuantity = parseFixedAmount(
      buyRequest.minimumQuantity?.toString() ?? buyRequest.quantity.toString(),
    );
    const requestUnitPrice = parseFixedAmount(buyRequest.unitPrice.toString());
    const saleQuantity = input.quantity
      ? parseFixedAmount(input.quantity)
      : remainingQuantity;
    const requestAmount = (saleQuantity * requestUnitPrice) / FIXED_AMOUNT_SCALE;
    const lockedRequestAmount = parseFixedAmount(buyRequest.lockAmount.toString());
    const buyerBuyRequestLocked = parseFixedAmount(
      buyRequest.buyer.wallet.buyRequestLocked.toString(),
    );
    if (requestAmount <= 0n) {
      throw new Error("구매요청 금액은 0보다 커야 합니다.");
    }

    if (requestQuantity <= 0n || requestUnitPrice <= 0n) {
      throw new Error("구매요청 수량과 단가를 확인할 수 없습니다.");
    }

    assertGameMoneyQuantityUnit(buyRequest.category, saleQuantity, "판매 수량");

    if (buyRequest.tradeMode === "BULK" && saleQuantity !== remainingQuantity) {
      throw new Error("일괄구매 요청에는 남은 전체 수량만 즉시판매할 수 있습니다.");
    }

    if (saleQuantity <= 0n || saleQuantity < minimumQuantity || saleQuantity > remainingQuantity) {
      throw new Error("판매 수량은 최소 판매 수량 이상, 남은 구매 수량 이하로 입력해 주세요.");
    }

    if (lockedRequestAmount < requestAmount) {
      throw new Error("구매요청 예치금이 판매 수량보다 부족합니다.");
    }

    if (buyerBuyRequestLocked < requestAmount) {
      throw new Error("구매요청 예약금이 부족합니다.");
    }

    const [requestGame, requestServer] = await Promise.all([
      tx.game.findUnique({
        where: {
          id: buyRequest.gameId,
        },
        select: {
          name: true,
          isActive: true,
        },
      }),
      buyRequest.serverId
        ? tx.gameServer.findUnique({
            where: {
              id: buyRequest.serverId,
            },
            select: {
              name: true,
              isActive: true,
            },
          })
        : null,
    ]);

    if (!requestGame?.isActive || !requestServer?.isActive) {
      throw new Error("현재 거래 가능한 게임/서버 구매요청에만 즉시판매할 수 있습니다.");
    }
    const listingTitle =
      buyRequest.title ||
      `${requestGame?.name ?? "게임"} ${requestServer?.name ?? ""} ${getCategoryLabel(
        buyRequest.category,
      )} 구매요청 즉시판매`.trim();
    const saleQuantityText = formatFixedAmount(saleQuantity);
    const requestAmountText = formatFixedAmount(requestAmount);
    const nextRemainingQuantity = remainingQuantity - saleQuantity;
    const nextLockAmount = lockedRequestAmount - requestAmount;
    const nextBuyRequestStatus = nextRemainingQuantity <= 0n ? "ACCEPTED" : "ACTIVE";
    const feeBreakdown = calculateMarketplaceOrderFees(requestAmountText);
    const tradeCharacterName = normalizeTradeCharacterName(input.tradeCharacterName);
    if (!tradeCharacterName) {
      throw new Error("판매자 게임 아이디를 입력해 주세요.");
    }
    const buyerGameNickname = buyRequest.buyerGameNickname;
    const sellerGameNickname = tradeCharacterName;

    const listing = await tx.listing.create({
      data: {
        sellerId: seller.id,
        gameId: buyRequest.gameId,
        serverId: buyRequest.serverId,
        serverDetail: buyRequest.serverDetail,
        category: buyRequest.category,
        accountTransferType: buyRequest.accountTransferType,
        sellerGameNickname,
        title: listingTitle,
        description: buyRequest.description,
        tradeMode: "BULK",
        priceUnitQuantity: buyRequest.priceUnitQuantity?.toString() ?? "1",
        unitPrice: buyRequest.unitPrice.toString(),
        currency: buyRequest.currency,
        status: "HIDDEN",
        inventory: {
          create: {
            totalQuantity: saleQuantityText,
            minimumQuantity: saleQuantityText,
            availableQuantity: "0",
            lockedQuantity: saleQuantityText,
            soldQuantity: "0",
          },
        },
      },
    });

    const order = await tx.order.create({
      data: {
        orderNumber: buildBuyRequestOrderNumber(),
        buyerId: buyRequest.buyerId,
        sellerId: seller.id,
        listingId: listing.id,
        status: "ESCROW_LOCKED",
        quantity: saleQuantityText,
        unitPrice: buyRequest.unitPrice.toString(),
        grossAmount: feeBreakdown.grossAmount,
        platformFeeAmount: feeBreakdown.platformFeeAmount,
        sellerReceivableAmount: feeBreakdown.sellerReceivableAmount,
        currency: buyRequest.currency,
        tradeCharacterName,
        buyerGameNickname,
        sellerGameNickname,
      },
    });

    await tx.buyRequestOffer.create({
      data: {
        buyRequestId: buyRequest.id,
        sellerId: seller.id,
        listingId: listing.id,
        quantity: saleQuantityText,
        unitPrice: buyRequest.unitPrice.toString(),
        totalAmount: requestAmountText,
        currency: buyRequest.currency,
        message: "판매자가 이 구매요청에서 즉시판매를 시작했습니다.",
        status: "ACCEPTED",
      },
    });

    const buyRequestAcceptUpdate = await tx.buyRequest.updateMany({
      where: {
        id: buyRequest.id,
        status: "ACTIVE",
        lockAmount: buyRequest.lockAmount,
        remainingQuantity: {
          gte: saleQuantityText,
        },
      },
      data: {
        status: nextBuyRequestStatus,
        lockAmount: formatFixedAmount(nextLockAmount),
        remainingQuantity: formatFixedAmount(nextRemainingQuantity),
      },
    });

    if (buyRequestAcceptUpdate.count !== 1) {
      throw new Error("이미 처리된 구매요청입니다. 새로고침 후 다시 확인해 주세요.");
    }

    const buyerEscrowMoveUpdate = await tx.wallet.updateMany({
      where: {
        id: buyRequest.buyer.wallet.id,
        currency: buyRequest.currency,
        buyRequestLocked: {
          gte: requestAmountText,
        },
      },
      data: {
        buyRequestLocked: {
          decrement: requestAmountText,
        },
        escrowLockedBalance: {
          increment: requestAmountText,
        },
      },
    });

    if (buyerEscrowMoveUpdate.count !== 1) {
      throw new Error("구매요청 예치금이 부족하거나 이미 다른 주문으로 전환되었습니다.");
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "ESCROW_LOCKED",
        message:
          "구매요청 즉시판매로 구매자 예약금이 에스크로로 이동하고 판매 주문이 생성되었습니다.",
        metadata: {
          buyRequestId: buyRequest.id,
          listingId: listing.id,
          quantity: saleQuantityText,
          amount: feeBreakdown.grossAmount,
          platformFeeAmount: feeBreakdown.platformFeeAmount,
          sellerReceivableAmount: feeBreakdown.sellerReceivableAmount,
          tradeCharacterName,
          buyerGameNickname,
          sellerGameNickname,
        },
      },
    });

    await tx.chatRoom.create({
      data: {
        orderId: order.id,
        buyerId: buyRequest.buyerId,
        sellerId: seller.id,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          userId: buyRequest.buyerId,
          type: "ORDER_STATUS",
          title: "구매요청에 즉시판매가 들어왔습니다",
          body: `${listingTitle} 구매요청이 주문으로 전환됐습니다. 채팅에서 판매자와 전달 정보를 확인해 주세요.`,
          href: `/my/orders/${order.id}`,
          metadata: {
            orderId: order.id,
            buyRequestId: buyRequest.id,
            listingId: listing.id,
          },
        },
        {
          userId: seller.id,
          type: "ORDER_STATUS",
          title: "즉시판매 주문이 생성되었습니다",
          body: "구매자 예약금이 에스크로에 잠겼습니다. 판매 주문 상세와 채팅에서 전달을 진행해 주세요.",
          href: `/my/listings/orders/${order.id}`,
          metadata: {
            orderId: order.id,
            buyRequestId: buyRequest.id,
            listingId: listing.id,
          },
        },
      ],
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyRequest.buyer.wallet.id,
          userId: buyRequest.buyerId,
          type: "BUYER_ESCROW_LOCKED",
          direction: "DEBIT",
          bucket: "BUY_REQUEST_LOCKED",
          amount: requestAmountText,
          currency: buyRequest.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매요청 즉시판매로 예약금이 에스크로로 이동했습니다.",
        },
        {
          walletId: buyRequest.buyer.wallet.id,
          userId: buyRequest.buyerId,
          type: "BUYER_ESCROW_LOCKED",
          direction: "CREDIT",
          bucket: "ESCROW_LOCKED",
          amount: requestAmountText,
          currency: buyRequest.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매요청 즉시판매로 구매자 에스크로가 잠겼습니다.",
        },
      ],
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      buyRequestId: buyRequest.id,
      listingId: listing.id,
      amount: order.grossAmount.toString(),
      currency: order.currency,
      redirectHref: `/my/listings/orders/${order.id}`,
      message: "즉시판매 주문이 생성되었습니다.",
    };
  });
}

export async function updateMarketplaceBuyRequestOfferStatus(input: {
  offerId: string;
  action: "ACCEPT" | "REJECT";
}) {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const offer = await prisma.buyRequestOffer.findUnique({
    where: {
      id: input.offerId,
    },
    include: {
      buyRequest: {
        select: {
          id: true,
          buyerId: true,
          status: true,
        },
      },
    },
  });

  if (!offer) {
    throw new Error("판매 제안을 찾을 수 없습니다.");
  }

  if (offer.buyRequest.buyerId !== sessionUser.userId) {
    throw new Error("구매요청 작성자만 이 제안을 변경할 수 있습니다.");
  }

  if (offer.buyRequest.status !== "ACTIVE") {
    throw new Error("모집 중인 구매요청의 제안만 변경할 수 있습니다.");
  }

  if (offer.status !== "PENDING") {
    throw new Error("검토 중인 제안만 변경할 수 있습니다.");
  }

  if (input.action === "REJECT") {
    const rejected = await prisma.buyRequestOffer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: "REJECTED",
      },
    });

    return {
      offerId: rejected.id,
      status: rejected.status,
      buyRequestId: offer.buyRequestId,
      buyRequestStatus: offer.buyRequest.status,
      message: "판매 제안을 거절했습니다.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const accepted = await tx.buyRequestOffer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: "ACCEPTED",
      },
    });

    await tx.buyRequestOffer.updateMany({
      where: {
        buyRequestId: offer.buyRequestId,
        id: {
          not: offer.id,
        },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });

    const buyRequest = await tx.buyRequest.update({
      where: {
        id: offer.buyRequestId,
      },
      data: {
        status: "ACCEPTED",
      },
    });

    return {
      accepted,
      buyRequest,
    };
  });

  return {
    offerId: result.accepted.id,
    status: result.accepted.status,
    buyRequestId: result.buyRequest.id,
    buyRequestStatus: result.buyRequest.status,
    message: "판매 제안을 수락했습니다.",
  };
}

function comparePremiumThenCreated(
  left: { premiumEndsAt: Date | null; createdAt: Date },
  right: { premiumEndsAt: Date | null; createdAt: Date },
) {
  const leftPremium = isPremiumActive(left.premiumEndsAt);
  const rightPremium = isPremiumActive(right.premiumEndsAt);

  if (leftPremium !== rightPremium) {
    return leftPremium ? -1 : 1;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function getBuyRequestOrderBy(sort: string) {
  if (sort === "price_low") {
    return { unitPrice: "asc" } as const;
  }

  if (sort === "price_high") {
    return { unitPrice: "desc" } as const;
  }

  if (sort === "quantity_high") {
    return { quantity: "desc" } as const;
  }

  return { createdAt: "desc" } as const;
}

function mapBuyRequestSummary({
  request,
  gameById,
  serverById,
}: {
  request: BuyRequestRow;
  gameById: Map<
    string,
    {
      name: string;
      code: string;
      imageUrl: string | null;
      moneyUnitName?: string | null;
      moneyUnitNameKo?: string | null;
      moneyUnitNameCn?: string | null;
      moneyUnitNameVn?: string | null;
      moneyUnitNamePh?: string | null;
      moneyUnitNameTh?: string | null;
      nameKo?: string | null;
      nameCn?: string | null;
      nameVn?: string | null;
      namePh?: string | null;
      nameTh?: string | null;
    }
  >;
  serverById: Map<string, { name: string }>;
}): MarketplaceBuyRequestSummary {
  const requestGame = gameById.get(request.gameId);
  const requestServer = request.serverId ? serverById.get(request.serverId) : null;

  return {
    buyRequestId: request.id,
    buyerId: request.buyerId,
    buyerName: request.buyer.displayName,
    gameName: requestGame?.name ?? "GGtem",
    gameCode: requestGame?.code ?? "unknown",
    gameImageUrl: requestGame?.imageUrl ?? null,
    gameLocalizedNames: requestGame
      ? mapGameLocalizedNames(requestGame)
      : { KR: null, CN: null, VN: null, PH: null, TH: null },
    moneyUnitName: requestGame
      ? buildLocalizedMoneyUnitNames(requestGame)
      : getGameMoneyUnitName(null),
    serverName: requestServer?.name ?? null,
    serverDetail: request.serverDetail ?? null,
    category: request.category,
    categoryLabel: getCategoryLabel(request.category),
    title: request.title,
    description: request.description,
    contentImages:
      request.images?.map((image) => ({
        imageId: image.id,
        imageUrl: image.imageUrl,
        altText: image.altText ?? null,
      })) ?? [],
    accountTransferType: request.accountTransferType,
    accountRank: request.accountRank,
    buyerGameNickname: request.buyerGameNickname,
    tradeMode: request.tradeMode ?? "BULK",
    priceUnitQuantity: request.priceUnitQuantity?.toString() ?? "1",
    quantity: request.quantity.toString(),
    minimumQuantity: request.minimumQuantity?.toString() ?? request.quantity.toString(),
    remainingQuantity: request.remainingQuantity?.toString() ?? request.quantity.toString(),
    unitPrice: request.unitPrice.toString(),
    totalAmount: request.totalAmount.toString(),
    lockAmount: request.lockAmount.toString(),
    currency: request.currency,
    status: request.status,
    expiresAt: request.expiresAt ? formatKoreanDate(request.expiresAt) : null,
    isPremium: isPremiumActive(request.premiumEndsAt),
    premiumEndsAt: request.premiumEndsAt ? formatKoreanDate(request.premiumEndsAt) : null,
    premiumDurationHours: request.premiumDurationHours,
    premiumFeeAmount: request.premiumFeeAmount?.toString() ?? null,
    createdAt: formatKoreanDate(request.createdAt),
    offerCount: request._count?.offers ?? request.offers?.length ?? 0,
    offers: request.offers?.map((offer) => ({
      offerId: offer.id,
      listingId: offer.listing?.id ?? null,
      sellerName: offer.seller.displayName,
      listingTitle: offer.listing?.title ?? null,
      quantity: offer.quantity.toString(),
      unitPrice: offer.unitPrice.toString(),
      totalAmount: offer.totalAmount.toString(),
      currency: offer.currency,
      message: offer.message,
      status: offer.status,
      createdAt: formatKoreanDate(offer.createdAt),
    })),
  };
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
  return games.map((game) => ({
    name: game.name,
    code: game.code,
    imageUrl: game.imageUrl,
    region: getGameRegion(game.name),
    localizedNames: mapGameLocalizedNames(game),
  }));
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
