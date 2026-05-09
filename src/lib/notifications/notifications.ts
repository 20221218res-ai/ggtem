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
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return 0;
  }

  return prisma.notification.count({
    where: {
      userId: sessionUser.userId,
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

  const notifications = await prisma.notification.findMany({
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
  });

  return {
    currentUser: {
      userId: sessionUser.userId,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    },
    summary: {
      unreadCount: notifications.filter((item) => !item.isRead).length,
      totalCount: notifications.length,
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

export async function getNotificationsLiveSignature(): Promise<string | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return null;
  }

  const [latestNotification, unreadCount, totalCount] = await Promise.all([
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
    prisma.notification.count({
      where: {
        userId: sessionUser.userId,
        isRead: false,
      },
    }),
    prisma.notification.count({
      where: {
        userId: sessionUser.userId,
      },
    }),
  ]);

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
