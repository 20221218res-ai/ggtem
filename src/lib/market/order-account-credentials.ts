import { createUserNotification } from "@/lib/notifications/notifications";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import {
  decryptAccountCredentialPayload,
  encryptAccountCredentialPayload,
} from "@/lib/security/account-credential-crypto";

const SELLER_SUBMIT_ALLOWED_STATUSES = [
  "ESCROW_LOCKED",
  "SELLER_RESPONSE_PENDING",
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
];

const BUYER_REVEAL_ALLOWED_STATUSES = [
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
  "COMPLETED",
];

export type OrderAccountCredentialView = {
  orderId: string;
  isAccountOrder: boolean;
  role: "BUYER" | "SELLER" | null;
  exists: boolean;
  canSubmit: boolean;
  canReveal: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  buyerFirstViewedAt: string | null;
  buyerViewCount: number;
  accountId?: string;
  password?: string;
  note?: string | null;
};

export async function getOrderAccountCredentialView(input: {
  orderId: string;
  reveal?: boolean;
}): Promise<OrderAccountCredentialView> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      OR: [{ buyerId: sessionUser.userId }, { sellerId: sessionUser.userId }],
    },
    include: {
      listing: true,
      accountCredential: true,
    },
  });

  if (!order) {
    throw new Error("주문을 찾을 수 없습니다.");
  }

  const role =
    sessionUser.userId === order.sellerId
      ? "SELLER"
      : sessionUser.userId === order.buyerId
        ? "BUYER"
        : null;
  const isAccountOrder = order.listing.category === "GAME_ACCOUNT";
  const canSubmit =
    isAccountOrder &&
    role === "SELLER" &&
    SELLER_SUBMIT_ALLOWED_STATUSES.includes(order.status);
  const canReveal =
    isAccountOrder &&
    role === "BUYER" &&
    Boolean(order.accountCredential) &&
    BUYER_REVEAL_ALLOWED_STATUSES.includes(order.status);

  const baseView: OrderAccountCredentialView = {
    orderId: order.id,
    isAccountOrder,
    role,
    exists: Boolean(order.accountCredential),
    canSubmit,
    canReveal,
    submittedAt: order.accountCredential
      ? formatKoreanDate(order.accountCredential.submittedAt)
      : null,
    updatedAt: order.accountCredential
      ? formatKoreanDate(order.accountCredential.updatedAt)
      : null,
    buyerFirstViewedAt: order.accountCredential?.buyerFirstViewedAt
      ? formatKoreanDate(order.accountCredential.buyerFirstViewedAt)
      : null,
    buyerViewCount: order.accountCredential?.buyerViewCount ?? 0,
  };

  if (!input.reveal || !canReveal || !order.accountCredential) {
    return baseView;
  }

  const payload = decryptAccountCredentialPayload(
    order.accountCredential.encryptedPayload,
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orderAccountCredential.update({
      where: {
        orderId: order.id,
      },
      data: {
        buyerFirstViewedAt: order.accountCredential?.buyerFirstViewedAt ?? now,
        buyerLastViewedAt: now,
        buyerViewCount: {
          increment: 1,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        action: "ORDER_ACCOUNT_CREDENTIAL_VIEWED",
        targetType: "ORDER",
        targetId: order.id,
        reason: "구매자가 계정거래 전달 정보를 열람했습니다.",
        after: {
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          orderNumber: order.orderNumber,
        },
      },
    });
  });

  return {
    ...baseView,
    buyerFirstViewedAt: baseView.buyerFirstViewedAt ?? formatKoreanDate(now),
    buyerViewCount: baseView.buyerViewCount + 1,
    accountId: payload.accountId,
    password: payload.password,
    note: payload.note,
  };
}

export async function submitOrderAccountCredential(input: {
  orderId: string;
  accountId: string;
  password: string;
  note?: string | null;
}) {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const accountId = input.accountId.trim();
  const password = input.password.trim();
  const note = input.note?.trim() || null;

  if (!accountId || !password) {
    throw new Error("계정과 비밀번호를 모두 입력해 주세요.");
  }

  if (accountId.length > 200 || password.length > 200) {
    throw new Error("계정 또는 비밀번호가 너무 깁니다.");
  }

  if (note && note.length > 1000) {
    throw new Error("전달 메모는 1000자 이하로 입력해 주세요.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      sellerId: sessionUser.userId,
    },
    include: {
      listing: true,
    },
  });

  if (!order) {
    throw new Error("판매 주문을 찾을 수 없습니다.");
  }

  if (order.listing.category !== "GAME_ACCOUNT") {
    throw new Error("계정 거래 주문에만 계정 전달 정보를 등록할 수 있습니다.");
  }

  if (!SELLER_SUBMIT_ALLOWED_STATUSES.includes(order.status)) {
    throw new Error("에스크로 잠금 이후 진행 중인 주문에만 계정 전달 정보를 등록할 수 있습니다.");
  }

  const encryptedPayload = encryptAccountCredentialPayload({
    accountId,
    password,
    note,
  });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orderAccountCredential.upsert({
      where: {
        orderId: order.id,
      },
      create: {
        orderId: order.id,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
        encryptedPayload,
        sellerLastUpdatedAt: now,
      },
      update: {
        encryptedPayload,
        sellerLastUpdatedAt: now,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        message: "판매자가 계정거래 전달 정보를 보안 전달함에 등록했습니다.",
        metadata: {
          action: "ACCOUNT_CREDENTIAL_SUBMITTED",
          actor: "SELLER",
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        action: "ORDER_ACCOUNT_CREDENTIAL_SUBMITTED",
        targetType: "ORDER",
        targetId: order.id,
        reason: "판매자가 계정거래 전달 정보를 등록 또는 수정했습니다.",
        after: {
          sellerId: order.sellerId,
          buyerId: order.buyerId,
          orderNumber: order.orderNumber,
          hasNote: Boolean(note),
        },
      },
    });
  });

  await createUserNotification({
    userId: order.buyerId,
    type: "ORDER_STATUS",
    title: "계정 전달 정보가 등록되었습니다",
    body: "판매자가 계정거래 정보를 보안 전달함에 등록했습니다. 주문 상세에서 확인해 주세요.",
    href: `/my/orders/${order.id}`,
    metadata: {
      orderId: order.id,
      action: "ACCOUNT_CREDENTIAL_SUBMITTED",
    },
  });

  return {
    orderId: order.id,
    message: "계정 전달 정보를 보안 전달함에 저장했습니다.",
  };
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}
