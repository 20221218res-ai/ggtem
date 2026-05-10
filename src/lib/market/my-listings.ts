import { getPrismaClient } from "@/lib/prisma";
import { createUserNotification } from "@/lib/notifications/notifications";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import { normalizeAccountTransferType } from "@/lib/market/account-transfer-types";
import { getCurrentUserEmailForRole } from "@/lib/auth/session";
import { ensureUserWallet } from "@/lib/market/wallets";
import { assertNoOffPlatformContact } from "@/lib/risk/off-platform-contact";
import {
  calculatePremiumPromotionFee,
  formatPremiumPromotionFee,
  getPremiumPromotionWindow,
  normalizePremiumDurationHours,
} from "@/lib/market/premium-promotion";
import {
  type LocalizedGameNames,
  mapGameLocalizedNames,
} from "@/lib/market/game-localization";
import { copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MARKET_USER_EMAIL = "user-demo@ggitem.local";
const MARKET_USER_ROLES = ["CUSTOMER", "SELLER"];
const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type MarketplaceMyListingsView = {
  sellerName: string;
  wallet: {
    availableBalance: string;
    currency: string;
  } | null;
  summary: {
    activeListings: number;
    totalAvailableQuantity: string;
    totalLockedQuantity: string;
    totalSoldQuantity: string;
  };
  listings: Array<{
    listingId: string;
    title: string;
    status: string;
    primaryImageUrl: string | null;
    gameName: string;
    serverName: string | null;
    category: string;
    accountTransferType: string | null;
    unitPrice: string;
    currency: string;
    minimumQuantity: string;
    availableQuantity: string;
    lockedQuantity: string;
    soldQuantity: string;
    createdAt: string;
    createdAtValue: string;
  }>;
  recentOrders: Array<{
    orderId: string;
    orderNumber: string;
    listingId: string;
    listingTitle: string;
    buyerName: string;
    status: string;
    quantity: string;
    amount: string;
    currency: string;
    createdAt: string;
  }>;
};

export type MarketplaceSellerOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingId: string;
  listingTitle: string;
  category: string;
  accountTransferType: string | null;
  buyerName: string;
  quantity: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  currency: string;
  createdAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  events: Array<{
    eventId: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
};

export type SellerOrderActionResult = {
  orderId: string;
  status: string;
  message: string;
};

type SellerOrderAction =
  | "START_DELIVERY"
  | "MARK_DELIVERED"
  | "REQUEST_BUYER_CONFIRM";

export type MarketplaceSellerListingFormView = {
  sellerName: string;
  currency: string;
  categoryOptions: Array<{
    value: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
    label: string;
  }>;
  games: Array<{
    gameId: string;
    name: string;
    localizedNames: LocalizedGameNames;
    servers: Array<{
      serverId: string;
      name: string;
    }>;
  }>;
};

export type MarketplaceSellerCreateListingResult = {
  listingId: string;
  title: string;
  status: string;
  message: string;
};

export type MarketplaceSellerListingEditorView = {
  listingId: string;
  title: string;
  description: string | null;
  status: string;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  gameName: string;
  serverName: string | null;
  category: string;
  accountTransferType: string | null;
  unitPrice: string;
  currency: string;
  totalQuantity: string;
  minimumQuantity: string;
  availableQuantity: string;
  lockedQuantity: string;
  soldQuantity: string;
};

export type MarketplaceSellerListingMutationResult = {
  listingId: string;
  status: string;
  message: string;
};

export type MarketplaceSellerListingImageMutationResult = {
  listingId: string;
  imageUrl: string | null;
  altText: string | null;
  message: string;
};

type SellerOrderTransitionStatus =
  | "DELIVERY_IN_PROGRESS"
  | "BUYER_CONFIRM_PENDING";

export async function getMarketplaceMyListings(): Promise<MarketplaceMyListingsView> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    include: {
      wallet: true,
      listings: {
        where: {
          status: {
            in: ["ACTIVE", "PAUSED", "SOLD_OUT", "HIDDEN"],
          },
        },
        include: {
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
        take: 30,
      },
      sellerOrders: {
        include: {
          buyer: true,
          listing: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
    },
  });

  if (!seller) {
    return {
      sellerName: "판매자",
      wallet: null,
      summary: {
        activeListings: 0,
        totalAvailableQuantity: "0",
        totalLockedQuantity: "0",
        totalSoldQuantity: "0",
      },
      listings: [],
      recentOrders: [],
    };
  }

  const totals = seller.listings.reduce(
    (accumulator, listing) => ({
      activeListings:
        accumulator.activeListings +
        (listing.status === "ACTIVE" &&
        Number(listing.inventory?.availableQuantity ?? 0) > 0
          ? 1
          : 0),
      totalAvailableQuantity:
        accumulator.totalAvailableQuantity +
        Number(listing.inventory?.availableQuantity ?? 0),
      totalLockedQuantity:
        accumulator.totalLockedQuantity +
        Number(listing.inventory?.lockedQuantity ?? 0),
      totalSoldQuantity:
        accumulator.totalSoldQuantity + Number(listing.inventory?.soldQuantity ?? 0),
    }),
    {
      activeListings: 0,
      totalAvailableQuantity: 0,
      totalLockedQuantity: 0,
      totalSoldQuantity: 0,
    },
  );

  return {
    sellerName: seller.displayName,
    wallet: seller.wallet
      ? {
          availableBalance: seller.wallet.availableBalance.toString(),
          currency: seller.wallet.currency,
        }
      : null,
    summary: {
      activeListings: totals.activeListings,
      totalAvailableQuantity: totals.totalAvailableQuantity.toString(),
      totalLockedQuantity: totals.totalLockedQuantity.toString(),
      totalSoldQuantity: totals.totalSoldQuantity.toString(),
    },
    listings: seller.listings.map((listing) => ({
      listingId: listing.id,
      title: listing.title,
      status: listing.status,
      primaryImageUrl: listing.images[0]?.imageUrl ?? null,
      gameName: listing.game.name,
      serverName: listing.server?.name ?? null,
      category: listing.category,
      accountTransferType: listing.accountTransferType ?? null,
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
      minimumQuantity: listing.inventory?.minimumQuantity?.toString() ?? "1",
      availableQuantity: listing.inventory?.availableQuantity.toString() ?? "0",
      lockedQuantity: listing.inventory?.lockedQuantity.toString() ?? "0",
      soldQuantity: listing.inventory?.soldQuantity.toString() ?? "0",
      createdAt: formatKoreanDate(listing.createdAt),
      createdAtValue: listing.createdAt.toISOString(),
    })),
    recentOrders: seller.sellerOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingId: order.listingId,
      listingTitle: order.listing.title,
      buyerName: order.buyer.displayName,
      status: order.status,
      quantity: order.quantity.toString(),
      amount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
    })),
  };
}

export async function getMarketplaceSellerListingEditorView(
  listingId: string,
): Promise<MarketplaceSellerListingEditorView | null> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    return null;
  }

  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      sellerId: seller.id,
    },
    include: {
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

  if (!listing || !listing.inventory) {
    return null;
  }

  return {
    listingId: listing.id,
    title: listing.title,
    description: listing.description,
    status: listing.status,
    primaryImageUrl: listing.images[0]?.imageUrl ?? null,
    primaryImageAlt: listing.images[0]?.altText ?? null,
    gameName: listing.game.name,
    serverName: listing.server?.name ?? null,
    category: listing.category,
    accountTransferType: listing.accountTransferType ?? null,
    unitPrice: listing.unitPrice.toString(),
    currency: listing.currency,
    totalQuantity: listing.inventory.totalQuantity.toString(),
    minimumQuantity: listing.inventory.minimumQuantity?.toString() ?? "1",
    availableQuantity: listing.inventory.availableQuantity.toString(),
    lockedQuantity: listing.inventory.lockedQuantity.toString(),
    soldQuantity: listing.inventory.soldQuantity.toString(),
  };
}

export async function getMarketplaceSellerListingFormView(): Promise<MarketplaceSellerListingFormView> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    include: {
      wallet: true,
    },
  });

  const games = await prisma.game.findMany({
    where: {
      isActive: true,
      servers: {
        some: {
          isActive: true,
        },
      },
    },
    include: {
      servers: {
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return {
    sellerName: seller?.displayName ?? "판매자",
    currency: seller?.wallet?.currency ?? "USDT",
    categoryOptions: [
      { value: "GAME_MONEY", label: "게임머니" },
      { value: "GAME_ITEM", label: "아이템" },
      { value: "GAME_ACCOUNT", label: "계정" },
    ],
    games: games.map((game) => ({
      gameId: game.id,
      name: game.name,
      localizedNames: mapGameLocalizedNames(game),
      servers: game.servers.map((server) => ({
        serverId: server.id,
        name: server.name,
      })),
    })),
  };
}

export async function createMarketplaceSellerListing(input: {
  gameId: string;
  serverId?: string;
  category: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
  accountTransferType?: string;
  title: string;
  description?: string;
  unitPrice: string;
  quantity: string;
  minimumQuantity?: string;
  premiumDurationHours?: number;
}): Promise<MarketplaceSellerCreateListingResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    include: {
      wallet: true,
    },
  });

  if (!seller) {
    throw new Error("판매자 계정을 찾을 수 없습니다.");
  }
  const sellerWallet = seller.wallet ?? (await ensureUserWallet(seller.id));

  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description?.trim() ?? "";
  const normalizedServerId = input.serverId?.trim() || null;
  const normalizedAccountTransferType = normalizeAccountTransferType(
    input.accountTransferType,
  );
  const unitPrice = parseFixedAmount(input.unitPrice);
  const quantity = parseFixedAmount(input.quantity);
  const minimumQuantity = parseFixedAmount(input.minimumQuantity || "1");
  const premiumDurationHours = normalizePremiumDurationHours(
    input.premiumDurationHours,
  );
  const premiumFeeAmount = calculatePremiumPromotionFee(premiumDurationHours);

  if (!trimmedTitle) {
    throw new Error("판매글 제목을 입력해 주세요.");
  }

  if (unitPrice <= 0n) {
    throw new Error("판매 단가는 0보다 커야 합니다.");
  }

  if (quantity <= 0n) {
    throw new Error("판매 수량은 0보다 커야 합니다.");
  }

  if (minimumQuantity <= 0n) {
    throw new Error("최소 구매 수량은 0보다 커야 합니다.");
  }

  if (minimumQuantity > quantity) {
    throw new Error("최소 구매 수량은 총 판매 수량보다 클 수 없습니다.");
  }

  if (!normalizedServerId) {
    throw new Error("판매글은 선택한 서버 1개 기준으로만 등록할 수 있습니다.");
  }

  if (input.category === "GAME_ACCOUNT" && !normalizedAccountTransferType) {
    throw new Error("계정 유형을 선택해 주세요.");
  }

  await assertNoOffPlatformContact(
    [trimmedTitle, trimmedDescription].filter(Boolean).join("\n"),
    {
      actorUserId: seller.id,
      sourceType: "LISTING_DRAFT",
      sourceId: `seller:${seller.id}:${Date.now()}`,
      contentKind: "LISTING",
    },
  );

  if (premiumFeeAmount > 0n) {
    const availableBalance = parseFixedAmount(
      sellerWallet.availableBalance.toString(),
    );
    const withdrawableBalance = parseFixedAmount(
      sellerWallet.withdrawableBalance.toString(),
    );

    if (availableBalance < premiumFeeAmount || withdrawableBalance < premiumFeeAmount) {
      throw new Error("프리미엄 등록에 필요한 지갑 잔액이 부족합니다.");
    }
  }

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
    throw new Error("선택한 게임은 현재 등록할 수 없습니다.");
  }

  if (!game.servers.some((server) => server.id === normalizedServerId)) {
    throw new Error("선택한 서버가 해당 게임에 속하지 않습니다.");
  }

  const listing = await prisma.$transaction(async (tx) => {
    const premiumWindow = getPremiumPromotionWindow(premiumDurationHours);
    const createdListing = await tx.listing.create({
      data: {
        sellerId: seller.id,
        gameId: game.id,
        serverId: normalizedServerId,
        category: input.category,
        accountTransferType:
          input.category === "GAME_ACCOUNT" ? normalizedAccountTransferType : null,
        title: trimmedTitle,
        description: trimmedDescription || null,
        unitPrice: formatFixedAmount(unitPrice),
        currency: sellerWallet.currency,
        status: "ACTIVE",
        premiumStartedAt: premiumWindow.premiumStartedAt,
        premiumEndsAt: premiumWindow.premiumEndsAt,
        premiumDurationHours: premiumDurationHours || null,
        premiumFeeAmount:
          premiumFeeAmount > 0n ? formatPremiumPromotionFee(premiumFeeAmount) : null,
        inventory: {
          create: {
            totalQuantity: formatFixedAmount(quantity),
            minimumQuantity: formatFixedAmount(minimumQuantity),
            availableQuantity: formatFixedAmount(quantity),
            lockedQuantity: "0",
            soldQuantity: "0",
          },
        },
      },
    });

    if (premiumFeeAmount > 0n) {
      const premiumFee = formatPremiumPromotionFee(premiumFeeAmount);
      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: sellerWallet.id,
          currency: sellerWallet.currency,
          availableBalance: {
            gte: premiumFee,
          },
          withdrawableBalance: {
            gte: premiumFee,
          },
        },
        data: {
          availableBalance: {
            decrement: premiumFee,
          },
          withdrawableBalance: {
            decrement: premiumFee,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw new Error("프리미엄 등록에 필요한 지갑 잔액이 부족합니다.");
      }

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: sellerWallet.id,
            userId: seller.id,
            type: "PREMIUM_PROMOTION_PURCHASED",
            direction: "DEBIT",
            bucket: "AVAILABLE",
            amount: premiumFee,
            currency: sellerWallet.currency,
            referenceType: "LISTING",
            referenceId: createdListing.id,
            memo: `${premiumDurationHours}시간 프리미엄 판매글 이용료가 차감되었습니다.`,
          },
          {
            walletId: sellerWallet.id,
            userId: seller.id,
            type: "PREMIUM_PROMOTION_PURCHASED",
            direction: "DEBIT",
            bucket: "WITHDRAWABLE",
            amount: premiumFee,
            currency: sellerWallet.currency,
            referenceType: "LISTING",
            referenceId: createdListing.id,
            memo: "프리미엄 판매글 이용료가 출금 가능 잔액에서 제외되었습니다.",
          },
          {
            walletId: sellerWallet.id,
            userId: seller.id,
            type: "PREMIUM_PROMOTION_PURCHASED",
            direction: "CREDIT",
            bucket: "PLATFORM_REVENUE",
            amount: premiumFee,
            currency: sellerWallet.currency,
            referenceType: "LISTING",
            referenceId: createdListing.id,
            memo: "프리미엄 판매글 이용료가 플랫폼 수익으로 확정되었습니다.",
          },
        ],
      });
    }

    return createdListing;
  });

  return {
    listingId: listing.id,
    title: listing.title,
    status: listing.status,
    message:
      premiumFeeAmount > 0n
        ? `판매글이 등록되었습니다. 프리미엄 ${premiumDurationHours}시간이 적용되었습니다.`
        : "판매글이 등록되었습니다.",
  };
}

export async function updateMarketplaceSellerListing(input: {
  listingId: string;
  title: string;
  description?: string;
  unitPrice: string;
  totalQuantity: string;
}): Promise<MarketplaceSellerListingMutationResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description?.trim() ?? "";
  const nextUnitPrice = parseFixedAmount(input.unitPrice);
  const nextTotalQuantity = parseFixedAmount(input.totalQuantity);

  if (!trimmedTitle) {
    throw new Error("판매글 제목을 입력해 주세요.");
  }

  if (nextUnitPrice <= 0n) {
    throw new Error("단가는 0보다 커야 합니다.");
  }

  if (nextTotalQuantity <= 0n) {
    throw new Error("총 수량은 0보다 커야 합니다.");
  }

  await assertNoOffPlatformContact(
    [trimmedTitle, trimmedDescription].filter(Boolean).join("\n"),
    {
      actorUserId: seller.id,
      sourceType: "LISTING_EDIT",
      sourceId: input.listingId,
      contentKind: "LISTING",
    },
  );

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: {
        id: input.listingId,
        sellerId: seller.id,
      },
      include: {
        inventory: true,
      },
    });

    if (!listing?.inventory) {
      throw new Error("판매글을 찾을 수 없습니다.");
    }

    const lockedQuantity = parseFixedAmount(
      listing.inventory.lockedQuantity.toString(),
    );
    const soldQuantity = parseFixedAmount(listing.inventory.soldQuantity.toString());
    const minimumTotalQuantity = lockedQuantity + soldQuantity;

    if (nextTotalQuantity < minimumTotalQuantity) {
      throw new Error(
        "총 수량은 거래 잠금 수량과 판매 완료 수량보다 작을 수 없습니다.",
      );
    }

    const nextAvailableQuantity =
      nextTotalQuantity - lockedQuantity - soldQuantity;

    await tx.listing.update({
      where: {
        id: listing.id,
      },
      data: {
        title: trimmedTitle,
        description: trimmedDescription || null,
        unitPrice: formatFixedAmount(nextUnitPrice),
      },
    });

    await tx.listingInventory.update({
      where: {
        id: listing.inventory.id,
      },
      data: {
        totalQuantity: formatFixedAmount(nextTotalQuantity),
        availableQuantity: formatFixedAmount(nextAvailableQuantity),
        version: {
          increment: 1,
        },
      },
    });

    return {
      listingId: listing.id,
      status: listing.status,
      message: "판매글을 수정했습니다.",
    };
  });
}

export async function updateMarketplaceSellerListingStatus(input: {
  listingId: string;
  action: "PAUSE" | "RESUME" | "HIDE";
}): Promise<MarketplaceSellerListingMutationResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  const listing = await prisma.listing.findFirst({
    where: {
      id: input.listingId,
      sellerId: seller.id,
    },
    include: {
      inventory: true,
    },
  });

  if (!listing) {
    throw new Error("판매글을 찾을 수 없습니다.");
  }

  if (input.action === "HIDE") {
    if (listing.status === "HIDDEN") {
      throw new Error("이미 숨김 처리된 판매글입니다.");
    }

    if (listing.status === "SOLD_OUT") {
      throw new Error("품절/종료된 판매글은 판매 내역에서 관리해 주세요.");
    }

    const updated = await prisma.listing.update({
      where: {
        id: listing.id,
      },
      data: {
        status: "HIDDEN",
      },
    });

    return {
      listingId: updated.id,
      status: updated.status,
      message: "판매글을 공개 목록에서 숨김 처리했습니다.",
    };
  }

  if (input.action === "PAUSE") {
    if (listing.status !== "ACTIVE") {
      throw new Error("판매 중인 글만 일시중지할 수 있습니다.");
    }

    const updated = await prisma.listing.update({
      where: {
        id: listing.id,
      },
      data: {
        status: "PAUSED",
      },
    });

    return {
      listingId: updated.id,
      status: updated.status,
      message: "판매글을 일시중지했습니다.",
    };
  }

  if (!["PAUSED", "HIDDEN", "SOLD_OUT"].includes(listing.status)) {
    throw new Error("일시중지된 글만 다시 판매할 수 있습니다.");
  }

  if (!listing.inventory || Number(listing.inventory.availableQuantity) <= 0) {
    throw new Error("다시 판매하려면 판매 가능한 수량이 필요합니다.");
  }

  const updated = await prisma.listing.update({
    where: {
      id: listing.id,
    },
    data: {
      status: "ACTIVE",
    },
  });

  return {
    listingId: updated.id,
    status: updated.status,
    message: "판매글을 다시 판매 중으로 변경했습니다.",
  };
}

export async function duplicateMarketplaceSellerListing(input: {
  listingId: string;
}): Promise<MarketplaceSellerListingMutationResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  const sourceListing = await prisma.listing.findFirst({
    where: {
      id: input.listingId,
      sellerId: seller.id,
    },
    include: {
      inventory: true,
      images: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
    },
  });

  if (!sourceListing?.inventory) {
    throw new Error("판매글을 찾을 수 없습니다.");
  }

  const sourceInventory = sourceListing.inventory;

  const duplicated = await prisma.$transaction(async (tx) => {
    const createdListing = await tx.listing.create({
      data: {
        sellerId: seller.id,
        gameId: sourceListing.gameId,
        serverId: sourceListing.serverId,
        category: sourceListing.category,
        accountTransferType: sourceListing.accountTransferType,
        title: `${sourceListing.title} (복사본)`,
        description: sourceListing.description,
        unitPrice: sourceListing.unitPrice,
        currency: sourceListing.currency,
        status: "PAUSED",
      },
    });

    await tx.listingInventory.create({
      data: {
        listingId: createdListing.id,
        totalQuantity: sourceInventory.totalQuantity,
        minimumQuantity: sourceInventory.minimumQuantity,
        availableQuantity: sourceInventory.totalQuantity,
        lockedQuantity: 0,
        soldQuantity: 0,
      },
    });

    return createdListing;
  });

  const sourceImage = sourceListing.images[0];

  if (sourceImage) {
    const uploadsDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "listings",
    );
    await mkdir(uploadsDirectory, { recursive: true });

    const sourceExtension =
      path.extname(sourceImage.storagePath || sourceImage.imageUrl) || ".png";
    const copiedFileName = `${duplicated.id}-${Date.now()}${sourceExtension}`;
    const copiedStoragePath = path.join(uploadsDirectory, copiedFileName);
    const copiedImageUrl = `/uploads/listings/${copiedFileName}`;

    await copyFile(sourceImage.storagePath, copiedStoragePath);

    await prisma.listingImage.create({
      data: {
        listingId: duplicated.id,
        imageUrl: copiedImageUrl,
        storagePath: copiedStoragePath,
        altText: sourceImage.altText,
        sortOrder: 0,
      },
    });
  }

  return {
    listingId: duplicated.id,
    status: duplicated.status,
    message: "판매글을 일시중지된 복사본으로 생성했습니다.",
  };
}

export async function uploadMarketplaceSellerListingImage(input: {
  listingId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  altText?: string;
}): Promise<MarketplaceSellerListingImageMutationResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  const extension = getListingImageExtension(input.fileName, input.contentType);

  if (!extension) {
    throw new Error("판매글 이미지는 PNG, JPG, JPEG, WEBP 파일만 사용할 수 있습니다.");
  }

  if (input.bytes.byteLength === 0) {
    throw new Error("이미지 파일이 비어 있습니다.");
  }

  if (input.bytes.byteLength > LISTING_IMAGE_MAX_BYTES) {
    throw new Error("판매글 이미지는 5MB 이하만 사용할 수 있습니다.");
  }

  if (!isListingImageSignatureValid(input.bytes, extension)) {
    throw new Error(
      "이미지 파일 형식이 올바르지 않습니다. 실제 PNG, JPG, WEBP 파일을 업로드해 주세요.",
    );
  }

  const trimmedAltText = input.altText?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: {
        id: input.listingId,
        sellerId: seller.id,
      },
      include: {
        images: true,
      },
    });

    if (!listing) {
      throw new Error("판매글을 찾을 수 없습니다.");
    }

    const uploadsDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "listings",
    );
    await mkdir(uploadsDirectory, { recursive: true });

    const nextFileName = `${listing.id}-${Date.now()}.${extension}`;
    const absoluteStoragePath = path.join(uploadsDirectory, nextFileName);
    const publicImageUrl = `/uploads/listings/${nextFileName}`;
    await writeFile(absoluteStoragePath, input.bytes);

    const previousImages = listing.images;

    await tx.listingImage.deleteMany({
      where: {
        listingId: listing.id,
      },
    });

    await tx.listingImage.create({
      data: {
        listingId: listing.id,
        imageUrl: publicImageUrl,
        storagePath: absoluteStoragePath,
        altText: trimmedAltText,
        sortOrder: 0,
      },
    });

    await Promise.all(
      previousImages.map(async (image) => {
        try {
          await unlink(image.storagePath);
        } catch {
          return;
        }
      }),
    );

    return {
      listingId: listing.id,
      imageUrl: publicImageUrl,
      altText: trimmedAltText,
      message: "판매글 이미지가 수정되었습니다.",
    };
  });
}

export async function removeMarketplaceSellerListingImage(input: {
  listingId: string;
}): Promise<MarketplaceSellerListingImageMutationResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: {
        id: input.listingId,
        sellerId: seller.id,
      },
      include: {
        images: true,
      },
    });

    if (!listing) {
      throw new Error("판매글을 찾을 수 없습니다.");
    }

    if (listing.images.length === 0) {
      throw new Error("삭제할 판매글 이미지가 없습니다.");
    }

    const imagesToDelete = listing.images;

    await tx.listingImage.deleteMany({
      where: {
        listingId: listing.id,
      },
    });

    await Promise.all(
      imagesToDelete.map(async (image) => {
        try {
          await unlink(image.storagePath);
        } catch {
          return;
        }
      }),
    );

    return {
      listingId: listing.id,
      imageUrl: null,
      altText: null,
      message: "판매글 이미지가 삭제되었습니다.",
    };
  });
}

export async function getMarketplaceSellerOrderDetail(
  orderId: string,
): Promise<MarketplaceSellerOrderDetail | null> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      sellerId: seller.id,
    },
    include: {
      buyer: true,
      listing: true,
      events: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    listingId: order.listingId,
    listingTitle: order.listing.title,
    category: order.listing.category,
    accountTransferType: order.listing.accountTransferType,
    buyerName: order.buyer.displayName,
    quantity: order.quantity.toString(),
    grossAmount: order.grossAmount.toString(),
    sellerReceivableAmount: order.sellerReceivableAmount.toString(),
    currency: order.currency,
    createdAt: formatKoreanDate(order.createdAt),
    completedAt: order.completedAt ? formatKoreanDate(order.completedAt) : null,
    canceledAt: order.canceledAt ? formatKoreanDate(order.canceledAt) : null,
    events: order.events.map((event) => ({
      eventId: event.id,
      status: event.status,
      message: event.message,
      createdAt: formatKoreanDate(event.createdAt),
    })),
  };
}

export async function updateMarketplaceSellerOrderStatus(input: {
  orderId: string;
  action: SellerOrderAction;
}): Promise<SellerOrderActionResult> {
  const prisma = getPrismaClient();
  const sellerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const seller = await prisma.user.findUnique({
    where: {
      email: sellerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error("\uC0AC\uC6A9\uC790 \uACC4\uC815\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        sellerId: seller.id,
      },
    });

    if (!order) {
      throw new Error("\uD310\uB9E4 \uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }

    if (input.action === "REQUEST_BUYER_CONFIRM") {
      if (order.status !== "BUYER_CONFIRM_PENDING") {
        throw new Error("인수확정 대기 상태의 주문만 구매자에게 인수확정을 요청할 수 있습니다.");
      }

      const recentRequest = await tx.orderEvent.findFirst({
        where: {
          orderId: order.id,
          status: "BUYER_CONFIRM_PENDING",
          metadata: {
            path: ["action"],
            equals: "REQUEST_BUYER_CONFIRM",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentRequest) {
        throw new Error("이미 구매자에게 인수확정을 요청했습니다.");
      }

      const message =
        "판매자가 인수확정을 요청했습니다. 받은 물품의 서버, 수량, 상태를 확인한 뒤 인수확정 또는 분쟁 제기를 선택해 주세요.";

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: order.status,
          message,
          metadata: {
            action: input.action,
            actor: "SELLER",
            previousStatus: order.status,
            nextStatus: order.status,
          },
        },
      });

      await createUserNotification({
        userId: order.buyerId,
        type: "ORDER_STATUS",
        title: "판매자가 인수확정을 요청했습니다",
        body: message,
        href: "/my/orders/" + order.id,
        metadata: {
          orderId: order.id,
          action: input.action,
        },
      });

      return {
        orderId: order.id,
        status: order.status,
        message,
      };
    }

    const transition = getSellerOrderTransition(order.status, input.action);
    const recentDuplicateEvent = await tx.orderEvent.findFirst({
      where: {
        orderId: order.id,
        status: transition.nextStatus,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentDuplicateEvent && order.status === transition.nextStatus) {
      throw new Error("\uC774\uBBF8 \uCC98\uB9AC\uB41C \uD310\uB9E4 \uC791\uC5C5\uC785\uB2C8\uB2E4.");
    }

    const transitionUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: order.status,
      },
      data: {
        status: transition.nextStatus,
      },
    });

    if (transitionUpdate.count !== 1) {
      throw new Error("이미 처리된 판매 작업입니다. 화면을 새로고침한 뒤 다시 확인해 주세요.");
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: transition.nextStatus,
        message: transition.message,
        metadata: {
          action: input.action,
          actor: "SELLER",
          previousStatus: order.status,
          nextStatus: transition.nextStatus,
        },
      },
    });

    await createUserNotification({
      userId: order.buyerId,
      type: "ORDER_STATUS",
      title:
        transition.nextStatus === "DELIVERY_IN_PROGRESS"
          ? "\uD310\uB9E4\uC790\uAC00 \uC804\uB2EC\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4"
          : "\uD310\uB9E4\uC790\uAC00 \uC804\uB2EC \uC644\uB8CC\uB85C \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4",
      body: transition.message,
      href: "/my/orders/" + order.id,
      metadata: {
        orderId: order.id,
        action: input.action,
      },
    });

    return {
      orderId: order.id,
      status: transition.nextStatus,
      message: transition.message,
    };
  });
}

function getSellerOrderTransition(
  currentStatus: string,
  action: Exclude<SellerOrderAction, "REQUEST_BUYER_CONFIRM">,
): {
  nextStatus: SellerOrderTransitionStatus;
  message: string;
} {
  if (action === "START_DELIVERY") {
    if (
      currentStatus !== "ESCROW_LOCKED" &&
      currentStatus !== "SELLER_RESPONSE_PENDING"
    ) {
      throw new Error("\uC5D0\uC2A4\uD06C\uB85C \uC7A0\uAE08 \uC0C1\uD0DC\uC758 \uC8FC\uBB38\uB9CC \uC804\uB2EC\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
    }

    return {
      nextStatus: "DELIVERY_IN_PROGRESS",
      message: "\uD310\uB9E4\uC790\uAC00 \uAC8C\uC784 \uB0B4 \uBB3C\uD488 \uC804\uB2EC\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4.",
    };
  }

  if (currentStatus !== "DELIVERY_IN_PROGRESS") {
    throw new Error("\uC804\uB2EC \uC9C4\uD589 \uC911\uC778 \uC8FC\uBB38\uB9CC \uC804\uB2EC \uC644\uB8CC\uB85C \uD45C\uC2DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  }

  return {
    nextStatus: "BUYER_CONFIRM_PENDING",
    message: "\uD310\uB9E4\uC790\uAC00 \uC804\uB2EC \uC644\uB8CC\uB85C \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4. \uAD6C\uB9E4\uC790\uC758 \uC778\uC218\uD655\uC815\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4.",
  };
}
function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function getListingImageExtension(fileName: string, contentType: string) {
  const normalizedType = contentType.toLowerCase();

  if (normalizedType === "image/png") {
    return "png";
  }

  if (normalizedType === "image/jpeg" || normalizedType === "image/jpg") {
    return "jpg";
  }

  if (normalizedType === "image/webp") {
    return "webp";
  }

  const loweredFileName = fileName.toLowerCase();

  if (loweredFileName.endsWith(".png")) {
    return "png";
  }

  if (loweredFileName.endsWith(".jpg") || loweredFileName.endsWith(".jpeg")) {
    return "jpg";
  }

  if (loweredFileName.endsWith(".webp")) {
    return "webp";
  }

  return null;
}

function isListingImageSignatureValid(
  bytes: Uint8Array,
  extension: "png" | "jpg" | "webp",
) {
  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (extension === "jpg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}
