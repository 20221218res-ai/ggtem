import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export type OffPlatformSignal = {
  code: string;
  label: string;
};

export type OffPlatformContactDetection = {
  blocked: boolean;
  signals: OffPlatformSignal[];
};

export type OffPlatformContactContext = {
  actorUserId: string;
  targetUserId?: string | null;
  orderId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  contentKind: "CHAT" | "LISTING" | "BUY_REQUEST";
};

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const urlPattern =
  /(?:https?:\/\/|www\.|open\.kakao|t\.me\/|telegram\.me|discord\.gg|line\.me|instagram\.com|facebook\.com|twitter\.com|x\.com)/i;
const messengerPattern =
  /(카톡|카카오|오픈채팅|텔레그램|텔레\b|라인\b|디스코드|위챗|wechat|kakao|telegram|discord|line id|문자|전화|휴대폰|핸드폰|연락처)/i;
const offPlatformTradePattern =
  /(외부거래|직거래|밖에서\s*거래|수수료\s*없이|수수료\s*빼고|사이트\s*밖|따로\s*거래|개인\s*거래)/i;
const cryptoAddressPattern =
  /\bT[1-9A-HJ-NP-Za-km-z]{33}\b|\b0x[a-fA-F0-9]{40}\b/;

export function detectOffPlatformContact(
  text: string,
): OffPlatformContactDetection {
  const normalizedText = text.trim();
  const signals: OffPlatformSignal[] = [];

  addSignalIf(signals, emailPattern.test(normalizedText), "EMAIL", "이메일 주소");
  addSignalIf(signals, urlPattern.test(normalizedText), "EXTERNAL_URL", "외부 링크");
  addSignalIf(
    signals,
    containsPhoneNumber(normalizedText),
    "PHONE",
    "전화번호",
  );
  addSignalIf(
    signals,
    messengerPattern.test(normalizedText),
    "MESSENGER",
    "외부 메신저/연락처",
  );
  addSignalIf(
    signals,
    offPlatformTradePattern.test(normalizedText),
    "OFF_PLATFORM_TRADE",
    "외부거래 유도",
  );
  addSignalIf(
    signals,
    cryptoAddressPattern.test(normalizedText),
    "CRYPTO_ADDRESS",
    "코인지갑 주소",
  );

  return {
    blocked: signals.length > 0,
    signals,
  };
}

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
    "외부 연락처, SNS, 이메일, 코인지갑 주소, 외부거래 유도 문구는 보낼 수 없습니다. 안전한 거래를 위해 GGtem 채팅과 에스크로 안에서만 진행해 주세요.",
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
      reason: `외부거래 단속 감지: ${labels}`,
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
        description: `외부거래 또는 외부 연락처 교환 시도가 자동 감지되었습니다. 감지 항목: ${labels}`,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
}

function addSignalIf(
  signals: OffPlatformSignal[],
  condition: boolean,
  code: string,
  label: string,
) {
  if (condition) {
    signals.push({ code, label });
  }
}

function containsPhoneNumber(text: string) {
  const candidates = text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? [];

  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");

    if (digits.length < 8 || digits.length > 15) {
      return false;
    }

    return (
      digits.startsWith("010") ||
      digits.startsWith("011") ||
      digits.startsWith("016") ||
      digits.startsWith("017") ||
      digits.startsWith("018") ||
      digits.startsWith("019") ||
      digits.startsWith("82")
    );
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
