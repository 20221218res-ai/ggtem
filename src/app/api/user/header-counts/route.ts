import { NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const BADGE_COUNT_LIMIT = 100;

export async function GET() {
  const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);

  if (!auth.ok) {
    return auth.response;
  }

  const prisma = getPrismaClient();
  const [unreadChatRows, unreadNotificationRows] = await Promise.all([
    prisma.chatMessage.findMany({
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
      take: BADGE_COUNT_LIMIT,
      select: {
        id: true,
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: auth.user.userId,
        isRead: false,
      },
      take: BADGE_COUNT_LIMIT,
      select: {
        id: true,
      },
    }),
  ]);

  return NextResponse.json({
    unreadChatCount: unreadChatRows.length,
    unreadNotificationCount: unreadNotificationRows.length,
  });
}
