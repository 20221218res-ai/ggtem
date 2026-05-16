import {
  AdminMockPage,
  LinkLike,
  MetricGrid,
  Panel,
} from "../admin-prototype-ui";

export default function InventoryLockPage() {
  return (
    <AdminMockPage
      icon="LOCK"
      title="재고 잠금"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/orders" tone="primary">주문</LinkLike>
          <LinkLike href="/admin/finance/ledger">원장</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "판매 가능", value: "주문에서 확인", hint: "", tone: "green" },
          { label: "잠금", value: "주문 생성", hint: "", tone: "amber" },
          { label: "복구", value: "취소/환불", hint: "", tone: "blue" },
          { label: "완료", value: "인수확정", hint: "", tone: "slate" },
        ]}
      />

      <Panel title="확인 화면">
        <div className="grid gap-3 md:grid-cols-4">
          <LinkLike href="/admin/orders" tone="primary">주문 목록</LinkLike>
          <LinkLike href="/admin/users">유저 매물</LinkLike>
          <LinkLike href="/admin/finance/ledger">지갑 원장</LinkLike>
          <LinkLike href="/admin/audit?query=INVENTORY">감사 로그</LinkLike>
        </div>
      </Panel>
    </AdminMockPage>
  );
}
