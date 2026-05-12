import type { Prisma } from "@/generated/prisma/client";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export type UserNotificationInput = {
  userId: string;
  type:
    | "CHAT_MESSAGE"
    | "ORDER_STATUS"
    | "DISPUTE_UPDATE"
    | "WALLET_UPDATE"
    | "SYSTEM";
  title: string;
  body: string;
  href?: string;
  metadata?: Prisma.InputJsonValue;
};

export type MyNotificationsView = {
  currentUser: {
    userId: string;
    displayName: string;
    role: string;
  };
  summary: {
    unreadCount: number;
    totalCount: number;
  };
  notifications: Array<{
    notificationId: string;
    type: string;
    title: string;
    body: string;
    href: string | null;
    isRead: boolean;
    createdAt: string;
  }>;
};

export type PriorityNotificationItem = MyNotificationsView["notifications"][number];

export async function createUserNotification(input: UserNotificationInput) {
  const prisma = getPrismaClient();
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      metadata: input.metadata,
    },
  });
}

export async function getUnreadNotificationCount() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return 0;
  }

  return getUnreadNotificationCountForUser(sessionUser.userId);
}

export async function getUnreadNotificationCountForUser(userId: string) {
  const prisma = getPrismaClient();

  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function getMyNotificationsView(): Promise<MyNotificationsView | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return null;
  }

  const [notifications, statusGroups] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: sessionUser.userId,
      },
      orderBy: [
        {
          isRead: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.groupBy({
      by: ["isRead"],
      where: {
        userId: sessionUser.userId,
      },
      _count: { _all: true },
    }),
  ]);
  const totalCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const unreadCount = statusGroups.find((group) => !group.isRead)?._count._all ?? 0;

  return {
    currentUser: {
      userId: sessionUser.userId,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    },
    summary: {
      unreadCount,
      totalCount,
    },
    notifications: notifications.map((item) => ({
      notificationId: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href,
      isRead: item.isRead,
      createdAt: formatKoreanDate(item.createdAt),
    })),
  };
}

export async function getPriorityNotification(
  dismissedId?: string | null,
): Promise<PriorityNotificationItem | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return null;
  }

  const notification = await prisma.notification.findFirst({
    where: {
      userId: sessionUser.userId,
      isRead: false,
      type: {
        in: ["CHAT_MESSAGE", "ORDER_STATUS"],
      },
      ...(dismissedId
        ? {
            id: {
              not: dismissedId,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      isRead: true,
      createdAt: true,
    },
  });

  if (!notification) {
    return null;
  }

  return {
    notificationId: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    isRead: notification.isRead,
    createdAt: formatKoreanDate(notification.createdAt),
  };
}

export async function getNotificationsLiveSignature(): Promise<string | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return null;
  }

  const [latestNotification, statusGroups] = await Promise.all([
    prisma.notification.findFirst({
      where: {
        userId: sessionUser.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
        isRead: true,
        readAt: true,
      },
    }),
    prisma.notification.groupBy({
      by: ["isRead"],
      where: {
        userId: sessionUser.userId,
      },
      _count: { _all: true },
    }),
  ]);
  const totalCount = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const unreadCount = statusGroups.find((group) => !group.isRead)?._count._all ?? 0;

  return JSON.stringify({
    latestNotificationId: latestNotification?.id ?? null,
    latestNotificationAt: latestNotification?.createdAt.toISOString() ?? null,
    latestReadAt: latestNotification?.readAt?.toISOString() ?? null,
    latestIsRead: latestNotification?.isRead ?? null,
    unreadCount,
    totalCount,
  });
}

export async function markNotificationAsRead(notificationId: string) {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: sessionUser.userId,
    },
  });

  if (!notification) {
    throw new Error("알림을 찾을 수 없습니다.");
  }

  if (notification.isRead) {
    return {
      notificationId: notification.id,
      message: "이미 읽음 처리된 알림입니다.",
    };
  }

  await prisma.notification.update({
    where: {
      id: notification.id,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    notificationId: notification.id,
    message: "알림을 읽음 처리했습니다.",
  };
}

export async function markAllNotificationsAsRead() {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  await prisma.notification.updateMany({
    where: {
      userId: sessionUser.userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    message: "모든 알림을 읽음 처리했습니다.",
  };
}
function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}
