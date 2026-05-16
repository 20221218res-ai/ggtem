import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  LinkLike,
  MetricGrid,
  Panel,
} from "../admin-prototype-ui";

export default async function AdminTradeDemoPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="TRADE"
      title="거래 점검"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/orders" tone="primary">주문 관리</LinkLike>
          <LinkLike href="/admin/order-lifecycle">상태 흐름</LinkLike>
          <LinkLike href="/admin/finance/ledger">지갑 원장</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "주문", value: "실데이터", hint: "", tone: "blue" },
          { label: "에스크로", value: "원장 확인", hint: "", tone: "cyan" },
          { label: "분쟁", value: "분쟁 화면", hint: "", tone: "amber" },
          { label: "감사", value: "로그 확인", hint: "", tone: "slate" },
        ]}
      />

      <Panel title="점검 이동">
        <div className="grid gap-3 md:grid-cols-4">
          <LinkLike href="/admin/orders" tone="primary">주문</LinkLike>
          <LinkLike href="/admin/disputes">분쟁</LinkLike>
          <LinkLike href="/admin/finance/ledger">원장</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
        </div>
      </Panel>
    </AdminMockPage>
  );
}
