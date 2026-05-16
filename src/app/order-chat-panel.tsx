"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranslationKey } from "./i18n";
import LiveRefreshControl from "./live-refresh-control";
import useCountryTranslation from "./use-country-translation";
import UserContentText from "./user-content-text";
import { detectOffPlatformContact } from "@/lib/risk/off-platform-detector";

type ChatMessage = {
  id?: string;
  messageId?: string;
  senderRole: string;
  senderName: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
  isMine?: boolean;
  isReadByCounterpart?: boolean;
};

type OrderChatPanelProps = {
  orderId: string;
  orderNumber?: string;
  orderStatus?: string;
  perspective?: "BUYER" | "SELLER";
  counterpartName: string;
  viewerRole?: "BUYER" | "SELLER";
  status?: string;
  messages: ChatMessage[];
};

const quickMessageKeys: Record<"BUYER" | "SELLER", TranslationKey[]> = {
  BUYER: ["chat.quickHello", "chat.quickConfirmed", "chat.quickReceived"],
  SELLER: ["chat.quickHello", "chat.quickDeliverable", "chat.quickDelivered"],
};

export default function OrderChatPanel({
  orderId,
  orderNumber,
  orderStatus,
  perspective,
  counterpartName,
  viewerRole,
  status,
  messages,
}: OrderChatPanelProps) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const currentStatus = status ?? orderStatus ?? "ESCROW_LOCKED";
  const currentViewerRole = viewerRole ?? perspective ?? "BUYER";
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [riskWarning, setRiskWarning] = useState<TranslationKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setError(t("chat.messageRequired"));
      return;
    }

    const detection = detectOffPlatformContact(trimmedBody);
    if (detection.blocked) {
      setRiskWarning(detection.signals.map((signal) => getOffPlatformSignalKey(signal.code)));
      setError("");
      setNotice("");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    setError("");
    setRiskWarning([]);

    const response = await fetch("/api/market/order-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, body: trimmedBody }),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      messageKey?: TranslationKey;
    } | null;

    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload?.messageKey ? t(payload.messageKey) : payload?.message ?? t("chat.sendFailed"));
      return;
    }

    setBody("");
    setNotice(payload?.messageKey ? t(payload.messageKey) : payload?.message ?? t("chat.sent"));
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-col gap-3 border-b border-[var(--gg-border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-[var(--gg-muted)]">{orderNumber ?? orderId}</p>
          <h2 className="mt-1 text-lg font-black">{counterpartName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-3 py-2 text-xs font-black ${getStatusClass(currentStatus)}`}>
            {t(getOrderStatusKey(currentStatus))}
          </span>
          <LiveRefreshControl
            label={t("chat.refresh")}
            streamPath={`/api/live/order-chat?orderId=${encodeURIComponent(orderId)}`}
          />
        </div>
      </div>

      <div className="border-b border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 shrink-0 rounded-full ${getStatusDotClass(currentStatus)}`} />
            <div>
              <p className="text-sm font-black text-[var(--gg-text)]">
                {t(getStatusHintKey(currentStatus, currentViewerRole))}
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">{counterpartName}</p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]">
            {t(currentViewerRole === "BUYER" ? "chat.buyer" : "chat.seller")}
          </span>
        </div>
      </div>

      <div className="min-h-[460px] space-y-5 bg-[var(--gg-card-bg)] px-5 py-6">
        {messages.length ? (
          messages.map((chat) => {
            const isMine =
              chat.isMine ??
              (chat.senderRole === currentViewerRole ||
                (currentViewerRole === "BUYER" && chat.senderRole === "CUSTOMER"));

            return (
              <div
                key={chat.id ?? chat.messageId}
                className={`flex items-end gap-3 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {!isMine ? (
                  <span className="mb-1 text-xs font-black text-[var(--gg-muted)]">
                    {chat.senderName ?? t(getSenderRoleKey(chat.senderRole))}
                  </span>
                ) : null}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${
                    isMine
                      ? "bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] text-[var(--gg-text)]"
                      : "border border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-text)]"
                  }`}
                >
                  <UserContentText text={chat.body} multiline className="whitespace-pre-wrap" />
                </div>
                <span className="mb-1 text-xs font-black text-[var(--gg-muted)]">{chat.createdAt}</span>
              </div>
            );
          })
        ) : (
          <div className="flex min-h-[260px] items-center justify-center">
            <p className="text-sm font-black text-[var(--gg-muted)]">{t("chat.noMessages")}</p>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickMessageKeys[currentViewerRole].map((key) => {
            const item = t(key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => setBody((current) => (current ? `${current}\n${item}` : item))}
                className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-2 text-xs font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)]"
              >
                {item}
              </button>
            );
          })}
        </div>

        {notice ? (
          <p className="mb-2 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-800">{error}</p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <div>
            <textarea
              value={body}
              onChange={(event) => {
                const nextBody = event.target.value;
                setBody(nextBody);

                const detection = detectOffPlatformContact(nextBody);
                setRiskWarning(
                  detection.blocked
                    ? detection.signals.map((signal) => getOffPlatformSignalKey(signal.code))
                    : [],
                );
              }}
              rows={2}
              className={`min-h-14 w-full resize-none rounded-xl border bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] ${
                riskWarning.length > 0 ? "border-red-400" : "border-[var(--gg-border)]"
              }`}
              placeholder={t("chat.messagePlaceholder")}
            />
            {riskWarning.length > 0 ? (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
                <p className="font-black">{t("chat.offPlatformWarningTitle")}</p>
                <p className="mt-1">
                  {t("chat.offPlatformWarningBody").replace(
                    "{signals}",
                    riskWarning.map((key) => t(key)).join(", "),
                  )}
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || riskWarning.length > 0}
            className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] disabled:opacity-60"
          >
            {isSubmitting ? t("chat.sending") : t("chat.send")}
          </button>
        </div>
      </div>
    </section>
  );
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

function getStatusDotClass(status: string) {
  if (["REQUESTED", "SELLER_RESPONSE_PENDING", "BUYER_CONFIRM_PENDING"].includes(status)) {
    return "bg-amber-400";
  }

  if (["ESCROW_LOCKED", "DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED"].includes(status)) {
    return "bg-[var(--gg-accent)]";
  }

  if (status === "COMPLETED") {
    return "bg-emerald-500";
  }

  if (["DISPUTED", "CANCELED", "REFUNDED"].includes(status)) {
    return "bg-red-500";
  }

  return "bg-slate-400";
}

function getStatusHintKey(status: string, role: "BUYER" | "SELLER"): TranslationKey {
  if (status === "ESCROW_LOCKED") {
    return role === "SELLER" ? "chat.hintEscrowSeller" : "chat.hintEscrowBuyer";
  }

  if (status === "DELIVERY_IN_PROGRESS") {
    return role === "SELLER" ? "chat.hintDeliverySeller" : "chat.hintDeliveryBuyer";
  }

  if (status === "DELIVERY_COMPLETED") {
    return role === "BUYER" ? "chat.hintDeliveredBuyer" : "chat.hintDeliveredSeller";
  }

  if (status === "BUYER_CONFIRM_PENDING") {
    return role === "BUYER" ? "chat.hintConfirmBuyer" : "chat.hintConfirmSeller";
  }

  if (status === "COMPLETED") return "chat.hintCompleted";
  if (status === "DISPUTED") return "chat.hintDisputed";

  return "chat.hintDefault";
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

function getSenderRoleKey(role: string): TranslationKey {
  if (role === "SELLER") return "chat.seller";
  if (role === "BUYER" || role === "CUSTOMER") return "chat.buyer";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "chat.admin";
  return "chat.admin";
}

function getOffPlatformSignalKey(code: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    EMAIL: "chat.offPlatformSignalEmail",
    EXTERNAL_URL: "chat.offPlatformSignalExternalUrl",
    PHONE: "chat.offPlatformSignalPhone",
    MESSENGER: "chat.offPlatformSignalMessenger",
    OFF_PLATFORM_TRADE: "chat.offPlatformSignalTrade",
    CRYPTO_ADDRESS: "chat.offPlatformSignalCryptoAddress",
  };

  return labels[code] ?? "chat.offPlatformSignalUnknown";
}
