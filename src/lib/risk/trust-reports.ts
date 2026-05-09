import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

const reportCategories = [
  "FRAUD",
  "NO_DELIVERY",
  "WRONG_ITEM",
  "ABUSIVE_CHAT",
  "OFF_PLATFORM_PAYMENT",
  "OTHER",
];

export type TrustReportCreateResult = {
  reportId: string;
  status: string;
  message: string;
};

export async function createTrustReport(input: {
  orderId: string;
  category: string;
  description: string;
}): Promise<TrustReportCreateResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();
  const category = input.category.trim().toUpperCase();
  const description = input.description.trim();

  if (!sessionUser || !["CUSTOMER", "SELLER"].includes(sessionUser.role)) {
    throw new Error("거래 참여자만 신고를 접수할 수 있습니다.");
  }

  if (!reportCategories.includes(category)) {
    throw new Error("올바른 신고 유형을 선택해 주세요.");
  }

  if (description.length < 10) {
    throw new Error("신고 내용은 10자 이상 입력해 주세요.");
  }

  if (description.length > 2000) {
    throw new Error("신고 내용은 2,000자 이하로 입력해 주세요.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      OR: [
        {
          buyerId: sessionUser.userId,
        },
        {
          sellerId: sessionUser.userId,
        },
      ],
    },
    include: {
      buyer: true,
      seller: true,
      listing: true,
    },
  });

  if (!order) {
    throw new Error("이 계정에서 확인할 수 있는 주문이 아닙니다.");
  }

  const targetUserId =
    sessionUser.userId === order.buyerId ? order.sellerId : order.buyerId;

  const existingOpenReport = await prisma.trustReport.findFirst({
    where: {
      reporterId: sessionUser.userId,
      targetUserId,
      orderId: order.id,
      status: {
        in: ["OPEN", "UNDER_REVIEW"],
      },
    },
  });

  if (existingOpenReport) {
    throw new Error("이미 이 주문에 대해 처리 중인 신고가 있습니다.");
  }

  const report = await prisma.trustReport.create({
    data: {
      reporterId: sessionUser.userId,
      targetUserId,
      orderId: order.id,
      category,
      severity: inferSeverity(category),
      description,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      action: "TRUST_REPORT_CREATED",
      targetType: "TRUST_REPORT",
      targetId: report.id,
      reason: `${category} report submitted for order ${order.orderNumber}`,
      after: {
        reporterId: sessionUser.userId,
        targetUserId,
        orderId: order.id,
        category,
        status: report.status,
      },
    },
  });

  return {
    reportId: report.id,
    status: report.status,
    message: "신고가 접수되었습니다. 관리자가 내용을 확인합니다.",
  };
}

function inferSeverity(category: string) {
  if (["FRAUD", "OFF_PLATFORM_PAYMENT"].includes(category)) {
    return "HIGH";
  }

  if (["NO_DELIVERY", "ABUSIVE_CHAT"].includes(category)) {
    return "MEDIUM";
  }

  return "LOW";
}
