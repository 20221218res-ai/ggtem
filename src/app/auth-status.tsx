import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { getUnreadNotificationCountForUser } from "@/lib/notifications/notifications";
import CountryText from "./country-text";
import SignOutButton from "./sign-out-button";

const userLinks = [
  { href: "/", labelId: "common.home" },
  { href: "/my/orders", labelId: "common.myOrders" },
  { href: "/my/listings", labelId: "common.myListings" },
  { href: "/my/buy-requests", labelId: "common.myBuyRequests" },
  { href: "/my/wallet", labelId: "common.wallet" },
] as const;

export default async function AuthStatus() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return (
      <div className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 text-sm text-slate-300">
          <p>
            <CountryText id="common.authRequiredBody" />
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-up"
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-100 hover:bg-emerald-400/20"
            >
              <CountryText id="common.signUp" />
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md bg-slate-50 px-3 py-2 font-semibold text-slate-950 hover:bg-white"
            >
              <CountryText id="common.signIn" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const [unreadNotificationCount, unreadChatCount] = await Promise.all([
    getUnreadNotificationCountForUser(user.userId),
    prisma.chatMessage.count({
      where: {
        senderId: {
          not: user.userId,
        },
        readAt: null,
        room: {
          OR: [{ buyerId: user.userId }, { sellerId: user.userId }],
        },
      },
    }),
  ]);

  return (
    <div className="border-b border-white/10 bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 text-sm text-slate-300 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-white">{user.displayName}</span>
          <span className="text-slate-400">{user.email}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/my"
            className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-100 hover:bg-emerald-400/20"
          >
            <CountryText id="common.myPage" />
          </Link>
          {userLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              <CountryText id={link.labelId} />
            </Link>
          ))}
          <Link href="/my/chat" className="hover:text-white">
            <CountryText id="common.chat" />
            {unreadChatCount > 0 ? ` (${formatBadgeCount(unreadChatCount)})` : ""}
          </Link>
          <Link href="/my/notifications" className="hover:text-white">
            <CountryText id="common.notifications" />
            {unreadNotificationCount > 0
              ? ` (${formatBadgeCount(unreadNotificationCount)})`
              : ""}
          </Link>
          <SignOutButton className="rounded-md border border-white/10 px-3 py-2 font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
      </div>
    </div>
  );
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : count.toString();
}
