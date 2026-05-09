import {
  completePurchaseQuantity,
  lockPurchaseQuantity,
  releasePurchaseQuantity,
} from "@/lib/inventory/purchase-lock";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const DEMO_BUYER_EMAIL = "trader-a-demo@ggitem.local";
const DEMO_SELLER_EMAIL = "trader-b-demo@ggitem.local";
const DEMO_GAME_CODE = "DEMO_GOLD";
const DEMO_CURRENCY = "USDT";

export type TradeDemoListingSummary = {
  listingId: string;
  title: string;
  totalQuantity: string;
  availableQuantity: string;
  lockedQuantity: string;
  soldQuantity: string;
  unitPrice: string;
  currency: string;
  createdAt: string;
};

export type TradeDemoState = {
  buyer: {
    userId: string;
    availableBalance: string;
    escrowBalance: string;
    currency: string;
  };
  seller: {
    userId: string;
    availableBalance: string;
    escrowBalance: string;
    currency: string;
  };
  listings: TradeDemoListingSummary[];
  orders: Array<{
    orderId: string;
    orderNumber: string;
    listingId: string;
    listingTitle: string;
    status: string;
    quantity: string;
    grossAmount: string;
    createdAt: string;
  }>;
};

export async function getTradeDemoState(): Promise<TradeDemoState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const scenario = await ensureTradeDemoScenario(tx);
    return buildTradeDemoState(tx, scenario);
  });
}

export async function createTradeDemoListing(input: {
  title: string;
  quantity: string;
  amount: string;
}): Promise<TradeDemoState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const scenario = await ensureTradeDemoScenario(tx);
    const quantity = parseFixedAmount(input.quantity);
    const amount = parseFixedAmount(input.amount);

    if (quantity <= 0n) {
      throw new Error("Listing quantity must be greater than zero.");
    }

    if (amount <= 0n) {
      throw new Error("Listing amount must be greater than zero.");
    }

    const unitPrice = formatFixedAmount((amount * 1_000_000n) / quantity);

    const listing = await tx.listing.create({
      data: {
        sellerId: scenario.seller.id,
        gameId: scenario.game.id,
        category: "GAME_MONEY",
        title: input.title.trim(),
        description: "Admin trade lab listing",
        unitPrice,
        currency: DEMO_CURRENCY,
        status: "ACTIVE",
      },
    });

    await tx.listingInventory.create({
      data: {
        listingId: listing.id,
        totalQuantity: formatFixedAmount(quantity),
        availableQuantity: formatFixedAmount(quantity),
        lockedQuantity: "0",
        soldQuantity: "0",
      },
    });

    return buildTradeDemoState(tx, scenario);
  });
}

export async function purchaseTradeDemoListing(input: {
  listingId: string;
  quantity: string;
  amount: string;
}): Promise<TradeDemoState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const scenario = await ensureTradeDemoScenario(tx);
    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
      include: { inventory: true },
    });

    if (!listing?.inventory) {
      throw new Error("Listing not found.");
    }

    const buyerWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: scenario.buyerWallet.id },
    });
    const sellerWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: scenario.sellerWallet.id },
    });

    const purchaseAmount = parseFixedAmount(input.amount);
    const buyerAvailable = parseFixedAmount(buyerWallet.availableBalance.toString());
    const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());

    if (purchaseAmount <= 0n) {
      throw new Error("Purchase amount must be greater than zero.");
    }

    if (buyerAvailable < purchaseAmount) {
      throw new Error("Buyer does not have enough available balance.");
    }

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
        orderId: `order-demo-${Date.now()}`,
      },
    );

    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: {
        availableBalance: formatFixedAmount(buyerAvailable - purchaseAmount),
        escrowLockedBalance: formatFixedAmount(buyerEscrow + purchaseAmount),
      },
    });

    await tx.wallet.update({
      where: { id: sellerWallet.id },
      data: {
        availableBalance: sellerWallet.availableBalance.toString(),
        escrowLockedBalance: sellerWallet.escrowLockedBalance.toString(),
      },
    });

    await tx.listingInventory.update({
      where: { id: listing.inventory.id },
      data: {
        availableQuantity: inventoryResult.inventory.availableQuantity,
        lockedQuantity: inventoryResult.inventory.lockedQuantity,
        soldQuantity: inventoryResult.inventory.soldQuantity,
        version: {
          increment: 1,
        },
      },
    });

    const order = await tx.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        buyerId: scenario.buyer.id,
        sellerId: scenario.seller.id,
        listingId: listing.id,
        status: "ESCROW_LOCKED",
        quantity: input.quantity,
        unitPrice: listing.unitPrice.toString(),
        grossAmount: input.amount,
        platformFeeAmount: "0",
        sellerReceivableAmount: input.amount,
        currency: DEMO_CURRENCY,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "ESCROW_LOCKED",
        message: "거래 데모 구매로 구매자 잔액과 매물 재고를 잠갔습니다.",
        metadata: {
          listingId: listing.id,
          quantity: input.quantity,
          amount: input.amount,
        },
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: scenario.buyer.id,
          type: "BUYER_ESCROW_LOCKED",
          direction: "DEBIT",
          bucket: "AVAILABLE",
          amount: input.amount,
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 구매로 구매자 사용 가능 잔액을 에스크로로 이동했습니다.",
        },
        {
          walletId: buyerWallet.id,
          userId: scenario.buyer.id,
          type: "BUYER_ESCROW_LOCKED",
          direction: "CREDIT",
          bucket: "ESCROW_LOCKED",
          amount: input.amount,
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 구매로 구매자 에스크로 잔액을 잠갔습니다.",
        },
      ],
    });

    return buildTradeDemoState(tx, scenario);
  });
}

export async function cancelTradeDemoOrder(input: {
  orderId: string;
}): Promise<TradeDemoState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const scenario = await ensureTradeDemoScenario(tx);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        listing: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!order?.listing.inventory) {
      throw new Error("주문을 찾을 수 없습니다.");
    }

    if (order.status !== "ESCROW_LOCKED") {
      throw new Error("에스크로 잠금 상태의 주문만 취소할 수 있습니다.");
    }

    const buyerWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: scenario.buyerWallet.id },
    });

    const buyerAvailable = parseFixedAmount(buyerWallet.availableBalance.toString());
    const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());
    const orderAmount = parseFixedAmount(order.grossAmount.toString());

    const inventoryResult = releasePurchaseQuantity(
      {
        listingId: order.listing.id,
        totalQuantity: order.listing.inventory.totalQuantity.toString(),
        availableQuantity: order.listing.inventory.availableQuantity.toString(),
        lockedQuantity: order.listing.inventory.lockedQuantity.toString(),
        soldQuantity: order.listing.inventory.soldQuantity.toString(),
      },
      {
        listingId: order.listing.id,
        quantity: order.quantity.toString(),
        orderId: order.id,
      },
    );

    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: {
        availableBalance: formatFixedAmount(buyerAvailable + orderAmount),
        escrowLockedBalance: formatFixedAmount(buyerEscrow - orderAmount),
      },
    });

    await tx.listingInventory.update({
      where: { id: order.listing.inventory.id },
      data: {
        availableQuantity: inventoryResult.inventory.availableQuantity,
        lockedQuantity: inventoryResult.inventory.lockedQuantity,
        soldQuantity: inventoryResult.inventory.soldQuantity,
        version: {
          increment: 1,
        },
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "CANCELED",
        message: "거래 데모 주문을 취소하고 구매자 잔액을 환불했습니다.",
        metadata: {
          listingId: order.listing.id,
          quantity: order.quantity.toString(),
          amount: order.grossAmount.toString(),
        },
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: scenario.buyer.id,
          type: "ORDER_CANCELED_REFUND",
          direction: "DEBIT",
          bucket: "ESCROW_LOCKED",
          amount: order.grossAmount.toString(),
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 취소로 구매자 에스크로 잠금을 해제했습니다.",
        },
        {
          walletId: buyerWallet.id,
          userId: scenario.buyer.id,
          type: "ORDER_CANCELED_REFUND",
          direction: "CREDIT",
          bucket: "AVAILABLE",
          amount: order.grossAmount.toString(),
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 취소로 구매자 사용 가능 잔액을 환불했습니다.",
        },
      ],
    });

    return buildTradeDemoState(tx, scenario);
  });
}

export async function completeTradeDemoOrder(input: {
  orderId: string;
}): Promise<TradeDemoState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const scenario = await ensureTradeDemoScenario(tx);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        listing: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!order?.listing.inventory) {
      throw new Error("주문을 찾을 수 없습니다.");
    }

    if (order.status !== "ESCROW_LOCKED") {
      throw new Error("에스크로 잠금 상태의 주문만 완료할 수 있습니다.");
    }

    const buyerWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: scenario.buyerWallet.id },
    });
    const sellerWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: scenario.sellerWallet.id },
    });

    const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());
    const sellerAvailable = parseFixedAmount(
      sellerWallet.availableBalance.toString(),
    );
    const orderAmount = parseFixedAmount(order.grossAmount.toString());

    const inventoryResult = completePurchaseQuantity(
      {
        listingId: order.listing.id,
        totalQuantity: order.listing.inventory.totalQuantity.toString(),
        availableQuantity: order.listing.inventory.availableQuantity.toString(),
        lockedQuantity: order.listing.inventory.lockedQuantity.toString(),
        soldQuantity: order.listing.inventory.soldQuantity.toString(),
      },
      {
        listingId: order.listing.id,
        quantity: order.quantity.toString(),
        orderId: order.id,
      },
    );

    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: {
        escrowLockedBalance: formatFixedAmount(buyerEscrow - orderAmount),
      },
    });

    await tx.wallet.update({
      where: { id: sellerWallet.id },
      data: {
        availableBalance: formatFixedAmount(sellerAvailable + orderAmount),
      },
    });

    await tx.listingInventory.update({
      where: { id: order.listing.inventory.id },
      data: {
        availableQuantity: inventoryResult.inventory.availableQuantity,
        lockedQuantity: inventoryResult.inventory.lockedQuantity,
        soldQuantity: inventoryResult.inventory.soldQuantity,
        version: {
          increment: 1,
        },
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "COMPLETED",
        message: "거래 데모 주문을 완료하고 판매자 정산금을 지급했습니다.",
        metadata: {
          listingId: order.listing.id,
          quantity: order.quantity.toString(),
          amount: order.grossAmount.toString(),
        },
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: scenario.buyer.id,
          type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
          direction: "DEBIT",
          bucket: "ESCROW_LOCKED",
          amount: order.grossAmount.toString(),
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 완료로 구매자 에스크로 금액을 차감했습니다.",
        },
        {
          walletId: sellerWallet.id,
          userId: scenario.seller.id,
          type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
          direction: "CREDIT",
          bucket: "AVAILABLE",
          amount: order.grossAmount.toString(),
          currency: DEMO_CURRENCY,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "거래 데모 완료로 판매자 정산금을 지급했습니다.",
        },
      ],
    });

    return buildTradeDemoState(tx, scenario);
  });
}

async function buildTradeDemoState(
  tx: Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0],
  scenario: Awaited<ReturnType<typeof ensureTradeDemoScenario>>,
): Promise<TradeDemoState> {
  const listings = await tx.listing.findMany({
    where: {
      sellerId: scenario.seller.id,
      gameId: scenario.game.id,
    },
    include: {
      inventory: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const buyerWallet = await tx.wallet.findUniqueOrThrow({
    where: { id: scenario.buyerWallet.id },
  });
  const sellerWallet = await tx.wallet.findUniqueOrThrow({
    where: { id: scenario.sellerWallet.id },
  });
  const orders = await tx.order.findMany({
    where: {
      sellerId: scenario.seller.id,
      listing: {
        gameId: scenario.game.id,
      },
    },
    include: {
      listing: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return {
    buyer: {
      userId: scenario.buyer.id,
      availableBalance: buyerWallet.availableBalance.toString(),
      escrowBalance: buyerWallet.escrowLockedBalance.toString(),
      currency: buyerWallet.currency,
    },
    seller: {
      userId: scenario.seller.id,
      availableBalance: sellerWallet.availableBalance.toString(),
      escrowBalance: sellerWallet.escrowLockedBalance.toString(),
      currency: sellerWallet.currency,
    },
    listings: listings.map((listing) => ({
      listingId: listing.id,
      title: listing.title,
      totalQuantity: listing.inventory?.totalQuantity.toString() ?? "0",
      availableQuantity: listing.inventory?.availableQuantity.toString() ?? "0",
      lockedQuantity: listing.inventory?.lockedQuantity.toString() ?? "0",
      soldQuantity: listing.inventory?.soldQuantity.toString() ?? "0",
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
        createdAt: listing.createdAt.toLocaleString("ko-KR", {
          hour12: false,
          timeZone: "Asia/Seoul",
        }),
      })),
    orders: orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingId: order.listingId,
      listingTitle: order.listing.title,
      status: order.status,
      quantity: order.quantity.toString(),
      grossAmount: order.grossAmount.toString(),
      createdAt: order.createdAt.toLocaleString("ko-KR", {
        hour12: false,
        timeZone: "Asia/Seoul",
      }),
    })),
  };
}

async function ensureTradeDemoScenario(
  tx: Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0],
) {
  const buyer = await tx.user.upsert({
    where: { email: DEMO_BUYER_EMAIL },
    update: { displayName: "trader-a-demo", role: "CUSTOMER" },
    create: {
      email: DEMO_BUYER_EMAIL,
      displayName: "trader-a-demo",
      role: "CUSTOMER",
    },
  });

  const seller = await tx.user.upsert({
    where: { email: DEMO_SELLER_EMAIL },
    update: { displayName: "trader-b-demo", role: "CUSTOMER" },
    create: {
      email: DEMO_SELLER_EMAIL,
      displayName: "trader-b-demo",
      role: "CUSTOMER",
    },
  });

  const buyerWallet = await tx.wallet.upsert({
    where: { userId: buyer.id },
    update: {},
    create: {
      userId: buyer.id,
      currency: DEMO_CURRENCY,
      availableBalance: "500",
      escrowLockedBalance: "0",
    },
  });

  const sellerWallet = await tx.wallet.upsert({
    where: { userId: seller.id },
    update: {},
    create: {
      userId: seller.id,
      currency: DEMO_CURRENCY,
      availableBalance: "0",
      escrowLockedBalance: "0",
    },
  });

  const game = await tx.game.upsert({
    where: { code: DEMO_GAME_CODE },
    update: { name: "Demo Gold Trade" },
    create: {
      code: DEMO_GAME_CODE,
      name: "Demo Gold Trade",
    },
  });

  return { buyer, seller, buyerWallet, sellerWallet, game };
}
