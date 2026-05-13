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
  const [unreadChatCount, unreadNotificationCount, wallet] = await Promise.all([
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
    prisma.wallet.findUnique({
      where: { userId: auth.user.userId },
      select: {
        availableBalance: true,
        currency: true,
      },
    }),
  ]);

  return NextResponse.json({
    unreadChatCount: Math.min(unreadChatCount, BADGE_COUNT_LIMIT),
    unreadNotificationCount: Math.min(unreadNotificationCount, BADGE_COUNT_LIMIT),
    walletAvailableBalance: wallet?.availableBalance.toString() ?? "0",
    walletCurrency: wallet?.currency ?? "USDT",
  });
}
