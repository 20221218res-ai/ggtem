"use client";

import { useEffect, useMemo, useState } from "react";

type AdminOrdersState = {
  orders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    listingTitle: string;
    buyerName: string;
    sellerName: string;
    quantity: string;
    grossAmount: string;
    currency: string;
    createdAt: string;
  }>;
  selectedOrderId: string | null;
  detail: AdminOrderDetail | null;
  filters: {
    status: string;
    query: string;
  };
};

type AdminOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  buyerId: string;
  sellerId: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  quantity: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  platformFeeAmount: string;
  escrowAmount: string;
  currency: string;
  tradeCharacterName: string | null;
  buyerGameNickname: string | null;
  sellerGameNickname: string | null;
  createdAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  disputeReason: string | null;
  links: {
    adminOrder: string;
    buyerOrder: string;
    sellerOrder: string;
    buyerChat: string;
    sellerChat: string;
    ledger: string;
    audit: string;
  };
  decisionPreview: {
    refundBuyer: string;
    releaseToSeller: string;
  };
  events: Array<{
    eventId: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
  ledgerEntries: Array<{
    entryId: string;
    userId: string;
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    createdAt: string;
    memo: string | null;
  }>;
};

const initialState: AdminOrdersState = {
  orders: [],
  selectedOrderId: null,
  detail: null,
  filters: {
    status: "ALL",
    query: "",
  },
};

const statusTabs = [
  { value: "ALL", label: "전체" },
  { value: "REQUESTED", label: "요청" },
  { value: "ESCROW_LOCKED", label: "에스크로" },
  { value: "SELLER_RESPONSE_PENDING", label: "판매자 응답" },
  { value: "DELIVERY_IN_PROGRESS", label: "전달 중" },
  { value: "BUYER_CONFIRM_PENDING", label: "인수 대기" },
  { value: "DISPUTED", label: "분쟁" },
  { value: "REFUNDED", label: "환불" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELED", label: "취소" },
];

export default function AdminOrdersPage() {
  const [state, setState] = useState<AdminOrdersState>(initialState);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [disputeNote, setDisputeNote] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);

  const summary = useMemo(() => getOrderListSummary(state.orders), [state.orders]);
  const selectedAction = state.detail ? getOrderNextAction(state.detail.status) : null;
  const disputeDecisionNote = state.detail
    ? extractDisputeDecisionNote(state.detail.events)
    : null;

  async function loadOrders(orderId?: string, nextStatus?: string, nextQuery?: string) {
    setError("");

    try {
      const params = new URLSearchParams();
      const resolvedStatus = nextStatus ?? statusFilter;
      const resolvedQuery = nextQuery ?? searchQuery;

      if (orderId) params.set("orderId", orderId);
      if (resolvedStatus && resolvedStatus !== "ALL") params.set("status", resolvedStatus);
      if (resolvedQuery) params.set("query", resolvedQuery);

      const queryString = params.toString();
      const response = await fetch(`/api/admin/orders${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const nextState = (await response.json()) as AdminOrdersState | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in nextState && nextState.message
            ? nextState.message
            : "주문 목록을 불러오지 못했습니다.",
        );
      }

      const typedState = nextState as AdminOrdersState;
      setState(typedState);
      setSelectedOrderId(typedState.selectedOrderId ?? "");
      setStatusFilter(typedState.filters.status);
      setSearchQuery(typedState.filters.query);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "주문 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveDispute(action: "REFUND_BUYER" | "RELEASE_TO_SELLER") {
    if (!state.detail) return;

    const confirmed = window.confirm(
      action === "REFUND_BUYER"
        ? [
            `주문 ${state.detail.orderNumber}을 구매자 환불로 종료할까요?`,
            `구매자 환불: ${state.detail.grossAmount} ${state.detail.currency}`,
            `플랫폼 수수료 ${state.detail.platformFeeAmount} ${state.detail.currency}도 함께 정리됩니다.`,
            `메모: ${disputeNote.trim() || "없음"}`,
          ].join("\n")
        : [
            `주문 ${state.detail.orderNumber}을 판매자 정산으로 종료할까요?`,
            `판매자 정산: ${state.detail.sellerReceivableAmount} ${state.detail.currency}`,
            `플랫폼 수수료 ${state.detail.platformFeeAmount} ${state.detail.currency}는 판매자에게 지급하지 않습니다.`,
            `메모: ${disputeNote.trim() || "없음"}`,
          ].join("\n"),
    );

    if (!confirmed) return;

    setError("");
    setIsResolving(true);

    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: state.detail.orderId,
          action,
          note: disputeNote,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "분쟁 처리를 완료하지 못했습니다.");
      }

      await loadOrders(state.detail.orderId, statusFilter, searchQuery);
      setDisputeNote("");
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "분쟁 처리를 완료하지 못했습니다.",
      );
    } finally {
      setIsResolving(false);
    }
  }

  useEffect(() => {
    const initialParams = getInitialOrderParams();
    setStatusFilter(initialParams.status);
    setSearchQuery(initialParams.query);
    void loadOrders(initialParams.orderId, initialParams.status, initialParams.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">ORDER DESK</p>
              <h1 className="mt-1 text-2xl font-black">주문 관리</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionLink href="/admin/disputes" label="분쟁" />
              <ActionLink href="/admin/finance/ledger" label="원장" />
              <ActionLink href="/admin/audit?targetType=ORDER" label="감사 로그" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="전체" value={summary.total} tone="slate" />
            <Metric label="진행" value={summary.active} tone="blue" />
            <Metric label="분쟁" value={summary.disputed} tone="red" />
            <Metric label="완료" value={summary.completed} tone="emerald" />
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  void loadOrders(selectedOrderId || undefined, tab.value, searchQuery);
                }}
                className={
                  statusFilter === tab.value
                    ? "rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-black text-slate-950"
                    : "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void loadOrders(selectedOrderId || undefined, statusFilter, searchQuery);
            }}
          >
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="주문번호, 매물명, 구매자, 판매자 검색"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--gg-accent)]"
            />
            <select
              value={selectedOrderId}
              onChange={(event) => {
                setSelectedOrderId(event.target.value);
                void loadOrders(event.target.value || undefined, statusFilter, searchQuery);
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--gg-accent)]"
            >
              <option value="">목록에서 선택</option>
              {state.orders.map((order) => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderNumber} / {order.listingTitle}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              검색
            </button>
          </form>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">주문 목록</h2>
              <span className="text-sm font-black text-slate-500">
                {state.orders.length.toLocaleString("ko-KR")}건
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <EmptyState title="불러오는 중" />
              ) : null}

              {!isLoading && state.orders.length === 0 ? (
                <EmptyState title="주문 없음" />
              ) : null}

              {state.orders.map((order) => (
                <button
                  key={order.orderId}
                  type="button"
                  onClick={() => void loadOrders(order.orderId, statusFilter, searchQuery)}
                  className={
                    state.selectedOrderId === order.orderId
                      ? "w-full rounded-xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-4 text-left shadow-sm"
                      : "w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {order.listingTitle}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {order.orderNumber} / {order.buyerName} / {order.sellerName}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-black text-slate-600">
                    <span>
                      {order.grossAmount} {order.currency}
                    </span>
                    <span>수량 {order.quantity}</span>
                    <span>{order.createdAt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {state.detail ? (
              <OrderDetail
                detail={state.detail}
                selectedAction={selectedAction}
                disputeDecisionNote={disputeDecisionNote}
                disputeNote={disputeNote}
                setDisputeNote={setDisputeNote}
                isResolving={isResolving}
                onResolveDispute={resolveDispute}
              />
            ) : (
              <EmptyState title="주문 선택" />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function OrderDetail({
  detail,
  selectedAction,
  disputeDecisionNote,
  disputeNote,
  setDisputeNote,
  isResolving,
  onResolveDispute,
}: {
  detail: AdminOrderDetail;
  selectedAction: { title: string } | null;
  disputeDecisionNote: string | null;
  disputeNote: string;
  setDisputeNote: (value: string) => void;
  isResolving: boolean;
  onResolveDispute: (action: "REFUND_BUYER" | "RELEASE_TO_SELLER") => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">{detail.orderNumber}</p>
          <h2 className="mt-1 text-2xl font-black">{detail.listingTitle}</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">
            {detail.buyerName} / {detail.sellerName}
          </p>
        </div>
        <StatusBadge status={detail.status} />
      </div>

      {selectedAction ? (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">NEXT ACTION</p>
            <p className="mt-1 text-xl font-black text-slate-950">{selectedAction.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TraceLink href={detail.links.buyerChat} label="구매자 채팅" />
            <TraceLink href={detail.links.sellerChat} label="판매자 채팅" />
            <TraceLink href={detail.links.ledger} label="원장" />
          </div>
        </div>
      ) : null}

      <SettlementDecisionGuide detail={detail} />

      <div className="grid gap-3 md:grid-cols-4">
        <DetailCard label="주문 금액" value={`${detail.grossAmount} ${detail.currency}`} />
        <DetailCard label="에스크로" value={`${detail.escrowAmount} ${detail.currency}`} />
        <DetailCard
          label="판매자 정산"
          value={`${detail.sellerReceivableAmount} ${detail.currency}`}
        />
        <DetailCard label="플랫폼 수수료" value={`${detail.platformFeeAmount} ${detail.currency}`} />
      </div>

      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-base font-black">상세 정보 / 바로가기</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailRow label="수량" value={detail.quantity} />
          <DetailRow label="구매자 게임 아이디" value={detail.buyerGameNickname ?? detail.tradeCharacterName ?? "-"} />
          <DetailRow label="판매자 게임 아이디" value={detail.sellerGameNickname ?? detail.tradeCharacterName ?? "-"} />
          <DetailRow label="생성일" value={detail.createdAt} />
          <DetailRow label="완료일" value={detail.completedAt ?? "-"} />
          <DetailRow label="취소일" value={detail.canceledAt ?? "-"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <TraceLink href={detail.links.buyerOrder} label="구매자 주문" />
          <TraceLink href={detail.links.sellerOrder} label="판매자 주문" />
          <TraceLink href={detail.links.buyerChat} label="구매자 채팅" />
          <TraceLink href={detail.links.sellerChat} label="판매자 채팅" />
          <TraceLink href={detail.links.ledger} label="원장" />
          <TraceLink href={detail.links.audit} label="감사" />
        </div>
      </details>

      {detail.status === "DISPUTED" ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-base font-black text-red-800">분쟁 처리</h3>
          <p className="mt-2 text-sm font-bold text-red-700">
            {detail.disputeReason ?? disputeDecisionNote ?? "분쟁 사유 확인 필요"}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <DecisionPreview label="구매자 환불" body={detail.decisionPreview.refundBuyer} />
            <DecisionPreview
              label="판매자 정산"
              body={detail.decisionPreview.releaseToSeller}
            />
          </div>
          <textarea
            value={disputeNote}
            onChange={(event) => setDisputeNote(event.target.value)}
            placeholder="처리 사유를 입력하세요."
            rows={3}
            className="mt-4 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-red-400"
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => void onResolveDispute("REFUND_BUYER")}
              disabled={isResolving}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
            >
              구매자 환불
            </button>
            <button
              type="button"
              onClick={() => void onResolveDispute("RELEASE_TO_SELLER")}
              disabled={isResolving}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:opacity-60"
            >
              판매자 정산
            </button>
          </div>
        </section>
      ) : null}

      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-base font-black">
          원장 / 이벤트 기록
        </summary>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          <LedgerSection entries={detail.ledgerEntries} />
          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-black">이벤트</h3>
            <div className="mt-3 space-y-3">
              {detail.events.map((event) => (
                <div key={event.eventId} className="rounded-md bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <StatusBadge status={event.status} />
                    <span className="text-xs font-bold text-slate-500">{event.createdAt}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-700">
                    {cleanEventMessage(event.message)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}

function SettlementDecisionGuide({ detail }: { detail: AdminOrderDetail }) {
  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-slate-500">구매자 결제 / 에스크로</p>
        <p className="mt-2 text-2xl font-black text-slate-950">
          {detail.grossAmount} {detail.currency}
        </p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-emerald-700">판매자 실제 정산</p>
        <p className="mt-2 text-2xl font-black text-emerald-700">
          {detail.sellerReceivableAmount} {detail.currency}
        </p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-sky-700">플랫폼 수수료</p>
        <p className="mt-2 text-2xl font-black text-sky-700">
          {detail.platformFeeAmount} {detail.currency}
        </p>
      </div>
    </section>
  );
}

function LedgerSection({ entries }: { entries: AdminOrderDetail["ledgerEntries"] }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="text-base font-black">원장</h3>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.entryId}
            className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs font-bold text-slate-600 md:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <p className="text-sm font-black text-slate-900">
                {ledgerTypeLabel(entry.type)} / {bucketLabel(entry.bucket)}
              </p>
              <p className="mt-1">{entry.memo ?? "메모 없음"}</p>
            </div>
            <span>{directionLabel(entry.direction)}</span>
            <span className="font-black text-slate-950">{entry.amount}</span>
          </div>
        ))}
        {entries.length === 0 ? (
          <EmptyState title="원장 없음" />
        ) : null}
      </div>
    </section>
  );
}

function getInitialOrderParams() {
  if (typeof window === "undefined") {
    return { orderId: undefined, status: "ALL", query: "" };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    orderId: params.get("orderId") ?? undefined,
    status: params.get("status") ?? "ALL",
    query: params.get("query") ?? "",
  };
}

function getOrderListSummary(orders: AdminOrdersState["orders"]) {
  return {
    total: orders.length,
    active: orders.filter((order) =>
      [
        "REQUESTED",
        "ESCROW_LOCKED",
        "SELLER_RESPONSE_PENDING",
        "DELIVERY_IN_PROGRESS",
        "DELIVERY_COMPLETED",
        "BUYER_CONFIRM_PENDING",
      ].includes(order.status),
    ).length,
    disputed: orders.filter((order) => order.status === "DISPUTED").length,
    completed: orders.filter((order) => order.status === "COMPLETED").length,
  };
}

function getOrderNextAction(status: string) {
  const actions: Record<string, { title: string }> = {
    REQUESTED: { title: "결제 대기" },
    ESCROW_LOCKED: { title: "판매자 응답 대기" },
    SELLER_RESPONSE_PENDING: { title: "판매자 확인 필요" },
    DELIVERY_IN_PROGRESS: { title: "전달 진행" },
    DELIVERY_COMPLETED: { title: "인수확정 대기" },
    BUYER_CONFIRM_PENDING: { title: "구매자 확정 대기" },
    DISPUTED: { title: "분쟁 처리 필요" },
    COMPLETED: { title: "거래 완료" },
  };
  return actions[status] ?? null;
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청",
    ESCROW_LOCKED: "에스크로",
    SELLER_RESPONSE_PENDING: "판매자 응답",
    DELIVERY_IN_PROGRESS: "전달 중",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수 대기",
    COMPLETED: "완료",
    DISPUTED: "분쟁",
    REFUNDED: "환불",
    CANCELED: "취소",
    CANCELLED: "취소",
  };
  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "DISPUTED") return "bg-red-100 text-red-700";
  if (status === "REFUNDED" || status === "CANCELED" || status === "CANCELLED") {
    return "bg-slate-200 text-slate-700";
  }
  if (status === "BUYER_CONFIRM_PENDING" || status === "DELIVERY_COMPLETED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-sky-100 text-sky-700";
}

function cleanEventMessage(message: string) {
  if (!message || message.includes("\uFFFD")) return "이벤트 기록 확인 필요";
  return message
    .replaceAll("DISPUTE_REFUND_BUYER", "구매자 환불 처리")
    .replaceAll("DISPUTE_RELEASE_TO_SELLER", "판매자 정산 처리")
    .replaceAll("Buyer reported a problem:", "구매자 분쟁 사유:")
    .replaceAll("Note:", "메모:");
}

function extractDisputeDecisionNote(
  events: NonNullable<AdminOrdersState["detail"]>["events"],
) {
  const event = events.find((item) => item.status === "DISPUTED");
  return event ? cleanEventMessage(event.message) : null;
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ESCROW_LOCK: "에스크로 잠금",
    ESCROW_RELEASE: "에스크로 해제",
    PAYMENT: "결제",
    REFUND: "환불",
    WITHDRAWAL: "출금",
    DEPOSIT: "입금",
    FEE: "수수료",
    DISPUTE_REFUND: "분쟁 환불",
    DISPUTE_RELEASE: "분쟁 정산",
    ORDER_COMPLETED_RELEASE_TO_SELLER: "거래 완료 정산",
    PLATFORM_FEE_COLLECTED: "플랫폼 수수료",
  };
  return labels[type] ?? type;
}

function directionLabel(direction: string) {
  return direction === "CREDIT" ? "입금" : direction === "DEBIT" ? "차감" : direction;
}

function bucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    AVAILABLE: "사용 가능",
    WITHDRAWABLE: "출금 가능",
    ESCROW: "에스크로",
    ESCROW_LOCKED: "에스크로",
    LOCKED: "잠금",
    PENDING_SETTLEMENT: "정산 대기",
    PLATFORM_REVENUE: "플랫폼 수익",
  };
  return labels[bucket] ?? bucket;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-black ${statusTone(status)}`}>
      {formatOrderStatus(status)}
    </span>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "red" | "emerald";
}) {
  const tones: Record<typeof tone, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-black opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

function TraceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
    >
      {label}
    </a>
  );
}

function DecisionPreview({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-white bg-white/80 p-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{body}</p>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
    >
      {label}
    </a>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
      <p className="text-sm font-black text-slate-700">{title}</p>
    </div>
  );
}
