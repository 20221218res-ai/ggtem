import type { LedgerDirection, WalletBucket } from "@/generated/prisma/client";
import { getCurrentUserEmailForRole } from "@/lib/auth/session";
import { ensureUserWallet } from "@/lib/market/wallets";
import { sendAdminTelegramAlert } from "@/lib/notifications/telegram";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import {
  calculateWithdrawalFee,
  evaluateWithdrawalEligibility,
  normalizeWithdrawalChain,
  validateWithdrawalDestination,
  WITHDRAWAL_POLICY,
} from "@/lib/wallet/withdrawal-policy";

const MARKET_USER_EMAIL = "user-demo@ggitem.local";
const MARKET_WALLET_ROLES = ["CUSTOMER", "SELLER"];

export type MarketplaceWalletView = {
  buyerName: string;
  wallet: {
    availableBalance: string;
    escrowBalance: string;
    buyRequestLocked: string;
    withdrawableBalance: string;
    withdrawalLockedBalance: string;
    currency: string;
  } | null;
  depositRequests: Array<{
    requestId: string;
    amount: string;
    currency: string;
    status: string;
    provider: string;
    requestedAt: string;
    requestedAtValue: string;
    processedAt: string | null;
    processedAtValue: string | null;
    memo: string | null;
  }>;
  withdrawalRequests: Array<{
    requestId: string;
    amount: string;
    fee: string;
    netAmount: string;
    totalDebit: string;
    chain: string | null;
    currency: string;
    status: string;
    destination: string;
    requestedAt: string;
    requestedAtValue: string;
    processedAt: string | null;
    processedAtValue: string | null;
    memo: string | null;
  }>;
};

export type MarketplaceWalletActionResult = {
  requestId: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  status: string;
  message: string;
};

export type MarketplaceDepositRequestDetail = {
  requestId: string;
  buyerName: string;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  memo: string | null;
  requestedAt: string;
  confirmedAt: string | null;
};

export type MarketplaceWithdrawalRequestDetail = {
  requestId: string;
  buyerName: string;
  amount: string;
  fee: string;
  netAmount: string;
  totalDebit: string;
  chain: string | null;
  currency: string;
  status: string;
  provider: string;
  destination: string;
  memo: string | null;
  requestedAt: string;
  completedAt: string | null;
  processedAt: string | null;
  failureReason: string | null;
  logs: Array<{
    action: string;
    statusFrom: string | null;
    statusTo: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

export type MarketplaceWalletLedgerView = {
  buyerName: string;
  wallet: MarketplaceWalletView["wallet"];
  filters: {
    direction: string;
    bucket: string;
    query: string;
  };
  summary: {
    totalEntries: number;
    shownEntries: number;
    creditAmount: string;
    debitAmount: string;
  };
  entries: Array<{
    entryId: string;
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    currency: string;
    referenceType: string | null;
    referenceId: string | null;
    referenceHref: string | null;
    memo: string | null;
    createdAt: string;
    createdAtValue: string;
  }>;
};

export async function getMarketplaceWalletView(): Promise<MarketplaceWalletView> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
      displayName: true,
      wallet: {
        select: {
          availableBalance: true,
          escrowLockedBalance: true,
          buyRequestLocked: true,
          withdrawableBalance: true,
          withdrawalLocked: true,
          currency: true,
        },
      },
      depositRequests: {
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          requestedAt: true,
          confirmedAt: true,
          memo: true,
        },
        orderBy: {
          requestedAt: "desc",
        },
        take: 10,
      },
      withdrawalRequests: {
        select: {
          id: true,
          amount: true,
          fee: true,
          netAmount: true,
          chain: true,
          currency: true,
          status: true,
          destination: true,
          requestedAt: true,
          completedAt: true,
          memo: true,
        },
        orderBy: {
          requestedAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!buyer) {
    return {
      buyerName: "Demo Buyer",
      wallet: null,
      depositRequests: [],
      withdrawalRequests: [],
    };
  }

  const wallet = buyer.wallet ?? (await ensureUserWallet(buyer.id));

  return {
    buyerName: buyer.displayName,
    wallet: wallet
      ? {
          availableBalance: wallet.availableBalance.toString(),
          escrowBalance: wallet.escrowLockedBalance.toString(),
          buyRequestLocked: wallet.buyRequestLocked.toString(),
          withdrawableBalance: wallet.withdrawableBalance.toString(),
          withdrawalLockedBalance: wallet.withdrawalLocked.toString(),
          currency: wallet.currency,
        }
      : null,
    depositRequests: buyer.depositRequests.map((request) => ({
      requestId: request.id,
      amount: request.amount.toString(),
      currency: request.currency,
      status: request.status,
      provider: request.provider,
      requestedAt: formatKoreanDate(request.requestedAt),
      requestedAtValue: request.requestedAt.toISOString(),
      processedAt: request.confirmedAt ? formatKoreanDate(request.confirmedAt) : null,
      processedAtValue: request.confirmedAt ? request.confirmedAt.toISOString() : null,
      memo: request.memo,
    })),
    withdrawalRequests: buyer.withdrawalRequests.map((request) => ({
      requestId: request.id,
      amount: request.amount.toString(),
      fee: request.fee.toString(),
      netAmount: request.netAmount.toString(),
      totalDebit: formatFixedAmount(
        parseFixedAmount(request.amount.toString()) +
          parseFixedAmount(request.fee.toString()),
      ),
      chain: request.chain,
      currency: request.currency,
      status: request.status,
      destination: request.destination,
      requestedAt: formatKoreanDate(request.requestedAt),
      requestedAtValue: request.requestedAt.toISOString(),
      processedAt: request.completedAt ? formatKoreanDate(request.completedAt) : null,
      processedAtValue: request.completedAt
        ? request.completedAt.toISOString()
        : null,
      memo: getPublicWithdrawalMemo(request.memo, request.status),
    })),
  };
}

export async function getMarketplaceWalletLedgerView(filters?: {
  direction?: string | null;
  bucket?: string | null;
  query?: string | null;
}): Promise<MarketplaceWalletLedgerView> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
      displayName: true,
      wallet: {
        select: {
          availableBalance: true,
          escrowLockedBalance: true,
          buyRequestLocked: true,
          withdrawableBalance: true,
          withdrawalLocked: true,
          currency: true,
        },
      },
    },
  });

  if (!buyer?.wallet) {
    return {
      buyerName: "Demo Buyer",
      wallet: null,
      filters: {
        direction: "",
        bucket: "",
        query: filters?.query?.trim() ?? "",
      },
      summary: {
        totalEntries: 0,
        shownEntries: 0,
        creditAmount: "0",
        debitAmount: "0",
      },
      entries: [],
    };
  }

  const direction = normalizeLedgerDirection(filters?.direction);
  const bucket = normalizeLedgerBucket(filters?.bucket);
  const query = filters?.query?.trim() ?? "";
  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: {
      userId: buyer.id,
      ...(direction ? { direction } : {}),
      ...(bucket ? { bucket } : {}),
    },
    select: {
      id: true,
      type: true,
      direction: true,
      bucket: true,
      amount: true,
      currency: true,
      referenceType: true,
      referenceId: true,
      memo: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });
  const filteredEntries = ledgerEntries.filter((entry) => {
    if (!query) {
      return true;
    }

    const searchTarget = [
      entry.id,
      entry.type,
      entry.direction,
      entry.bucket,
      entry.amount.toString(),
      entry.currency,
      entry.referenceType,
      entry.referenceId,
      entry.memo,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchTarget.includes(query.toLowerCase());
  });
  const creditAmount = filteredEntries
    .filter((entry) => entry.direction === "CREDIT")
    .reduce((sum, entry) => sum + parseFixedAmount(entry.amount.toString()), 0n);
  const debitAmount = filteredEntries
    .filter((entry) => entry.direction === "DEBIT")
    .reduce((sum, entry) => sum + parseFixedAmount(entry.amount.toString()), 0n);

  return {
    buyerName: buyer.displayName,
    wallet: {
      availableBalance: buyer.wallet.availableBalance.toString(),
      escrowBalance: buyer.wallet.escrowLockedBalance.toString(),
      buyRequestLocked: buyer.wallet.buyRequestLocked.toString(),
      withdrawableBalance: buyer.wallet.withdrawableBalance.toString(),
      withdrawalLockedBalance: buyer.wallet.withdrawalLocked.toString(),
      currency: buyer.wallet.currency,
    },
    filters: {
      direction,
      bucket,
      query,
    },
    summary: {
      totalEntries: ledgerEntries.length,
      shownEntries: filteredEntries.length,
      creditAmount: formatFixedAmount(creditAmount),
      debitAmount: formatFixedAmount(debitAmount),
    },
    entries: filteredEntries.slice(0, 100).map((entry) => ({
      entryId: entry.id,
      type: entry.type,
      direction: entry.direction,
      bucket: entry.bucket,
      amount: entry.amount.toString(),
      currency: entry.currency,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceHref: buildLedgerReferenceHref(entry.referenceType, entry.referenceId),
      memo: entry.memo,
      createdAt: formatKoreanDate(entry.createdAt),
      createdAtValue: entry.createdAt.toISOString(),
    })),
  };
}

export async function createMarketplaceWalletRequest(input: {
  kind: "DEPOSIT" | "WITHDRAWAL";
  amount: string;
  memo?: string;
  destination?: string;
  provider?: string;
  chain?: string;
  requestIpKey?: string | null;
  deviceKey?: string | null;
}): Promise<MarketplaceWalletActionResult> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
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
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  const wallet = buyer.wallet ?? (await ensureUserWallet(buyer.id));

  if (!wallet) {
    throw new Error("지갑이 아직 준비되지 않았습니다.");
  }

  const amount = parseFixedAmount(input.amount);

  if (amount <= 0n) {
    throw new Error("금액은 0보다 커야 합니다.");
  }

  const result: MarketplaceWalletActionResult = await prisma.$transaction(async (tx) => {
    if (input.kind === "DEPOSIT") {
      const request = await tx.depositRequest.create({
        data: {
          userId: buyer.id,
          walletId: wallet.id,
          provider: input.provider?.trim() || "MANUAL_CRYPTO",
          currency: wallet.currency,
          amount: formatFixedAmount(amount),
          status: "PENDING",
          memo: input.memo?.trim() || "사용자가 충전 요청을 등록했습니다.",
        },
      });

      await tx.notification.create({
        data: {
          userId: buyer.id,
          type: "WALLET_UPDATE",
          title: "충전 요청이 접수되었습니다.",
          body: `${formatFixedAmount(amount)} ${wallet.currency} 충전 요청이 접수되었습니다. TXID와 입금 내역을 관리자가 확인한 뒤 잔액에 반영됩니다.`,
          href: `/my/wallet/deposits/${request.id}`,
          metadata: {
            requestId: request.id,
            kind: "DEPOSIT",
            status: request.status,
          },
        },
      });

      return {
        requestId: request.id,
        kind: "DEPOSIT",
        status: request.status,
        message: "충전 요청이 접수되었습니다.",
      };
    }

    const freshWallet = await tx.wallet.findUnique({
      where: {
        id: wallet.id,
      },
    });

    if (!freshWallet || freshWallet.userId !== buyer.id) {
      throw new Error("지갑이 아직 준비되지 않았습니다.");
    }

    const chain = normalizeWithdrawalChain(input.chain);
    const fee = calculateWithdrawalFee(amount);
    const totalDebit = amount + fee;
    const currentWithdrawable = parseFixedAmount(
      freshWallet.withdrawableBalance.toString(),
    );
    const currentAvailable = parseFixedAmount(
      freshWallet.availableBalance.toString(),
    );
    const currentWithdrawalLocked = parseFixedAmount(
      freshWallet.withdrawalLocked.toString(),
    );

    if (currentWithdrawable < totalDebit) {
      throw new Error("출금 가능한 잔액이 부족합니다.");
    }

    if (currentAvailable < totalDebit) {
      throw new Error("보유 잔액이 부족합니다.");
    }

    const destination = input.destination?.trim() ?? "";
    const destinationError = validateWithdrawalDestination(chain, destination);
    if (destinationError) {
      throw new Error(destinationError);
    }

    if (buyer.status === "WITHDRAWAL_HOLD") {
      throw new Error("현재 계정은 출금 보류 상태입니다. 고객센터에 문의해 주세요.");
    }

    const eligibility = await evaluateWithdrawalEligibility(tx, {
      userId: buyer.id,
      requestIpKey: input.requestIpKey,
      deviceKey: input.deviceKey,
    });

    if (!eligibility.ok) {
      throw new Error(eligibility.blockedReasons.join(" "));
    }

    await tx.wallet.update({
      where: {
        id: freshWallet.id,
      },
      data: {
        availableBalance: formatFixedAmount(currentAvailable - totalDebit),
        withdrawableBalance: formatFixedAmount(currentWithdrawable - totalDebit),
        withdrawalLocked: formatFixedAmount(currentWithdrawalLocked + totalDebit),
      },
    });

    const request = await tx.withdrawalRequest.create({
      data: {
        userId: buyer.id,
        walletId: freshWallet.id,
        provider: "MANUAL_CRYPTO",
        currency: freshWallet.currency,
        amount: formatFixedAmount(amount),
        fee: formatFixedAmount(fee),
        netAmount: formatFixedAmount(amount),
        chain,
        status: "REQUESTED",
        destination,
        riskFlags: {
          flags: eligibility.riskFlags,
          completedTradesLast24h: eligibility.completedTradesLast24h,
          completedTradeAmountLast7d: eligibility.completedTradeAmountLast7d,
          dailyRequestCountBeforeRequest: eligibility.dailyRequestCount,
          sameIpUserCount: eligibility.sameIpUserCount,
          sameDeviceUserCount: eligibility.sameDeviceUserCount,
          policy: WITHDRAWAL_POLICY,
        },
        requestIpKey: input.requestIpKey ?? null,
        deviceKey: input.deviceKey ?? null,
        memo: input.memo?.trim() || "사용자가 출금 요청을 등록했습니다.",
      },
    });

    await tx.withdrawalLog.create({
      data: {
        withdrawalRequestId: request.id,
        userId: buyer.id,
        action: "WITHDRAWAL_REQUESTED",
        statusTo: "REQUESTED",
        message: "출금 요청이 대기열에 등록되었습니다.",
        metadata: {
          chain,
          amount: formatFixedAmount(amount),
          fee: formatFixedAmount(fee),
          netAmount: formatFixedAmount(amount),
          totalDebit: formatFixedAmount(totalDebit),
          riskFlags: eligibility.riskFlags,
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: buyer.id,
        type: "WALLET_UPDATE",
        title: "출금 요청이 접수되었습니다.",
        body: `${formatFixedAmount(amount)} ${freshWallet.currency} 출금 요청이 접수되었습니다. 관리자 확인 후 완료까지 최대 30분이 소요될 수 있습니다.`,
        href: `/my/wallet/withdrawals/${request.id}`,
        metadata: {
          requestId: request.id,
          kind: "WITHDRAWAL",
          status: request.status,
          chain,
          fee: formatFixedAmount(fee),
          totalDebit: formatFixedAmount(totalDebit),
        },
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: freshWallet.id,
          userId: buyer.id,
          type: "WITHDRAWAL_REQUESTED",
          direction: "DEBIT",
          bucket: "AVAILABLE",
          amount: formatFixedAmount(totalDebit),
          currency: freshWallet.currency,
          referenceType: "WITHDRAWAL_REQUEST",
          referenceId: request.id,
          memo:
            input.memo?.trim() ||
            "출금 요청 금액이 보유 잔액에서 차감되었습니다.",
        },
        {
          walletId: freshWallet.id,
          userId: buyer.id,
          type: "WITHDRAWAL_REQUESTED",
          direction: "DEBIT",
          bucket: "WITHDRAWABLE",
          amount: formatFixedAmount(totalDebit),
          currency: freshWallet.currency,
          referenceType: "WITHDRAWAL_REQUEST",
          referenceId: request.id,
          memo:
            input.memo?.trim() ||
            "출금 요청 금액이 출금 가능 잔액에서 차감되었습니다.",
        },
        {
          walletId: freshWallet.id,
          userId: buyer.id,
          type: "WITHDRAWAL_REQUESTED",
          direction: "CREDIT",
          bucket: "WITHDRAWAL_LOCKED",
          amount: formatFixedAmount(totalDebit),
          currency: freshWallet.currency,
          referenceType: "WITHDRAWAL_REQUEST",
          referenceId: request.id,
          memo: input.memo?.trim() || "출금 처리 중인 금액으로 잠겼습니다.",
        },
      ],
    });

    return {
      requestId: request.id,
      kind: "WITHDRAWAL",
      status: request.status,
      message: "출금 요청이 접수되었습니다.",
    };
  });

  await sendAdminTelegramAlert({
    title: result.kind === "DEPOSIT" ? "충전 요청 접수" : "출금 요청 접수",
    lines: [
      `상태: ${result.status}`,
      `요청 ID: ${result.requestId}`,
      `회원: ${buyer.displayName} / ${buyer.email}`,
      `금액: ${formatFixedAmount(amount)} ${wallet.currency}`,
      input.kind === "WITHDRAWAL" && input.chain ? `체인: ${input.chain}` : null,
    ],
  });

  return result;
}

export async function cancelMarketplaceWalletRequest(input: {
  kind: "DEPOSIT" | "WITHDRAWAL";
  requestId: string;
}): Promise<MarketplaceWalletActionResult> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
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
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    if (input.kind === "DEPOSIT") {
      const request = await tx.depositRequest.findFirst({
        where: {
          id: input.requestId,
          userId: buyer.id,
        },
      });

      if (!request) {
        throw new Error("충전 요청을 찾을 수 없습니다.");
      }

      if (request.status !== "PENDING") {
        throw new Error("확인 대기 중인 충전 요청만 취소할 수 있습니다.");
      }

      const updated = await tx.depositRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: "CANCELED",
        },
      });

      await tx.notification.create({
        data: {
          userId: buyer.id,
          type: "WALLET_UPDATE",
          title: "충전 요청이 취소되었습니다.",
          body: `${request.amount.toString()} ${request.currency} 충전 요청이 취소되었습니다.`,
          href: `/my/wallet/deposits/${request.id}`,
          metadata: {
            requestId: request.id,
            kind: "DEPOSIT",
            status: "CANCELED",
          },
        },
      });

      return {
        requestId: updated.id,
        kind: "DEPOSIT",
        status: updated.status,
        message: "충전 요청이 취소되었습니다.",
      };
    }

    const request = await tx.withdrawalRequest.findFirst({
      where: {
        id: input.requestId,
        userId: buyer.id,
      },
    });

    if (!request) {
      throw new Error("출금 요청을 찾을 수 없습니다.");
    }

    if (request.status !== "REQUESTED") {
      throw new Error("처리 대기 중인 출금 요청만 취소할 수 있습니다.");
    }

    const wallet = await tx.wallet.findUnique({
      where: {
        id: request.walletId,
      },
    });

    if (!wallet || wallet.userId !== buyer.id) {
      throw new Error("출금 지갑이 아직 준비되지 않았습니다.");
    }

    const amount = parseFixedAmount(request.amount.toString());
    const fee = parseFixedAmount(request.fee.toString());
    const totalDebit = amount + fee;
    const currentWithdrawable = parseFixedAmount(
      wallet.withdrawableBalance.toString(),
    );
    const currentAvailable = parseFixedAmount(wallet.availableBalance.toString());
    const currentWithdrawalLocked = parseFixedAmount(
      wallet.withdrawalLocked.toString(),
    );

    if (totalDebit > 0n && currentWithdrawalLocked >= totalDebit) {
      await tx.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          availableBalance: formatFixedAmount(currentAvailable + totalDebit),
          withdrawableBalance: formatFixedAmount(currentWithdrawable + totalDebit),
          withdrawalLocked: formatFixedAmount(currentWithdrawalLocked - totalDebit),
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: wallet.id,
            userId: buyer.id,
            type: "WITHDRAWAL_REJECTED",
            direction: "DEBIT",
            bucket: "WITHDRAWAL_LOCKED",
            amount: formatFixedAmount(totalDebit),
            currency: request.currency,
            referenceType: "WITHDRAWAL_REQUEST",
            referenceId: request.id,
            memo: request.memo ?? "출금 요청 취소로 잠긴 금액이 해제되었습니다.",
          },
          {
            walletId: wallet.id,
            userId: buyer.id,
            type: "WITHDRAWAL_REJECTED",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: formatFixedAmount(totalDebit),
            currency: request.currency,
            referenceType: "WITHDRAWAL_REQUEST",
            referenceId: request.id,
            memo:
              request.memo ??
              "출금 요청 취소로 금액이 보유 잔액에 반환되었습니다.",
          },
          {
            walletId: wallet.id,
            userId: buyer.id,
            type: "WITHDRAWAL_REJECTED",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: formatFixedAmount(totalDebit),
            currency: request.currency,
            referenceType: "WITHDRAWAL_REQUEST",
            referenceId: request.id,
            memo:
              request.memo ??
              "출금 요청 취소로 금액이 출금 가능 잔액에 반환되었습니다.",
          },
        ],
      });
    }

    const updated = await tx.withdrawalRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "CANCELED",
        processedAt: new Date(),
      },
    });

    await tx.withdrawalLog.create({
      data: {
        withdrawalRequestId: request.id,
        userId: buyer.id,
        action: "WITHDRAWAL_CANCELED",
        statusFrom: request.status,
        statusTo: "CANCELED",
        message: "사용자가 출금 요청을 취소했고 잠긴 금액이 반환되었습니다.",
        metadata: {
          amount: request.amount.toString(),
          fee: request.fee.toString(),
          totalDebit: formatFixedAmount(totalDebit),
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: buyer.id,
        type: "WALLET_UPDATE",
        title: "출금 요청이 취소되었습니다.",
        body: `${request.amount.toString()} ${request.currency} 출금 요청이 취소되어 잠긴 금액이 반환되었습니다.`,
        href: `/my/wallet/withdrawals/${request.id}`,
        metadata: {
          requestId: request.id,
          kind: "WITHDRAWAL",
          status: "CANCELED",
        },
      },
    });

    return {
      requestId: updated.id,
      kind: "WITHDRAWAL",
      status: updated.status,
      message: "출금 요청이 취소되었습니다.",
    };
  });
}

export async function getMarketplaceDepositRequestDetail(
  requestId: string,
): Promise<MarketplaceDepositRequestDetail | null> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!buyer) {
    return null;
  }

  const request = await prisma.depositRequest.findFirst({
    where: {
      id: requestId,
      userId: buyer.id,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      provider: true,
      memo: true,
      requestedAt: true,
      confirmedAt: true,
    },
  });

  if (!request) {
    return null;
  }

  return {
    requestId: request.id,
    buyerName: buyer.displayName,
    amount: request.amount.toString(),
    currency: request.currency,
    status: request.status,
    provider: request.provider,
    memo: request.memo,
    requestedAt: formatKoreanDate(request.requestedAt),
    confirmedAt: request.confirmedAt ? formatKoreanDate(request.confirmedAt) : null,
  };
}

export async function getMarketplaceWithdrawalRequestDetail(
  requestId: string,
): Promise<MarketplaceWithdrawalRequestDetail | null> {
  const prisma = getPrismaClient();
  const buyerEmail = await getCurrentUserEmailForRole({
    allowedRoles: MARKET_WALLET_ROLES,
    fallbackEmail: MARKET_USER_EMAIL,
  });
  const buyer = await prisma.user.findUnique({
    where: {
      email: buyerEmail,
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!buyer) {
    return null;
  }

  const request = await prisma.withdrawalRequest.findFirst({
    where: {
      id: requestId,
      userId: buyer.id,
    },
    select: {
      id: true,
      amount: true,
      fee: true,
      netAmount: true,
      chain: true,
      currency: true,
      status: true,
      provider: true,
      destination: true,
      memo: true,
      requestedAt: true,
      completedAt: true,
      processedAt: true,
      failureReason: true,
      logs: {
        select: {
          action: true,
          statusFrom: true,
          statusTo: true,
          message: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 20,
      },
    },
  });

  if (!request) {
    return null;
  }

  return {
    requestId: request.id,
    buyerName: buyer.displayName,
    amount: request.amount.toString(),
    fee: request.fee.toString(),
    netAmount: request.netAmount.toString(),
    totalDebit: formatFixedAmount(
      parseFixedAmount(request.amount.toString()) +
        parseFixedAmount(request.fee.toString()),
    ),
    chain: request.chain,
    currency: request.currency,
    status: request.status,
    provider: request.provider,
    destination: request.destination,
    memo: getPublicWithdrawalMemo(request.memo, request.status),
    requestedAt: formatKoreanDate(request.requestedAt),
    completedAt: request.completedAt ? formatKoreanDate(request.completedAt) : null,
    processedAt: request.processedAt ? formatKoreanDate(request.processedAt) : null,
    failureReason: request.failureReason,
    logs: request.logs.map((log) => ({
      action: log.action,
      statusFrom: log.statusFrom,
      statusTo: log.statusTo,
      message: log.message,
      createdAt: formatKoreanDate(log.createdAt),
    })),
  };
}

function getPublicWithdrawalMemo(memo: string | null, status: string) {
  if (!memo) {
    return null;
  }

  const [publicMemo] = memo.split("[Admin withdrawal completion]");
  const normalizedPublicMemo = publicMemo.trim();

  if (normalizedPublicMemo) {
    return normalizedPublicMemo;
  }

  if (status === "COMPLETED") {
    return "관리자가 출금 처리를 완료했습니다.";
  }

  return null;
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function normalizeLedgerDirection(
  direction: string | null | undefined,
): LedgerDirection | "" {
  if (direction === "credit") {
    return "CREDIT" as const;
  }

  if (direction === "debit") {
    return "DEBIT" as const;
  }

  return "";
}

function normalizeLedgerBucket(
  bucket: string | null | undefined,
): WalletBucket | "" {
  const normalized = bucket?.trim().toUpperCase() ?? "";
  const allowedBuckets = [
    "AVAILABLE",
    "ESCROW_LOCKED",
    "BUY_REQUEST_LOCKED",
    "PENDING_SETTLEMENT",
    "WITHDRAWABLE",
    "WITHDRAWAL_LOCKED",
    "PLATFORM_REVENUE",
  ];

  return allowedBuckets.includes(normalized)
    ? (normalized as WalletBucket)
    : "";
}

function buildLedgerReferenceHref(
  referenceType: string | null,
  referenceId: string | null,
) {
  if (!referenceType || !referenceId) {
    return null;
  }

  if (referenceType === "DEPOSIT_REQUEST") {
    return `/my/wallet/deposits/${referenceId}`;
  }

  if (referenceType === "WITHDRAWAL_REQUEST") {
    return `/my/wallet/withdrawals/${referenceId}`;
  }

  if (referenceType === "ORDER") {
    return `/my/orders/${referenceId}`;
  }

  return null;
}
