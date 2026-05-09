import Link from "next/link";
import { notFound } from "next/navigation";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import LiveRefreshControl from "@/app/live-refresh-control";
import LocalizedInput from "@/app/localized-input";
import UserContentText from "@/app/user-content-text";
import { requirePageRole } from "@/lib/auth/guards";
import { getOrderChatInbox } from "@/lib/chat/order-chat";

export default async function MyChatPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  await requirePageRole(["CUSTOMER", "SELLER"]);
  const view = await getOrderChatInbox();
  const { query } = await searchParams;
  const keyword = query?.trim().toLowerCase() ?? "";

  if (!view) {
    notFound();
  }

  const sortedRooms = [...view.rooms]
    .filter((room) => {
      if (!keyword) return true;

      return [room.listingTitle, room.counterpartName, room.orderNumber, room.lastMessagePreview]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    })
    .sort((left, right) => {
      if (left.unreadCount !== right.unreadCount) {
        return right.unreadCount - left.unreadCount;
      }

      const leftActive = isActiveOrderStatus(left.orderStatus);
      const rightActive = isActiveOrderStatus(right.orderStatus);

      if (leftActive !== rightActive) {
        return leftActive ? -1 : 1;
      }

      return 0;
    });

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px]">
        <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-black">
                <CountryText id="chat.title" />
              </h1>
              <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                {sortedRooms.length}
                <CountryText id="manage.countSuffix" />
              </p>
            </div>

            <form className="flex min-w-0 flex-1 items-center rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-3 lg:max-w-[520px]">
              <LocalizedInput
                name="query"
                defaultValue={query ?? ""}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--gg-subtle)]"
                placeholderKey="chat.searchPlaceholder"
              />
              <button type="submit" className="text-sm font-black text-[var(--gg-accent)]">
                <CountryText id="common.search" />
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              <LiveRefreshControl
                label={<CountryText id="chat.refresh" />}
                intervalMs={6000}
                streamPath="/api/live/chat-inbox"
              />
            </div>
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
          {sortedRooms.length ? (
            sortedRooms.map((room) => (
              <article
                key={room.roomId}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--gg-border-soft)] px-4 py-4 last:border-b-0 sm:px-5 sm:py-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${
                        room.perspective === "BUYER"
                          ? "bg-[color-mix(in_srgb,var(--gg-accent)_18%,transparent)] text-[var(--gg-accent)]"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      <CountryText id={room.perspective === "BUYER" ? "chat.buyer" : "chat.seller"} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-base font-black">
                          <UserContentText text={room.listingTitle} />
                        </p>
                        {room.unreadCount > 0 ? (
                          <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">
                            {room.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
                        {room.counterpartName} / {room.lastMessageAt}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-1 pl-12 text-sm text-[var(--gg-text)]">
                    {room.lastMessagePreview ? (
                      <UserContentText text={room.lastMessagePreview} showSourceFlag={false} />
                    ) : (
                      <CountryText id="chat.messageMissing" />
                    )}
                  </p>
                </div>

                <div className="flex min-w-[88px] flex-col items-end gap-2">
                  <span className={`rounded-md px-3 py-2 text-xs font-black ${getStatusClass(room.orderStatus)}`}>
                    <CountryText id={getOrderStatusKey(room.orderStatus)} />
                  </span>
                  <span className="text-right text-sm font-black text-[var(--gg-accent)] sm:text-base">
                    {room.grossAmount}
                    <span className="ml-1 text-xs">{room.currency}</span>
                  </span>
                  <Link
                    href={room.href}
                    className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
                  >
                    <CountryText id="chat.open" />
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 bg-[var(--gg-card-soft-bg)] p-8 text-center">
              <p className="text-lg font-black">
                <CountryText id="chat.noRooms" />
              </p>
              <Link
                href="/listings"
                className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                <CountryText id="orderManage.listingDetail" />
              </Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function isActiveOrderStatus(status: string) {
  return !["COMPLETED", "CANCELED", "REFUNDED"].includes(status);
}

function getStatusClass(status: string) {
  if (["REQUESTED", "SELLER_RESPONSE_PENDING", "BUYER_CONFIRM_PENDING"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }

  if (["ESCROW_LOCKED", "DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED"].includes(status)) {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (["DISPUTED", "CANCELED", "REFUNDED"].includes(status)) {
    return "bg-red-100 text-red-800";
  }

  return "bg-slate-100 text-slate-700";
}

function getOrderStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    REQUESTED: "orderStatus.requested",
    ESCROW_LOCKED: "orderStatus.escrowLocked",
    SELLER_RESPONSE_PENDING: "orderStatus.sellerResponsePending",
    DELIVERY_IN_PROGRESS: "orderStatus.deliveryInProgress",
    DELIVERY_COMPLETED: "orderStatus.deliveryCompleted",
    BUYER_CONFIRM_PENDING: "orderStatus.buyerConfirmPending",
    COMPLETED: "orderStatus.completed",
    DISPUTED: "orderStatus.disputed",
    CANCELED: "orderStatus.canceled",
    REFUNDED: "orderStatus.refunded",
  };

  return labels[status] || "orderStatus.requested";
}
