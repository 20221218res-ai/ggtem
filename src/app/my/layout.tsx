import type { ReactNode } from "react";
import {
  requirePageRole,
  ROLE_GROUPS,
  roleHasAccess,
  type AllowedRole,
} from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import type { TranslationKey } from "../i18n";
import MyNavigation, { type MyNavigationLink } from "./my-navigation";

const myLinks = [
  {
    href: "/my",
    labelKey: "nav.myHome",
    descriptionKey: "nav.myHomeDesc",
    groupKey: "nav.groupAccount",
    roles: ROLE_GROUPS.MARKET_USERS,
  },
  {
    href: "/my/orders",
    labelKey: "nav.buyOrders",
    descriptionKey: "nav.buyOrdersDesc",
    groupKey: "nav.groupBuy",
    roles: ["CUSTOMER"],
  },
  {
    href: "/my/buy-requests",
    labelKey: "nav.myBuyPosts",
    descriptionKey: "nav.myBuyPostsDesc",
    groupKey: "nav.groupBuy",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/buy-requests/new",
    labelKey: "nav.createBuyPost",
    descriptionKey: "nav.createBuyPostDesc",
    groupKey: "nav.groupBuy",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/listings",
    labelKey: "nav.mySellPosts",
    descriptionKey: "nav.mySellPostsDesc",
    groupKey: "nav.groupSell",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/listings/new",
    labelKey: "nav.createSellPost",
    descriptionKey: "nav.createSellPostDesc",
    groupKey: "nav.groupSell",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/wallet",
    labelKey: "common.wallet",
    descriptionKey: "nav.walletDesc",
    groupKey: "nav.groupWallet",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/wallet/ledger",
    labelKey: "nav.walletLedger",
    descriptionKey: "nav.walletLedgerDesc",
    groupKey: "nav.groupWallet",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/chat",
    labelKey: "common.chat",
    descriptionKey: "nav.chatDesc",
    groupKey: "nav.groupMessage",
    roles: ["CUSTOMER", "SELLER"],
  },
  {
    href: "/my/notifications",
    labelKey: "common.notifications",
    descriptionKey: "nav.notificationsDesc",
    groupKey: "nav.groupMessage",
    roles: ROLE_GROUPS.MARKET_USERS,
  },
] satisfies Array<{
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  groupKey: TranslationKey;
  roles: readonly AllowedRole[];
}>;

export default async function MyLayout({ children }: { children: ReactNode }) {
  const currentUser = await requirePageRole(ROLE_GROUPS.MARKET_USERS);
  const prisma = getPrismaClient();
  const [unreadChatCount, unreadNotificationCount] = await Promise.all([
    prisma.chatMessage.count({
      where: {
        senderId: { not: currentUser.userId },
        readAt: null,
        room: {
          OR: [{ buyerId: currentUser.userId }, { sellerId: currentUser.userId }],
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId: currentUser.userId,
        isRead: false,
      },
    }),
  ]);
  const badgeByHref: Record<string, number> = {
    "/my/chat": unreadChatCount,
    "/my/notifications": unreadNotificationCount,
  };
  const visibleLinks = myLinks
    .filter((link) => roleHasAccess(currentUser.role, link.roles))
    .map((link) => ({
      ...link,
      badgeCount: badgeByHref[link.href] ?? 0,
    })) satisfies MyNavigationLink[];

  return (
    <div className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)] transition-colors">
      <MyNavigation links={visibleLinks} displayName={currentUser.displayName} />
      {children}
    </div>
  );
}
