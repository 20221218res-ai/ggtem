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
    "외부 연락처, SNS, 이메일, 개인 지갑주소, 외부거래 유도 문구는 보낼 수 없습니다. 안전한 거래를 위해 GGtem 채팅과 에스크로 안에서만 진행해 주세요.",
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

  try {
    await prisma.trustReport.create({
      data: {
        reporterId: input.context.actorUserId,
        targetUserId: input.context.targetUserId,
        orderId: input.context.orderId,
        category: "OFF_PLATFORM_PAYMENT",
        severity: "HIGH",
        sourceType: "OFF_PLATFORM_CONTACT",
        sourceId: `${input.context.sourceType}:${sourceId}:${contentHash}`,
        description: `외부거래 또는 외부 연락처 교환 시도가 자동 탐지되었습니다. 탐지 항목: ${labels}`,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
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
