import {
  cancelOrder,
  completeOrder,
  lockOrder,
} from "@/lib/orders/order-lifecycle";
import {
  createOrderLifecycleEvent,
  initialOrderLifecycleApiState,
  type OrderLifecycleApiState,
} from "@/lib/orders/order-lifecycle-state";
import { parseFixedQuantity } from "@/lib/inventory/purchase-lock";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

export type OrderLifecycleAction =
  | {
      type: "LOCK";
      quantity: string;
      amount: string;
    }
  | {
      type: "CANCEL";
    }
  | {
      type: "COMPLETE";
    }
  | {
      type: "RESET";
    };

export type OrderLifecycleStorageMode = "memory" | "prisma";

export interface OrderLifecycleRepository {
  getState(): Promise<OrderLifecycleApiState>;
  applyAction(action: OrderLifecycleAction): Promise<OrderLifecycleApiState>;
  getStorageMode(): OrderLifecycleStorageMode;
}

declare global {
  var __ggitemOrderLifecycleState: OrderLifecycleApiState | undefined;
}

const PRISMA_TARGET_TYPE = "ORDER_LIFECYCLE_SIMULATOR";
const PRISMA_TARGET_ID = "default";
const DEMO_BUYER_EMAIL = "trader-a-demo@ggitem.local";
const DEMO_SELLER_EMAIL = "trader-b-demo@ggitem.local";
const DEMO_GAME_CODE = "DEMO_GOLD";
const DEMO_LISTING_TITLE = "Demo 900,000 Gold";
const DEMO_CURRENCY = "USDT";

class MemoryOrderLifecycleRepository implements OrderLifecycleRepository {
  async getState(): Promise<OrderLifecycleApiState> {
    if (!globalThis.__ggitemOrderLifecycleState) {
      globalThis.__ggitemOrderLifecycleState = cloneInitialState();
    }

    return globalThis.__ggitemOrderLifecycleState;
  }

  async applyAction(
    action: OrderLifecycleAction,
  ): Promise<OrderLifecycleApiState> {
    const currentState = await this.getState();
    const nextState = reduceOrderLifecycleState(currentState, action);
    globalThis.__ggitemOrderLifecycleState = nextState;
    return nextState;
  }

  getStorageMode(): OrderLifecycleStorageMode {
    return "memory";
  }
}

class PrismaOrderLifecycleRepository implements OrderLifecycleRepository {
  async getState(): Promise<OrderLifecycleApiState> {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const demoScenario = await ensureDemoScenario(tx);
      return buildStateFromDatabase(tx, demoScenario);
    });
  }

  async applyAction(
    action: OrderLifecycleAction,
  ): Promise<OrderLifecycleApiState> {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const demoScenario = await ensureDemoScenario(tx);
      const currentState = await buildStateFromDatabase(tx, demoScenario);
      const nextState = reduceOrderLifecycleState(currentState, action);

      if (action.type === "RESET") {
        await resetDemoScenario(tx, demoScenario);
      } else {
        await tx.wallet.update({
          where: { id: demoScenario.buyerWallet.id },
          data: {
            availableBalance: nextState.snapshot.buyerWallet.availableBalance,
            escrowLockedBalance: nextState.snapshot.buyerWallet.escrowBalance,
          },
        });

        await tx.wallet.update({
          where: { id: demoScenario.sellerWallet.id },
          data: {
            availableBalance: nextState.snapshot.sellerWallet.availableBalance,
            escrowLockedBalance: nextState.snapshot.sellerWallet.escrowBalance,
          },
        });

        await tx.listingInventory.update({
          where: { id: demoScenario.inventory.id },
          data: {
            totalQuantity: nextState.snapshot.inventory.totalQuantity,
            availableQuantity: nextState.snapshot.inventory.availableQuantity,
            lockedQuantity: nextState.snapshot.inventory.lockedQuantity,
            soldQuantity: nextState.snapshot.inventory.soldQuantity,
            version: {
              increment: 1,
            },
          },
        });

        if (action.type === "LOCK") {
          const order = await tx.order.create({
            data: {
              orderNumber: buildOrderNumber(),
              buyerId: demoScenario.buyer.id,
              sellerId: demoScenario.seller.id,
              listingId: demoScenario.listing.id,
              status: "ESCROW_LOCKED",
              quantity: nextState.snapshot.lockedQuantity,
              unitPrice: calculateUnitPrice(action.amount, action.quantity),
              grossAmount: nextState.snapshot.escrowAmount,
              platformFeeAmount: "0",
              sellerReceivableAmount: nextState.snapshot.escrowAmount,
              currency: DEMO_CURRENCY,
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              status: "ESCROW_LOCKED",
              message: "Buyer escrow locked and listing inventory reserved.",
              metadata: {
                quantity: action.quantity,
                amount: action.amount,
              },
            },
          });

          await tx.walletLedgerEntry.createMany({
            data: [
              {
                walletId: demoScenario.buyerWallet.id,
                userId: demoScenario.buyer.id,
                type: "BUYER_ESCROW_LOCKED",
                direction: "DEBIT",
                bucket: "AVAILABLE",
                amount: action.amount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: order.id,
                memo: "Buyer available balance moved to escrow.",
              },
              {
                walletId: demoScenario.buyerWallet.id,
                userId: demoScenario.buyer.id,
                type: "BUYER_ESCROW_LOCKED",
                direction: "CREDIT",
                bucket: "ESCROW_LOCKED",
                amount: action.amount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: order.id,
                memo: "Buyer escrow locked for order.",
              },
            ],
          });
        }

        if (action.type === "CANCEL") {
          const activeOrder = await findActiveDemoOrder(tx, demoScenario.listing.id);

          if (!activeOrder) {
            throw new Error("No active order found to cancel.");
          }

          await tx.order.update({
            where: { id: activeOrder.id },
            data: {
              status: "CANCELED",
              canceledAt: new Date(),
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: activeOrder.id,
              status: "CANCELED",
              message: "Order canceled and buyer funds refunded.",
              metadata: {
                quantity: currentState.snapshot.lockedQuantity,
                amount: currentState.snapshot.escrowAmount,
              },
            },
          });

          await tx.walletLedgerEntry.createMany({
            data: [
              {
                walletId: demoScenario.buyerWallet.id,
                userId: demoScenario.buyer.id,
                type: "ORDER_CANCELED_REFUND",
                direction: "DEBIT",
                bucket: "ESCROW_LOCKED",
                amount: currentState.snapshot.escrowAmount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: activeOrder.id,
                memo: "Canceled order escrow released.",
              },
              {
                walletId: demoScenario.buyerWallet.id,
                userId: demoScenario.buyer.id,
                type: "ORDER_CANCELED_REFUND",
                direction: "CREDIT",
                bucket: "AVAILABLE",
                amount: currentState.snapshot.escrowAmount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: activeOrder.id,
                memo: "Canceled order refunded to buyer available balance.",
              },
            ],
          });
        }

        if (action.type === "COMPLETE") {
          const activeOrder = await findActiveDemoOrder(tx, demoScenario.listing.id);

          if (!activeOrder) {
            throw new Error("No active order found to complete.");
          }

          await tx.order.update({
            where: { id: activeOrder.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: activeOrder.id,
              status: "COMPLETED",
              message: "Order completed and seller settlement released.",
              metadata: {
                quantity: currentState.snapshot.lockedQuantity,
                amount: currentState.snapshot.escrowAmount,
              },
            },
          });

          await tx.walletLedgerEntry.createMany({
            data: [
              {
                walletId: demoScenario.buyerWallet.id,
                userId: demoScenario.buyer.id,
                type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
                direction: "DEBIT",
                bucket: "ESCROW_LOCKED",
                amount: currentState.snapshot.escrowAmount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: activeOrder.id,
                memo: "Completed order escrow released.",
              },
              {
                walletId: demoScenario.sellerWallet.id,
                userId: demoScenario.seller.id,
                type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
                direction: "CREDIT",
                bucket: "AVAILABLE",
                amount: currentState.snapshot.escrowAmount,
                currency: DEMO_CURRENCY,
                referenceType: "ORDER",
                referenceId: activeOrder.id,
                memo: "Completed order released to seller available balance.",
              },
            ],
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          action: `ORDER_LIFECYCLE_${action.type}`,
          targetType: PRISMA_TARGET_TYPE,
          targetId: PRISMA_TARGET_ID,
          reason: getActionReason(action),
          before: currentState as never,
          after: nextState as never,
        },
      });

      return buildStateFromDatabase(tx, demoScenario);
    });
  }

  getStorageMode(): OrderLifecycleStorageMode {
    return "prisma";
  }
}

const memoryRepository = new MemoryOrderLifecycleRepository();
const prismaRepository = new PrismaOrderLifecycleRepository();

export function getOrderLifecycleRepository(): OrderLifecycleRepository {
  return process.env.GGITEM_ORDER_STORAGE === "prisma"
    ? prismaRepository
    : memoryRepository;
}

function reduceOrderLifecycleState(
  currentState: OrderLifecycleApiState,
  action: OrderLifecycleAction,
): OrderLifecycleApiState {
  if (action.type === "RESET") {
    return cloneInitialState();
  }

  if (action.type === "LOCK") {
    const result = lockOrder(currentState.snapshot, {
      orderId: `order-demo-${Date.now()}`,
      quantity: action.quantity,
      amount: action.amount,
    });
    const nextEvent = createOrderLifecycleEvent(result.event);

    return {
      snapshot: result.snapshot,
      lastEvent: nextEvent,
      eventHistory: [nextEvent, ...currentState.eventHistory],
    };
  }

  if (action.type === "CANCEL") {
    const result = cancelOrder(currentState.snapshot);
    const nextEvent = createOrderLifecycleEvent(result.event);

    return {
      snapshot: result.snapshot,
      lastEvent: nextEvent,
      eventHistory: [nextEvent, ...currentState.eventHistory],
    };
  }

  const result = completeOrder(currentState.snapshot);
  const nextEvent = createOrderLifecycleEvent(result.event);

  return {
    snapshot: result.snapshot,
    lastEvent: nextEvent,
    eventHistory: [nextEvent, ...currentState.eventHistory],
  };
}

function cloneInitialState(): OrderLifecycleApiState {
  return JSON.parse(JSON.stringify(initialOrderLifecycleApiState));
}

async function ensureDemoScenario(
  tx: ReturnType<typeof getPrismaClient> extends infer T
    ? T extends { $transaction: (arg: infer U) => unknown }
      ? U extends (arg: infer V) => unknown
        ? V
        : never
      : never
    : never,
) {
  const buyer = await tx.user.upsert({
    where: { email: DEMO_BUYER_EMAIL },
    update: {
      displayName: "trader-a-demo",
      role: "CUSTOMER",
    },
    create: {
      email: DEMO_BUYER_EMAIL,
      displayName: "trader-a-demo",
      role: "CUSTOMER",
    },
  });

  const seller = await tx.user.upsert({
    where: { email: DEMO_SELLER_EMAIL },
    update: {
      displayName: "trader-b-demo",
      role: "CUSTOMER",
    },
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
    update: {
      name: "Demo Gold Trade",
    },
    create: {
      code: DEMO_GAME_CODE,
      name: "Demo Gold Trade",
    },
  });

  const listing = await tx.listing.upsert({
    where: {
      id:
        (
          await tx.listing.findFirst({
            where: {
              sellerId: seller.id,
              title: DEMO_LISTING_TITLE,
            },
            select: { id: true },
          })
        )?.id ?? "missing-demo-listing",
    },
    update: {
      unitPrice: "0.0005",
      status: "ACTIVE",
      currency: DEMO_CURRENCY,
    },
    create: {
      sellerId: seller.id,
      gameId: game.id,
      category: "GAME_MONEY",
      title: DEMO_LISTING_TITLE,
      description: "Demo listing used by the order lifecycle admin page.",
      unitPrice: "0.0005",
      currency: DEMO_CURRENCY,
      status: "ACTIVE",
    },
  });

  const inventory = await tx.listingInventory.upsert({
    where: { listingId: listing.id },
    update: {},
    create: {
      listingId: listing.id,
      totalQuantity: "900000",
      availableQuantity: "900000",
      lockedQuantity: "0",
      soldQuantity: "0",
    },
  });

  return { buyer, seller, buyerWallet, sellerWallet, game, listing, inventory };
}

async function buildStateFromDatabase(
  tx: ReturnType<typeof getPrismaClient> extends infer T
    ? T extends { $transaction: (arg: infer U) => unknown }
      ? U extends (arg: infer V) => unknown
        ? V
        : never
      : never
    : never,
  demoScenario: Awaited<ReturnType<typeof ensureDemoScenario>>,
): Promise<OrderLifecycleApiState> {
  const buyerWallet = await tx.wallet.findUniqueOrThrow({
    where: { id: demoScenario.buyerWallet.id },
  });
  const sellerWallet = await tx.wallet.findUniqueOrThrow({
    where: { id: demoScenario.sellerWallet.id },
  });
  const inventory = await tx.listingInventory.findUniqueOrThrow({
    where: { id: demoScenario.inventory.id },
  });
  const orders = await tx.order.findMany({
    where: { listingId: demoScenario.listing.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const orderIds = orders.map((order) => order.id);
  const orderEvents =
    orderIds.length > 0
      ? await tx.orderEvent.findMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

  const activeOrder =
    orders.find((order) => order.status === "ESCROW_LOCKED") ?? null;
  const latestOrder = orders[0] ?? null;
  const latestEvent = orderEvents[0] ?? null;

  return {
    snapshot: {
      orderId: activeOrder?.id ?? null,
      status: mapOrderStatus(activeOrder?.status ?? latestOrder?.status ?? null),
      inventory: {
        listingId: demoScenario.listing.id,
        totalQuantity: inventory.totalQuantity.toString(),
        availableQuantity: inventory.availableQuantity.toString(),
        lockedQuantity: inventory.lockedQuantity.toString(),
        soldQuantity: inventory.soldQuantity.toString(),
      },
      buyerWallet: {
        userId: demoScenario.buyer.id,
        currency: buyerWallet.currency,
        availableBalance: buyerWallet.availableBalance.toString(),
        escrowBalance: buyerWallet.escrowLockedBalance.toString(),
      },
      sellerWallet: {
        userId: demoScenario.seller.id,
        currency: sellerWallet.currency,
        availableBalance: sellerWallet.availableBalance.toString(),
        escrowBalance: sellerWallet.escrowLockedBalance.toString(),
      },
      lockedQuantity: activeOrder?.quantity.toString() ?? "0",
      escrowAmount: activeOrder?.grossAmount.toString() ?? "0",
    },
    lastEvent: latestEvent
      ? {
          type: latestEvent.status,
          orderId: latestEvent.orderId,
          quantity: (activeOrder?.quantity ?? latestOrder?.quantity ?? "0").toString(),
          amount: (activeOrder?.grossAmount ?? latestOrder?.grossAmount ?? "0").toString(),
          createdAt: latestEvent.createdAt.toLocaleString("ko-KR", {
            hour12: false,
            timeZone: "Asia/Seoul",
          }),
        }
      : null,
    eventHistory: orderEvents.map((event) => {
      const matchingOrder = orders.find((order) => order.id === event.orderId);

      return {
        type: event.status,
        orderId: event.orderId,
        quantity: matchingOrder?.quantity.toString() ?? "0",
        amount: matchingOrder?.grossAmount.toString() ?? "0",
        createdAt: event.createdAt.toLocaleString("ko-KR", {
          hour12: false,
          timeZone: "Asia/Seoul",
        }),
      };
    }),
  };
}

async function findActiveDemoOrder(
  tx: ReturnType<typeof getPrismaClient> extends infer T
    ? T extends { $transaction: (arg: infer U) => unknown }
      ? U extends (arg: infer V) => unknown
        ? V
        : never
      : never
    : never,
  listingId: string,
) {
  return tx.order.findFirst({
    where: {
      listingId,
      status: "ESCROW_LOCKED",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function resetDemoScenario(
  tx: ReturnType<typeof getPrismaClient> extends infer T
    ? T extends { $transaction: (arg: infer U) => unknown }
      ? U extends (arg: infer V) => unknown
        ? V
        : never
      : never
    : never,
  demoScenario: Awaited<ReturnType<typeof ensureDemoScenario>>,
) {
  const orderIds = (
    await tx.order.findMany({
      where: { listingId: demoScenario.listing.id },
      select: { id: true },
    })
  ).map((order) => order.id);

  if (orderIds.length > 0) {
    await tx.orderEvent.deleteMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
    });

    await tx.walletLedgerEntry.deleteMany({
      where: {
        referenceType: "ORDER",
        referenceId: {
          in: orderIds,
        },
      },
    });

    await tx.order.deleteMany({
      where: {
        id: {
          in: orderIds,
        },
      },
    });
  }

  await tx.wallet.update({
    where: { id: demoScenario.buyerWallet.id },
    data: {
      availableBalance: "500",
      escrowLockedBalance: "0",
    },
  });

  await tx.wallet.update({
    where: { id: demoScenario.sellerWallet.id },
    data: {
      availableBalance: "0",
      escrowLockedBalance: "0",
    },
  });

  await tx.listingInventory.update({
    where: { id: demoScenario.inventory.id },
    data: {
      totalQuantity: "900000",
      availableQuantity: "900000",
      lockedQuantity: "0",
      soldQuantity: "0",
      version: {
        increment: 1,
      },
    },
  });
}

function mapOrderStatus(status: string | null): "IDLE" | "LOCKED" | "CANCELED" | "COMPLETED" {
  if (status === "ESCROW_LOCKED") {
    return "LOCKED";
  }

  if (status === "CANCELED") {
    return "CANCELED";
  }

  if (status === "COMPLETED") {
    return "COMPLETED";
  }

  return "IDLE";
}

function calculateUnitPrice(amount: string, quantity: string): string {
  const grossAmount = parseFixedAmount(amount);
  const requestedQuantity = parseFixedQuantity(quantity);

  if (requestedQuantity <= 0n) {
    throw new Error("Purchase quantity must be greater than zero.");
  }

  const scaledPrice = (grossAmount * 1_000_000n) / requestedQuantity;
  return formatFixedAmount(scaledPrice);
}

function buildOrderNumber() {
  return `ORD-${Date.now()}`;
}

function getActionReason(action: OrderLifecycleAction): string {
  if (action.type === "LOCK") {
    return `Lock ${action.quantity} for ${action.amount} USDT`;
  }

  if (action.type === "CANCEL") {
    return "Cancel locked order";
  }

  if (action.type === "COMPLETE") {
    return "Complete locked order";
  }

  return "Reset order lifecycle simulator";
}
