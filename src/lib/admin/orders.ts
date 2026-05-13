import {
  completePurchaseQuantity,
  releasePurchaseQuantity,
} from "@/lib/inventory/purchase-lock";
import { createUserNotification } from "@/lib/notifications/notifications";
import { sendAdminTelegramAlert } from "@/lib/notifications/telegram";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

export type AdminOrderListItem = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  quantity: string;
  grossAmount: string;
  currency: string;
  createdAt: string;
};

export type AdminOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  buyerId: string;
  sellerId: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  quantity: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  platformFeeAmount: string;
  escrowAmount: string;
  currency: string;
  tradeCharacterName: string | null;
  createdAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  disputeReason: string | null;
  links: {
    adminOrder: string;
    buyerOrder: string;
    sellerOrder: string;
    buyerChat: string;
    sellerChat: string;
    ledger: string;
    audit: string;
  };
  decisionPreview: {
    refundBuyer: string;
    releaseToSeller: string;
  };
  events: Array<{
    eventId: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
  ledgerEntries: Array<{
    entryId: string;
    userId: string;
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    createdAt: string;
    memo: string | null;
  }>;
};

export type AdminOrdersState = {
  orders: AdminOrderListItem[];
  selectedOrderId: string | null;
  detail: AdminOrderDetail | null;
  filters: {
    status: string;
    query: string;
  };
};

export type AdminDisputeActionResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  grossAmount: string;
  currency: string;
  message: string;
};

export type AdminDisputeListItem = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  quantity: string;
  grossAmount: string;
  currency: string;
  createdAt: string;
  disputeNote: string | null;
};

export type AdminDisputesState = {
  disputes: AdminDisputeListItem[];
  selectedOrderId: string | null;
  detail: AdminOrderDetail | null;
  filters: {
    view: string;
    query: string;
  };
};

export async function getAdminOrdersState(
  selectedOrderId?: string | null,
  filters?: {
    status?: string | null;
    query?: string | null;
  },
): Promise<AdminOrdersState> {
  const prisma = getPrismaClient();
  const normalizedStatus = filters?.status?.trim() || "ALL";
  const normalizedQuery = filters?.query?.trim() || "";
  const orders = await prisma.order.findMany({
    where: {
      ...(normalizedStatus !== "ALL" ? { status: normalizedStatus as never } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              {
                orderNumber: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                listing: {
                  title: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
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
              {
                seller: {
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
    select: {
      id: true,
      orderNumber: true,
      status: true,
      quantity: true,
      grossAmount: true,
      currency: true,
      createdAt: true,
      buyer: {
        select: {
          displayName: true,
        },
      },
      seller: {
        select: {
          displayName: true,
        },
      },
      listing: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const normalizedSelectedOrderId = selectedOrderId ?? orders[0]?.id ?? null;

  const detail = normalizedSelectedOrderId
    ? await buildOrderDetail(normalizedSelectedOrderId)
    : null;

  return {
    orders: orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingTitle: order.listing.title,
      buyerName: order.buyer.displayName,
      sellerName: order.seller.displayName,
      quantity: order.quantity.toString(),
      grossAmount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
    })),
    selectedOrderId: normalizedSelectedOrderId,
    detail,
    filters: {
      status: normalizedStatus,
      query: normalizedQuery,
    },
  };
}

export async function resolveAdminDispute(input: {
  orderId: string;
  action: "REFUND_BUYER" | "RELEASE_TO_SELLER";
  adminId?: string;
  note?: string;
}): Promise<AdminDisputeActionResult> {
  const prisma = getPrismaClient();
  const trimmedNote = input.note?.trim();

  if (!trimmedNote || trimmedNote.length < 20) {
    throw new Error("분쟁 종료 전 처리 메모를 20자 이상 입력해야 합니다.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: {
        id: input.orderId,
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
      throw new Error("주문을 찾을 수 없습니다.");
    }

    if (order.status !== "DISPUTED") {
      throw new Error("분쟁 상태의 주문만 여기서 처리할 수 있습니다.");
    }

    const buyerWallet = await tx.wallet.findUnique({ where: { userId: order.buyerId } });
    const sellerWallet = await tx.wallet.findUnique({ where: { userId: order.sellerId } });

    if (!buyerWallet || !sellerWallet) {
      throw new Error("주문 지갑 정보를 찾을 수 없습니다.");
    }

    if (buyerWallet.currency !== order.currency || sellerWallet.currency !== order.currency) {
      throw new Error("주문 지갑 통화가 일치하지 않습니다.");
    }

    const escrowAmount = parseFixedAmount(order.grossAmount.toString());
    const sellerReceivableAmount = parseFixedAmount(order.sellerReceivableAmount.toString());
    const platformFeeAmount = parseFixedAmount(order.platformFeeAmount.toString());

    if (escrowAmount <= 0n) throw new Error("주문 금액은 0보다 커야 합니다.");
    if (sellerReceivableAmount <= 0n) throw new Error("판매자 정산 금액은 0보다 커야 합니다.");
    if (escrowAmount !== sellerReceivableAmount + platformFeeAmount) {
      throw new Error("주문 금액과 정산 금액이 일치하지 않습니다.");
    }

    if (input.action === "REFUND_BUYER") {
      const buyerAvailable = parseFixedAmount(buyerWallet.availableBalance.toString());
      const buyerWithdrawable = parseFixedAmount(buyerWallet.withdrawableBalance.toString());
      const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());

      if (buyerEscrow < escrowAmount) {
        throw new Error("구매자 환불을 처리하기 위한 에스크로 금액이 부족합니다.");
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

      const disputeUpdate = await tx.order.updateMany({
        where: { id: order.id, status: "DISPUTED" },
        data: { status: "REFUNDED", canceledAt: new Date() },
      });

      if (disputeUpdate.count !== 1) {
        throw new Error("이미 처리된 분쟁 주문입니다. 화면을 새로고침한 뒤 다시 확인해 주세요.");
      }

      await tx.wallet.update({
        where: { id: buyerWallet.id },
        data: {
          availableBalance: formatFixedAmount(buyerAvailable + escrowAmount),
          withdrawableBalance: formatFixedAmount(buyerWithdrawable + escrowAmount),
          escrowLockedBalance: formatFixedAmount(buyerEscrow - escrowAmount),
        },
      });

      await tx.listingInventory.update({
        where: { id: order.listing.inventory.id },
        data: {
          availableQuantity: inventoryResult.inventory.availableQuantity,
          lockedQuantity: inventoryResult.inventory.lockedQuantity,
          soldQuantity: inventoryResult.inventory.soldQuantity,
          version: { increment: 1 },
        },
      });

      await tx.buyRequest.updateMany({
        where: {
          status: "ACCEPTED",
          offers: { some: { listingId: order.listing.id, status: "ACCEPTED" } },
        },
        data: { status: "CANCELED" },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "REFUNDED",
          message: trimmedNote
            ? "관리자가 구매자 환불로 분쟁을 종료했습니다. 메모: " + trimmedNote
            : "관리자가 구매자 환불로 분쟁을 종료했습니다.",
          metadata: { action: input.action, note: trimmedNote ?? null, escrowAmount: order.grossAmount.toString() },
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: buyerWallet.id,
            userId: order.buyerId,
            type: "DISPUTE_REFUND",
            direction: "DEBIT",
            bucket: "ESCROW_LOCKED",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "관리자 분쟁 처리로 구매자 에스크로 금액을 해제했습니다.",
          },
          {
            walletId: buyerWallet.id,
            userId: order.buyerId,
            type: "DISPUTE_REFUND",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "관리자 분쟁 처리로 구매자 보유 금액을 환불했습니다.",
          },
          {
            walletId: buyerWallet.id,
            userId: order.buyerId,
            type: "DISPUTE_REFUND",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: order.grossAmount.toString(),
            currency: order.currency,
            referenceType: "ORDER",
            referenceId: order.id,
            memo: "관리자 분쟁 처리로 구매자 출금 가능 금액을 환불했습니다.",
          },
        ],
      });

      await createUserNotification({
        userId: order.buyerId,
        type: "DISPUTE_UPDATE",
        title: "분쟁이 구매자 환불로 종료되었습니다.",
        body: "주문 " + order.orderNumber + "의 에스크로 금액이 지갑으로 환불되었습니다.",
        href: "/my/orders/" + order.id,
        metadata: { orderId: order.id, action: input.action },
      });

      await createUserNotification({
        userId: order.sellerId,
        type: "DISPUTE_UPDATE",
        title: "분쟁이 구매자 환불로 종료되었습니다.",
        body: "주문 " + order.orderNumber + "이 구매자 환불로 종료되었습니다.",
        href: "/my/listings/orders/" + order.id,
        metadata: { orderId: order.id, action: input.action },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: input.adminId,
          action: "DISPUTE_REFUNDED_TO_BUYER",
          targetType: "ORDER",
          targetId: order.id,
          reason: trimmedNote ?? "관리자 분쟁 처리: 구매자 환불",
          before: {
            status: order.status,
            grossAmount: order.grossAmount.toString(),
            buyerId: order.buyerId,
            sellerId: order.sellerId,
          },
          after: { status: "REFUNDED", refundedAmount: order.grossAmount.toString(), action: input.action },
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: "REFUNDED",
        grossAmount: order.grossAmount.toString(),
        currency: order.currency,
        message: "구매자 환불로 분쟁이 종료되었습니다.",
      };
    }

    const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());
    const sellerAvailable = parseFixedAmount(sellerWallet.availableBalance.toString());
    const sellerWithdrawable = parseFixedAmount(sellerWallet.withdrawableBalance.toString());

    if (buyerEscrow < escrowAmount) {
      throw new Error("판매자 정산을 처리하기 위한 에스크로 금액이 부족합니다.");
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

    const disputeUpdate = await tx.order.updateMany({
      where: { id: order.id, status: "DISPUTED" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    if (disputeUpdate.count !== 1) {
      throw new Error("이미 처리된 분쟁 주문입니다. 화면을 새로고침한 뒤 다시 확인해 주세요.");
    }

    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: { escrowLockedBalance: formatFixedAmount(buyerEscrow - escrowAmount) },
    });

    await tx.wallet.update({
      where: { id: sellerWallet.id },
      data: {
        availableBalance: formatFixedAmount(sellerAvailable + sellerReceivableAmount),
        withdrawableBalance: formatFixedAmount(sellerWithdrawable + sellerReceivableAmount),
      },
    });

    await tx.listingInventory.update({
      where: { id: order.listing.inventory.id },
      data: {
        availableQuantity: inventoryResult.inventory.availableQuantity,
        lockedQuantity: inventoryResult.inventory.lockedQuantity,
        soldQuantity: inventoryResult.inventory.soldQuantity,
        version: { increment: 1 },
      },
    });

    await tx.buyRequest.updateMany({
      where: {
        status: "ACCEPTED",
        offers: { some: { listingId: order.listing.id, status: "ACCEPTED" } },
      },
      data: { status: "COMPLETED" },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "COMPLETED",
        message: trimmedNote
          ? "관리자가 판매자 정산 승인으로 분쟁을 종료했습니다. 메모: " + trimmedNote
          : "관리자가 판매자 정산 승인으로 분쟁을 종료했습니다.",
        metadata: {
          action: input.action,
          note: trimmedNote ?? null,
          escrowAmount: order.grossAmount.toString(),
          sellerReceivableAmount: order.sellerReceivableAmount.toString(),
          platformFeeAmount: order.platformFeeAmount.toString(),
        },
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: buyerWallet.id,
          userId: order.buyerId,
          type: "DISPUTE_RELEASE",
          direction: "DEBIT",
          bucket: "ESCROW_LOCKED",
          amount: order.grossAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "관리자 분쟁 처리로 구매자 에스크로 금액을 해제했습니다.",
        },
        {
          walletId: sellerWallet.id,
          userId: order.sellerId,
          type: "DISPUTE_RELEASE",
          direction: "CREDIT",
          bucket: "AVAILABLE",
          amount: order.sellerReceivableAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "관리자 분쟁 처리로 판매자 보유 금액을 정산했습니다.",
        },
        {
          walletId: sellerWallet.id,
          userId: order.sellerId,
          type: "DISPUTE_RELEASE",
          direction: "CREDIT",
          bucket: "WITHDRAWABLE",
          amount: order.sellerReceivableAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "관리자 분쟁 처리로 판매자 출금 가능 금액을 정산했습니다.",
        },
        ...(platformFeeAmount > 0n
          ? [
              {
                walletId: buyerWallet.id,
                userId: order.buyerId,
                type: "PLATFORM_FEE_COLLECTED" as const,
                direction: "CREDIT" as const,
                bucket: "PLATFORM_REVENUE" as const,
                amount: order.platformFeeAmount.toString(),
                currency: order.currency,
                referenceType: "ORDER",
                referenceId: order.id,
                memo: "관리자 분쟁 처리로 플랫폼 수수료가 확정되었습니다.",
              },
            ]
          : []),
      ],
    });

    await createUserNotification({
      userId: order.buyerId,
      type: "DISPUTE_UPDATE",
      title: "분쟁이 판매자 정산으로 종료되었습니다.",
      body: "주문 " + order.orderNumber + "이 판매자 정산 승인으로 완료되었습니다.",
      href: "/my/orders/" + order.id,
      metadata: { orderId: order.id, action: input.action },
    });

    await createUserNotification({
      userId: order.sellerId,
      type: "DISPUTE_UPDATE",
      title: "분쟁이 판매자 정산으로 종료되었습니다.",
      body: "주문 " + order.orderNumber + "의 판매 대금이 지갑에 정산되었습니다.",
      href: "/my/listings/orders/" + order.id,
      metadata: { orderId: order.id, action: input.action },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        action: "DISPUTE_RELEASED_TO_SELLER",
        targetType: "ORDER",
        targetId: order.id,
        reason: trimmedNote ?? "관리자 분쟁 처리: 판매자 정산 승인",
        before: {
          status: order.status,
          grossAmount: order.grossAmount.toString(),
          buyerId: order.buyerId,
          sellerId: order.sellerId,
        },
        after: {
          status: "COMPLETED",
          sellerReceivableAmount: order.sellerReceivableAmount.toString(),
          platformFeeAmount: order.platformFeeAmount.toString(),
          action: input.action,
        },
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: "COMPLETED",
      grossAmount: order.grossAmount.toString(),
      currency: order.currency,
      message: "판매자 정산 승인으로 분쟁이 종료되었습니다.",
    };
  });

  await sendAdminTelegramAlert({
    title: "분쟁 처리 완료",
    lines: [
      `주문 번호: ${result.orderNumber}`,
      `주문 ID: ${result.orderId}`,
      `금액: ${result.grossAmount} ${result.currency}`,
      `상태: ${result.status}`,
      `처리: ${input.action}`,
      `메모: ${trimmedNote}`,
    ],
  });

  return result;
}

export async function getAdminDisputesState(
  selectedOrderId?: string | null,
  filters?: {
    view?: string | null;
    query?: string | null;
  },
): Promise<AdminDisputesState> {
  const prisma = getPrismaClient();
  const normalizedView = filters?.view?.trim() || "OPEN";
  const normalizedQuery = filters?.query?.trim() || "";

  const orders = await prisma.order.findMany({
    where: {
      ...(buildDisputeWhere(normalizedView) as object),
      ...(normalizedQuery
        ? {
            OR: [
              {
                orderNumber: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                listing: {
                  title: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
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
              {
                seller: {
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
    include: {
      buyer: true,
      seller: true,
      listing: true,
      events: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const normalizedSelectedOrderId = selectedOrderId ?? orders[0]?.id ?? null;
  const detail = normalizedSelectedOrderId
    ? await buildOrderDetail(normalizedSelectedOrderId)
    : null;

  return {
    disputes: orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingTitle: order.listing.title,
      buyerName: order.buyer.displayName,
      sellerName: order.seller.displayName,
      quantity: order.quantity.toString(),
      grossAmount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
      disputeNote: extractOrderDecisionNote(order.events)?.message ?? null,
    })),
    selectedOrderId: normalizedSelectedOrderId,
    detail,
    filters: {
      view: normalizedView,
      query: normalizedQuery,
    },
  };
}

function buildDisputeWhere(view: string) {
  if (view === "REFUNDED") {
    return { status: "REFUNDED" as never };
  }

  if (view === "RELEASED") {
    return {
      status: "COMPLETED" as never,
      events: {
        some: {
          status: "COMPLETED" as never,
          OR: [
            {
              message: {
                contains: "관리자가 판매자 정산 승인으로 분쟁을 종료했습니다.",
                mode: "insensitive" as const,
              },
            },
          ],
        },
      },
    };
  }

  return {
    status: "DISPUTED" as never,
  };
}

async function buildOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      seller: true,
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

  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: {
      referenceType: "ORDER",
      referenceId: order.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    listingTitle: order.listing.title,
    buyerName: order.buyer.displayName,
    sellerName: order.seller.displayName,
    quantity: order.quantity.toString(),
    grossAmount: order.grossAmount.toString(),
    sellerReceivableAmount: order.sellerReceivableAmount.toString(),
    platformFeeAmount: order.platformFeeAmount.toString(),
    escrowAmount: order.grossAmount.toString(),
    currency: order.currency,
    tradeCharacterName: order.tradeCharacterName,
    createdAt: formatKoreanDate(order.createdAt),
    completedAt: order.completedAt ? formatKoreanDate(order.completedAt) : null,
    canceledAt: order.canceledAt ? formatKoreanDate(order.canceledAt) : null,
    disputeReason: extractDisputeReason(order.events),
    links: {
      adminOrder: `/admin/orders?orderId=${order.id}&query=${order.id}`,
      buyerOrder: `/my/orders/${order.id}`,
      sellerOrder: `/my/listings/orders/${order.id}`,
      buyerChat: `/my/orders/${order.id}/chat`,
      sellerChat: `/my/listings/orders/${order.id}/chat`,
      ledger: `/admin/finance/ledger?q=${order.id}`,
      audit: `/admin/audit?query=${order.id}`,
    },
    decisionPreview: {
      refundBuyer: `구매자에게 ${order.grossAmount.toString()} ${order.currency} 환불, 잠긴 재고 복구, 주문은 환불 완료로 종료됩니다.`,
      releaseToSeller: `판매자에게 ${order.sellerReceivableAmount.toString()} ${order.currency} 정산, 플랫폼 수수료 ${order.platformFeeAmount.toString()} ${order.currency}는 지급 제외, 주문은 완료로 종료됩니다.`,
    },
    events: order.events.map((event) => ({
      eventId: event.id,
      status: event.status,
      message: event.message,
      createdAt: formatKoreanDate(event.createdAt),
    })),
    ledgerEntries: ledgerEntries.map((entry) => ({
      entryId: entry.id,
      userId: entry.userId,
      type: entry.type,
      direction: entry.direction,
      bucket: entry.bucket,
      amount: entry.amount.toString(),
      createdAt: formatKoreanDate(entry.createdAt),
      memo: entry.memo,
    })),
  };
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function extractOrderDecisionNote(
  events: Array<{
    status: string;
    message: string;
  }>,
) {
  return events.find(
    (event) =>
      (event.status === "REFUNDED" || event.status === "COMPLETED") &&
      (event.message.includes("Note:") || event.message.includes("메모:")),
  );
}

function extractDisputeReason(
  events: Array<{
    status: string;
    message: string;
  }>,
) {
  const disputeEvent = events.find((event) => event.status === "DISPUTED");
  if (!disputeEvent) {
    return null;
  }

  return disputeEvent.message
    .replace("Buyer reported a problem:", "구매자 분쟁 사유:")
    .replace("구매자 분쟁 사유:", "")
    .trim();
}
