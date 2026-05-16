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

const reviewRows = [
  ["고위험 신고", "/admin/risk", <StatusPill key="risk" tone="amber">리스크 큐</StatusPill>],
  ["출금 대기", "/admin/withdrawals", <StatusPill key="withdrawals" tone="amber">출금</StatusPill>],
  ["지갑 원장", "/admin/finance/ledger", <StatusPill key="ledger" tone="blue">원장</StatusPill>],
  ["감사 로그", "/admin/audit", <StatusPill key="audit" tone="slate">감사</StatusPill>],
];

export default async function AmlPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="AML"
      title="AML 점검"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/risk">리스크</LinkLike>
          <LinkLike href="/admin/finance/ledger">원장</LinkLike>
          <LinkLike href="/admin/audit?query=AML">감사</LinkLike>
          <ButtonLike tone="primary" disabled>
            보고 준비중
          </ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "자동 AML", value: "준비중", hint: "", tone: "slate" },
          { label: "제재/동결", value: "수동", hint: "", tone: "amber" },
          { label: "리스크 큐", value: "연결", hint: "", tone: "blue" },
          { label: "원장 대조", value: "연결", hint: "", tone: "green" },
        ]}
      />

      <Panel title="점검 경로">
        <DataTable headers={["항목", "경로", "상태"]} rows={reviewRows} />
      </Panel>
    </AdminMockPage>
  );
}
