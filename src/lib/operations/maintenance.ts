import { Prisma } from "@/generated/prisma/client";
import { completePurchaseQuantity } from "@/lib/inventory/purchase-lock";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const WITHDRAWAL_QUEUE_AGE_MINUTES = Number(process.env.WITHDRAWAL_QUEUE_AGE_MINUTES ?? 10);
const WITHDRAWAL_BATCH_LIMIT = Number(process.env.WITHDRAWAL_BATCH_LIMIT ?? 20);
const BUY_REQUEST_EXPIRE_BATCH_LIMIT = Number(process.env.BUY_REQUEST_EXPIRE_BATCH_LIMIT ?? 50);
const AUTO_CONFIRM_BATCH_LIMIT = Number(process.env.ORDER_AUTO_CONFIRM_BATCH_LIMIT ?? 30);

export type MaintenanceResult = {
  withdrawalsQueued: number;
  buyRequestsExpired: number;
  ordersAutoConfirmed: number;
};

export async function runOperationsMaintenance(): Promise<MaintenanceResult> {
  const [withdrawalsQueued, buyRequestsExpired, ordersAutoConfirmed] = await Promise.all([
    moveOldWithdrawalRequestsToReview(),
    expireOldBuyRequests(),
    autoConfirmDueOrders(),
  ]);

  return {
    withdrawalsQueued,
    buyRequestsExpired,
    ordersAutoConfirmed,
  };
}

async function moveOldWithdrawalRequestsToReview() {
  const prisma = getPrismaClient();
  const threshold = new Date(Date.now() - WITHDRAWAL_QUEUE_AGE_MINUTES * 60 * 1000);

  const requests = await prisma.withdrawalRequest.findMany({
    where: {
      status: "REQUESTED",
      requestedAt: {
        lte: threshold,
      },
    },
    orderBy: {
      requestedAt: "asc",
    },
    take: WITHDRAWAL_BATCH_LIMIT,
    select: {
      id: true,
      userId: true,
      amount: true,
      fee: true,
      chain: true,
      destination: true,
    },
  });

  let processed = 0;

  for (const request of requests) {
    const updated = await prisma.$transaction(async (tx) => {
      const update = await tx.withdrawalRequest.updateMany({
        where: {
          id: request.id,
          status: "REQUESTED",
        },
        data: {
          status: "UNDER_REVIEW",
          processedAt: new Date(),
        },
      });

      if (update.count !== 1) {
        return false;
      }

      await tx.withdrawalLog.create({
        data: {
          withdrawalRequestId: request.id,
          userId: request.userId,
          action: "WITHDRAWAL_QUEUE_PROCESSING",
          statusFrom: "REQUESTED",
          statusTo: "UNDER_REVIEW",
          message: "출금 요청이 운영 검토 대기열로 이동했습니다.",
          metadata: {
            amount: request.amount.toString(),
            fee: request.fee.toString(),
            chain: request.chain,
            destination: request.destination,
            queueAgeMinutes: WITHDRAWAL_QUEUE_AGE_MINUTES,
          },
        },
      });

      return true;
    });

    if (updated) {
      processed += 1;
    }
  }

  return processed;
}

async function expireOldBuyRequests() {
  const prisma = getPrismaClient();
  const now = new Date();
  const requests = await prisma.buyRequest.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lte: now,
      },
    },
    orderBy: {
      expiresAt: "asc",
    },
    take: BUY_REQUEST_EXPIRE_BATCH_LIMIT,
    include: {
      buyer: {
        include: {
          wallet: true,
        },
      },
    },
  });

  let processed = 0;

  for (const request of requests) {
    if (!request.buyer.wallet) {
      continue;
    }

    const lockAmount = parseFixedAmount(request.lockAmount.toString());
    const wallet = request.buyer.wallet;
    const buyerAvailable = parseFixedAmount(wallet.availableBalance.toString());
    const buyerWithdrawable = parseFixedAmount(wallet.withdrawableBalance.toString());
    const buyerBuyRequestLocked = parseFixedAmount(wallet.buyRequestLocked.toString());

    const updated = await prisma.$transaction(async (tx) => {
      const expired = await tx.buyRequest.updateMany({
        where: {
          id: request.id,
          status: "ACTIVE",
        },
        data: {
          status: "EXPIRED",
          lockAmount: "0",
        },
      });

      if (expired.count !== 1) {
        return false;
      }

      if (lockAmount > 0n) {
        if (buyerBuyRequestLocked < lockAmount) {
          throw new Error(`구매요청 ${request.id}의 잠금 금액이 일치하지 않습니다.`);
        }

        await tx.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            availableBalance: formatFixedAmount(buyerAvailable + lockAmount),
            withdrawableBalance: formatFixedAmount(buyerWithdrawable + lockAmount),
            buyRequestLocked: formatFixedAmount(buyerBuyRequestLocked - lockAmount),
          },
        });

        await tx.walletLedgerEntry.createMany({
          data: [
            {
              walletId: wallet.id,
              userId: request.buyerId,
              type: "BUY_REQUEST_RELEASED",
              direction: "DEBIT",
              bucket: "BUY_REQUEST_LOCKED",
              amount: formatFixedAmount(lockAmount),
              currency: request.currency,
              referenceType: "BUY_REQUEST",
              referenceId: request.id,
              memo: "구매요청 만료로 예약금 잠금이 해제되었습니다.",
            },
            {
              walletId: wallet.id,
              userId: request.buyerId,
              type: "BUY_REQUEST_RELEASED",
              direction: "CREDIT",
              bucket: "AVAILABLE",
              amount: formatFixedAmount(lockAmount),
              currency: request.currency,
              referenceType: "BUY_REQUEST",
              referenceId: request.id,
              memo: "구매요청 만료로 예약금이 사용 가능 잔액으로 반환되었습니다.",
            },
            {
              walletId: wallet.id,
              userId: request.buyerId,
              type: "BUY_REQUEST_RELEASED",
              direction: "CREDIT",
              bucket: "WITHDRAWABLE",
              amount: formatFixedAmount(lockAmount),
              currency: request.currency,
              referenceType: "BUY_REQUEST",
              referenceId: request.id,
              memo: "구매요청 만료로 예약금이 출금 가능 잔액으로 반환되었습니다.",
            },
          ],
        });
      }

      await tx.notification.create({
        data: {
          userId: request.buyerId,
          type: "WALLET_UPDATE",
          title: "구매요청이 만료되었습니다",
          body: "구매요청 기간이 지나 예약금이 지갑으로 반환되었습니다.",
          href: "/my/buy-requests",
          metadata: {
            buyRequestId: request.id,
            action: "BUY_REQUEST_EXPIRED",
          },
        },
      });

      return true;
    });

    if (updated) {
      processed += 1;
    }
  }

  return processed;
}

async function autoConfirmDueOrders() {
  const prisma = getPrismaClient();
  const orders = await prisma.order.findMany({
    where: {
      status: "BUYER_CONFIRM_PENDING",
      autoConfirmAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      autoConfirmAt: "asc",
    },
    take: AUTO_CONFIRM_BATCH_LIMIT,
    include: {
      listing: {
        include: {
          inventory: true,
        },
      },
    },
  });

  let processed = 0;

  for (const order of orders) {
    const inventory = order.listing.inventory;
    if (!inventory) {
      continue;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const buyerWallet = await tx.wallet.findUnique({ where: { userId: order.buyerId } });
      const sellerWallet = await tx.wallet.findUnique({ where: { userId: order.sellerId } });

      if (!buyerWallet || !sellerWallet) {
        throw new Error(`주문 ${order.id}의 지갑 정보를 찾을 수 없습니다.`);
      }

      const escrowAmount = parseFixedAmount(order.grossAmount.toString());
      const platformFeeAmount = parseFixedAmount(order.platformFeeAmount.toString());
      const sellerReceivableAmount = parseFixedAmount(order.sellerReceivableAmount.toString());
      const buyerEscrow = parseFixedAmount(buyerWallet.escrowLockedBalance.toString());
      const sellerAvailable = parseFixedAmount(sellerWallet.availableBalance.toString());
      const sellerWithdrawable = parseFixedAmount(sellerWallet.withdrawableBalance.toString());

      if (buyerEscrow < escrowAmount) {
        throw new Error(`주문 ${order.id}의 에스크로 금액이 부족합니다.`);
      }

      const now = new Date();
      const completionUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "BUYER_CONFIRM_PENDING",
          autoConfirmAt: {
            lte: now,
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
      });

      if (completionUpdate.count !== 1) {
        return false;
      }

      const inventoryResult = completePurchaseQuantity(
        {
          listingId: order.listing.id,
          totalQuantity: inventory.totalQuantity.toString(),
          availableQuantity: inventory.availableQuantity.toString(),
          lockedQuantity: inventory.lockedQuantity.toString(),
          soldQuantity: inventory.soldQuantity.toString(),
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
          escrowLockedBalance: formatFixedAmount(buyerEscrow - escrowAmount),
        },
      });

      await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: {
          availableBalance: formatFixedAmount(sellerAvailable + sellerReceivableAmount),
          withdrawableBalance: formatFixedAmount(sellerWithdrawable + sellerReceivableAmount),
        },
      });

      await tx.listingInventory.update({
        where: { id: inventory.id },
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
          message: "자동 인수확정 기한이 지나 판매자 정산이 반영되었습니다.",
          metadata: {
            action: "AUTO_CONFIRM",
            autoConfirmAt: order.autoConfirmAt?.toISOString() ?? null,
            escrowAmount: order.grossAmount.toString(),
            sellerReceivableAmount: order.sellerReceivableAmount.toString(),
            platformFeeAmount: order.platformFeeAmount.toString(),
          },
        },
      });

      const ledgerEntries: Prisma.WalletLedgerEntryCreateManyInput[] = [
        {
          walletId: buyerWallet.id,
          userId: order.buyerId,
          type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
          direction: "DEBIT",
          bucket: "ESCROW_LOCKED",
          amount: order.grossAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "자동 인수확정으로 에스크로 금액이 해제되었습니다.",
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
          memo: "자동 인수확정으로 판매자 정산이 반영되었습니다.",
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
          memo: "자동 인수확정 정산금이 출금 가능 잔액에 반영되었습니다.",
        },
      ];

      if (platformFeeAmount > 0n) {
        ledgerEntries.push({
          walletId: buyerWallet.id,
          userId: order.buyerId,
          type: "PLATFORM_FEE_COLLECTED",
          direction: "CREDIT",
          bucket: "PLATFORM_REVENUE",
          amount: order.platformFeeAmount.toString(),
          currency: order.currency,
          referenceType: "ORDER",
          referenceId: order.id,
          memo: "자동 인수확정으로 플랫폼 수수료가 확정되었습니다.",
        });
      }

      await tx.walletLedgerEntry.createMany({
        data: ledgerEntries,
      });

      await tx.notification.createMany({
        data: [
          {
            userId: order.buyerId,
            type: "ORDER_STATUS",
            title: "주문이 자동 인수확정되었습니다",
            body: `주문 ${order.orderNumber}이 자동 완료 처리되었습니다.`,
            href: `/my/orders/${order.id}`,
            metadata: { orderId: order.id, action: "AUTO_CONFIRM" },
          },
          {
            userId: order.sellerId,
            type: "ORDER_STATUS",
            title: "주문이 자동 인수확정되었습니다",
            body: `주문 ${order.orderNumber}이 완료되고 판매 대금이 정산되었습니다.`,
            href: `/my/listings/orders/${order.id}`,
            metadata: { orderId: order.id, action: "AUTO_CONFIRM" },
          },
        ],
      });

      return true;
    });

    if (updated) {
      processed += 1;
    }
  }

  return processed;
}
