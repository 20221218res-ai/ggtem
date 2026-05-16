import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

const checkRows = [
  ["권한", <StatusPill key="role" tone="green">확인</StatusPill>, "관리자"],
  ["입금 주소", <StatusPill key="address" tone="green">설정</StatusPill>, "주소"],
  ["충전", <StatusPill key="deposit" tone="amber">실거래 확인</StatusPill>, "충전"],
  ["출금", <StatusPill key="withdraw" tone="amber">실거래 확인</StatusPill>, "출금"],
  ["분쟁", <StatusPill key="dispute" tone="amber">중재 확인</StatusPill>, "분쟁"],
  ["알림", <StatusPill key="notification" tone="amber">발송 확인</StatusPill>, "알림"],
];

export default async function LaunchChecklistPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="LAUNCH"
      title="출시 체크"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/finance/reconciliation" tone="primary">정산 대조</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
          <LinkLike href="/admin/reports">리포트</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "필수", value: "6", hint: "", tone: "blue" },
          { label: "확인", value: "2", hint: "", tone: "green" },
          { label: "실거래", value: "2", hint: "", tone: "amber" },
          { label: "운영", value: "2", hint: "", tone: "cyan" },
        ]}
      />

      <Panel title="필수 항목">
        <DataTable headers={["항목", "상태", "이동"]} rows={checkRows} />
      </Panel>

      <Panel title="바로가기">
        <div className="grid gap-3 md:grid-cols-5">
          <LinkLike href="/admin/admin-accounts">관리자</LinkLike>
          <LinkLike href="/admin/deposit-addresses">주소</LinkLike>
          <LinkLike href="/admin/deposits" tone="primary">충전</LinkLike>
          <LinkLike href="/admin/withdrawals">출금</LinkLike>
          <LinkLike href="/admin/disputes">분쟁</LinkLike>
        </div>
      </Panel>
    </AdminMockPage>
  );
}
