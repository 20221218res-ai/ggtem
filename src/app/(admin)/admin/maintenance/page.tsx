import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  ButtonLike,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

const moduleRows = [
  ["유저 페이지", <StatusPill key="user" tone="green">정상</StatusPill>, "열기"],
  ["주문/채팅", <StatusPill key="order" tone="green">정상</StatusPill>, "주문"],
  ["충전/출금", <StatusPill key="wallet" tone="green">정상</StatusPill>, "처리"],
  ["알림", <StatusPill key="notification" tone="amber">확인</StatusPill>, "로그"],
];

export default async function AdminMaintenancePage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="점검"
      title="점검 / 유지보수"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/audit?query=MAINTENANCE">점검 이력</LinkLike>
          <ButtonLike tone="primary" disabled>점검 예약</ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "서비스", value: "정상", hint: "", tone: "green" },
          { label: "차단", value: "0", hint: "", tone: "green" },
          { label: "예약", value: "0", hint: "", tone: "slate" },
          { label: "확인", value: "알림", hint: "", tone: "amber" },
        ]}
      />

      <Panel title="모듈 상태">
        <DataTable headers={["모듈", "상태", "액션"]} rows={moduleRows} />
      </Panel>

      <Panel title="바로가기">
        <div className="grid gap-3 md:grid-cols-4">
          <LinkLike href="/admin/orders" tone="primary">주문</LinkLike>
          <LinkLike href="/admin/deposits">충전</LinkLike>
          <LinkLike href="/admin/withdrawals">출금</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
        </div>
      </Panel>
    </AdminMockPage>
  );
}
