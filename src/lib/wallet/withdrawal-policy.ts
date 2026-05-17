import type { Prisma } from "@/generated/prisma/client";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

export const WITHDRAWAL_POLICY = {
  minimumAmount: "20",
  dailyRequestLimit: 2,
  cooldownHours: 4,
  recentTradeWindowHours: 24,
  weeklyTradeWindowDays: 7,
  weeklyTradeMinimum: "20",
  allowedChains: ["TRC20", "BEP20"] as const,
  blockedChains: ["ERC20"] as const,
  smallFeeMaximum: "100",
  smallFee: "1",
  largeFee: "0.5",
};

export type WithdrawalChainInput = (typeof WITHDRAWAL_POLICY.allowedChains)[number];

export type WithdrawalFeePreview = {
  requestedAmount: string;
  fee: string;
  netAmount: string;
  totalDebit: string;
};

export type WithdrawalEligibilityResult = {
  ok: boolean;
  blockedReasons: string[];
  riskFlags: string[];
  completedTradesLast24h: number;
  completedTradeAmountLast7d: string;
  dailyRequestCount: number;
  cooldownUntil: Date | null;
  sameIpUserCount: number;
  sameDeviceUserCount: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ACTIVE_WITHDRAWAL_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "SENT",
  "COMPLETED",
] as const;

export function normalizeWithdrawalChain(chain: string | null | undefined): WithdrawalChainInput {
  const normalized = chain?.trim().toUpperCase();

  if (normalized === "TRC20" || normalized === "BEP20") {
    return normalized;
  }

  if (normalized === "ERC20") {
    throw new Error("ERC20 출금은 지원하지 않습니다. TRC20 또는 BEP20만 선택해 주세요.");
  }

  throw new Error("출금 네트워크는 TRC20 또는 BEP20만 선택할 수 있습니다.");
}

export function validateWithdrawalDestination(
  chain: WithdrawalChainInput,
  destination: string | null | undefined,
) {
  const address = destination?.trim() ?? "";

  if (!address) {
    return "받을 지갑 주소를 입력해 주세요.";
  }

  if (chain === "TRC20" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return "TRC20 주소는 T로 시작하는 34자리 주소여야 합니다.";
  }

  if (chain === "BEP20" && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return "BEP20 주소는 0x로 시작하는 42자리 주소여야 합니다.";
  }

  return null;
}

export function getWithdrawalFeePreview(amountText: string): WithdrawalFeePreview {
  const amount = parseFixedAmount(amountText);
  const fee = calculateWithdrawalFee(amount);

  return {
    requestedAmount: formatFixedAmount(amount),
    fee: formatFixedAmount(fee),
    netAmount: formatFixedAmount(amount),
    totalDebit: formatFixedAmount(amount + fee),
  };
}

export function assertMinimumWithdrawalAmount(amount: bigint) {
  const minimum = parseFixedAmount(WITHDRAWAL_POLICY.minimumAmount);

  if (amount < minimum) {
    throw new Error(`최소 출금 금액은 ${WITHDRAWAL_POLICY.minimumAmount} USDT입니다.`);
  }
}

export function calculateWithdrawalFee(amount: bigint) {
  assertMinimumWithdrawalAmount(amount);

  if (amount <= parseFixedAmount(WITHDRAWAL_POLICY.smallFeeMaximum)) {
    return parseFixedAmount(WITHDRAWAL_POLICY.smallFee);
  }

  return parseFixedAmount(WITHDRAWAL_POLICY.largeFee);
}

export async function evaluateWithdrawalEligibility(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    requestIpKey?: string | null;
    deviceKey?: string | null;
    now?: Date;
  },
): Promise<WithdrawalEligibilityResult> {
  const now = input.now ?? new Date();
  const last24h = new Date(now.getTime() - WITHDRAWAL_POLICY.recentTradeWindowHours * HOUR);
  const last7d = new Date(now.getTime() - WITHDRAWAL_POLICY.weeklyTradeWindowDays * DAY);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    completedTradesLast24h,
    completedTradesLast7d,
    disputedOrders,
    todaysWithdrawals,
    latestWithdrawal,
    sameIpWithdrawals,
    sameDeviceWithdrawals,
  ] = await Promise.all([
    tx.order.count({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: last24h,
        },
        OR: [{ buyerId: input.userId }, { sellerId: input.userId }],
      },
    }),
    tx.order.findMany({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: last7d,
        },
        OR: [{ buyerId: input.userId }, { sellerId: input.userId }],
      },
      select: {
        grossAmount: true,
      },
      take: 200,
    }),
    tx.order.count({
      where: {
        status: "DISPUTED",
        OR: [{ buyerId: input.userId }, { sellerId: input.userId }],
      },
    }),
    tx.withdrawalRequest.count({
      where: {
        userId: input.userId,
        requestedAt: {
          gte: todayStart,
        },
        status: {
          in: [...ACTIVE_WITHDRAWAL_STATUSES],
        },
      },
    }),
    tx.withdrawalRequest.findFirst({
      where: {
        userId: input.userId,
        status: {
          in: [...ACTIVE_WITHDRAWAL_STATUSES],
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
      select: {
        requestedAt: true,
      },
    }),
    input.requestIpKey
      ? tx.withdrawalRequest.findMany({
          where: {
            requestIpKey: input.requestIpKey,
            requestedAt: {
              gte: last24h,
            },
            status: {
              in: [...ACTIVE_WITHDRAWAL_STATUSES],
            },
          },
          select: {
            userId: true,
          },
          take: 50,
        })
      : Promise.resolve([]),
    input.deviceKey
      ? tx.withdrawalRequest.findMany({
          where: {
            deviceKey: input.deviceKey,
            requestedAt: {
              gte: last24h,
            },
            status: {
              in: [...ACTIVE_WITHDRAWAL_STATUSES],
            },
          },
          select: {
            userId: true,
          },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const completedTradeAmountLast7d = completedTradesLast7d.reduce(
    (sum, order) => sum + parseFixedAmount(order.grossAmount.toString()),
    0n,
  );
  const weeklyMinimum = parseFixedAmount(WITHDRAWAL_POLICY.weeklyTradeMinimum);
  const hasRecentTrade =
    completedTradesLast24h > 0 || completedTradeAmountLast7d >= weeklyMinimum;
  const blockedReasons: string[] = [];
  const riskFlags: string[] = [];
  const cooldownUntil = latestWithdrawal
    ? new Date(latestWithdrawal.requestedAt.getTime() + WITHDRAWAL_POLICY.cooldownHours * HOUR)
    : null;
  const sameIpUserCount = new Set(sameIpWithdrawals.map((item) => item.userId)).size;
  const sameDeviceUserCount = new Set(sameDeviceWithdrawals.map((item) => item.userId)).size;

  if (!hasRecentTrade) {
    blockedReasons.push(
      "최근 24시간 내 완료 거래 1건 이상 또는 최근 7일 내 누적 완료 거래 20 USDT 이상 조건을 만족해야 합니다.",
    );
  }

  if (todaysWithdrawals >= WITHDRAWAL_POLICY.dailyRequestLimit) {
    blockedReasons.push(
      `하루 출금 요청은 최대 ${WITHDRAWAL_POLICY.dailyRequestLimit}회까지만 가능합니다.`,
    );
  }

  if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
    blockedReasons.push(
      `최근 출금 요청 후 ${WITHDRAWAL_POLICY.cooldownHours}시간이 지나야 다시 요청할 수 있습니다.`,
    );
  }

  if (disputedOrders > 0) {
    blockedReasons.push("분쟁 중인 거래가 있어 출금할 수 없습니다.");
  }

  if (sameIpUserCount >= 3) {
    blockedReasons.push("동일 IP에서 여러 계정의 출금 요청이 감지되어 출금이 제한됩니다.");
    riskFlags.push("SAME_IP_MULTI_ACCOUNT_WITHDRAWAL");
  } else if (sameIpUserCount >= 2) {
    riskFlags.push("SAME_IP_WITHDRAWAL_REVIEW");
  }

  if (sameDeviceUserCount >= 3) {
    blockedReasons.push("동일 디바이스에서 여러 계정의 출금 요청이 감지되어 출금이 제한됩니다.");
    riskFlags.push("SAME_DEVICE_MULTI_ACCOUNT_WITHDRAWAL");
  } else if (sameDeviceUserCount >= 2) {
    riskFlags.push("SAME_DEVICE_WITHDRAWAL_REVIEW");
  }

  if (latestWithdrawal && now.getTime() - latestWithdrawal.requestedAt.getTime() < HOUR) {
    riskFlags.push("SHORT_INTERVAL_WITHDRAWAL_ATTEMPT");
  }

  return {
    ok: blockedReasons.length === 0,
    blockedReasons,
    riskFlags,
    completedTradesLast24h,
    completedTradeAmountLast7d: formatFixedAmount(completedTradeAmountLast7d),
    dailyRequestCount: todaysWithdrawals,
    cooldownUntil,
    sameIpUserCount,
    sameDeviceUserCount,
  };
}
