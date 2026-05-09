import { Card } from "@/components/ui";

type OrderMoneyFlowCardProps = {
  perspective: "BUYER" | "SELLER";
  status: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  currency: string;
};

export default function OrderMoneyFlowCard({
  perspective,
  status,
  grossAmount,
  sellerReceivableAmount,
  currency,
}: OrderMoneyFlowCardProps) {
  const state = getMoneyFlowState(status, perspective);

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-emerald-700">거래 금액</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
            {state.title}
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-700">
          {state.badge}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MoneyFlowBox label="주문 금액" value={`${grossAmount} ${currency}`} />
        <MoneyFlowBox label="판매자 정산" value={`${sellerReceivableAmount} ${currency}`} />
        <MoneyFlowBox label="현재 위치" value={state.location} />
      </div>
    </Card>
  );
}

function MoneyFlowBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white/75 p-4">
      <p className="text-xs font-black text-[var(--gg-subtle)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--gg-text)]">{value}</p>
    </div>
  );
}

function getMoneyFlowState(status: string, perspective: "BUYER" | "SELLER") {
  if (status === "COMPLETED") {
    return {
      title: perspective === "BUYER" ? "정산 완료" : "판매 대금 반영 완료",
      badge: "완료",
      location: perspective === "BUYER" ? "판매자 지갑" : "내 지갑",
    };
  }

  if (status === "CANCELED" || status === "REFUNDED") {
    return {
      title: "거래 종료",
      badge: "반환",
      location: "구매자 지갑",
    };
  }

  if (status === "DISPUTED") {
    return {
      title: "분쟁으로 정산 보류",
      badge: "보류",
      location: "에스크로",
    };
  }

  return {
    title: "인수확정 전까지 에스크로 보관",
    badge: "에스크로",
    location: "플랫폼 에스크로",
  };
}
