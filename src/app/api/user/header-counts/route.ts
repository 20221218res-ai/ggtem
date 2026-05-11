import { NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);

  if (!auth.ok) {
    return auth.response;
  }

  const prisma = getPrismaClient();
  const [unreadChatCount, unreadNotificationCount] = await Promise.all([
    prisma.chatMessage.count({
      where: {
        senderId: { not: auth.user.userId },
        readAt: null,
        room: {
          OR: [
            { buyerId: auth.user.userId },
            { sellerId: auth.user.userId },
          ],
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId: auth.user.userId,
        isRead: false,
      },
    }),
  ]);

  return NextResponse.json({
    unreadChatCount,
    unreadNotificationCount,
  });
}
