"use client";

import { useEffect, useMemo, useState } from "react";

type AdminDisputesState = {
  disputes: Array<{
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
    disputeNote: string | null;
  }>;
  selectedOrderId: string | null;
  detail: AdminOrderDetail | null;
  filters: {
    view: string;
    query: string;
  };
};

type AdminOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  quantity: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  platformFeeAmount: string;
  escrowAmount: string;
  currency: string;
  createdAt: string;
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
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    createdAt: string;
    memo: string | null;
  }>;
};

const initialState: AdminDisputesState = {
  disputes: [],
  selectedOrderId: null,
  detail: null,
  filters: {
    view: "OPEN",
    query: "",
  },
};

const disputeTabs = [
  { value: "OPEN", label: "대기" },
  { value: "REFUNDED", label: "환불" },
  { value: "RELEASED", label: "정산" },
];

export default function AdminDisputesPage() {
  const [state, setState] = useState<AdminDisputesState>(initialState);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState("OPEN");
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<"REFUND_BUYER" | "RELEASE_TO_SELLER" | null>(null);

  const summary = useMemo(() => getDisputeListSummary(state.disputes), [state.disputes]);
  const selectedAction = state.detail ? getDisputeNextAction(state.detail.status) : null;
  const noteLength = resolutionNote.trim().length;
  const noteIsShort = noteLength > 0 && noteLength < 20;
  const canResolveDispute = noteLength >= 20;

  async function loadDisputes(orderId?: string, nextView?: string, nextQuery?: string) {
    setError("");
    setSuccess("");

    try {
      const params = new URLSearchParams();
      const resolvedView = nextView ?? viewFilter;
      const resolvedQuery = nextQuery ?? searchQuery;

      if (orderId) params.set("orderId", orderId);
      if (resolvedView) params.set("view", resolvedView);
      if (resolvedQuery) params.set("query", resolvedQuery);

      const queryString = params.toString();
      const response = await fetch(`/api/admin/disputes${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const nextState = (await response.json()) as AdminDisputesState | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in nextState && nextState.message
            ? cleanEventMessage(nextState.message)
            : "분쟁 목록을 불러오지 못했습니다.",
        );
      }

      const typedState = nextState as AdminDisputesState;
      setState(typedState);
      setSelectedOrderId(typedState.selectedOrderId ?? "");
      setViewFilter(typedState.filters.view);
      setSearchQuery(typedState.filters.query);
    } catch (loadError) {
      setError(loadError instanceof Error ? cleanEventMessage(loadError.message) : "분쟁 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveDispute(action: "REFUND_BUYER" | "RELEASE_TO_SELLER") {
    if (!state.detail) return;

    if (resolutionNote.trim().length < 20) {
      setError("분쟁 종료 전 처리 메모를 20자 이상 입력해 주세요. 나중에 감사 로그와 분쟁 근거로 남습니다.");
      return;
    }

    const confirmed = window.confirm(
      action === "REFUND_BUYER"
        ? [
            `주문 ${state.detail.orderNumber}을 구매자 환불로 종료할까요?`,
            `환불 금액: ${state.detail.grossAmount} ${state.detail.currency}`,
            `플랫폼 수수료 ${state.detail.platformFeeAmount} ${state.detail.currency}도 취소합니다.`,
            `처리 메모: ${resolutionNote.trim() || "없음"}`,
          ].join("\n")
        : [
            `주문 ${state.detail.orderNumber}을 판매자 정산으로 종료할까요?`,
            `판매자 정산액: ${state.detail.sellerReceivableAmount} ${state.detail.currency}`,
            `플랫폼 수수료 ${state.detail.platformFeeAmount} ${state.detail.currency}는 수익으로 기록합니다.`,
            `처리 메모: ${resolutionNote.trim() || "없음"}`,
          ].join("\n"),
    );

    if (!confirmed) return;

    setError("");
    setIsResolving(true);
    setResolvingAction(action);

    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: state.detail.orderId,
          action,
          note: resolutionNote,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "분쟁 처리를 완료하지 못했습니다.");
      }

      await loadDisputes(state.detail.orderId, viewFilter, searchQuery);
      setSuccess(result.message ?? "분쟁 처리가 완료되었습니다.");
      setResolutionNote("");
    } catch (resolveError) {
      setError(resolveError instanceof Error ? cleanEventMessage(resolveError.message) : "분쟁 처리를 완료하지 못했습니다.");
    } finally {
      setIsResolving(false);
      setResolvingAction(null);
    }
  }

  useEffect(() => {
    const initialParams = getInitialDisputeParams();
    setViewFilter(initialParams.view);
    setSearchQuery(initialParams.query);
    void loadDisputes(initialParams.orderId, initialParams.view, initialParams.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">DISPUTE DESK</p>
              <h1 className="mt-1 text-2xl font-black">분쟁 처리</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Metric label="대기" value={summary.open} tone="red" />
              <Metric label="환불" value={summary.refunded} tone="blue" />
              <Metric label="정산" value={summary.released} tone="emerald" />
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {disputeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setViewFilter(tab.value);
                    setIsLoading(true);
                    void loadDisputes(undefined, tab.value, searchQuery);
                  }}
                  disabled={isLoading || isResolving}
                  className={`rounded-md border px-4 py-2 text-sm font-black ${
                    viewFilter === tab.value
                      ? "border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,white)] text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                setIsLoading(true);
                void loadDisputes(selectedOrderId || undefined, viewFilter, searchQuery);
              }}
            >
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="주문번호, 매물명, 구매자, 판매자 검색"
                className="min-w-[280px] rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--gg-accent)]"
              />
              <button
                className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isLoading || isResolving}
              >
                {isLoading ? "검색 중..." : "검색"}
              </button>
            </form>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-black">분쟁 주문</h2>
            </div>
            <div className="max-h-[860px] overflow-y-auto p-3">
              {isLoading ? (
                <EmptyState title="불러오는 중" />
              ) : state.disputes.length === 0 ? (
                <EmptyState title="표시할 분쟁 없음" />
              ) : (
                <div className="flex flex-col gap-2">
                  {state.disputes.map((dispute) => (
                    <button
                      key={dispute.orderId}
                      type="button"
                      disabled={isLoading || isResolving}
                      onClick={() => void loadDisputes(dispute.orderId, viewFilter, searchQuery)}
                      className={`rounded-lg border p-4 text-left transition ${
                        selectedOrderId === dispute.orderId
                          ? "border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">{dispute.orderNumber}</p>
                          <p className="mt-1 line-clamp-2 font-bold">{dispute.listingTitle}</p>
                        </div>
                        <StatusBadge status={dispute.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span>구매자 {dispute.buyerName}</span>
                        <span>판매자 {dispute.sellerName}</span>
                        <span>수량 {dispute.quantity}</span>
                        <span>
                          금액 {dispute.grossAmount} {dispute.currency}
                        </span>
                      </div>
                      {dispute.disputeNote ? (
                        <p className="mt-3 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          {cleanEventMessage(dispute.disputeNote)}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-slate-500">{dispute.createdAt}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {state.detail ? (
            <section className="flex flex-col gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={state.detail.status} />
                      {selectedAction ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          {selectedAction}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-bold">{state.detail.listingTitle}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {state.detail.orderNumber} / 생성 {state.detail.createdAt}
                    </p>
                  </div>
                  <TraceLink href={state.detail.links.adminOrder} label="주문 보기" />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <DetailCard label="구매자 결제액" value={`${state.detail.grossAmount} ${state.detail.currency}`} />
                  <DetailCard label="에스크로 잠금" value={`${state.detail.escrowAmount} ${state.detail.currency}`} />
                  <DetailCard label="판매자 정산액" value={`${state.detail.sellerReceivableAmount} ${state.detail.currency}`} />
                  <DetailCard label="플랫폼 수수료" value={`${state.detail.platformFeeAmount} ${state.detail.currency}`} />
                  <DetailCard label="거래 수량" value={state.detail.quantity} />
                </div>
              </div>

              <SettlementDecisionGuide detail={state.detail} />

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="font-black">종료 처리</h3>
                  </div>
                  <div className="text-sm text-slate-500">
                    메모 {noteLength}자{" "}
                    {noteIsShort || noteLength === 0 ? (
                      <span className="font-semibold text-amber-600">
                        / 판단 근거 20자 이상
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <DecisionPreview label="구매자 환불" body={state.detail.decisionPreview.refundBuyer} />
                  <DecisionPreview label="판매자 정산" body={state.detail.decisionPreview.releaseToSeller} />
                </div>

                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  rows={4}
                  placeholder="예: 채팅에서 판매자 전달 증빙이 부족하고 구매자 미수령 캡처가 확인되어 구매자 환불 처리"
                  className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-[var(--gg-accent)]"
                />

                {state.detail.status === "DISPUTED" ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={isResolving || !canResolveDispute}
                      onClick={() => void resolveDispute("REFUND_BUYER")}
                      className="rounded-md border border-red-200 bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resolvingAction === "REFUND_BUYER" ? "구매자 환불 처리 중..." : "구매자 환불로 종료"}
                    </button>
                    <button
                      type="button"
                      disabled={isResolving || !canResolveDispute}
                      onClick={() => void resolveDispute("RELEASE_TO_SELLER")}
                      className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resolvingAction === "RELEASE_TO_SELLER" ? "판매자 정산 처리 중..." : "판매자 정산으로 종료"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    이미 종료됨
                  </div>
                )}
              </section>

              <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer font-black">증빙 / 기록</summary>
                <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-black">증빙</h3>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <TraceLink href={state.detail.links.buyerChat} label="구매자 채팅" />
                      <TraceLink href={state.detail.links.sellerChat} label="판매자 채팅" />
                      <TraceLink href={state.detail.links.buyerOrder} label="구매자 주문" />
                      <TraceLink href={state.detail.links.sellerOrder} label="판매자 주문" />
                      <TraceLink href={state.detail.links.ledger} label="지갑 원장" />
                      <TraceLink href={state.detail.links.audit} label="감사 로그" />
                    </div>
                  </section>

                  <aside className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-black">체크</h3>
                    <div className="mt-4 flex flex-col gap-3">
                      <ReviewCheckItem label="채팅 증빙" />
                      <ReviewCheckItem label="상품/수량 일치" />
                      <ReviewCheckItem label="원장 금액" />
                      <ReviewCheckItem label="처리 메모" />
                    </div>
                  </aside>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-bold">주문 이벤트</h3>
                    <div className="mt-4 flex flex-col gap-3">
                      {state.detail.events.map((event) => (
                        <div key={event.eventId} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <StatusBadge status={event.status} />
                            <span className="text-xs text-slate-500">{event.createdAt}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">
                            {cleanEventMessage(event.message)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <LedgerSection entries={state.detail.ledgerEntries} />
                </div>
              </details>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
              <EmptyState title="분쟁을 선택하세요" />
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function SettlementDecisionGuide({ detail }: { detail: AdminOrderDetail }) {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-slate-500">구매자 결제 / 에스크로</p>
        <p className="mt-2 text-2xl font-black text-slate-950">
          {detail.grossAmount} {detail.currency}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">환불 결정 시 구매자에게 전액 반환</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-emerald-700">판매자 실제 정산</p>
        <p className="mt-2 text-2xl font-black text-emerald-700">
          {detail.sellerReceivableAmount} {detail.currency}
        </p>
        <p className="mt-1 text-xs font-bold text-emerald-700">판매자 승소 시 지급되는 금액</p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
        <p className="text-xs font-black uppercase text-sky-700">플랫폼 수수료</p>
        <p className="mt-2 text-2xl font-black text-sky-700">
          {detail.platformFeeAmount} {detail.currency}
        </p>
        <p className="mt-1 text-xs font-bold text-sky-700">판매자 정산 시 수익 원장에 기록</p>
      </div>
    </section>
  );
}

function DecisionPreview({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-600">{cleanEventMessage(body)}</p>
    </div>
  );
}

function LedgerSection({ entries }: { entries: AdminOrderDetail["ledgerEntries"] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold">지갑 원장</h3>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        {entries.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">연결된 원장 기록이 없습니다.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {entries.map((entry) => (
              <div key={entry.entryId} className="p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {ledgerTypeLabel(entry.type)} / {bucketLabel(entry.bucket)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {cleanEventMessage(entry.memo || "메모 없음")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        entry.direction === "CREDIT"
                          ? "font-bold text-emerald-700"
                          : "font-bold text-red-600"
                      }
                    >
                      {directionLabel(entry.direction)} {entry.amount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{entry.createdAt}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function getInitialDisputeParams() {
  if (typeof window === "undefined") {
    return { orderId: "", view: "OPEN", query: "" };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get("orderId") ?? "",
    view: params.get("view") ?? "OPEN",
    query: params.get("query") ?? "",
  };
}

function getDisputeListSummary(disputes: AdminDisputesState["disputes"]) {
  return {
    open: disputes.filter((dispute) => dispute.status === "DISPUTED").length,
    refunded: disputes.filter((dispute) => dispute.status === "REFUNDED").length,
    released: disputes.filter((dispute) => dispute.status === "COMPLETED").length,
  };
}

function getDisputeNextAction(status: string) {
  if (status === "DISPUTED") return "판단 필요";
  if (status === "REFUNDED") return "구매자 환불 완료";
  if (status === "COMPLETED") return "판매자 정산 완료";
  return null;
}

function cleanEventMessage(message: string) {
  const normalized = message
    .replace("Buyer reported a problem:", "구매자 분쟁 사유:")
    .replace("Admin resolved dispute and refunded buyer.", "관리자가 구매자 환불로 분쟁을 종료했습니다.")
    .replace("Admin resolved dispute and released settlement to seller.", "관리자가 판매자 정산으로 분쟁을 종료했습니다.")
    .replace("Note:", "메모:");
  if (hasCorruptedText(normalized)) return "내용 확인이 필요합니다.";
  return normalized;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DISPUTED: "분쟁 중",
    REFUNDED: "환불 완료",
    COMPLETED: "거래 완료",
    CANCELED: "취소",
    CANCELLED: "취소",
    REQUESTED: "주문 요청",
    ESCROW_LOCKED: "에스크로 잠금",
    DELIVERY_IN_PROGRESS: "전달 중",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수확정 대기",
  };
  return labels[status] ?? status;
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DISPUTE_REFUND: "분쟁 환불",
    DISPUTE_RELEASE: "분쟁 정산",
    ESCROW_LOCK: "에스크로 잠금",
    ESCROW_RELEASE: "에스크로 해제",
    ORDER_REFUND: "주문 환불",
    ORDER_COMPLETED_RELEASE_TO_SELLER: "거래 완료 정산",
    PLATFORM_FEE_COLLECTED: "플랫폼 수수료",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function directionLabel(direction: string) {
  return direction === "CREDIT" ? "+" : "-";
}

function bucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    AVAILABLE: "사용 가능",
    WITHDRAWABLE: "출금 가능",
    ESCROW_LOCKED: "에스크로",
    PENDING_SETTLEMENT: "정산 대기",
    PLATFORM_REVENUE: "플랫폼 수익",
  };
  return labels[bucket] ?? bucket;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "DISPUTED"
      ? "bg-red-100 text-red-700"
      : status === "REFUNDED"
        ? "bg-blue-100 text-blue-700"
        : status === "COMPLETED"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{statusLabel(status)}</span>;
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "blue" | "emerald";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-700 bg-red-50"
      : tone === "blue"
        ? "text-blue-700 bg-blue-50"
        : "text-emerald-700 bg-emerald-50";

  return (
    <div className={`rounded-lg px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function TraceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[var(--gg-accent)] hover:text-sky-700"
    >
      {label}
    </a>
  );
}

function ReviewCheckItem({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-sky-500" />
      <span>{label}</span>
    </label>
  );
}

function EmptyState({ title }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="font-bold text-slate-700">{title}</p>
    </div>
  );
}

function hasCorruptedText(value: string) {
  return value.includes("\uFFFD");
}
