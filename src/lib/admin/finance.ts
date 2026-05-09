import type {
  LedgerDirection,
  Prisma,
  WalletBucket,
} from "@/generated/prisma/client";
import { createUserNotification } from "@/lib/notifications/notifications";
import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

export type AdminFinanceState = {
  summary: {
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingDepositAmount: string;
    pendingWithdrawalAmount: string;
  };
  pendingDeposits: Array<{
    requestId: string;
    userName: string;
    userEmail: string;
    amount: string;
    currency: string;
    provider: string;
    status: string;
    riskFlags: string[];
    requestedAt: string;
    memo: string | null;
    evidence: CryptoDepositEvidence;
  }>;
  pendingWithdrawals: Array<{
    requestId: string;
    userName: string;
    userEmail: string;
    amount: string;
    fee: string;
    netAmount: string;
    totalDebit: string;
    chain: string | null;
    currency: string;
    provider: string;
    destination: string;
    status: string;
    riskFlags: string[];
    lastLog: string | null;
    requestedAt: string;
    memo: string | null;
  }>;
  recentProcessed: Array<{
    requestId: string;
    kind: "DEPOSIT" | "WITHDRAWAL";
    userId: string;
    userName: string;
    userEmail: string;
    amount: string;
    currency: string;
    provider: string;
    status: string;
    processedAt: string;
    processedAtValue: string;
    memo: string | null;
    destination: string | null;
  }>;
};

export type AdminFinanceActionResult = {
  requestId: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  status: string;
  message: string;
};

export type AdminFinanceLedgerState = {
  filters: {
    direction: LedgerDirection | "";
    bucket: WalletBucket | "";
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
    userId: string;
    userName: string;
    userEmail: string;
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    currency: string;
    referenceType: string | null;
    referenceId: string | null;
    referenceHref: string | null;
    orderTrace: {
      orderId: string;
      orderNumber: string;
      status: string;
      listingTitle: string;
      buyerName: string;
      sellerName: string;
      grossAmount: string;
      platformFeeAmount: string;
      sellerReceivableAmount: string;
      currency: string;
    } | null;
    memo: string | null;
    createdAt: string;
    createdAtValue: string;
  }>;
};

export type AdminFinanceLedgerExportRow = {
  entryId: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  direction: string;
  bucket: string;
  amount: string;
  currency: string;
  referenceType: string;
  referenceId: string;
  memo: string;
  createdAt: string;
};

export type AdminFinanceReconciliationState = {
  filters: {
    range: "today" | "7d" | "30d";
  };
  summary: {
    entryCount: number;
    creditAmount: string;
    debitAmount: string;
    netAmount: string;
    uniqueUsers: number;
    from: string;
    fromAtValue: string;
    to: string;
    toAtValue: string;
  };
  bucketBreakdown: Array<{
    bucket: string;
    creditAmount: string;
    debitAmount: string;
    netAmount: string;
    count: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    creditAmount: string;
    debitAmount: string;
    netAmount: string;
    count: number;
  }>;
  recentEntries: AdminFinanceLedgerState["entries"];
  closeChecklist: Array<{
    key: string;
    label: string;
    status: "READY" | "CHECK" | "BLOCKED";
    detail: string;
    href: string;
  }>;
  anomalyFlags: Array<{
    key: string;
    severity: "INFO" | "WARN" | "CRITICAL";
    label: string;
    detail: string;
    href: string;
  }>;
  closeReports: Array<{
    reportId: string;
    range: string;
    entryCount: number;
    uniqueUsers: number;
    creditAmount: string;
    debitAmount: string;
    netAmount: string;
    note: string | null;
    closedById: string;
    closedAt: string;
  }>;
};

export type AdminFinanceReconciliationExportRow = {
  section: string;
  label: string;
  creditAmount: string;
  debitAmount: string;
  netAmount: string;
  count: string;
  userName: string;
  userEmail: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type AdminFinanceCloseReportResult = {
  reportId: string;
  message: string;
};

export async function getAdminFinanceState(): Promise<AdminFinanceState> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const [pendingDeposits, pendingWithdrawals, recentDeposits, recentWithdrawals] =
      await Promise.all([
        tx.depositRequest.findMany({
          where: {
            status: "PENDING",
          },
          include: {
            user: true,
          },
          orderBy: {
            requestedAt: "asc",
          },
          take: 10,
        }),
        tx.withdrawalRequest.findMany({
          where: {
            status: {
              in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"],
            },
          },
          include: {
            user: true,
            logs: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
          orderBy: {
            requestedAt: "asc",
          },
          take: 10,
        }),
        tx.depositRequest.findMany({
          where: {
            status: {
              in: ["CONFIRMED", "REJECTED"],
            },
          },
          include: {
            user: true,
          },
          orderBy: {
            requestedAt: "desc",
          },
          take: 10,
        }),
        tx.withdrawalRequest.findMany({
          where: {
            status: {
              in: ["COMPLETED", "REJECTED"],
            },
          },
          include: {
            user: true,
          },
          orderBy: {
            requestedAt: "desc",
          },
          take: 10,
        }),
      ]);

    const pendingDepositAmount = pendingDeposits.reduce(
      (sum, item) => sum + parseFixedAmount(item.amount.toString()),
      0n,
    );
    const pendingWithdrawalAmount = pendingWithdrawals.reduce(
      (sum, item) => sum + parseFixedAmount(item.amount.toString()),
      0n,
    );

    const recentProcessed = [
      ...recentDeposits.map((item) => ({
        requestId: item.id,
        kind: "DEPOSIT" as const,
        userId: item.userId,
        userName: item.user.displayName,
        userEmail: item.user.email,
        amount: item.amount.toString(),
        currency: item.currency,
        provider: item.provider,
        status: item.status,
        processedAt: formatKoreanDate(item.confirmedAt ?? item.requestedAt),
        processedAtValue: (item.confirmedAt ?? item.requestedAt).toISOString(),
        memo: item.memo,
        destination: null,
      })),
      ...recentWithdrawals.map((item) => ({
        requestId: item.id,
        kind: "WITHDRAWAL" as const,
        userId: item.userId,
        userName: item.user.displayName,
        userEmail: item.user.email,
        amount: item.amount.toString(),
        currency: item.currency,
        provider: item.provider,
        status: item.status,
        processedAt: formatKoreanDate(item.completedAt ?? item.requestedAt),
        processedAtValue: (item.completedAt ?? item.requestedAt).toISOString(),
        memo: item.memo,
        destination: item.destination,
      })),
    ].sort(
      (left, right) =>
        new Date(right.processedAtValue).getTime() -
        new Date(left.processedAtValue).getTime(),
    );

    return {
      summary: {
        pendingDeposits: pendingDeposits.length,
        pendingWithdrawals: pendingWithdrawals.length,
        pendingDepositAmount: formatFixedAmount(pendingDepositAmount),
        pendingWithdrawalAmount: formatFixedAmount(pendingWithdrawalAmount),
      },
      pendingDeposits: pendingDeposits.map((item) => ({
        requestId: item.id,
        userName: item.user.displayName,
        userEmail: item.user.email,
        amount: item.amount.toString(),
        currency: item.currency,
        provider: item.provider,
        status: item.status,
        riskFlags: [],
        requestedAt: formatKoreanDate(item.requestedAt),
        memo: item.memo,
        evidence: parseCryptoDepositEvidence(item.memo),
      })),
      pendingWithdrawals: pendingWithdrawals.map((item) => ({
        requestId: item.id,
        userName: item.user.displayName,
        userEmail: item.user.email,
        amount: item.amount.toString(),
        fee: item.fee.toString(),
        netAmount: item.netAmount.toString(),
        totalDebit: formatFixedAmount(
          parseFixedAmount(item.amount.toString()) +
            parseFixedAmount(item.fee.toString()),
        ),
        chain: item.chain,
        currency: item.currency,
        provider: item.provider,
        destination: item.destination,
        status: item.status,
        riskFlags: extractWithdrawalRiskFlags(item.riskFlags),
        lastLog: item.logs[0]?.message ?? null,
        requestedAt: formatKoreanDate(item.requestedAt),
        memo: item.memo,
      })),
      recentProcessed,
    };
  });
}

function extractWithdrawalRiskFlags(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const flags = (value as { flags?: unknown }).flags;
  if (!Array.isArray(flags)) {
    return [];
  }

  return flags.filter((flag): flag is string => typeof flag === "string");
}

export async function getAdminFinanceLedgerState(filters?: {
  direction?: string | null;
  bucket?: string | null;
  query?: string | null;
}): Promise<AdminFinanceLedgerState> {
  const prisma = getPrismaClient();
  const direction = normalizeLedgerDirection(filters?.direction);
  const bucket = normalizeLedgerBucket(filters?.bucket);
  const query = filters?.query?.trim() ?? "";
  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: {
      ...(direction ? { direction } : {}),
      ...(bucket ? { bucket } : {}),
    },
    include: {
      wallet: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 300,
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
      entry.wallet.user.displayName,
      entry.wallet.user.email,
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
  const shownEntries = filteredEntries.slice(0, 150);
  const orderIds = Array.from(
    new Set(
      shownEntries
        .filter((entry) => entry.referenceType === "ORDER" && entry.referenceId)
        .map((entry) => entry.referenceId as string),
    ),
  );
  const orderTraceRows =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: {
            id: {
              in: orderIds,
            },
          },
          include: {
            buyer: true,
            seller: true,
            listing: true,
          },
        })
      : [];
  const orderTraceById = new Map(
    orderTraceRows.map((order) => [
      order.id,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        listingTitle: order.listing.title,
        buyerName: order.buyer.displayName,
        sellerName: order.seller.displayName,
        grossAmount: order.grossAmount.toString(),
        platformFeeAmount: order.platformFeeAmount.toString(),
        sellerReceivableAmount: order.sellerReceivableAmount.toString(),
        currency: order.currency,
      },
    ]),
  );

  return {
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
    entries: shownEntries.map((entry) => ({
      entryId: entry.id,
      userId: entry.userId,
      userName: entry.wallet.user.displayName,
      userEmail: entry.wallet.user.email,
      type: entry.type,
      direction: entry.direction,
      bucket: entry.bucket,
      amount: entry.amount.toString(),
      currency: entry.currency,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceHref: buildAdminLedgerReferenceHref(
        entry.referenceType,
        entry.referenceId,
      ),
      orderTrace:
        entry.referenceType === "ORDER" && entry.referenceId
          ? orderTraceById.get(entry.referenceId) ?? null
          : null,
      memo: entry.memo,
      createdAt: formatKoreanDate(entry.createdAt),
      createdAtValue: entry.createdAt.toISOString(),
    })),
  };
}

export async function getAdminFinanceLedgerExportRows(filters?: {
  direction?: string | null;
  bucket?: string | null;
  query?: string | null;
}): Promise<AdminFinanceLedgerExportRow[]> {
  const state = await getAdminFinanceLedgerState(filters);

  return state.entries.map((entry) => ({
    entryId: entry.entryId,
    userId: entry.userId,
    userName: entry.userName,
    userEmail: entry.userEmail,
    type: entry.type,
    direction: entry.direction,
    bucket: entry.bucket,
    amount: entry.amount,
    currency: entry.currency,
    referenceType: entry.referenceType ?? "",
    referenceId: entry.referenceId ?? "",
    memo: entry.memo ?? "",
    createdAt: entry.createdAt,
  }));
}

export async function getAdminFinanceReconciliationState(filters?: {
  range?: string | null;
}): Promise<AdminFinanceReconciliationState> {
  const prisma = getPrismaClient();
  const range = normalizeReconciliationRange(filters?.range);
  const from = getReconciliationFromDate(range);
  const to = new Date();
  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: {
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      wallet: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });
  const creditAmount = sumLedgerEntries(ledgerEntries, "CREDIT");
  const debitAmount = sumLedgerEntries(ledgerEntries, "DEBIT");
  const uniqueUsers = new Set(ledgerEntries.map((entry) => entry.userId)).size;
  const closeReports = await prisma.adminFinanceCloseReport.findMany({
    where: {
      range,
    },
    orderBy: {
      closedAt: "desc",
    },
    take: 5,
  });

  const bucketBreakdown = buildLedgerBreakdown(ledgerEntries, "bucket").map(
    (item) => ({
      bucket: item.key,
      creditAmount: item.creditAmount,
      debitAmount: item.debitAmount,
      netAmount: item.netAmount,
      count: item.count,
    }),
  );
  const typeBreakdown = buildLedgerBreakdown(ledgerEntries, "type").map(
    (item) => ({
      type: item.key,
      creditAmount: item.creditAmount,
      debitAmount: item.debitAmount,
      netAmount: item.netAmount,
      count: item.count,
    }),
  );
  const recentEntries = ledgerEntries.slice(0, 12).map((entry) => ({
    entryId: entry.id,
    userId: entry.userId,
    userName: entry.wallet.user.displayName,
    userEmail: entry.wallet.user.email,
    type: entry.type,
    direction: entry.direction,
    bucket: entry.bucket,
    amount: entry.amount.toString(),
    currency: entry.currency,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    referenceHref: buildAdminLedgerReferenceHref(
      entry.referenceType,
      entry.referenceId,
    ),
    orderTrace: null,
    memo: entry.memo,
    createdAt: formatKoreanDate(entry.createdAt),
    createdAtValue: entry.createdAt.toISOString(),
  }));

  return {
    filters: {
      range,
    },
    summary: {
      entryCount: ledgerEntries.length,
      creditAmount: formatFixedAmount(creditAmount),
      debitAmount: formatFixedAmount(debitAmount),
      netAmount: formatSignedFixedAmount(creditAmount - debitAmount),
      uniqueUsers,
      from: formatKoreanDate(from),
      fromAtValue: from.toISOString(),
      to: formatKoreanDate(to),
      toAtValue: to.toISOString(),
    },
    bucketBreakdown,
    typeBreakdown,
    recentEntries,
    closeChecklist: buildReconciliationCloseChecklist({
      entryCount: ledgerEntries.length,
      creditAmount,
      debitAmount,
      bucketBreakdown,
      typeBreakdown,
      range,
    }),
    anomalyFlags: buildReconciliationAnomalyFlags({
      entryCount: ledgerEntries.length,
      creditAmount,
      debitAmount,
      bucketBreakdown,
      typeBreakdown,
      range,
    }),
    closeReports: closeReports.map((report) => ({
      reportId: report.id,
      range: report.range,
      entryCount: report.entryCount,
      uniqueUsers: report.uniqueUsers,
      creditAmount: report.creditAmount.toString(),
      debitAmount: report.debitAmount.toString(),
      netAmount: report.netAmount.toString(),
      note: report.note,
      closedById: report.closedById,
      closedAt: formatKoreanDate(report.closedAt),
    })),
  };
}

export async function getAdminFinanceReconciliationExportRows(filters?: {
  range?: string | null;
}): Promise<AdminFinanceReconciliationExportRow[]> {
  const state = await getAdminFinanceReconciliationState(filters);
  const rows: AdminFinanceReconciliationExportRow[] = [
    {
      section: "SUMMARY",
      label: `Range ${state.filters.range} (${state.summary.from} to ${state.summary.to})`,
      creditAmount: state.summary.creditAmount,
      debitAmount: state.summary.debitAmount,
      netAmount: state.summary.netAmount,
      count: state.summary.entryCount.toString(),
      userName: "",
      userEmail: "",
      referenceType: "",
      referenceId: "",
      createdAt: state.summary.to,
    },
    {
      section: "SUMMARY",
      label: "Unique users",
      creditAmount: "",
      debitAmount: "",
      netAmount: "",
      count: state.summary.uniqueUsers.toString(),
      userName: "",
      userEmail: "",
      referenceType: "",
      referenceId: "",
      createdAt: state.summary.to,
    },
  ];

  rows.push(
    ...state.bucketBreakdown.map((item) => ({
      section: "BUCKET",
      label: item.bucket,
      creditAmount: item.creditAmount,
      debitAmount: item.debitAmount,
      netAmount: item.netAmount,
      count: item.count.toString(),
      userName: "",
      userEmail: "",
      referenceType: "",
      referenceId: "",
      createdAt: "",
    })),
    ...state.typeBreakdown.map((item) => ({
      section: "TYPE",
      label: item.type,
      creditAmount: item.creditAmount,
      debitAmount: item.debitAmount,
      netAmount: item.netAmount,
      count: item.count.toString(),
      userName: "",
      userEmail: "",
      referenceType: "",
      referenceId: "",
      createdAt: "",
    })),
    ...state.recentEntries.map((entry) => ({
      section: "RECENT_ENTRY",
      label: entry.type,
      creditAmount: entry.direction === "CREDIT" ? entry.amount : "",
      debitAmount: entry.direction === "DEBIT" ? entry.amount : "",
      netAmount: "",
      count: "1",
      userName: entry.userName,
      userEmail: entry.userEmail,
      referenceType: entry.referenceType ?? "",
      referenceId: entry.referenceId ?? "",
      createdAt: entry.createdAt,
    })),
  );

  return rows;
}

export async function createAdminFinanceCloseReport(input: {
  actorId: string;
  range?: string | null;
  note?: string | null;
}): Promise<AdminFinanceCloseReportResult> {
  const prisma = getPrismaClient();
  const range = normalizeReconciliationRange(input.range);
  const note = input.note?.trim() || null;

  if (note && note.length > 1000) {
    throw new Error("Close note must be 1000 characters or less.");
  }

  const state = await getAdminFinanceReconciliationState({ range });
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.adminFinanceCloseReport.create({
      data: {
        range: state.filters.range,
        fromAt: new Date(state.summary.fromAtValue),
        toAt: new Date(state.summary.toAtValue),
        entryCount: state.summary.entryCount,
        uniqueUsers: state.summary.uniqueUsers,
        creditAmount: state.summary.creditAmount,
        debitAmount: state.summary.debitAmount,
        netAmount: state.summary.netAmount,
        note,
        closedById: input.actorId,
        snapshot: {
          summary: state.summary,
          bucketBreakdown: state.bucketBreakdown,
          typeBreakdown: state.typeBreakdown,
          closeChecklist: state.closeChecklist,
          anomalyFlags: state.anomalyFlags,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "FINANCE_RECONCILIATION_CLOSED",
        targetType: "ADMIN_FINANCE_CLOSE_REPORT",
        targetId: created.id,
          reason: note ?? `${state.filters.range} 기간 재무 마감 보고서 저장`,
        after: {
          range: state.filters.range,
          entryCount: state.summary.entryCount,
          uniqueUsers: state.summary.uniqueUsers,
          creditAmount: state.summary.creditAmount,
          debitAmount: state.summary.debitAmount,
          netAmount: state.summary.netAmount,
        },
      },
    });

    return created;
  });

  return {
    reportId: report.id,
    message: "재무 마감 보고서가 저장되었습니다.",
  };
}

export async function processAdminFinanceAction(input: {
  kind: "DEPOSIT" | "WITHDRAWAL";
  requestId: string;
  adminId?: string;
  adminEvidence?: {
    txId?: string;
    memo?: string;
  };
  action:
    | "CONFIRM_DEPOSIT"
    | "REJECT_DEPOSIT"
    | "COMPLETE_WITHDRAWAL"
    | "REJECT_WITHDRAWAL";
}): Promise<AdminFinanceActionResult> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    if (!input.adminId) {
      throw new Error("관리자 인증 정보가 필요합니다.");
    }

    const actorAdminId = input.adminId;
    const depositActions = ["CONFIRM_DEPOSIT", "REJECT_DEPOSIT"];
    const withdrawalActions = ["COMPLETE_WITHDRAWAL", "REJECT_WITHDRAWAL"];

    if (input.kind === "DEPOSIT" && !depositActions.includes(input.action)) {
      throw new Error("입금 요청에는 입금 승인 또는 입금 반려만 사용할 수 있습니다.");
    }

    if (input.kind === "WITHDRAWAL" && !withdrawalActions.includes(input.action)) {
      throw new Error("출금 요청에는 출금 완료 또는 출금 거절만 사용할 수 있습니다.");
    }

    if (input.kind === "DEPOSIT") {
      const request = await tx.depositRequest.findUnique({
        where: {
          id: input.requestId,
        },
        include: {
          wallet: true,
          user: true,
        },
      });

      if (!request) {
        throw new Error("입금 요청을 찾을 수 없습니다.");
      }

      if (request.status !== "PENDING") {
        throw new Error("대기 중인 입금 요청만 처리할 수 있습니다.");
      }

      if (request.wallet.userId !== request.userId) {
        throw new Error("입금 지갑이 요청 계정과 일치하지 않습니다.");
      }

      if (request.wallet.currency !== request.currency) {
        throw new Error("입금 통화가 요청 지갑 통화와 일치하지 않습니다.");
      }

      const amount = parseFixedAmount(request.amount.toString());

      if (amount <= 0n) {
        throw new Error("입금 금액은 0보다 커야 합니다.");
      }

      const depositEvidence = parseCryptoDepositEvidence(request.memo);
      const depositTxHash = normalizeDepositTxHash(depositEvidence.txHash);

      if (input.action === "CONFIRM_DEPOSIT" && !depositTxHash) {
        throw new Error("입금 승인 전 TXID를 제출해야 합니다.");
      }

      if (input.action === "CONFIRM_DEPOSIT" && depositTxHash) {
        const duplicateDeposit = await findDuplicateDepositTxHash(tx, {
          requestId: request.id,
          txHash: depositTxHash,
        });

        if (duplicateDeposit) {
          throw new Error(
            `이미 사용된 TXID입니다. 중복 요청 ID: ${duplicateDeposit.id}`,
          );
        }
      }

      if (input.action === "REJECT_DEPOSIT") {
        const statusUpdate = await tx.depositRequest.updateMany({
          where: {
            id: request.id,
            status: "PENDING",
          },
          data: {
            status: "REJECTED",
            confirmedByAdminId: actorAdminId,
          },
        });

        if (statusUpdate.count !== 1) {
          throw new Error("이미 처리된 입금 요청입니다. 새로고침 후 상태를 확인해 주세요.");
        }

        await tx.adminAuditLog.create({
          data: {
            adminId: actorAdminId,
            action: "DEPOSIT_REJECTED",
            targetType: "DEPOSIT_REQUEST",
            targetId: request.id,
            reason: request.memo ?? "관리자 수동 입금 반려",
            before: {
              status: request.status,
              amount: request.amount.toString(),
              currency: request.currency,
            },
            after: {
              status: "REJECTED",
            },
          },
        });

        await createUserNotification({
          userId: request.userId,
          type: "WALLET_UPDATE",
          title: "입금 요청이 반려되었습니다.",
          body: `${request.amount.toString()} ${request.currency} 입금 요청이 반려되었습니다.`, 
          href: `/my/wallet/deposits/${request.id}`,
          metadata: {
            requestId: request.id,
            kind: "DEPOSIT",
          },
        });

        return {
          requestId: request.id,
          kind: "DEPOSIT",
          status: "REJECTED",
          message: "입금 요청이 반려되었습니다.",
        };
      }

      const currentAvailable = parseFixedAmount(
        request.wallet.availableBalance.toString(),
      );
      const currentWithdrawable = parseFixedAmount(
        request.wallet.withdrawableBalance.toString(),
      );

      const statusUpdate = await tx.depositRequest.updateMany({
        where: {
          id: request.id,
          status: "PENDING",
        },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedByAdminId: actorAdminId,
        },
      });

      if (statusUpdate.count !== 1) {
        throw new Error("이미 처리된 입금 요청입니다. 새로고침 후 상태를 확인해 주세요.");
      }

      await tx.wallet.update({
        where: {
          id: request.walletId,
        },
        data: {
          availableBalance: formatFixedAmount(currentAvailable + amount),
          withdrawableBalance: formatFixedAmount(currentWithdrawable + amount),
        },
      });

      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: request.walletId,
            userId: request.userId,
            type: "ADMIN_DEPOSIT_APPROVED",
            direction: "CREDIT",
            bucket: "AVAILABLE",
            amount: request.amount.toString(),
            currency: request.currency,
            referenceType: "DEPOSIT_REQUEST",
            referenceId: request.id,
            memo: request.memo ?? "관리자가 수동 입금을 승인했습니다.",
          },
          {
            walletId: request.walletId,
            userId: request.userId,
            type: "ADMIN_DEPOSIT_APPROVED",
            direction: "CREDIT",
            bucket: "WITHDRAWABLE",
            amount: request.amount.toString(),
            currency: request.currency,
            referenceType: "DEPOSIT_REQUEST",
            referenceId: request.id,
            memo: request.memo ?? "관리자가 수동 입금을 승인했습니다.",
          },
        ],
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: actorAdminId,
          action: "DEPOSIT_CONFIRMED",
          targetType: "DEPOSIT_REQUEST",
          targetId: request.id,
          reason: request.memo ?? "관리자 수동 입금 승인",
          before: {
            status: request.status,
            walletAvailable: request.wallet.availableBalance.toString(),
            walletWithdrawable: request.wallet.withdrawableBalance.toString(),
          },
          after: {
            status: "CONFIRMED",
            amount: request.amount.toString(),
            currency: request.currency,
          },
        },
      });

      await createUserNotification({
        userId: request.userId,
        type: "WALLET_UPDATE",
        title: "입금 요청이 승인되었습니다.",
        body: `${request.amount.toString()} ${request.currency} 입금 요청이 승인되었습니다.`, 
        href: `/my/wallet/deposits/${request.id}`,
        metadata: {
          requestId: request.id,
          kind: "DEPOSIT",
        },
      });

      return {
        requestId: request.id,
        kind: "DEPOSIT",
        status: "CONFIRMED",
        message: "입금 요청이 승인되었습니다.",
      };
    }

    const request = await tx.withdrawalRequest.findUnique({
      where: {
        id: input.requestId,
      },
      include: {
        wallet: true,
        user: true,
      },
    });

    if (!request) {
      throw new Error("출금 요청을 찾을 수 없습니다.");
    }

    if (!["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"].includes(request.status)) {
      throw new Error("처리 대기 중인 출금 요청만 처리할 수 있습니다.");
    }

    if (request.wallet.userId !== request.userId) {
      throw new Error("출금 지갑이 요청 계정과 일치하지 않습니다.");
    }

    if (request.wallet.currency !== request.currency) {
      throw new Error("출금 통화가 요청 지갑 통화와 일치하지 않습니다.");
    }

    const amount = parseFixedAmount(request.amount.toString());
    const fee = parseFixedAmount(request.fee.toString());
    const totalDebit = amount + fee;
    const processableWithdrawalStatuses = [
      "REQUESTED",
      "UNDER_REVIEW",
      "APPROVED",
      "SENT",
    ] as const;

    if (amount <= 0n) {
      throw new Error("출금 금액은 0보다 커야 합니다.");
    }

    if (input.action === "REJECT_WITHDRAWAL") {
      const currentWithdrawable = parseFixedAmount(
        request.wallet.withdrawableBalance.toString(),
      );
      const currentAvailable = parseFixedAmount(
        request.wallet.availableBalance.toString(),
      );
      const currentWithdrawalLocked = parseFixedAmount(
        request.wallet.withdrawalLocked.toString(),
      );
      const canReleaseLocked = currentWithdrawalLocked >= totalDebit;
      const rejectReason = input.adminEvidence?.memo?.trim() || request.memo || "관리자 수동 출금 반려";

      const statusUpdate = await tx.withdrawalRequest.updateMany({
        where: {
          id: request.id,
          status: {
            in: [...processableWithdrawalStatuses],
          },
        },
        data: {
          status: "REJECTED",
          processedByAdminId: actorAdminId,
          processedAt: new Date(),
          failureReason: rejectReason,
        },
      });

      if (statusUpdate.count !== 1) {
        throw new Error("이미 처리된 출금 요청입니다. 새로고침 후 상태를 확인해 주세요.");
      }

      if (canReleaseLocked) {
        await tx.wallet.update({
          where: {
            id: request.walletId,
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
              walletId: request.walletId,
              userId: request.userId,
              type: "WITHDRAWAL_REJECTED",
              direction: "DEBIT",
              bucket: "WITHDRAWAL_LOCKED",
              amount: formatFixedAmount(totalDebit),
              currency: request.currency,
              referenceType: "WITHDRAWAL_REQUEST",
              referenceId: request.id,
              memo: "출금 반려로 잠긴 금액이 해제되었습니다.",
            },
            {
              walletId: request.walletId,
              userId: request.userId,
              type: "WITHDRAWAL_REJECTED",
              direction: "CREDIT",
              bucket: "AVAILABLE",
              amount: formatFixedAmount(totalDebit),
              currency: request.currency,
              referenceType: "WITHDRAWAL_REQUEST",
              referenceId: request.id,
              memo: "출금 반려로 보유 잔액이 복구되었습니다.",
            },
            {
              walletId: request.walletId,
              userId: request.userId,
              type: "WITHDRAWAL_REJECTED",
              direction: "CREDIT",
              bucket: "WITHDRAWABLE",
              amount: formatFixedAmount(totalDebit),
              currency: request.currency,
              referenceType: "WITHDRAWAL_REQUEST",
              referenceId: request.id,
              memo: "출금 반려로 출금 가능 잔액이 복구되었습니다.",
            },
          ],
        });
      }

      await tx.withdrawalLog.create({
        data: {
          withdrawalRequestId: request.id,
          userId: request.userId,
          action: "WITHDRAWAL_REJECTED",
          statusFrom: request.status,
          statusTo: "REJECTED",
          message: "관리자가 출금 요청을 반려했고 잠긴 금액을 반환했습니다.",
          metadata: {
            amount: request.amount.toString(),
            fee: request.fee.toString(),
            totalDebit: formatFixedAmount(totalDebit),
            reason: rejectReason,
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: actorAdminId,
          action: "WITHDRAWAL_REJECTED",
          targetType: "WITHDRAWAL_REQUEST",
          targetId: request.id,
          reason: rejectReason,
          before: {
            status: request.status,
            amount: request.amount.toString(),
            fee: request.fee.toString(),
            currency: request.currency,
          },
          after: {
            status: "REJECTED",
            restoredAmount: formatFixedAmount(totalDebit),
          },
        },
      });

      await createUserNotification({
        userId: request.userId,
        type: "WALLET_UPDATE",
        title: "출금 요청이 반려되었습니다.",
        body: `${request.amount.toString()} ${request.currency} 출금 요청이 반려되었습니다.`, 
        href: `/my/wallet/withdrawals/${request.id}`,
        metadata: {
          requestId: request.id,
          kind: "WITHDRAWAL",
        },
      });

      return {
        requestId: request.id,
        kind: "WITHDRAWAL",
        status: "REJECTED",
        message: "출금 요청이 반려되었습니다.",
      };
    }

    const currentAvailable = parseFixedAmount(
      request.wallet.availableBalance.toString(),
    );
    const currentWithdrawable = parseFixedAmount(
      request.wallet.withdrawableBalance.toString(),
    );
    const currentWithdrawalLocked = parseFixedAmount(
      request.wallet.withdrawalLocked.toString(),
    );
    const isLockedRequest = currentWithdrawalLocked >= totalDebit;
    const completionEvidence = normalizeWithdrawalCompletionEvidence(
      input.adminEvidence,
    );

    if (!isLockedRequest && currentAvailable < totalDebit) {
      throw new Error("출금을 완료할 금액이 부족합니다.");
    }

    const statusUpdate = await tx.withdrawalRequest.updateMany({
      where: {
        id: request.id,
        status: {
          in: [...processableWithdrawalStatuses],
        },
      },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        completedAt: new Date(),
        processedByAdminId: actorAdminId,
        memo: buildAdminWithdrawalMemo(request.memo, completionEvidence),
      },
    });

    if (statusUpdate.count !== 1) {
      throw new Error("이미 처리된 출금 요청입니다. 새로고침 후 상태를 확인해 주세요.");
    }

    await tx.wallet.update({
      where: {
        id: request.walletId,
      },
      data: {
        availableBalance: isLockedRequest
          ? request.wallet.availableBalance.toString()
          : formatFixedAmount(currentAvailable - totalDebit),
        withdrawableBalance: isLockedRequest
          ? request.wallet.withdrawableBalance.toString()
          : formatFixedAmount(currentWithdrawable - totalDebit),
        withdrawalLocked: isLockedRequest
          ? formatFixedAmount(currentWithdrawalLocked - totalDebit)
          : request.wallet.withdrawalLocked.toString(),
      },
    });

    await tx.walletLedgerEntry.createMany({
      data: [
        {
          walletId: request.walletId,
          userId: request.userId,
          type: "WITHDRAWAL_COMPLETED",
          direction: "DEBIT",
          bucket: isLockedRequest ? "WITHDRAWAL_LOCKED" : "WITHDRAWABLE",
          amount: formatFixedAmount(totalDebit),
          currency: request.currency,
          referenceType: "WITHDRAWAL_REQUEST",
          referenceId: request.id,
          memo: completionEvidence.summary,
        },
        ...(fee > 0n
          ? [
              {
                walletId: request.walletId,
                userId: request.userId,
                type: "PLATFORM_FEE_COLLECTED" as const,
                direction: "CREDIT" as const,
                bucket: "PLATFORM_REVENUE" as const,
                amount: request.fee.toString(),
                currency: request.currency,
                referenceType: "WITHDRAWAL_REQUEST",
                referenceId: request.id,
                memo: "출금 수수료가 플랫폼 수익으로 확정되었습니다.",
              },
            ]
          : []),
      ],
    });

    await tx.withdrawalLog.create({
      data: {
        withdrawalRequestId: request.id,
        userId: request.userId,
        action: "WITHDRAWAL_COMPLETED",
        statusFrom: request.status,
        statusTo: "COMPLETED",
        message: completionEvidence.summary,
        metadata: {
          amount: request.amount.toString(),
          fee: request.fee.toString(),
          totalDebit: formatFixedAmount(totalDebit),
          chain: request.chain,
          evidence: completionEvidence,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorAdminId,
        action: "WITHDRAWAL_COMPLETED",
        targetType: "WITHDRAWAL_REQUEST",
        targetId: request.id,
        reason: completionEvidence.summary,
        before: {
          status: request.status,
          walletAvailable: request.wallet.availableBalance.toString(),
          walletWithdrawable: request.wallet.withdrawableBalance.toString(),
          walletWithdrawalLocked: request.wallet.withdrawalLocked.toString(),
        },
        after: {
          status: "COMPLETED",
          amount: request.amount.toString(),
          fee: request.fee.toString(),
          currency: request.currency,
          evidence: completionEvidence,
        },
      },
    });

    await createUserNotification({
      userId: request.userId,
      type: "WALLET_UPDATE",
      title: "출금 요청이 완료되었습니다.",
      body: `${request.amount.toString()} ${request.currency} 출금 요청이 완료되었습니다.`, 
      href: `/my/wallet/withdrawals/${request.id}`,
      metadata: {
        requestId: request.id,
        kind: "WITHDRAWAL",
      },
    });

    return {
      requestId: request.id,
      kind: "WITHDRAWAL",
      status: "COMPLETED",
      message: "출금 요청이 완료되었습니다.",
    };
  });
}

type CryptoDepositEvidence = {
  asset: string | null;
  network: string | null;
  depositAddress: string | null;
  txHash: string | null;
  note: string | null;
  isTxHashPending: boolean;
};

type WithdrawalCompletionEvidence = {
  txId: string | null;
  memo: string | null;
  summary: string;
};

const WITHDRAWAL_ADMIN_MEMO_MARKER = "[관리자 출금 완료]";

function normalizeWithdrawalCompletionEvidence(input?: {
  txId?: string;
  memo?: string;
}): WithdrawalCompletionEvidence {
  const txId = input?.txId?.trim() || null;
  const memo = input?.memo?.trim() || null;

  if (!txId) {
    throw new Error("출금 완료 처리에는 송금 TXID가 필요합니다.");
  }

  return {
    txId,
    memo,
    summary: [
      "관리자가 수동 출금을 완료했습니다.",
      txId ? `TXID: ${txId}` : null,
      memo ? `증빙 메모: ${memo}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildAdminWithdrawalMemo(
  currentMemo: string | null,
  evidence: WithdrawalCompletionEvidence,
) {
  return [
    currentMemo?.trim() || null,
    `${WITHDRAWAL_ADMIN_MEMO_MARKER} ${evidence.summary}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeDepositTxHash(txHash: string | null) {
  const normalized = txHash?.trim();
  if (!normalized || normalized.toLowerCase().includes("pending")) {
    return null;
  }

  return normalized;
}

async function findDuplicateDepositTxHash(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string;
    txHash: string;
  },
) {
  return tx.depositRequest.findFirst({
    where: {
      id: {
        not: input.requestId,
      },
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
      memo: {
        contains: input.txHash,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });
}

function parseCryptoDepositEvidence(memo: string | null): CryptoDepositEvidence {
  const fields = Object.fromEntries(
    (memo ?? "")
      .split("/")
      .map((part) => part.trim())
      .map((part) => {
        const separatorIndex = part.indexOf(":");

        if (separatorIndex === -1) {
          return [part.toLowerCase(), ""] as const;
        }

        return [
          part.slice(0, separatorIndex).trim().toLowerCase(),
          part.slice(separatorIndex + 1).trim(),
        ] as const;
      }),
  );
  const txHash = fields["tx hash"] || null;

  return {
    asset: fields.asset || null,
    network: fields.network || null,
    depositAddress: fields["deposit address"] || null,
    txHash,
    note: fields.note || null,
    isTxHashPending: !txHash || txHash.toLowerCase().includes("pending"),
  };
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function normalizeReconciliationRange(range: string | null | undefined) {
  if (range === "7d" || range === "30d") {
    return range;
  }

  return "today";
}

function getReconciliationFromDate(range: "today" | "7d" | "30d") {
  const now = new Date();

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sumLedgerEntries(
  entries: Array<{ direction: LedgerDirection; amount: Prisma.Decimal }>,
  direction: LedgerDirection,
) {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce((sum, entry) => sum + parseFixedAmount(entry.amount.toString()), 0n);
}

function buildLedgerBreakdown<
  TEntry extends {
    direction: LedgerDirection;
    amount: Prisma.Decimal;
    bucket: WalletBucket;
    type: string;
  },
>(entries: TEntry[], key: "bucket" | "type") {
  const groups = new Map<
    string,
    {
      credit: bigint;
      debit: bigint;
      count: number;
    }
  >();

  for (const entry of entries) {
    const groupKey = entry[key];
    const group = groups.get(groupKey) ?? {
      credit: 0n,
      debit: 0n,
      count: 0,
    };
    const amount = parseFixedAmount(entry.amount.toString());

    if (entry.direction === "CREDIT") {
      group.credit += amount;
    } else {
      group.debit += amount;
    }

    group.count += 1;
    groups.set(groupKey, group);
  }

  return [...groups.entries()]
    .map(([groupKey, group]) => ({
      key: groupKey,
      creditAmount: formatFixedAmount(group.credit),
      debitAmount: formatFixedAmount(group.debit),
      netAmount: formatSignedFixedAmount(group.credit - group.debit),
      count: group.count,
    }))
    .sort((left, right) => right.count - left.count);
}

function buildReconciliationCloseChecklist(input: {
  entryCount: number;
  creditAmount: bigint;
  debitAmount: bigint;
  bucketBreakdown: AdminFinanceReconciliationState["bucketBreakdown"];
  typeBreakdown: AdminFinanceReconciliationState["typeBreakdown"];
  range: "today" | "7d" | "30d";
}): AdminFinanceReconciliationState["closeChecklist"] {
  const netAmount = input.creditAmount - input.debitAmount;
  const hasWithdrawalActivity = input.typeBreakdown.some((item) =>
    item.type.includes("WITHDRAWAL"),
  );
  const hasEscrowActivity = input.bucketBreakdown.some(
    (item) => item.bucket === "ESCROW_LOCKED",
  );
  const hasPlatformRevenue = input.bucketBreakdown.some(
    (item) => item.bucket === "PLATFORM_REVENUE" && item.count > 0,
  );
  const hasLargeMovement =
    input.creditAmount >= 1_000_000_000n || input.debitAmount >= 1_000_000_000n;

  return [
    {
      key: "ledger-window",
      label: "Confirm reconciliation window",
      status: input.entryCount > 0 ? "READY" : "CHECK",
      detail:
        input.entryCount > 0
          ? `${input.entryCount} ledger entries are included in the ${input.range} view.`
          : "No ledger entries were found in this period. Confirm whether this is expected.",
      href: `/admin/finance/ledger`,
    },
    {
      key: "net-movement",
      label: "Review net wallet movement",
      status: netAmount === 0n ? "READY" : "CHECK",
      detail:
        netAmount === 0n
          ? "Credit and debit totals offset for this period."
          : `Net movement is ${formatSignedFixedAmount(netAmount)} USDT. Confirm the business reason.`,
      href: `/admin/finance/reconciliation?range=${input.range}`,
    },
    {
      key: "withdrawal-evidence",
      label: "Match withdrawal evidence",
      status: hasWithdrawalActivity ? "CHECK" : "READY",
      detail: hasWithdrawalActivity
        ? "Withdrawal ledger activity exists. Match payout proof before closing."
        : "No withdrawal ledger activity was found in this period.",
      href: `/admin/finance/ledger?q=WITHDRAWAL`,
    },
    {
      key: "escrow-review",
      label: "Review escrow movement",
      status: hasEscrowActivity ? "CHECK" : "READY",
      detail: hasEscrowActivity
        ? "Escrow bucket movement exists. Spot-check related order references."
        : "No escrow movement was found in this period.",
      href: `/admin/finance/ledger?bucket=ESCROW_LOCKED`,
    },
    {
      key: "platform-revenue-review",
      label: "Review platform revenue",
      status: hasPlatformRevenue ? "CHECK" : "READY",
      detail: hasPlatformRevenue
        ? "Platform revenue exists. Match fee and premium promotion ledger entries before closing."
        : "No platform revenue movement was found in this period.",
      href: `/admin/finance/ledger?bucket=PLATFORM_REVENUE`,
    },
    {
      key: "large-movement",
      label: "Large movement review",
      status: hasLargeMovement ? "BLOCKED" : "READY",
      detail: hasLargeMovement
        ? "At least one side of the flow is over 1000 USDT. Require second review."
        : "No large aggregate movement threshold was triggered.",
      href: `/admin/finance/ledger`,
    },
  ];
}

function buildReconciliationAnomalyFlags(input: {
  entryCount: number;
  creditAmount: bigint;
  debitAmount: bigint;
  bucketBreakdown: AdminFinanceReconciliationState["bucketBreakdown"];
  typeBreakdown: AdminFinanceReconciliationState["typeBreakdown"];
  range: "today" | "7d" | "30d";
}) {
  const flags: Array<{
    key: string;
    severity: "INFO" | "WARN" | "CRITICAL";
    label: string;
    detail: string;
    href: string;
  }> = [];

  if (input.entryCount === 0) {
    flags.push({
      key: "no-entries",
      severity: "INFO",
      label: "No ledger activity",
      detail: "No wallet ledger entries were found for this period.",
      href: `/admin/finance/reconciliation?range=${input.range}`,
    });
  }

  if (input.debitAmount > input.creditAmount) {
    flags.push({
      key: "debit-greater-than-credit",
      severity: "WARN",
      label: "Debit total exceeds credit total",
      detail: `Debit flow is ${formatFixedAmount(input.debitAmount)} USDT while credit flow is ${formatFixedAmount(input.creditAmount)} USDT.`,
      href: "/admin/finance/ledger?direction=debit",
    });
  }

  const withdrawalCount = input.typeBreakdown
    .filter((item) => item.type.includes("WITHDRAWAL"))
    .reduce((sum, item) => sum + item.count, 0);

  if (withdrawalCount >= 5) {
    flags.push({
      key: "many-withdrawals",
      severity: "WARN",
      label: "Multiple withdrawal movements",
      detail: `${withdrawalCount} withdrawal-related ledger entries appeared in this period.`,
      href: "/admin/finance/ledger?q=WITHDRAWAL",
    });
  }

  const escrowNet = input.bucketBreakdown.find(
    (item) => item.bucket === "ESCROW_LOCKED",
  )?.netAmount;
  const platformRevenueNet = input.bucketBreakdown.find(
    (item) => item.bucket === "PLATFORM_REVENUE",
  )?.netAmount;

  if (escrowNet && escrowNet !== "0") {
    flags.push({
      key: "escrow-net-open",
      severity: "INFO",
      label: "Escrow net movement exists",
      detail: `Escrow locked bucket net movement is ${escrowNet} USDT.`,
      href: "/admin/finance/ledger?bucket=ESCROW_LOCKED",
    });
  }

  if (input.creditAmount >= 1_000_000_000n || input.debitAmount >= 1_000_000_000n) {
    flags.push({
      key: "large-total-flow",
      severity: "CRITICAL",
      label: "Large aggregate flow",
      detail: "Credit or debit total crossed the 1000 USDT review threshold.",
      href: "/admin/finance/ledger",
    });
  }

  if (platformRevenueNet?.startsWith("-")) {
    flags.push({
      key: "negative-platform-revenue",
      severity: "CRITICAL",
      label: "Negative platform revenue",
      detail: `Platform revenue bucket net movement is ${platformRevenueNet} USDT. Revenue buckets should not close negative.`,
      href: "/admin/finance/ledger?bucket=PLATFORM_REVENUE",
    });
  }

  return flags;
}

function formatSignedFixedAmount(amount: bigint) {
  if (amount < 0n) {
    return `-${formatFixedAmount(-amount)}`;
  }

  return formatFixedAmount(amount);
}

function normalizeLedgerDirection(
  direction: string | null | undefined,
): LedgerDirection | "" {
  if (direction === "credit") {
    return "CREDIT";
  }

  if (direction === "debit") {
    return "DEBIT";
  }

  return "";
}

function normalizeLedgerBucket(
  bucket: string | null | undefined,
): WalletBucket | "" {
  const normalized = bucket?.trim().toUpperCase() ?? "";
  const allowedBuckets: WalletBucket[] = [
    "AVAILABLE",
    "ESCROW_LOCKED",
    "BUY_REQUEST_LOCKED",
    "PENDING_SETTLEMENT",
    "WITHDRAWABLE",
    "WITHDRAWAL_LOCKED",
    "PLATFORM_REVENUE",
  ];

  return allowedBuckets.includes(normalized as WalletBucket)
    ? (normalized as WalletBucket)
    : "";
}

function buildAdminLedgerReferenceHref(
  referenceType: string | null,
  referenceId: string | null,
) {
  if (!referenceType || !referenceId) {
    return null;
  }

  if (referenceType === "ORDER") {
    return `/admin/orders?orderId=${referenceId}`;
  }

  return `/admin/audit?query=${encodeURIComponent(referenceId)}`;
}
