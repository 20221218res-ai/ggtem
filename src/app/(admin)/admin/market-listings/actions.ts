"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const ALLOWED_NEXT_STATUSES = new Set(["HIDDEN", "REMOVED", "PAUSED", "ACTIVE"]);

export async function moderateSellerListingAction(formData: FormData) {
  const admin = await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  const listingId = getText(formData, "listingId");
  const nextStatus = getText(formData, "nextStatus");
  const reason = getText(formData, "reason");

  if (!listingId || !ALLOWED_NEXT_STATUSES.has(nextStatus)) {
    redirectWithError("처리할 판매글과 상태를 확인해 주세요.");
  }

  if (!reason || reason.length < 4) {
    redirectWithError("조치 사유를 4자 이상 입력해 주세요.");
  }

  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        sellerId: true,
        premiumEndsAt: true,
        _count: { select: { orders: true } },
      },
    });

    if (!listing) {
      throw new Error("판매글을 찾을 수 없습니다.");
    }

    if (listing.status === nextStatus) {
      throw new Error("이미 같은 상태입니다.");
    }

    if (listing.status === "SOLD_OUT" && nextStatus === "ACTIVE") {
      throw new Error("판매완료 글은 다시 활성화할 수 없습니다.");
    }

    const updated = await tx.listing.update({
      where: { id: listing.id },
      data: { status: nextStatus as never },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        sellerId: true,
        premiumEndsAt: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.userId,
        action: `LISTING_${nextStatus}`,
        targetType: "LISTING",
        targetId: listing.id,
        reason,
        before: toJson({
          status: listing.status,
          title: listing.title,
          category: listing.category,
          sellerId: listing.sellerId,
          orderCount: listing._count.orders,
          premiumEndsAt: listing.premiumEndsAt?.toISOString() ?? null,
        }),
        after: toJson({
          status: updated.status,
          title: updated.title,
          category: updated.category,
          sellerId: updated.sellerId,
          premiumEndsAt: updated.premiumEndsAt?.toISOString() ?? null,
        }),
      },
    });
  });

  revalidatePath("/admin/market-listings");
  redirect("/admin/market-listings?notice=moderated");
}

export async function cancelBuyRequestByAdminAction(formData: FormData) {
  const admin = await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  const buyRequestId = getText(formData, "buyRequestId");
  const reason = getText(formData, "reason");

  if (!buyRequestId) {
    redirectWithError("처리할 구매글을 확인해 주세요.");
  }

  if (!reason || reason.length < 4) {
    redirectWithError("조치 사유를 4자 이상 입력해 주세요.");
  }

  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    const request = await tx.buyRequest.findUnique({
      where: { id: buyRequestId },
      include: {
        buyer: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error("구매글을 찾을 수 없습니다.");
    }

    if (request.status !== "ACTIVE") {
      throw new Error("모집 중인 구매글만 어드민 취소할 수 있습니다.");
    }

    if (!request.buyer.wallet) {
      throw new Error("구매자 지갑을 찾을 수 없습니다.");
    }

    const buyerWallet = request.buyer.wallet;
    const lockAmount = parseFixedAmount(request.lockAmount.toString());
    const buyerAvailable = parseFixedAmount(buyerWallet.availableBalance.toString());
    const buyerWithdrawable = parseFixedAmount(buyerWallet.withdrawableBalance.toString());
    const buyerBuyRequestLocked = parseFixedAmount(buyerWallet.buyRequestLocked.toString());

    if (buyerBuyRequestLocked < lockAmount) {
      throw new Error("구매글 예약금 상태가 지갑 잠금액과 일치하지 않습니다.");
    }

    const updated = await tx.buyRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELED",
        lockAmount: "0",
      },
      select: {
        id: true,
        status: true,
        buyerId: true,
        lockAmount: true,
      },
    });

    if (lockAmount > 0n) {
      await tx.wallet.update({
        where: { id: buyerWallet.id },
        data: {
          availableBalance: formatFixedAmount(buyerAvailable + lockAmount),
          withdrawableBalance: formatFixedAmount(buyerWithdrawable + lockAmount),
          buyRequestLocked: formatFixedAmount(buyerBuyRequestLocked - lockAmount),
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: buyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "DEBIT",
            bucket: "BUY_REQUEST_LOCKED",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: `어드민 구매글 취소: ${reason}`,
          },
          {
            walletId: buyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: `어드민 구매글 취소 환불: ${reason}`,
          },
          {
            walletId: buyerWallet.id,
            userId: request.buyerId,
            type: "BUY_REQUEST_RELEASED",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: formatFixedAmount(lockAmount),
            currency: request.currency,
            referenceType: "BUY_REQUEST",
            referenceId: request.id,
            memo: `어드민 구매글 취소 출금가능 환불: ${reason}`,
          },
        ],
      });
    }

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.userId,
        action: "BUY_REQUEST_ADMIN_CANCELED",
        targetType: "BUY_REQUEST",
        targetId: request.id,
        reason,
        before: toJson({
          status: request.status,
          buyerId: request.buyerId,
          category: request.category,
          lockAmount: request.lockAmount.toString(),
          wallet: {
            availableBalance: buyerWallet.availableBalance.toString(),
            withdrawableBalance: buyerWallet.withdrawableBalance.toString(),
            buyRequestLocked: buyerWallet.buyRequestLocked.toString(),
          },
        }),
        after: toJson({
          status: updated.status,
          buyerId: updated.buyerId,
          lockAmount: updated.lockAmount.toString(),
          releasedAmount: formatFixedAmount(lockAmount),
          wallet: {
            availableBalance: formatFixedAmount(buyerAvailable + lockAmount),
            withdrawableBalance: formatFixedAmount(buyerWithdrawable + lockAmount),
            buyRequestLocked: formatFixedAmount(buyerBuyRequestLocked - lockAmount),
          },
        }),
      },
    });
  });

  revalidatePath("/admin/market-listings");
  redirect("/admin/market-listings?notice=buy-request-canceled");
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function redirectWithError(message: string): never {
  redirect(`/admin/market-listings?error=${encodeURIComponent(message)}`);
}
