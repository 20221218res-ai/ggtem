"use client";

import { FormEvent, useState } from "react";
import {
  lockPurchaseQuantity,
  type ListingInventorySnapshot,
  type LockPurchaseQuantityResult,
} from "@/lib/inventory/purchase-lock";

const initialInventory: ListingInventorySnapshot = {
  listingId: "listing-demo-900k",
  totalQuantity: "900000",
  availableQuantity: "900000",
  lockedQuantity: "0",
  soldQuantity: "0",
};

const inventoryChecks = [
  {
    title: "주문 생성",
    body: "구매자가 주문을 만들면 판매 가능 재고가 즉시 줄고 잠금 재고가 늘어야 합니다.",
  },
  {
    title: "판매글 노출",
    body: "판매 가능 재고가 0이면 공개 매물 목록에서는 사라지고 판매자 내역에만 남아야 합니다.",
  },
  {
    title: "주문 취소",
    body: "취소 시 잠금 재고는 판매 가능 재고로 복구되고 이벤트 로그가 남아야 합니다.",
  },
  {
    title: "인수확정",
    body: "완료 시 잠금 재고는 판매 완료 재고로 이동하고 판매자 정산 흐름과 이어져야 합니다.",
  },
];

const lockTraceRows = [
  ["주문", "주문 상세에서 주문 ID와 구매 수량 확인", "/admin/orders"],
  ["판매글", "판매자 매물의 판매 가능/잠금/판매 완료 수량 확인", "/admin/users"],
  ["장부", "구매자 에스크로 잠금액과 주문 금액 대조", "/admin/finance/ledger"],
  ["감사", "관리자 개입, 취소, 완료 처리 사유 확인", "/admin/audit?query=INVENTORY"],
];

export default function InventoryLockPage() {
  const [inventory, setInventory] = useState(initialInventory);
  const [purchaseQuantity, setPurchaseQuantity] = useState("100000");
  const [result, setResult] = useState<LockPurchaseQuantityResult | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const nextResult = lockPurchaseQuantity(inventory, {
        listingId: inventory.listingId,
        quantity: purchaseQuantity,
        orderId: `order-demo-${Date.now()}`,
      });

      setInventory(nextResult.inventory);
      setResult(nextResult);
    } catch (lockError) {
      setError(
        lockError instanceof Error
          ? lockError.message
          : "재고 잠금에 실패했습니다.",
      );
    }
  }

  function handleReset() {
    setInventory(initialInventory);
    setPurchaseQuantity("100000");
    setResult(null);
    setError("");
  }

  const lockRate =
    Number(inventory.totalQuantity) > 0
      ? Math.round(
          (Number(inventory.lockedQuantity) / Number(inventory.totalQuantity)) *
            100,
        )
      : 0;

  return (
    <main className="px-6 py-10 text-slate-900">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              관리자 / 재고 잠금 검증
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              구매 수량 잠금 테스트
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              구매자가 매물을 주문하면 판매 가능 수량은 줄고 잠금 수량은
              늘어납니다. 주문 완료 또는 취소 전까지 재고가 잠긴 상태로 유지되는지
              확인하는 운영 검증 도구입니다.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            현재 잠금률 <span className="font-semibold">{lockRate}%</span>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          <GuideCard
            title="1. 주문 생성"
            body="구매 수량을 입력하고 잠금 버튼을 누르면 판매 가능 수량에서 해당 수량이 차감됩니다."
          />
          <GuideCard
            title="2. 잠금 유지"
            body="주문이 완료되거나 취소되기 전까지 잠긴 수량은 다시 판매 가능 수량으로 보이면 안 됩니다."
          />
          <GuideCard
            title="3. 초과 방지"
            body="판매 가능 수량보다 큰 구매 수량은 잠금 처리되지 않아야 합니다."
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">운영 추적 기준</p>
              <h2 className="mt-1 text-xl font-semibold">재고 잠금이 연결되는 화면</h2>
            </div>
            <p className="text-sm text-slate-500">
              실제 재고 변경 없이, 운영자가 확인해야 할 연결 경로만 정리합니다.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {lockTraceRows.map((row) => (
              <a
                key={row[0]}
                href={row[2]}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <p className="text-sm font-semibold text-slate-950">{row[0]}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{row[1]}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="전체 재고" value={inventory.totalQuantity} />
          <MetricCard label="판매 가능" value={inventory.availableQuantity} />
          <MetricCard label="잠금" value={inventory.lockedQuantity} tone="warning" />
          <MetricCard label="판매 완료" value={inventory.soldQuantity} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-slate-500">테스트 입력</p>
              <h2 className="mt-1 text-xl font-semibold">구매 수량 잠금</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재 판매 가능 수량 안에서만 잠금 처리가 성공해야 합니다.
              </p>
            </div>

            <label className="mt-5 flex flex-col gap-2 text-sm font-semibold text-slate-700">
              구매 수량
              <input
                value={purchaseQuantity}
                onChange={(event) => setPurchaseQuantity(event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-400"
                inputMode="decimal"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                오류: {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
              >
                구매 수량 잠금
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              >
                900,000 재고로 초기화
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">잠금 결과</p>
              <h2 className="mt-1 text-xl font-semibold">최근 이벤트</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                성공 시 주문 ID, 잠금 수량, 변경 후 재고 스냅샷을 확인합니다.
              </p>
            </div>

            {result ? (
              <pre className="mt-5 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-800">
                {JSON.stringify(result.event, null, 2)}
              </pre>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                아직 잠금 이벤트가 없습니다. 구매 수량을 입력한 뒤 잠금 버튼을 눌러보세요.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">운영 확인 포인트</p>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-amber-900 md:grid-cols-3">
            <p>판매 가능 수량은 주문 생성 시 즉시 감소해야 합니다.</p>
            <p>잠금 수량은 주문 취소 또는 완료 전까지 유지되어야 합니다.</p>
            <p>판매 완료 처리는 별도 완료 로직에서 잠금 수량을 판매 완료로 이동해야 합니다.</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">실서비스 점검 체크</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {inventoryChecks.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function GuideCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "warning" ? "text-amber-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
