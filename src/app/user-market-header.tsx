import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { getUnreadNotificationCount } from "@/lib/notifications/notifications";
import UserMarketHeaderClient from "./user-market-header-client";

export default async function UserMarketHeader() {
  const currentUser = await getCurrentSessionUser();
  const prisma = getPrismaClient();
  const [unreadChatCount, unreadNotificationCount] = currentUser
    ? await Promise.all([
        prisma.chatMessage.count({
          where: {
            senderId: { not: currentUser.userId },
            readAt: null,
            room: {
              OR: [
                { buyerId: currentUser.userId },
                { sellerId: currentUser.userId },
              ],
            },
          },
        }),
        getUnreadNotificationCount(),
      ])
    : [0, 0];

  return (
    <UserMarketHeaderClient
      currentUser={
        currentUser
          ? {
              displayName: currentUser.displayName,
              email: currentUser.email,
            }
          : null
      }
      unreadChatCount={unreadChatCount}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
