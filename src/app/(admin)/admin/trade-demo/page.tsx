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

const demoRows = [
  ["판매 매물", "Lineage W", "데포로쥬", "10만 아데나", <StatusPill key="sell" tone="green">노출</StatusPill>],
  ["구매 요청", "Lineage W", "켄라우헬", "50만 아데나", <StatusPill key="buy" tone="blue">대기</StatusPill>],
  ["주문", "Demo Gold Trade", "전체", "0.0005 USDT", <StatusPill key="order" tone="amber">진행</StatusPill>],
];

export default async function AdminTradeDemoPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="TRADE"
      title="거래 테스트"
      subtitle="판매, 구매요청, 주문 생성 흐름을 빠르게 확인합니다."
      actions={
        <>
          <LinkLike href="/admin/orders">주문 관리</LinkLike>
          <LinkLike href="/admin/order-lifecycle">상태 흐름</LinkLike>
          <LinkLike href="/admin/finance/ledger">지갑 원장</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "매물", value: "3", hint: "판매 중", tone: "green" },
          { label: "구매요청", value: "2", hint: "판매자 응답 대기", tone: "blue" },
          { label: "주문", value: "1", hint: "에스크로 잠금", tone: "amber" },
          { label: "예외", value: "0", hint: "정상", tone: "slate" },
        ]}
      />

      <SoftNotice tone="amber">
        이 화면은 운영자가 거래 흐름을 빠르게 확인하는 테스트용 화면입니다.
      </SoftNotice>

      <Panel title="테스트 데이터">
        <DataTable headers={["유형", "게임", "서버", "수량/가격", "상태"]} rows={demoRows} />
      </Panel>
    </AdminMockPage>
  );
}
