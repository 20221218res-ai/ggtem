import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";

const lifecycleRows = [
  ["1", "주문 생성", "구매자 결제 대기", <StatusPill key="wait" tone="amber">대기</StatusPill>],
  ["2", "에스크로 잠금", "구매자 잔액 차감", <StatusPill key="lock" tone="blue">진행</StatusPill>],
  ["3", "전달 진행", "판매자 전달", <StatusPill key="delivery" tone="blue">진행</StatusPill>],
  ["4", "인수확정", "판매자 정산", <StatusPill key="done" tone="green">완료</StatusPill>],
  ["5", "분쟁/환불", "관리자 중재", <StatusPill key="risk" tone="red">예외</StatusPill>],
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
      subtitle="주문, 에스크로, 전달, 정산, 예외 흐름을 점검합니다."
      actions={
        <>
          <LinkLike href="/admin/orders">주문 관리</LinkLike>
          <LinkLike href="/admin/finance/ledger">지갑 원장</LinkLike>
          <LinkLike href="/admin/audit?query=ORDER">감사 로그</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "진행 주문", value: "12", hint: "에스크로 포함", tone: "blue" },
          { label: "완료", value: "84", hint: "최근 7일", tone: "green" },
          { label: "분쟁", value: "3", hint: "관리자 확인", tone: "red" },
          { label: "환불", value: "2", hint: "원장 대조", tone: "amber" },
        ]}
      />

      <SoftNotice tone="amber">
        주문 상태 변경은 재고, 지갑 원장, 감사 로그가 같은 주문 ID로 연결되어야 합니다.
      </SoftNotice>

      <Panel title="상태 흐름">
        <DataTable headers={["단계", "상태", "동작", "표시"]} rows={lifecycleRows} />
      </Panel>
    </AdminMockPage>
  );
}
