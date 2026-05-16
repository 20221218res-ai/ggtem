import {
  completePurchaseQuantity,
  releasePurchaseQuantity,
} from "@/lib/inventory/purchase-lock";
import { createUserNotification } from "@/lib/notifications/notifications";
import { sendAdminTelegramAlert } from "@/lib/notifications/telegram";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import { getCurrentUserEmailForRole } from "@/lib/auth/session";

const MARKET_USER_EMAIL = "user-demo@ggitem.local";
const MARKET_USER_ROLES = ["CUSTOMER", "SELLER"];
const BUYER_DISPUTE_ALLOWED_STATUSES = [
  "ESCROW_LOCKED",
  "SELLER_RESPONSE_PENDING",
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
];

export type MarketplaceMyOrderSummary = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingId: string;
  listingTitle: string;
  category: string;
  gameName: string;
  serverName: string | null;
  moneyUnitName: string;
  priceUnitQuantity: string;
  accountTransferType: string | null;
  sellerName: string;
  quantity: string;
  amount: string;
  currency: string;
  createdAt: string;
  latestEvent: {
    status: string;
    message: string;
    createdAt: string;
  } | null;
};

export type MarketplaceMyOrdersView = {
  buyerName: string;
  wallet: {
    availableBalance: string;
    escrowBalance: string;
    currency: string;
  } | null;
  orders: MarketplaceMyOrderSummary[];
};

export type MarketplaceMyOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingId: string;
  listingTitle: string;
  category: string;
  gameName: string;
  serverName: string | null;
  moneyUnitName: string;
  priceUnitQuantity: string;
  accountTransferType: string | null;
  tradeCharacterName: string | null;
  buyerGameNickname: string | null;
  sellerGameNickname: string | null;
  sellerName: string;
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
  review: {
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
};

export type BuyerOrderActionResult = {
  orderId: string;
  status: string;
  message: string;
};

export async function getMarketplaceMyOrders(): Promise<MarketplaceMyOrdersView> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_USER_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      displayName: true,
      wallet: {
        select: {
          availableBalance: true,
          escrowLockedBalance: true,
          currency: true,
        },
      },
      buyerOrders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          listingId: true,
          quantity: true,
          grossAmount: true,
          currency: true,
          createdAt: true,
          listing: {
            select: {
              title: true,
              category: true,
              priceUnitQuantity: true,
              accountTransferType: true,
              game: {
                select: {
                  name: true,
                  moneyUnitName: true,
                },
              },
              server: {
                select: {
                  name: true,
                },
              },
            },
          },
          seller: {
            select: {
              displayName: true,
            },
          },
          events: {
            select: {
              status: true,
              message: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      },
    },
  });

  if (!buyer) {
    return {
      buyerName: "구매자",
      wallet: null,
      orders: [],
    };
  }

  return {
    buyerName: buyer.displayName,
    wallet: buyer.wallet
      ? {
          availableBalance: buyer.wallet.availableBalance.toString(),
          escrowBalance: buyer.wallet.escrowLockedBalance.toString(),
          currency: buyer.wallet.currency,
        }
      : null,
    orders: buyer.buyerOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingId: order.listingId,
      listingTitle: order.listing.title,
      category: order.listing.category,
      gameName: order.listing.game.name,
      serverName: order.listing.server?.name ?? null,
      moneyUnitName: order.listing.game.moneyUnitName,
      priceUnitQuantity: order.listing.priceUnitQuantity?.toString() ?? "1",
      accountTransferType: order.listing.accountTransferType,
      sellerName: order.seller.displayName,
      quantity: order.quantity.toString(),
      amount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
      latestEvent: order.events[0]
        ? {
            status: order.events[0].status,
            message: order.events[0].message,
            createdAt: formatKoreanDate(order.events[0].createdAt),
          }
        : null,
    })),
  };
}

export async function getMarketplaceMyOrderDetail(
  orderId: string,
): Promise<MarketplaceMyOrderDetail | null> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: ["CUSTOMER"],
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!buyer) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      listingId: true,
      quantity: true,
      grossAmount: true,
      sellerReceivableAmount: true,
      currency: true,
      tradeCharacterName: true,
      buyerGameNickname: true,
      sellerGameNickname: true,
      createdAt: true,
      completedAt: true,
      canceledAt: true,
      listing: {
        select: {
          title: true,
          category: true,
          priceUnitQuantity: true,
          accountTransferType: true,
          game: {
            select: {
              name: true,
              moneyUnitName: true,
            },
          },
          server: {
            select: {
              name: true,
            },
          },
        },
      },
      seller: {
        select: {
          displayName: true,
        },
      },
      events: {
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      review: {
        select: {
          rating: true,
          comment: true,
          createdAt: true,
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
    gameName: order.listing.game.name,
    serverName: order.listing.server?.name ?? null,
    moneyUnitName: order.listing.game.moneyUnitName,
    priceUnitQuantity: order.listing.priceUnitQuantity?.toString() ?? "1",
    accountTransferType: order.listing.accountTransferType,
    sellerName: order.seller.displayName,
    quantity: order.quantity.toString(),
    grossAmount: order.grossAmount.toString(),
    sellerReceivableAmount: order.sellerReceivableAmount.toString(),
    currency: order.currency,
    tradeCharacterName: order.tradeCharacterName,
    buyerGameNickname: order.buyerGameNickname,
    sellerGameNickname: order.sellerGameNickname,
    createdAt: formatKoreanDate(order.createdAt),
    completedAt: order.completedAt ? formatKoreanDate(order.completedAt) : null,
    canceledAt: order.canceledAt ? formatKoreanDate(order.canceledAt) : null,
    events: order.events.map((event) => ({
      eventId: event.id,
      status: event.status,
      message: event.message,
      createdAt: formatKoreanDate(event.createdAt),
    })),
    review: order.review
      ? {
          rating: order.review.rating,
          comment: order.review.comment,
          createdAt: formatKoreanDate(order.review.createdAt),
        }
      : null,
  };
}

export async function updateMarketplaceBuyerOrderStatus(input: {
  orderId: string;
  action: "CANCEL_ORDER" | "CONFIRM_DELIVERY" | "REPORT_PROBLEM";
  reason?: string;
}): Promise<BuyerOrderActionResult> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: ["CUSTOMER"],
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!buyer) {
    throw new Error("\uad6c\ub9e4\uc790 \uacc4\uc815\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        buyerId: buyer.id,
      },
      include: {
        listing: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!order?.listing.inventory) {
      throw new Error("\uad6c\ub9e4 \uc8fc\ubb38\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");
    }

    if (input.action === "CANCEL_ORDER") {
      if (
        order.status !== "ESCROW_LOCKED" &&
        order.status !== "SELLER_RESPONSE_PENDING"
      ) {
        throw new Error("판매자가 전달을 시작하기 전 주문만 취소할 수 있습니다.");
      }

      const buyerWallet = await tx.wallet.findUnique({
        where: {
          userId: buyer.id,
        },
      });

      if (!buyerWallet) {
        throw new Error("구매자 지갑 정보를 찾을 수 없습니다.");
      }

      if (buyerWallet.currency !== order.currency) {
        throw new Error("주문 지갑 통화가 일치하지 않습니다.");
      }

      const refundAmount = parseFixedAmount(order.grossAmount.toString());
      const buyerAvailable = parseFixedAmount(
        buyerWallet.availableBalance.toString(),
      );
      const buyerWithdrawable = parseFixedAmount(
        buyerWallet.withdrawableBalance.toString(),
      );
      const buyerEscrow = parseFixedAmount(
        buyerWallet.escrowLockedBalance.toString(),
      );

      if (refundAmount <= 0n) {
        throw new Error("취소 환불 금액은 0보다 커야 합니다.");
      }

      if (buyerEscrow < refundAmount) {
        throw new Error("주문을 취소하기 위한 에스크로 금액이 부족합니다.");
      }

      const cancelUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: ["ESCROW_LOCKED", "SELLER_RESPONSE_PENDING"],
          },
        },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        },
      });

      if (cancelUpdate.count !== 1) {
        throw new Error("이미 진행 중이거나 취소할 수 없는 주문입니다.");
      }

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
        where: {
          id: buyerWallet.id,
        },
        data: {
          availableBalance: formatFixedAmount(buyerAvailable + refundAmount),
          withdrawableBalance: formatFixedAmount(
            buyerWithdrawable + refundAmount,
          ),
          escrowLockedBalance: formatFixedAmount(buyerEscrow - refundAmount),
        },
      });

      await tx.listingInventory.update({
        where: {
          id: order.listing.inventory.id,
        },
        data: {
          availableQuantity: inventoryResult.inventory.availableQuantity,
          lockedQuantity: inventoryResult.inventory.lockedQuantity,
          soldQuantity: inventoryResult.inventory.soldQuantity,
          version: {
            increment: 1,
          },
        },
      });

      await tx.buyRequest.updateMany({
        where: {
          status: "ACCEPTED",
          offers: {
            some: {
              listingId: order.listing.id,
              status: "ACCEPTED",
            },
          },
        },
        data: {
          status: "CANCELED",
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CANCELED",
          message:
            "구매자가 전달 시작 전 주문을 취소했고 에스크로 금액이 환불되었습니다.",
          metadata: {
            action: input.action,
            refundAmount: order.grossAmount.toString(),
          },
        },
      });

      await createUserNotification({
        userId: order.sellerId,
        type: "ORDER_STATUS",
        title: "구매자가 주문을 취소했습니다",
        body: `주문 ${order.orderNumber}이 전달 시작 전 취소되었습니다.`, 
        href: "/my/listings/orders/" + order.id,
        metadata: {
          orderId: order.id,
          action: input.action,
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: buyerWallet.id,
            userId: buyer.id,
            type: "ORDER_CANCELED_REFUND",
            direction: "DEBIT",
            bucket: "ESCROW_LOCKED",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "주문 취소로 에스크로 금액이 해제되었습니다.",
          },
          {
            walletId: buyerWallet.id,
            userId: buyer.id,
            type: "ORDER_CANCELED_REFUND",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "주문 취소로 금액이 보유 잔액에 반환되었습니다.",
          },
          {
            walletId: buyerWallet.id,
            userId: buyer.id,
            type: "ORDER_CANCELED_REFUND",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "주문 취소로 금액이 출금 가능 잔액에 반환되었습니다.",
          },
        ],
      });

      return {
        orderId: order.id,
        status: "CANCELED",
        message: "주문이 취소되었습니다. 에스크로 금액이 지갑으로 환불되었습니다.",
      };
    }

    if (input.action === "REPORT_PROBLEM") {
      if (!BUYER_DISPUTE_ALLOWED_STATUSES.includes(order.status)) {
        throw new Error("\uc774 \uc8fc\ubb38\uc740 \ub354 \uc774\uc0c1 \ubd84\uc7c1\uc73c\ub85c \uc804\ud658\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");
      }

      const reason = input.reason?.trim();
      if (reason && reason.length > 1200) {
        throw new Error("분쟁 사유는 1,200자 이하로 입력해 주세요.");
      }

      const disputeUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [
              "ESCROW_LOCKED",
              "SELLER_RESPONSE_PENDING",
              "DELIVERY_IN_PROGRESS",
              "DELIVERY_COMPLETED",
              "BUYER_CONFIRM_PENDING",
            ],
          },
        },
        data: {
          status: "DISPUTED",
        },
      });

      if (disputeUpdate.count !== 1) {
        throw new Error("\uc774\ubbf8 \uc644\ub8cc\ub418\uc5c8\uac70\ub098 \ubd84\uc7c1\uc73c\ub85c \uc804\ud658\ud560 \uc218 \uc5c6\ub294 \uc8fc\ubb38\uc785\ub2c8\ub2e4.");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "DISPUTED",
          message: reason
            ? `구매자 분쟁 사유: ${reason}`
            : "구매자가 문제를 신고하고 분쟁 검토를 요청했습니다.",
          metadata: {
            action: input.action,
            reason: reason ?? null,
          },
        },
      });

      await createUserNotification({
        userId: order.sellerId,
        type: "DISPUTE_UPDATE",
        title: "구매자가 분쟁을 제기했습니다",
        body: reason
          ? `주문 ${order.orderNumber}이 분쟁으로 전환되었습니다. ${reason}`
          : `주문 ${order.orderNumber}이 분쟁 검토로 전환되었습니다.`, 
        href: "/my/listings/orders/" + order.id,
        metadata: {
          orderId: order.id,
          action: input.action,
        },
      });

      return {
        orderId: order.id,
        status: "DISPUTED",
        message: "분쟁이 접수되었습니다. 주문은 관리자 검토 상태로 전환되었습니다.",
      };
    }

    if (input.action !== "CONFIRM_DELIVERY") {
      throw new Error("지원하지 않는 구매 액션입니다.");
    }

    if (
      order.status !== "DELIVERY_COMPLETED" &&
      order.status !== "BUYER_CONFIRM_PENDING"
    ) {
      throw new Error("전달 완료 상태의 주문만 인수확정할 수 있습니다.");
    }

    const buyerWallet = await tx.wallet.findUnique({
      where: {
        userId: buyer.id,
      },
    });
    const sellerWallet = await tx.wallet.findUnique({
      where: {
        userId: order.sellerId,
      },
    });

    if (!buyerWallet || !sellerWallet) {
      throw new Error("주문 지갑 정보를 찾을 수 없습니다.");
    }

    if (
      buyerWallet.currency !== order.currency ||
      sellerWallet.currency !== order.currency
    ) {
      throw new Error("주문 지갑 통화가 일치하지 않습니다.");
    }

    const escrowAmount = parseFixedAmount(order.grossAmount.toString());
    const platformFeeAmount = parseFixedAmount(order.platformFeeAmount.toString());
    const sellerReceivableAmount = parseFixedAmount(
      order.sellerReceivableAmount.toString(),
    );
    const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());
    const sellerAvailable = parseFixedAmount(
      sellerWallet.availableBalance.toString(),
    );
    const sellerWithdrawable = parseFixedAmount(
      sellerWallet.withdrawableBalance.toString(),
    );

    if (escrowAmount <= 0n) {
      throw new Error("주문 금액은 0보다 커야 합니다.");
    }

    if (sellerReceivableAmount <= 0n) {
      throw new Error("판매자 정산 금액은 0보다 커야 합니다.");
    }

    if (escrowAmount !== sellerReceivableAmount + platformFeeAmount) {
      throw new Error("주문 금액과 정산 금액이 일치하지 않습니다.");
    }

    if (buyerEscrow < escrowAmount) {
      throw new Error("주문을 완료하기 위한 에스크로 잔액이 부족합니다.");
    }

    const completionUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: {
          in: ["DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING"],
        },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (completionUpdate.count !== 1) {
      throw new Error("이미 완료되었거나 인수확정할 수 없는 주문입니다.");
    }

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
      where: {
        id: buyerWallet.id,
      },
      data: {
        escrowLockedBalance: formatFixedAmount(buyerEscrow - escrowAmount),
      },
    });

    await tx.wallet.update({
      where: {
        id: sellerWallet.id,
      },
      data: {
        availableBalance: formatFixedAmount(
          sellerAvailable + sellerReceivableAmount,
        ),
        withdrawableBalance: formatFixedAmount(
          sellerWithdrawable + sellerReceivableAmount,
        ),
      },
    });

    await tx.listingInventory.update({
      where: {
        id: order.listing.inventory.id,
      },
      data: {
        availableQuantity: inventoryResult.inventory.availableQuantity,
        lockedQuantity: inventoryResult.inventory.lockedQuantity,
        soldQuantity: inventoryResult.inventory.soldQuantity,
        version: {
          increment: 1,
        },
      },
    });

    await tx.buyRequest.updateMany({
      where: {
        status: "ACCEPTED",
        offers: {
          some: {
            listingId: order.listing.id,
            status: "ACCEPTED",
          },
        },
      },
      data: {
        status: "COMPLETED",
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "COMPLETED",
        message: "구매자가 인수확정했고 판매자 정산이 반영되었습니다.",
        metadata: {
          action: input.action,
          escrowAmount: order.grossAmount.toString(),
          sellerReceivableAmount: order.sellerReceivableAmount.toString(),
          platformFeeAmount: order.platformFeeAmount.toString(),
        },
      },
    });

    await createUserNotification({
      userId: order.sellerId,
      type: "ORDER_STATUS",
      title: "구매자가 인수확정했습니다",
      body: `주문 ${order.orderNumber}이 완료되고 판매 대금이 정산되었습니다.`, 
      href: "/my/listings/orders/" + order.id,
      metadata: {
        orderId: order.id,
        action: input.action,
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: buyer.id,
          type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
          direction: "DEBIT",
          bucket: "ESCROW_LOCKED",
          amount: order.grossAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매자 인수확정으로 에스크로 금액이 해제되었습니다.",
        },
        {
          walletId: sellerWallet.id,
          userId: order.sellerId,
          type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
          direction: "CREDIT",
          bucket: "AVAILABLE",
          amount: order.sellerReceivableAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "구매자 인수확정으로 판매자 정산이 반영되었습니다.",
        },
        {
          walletId: sellerWallet.id,
          userId: order.sellerId,
          type: "SETTLEMENT_AVAILABLE",
          direction: "CREDIT",
          bucket: "WITHDRAWABLE",
          amount: order.sellerReceivableAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "판매 정산금이 출금 가능 잔액에 반영되었습니다.",
        },
        ...(platformFeeAmount > 0n
          ? [
              {
                walletId: buyerWallet.id,
                userId: buyer.id,
                type: "PLATFORM_FEE_COLLECTED" as const,
                direction: "CREDIT" as const,
                bucket: "PLATFORM_REVENUE" as const,
                amount: order.platformFeeAmount.toString(),
                currency: order.currency,
                referenceType: "ORDER",
                referenceId: order.id,
                memo: "거래 완료로 플랫폼 수수료가 확정되었습니다.",
              },
            ]
          : []),
      ],
    });

    return {
      orderId: order.id,
      status: "COMPLETED",
      message: "인수확정이 완료되었습니다. 판매자 정산이 반영되었습니다.",
    };
  });

  if (result.status === "DISPUTED") {
    await sendAdminTelegramAlert({
      title: "분쟁 접수",
      lines: [
        `주문 ID: ${result.orderId}`,
        `상태: ${result.status}`,
        input.reason?.trim() ? `사유: ${input.reason.trim()}` : "사유: 미입력",
      ],
    });
  }

  return result;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}
