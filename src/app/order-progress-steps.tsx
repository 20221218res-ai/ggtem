type OrderProgressStepsProps = {
  status: string;
  perspective: "BUYER" | "SELLER";
};

type StepState = "done" | "active" | "waiting" | "blocked";

const steps = [
  { key: "PAYMENT", buyer: "결제 완료", seller: "결제 확인" },
  { key: "DELIVERY", buyer: "전달 확인", seller: "전달 진행" },
  { key: "CONFIRM", buyer: "인수확정", seller: "확정 대기" },
  { key: "SETTLEMENT", buyer: "거래 완료", seller: "정산 완료" },
];

const terminalLabels: Record<string, string> = {
  CANCELED: "취소",
  DISPUTED: "분쟁",
  REFUNDED: "환불",
};

export default function OrderProgressSteps({
  status,
  perspective,
}: OrderProgressStepsProps) {
  const activeIndex = getActiveStepIndex(status);
  const terminalLabel = terminalLabels[status];

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">ESCROW</p>
          <h2 className="mt-1 text-2xl font-black">거래 단계</h2>
        </div>
        <span className={`rounded-xl px-3 py-2 text-xs font-black ${getStatusTone(status)}`}>
          {getOrderStatusLabel(status)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const state = getStepState(index, activeIndex, status);
          const label = perspective === "BUYER" ? step.buyer : step.seller;

          return (
            <div key={step.key} className={`rounded-xl border p-4 ${getStepTone(state)}`}>
              <p className="text-xs font-black opacity-70">STEP {index + 1}</p>
              <p className="mt-2 text-base font-black">{label}</p>
              <p className="mt-3 text-xs font-black">{getStepLabel(state)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
        <p className="text-sm font-black text-[var(--gg-text)]">
          {getMoneyLocationTitle(status, perspective)}
        </p>
      </div>

      {terminalLabel ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          현재 주문은 {terminalLabel} 상태입니다.
        </div>
      ) : null}
    </section>
  );
}

function getStepState(index: number, activeIndex: number, status: string): StepState {
  if (["CANCELED", "REFUNDED", "DISPUTED"].includes(status)) return "blocked";
  if (status === "COMPLETED" || index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "waiting";
}

function getActiveStepIndex(status: string) {
  if (["REQUESTED", "ESCROW_LOCKED", "SELLER_RESPONSE_PENDING"].includes(status)) return 0;
  if (status === "DELIVERY_IN_PROGRESS") return 1;
  if (["DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING"].includes(status)) return 2;
  if (status === "COMPLETED") return 3;
  return 0;
}

function getStepTone(state: StepState) {
  const tones: Record<StepState, string> = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    active: "border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] text-[var(--gg-text)]",
    waiting: "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] text-[var(--gg-muted)]",
    blocked: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return tones[state];
}

function getStepLabel(state: StepState) {
  const labels: Record<StepState, string> = {
    done: "완료",
    active: "현재",
    waiting: "대기",
    blocked: "중단",
  };

  return labels[state];
}

function getStatusTone(status: string) {
  if (["REQUESTED", "SELLER_RESPONSE_PENDING", "BUYER_CONFIRM_PENDING"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  if (["ESCROW_LOCKED", "DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED"].includes(status)) {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (["DISPUTED", "CANCELED", "REFUNDED"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function getOrderStatusLabel(status: string) {
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

function getMoneyLocationTitle(status: string, perspective: "BUYER" | "SELLER") {
  if (status === "COMPLETED") {
    return perspective === "BUYER"
      ? "인수확정이 완료되어 판매자에게 정산되었습니다."
      : "판매 대금이 지갑에 반영되었습니다.";
  }

  if (status === "DISPUTED") return "분쟁 검토 중이라 정산이 보류되어 있습니다.";
  if (status === "CANCELED" || status === "REFUNDED") return "거래가 종료되어 정산이 진행되지 않습니다.";

  return "인수확정 전까지 결제 금액은 에스크로에 안전하게 보관됩니다.";
}
