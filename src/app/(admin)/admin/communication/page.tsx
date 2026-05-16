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

const channelRows = [
  ["이메일", "Resend", <StatusPill key="email" tone="green">연결</StatusPill>],
  ["텔레그램", "운영 중요 알림", <StatusPill key="telegram" tone="green">연결</StatusPill>],
  ["푸시", "미연결", <StatusPill key="push" tone="slate">준비중</StatusPill>],
  ["SMS", "미연결", <StatusPill key="sms" tone="slate">준비중</StatusPill>],
];

export default async function AdminCommunicationPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="MSG"
      title="커뮤니케이션"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/cms">공지/FAQ</LinkLike>
          <LinkLike href="/admin/audit?query=NOTIFICATION">감사</LinkLike>
          <ButtonLike tone="primary" disabled title="캠페인 발송은 연결 전입니다.">
            캠페인 준비중
          </ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "이메일", value: "연결", hint: "", tone: "green" },
          { label: "텔레그램", value: "연결", hint: "", tone: "green" },
          { label: "푸시", value: "준비중", hint: "", tone: "slate" },
          { label: "SMS", value: "준비중", hint: "", tone: "slate" },
        ]}
      />

      <Panel title="채널 상태">
        <DataTable headers={["채널", "용도", "상태"]} rows={channelRows} />
      </Panel>
    </AdminMockPage>
  );
}
