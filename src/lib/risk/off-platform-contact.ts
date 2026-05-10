import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  detectOffPlatformContact,
  type OffPlatformContactDetection,
  type OffPlatformSignal,
} from "@/lib/risk/off-platform-detector";
import { getPrismaClient } from "@/lib/prisma";

export { detectOffPlatformContact };
export type { OffPlatformContactDetection, OffPlatformSignal };

const OFF_PLATFORM_ESCALATION_WINDOW_DAYS = 30;

export type OffPlatformContactContext = {
  actorUserId: string;
  targetUserId?: string | null;
  orderId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  contentKind: "CHAT" | "LISTING" | "BUY_REQUEST";
};

export async function assertNoOffPlatformContact(
  text: string,
  context: OffPlatformContactContext,
) {
  const detection = detectOffPlatformContact(text);

  if (!detection.blocked) {
    return;
  }

  await recordOffPlatformContactAttempt({
    text,
    detection,
    context,
  });

  throw new Error(
    "외부 연락처, SNS, 이메일, 개인 지갑주소, 외부거래 유도 문구는 보낼 수 없습니다. 반복 시 출금 보류 또는 계정 제한 검토 대상이 됩니다. 안전한 거래를 위해 GGtem 채팅과 에스크로 안에서만 진행해 주세요.",
  );
}

async function recordOffPlatformContactAttempt(input: {
  text: string;
  detection: OffPlatformContactDetection;
  context: OffPlatformContactContext;
}) {
  const prisma = getPrismaClient();
  const contentHash = hashContent(input.text);
  const sourceId =
    input.context.sourceId ??
    `${input.context.contentKind}:${input.context.actorUserId}:${contentHash}`;
  const labels = input.detection.signals.map((signal) => signal.label).join(", ");

  await prisma.adminAuditLog.create({
    data: {
      action: "OFF_PLATFORM_CONTACT_BLOCKED",
      targetType: input.context.sourceType,
      targetId: sourceId,
      reason: `외부거래/연락처 교환 시도 차단: ${labels}`,
      after: {
        actorUserId: input.context.actorUserId,
        targetUserId: input.context.targetUserId ?? null,
        orderId: input.context.orderId ?? null,
        contentKind: input.context.contentKind,
        signals: input.detection.signals,
        contentHash,
        preview: input.text.trim().slice(0, 120),
      },
    },
  });

  if (!input.context.targetUserId || !input.context.orderId) {
    return;
  }

  const reportSourceId = `${input.context.sourceType}:${sourceId}:${contentHash}`;

  try {
    await prisma.trustReport.create({
      data: {
        reporterId: input.context.actorUserId,
        targetUserId: input.context.targetUserId,
        orderId: input.context.orderId,
        category: "OFF_PLATFORM_PAYMENT",
        severity: "HIGH",
        sourceType: "OFF_PLATFORM_CONTACT",
        sourceId: reportSourceId,
        description: `외부거래 또는 외부 연락처 교환 시도가 자동 탐지되었습니다. 탐지 항목: ${labels}`,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  await applyOffPlatformEscalation({
    actorUserId: input.context.actorUserId,
    targetUserId: input.context.targetUserId,
    orderId: input.context.orderId,
    sourceId: reportSourceId,
    labels,
    preview: input.text.trim().slice(0, 120),
  });
}

async function applyOffPlatformEscalation(input: {
  actorUserId: string;
  targetUserId: string;
  orderId: string;
  sourceId: string;
  labels: string;
  preview: string;
}) {
  const prisma = getPrismaClient();
  const since = new Date(
    Date.now() - OFF_PLATFORM_ESCALATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [actor, attemptCount] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: input.actorUserId,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
      },
    }),
    prisma.trustReport.count({
      where: {
        reporterId: input.actorUserId,
        category: "OFF_PLATFORM_PAYMENT",
        sourceType: "OFF_PLATFORM_CONTACT",
        createdAt: {
          gte: since,
        },
      },
    }),
  ]);

  if (!actor) return;

  const stage =
    attemptCount >= 3 ? "WITHDRAWAL_HOLD_REVIEW" : attemptCount >= 2 ? "ADMIN_REVIEW" : "USER_WARNING";
  const title =
    stage === "WITHDRAWAL_HOLD_REVIEW"
      ? "외부거래 반복 시도로 출금 보류 검토 대상이 되었습니다."
      : stage === "ADMIN_REVIEW"
        ? "외부거래 반복 시도로 관리자 검토 대상이 되었습니다."
        : "외부거래 및 연락처 교환은 금지되어 있습니다.";
  const body =
    stage === "WITHDRAWAL_HOLD_REVIEW"
      ? "최근 30일 동안 외부거래 또는 연락처 교환 시도가 반복 감지되었습니다. 추가 확인 전까지 출금 보류가 적용될 수 있습니다."
      : stage === "ADMIN_REVIEW"
        ? "외부거래 또는 연락처 교환 시도가 반복 감지되어 운영자가 거래 기록을 확인합니다."
        : "안전한 거래를 위해 GGtem 채팅과 에스크로 안에서만 거래해 주세요.";

  await prisma.notification.create({
    data: {
      userId: actor.id,
      type: "SYSTEM",
      title,
      body,
      href: input.orderId ? `/my/orders/${input.orderId}/chat` : "/my/chat",
      metadata: {
        stage,
        attemptCount,
        orderId: input.orderId,
        sourceId: input.sourceId,
      },
    },
  });

  if (attemptCount >= 2) {
    const systemAdmin = await prisma.user.findFirst({
      where: {
        role: {
          in: ["SUPER", "ADMIN"],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (systemAdmin) {
      await prisma.adminUserNote.create({
        data: {
          userId: actor.id,
          adminId: systemAdmin.id,
          body: [
            "[AUTO] 외부거래/연락처 교환 반복 시도가 감지되었습니다.",
            `최근 ${OFF_PLATFORM_ESCALATION_WINDOW_DAYS}일 감지 횟수: ${attemptCount}회`,
            `탐지 항목: ${input.labels}`,
            `주문: ${input.orderId}`,
            `미리보기: ${input.preview}`,
            stage === "WITHDRAWAL_HOLD_REVIEW"
              ? "권장 조치: 채팅 내역 확인 후 출금 보류 또는 계정 제한 검토"
              : "권장 조치: 채팅 내역 확인 및 경고 유지",
          ].join("\n"),
        },
      });
    }
  }

  if (attemptCount >= 3 && actor.status === "ACTIVE") {
    await prisma.user.update({
      where: {
        id: actor.id,
      },
      data: {
        status: "WITHDRAWAL_HOLD",
      },
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      action: "OFF_PLATFORM_CONTACT_ESCALATED",
      targetType: "USER",
      targetId: actor.id,
      reason: `외부거래/연락처 교환 누적 제재 단계: ${stage}`,
      before: {
        status: actor.status,
      },
      after: {
        status:
          attemptCount >= 3 && actor.status === "ACTIVE"
            ? "WITHDRAWAL_HOLD"
            : actor.status,
        stage,
        attemptCount,
        orderId: input.orderId,
        sourceId: input.sourceId,
        targetUserId: input.targetUserId,
      },
    },
  });
}

function hashContent(text: string) {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 24);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
