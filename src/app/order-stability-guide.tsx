type OrderStabilityGuideProps = {
  status: string;
  perspective: "BUYER" | "SELLER";
};

const ACTIVE_STATUSES = [
  "ESCROW_LOCKED",
  "SELLER_RESPONSE_PENDING",
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
];

export default function OrderStabilityGuide({
  status,
  perspective,
}: OrderStabilityGuideProps) {
  const isBuyer = perspective === "BUYER";
  const canConfirm = ["DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING"].includes(status);
  const canDispute = ACTIVE_STATUSES.includes(status);
  const isFinal = ["COMPLETED", "CANCELED", "REFUNDED"].includes(status);
  const isDisputed = status === "DISPUTED";

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">SAFETY</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--gg-text)]">
            {isBuyer ? "수령 후 인수확정" : "전달 후 확정 대기"}
          </h2>
        </div>
        <span className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]">
          {formatOrderStatus(status)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <GuideBox
          title={isBuyer ? "수령 확인" : "전달 완료"}
          state={isFinal ? "done" : isDisputed ? "blocked" : "current"}
        />
        <GuideBox
          title="인수확정"
          state={canConfirm ? "current" : isFinal ? "done" : "waiting"}
        />
        <GuideBox
          title="분쟁 전환"
          state={isDisputed ? "current" : canDispute ? "waiting" : "blocked"}
        />
      </div>
    </section>
  );
}

function GuideBox({
  title,
  state,
}: {
  title: string;
  state: "done" | "current" | "waiting" | "blocked";
}) {
  const tone = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    current: "border-sky-200 bg-sky-50 text-sky-900",
    waiting: "border-slate-200 bg-[var(--gg-control-bg)] text-[var(--gg-text)]",
    blocked: "border-rose-200 bg-rose-50 text-rose-900",
  }[state];

  const label = {
    done: "완료",
    current: "현재",
    waiting: "대기",
    blocked: "중단",
  }[state];

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-sm font-black">{title}</p>
    </div>
  );
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "거래 대기",
    ESCROW_LOCKED: "결제 완료",
    SELLER_RESPONSE_PENDING: "응답 대기",
    DELIVERY_IN_PROGRESS: "거래 진행",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "확정 대기",
    COMPLETED: "거래 완료",
    CANCELED: "취소",
    DISPUTED: "분쟁",
    REFUNDED: "환불",
  };

  return labels[status] ?? status;
}
