import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import LiveRefreshControl from "@/app/live-refresh-control";
import UserContentText from "@/app/user-content-text";
import { Badge, Card } from "@/components/ui";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getMyNotificationsView } from "@/lib/notifications/notifications";
import MarkAllReadButton from "./mark-all-read";
import NotificationActions from "./notification-actions";
import NotificationOpenLink from "./notification-open-link";
import PwaNotificationSettings from "./pwa-notification-settings";

const notificationTypes = [
  "CHAT_MESSAGE",
  "ORDER_STATUS",
  "WALLET_UPDATE",
  "DISPUTE_UPDATE",
] as const;

const notificationMeta: Record<
  string,
  {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
    tone: string;
  }
> = {
  CHAT_MESSAGE: {
    labelKey: "notification.typeChat",
    descriptionKey: "notification.descChat",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  ORDER_STATUS: {
    labelKey: "notification.typeOrder",
    descriptionKey: "notification.descOrder",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  DISPUTE_UPDATE: {
    labelKey: "notification.typeDispute",
    descriptionKey: "notification.descDispute",
    tone: "border-orange-200 bg-orange-50 text-orange-700",
  },
  WALLET_UPDATE: {
    labelKey: "notification.typeWallet",
    descriptionKey: "notification.descWallet",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  SYSTEM: {
    labelKey: "notification.typeSystem",
    descriptionKey: "notification.descSystem",
    tone: "border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-muted)]",
  },
};

export default async function MyNotificationsPage() {
  await requirePageRole(ROLE_GROUPS.MARKET_USERS);
  const view = await getMyNotificationsView();

  if (!view) {
    notFound();
  }

  const unreadByType = view.notifications
    .filter((item) => !item.isRead)
    .reduce<Record<string, number>>((summary, item) => {
      summary[item.type] = (summary[item.type] ?? 0) + 1;
      return summary;
    }, {});

  const unreadOrderAndChat = (unreadByType.CHAT_MESSAGE ?? 0) + (unreadByType.ORDER_STATUS ?? 0);
  const unreadWalletAndDispute = (unreadByType.WALLET_UPDATE ?? 0) + (unreadByType.DISPUTE_UPDATE ?? 0);
  const urgentNotifications = view.notifications.filter(
    (item) => !item.isRead && ["DISPUTE_UPDATE", "WALLET_UPDATE", "ORDER_STATUS"].includes(item.type),
  );
  const sortedNotifications = [...view.notifications].sort((left, right) => {
    const leftPriority = getNotificationPriority(left.type, left.isRead);
    const rightPriority = getNotificationPriority(right.type, right.isRead);

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return 0;
  });
  const latestUnread = sortedNotifications.filter((item) => !item.isRead).slice(0, 3);

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto flex max-w-[1180px] flex-col gap-5">
        <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">
                <CountryText id="notification.eyebrow" />
              </p>
              <h1 className="mt-1 text-3xl font-black">
                <CountryText id="notification.title" />
              </h1>
              <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
                <CountryText id="notification.description" />
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LiveRefreshControl
                label={<CountryText id="chat.refresh" />}
                intervalMs={7000}
                streamPath="/api/live/notifications"
              />
              <MarkAllReadButton disabled={view.summary.unreadCount === 0} />
              <Link
                href="/my"
                className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="common.myPage" />
              </Link>
            </div>
          </div>
        </header>

        <PwaNotificationSettings />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={<CountryText id="notification.unread" />}
            value={String(view.summary.unreadCount)}
            note={<CountryText id={view.summary.unreadCount > 0 ? "notification.firstCheck" : "notification.allRead"} />}
          />
          <SummaryCard
            label={<CountryText id="notification.all" />}
            value={String(view.summary.totalCount)}
            note={<CountryText id="notification.recentBasis" />}
          />
          <SummaryCard
            label={<CountryText id="notification.orderChat" />}
            value={String(unreadOrderAndChat)}
            note={<CountryText id="notification.tradeProgress" />}
          />
          <SummaryCard
            label={<CountryText id="notification.walletDispute" />}
            value={String(unreadWalletAndDispute)}
            note={<CountryText id="notification.moneyRisk" />}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="notification.todayFocus" />
            </p>
            <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
              <NotificationFocusTitle
                unreadCount={view.summary.unreadCount}
                urgentCount={urgentNotifications.length}
              />
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--gg-muted)]">
              <CountryText id={getNotificationFocusBodyKey(view.summary.unreadCount, urgentNotifications.length)} />
            </p>
            <div className="mt-4 grid gap-2">
              <NotificationRouteButton href="/my/chat" label={<CountryText id="notification.chatCheck" />} count={unreadByType.CHAT_MESSAGE ?? 0} />
              <NotificationRouteButton href="/my/orders" label={<CountryText id="notification.orderCheck" />} count={unreadByType.ORDER_STATUS ?? 0} />
              <NotificationRouteButton href="/my/wallet" label={<CountryText id="notification.walletCheck" />} count={unreadByType.WALLET_UPDATE ?? 0} />
              <NotificationRouteButton href="/my/orders" label={<CountryText id="notification.disputeCheck" />} count={unreadByType.DISPUTE_UPDATE ?? 0} />
            </div>
          </Card>

          <Card>
            <p className="text-sm font-black text-[var(--gg-muted)]">
              <CountryText id="notification.recentUnread" />
            </p>
            <div className="mt-4 grid gap-3">
              {latestUnread.map((item) => {
                const meta = getNotificationMeta(item.type);

                return (
                  <div key={item.notificationId} className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-black ${meta.tone}`}>
                        <CountryText id={meta.labelKey} />
                      </span>
                      <span className="text-xs font-bold text-[var(--gg-subtle)]">{item.createdAt}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-[var(--gg-text)]">
                      <NotificationText text={item.title} />
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[var(--gg-muted)]">
                      <CountryText id={getNotificationNextActionKey(item.type)} />
                    </p>
                  </div>
                );
              })}

              {latestUnread.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-5 text-sm font-bold text-[var(--gg-muted)]">
                  <CountryText id="notification.noUnread" />
                </div>
              ) : null}
            </div>
          </Card>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {notificationTypes.map((type) => {
            const meta = getNotificationMeta(type);

            return (
              <Card key={type}>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${meta.tone}`}>
                  <CountryText id={meta.labelKey} />
                </span>
                <p className="mt-3 text-2xl font-black text-[var(--gg-text)]">
                  {unreadByType[type] ?? 0}
                  <CountryText id="manage.countSuffix" />
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-subtle)]">
                  <CountryText id={meta.descriptionKey} />
                </p>
              </Card>
            );
          })}
        </section>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[var(--gg-muted)]">
                <CountryText id="notification.list" />
              </p>
              <h2 className="mt-1 text-2xl font-black">
                <CountryText id="notification.actionUpdates" />
              </h2>
            </div>
            <p className="shrink-0 text-sm font-bold text-[var(--gg-muted)]">
              {view.notifications.length}
              <CountryText id="manage.countSuffix" />
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {sortedNotifications.map((item) => {
              const meta = getNotificationMeta(item.type);
              const isUrgent = getNotificationPriority(item.type, item.isRead) >= 3;

              return (
                <div
                  key={item.notificationId}
                  className={`rounded-2xl border p-5 ${
                    item.isRead
                      ? "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)]"
                      : "border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_9%,transparent)]"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-black ${meta.tone}`}>
                          <CountryText id={meta.labelKey} />
                        </span>
                        {!item.isRead ? (
                          <Badge><CountryText id="notification.new" /></Badge>
                        ) : (
                          <span className="text-xs font-bold text-[var(--gg-subtle)]">
                            <CountryText id="notification.read" />
                          </span>
                        )}
                        {isUrgent ? (
                          <span className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">
                            <CountryText id="notification.priority" />
                          </span>
                        ) : null}
                      </div>
                      <p className="text-lg font-black text-[var(--gg-text)]">
                        <NotificationText text={item.title} />
                      </p>
                      <p className="text-sm font-bold leading-6 text-[var(--gg-muted)]">
                        {item.type === "CHAT_MESSAGE" ? (
                          <UserContentText text={item.body} multiline showSourceFlag={false} />
                        ) : (
                          <NotificationText text={item.body} />
                        )}
                      </p>
                      <p className="text-xs font-bold text-[var(--gg-subtle)]">{item.createdAt}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-3">
                      {item.href ? (
                        <NotificationOpenLink notificationId={item.notificationId} isRead={item.isRead} href={item.href}>
                          <CountryText id="notification.openRelated" />
                        </NotificationOpenLink>
                      ) : null}
                      <NotificationActions notificationId={item.notificationId} isRead={item.isRead} />
                    </div>
                  </div>
                </div>
              );
            })}

            {view.notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center">
                <p className="text-sm font-bold text-[var(--gg-muted)]">
                  <CountryText id="notification.empty" />
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}

function getNotificationPriority(type: string, isRead: boolean) {
  if (isRead) return 0;
  if (type === "DISPUTE_UPDATE") return 4;
  if (type === "WALLET_UPDATE" || type === "ORDER_STATUS") return 3;
  if (type === "CHAT_MESSAGE") return 2;
  return 1;
}

function SummaryCard({ label, value, note }: { label: ReactNode; value: string; note: ReactNode }) {
  return (
    <Card>
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm font-bold text-[var(--gg-subtle)]">{note}</p>
    </Card>
  );
}

function NotificationRouteButton({ href, label, count }: { href: string; label: ReactNode; count: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)]"
    >
      <span>{label}</span>
      <span className="rounded-md bg-white px-2 py-1 text-xs text-[var(--gg-muted)]">
        {count}
        <CountryText id="manage.countSuffix" />
      </span>
    </Link>
  );
}

function NotificationFocusTitle({ unreadCount, urgentCount }: { unreadCount: number; urgentCount: number }) {
  if (unreadCount === 0) return <CountryText id="notification.noPendingTitle" />;
  if (urgentCount > 0) return <CountryText id="notification.urgentTitle" values={{ count: urgentCount }} />;
  return <CountryText id="notification.unreadTitle" values={{ count: unreadCount }} />;
}

function getNotificationFocusBodyKey(unreadCount: number, urgentCount: number): TranslationKey {
  if (unreadCount === 0) return "notification.noPendingBody";
  if (urgentCount > 0) return "notification.urgentBody";
  return "notification.unreadBody";
}

function getNotificationMeta(type: string) {
  return notificationMeta[type] || notificationMeta.SYSTEM;
}

function NotificationText({ text }: { text: string }) {
  const key = getNotificationTextKey(text);
  if (key) return <CountryText id={key} />;
  return <UserContentText text={text} showSourceFlag={false} />;
}

function getNotificationTextKey(text: string): TranslationKey | null {
  if (!text) return null;
  if (text.includes("Buyer confirmed receipt")) return "notification.buyerConfirmedReceipt";
  if (text.includes("Seller started delivery")) return "notification.sellerStartedDelivery";
  if (text.includes("Seller marked delivery complete")) return "notification.sellerMarkedDeliveryComplete";
  if (text.includes("Buyer reported an issue")) return "notification.buyerReportedIssue";
  if (text.includes("Admin resolved dispute with a buyer refund")) return "notification.adminResolvedBuyerRefund";
  if (text.includes("Admin resolved dispute and released settlement to seller")) return "notification.adminResolvedSellerSettlement";
  return null;
}

function getNotificationNextActionKey(type: string): TranslationKey {
  if (type === "CHAT_MESSAGE") return "notification.nextChat";
  if (type === "ORDER_STATUS") return "notification.nextOrder";
  if (type === "WALLET_UPDATE") return "notification.nextWallet";
  if (type === "DISPUTE_UPDATE") return "notification.nextDispute";
  return "notification.nextSystem";
}
