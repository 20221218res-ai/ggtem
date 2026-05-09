import { getPrismaClient } from "@/lib/prisma";

export type LinkedAccountSignalType =
  | "WITHDRAWAL_ADDRESS"
  | "WITHDRAWAL_IP"
  | "WITHDRAWAL_DEVICE"
  | "LOGIN_IP";

export type LinkedAccountSignal = {
  signalType: LinkedAccountSignalType;
  label: string;
  value: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  relatedUserCount: number;
  lastSeenAt: string;
  relatedUsers: Array<{
    userId: string;
    email: string;
    displayName: string;
    status: string;
    lastSeenAt: string;
  }>;
};

type RawRelatedUser = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  seenAt: Date;
};

export async function getLinkedAccountSignalsForUser(
  userId: string,
): Promise<LinkedAccountSignal[]> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return [];
  }

  const [withdrawals, loginAttempts] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where: {
        userId: user.id,
      },
      select: {
        destination: true,
        requestIpKey: true,
        deviceKey: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
      take: 50,
    }),
    prisma.loginAttempt.findMany({
      where: {
        email: user.email,
        ipKey: {
          not: "unknown",
        },
      },
      select: {
        ipKey: true,
      },
      take: 20,
    }),
  ]);

  const destinationValues = uniqueValues(
    withdrawals.map((item) => normalizeAddress(item.destination)),
  );
  const withdrawalIpValues = uniqueValues(
    withdrawals.map((item) => normalizeNullable(item.requestIpKey)),
  );
  const withdrawalDeviceValues = uniqueValues(
    withdrawals.map((item) => normalizeNullable(item.deviceKey)),
  );
  const loginIpValues = uniqueValues(
    loginAttempts.map((item) => normalizeNullable(item.ipKey)),
  );

  const signals = await Promise.all([
    ...destinationValues.map((value) =>
      buildWithdrawalSignal(user.id, "WITHDRAWAL_ADDRESS", value),
    ),
    ...withdrawalIpValues.map((value) =>
      buildWithdrawalSignal(user.id, "WITHDRAWAL_IP", value),
    ),
    ...withdrawalDeviceValues.map((value) =>
      buildWithdrawalSignal(user.id, "WITHDRAWAL_DEVICE", value),
    ),
    ...loginIpValues.map((value) => buildLoginIpSignal(user.email, value)),
  ]);

  return signals
    .filter((signal): signal is LinkedAccountSignal => Boolean(signal))
    .sort((left, right) => {
      const riskWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (
        riskWeight[right.riskLevel] - riskWeight[left.riskLevel] ||
        right.relatedUserCount - left.relatedUserCount
      );
    })
    .slice(0, 12);
}

async function buildWithdrawalSignal(
  userId: string,
  signalType: Exclude<LinkedAccountSignalType, "LOGIN_IP">,
  value: string,
) {
  const prisma = getPrismaClient();
  const where =
    signalType === "WITHDRAWAL_ADDRESS"
      ? { destination: { equals: value, mode: "insensitive" as const } }
      : signalType === "WITHDRAWAL_IP"
        ? { requestIpKey: value }
        : { deviceKey: value };
  const rows = await prisma.withdrawalRequest.findMany({
    where: {
      ...where,
      userId: {
        not: userId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
    orderBy: {
      requestedAt: "desc",
    },
    take: 30,
  });

  return buildSignal(
    signalType,
    value,
    rows.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      displayName: row.user.displayName,
      status: row.user.status,
      seenAt: row.requestedAt,
    })),
  );
}

async function buildLoginIpSignal(email: string, ipKey: string) {
  const prisma = getPrismaClient();
  const attempts = await prisma.loginAttempt.findMany({
    where: {
      ipKey,
      email: {
        not: email,
      },
    },
    select: {
      email: true,
      lastSuccessAt: true,
      lastFailedAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 30,
  });

  if (attempts.length === 0) {
    return null;
  }

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: attempts.map((attempt) => attempt.email),
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
    },
  });
  const userMap = new Map(users.map((user) => [user.email, user]));

  const relatedUsers: RawRelatedUser[] = [];

  for (const attempt of attempts) {
    const user = userMap.get(attempt.email);

    if (!user) {
      continue;
    }

    relatedUsers.push({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      seenAt: attempt.lastSuccessAt ?? attempt.lastFailedAt ?? attempt.updatedAt,
    });
  }

  return buildSignal("LOGIN_IP", ipKey, relatedUsers);
}

function buildSignal(
  signalType: LinkedAccountSignalType,
  value: string,
  relatedRows: RawRelatedUser[],
) {
  const relatedUsers = collapseRelatedUsers(relatedRows);

  if (relatedUsers.length === 0) {
    return null;
  }

  const lastSeenAt = new Date(
    Math.max(...relatedUsers.map((user) => user.seenAt.getTime())),
  );

  return {
    signalType,
    label: signalLabel(signalType),
    value: maskSignalValue(signalType, value),
    riskLevel: riskLevel(signalType, relatedUsers.length),
    relatedUserCount: relatedUsers.length,
    lastSeenAt: formatKoreanDate(lastSeenAt),
    relatedUsers: relatedUsers.slice(0, 6).map((user) => ({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      lastSeenAt: formatKoreanDate(user.seenAt),
    })),
  };
}

function collapseRelatedUsers(rows: RawRelatedUser[]) {
  const map = new Map<string, RawRelatedUser>();

  for (const row of rows) {
    const current = map.get(row.userId);

    if (!current || current.seenAt < row.seenAt) {
      map.set(row.userId, row);
    }
  }

  return Array.from(map.values()).sort(
    (left, right) => right.seenAt.getTime() - left.seenAt.getTime(),
  );
}

function riskLevel(signalType: LinkedAccountSignalType, relatedUserCount: number) {
  if (signalType === "WITHDRAWAL_ADDRESS") {
    return relatedUserCount >= 2 ? "HIGH" : "MEDIUM";
  }

  if (signalType === "WITHDRAWAL_DEVICE") {
    return relatedUserCount >= 2 ? "HIGH" : "MEDIUM";
  }

  if (relatedUserCount >= 3) {
    return "MEDIUM";
  }

  return "LOW";
}

function signalLabel(signalType: LinkedAccountSignalType) {
  if (signalType === "WITHDRAWAL_ADDRESS") return "동일 출금 주소";
  if (signalType === "WITHDRAWAL_DEVICE") return "동일 출금 기기";
  if (signalType === "WITHDRAWAL_IP") return "동일 출금 IP";
  return "동일 로그인 IP";
}

function maskSignalValue(signalType: LinkedAccountSignalType, value: string) {
  if (signalType === "WITHDRAWAL_ADDRESS" && value.length > 14) {
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
  }

  return value;
}

function uniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeNullable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized !== "unknown" ? normalized : null;
}

function normalizeAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}
