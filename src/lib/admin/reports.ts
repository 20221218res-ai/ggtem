import type { Prisma } from "@/generated/prisma/client";
import type {
  DepositStatus,
  ListingStatus,
  OrderStatus,
  UserStatus,
  WithdrawalStatus,
} from "@/generated/prisma/enums";
import { SENSITIVE_AUDIT_ACTIONS } from "@/lib/admin/audit";
import { getPrismaClient } from "@/lib/prisma";
import type { XlsxSheet } from "@/lib/xlsx";

type ReportKind = "ALL" | "ORDERS" | "DISPUTES" | "WALLET" | "LISTINGS" | "USERS" | "AUDIT";
type ReportRange = "today" | "7d" | "30d" | "custom";

type AdminReportFilters = {
  kind?: string | null;
  range?: string | null;
  from?: string | null;
  to?: string | null;
  query?: string | null;
  status?: string | null;
  gameId?: string | null;
  serverId?: string | null;
  limit?: number;
};

const DEFAULT_PREVIEW_LIMIT = 50;
const EXPORT_LIMIT = 1000;

export const reportStatusOptions = [
  { value: "ALL", label: "전체 상태" },
  { value: "ACTIVE", label: "활성/판매중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELED", label: "취소" },
  { value: "DISPUTED", label: "분쟁" },
  { value: "PENDING", label: "입금 대기" },
  { value: "REQUESTED", label: "요청" },
  { value: "UNDER_REVIEW", label: "검토중" },
  { value: "CONFIRMED", label: "입금 확인" },
  { value: "REJECTED", label: "반려" },
  { value: "SOLD_OUT", label: "품절" },
  { value: "SUSPENDED", label: "정지" },
] as const;

const orderStatuses = [
  "REQUESTED",
  "ESCROW_LOCKED",
  "SELLER_RESPONSE_PENDING",
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
  "COMPLETED",
  "CANCELED",
  "DISPUTED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];
const listingStatuses = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "SOLD_OUT",
  "HIDDEN",
  "REMOVED",
] as const satisfies readonly ListingStatus[];
const trustReportStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;
const depositStatuses = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
  "CANCELED",
] as const satisfies readonly DepositStatus[];
const withdrawalStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "SENT",
  "COMPLETED",
  "REJECTED",
  "CANCELED",
] as const satisfies readonly WithdrawalStatus[];
const userStatuses = [
  "ACTIVE",
  "SUSPENDED",
  "SELLING_RESTRICTED",
  "WITHDRAWAL_HOLD",
  "BANNED",
] as const satisfies readonly UserStatus[];

export type AdminReportsState = Awaited<ReturnType<typeof getAdminReportsState>>;
export type AdminReportExportRow = {
  section: string;
  id: string;
  status: string;
  primary: string;
  secondary: string;
  amount: string;
  createdAt: string;
};

export async function getAdminReportsState(filters?: AdminReportFilters) {
  const prisma = getPrismaClient();
  const kind = normalizeKind(filters?.kind);
  const range = normalizeRange(filters?.range);
  const { from, to } = getReportRange(range, filters?.from, filters?.to);
  const query = filters?.query?.trim() ?? "";
  const status = normalizeStatus(filters?.status);
  const gameId = filters?.gameId?.trim() ?? "";
  const serverId = filters?.serverId?.trim() ?? "";
  const limit = Math.min(Math.max(filters?.limit ?? DEFAULT_PREVIEW_LIMIT, 1), EXPORT_LIMIT);
  const listingScopeWhere = {
    ...(gameId ? { gameId } : {}),
    ...(serverId ? { serverId } : {}),
  };

  const orderStatus = getAllowedStatus(status, orderStatuses);
  const listingStatus = getAllowedStatus(status, listingStatuses);
  const reportStatus = getAllowedStatus(status, trustReportStatuses);
  const depositStatus = getAllowedStatus(status, depositStatuses);
  const withdrawalStatus = getAllowedStatus(status, withdrawalStatuses);
  const userStatus = getAllowedStatus(status, userStatuses);

  const orderWhere: Prisma.OrderWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(orderStatus ? { status: orderStatus } : {}),
    ...(gameId || serverId ? { listing: { is: listingScopeWhere } } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { listing: { title: { contains: query, mode: "insensitive" } } },
            { buyer: { displayName: { contains: query, mode: "insensitive" } } },
            { buyer: { email: { contains: query, mode: "insensitive" } } },
            { seller: { displayName: { contains: query, mode: "insensitive" } } },
            { seller: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const reportWhere: Prisma.TrustReportWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(reportStatus ? { status: reportStatus } : {}),
    ...(gameId || serverId ? { order: { is: { listing: { is: listingScopeWhere } } } } : {}),
    ...(query
      ? {
          OR: [
            { category: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { reporter: { displayName: { contains: query, mode: "insensitive" } } },
            { targetUser: { displayName: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const depositWhere = {
    requestedAt: { gte: from, lte: to },
    ...(depositStatus ? { status: depositStatus } : {}),
    ...(query
      ? {
          OR: [
            { user: { displayName: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { providerTxId: { contains: query, mode: "insensitive" } },
            { depositCode: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  } satisfies Prisma.DepositRequestWhereInput;
  const withdrawalWhere = {
    requestedAt: { gte: from, lte: to },
    ...(withdrawalStatus ? { status: withdrawalStatus } : {}),
    ...(query
      ? {
          OR: [
            { user: { displayName: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { destination: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  } satisfies Prisma.WithdrawalRequestWhereInput;
  const listingWhere: Prisma.ListingWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(listingStatus ? { status: listingStatus } : {}),
    ...(gameId ? { gameId } : {}),
    ...(serverId ? { serverId } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { seller: { displayName: { contains: query, mode: "insensitive" } } },
            { seller: { email: { contains: query, mode: "insensitive" } } },
            { game: { name: { contains: query, mode: "insensitive" } } },
            { server: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const userWhere: Prisma.UserWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(userStatus ? { status: userStatus } : {}),
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const auditWhere: Prisma.AdminAuditLogWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(query
      ? {
          OR: [
            { action: { contains: query, mode: "insensitive" } },
            { targetType: { contains: query, mode: "insensitive" } },
            { targetId: { contains: query, mode: "insensitive" } },
            { reason: { contains: query, mode: "insensitive" } },
            { admin: { displayName: { contains: query, mode: "insensitive" } } },
            { admin: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [
    orderRows,
    disputeRows,
    depositRows,
    withdrawalRows,
    listingRows,
    userRows,
    auditRows,
    orderTotal,
    disputeTotal,
    depositTotal,
    withdrawalTotal,
    listingTotal,
    userTotal,
    auditTotal,
    games,
  ] = await Promise.all([
    shouldLoad(kind, "ORDERS")
      ? prisma.order.findMany({
          where: orderWhere,
          include: {
            buyer: true,
            seller: true,
            listing: { include: { game: true, server: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "DISPUTES")
      ? prisma.trustReport.findMany({
          where: reportWhere,
          include: { reporter: true, targetUser: true, order: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "WALLET")
      ? prisma.depositRequest.findMany({
          where: depositWhere,
          include: { user: true },
          orderBy: { requestedAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "WALLET")
      ? prisma.withdrawalRequest.findMany({
          where: withdrawalWhere,
          include: { user: true },
          orderBy: { requestedAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "LISTINGS")
      ? prisma.listing.findMany({
          where: listingWhere,
          include: { seller: true, game: true, server: true, inventory: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "USERS")
      ? prisma.user.findMany({
          where: userWhere,
          include: {
            wallet: true,
            _count: {
              select: {
                buyerOrders: true,
                sellerOrders: true,
                reportsMade: true,
                reportsReceived: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    shouldLoad(kind, "AUDIT")
      ? prisma.adminAuditLog.findMany({
          where: auditWhere,
          include: { admin: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    prisma.order.aggregate({ where: orderWhere, _count: true, _sum: { grossAmount: true, platformFeeAmount: true } }),
    prisma.trustReport.count({ where: reportWhere }),
    prisma.depositRequest.aggregate({ where: depositWhere, _sum: { amount: true }, _count: true }),
    prisma.withdrawalRequest.aggregate({ where: withdrawalWhere, _sum: { amount: true }, _count: true }),
    prisma.listing.count({ where: listingWhere }),
    prisma.user.count({ where: userWhere }),
    prisma.adminAuditLog.count({ where: auditWhere }),
    prisma.game.findMany({
      orderBy: { name: "asc" },
      include: { servers: { orderBy: { name: "asc" } } },
    }),
  ]);

  const selectedGame = games.find((game) => game.id === gameId);
  const selectedServer = selectedGame?.servers.find((server) => server.id === serverId);
  const orders = orderRows.map((order) => ({
    id: order.id,
    number: order.orderNumber,
    status: orderStatusLabel(order.status),
    rawStatus: order.status,
    buyer: order.buyer.displayName,
    seller: order.seller.displayName,
    title: order.listing.title,
    game: order.listing.game.name,
    server: order.listing.server?.name ?? "-",
    category: categoryLabel(order.listing.category),
    grossAmount: `${order.grossAmount.toString()} ${order.currency}`,
    fee: `${order.platformFeeAmount.toString()} ${order.currency}`,
    grossAmountValue: Number(order.grossAmount),
    platformFeeValue: Number(order.platformFeeAmount),
    createdAt: formatDateTime(order.createdAt),
    createdDate: toDateInputValue(order.createdAt),
    completedAt: order.completedAt ? formatDateTime(order.completedAt) : "-",
  }));
  const disputes = disputeRows.map((report) => ({
    id: report.id,
    status: trustReportStatusLabel(report.status),
    rawStatus: report.status,
    severity: report.severity,
    category: report.category,
    reporter: report.reporter.displayName,
    target: report.targetUser.displayName,
    orderNumber: report.order?.orderNumber ?? "-",
    createdAt: formatDateTime(report.createdAt),
    createdDate: toDateInputValue(report.createdAt),
    resolvedAt: report.resolvedAt ? formatDateTime(report.resolvedAt) : "-",
  }));
  const walletRequests = [
    ...depositRows.map((request) => ({
      id: request.id,
      kind: "충전",
      status: depositStatusLabel(request.status),
      rawStatus: request.status,
      user: request.user.displayName,
      amount: `${request.amount.toString()} ${request.currency}`,
      amountValue: Number(request.amount),
      provider: request.provider,
      reference: request.providerTxId ?? request.depositCode ?? "-",
      requestedAt: formatDateTime(request.requestedAt),
      requestedDate: toDateInputValue(request.requestedAt),
    })),
    ...withdrawalRows.map((request) => ({
      id: request.id,
      kind: "출금",
      status: withdrawalStatusLabel(request.status),
      rawStatus: request.status,
      user: request.user.displayName,
      amount: `${request.amount.toString()} ${request.currency}`,
      amountValue: Number(request.amount),
      provider: request.provider,
      reference: maskMiddle(request.destination),
      requestedAt: formatDateTime(request.requestedAt),
      requestedDate: toDateInputValue(request.requestedAt),
    })),
  ].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const listings = listingRows.map((listing) => ({
    id: listing.id,
    status: listingStatusLabel(listing.status),
    rawStatus: listing.status,
    seller: listing.seller.displayName,
    title: listing.title,
    game: listing.game.name,
    server: listing.server?.name ?? "-",
    category: categoryLabel(listing.category),
    price: `${listing.unitPrice.toString()} ${listing.currency}`,
    quantity: listing.inventory?.availableQuantity.toString() ?? "-",
    createdAt: formatDateTime(listing.createdAt),
    createdDate: toDateInputValue(listing.createdAt),
  }));
  const users = userRows.map((user) => ({
    id: user.id,
    name: user.displayName,
    email: maskEmail(user.email),
    role: user.role,
    status: userStatusLabel(user.status),
    rawStatus: user.status,
    balance: user.wallet ? `${user.wallet.availableBalance.toString()} ${user.wallet.currency}` : "-",
    orders: user._count.buyerOrders + user._count.sellerOrders,
    reports: user._count.reportsMade + user._count.reportsReceived,
    createdAt: formatDateTime(user.createdAt),
    createdDate: toDateInputValue(user.createdAt),
  }));
  const adminActivity = auditRows.map((log) => ({
    id: log.id,
    admin: log.admin?.displayName ?? "System",
    email: log.admin?.email ? maskEmail(log.admin.email) : "-",
    role: log.admin?.role ?? "-",
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? "-",
    reason: log.reason ?? "-",
    sensitivity: isSensitiveAuditAction(log.action) ? "민감" : "일반",
    createdAt: formatDateTime(log.createdAt),
    createdDate: toDateInputValue(log.createdAt),
  }));

  return {
    filters: {
      kind,
      range,
      from: toDateInputValue(from),
      to: toDateInputValue(to),
      query,
      status,
      gameId,
      serverId,
    },
    filterOptions: {
      statuses: reportStatusOptions,
      games: games.map((game) => ({
        id: game.id,
        name: game.name,
        servers: game.servers.map((server) => ({ id: server.id, name: server.name })),
      })),
    },
    summary: {
      orderCount: orderTotal._count,
      disputeCount: disputeTotal,
      walletRequestCount: depositTotal._count + withdrawalTotal._count,
      listingCount: listingTotal,
      userCount: userTotal,
      adminActivityCount: auditTotal,
      grossAmount: formatAmount(Number(orderTotal._sum.grossAmount ?? 0)),
      platformFeeAmount: formatAmount(Number(orderTotal._sum.platformFeeAmount ?? 0)),
      depositAmount: formatAmount(Number(depositTotal._sum.amount ?? 0)),
      withdrawalAmount: formatAmount(Number(withdrawalTotal._sum.amount ?? 0)),
      fromLabel: formatDateTime(from),
      toLabel: formatDateTime(to),
      statusLabel: reportStatusOptions.find((option) => option.value === status)?.label ?? status,
      gameLabel: selectedGame?.name ?? "전체 게임",
      serverLabel: selectedServer?.name ?? "전체 서버",
      previewLimit: limit,
    },
    dailySummary: buildDailySummary({ orders, disputes, walletRequests, listings, users, adminActivity }),
    orders,
    disputes,
    walletRequests,
    listings,
    users,
    adminActivity,
    exportPlan: {
      filename: `ggitem-admin-all-${toDateInputValue(from)}_to_${toDateInputValue(to)}.xlsx`,
      sheets: ["요약", "날짜별 요약", "거래", "분쟁 신고", "충전 출금", "매물", "유저", "관리자 이력"],
    },
  };
}

export async function getAdminReportExportRows(
  filters?: AdminReportFilters,
): Promise<AdminReportExportRow[]> {
  const state = await getAdminReportsState({ ...filters, limit: EXPORT_LIMIT });
  const rows: AdminReportExportRow[] = [];

  if (state.filters.kind === "ALL" || state.filters.kind === "ORDERS") {
    rows.push(
      ...state.orders.map((order) => ({
        section: "거래",
        id: order.number,
        status: order.status,
        primary: order.title,
        secondary: [order.buyer, order.seller, order.game, order.server, `수수료 ${order.fee}`].join(" / "),
        amount: order.grossAmount,
        createdAt: order.createdAt,
      })),
    );
  }

  if (state.filters.kind === "ALL" || state.filters.kind === "DISPUTES") {
    rows.push(
      ...state.disputes.map((report) => ({
        section: "분쟁/신고",
        id: report.id,
        status: [report.status, report.severity].join(" / "),
        primary: report.category,
        secondary: [report.reporter, report.target, `주문 ${report.orderNumber}`].join(" / "),
        amount: "",
        createdAt: report.createdAt,
      })),
    );
  }

  if (state.filters.kind === "ALL" || state.filters.kind === "WALLET") {
    rows.push(
      ...state.walletRequests.map((request) => ({
        section: "입출금",
        id: request.id,
        status: [request.kind, request.status].join(" / "),
        primary: request.user,
        secondary: [request.provider, request.reference].join(" / "),
        amount: request.amount,
        createdAt: request.requestedAt,
      })),
    );
  }

  if (state.filters.kind === "ALL" || state.filters.kind === "LISTINGS") {
    rows.push(
      ...state.listings.map((listing) => ({
        section: "매물",
        id: listing.id,
        status: listing.status,
        primary: listing.title,
        secondary: [listing.seller, listing.game, listing.server, listing.category].join(" / "),
        amount: listing.price,
        createdAt: listing.createdAt,
      })),
    );
  }

  if (state.filters.kind === "ALL" || state.filters.kind === "USERS") {
    rows.push(
      ...state.users.map((user) => ({
        section: "유저",
        id: user.id,
        status: [roleLabel(user.role), user.status].join(" / "),
        primary: user.name,
        secondary: `${user.email} / 거래 ${user.orders}건 / 신고 ${user.reports}건`,
        amount: user.balance,
        createdAt: user.createdAt,
      })),
    );
  }

  if (state.filters.kind === "ALL" || state.filters.kind === "AUDIT") {
    rows.push(
      ...state.adminActivity.map((activity) => ({
        section: "관리자 이력",
        id: activity.id,
        status: [activity.sensitivity, roleLabel(activity.role)].join(" / "),
        primary: activity.action,
        secondary: [activity.admin, activity.targetType, activity.targetId, activity.reason].join(" / "),
        amount: "",
        createdAt: activity.createdAt,
      })),
    );
  }

  return rows;
}

export async function getAdminReportWorkbookSheets(
  filters?: AdminReportFilters,
): Promise<XlsxSheet[]> {
  const state = await getAdminReportsState({ ...filters, limit: EXPORT_LIMIT });

  return [
    {
      name: "요약",
      rows: [
        ["항목", "값"],
        ["데이터 종류", reportKindLabel(state.filters.kind)],
        ["날짜 범위", reportRangeLabel(state.filters.range)],
        ["시작", state.summary.fromLabel],
        ["종료", state.summary.toLabel],
        ["검색어", state.filters.query || "-"],
        ["상태", state.summary.statusLabel],
        ["게임", state.summary.gameLabel],
        ["서버", state.summary.serverLabel],
        ["거래 건수", state.summary.orderCount],
        ["총 거래액", `${state.summary.grossAmount} USDT`],
        ["플랫폼 수수료", `${state.summary.platformFeeAmount} USDT`],
        ["분쟁/신고", state.summary.disputeCount],
        ["입출금 요청", state.summary.walletRequestCount],
        ["충전액", `${state.summary.depositAmount} USDT`],
        ["출금액", `${state.summary.withdrawalAmount} USDT`],
        ["매물", state.summary.listingCount],
        ["신규 유저", state.summary.userCount],
        ["관리자 업무 이력", state.summary.adminActivityCount],
      ],
    },
    {
      name: "날짜별 요약",
      rows: [
        ["날짜", "거래", "거래액", "플랫폼 수수료", "분쟁/신고", "입출금", "매물", "신규 유저", "관리자 업무"],
        ...state.dailySummary.map((row) => [
          row.date,
          row.orders,
          row.grossAmount,
          row.platformFeeAmount,
          row.disputes,
          row.walletRequests,
          row.listings,
          row.users,
          row.adminActivity,
        ]),
      ],
    },
    {
      name: "거래",
      rows: [
        ["주문번호", "상태", "상품", "구매자", "판매자", "게임", "서버", "유형", "금액", "수수료", "생성일", "완료일"],
        ...state.orders.map((order) => [
          order.number,
          order.status,
          order.title,
          order.buyer,
          order.seller,
          order.game,
          order.server,
          order.category,
          order.grossAmount,
          order.fee,
          order.createdAt,
          order.completedAt,
        ]),
      ],
    },
    {
      name: "분쟁 신고",
      rows: [
        ["ID", "상태", "심각도", "분류", "신고자", "대상", "주문번호", "접수일", "종료일"],
        ...state.disputes.map((report) => [
          report.id,
          report.status,
          report.severity,
          report.category,
          report.reporter,
          report.target,
          report.orderNumber,
          report.createdAt,
          report.resolvedAt,
        ]),
      ],
    },
    {
      name: "입출금",
      rows: [
        ["ID", "구분", "상태", "유저", "금액", "수단", "참조", "요청일"],
        ...state.walletRequests.map((request) => [
          request.id,
          request.kind,
          request.status,
          request.user,
          request.amount,
          request.provider,
          request.reference,
          request.requestedAt,
        ]),
      ],
    },
    {
      name: "매물",
      rows: [
        ["ID", "상태", "판매자", "제목", "게임", "서버", "유형", "가격", "재고", "등록일"],
        ...state.listings.map((listing) => [
          listing.id,
          listing.status,
          listing.seller,
          listing.title,
          listing.game,
          listing.server,
          listing.category,
          listing.price,
          listing.quantity,
          listing.createdAt,
        ]),
      ],
    },
    {
      name: "유저",
      rows: [
        ["ID", "이름", "이메일", "권한", "상태", "잔액", "거래 건수", "신고/분쟁 건수", "가입일"],
        ...state.users.map((user) => [
          user.id,
          user.name,
          user.email,
          roleLabel(user.role),
          user.status,
          user.balance,
          user.orders,
          user.reports,
          user.createdAt,
        ]),
      ],
    },
    {
      name: "관리자 이력",
      rows: [
        ["ID", "관리자", "이메일", "권한", "작업", "대상", "대상 ID", "사유", "민감도", "일시"],
        ...state.adminActivity.map((activity) => [
          activity.id,
          activity.admin,
          activity.email,
          roleLabel(activity.role),
          activity.action,
          activity.targetType,
          activity.targetId,
          activity.reason,
          activity.sensitivity,
          activity.createdAt,
        ]),
      ],
    },
  ];
}

function buildDailySummary(input: {
  orders: Array<{ createdDate: string; grossAmountValue: number; platformFeeValue: number }>;
  disputes: Array<{ createdDate: string }>;
  walletRequests: Array<{ requestedDate: string }>;
  listings: Array<{ createdDate: string }>;
  users: Array<{ createdDate: string }>;
  adminActivity: Array<{ createdDate: string }>;
}) {
  const rows = new Map<
    string,
    {
      date: string;
      orders: number;
      grossAmount: number;
      platformFeeAmount: number;
      disputes: number;
      walletRequests: number;
      listings: number;
      users: number;
      adminActivity: number;
    }
  >();
  const ensure = (date: string) => {
    const current =
      rows.get(date) ??
      {
        date,
        orders: 0,
        grossAmount: 0,
        platformFeeAmount: 0,
        disputes: 0,
        walletRequests: 0,
        listings: 0,
        users: 0,
        adminActivity: 0,
      };
    rows.set(date, current);
    return current;
  };

  input.orders.forEach((order) => {
    const row = ensure(order.createdDate);
    row.orders += 1;
    row.grossAmount += order.grossAmountValue;
    row.platformFeeAmount += order.platformFeeValue;
  });
  input.disputes.forEach((dispute) => {
    ensure(dispute.createdDate).disputes += 1;
  });
  input.walletRequests.forEach((request) => {
    ensure(request.requestedDate).walletRequests += 1;
  });
  input.listings.forEach((listing) => {
    ensure(listing.createdDate).listings += 1;
  });
  input.users.forEach((user) => {
    ensure(user.createdDate).users += 1;
  });
  input.adminActivity.forEach((activity) => {
    ensure(activity.createdDate).adminActivity += 1;
  });

  return [...rows.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => ({
      ...row,
      grossAmount: formatAmount(row.grossAmount),
      platformFeeAmount: formatAmount(row.platformFeeAmount),
    }));
}

function shouldLoad(kind: ReportKind, target: Exclude<ReportKind, "ALL">) {
  return kind === "ALL" || kind === target;
}

function normalizeKind(kind?: string | null): ReportKind {
  const value = kind?.trim().toUpperCase();
  if (
    value === "ORDERS" ||
    value === "DISPUTES" ||
    value === "WALLET" ||
    value === "LISTINGS" ||
    value === "USERS" ||
    value === "AUDIT"
  ) {
    return value;
  }
  return "ALL";
}

function normalizeRange(range?: string | null): ReportRange {
  return range === "today" || range === "7d" || range === "30d" || range === "custom" ? range : "7d";
}

function normalizeStatus(status?: string | null) {
  const value = status?.trim().toUpperCase();
  return value && value !== "ALL" ? value : "ALL";
}

function getAllowedStatus<T extends string>(status: string, allowed: readonly T[]) {
  return allowed.includes(status as T) ? (status as T) : null;
}

function getReportRange(range: ReportRange, fromValue?: string | null, toValue?: string | null) {
  const now = new Date();
  const to = new Date(now);

  if (range === "custom" && fromValue && toValue) {
    const from = new Date(`${fromValue}T00:00:00.000`);
    const customTo = new Date(`${toValue}T23:59:59.999`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(customTo.getTime())) {
      return { from, to: customTo };
    }
  }

  const from = new Date(now);
  if (range === "today") {
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  from.setDate(from.getDate() - (range === "30d" ? 30 : 7));
  return { from, to };
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return maskMiddle(email);
  return `${maskMiddle(name)}@${domain}`;
}

function maskMiddle(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isSensitiveAuditAction(action: string) {
  return SENSITIVE_AUDIT_ACTIONS.some((sensitiveAction) => action.includes(sensitiveAction));
}

function reportKindLabel(kind: string) {
  const labels: Record<string, string> = {
    ALL: "전체",
    ORDERS: "거래",
    DISPUTES: "분쟁/신고",
    WALLET: "입출금",
    LISTINGS: "매물",
    USERS: "유저",
    AUDIT: "관리자 이력",
  };
  return labels[kind] ?? kind;
}

function reportRangeLabel(range: string) {
  const labels: Record<string, string> = {
    today: "오늘",
    "7d": "최근 7일",
    "30d": "최근 30일",
    custom: "직접 선택",
  };
  return labels[range] ?? range;
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    GAME_MONEY: "게임머니",
    GAME_ITEM: "아이템",
    GAME_ACCOUNT: "계정",
  };
  return labels[category] ?? category;
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "주문 요청",
    ESCROW_LOCKED: "에스크로 잠금",
    SELLER_RESPONSE_PENDING: "판매자 응답 대기",
    DELIVERY_IN_PROGRESS: "전달 진행",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수확정 대기",
    COMPLETED: "거래 완료",
    CANCELED: "취소",
    DISPUTED: "분쟁",
    REFUNDED: "환불",
  };
  return labels[status] ?? status;
}

function listingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "초안",
    ACTIVE: "판매중",
    PAUSED: "일시중지",
    SOLD_OUT: "품절",
    HIDDEN: "숨김",
    REMOVED: "삭제",
  };
  return labels[status] ?? status;
}

function trustReportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "접수",
    UNDER_REVIEW: "검토중",
    RESOLVED: "해결",
    DISMISSED: "기각",
  };
  return labels[status] ?? status;
}

function depositStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "대기",
    CONFIRMED: "확인",
    REJECTED: "반려",
    EXPIRED: "만료",
    CANCELED: "취소",
  };
  return labels[status] ?? status;
}

function withdrawalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청",
    UNDER_REVIEW: "검토중",
    APPROVED: "승인",
    SENT: "송금",
    COMPLETED: "완료",
    REJECTED: "거절",
    CANCELED: "취소",
  };
  return labels[status] ?? status;
}

function userStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
  };
  return labels[status] ?? status;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    USER: "유저",
    ADMIN: "관리자",
    SUPER: "최고관리자",
    FINANCE: "재무",
    CS: "CS",
    MODERATOR: "운영자",
  };
  return labels[role] ?? role;
}
