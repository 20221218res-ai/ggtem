import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

const lifecycleRows = [
  ["1", "주문 생성", "결제 대기", <StatusPill key="requested" tone="amber">REQUESTED</StatusPill>],
  ["2", "에스크로", "잔액 잠금", <StatusPill key="escrow" tone="blue">ESCROW_LOCKED</StatusPill>],
  ["3", "전달", "판매자 진행", <StatusPill key="delivery" tone="blue">DELIVERY_IN_PROGRESS</StatusPill>],
  ["4", "인수확정", "정산 대기", <StatusPill key="confirm" tone="amber">BUYER_CONFIRM_PENDING</StatusPill>],
  ["5", "완료/분쟁", "정산 또는 중재", <StatusPill key="done" tone="green">FINAL</StatusPill>],
];

export default async function OrderLifecyclePage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="FLOW"
      title="주문 라이프사이클"
      subtitle="주문 상태 흐름"
      actions={
        <>
          <LinkLike href="/admin/orders">주문</LinkLike>
          <LinkLike href="/admin/finance/ledger">원장</LinkLike>
          <LinkLike href="/admin/audit?query=ORDER">감사</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "상태 흐름", value: "5단계", hint: "", tone: "blue" },
          { label: "에스크로", value: "원장", hint: "", tone: "cyan" },
          { label: "분쟁", value: "중재", hint: "", tone: "red" },
          { label: "정산", value: "완료", hint: "", tone: "green" },
        ]}
      />

      <Panel title="상태 흐름">
        <DataTable headers={["단계", "상태", "동작", "표시"]} rows={lifecycleRows} />
      </Panel>
    </AdminMockPage>
  );
}
